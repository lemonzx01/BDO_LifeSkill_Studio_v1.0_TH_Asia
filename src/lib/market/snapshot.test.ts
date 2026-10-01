import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { getDb, resetDbCache } from "@/lib/db";
import { marketMeta } from "@/lib/db/schema";
import { SourceUnavailableError } from "./client";
import {
  backfillHistory,
  claimManualRefresh,
  manualRefresh,
  getDailyHistory,
  getLastRefresh,
  getMarketScan,
  getMarketStatus,
  getSnapshotPrices,
  MANUAL_REFRESH_COOLDOWN_MS,
  recordTiming,
  refreshCooldownSec,
  refreshMarket,
  withoutUser,
  type SnapshotItem,
} from "./snapshot";

const T0 = new Date("2026-09-04T12:00:00Z");
const day = (d: Date, offset: number) => {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + offset);
  return x.toISOString().slice(0, 10);
};

const snapshot: SnapshotItem[] = [
  { id: 1, th: "น้ำบริสุทธิ์", icon: null, grade: 0, cat: "material", sub: "misc", price: 150, stock: 100, trades: 5000, vol14: 900 },
  { id: 2, th: "เลือดคนบาป", icon: null, grade: 0, cat: "material", sub: "blood", price: 80000, stock: 0, trades: 700, vol14: 120 },
  { id: 3, th: "ของไม่มีราคา", icon: null, grade: 0, cat: "misc", sub: null, price: 0, stock: 0, trades: 0, vol14: 0 },
];
const histories: Record<number, number[]> = {
  1: [100, 110, 120, 130, 140], // ends "today"; today's value is overridden by the snapshot (150)
  2: [90000, 85000, 80000],
};

const deps = {
  fetchSnapshot: async (lang: "th" | "en") => (lang === "th" ? snapshot : snapshot.map((s) => ({ ...s, th: `EN ${s.id}` }))),
  fetchHistory: async (id: number) => histories[id] ?? [],
  now: () => T0,
};

beforeAll(() => {
  delete process.env.DATABASE_URL;
  resetDbCache();
});

describe("market snapshot", () => {
  it("ingests a snapshot, writes today's daily row and backfills history", async () => {
    const r = await refreshMarket({ force: true, backfill: 10 }, deps);
    expect(r.refreshed).toBe(true);
    expect(r.source).toBe("bdolytics");
    expect(r.count).toBe(3);
    expect(r.backfilled).toBe(2); // item 3 has price 0 and is skipped
    expect((await getLastRefresh()).at?.toISOString()).toBe(T0.toISOString());

    const h1 = await getDailyHistory(1);
    expect(h1.map((x) => x.price)).toEqual([100, 110, 120, 130, 150]);
    expect(h1[h1.length - 1].day).toBe(day(T0, 0));
    expect(h1[0].day).toBe(day(T0, -4));
  });

  it("aggregates 90/30/7-day stats for the scan", async () => {
    const scan = await getMarketScan({ now: () => T0 });
    expect(scan.rows.map((x) => x.id).sort()).toEqual([1, 2]); // price 0 excluded
    const one = scan.rows.find((x) => x.id === 1)!;
    expect(one.en).toBe("EN 1");
    expect(one.days).toBe(5);
    expect(one.avg90).toBeCloseTo(122);
    expect(one.min90).toBe(100);
    expect(one.max90).toBe(150);
    expect(one.vol14).toBe(900);
    expect(one.stockHist).toEqual([100]); // only today's snapshot carries stock; backfilled days do not
    expect(one.tradesPerDay).toBeNull();
    const two = scan.rows.find((x) => x.id === 2)!;
    expect(two.days).toBe(3);
    expect(two.avg90).toBeCloseTo(85000);
  });

  it("skips refreshing inside the TTL and serves engine prices from the snapshot", async () => {
    const again = await refreshMarket({}, { ...deps, now: () => new Date(T0.getTime() + 60_000) });
    expect(again.refreshed).toBe(false);
    const { prices, at } = await getSnapshotPrices([1, 2, 999]);
    expect(at?.toISOString()).toBe(T0.toISOString());
    expect(prices[1]).toMatchObject({ price: 150, stock: 100, totalTrades: 5000, volume14d: 900 });
    expect(prices[999]).toBeUndefined();
  });

  it("falls back to the official search list when the snapshot source fails", async () => {
    const later = new Date(T0.getTime() + 60 * 60 * 1000);
    const r = await refreshMarket(
      { backfill: 0 },
      {
        fetchSnapshot: async () => {
          throw new Error("bdolytics down");
        },
        fetchByIds: async (ids) => ids.map((id) => ({ id, price: id === 1 ? 160 : 82000, stock: 5, totalTrades: 6000 })),
        now: () => later,
      },
    );
    expect(r.refreshed).toBe(true);
    expect(r.source).toBe("official");
    const scan = await getMarketScan({ now: () => later });
    const one = scan.rows.find((x) => x.id === 1)!;
    expect(one.price).toBe(160);
    expect(one.th).toBe("น้ำบริสุทธิ์"); // names kept from the previous snapshot
    expect(one.vol14).toBe(900); // volume kept when the fallback cannot provide it
    const h1 = await getDailyHistory(1);
    expect(h1[h1.length - 1].price).toBe(160); // today's row updated in place
  });

  it("never shows who loaded a page in the market status, even for rows stored earlier", async () => {
    await recordTiming("timing_market_page", { at: T0.toISOString(), user: "member1", totalMs: 120 });
    await recordTiming("timing_market_page_start", { at: T0.toISOString(), user: "member1", authMs: 3 });
    await recordTiming("timing_market_client", { at: T0.toISOString(), user: "member1", rows: 2 });
    const status = await getMarketStatus();
    expect(status.lastPage).toEqual({ at: T0.toISOString(), totalMs: 120 });
    expect(status.lastPageStart).toEqual({ at: T0.toISOString(), authMs: 3 });
    expect(status.lastClient).toEqual({ at: T0.toISOString(), rows: 2 });
    expect(withoutUser(null)).toBeNull();
  });

  it("stops the history backfill after one refusal from the official API", async () => {
    let calls = 0;
    const refusing = async () => {
      calls += 1;
      throw new SourceUnavailableError("official GetMarketPriceInfo answered with an HTML page");
    };
    const done = await backfillHistory(50, { fetchHistory: refusing, now: () => new Date("2026-09-04T10:00:00Z") });
    expect(done).toBe(0);
    expect(calls).toBeLessThanOrEqual(2); // one per worker at most, never the whole batch
    // cooled down: nothing is even attempted for a while
    calls = 0;
    await backfillHistory(50, { fetchHistory: refusing, now: () => new Date("2026-09-04T10:05:00Z") });
    expect(calls).toBe(0);
  });
});

