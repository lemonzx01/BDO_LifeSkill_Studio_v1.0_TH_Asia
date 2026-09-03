import { beforeAll, describe, expect, it } from "vitest";
import { resetDbCache } from "@/lib/db";
import { getDailyHistory, getLastRefresh, getMarketScan, getSnapshotPrices, refreshMarket, type SnapshotItem } from "./snapshot";

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
});
