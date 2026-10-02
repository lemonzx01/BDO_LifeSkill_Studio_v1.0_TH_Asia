import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/session";
import { recipes } from "@/lib/data";
import { searchMarketItems } from "@/lib/market/snapshot";
import { limitGuest } from "@/lib/public-rate-limit";
import { recipeProductIds } from "@/lib/recipe-products";

export const dynamic = "force-dynamic";

/** Longest search text we look up; item names are far shorter. */
const MAX_QUERY = 64;

/** Items some recipe makes: built once per server instance, on the first search. */
let productIds: Set<number> | null = null;
function hasRecipe(id: number): boolean {
  productIds ??= recipeProductIds(recipes);
  return productIds.has(id);
}

/**
 * GET /api/market/search?q=... -> up to 12 market items matching the name. `hasRecipe` says whether
 * the recipes page lists the item, so quick search opens the recipes or the market for it.
 * Open to everyone (visitors who are not signed in are rate limited per address).
 */
export async function GET(req: Request) {
  if (!(await getApiUser())) {
    const limited = await limitGuest("search", req.headers);
    if (limited) return limited;
  }
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY);
  try {
    const items = await searchMarketItems(q);
    return NextResponse.json({ items: items.map((it) => ({ ...it, hasRecipe: hasRecipe(it.id) })) });
  } catch (e) {
    console.error("market search failed:", e);
    return NextResponse.json({ items: [], error: "search failed" });
  }
}
