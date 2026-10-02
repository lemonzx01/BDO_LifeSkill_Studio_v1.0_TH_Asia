import { allItemIds, items } from "@/lib/data";
import type { ItemId, MarketPrice } from "@/lib/engine/types";
import { TtlCache } from "@/lib/ttl-cache";
import { fetchPrices } from "./client";
import { getSnapshotPrices, SNAPSHOT_TTL_MS } from "./snapshot";

/**
 * Prices for the recipe engine. Preferred source is the whole-market snapshot
 * in the database (shared by every server instance); when that is missing or
 * stale we fall back to a direct upstream fetch kept in a small in-memory cache.
 */
const TTL_MS = 5 * 60 * 1000;
/**
 * A forced request ("refresh prices") still takes prices this fresh as they are: the database
 * snapshot, or this instance's own upstream fetch, so clicking again straight away is not
 * another upstream fetch of the same items.
 */
export const FORCE_MIN_AGE_MS = 60 * 1000;
/** Upstream answers stay usable this long as a fallback when a later fetch fails. */
const STORE_KEEP_MS = 60 * 60 * 1000;
/** Far above the number of known items; only a guard so memory stays bounded. */
const STORE_MAX_ENTRIES = 20_000;

interface Entry {
  price: MarketPrice;
  fetchedAt: number;
}

const store = new TtlCache<ItemId, Entry>(STORE_MAX_ENTRIES, STORE_KEEP_MS);

let knownIds: Set<ItemId> | null = null;

/** Ids from the app's own item data (recipe database and item list). */
function isKnownItem(id: ItemId): boolean {
  knownIds ??= new Set<ItemId>([...allItemIds(), ...Object.keys(items).map(Number)]);
  return knownIds.has(id);
}
let lastSource: "official" | "arsha" | "snapshot" | null = null;
let inflight: Promise<void> | null = null;

export interface PriceOptions {
  /** skip a snapshot (or this instance's own fetch) that is over a minute old */
  force?: boolean;
  /**
   * false: answer from the database snapshot whatever its age, and go to the market APIs only while
   * there is no snapshot at all. Used for visitors who are not signed in, so their page views never
   * turn into dozens of upstream requests; the snapshot itself is kept fresh by autoRefreshMarket.
   */
  upstream?: boolean;
}

export async function getPrices(
  ids: ItemId[],
  { force = false, upstream = true }: PriceOptions = {},
): Promise<{
  prices: Record<ItemId, MarketPrice>;
  fetchedAt: number | null;
  source: "official" | "arsha" | "snapshot" | null;
  missing: ItemId[];
  /** when the database snapshot was taken (ms), null when there is none or it could not be read: not part of the API answer */
  snapshotAt: number | null;
}> {
  // 1) database snapshot, if fresh enough (a forced request only skips it once it is a minute old;
  // without upstream any snapshot is fresh enough)
  const maxSnapshotAge = !upstream ? Infinity : force ? FORCE_MIN_AGE_MS : SNAPSHOT_TTL_MS;
  /** ids the (possibly stale) snapshot has a price for: real market items */
  let inSnapshot: Record<ItemId, MarketPrice> = {};
  let snapshotAt: number | null = null;
  try {
    const snap = await getSnapshotPrices(ids);
    snapshotAt = snap.at ? snap.at.getTime() : null;
    if (snap.at && Date.now() - snap.at.getTime() < maxSnapshotAge) {
      const missing = ids.filter((id) => !snap.prices[id]);
      // items the market does not list at all come back as "unknown" (price 0)
      for (const id of missing) snap.prices[id] = { id, price: 0, stock: 0, totalTrades: 0, updatedAt: snap.at.getTime() };
      lastSource = "snapshot";
      return { prices: snap.prices, fetchedAt: snap.at.getTime(), source: "snapshot", missing: [], snapshotAt };
    }
    inSnapshot = snap.prices;
  } catch (e) {
    console.warn("snapshot prices unavailable:", (e as Error).message);
  }

  // 2) direct upstream fetch with a per-instance cache. Only items the app knows (its own item data or
  // the market snapshot) are ever asked for: made-up ids would each cost upstream calls and a cache slot.
  const now = Date.now();
  const maxEntryAge = force ? FORCE_MIN_AGE_MS : TTL_MS;
  const stale = ids.filter((id) => {
    if (!isKnownItem(id) && !inSnapshot[id]) return false;
    const e = store.get(id, now);
    return !e || now - e.fetchedAt > maxEntryAge;
  });

  if (stale.length) {
    if (!inflight) {
      inflight = (async () => {
        try {
          const { prices, source } = await fetchPrices(stale);
          const t = Date.now();
          for (const p of prices) store.set(p.id, { price: p, fetchedAt: t }, t);
          const answered = new Set(prices.map((p) => p.id));
          for (const id of stale) {
            if (!answered.has(id) && store.get(id, t) === undefined) {
              store.set(id, { price: { id, price: 0, stock: 0, totalTrades: 0, updatedAt: t }, fetchedAt: t }, t);
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
  const readAt = Date.now();
  for (const id of ids) {
    const e = store.get(id, readAt);
    if (e) {
      prices[id] = e.price;
      fetchedAt = fetchedAt === null ? e.fetchedAt : Math.min(fetchedAt, e.fetchedAt);
    } else missing.push(id);
  }
  return { prices, fetchedAt, source: lastSource, missing, snapshotAt };
}
