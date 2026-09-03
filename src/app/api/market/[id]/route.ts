import { NextResponse } from "next/server";
import { fetchHistory, fetchOrderBook } from "@/lib/market/client";

export const dynamic = "force-dynamic";

const cache = new Map<number, { at: number; data: unknown }>();
const TTL_MS = 5 * 60 * 1000;

/** GET /api/market/:id -> { history: number[] (90 days, oldest first), orders: [{price, sellers, buyers}] } */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await ctx.params;
  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < TTL_MS) return NextResponse.json(hit.data);

  const [history, orders] = await Promise.all([
    fetchHistory(id).catch((e) => {
      console.warn("history failed", id, (e as Error).message);
      return [] as number[];
    }),
    fetchOrderBook(id).catch((e) => {
      console.warn("orderbook failed", id, (e as Error).message);
      return [];
    }),
  ]);
  const data = { id, history, orders, fetchedAt: Date.now() };
  cache.set(id, { at: Date.now(), data });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
