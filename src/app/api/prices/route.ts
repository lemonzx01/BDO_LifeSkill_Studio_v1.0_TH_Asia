import { NextResponse } from "next/server";
import { getPrices } from "@/lib/market/cache";
import { allItemIds } from "@/lib/data";
import { getApiUser } from "@/lib/auth/session";
import { parseIdList } from "@/lib/validate";

export const dynamic = "force-dynamic";

const MAX_IDS = 5000;

/**
 * GET /api/prices?ids=1,2,3        -> prices for the given ids (whole numbers, at most 5000)
 * GET /api/prices?ids=all          -> prices for every item in the recipe database
 * Add &force=1 to skip the cache (ignored while the prices are under a minute old).
 */
export async function GET(req: Request) {
  if (!(await getApiUser())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const idsParam = url.searchParams.get("ids") ?? "all";
  const force = url.searchParams.get("force") === "1";
  const ids = idsParam === "all" ? allItemIds() : parseIdList(idsParam, MAX_IDS);
  if (ids === null) return NextResponse.json({ error: "bad ids" }, { status: 400 });
  if (ids.length > MAX_IDS) return NextResponse.json({ error: "too many ids" }, { status: 400 });
  const result = await getPrices(ids, { force });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
