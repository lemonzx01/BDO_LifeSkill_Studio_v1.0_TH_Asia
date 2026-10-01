import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/session";
import { fetchHistory, fetchOrderBook } from "@/lib/market/client";
import { getDailyHistory } from "@/lib/market/snapshot";
import { TtlCache } from "@/lib/ttl-cache";
import { parseId } from "@/lib/validate";

export const dynamic = "force-dynamic";

const TTL_MS = 5 * 60 * 1000;
/** per server instance; the oldest entry is dropped beyond this, so memory stays bounded */
const MAX_ENTRIES = 500;
const cache = new TtlCache<number, unknown>(MAX_ENTRIES, TTL_MS);

/**
 * GET /api/market/:id -> {
 *   history: number[]            official 90-day daily prices, oldest first (may be empty)
 *   orders:  [{price, sellers, buyers}]
 *   daily:   [{day, price}]      our own snapshot history
 * }
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getApiUser())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id: idStr } = await ctx.params;
  const id = parseId(idStr);
  if (id === null) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const hit = cache.get(id, Date.now());
  if (hit !== undefined) return NextResponse.json(hit);

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
