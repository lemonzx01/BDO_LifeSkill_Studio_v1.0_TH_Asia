import type { ItemId, MarketPrice } from "@/lib/engine/types";
import { fetchPrices } from "./client";

/**
 * Small in-memory TTL cache in front of the market API. Good enough until the
 * DB-backed snapshot (phase 2) lands: a warm serverless instance serves all
 * guild members from one upstream call per TTL.
 */
const TTL_MS = 5 * 60 * 1000;

interface Entry {
  price: MarketPrice;
  fetchedAt: number;
}

const store = new Map<ItemId, Entry>();
let lastSource: "official" | "arsha" | null = null;
let inflight: Promise<void> | null = null;

export async function getPrices(ids: ItemId[], { force = false } = {}): Promise<{
  prices: Record<ItemId, MarketPrice>;
  fetchedAt: number | null;
  source: "official" | "arsha" | null;
  missing: ItemId[];
}> {
  const now = Date.now();
  const stale = ids.filter((id) => {
    const e = store.get(id);
    return force || !e || now - e.fetchedAt > TTL_MS;
  });

  if (stale.length) {
    // coalesce concurrent refreshes
    if (!inflight) {
      inflight = (async () => {
        try {
          const { prices, source } = await fetchPrices(stale);
          const t = Date.now();
          for (const p of prices) store.set(p.id, { price: p, fetchedAt: t });
          // remember ids the market does not know so we do not refetch them every call
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
