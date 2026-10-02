import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/session";
import { allItemIds, items } from "@/lib/data";
import { fetchHistory, fetchOrderBook } from "@/lib/market/client";
import { getDailyHistory, getSnapshotPrices } from "@/lib/market/snapshot";
import { limitGuest, takeGuestItemUpstream } from "@/lib/public-rate-limit";
import { TtlCache } from "@/lib/ttl-cache";
import { parseId } from "@/lib/validate";

export const dynamic = "force-dynamic";

const TTL_MS = 5 * 60 * 1000;
/** per server instance; the oldest entry is dropped beyond this, so memory stays bounded */
const MAX_ENTRIES = 500;
const cache = new TtlCache<number, unknown>(MAX_ENTRIES, TTL_MS);

/** Ids in the app's own recipe and item data, built once per server instance. */
let dataIds: Set<number> | null = null;

/**
 * Whether `id` is an item we know: in the recipe/item data, or priced in the market snapshot.
 * Only those are looked up upstream, so nobody can make this server query the official market
 * API for arbitrary ids. Null when the snapshot could not be read.
 */
async function isKnownItem(id: number): Promise<boolean | null> {
  dataIds ??= new Set<number>([...allItemIds(), ...Object.keys(items).map(Number)]);
  if (dataIds.has(id)) return true;
  try {
    const snap = await getSnapshotPrices([id]);
    return Boolean(snap.prices[id]);
  } catch (e) {
    console.error("market item check failed:", (e as Error).message);
    return null;
  }
}

/**
 * GET /api/market/:id -> {
 *   history: number[]            official 90-day daily prices, oldest first (may be empty)
 *   orders:  [{price, sellers, buyers}]
 *   daily:   [{day, price}]      our own snapshot history
 * }
 * Open to everyone (visitors who are not signed in are rate limited per address); 404 for an
 * item that is neither in the recipe data nor in the market snapshot. Lookups that visitors who are
 * not signed in send on to the official API also share one budget for everyone
 * (GUEST_ITEM_UPSTREAM_BUDGET); past it they get our own daily history only (history and orders empty).
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const member = (await getApiUser()) !== null;
  if (!member) {
    const limited = await limitGuest("item", req.headers);
    if (limited) return limited;
  }
  const { id: idStr } = await ctx.params;
  const id = parseId(idStr);
  if (id === null) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const hit = cache.get(id, Date.now());
  if (hit !== undefined) return NextResponse.json(hit, { headers: { "Cache-Control": "no-store" } });

  const known = await isKnownItem(id);
  if (known === null) return NextResponse.json({ error: "try again later" }, { status: 503, headers: { "Retry-After": "30" } });
  if (!known) return NextResponse.json({ error: "unknown item" }, { status: 404 });

  if (!member && !(await takeGuestItemUpstream())) {
    // not cached: the full answer comes back once the budget allows it again
    const daily = await getDailyHistory(id).catch(() => []);
    return NextResponse.json({ id, history: [], orders: [], daily, fetchedAt: Date.now() }, { headers: { "Cache-Control": "no-store" } });
  }

  const [history, orders, daily] = await Promise.all([
    fetchHistory(id).catch((e) => {
      console.warn("history failed", id, (e as Error).message);
      return [] as number[];
    }),
    fetchOrderBook(id).catch((e) => {
      console.warn("orderbook failed", id, (e as Error).message);
      return [];
    }),
    getDailyHistory(id).catch(() => []),
  ]);
  const data = { id, history, orders, daily, fetchedAt: Date.now() };
  cache.set(id, data, Date.now());
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
