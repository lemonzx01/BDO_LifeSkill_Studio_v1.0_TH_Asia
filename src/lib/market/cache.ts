import type { ItemId, MarketPrice } from "@/lib/engine/types";
import { fetchPrices } from "./client";
import { getSnapshotPrices, SNAPSHOT_TTL_MS } from "./snapshot";

/**
 * Prices for the recipe engine. Preferred source is the whole-market snapshot
 * in the database (shared by every server instance); when that is missing or
 * stale we fall back to a direct upstream fetch kept in a small in-memory cache.
 */
const TTL_MS = 5 * 60 * 1000;

interface Entry {
  price: MarketPrice;
  fetchedAt: number;
}

const store = new Map<ItemId, Entry>();
let lastSource: "official" | "arsha" | "snapshot" | null = null;
let inflight: Promise<void> | null = null;

export async function getPrices(ids: ItemId[], { force = false } = {}): Promise<{
  prices: Record<ItemId, MarketPrice>;
  fetchedAt: number | null;
  source: "official" | "arsha" | "snapshot" | null;
  missing: ItemId[];
}> {
  // 1) database snapshot, if fresh enough
  if (!force) {
    try {
      const snap = await getSnapshotPrices(ids);
      if (snap.at && Date.now() - snap.at.getTime() < SNAPSHOT_TTL_MS) {
        const missing = ids.filter((id) => !snap.prices[id]);
        // items the market does not list at all come back as "unknown" (price 0)
        for (const id of missing) snap.prices[id] = { id, price: 0, stock: 0, totalTrades: 0, updatedAt: snap.at.getTime() };
        lastSource = "snapshot";
        return { prices: snap.prices, fetchedAt: snap.at.getTime(), source: "snapshot", missing: [] };
      }
    } catch (e) {
      console.warn("snapshot prices unavailable:", (e as Error).message);
    }
  }

  // 2) direct upstream fetch with a per-instance cache
  const now = Date.now();
  const stale = ids.filter((id) => {
    const e = store.get(id);
    return force || !e || now - e.fetchedAt > TTL_MS;
  });

  if (stale.length) {
    if (!inflight) {
      inflight = (async () => {
        try {
          const { prices, source } = await fetchPrices(stale);
          const t = Date.now();
          for (const p of prices) store.set(p.id, { price: p, fetchedAt: t });
          const known = new Set(prices.map((p) => p.id));
          for (const id of stale) {
            if (!known.has(id) && !store.has(id)) {
              store.set(id, { price: { id, price: 0, stock: 0, totalTrades: 0, updatedAt: t }, fetchedAt: t });
            }
          }
          lastSource = source;
        } finally {
          inflight = null;
        }
      })();
    }
    try {
      await inflight;
    } catch (e) {
      console.error("price refresh failed:", (e as Error).message);
    }
  }

  const prices: Record<ItemId, MarketPrice> = {};
  const missing: ItemId[] = [];
  let fetchedAt: number | null = null;
  for (const id of ids) {
    const e = store.get(id);
    if (e) {
      prices[id] = e.price;
      fetchedAt = fetchedAt === null ? e.fetchedAt : Math.min(fetchedAt, e.fetchedAt);
    } else missing.push(id);
  }
  return { prices, fetchedAt, source: lastSource, missing };
}
