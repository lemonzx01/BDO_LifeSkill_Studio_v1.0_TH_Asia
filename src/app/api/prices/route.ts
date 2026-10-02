import { after, NextResponse } from "next/server";
import { getPrices } from "@/lib/market/cache";
import { AUTO_REFRESH_MS, autoRefreshMarket } from "@/lib/market/snapshot";
import { allItemIds } from "@/lib/data";
import { getApiUser } from "@/lib/auth/session";
import { limitGuest } from "@/lib/public-rate-limit";
import { parseIdList } from "@/lib/validate";

export const dynamic = "force-dynamic";
// room for the background snapshot refresh started below (after the answer is sent)
export const maxDuration = 60;

const MAX_IDS = 5000;

/**
 * The same prices for everyone, so the CDN may keep an answer for a minute (and hand out a stale
 * one for five more while it fetches the next). A forced refresh is never kept.
 */
const SHARED_CACHE = "public, max-age=0, s-maxage=60, stale-while-revalidate=300";

/**
 * GET /api/prices?ids=1,2,3        -> prices for the given ids (whole numbers, at most 5000)
 * GET /api/prices?ids=all          -> prices for every item in the recipe database
 * Add &force=1 to skip the cache (ignored while the prices are under a minute old). Open to
 * everyone. A visitor who is not signed in cannot force, is answered from the database snapshot
 * whatever its age (never from the market APIs directly, unless there is no snapshot at all) and is
 * rate limited per address. A snapshot older than AUTO_REFRESH_MS (or none at all) is refreshed in
 * the background, at most once per AUTO_REFRESH_MS across all servers.
 */
export async function GET(req: Request) {
  const user = await getApiUser();
  if (!user) {
    const limited = await limitGuest("prices", req.headers);
    if (limited) return limited;
  }
  const url = new URL(req.url);
  const idsParam = url.searchParams.get("ids") ?? "all";
  const force = user !== null && url.searchParams.get("force") === "1";
  const ids = idsParam === "all" ? allItemIds() : parseIdList(idsParam, MAX_IDS);
  if (ids === null) return NextResponse.json({ error: "bad ids" }, { status: 400 });
  if (ids.length > MAX_IDS) return NextResponse.json({ error: "too many ids" }, { status: 400 });
  const { snapshotAt, ...result } = await getPrices(ids, { force, upstream: user !== null });
  // no snapshot yet (a new database) or an old one: build a new one once this answer is sent
  if (snapshotAt === null || Date.now() - snapshotAt > AUTO_REFRESH_MS) {
    after(() => autoRefreshMarket().catch((e) => console.error("background market refresh failed:", e)));
  }
  return NextResponse.json(result, { headers: { "Cache-Control": force ? "no-store" : SHARED_CACHE } });
}
