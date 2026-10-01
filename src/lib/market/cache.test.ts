import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { items as itemList } from "@/lib/data";
import { resetDbCache } from "@/lib/db";
import type { ItemId } from "@/lib/engine/types";
import { getPrices } from "./cache";
import { refreshMarket, type SnapshotItem } from "./snapshot";

// stands in for the upstream market APIs: counts how often a forced request reaches them
const upstream = vi.hoisted(() => ({ calls: 0, asked: [] as number[] }));
vi.mock("./client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./client")>();
  return {
    ...actual,
    fetchPrices: async (ids: ItemId[]) => {
      upstream.calls += 1;
      upstream.asked.push(...ids);
      return { prices: ids.map((id) => ({ id, price: 999, stock: 1, totalTrades: 1, updatedAt: Date.now() })), source: "official" as const };
    },
  };
});

const items: SnapshotItem[] = [
  { id: 1, th: "น้ำบริสุทธิ์", price: 150, stock: 100, trades: 5000, vol14: 900 },
  { id: 2, th: "เลือดคนบาป", price: 80000, stock: 3, trades: 700, vol14: 120 },
];

/** builds a snapshot whose timestamp is `ageMs` in the past */
const snapshotAged = (ageMs: number) =>
  refreshMarket({ force: true, backfill: 0 }, { fetchSnapshot: async () => items, now: () => new Date(Date.now() - ageMs) });

beforeAll(() => {
  delete process.env.DATABASE_URL;
  resetDbCache();
});

beforeEach(() => {
  upstream.calls = 0;
  upstream.asked = [];
});

describe("getPrices force", () => {
  it("ignores force while the database snapshot is under a minute old", async () => {
    await snapshotAged(30_000);
    const r = await getPrices([1, 2], { force: true });
    expect(r.source).toBe("snapshot");
    expect(r.prices[1]?.price).toBe(150);
    expect(upstream.calls).toBe(0);
  });

  it("goes upstream when forced on an older snapshot, but only once a minute", async () => {
    await snapshotAged(2 * 60_000);
    // not forced: a two-minute-old snapshot is still within its five-minute TTL
    expect((await getPrices([1], {})).source).toBe("snapshot");
    expect(upstream.calls).toBe(0);

    const forced = await getPrices([1], { force: true });
    expect(forced.source).toBe("official");
    expect(forced.prices[1]?.price).toBe(999);
    expect(upstream.calls).toBe(1);

    // a second click straight away is answered from the fetch that just happened
    await getPrices([1], { force: true });
    expect(upstream.calls).toBe(1);
  });

  it("never asks upstream for ids the app does not know", async () => {
    await snapshotAged(10 * 60_000); // stale, so every request falls through to upstream
    const madeUp = Array.from({ length: 300 }, (_, i) => 2_000_000_000 + i);
    const r = await getPrices(madeUp, { force: true });
    expect(upstream.calls).toBe(0);
    expect(r.missing).toEqual(madeUp);
    expect(Object.keys(r.prices)).toHaveLength(0);

    // known ids in the same request still go: one from the item list, one from the (stale) snapshot
    const fromItemList = Number(Object.keys(itemList)[0]);
    const mixed = await getPrices([fromItemList, 2, ...madeUp.slice(0, 5)]);
    expect(upstream.calls).toBe(1);
    expect(upstream.asked.sort((a, b) => a - b)).toEqual([2, fromItemList].sort((a, b) => a - b));
    expect(mixed.prices[fromItemList]?.price).toBe(999);
    expect(mixed.missing).toEqual(madeUp.slice(0, 5));
  });
});