describe("manual refresh cooldown", () => {
  const at = new Date("2026-10-01T12:00:00Z");
  const t = at.getTime();

  it("allows a refresh when there is no snapshot or it is two minutes old", () => {
    expect(refreshCooldownSec(null, t)).toBe(0);
    expect(refreshCooldownSec(at, t + MANUAL_REFRESH_COOLDOWN_MS)).toBe(0);
    expect(refreshCooldownSec(at, t + 10 * 60_000)).toBe(0);
  });

  it("says how many seconds are left inside the window", () => {
    expect(refreshCooldownSec(at, t)).toBe(120);
    expect(refreshCooldownSec(at, t + 30_000)).toBe(90);
    expect(refreshCooldownSec(at, t + 119_500)).toBe(1);
  });

  it("never asks for more than one full cooldown when the stored time is ahead of the clock", () => {
    expect(refreshCooldownSec(at, t - 10 * 60_000)).toBe(120);
  });
});

describe("manual refresh claim", () => {
  /** pretends the last manual start was `secondsAgo` seconds ago */
  async function startedAgo(secondsAgo: number) {
    const db = await getDb();
    await db
      .update(marketMeta)
      .set({ updatedAt: sql`now() - make_interval(secs => ${secondsAgo}::float8)` })
      .where(eq(marketMeta.key, "manual_refresh_started_at"));
  }

  it("lets exactly one of many parallel clicks start a refresh", async () => {
    const waits = await Promise.all(Array.from({ length: 8 }, () => claimManualRefresh()));
    expect(waits.filter((w) => w === 0)).toHaveLength(1);
    for (const w of waits.filter((x) => x > 0)) {
      expect(w).toBeGreaterThan(110);
      expect(w).toBeLessThanOrEqual(120);
    }
    await startedAgo(90);
    const w = await claimManualRefresh();
    expect(w).toBeGreaterThanOrEqual(29);
    expect(w).toBeLessThanOrEqual(31);
    await startedAgo(121);
    expect(await claimManualRefresh()).toBe(0);
  });

  it("keeps the cooldown after a failed refresh, so clicks do not retry it upstream", async () => {
    await startedAgo(600);
    let calls = 0;
    const failing = {
      fetchSnapshot: async (): Promise<SnapshotItem[]> => {
        calls += 1;
        throw new Error("bdolytics down");
      },
      fetchByIds: async () => {
        calls += 1;
        throw new Error("official down");
      },
      fetchHistory: async () => [],
    };
    await expect(manualRefresh(failing, 0)).rejects.toThrow();
    const tried = calls;
    expect(tried).toBeGreaterThan(0);
    const again = await manualRefresh(failing, 0);
    expect(again.ok).toBe(false);
    expect(again.ok === false && again.retryAfterSec).toBeGreaterThan(110);
    expect(calls).toBe(tried); // nothing went upstream the second time
  });

  it("runs once the cooldown is over and then waits for the new snapshot", async () => {
    await startedAgo(600);
    const now = () => new Date();
    const ok = await manualRefresh({ fetchSnapshot: async () => snapshot, fetchHistory: async () => [], now }, 0);
    expect(ok.ok).toBe(true);
    expect(ok.ok && ok.result.refreshed).toBe(true);
    // even with the start claim expired, a snapshot this fresh still makes the next click wait
    await startedAgo(600);
    const next = await manualRefresh({ fetchSnapshot: async () => snapshot, now }, 0);
    expect(next).toMatchObject({ ok: false });
    expect(next.ok === false && next.retryAfterSec).toBeGreaterThan(110);
  });
});
