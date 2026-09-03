import { NextResponse } from "next/server";
import { getPrices } from "@/lib/market/cache";
import { allItemIds } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/prices?ids=1,2,3        -> prices for the given ids
 * GET /api/prices?ids=all          -> prices for every item in the recipe database
 * Add &force=1 to bypass the 10 minute cache.
 */
export async function GET(req: Request) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const idsParam = url.searchParams.get("ids") ?? "all";
  const force = url.searchParams.get("force") === "1";
  const ids =
    idsParam === "all"
      ? allItemIds()
      : idsParam
          .split(",")
          .map((s) => Number(s))
          .filter((n) => Number.isFinite(n) && n > 0);
  if (ids.length > 5000) {
    return NextResponse.json({ error: "too many ids" }, { status: 400 });
  }
  const result = await getPrices(ids, { force });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
