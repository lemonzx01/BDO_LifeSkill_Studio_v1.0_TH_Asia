import type { RecipeEvaluation } from "./engine/types";

/**
 * The sort orders of the recipes page. The choice is saved per browser under RECIPE_SORT_KEY and
 * the home page reads and writes the same key, so both pages rank the same way.
 */
export const RECIPE_SORTS = ["profitPerHour", "profitPerUnit", "profitPerCraft", "roi", "unitCost"] as const;
export type RecipeSort = (typeof RECIPE_SORTS)[number];
export const RECIPE_SORT_KEY = "recipes.sort";
export const isRecipeSort = (v: unknown): v is RecipeSort => typeof v === "string" && (RECIPE_SORTS as readonly string[]).includes(v);

/** The home page's first card, also named on the help page. */
export const HOME_PICKS_TITLE = "ทำอะไรดีตอนนี้";

/** Home offers two of them: profit per hour, or profit per unit for every other saved choice. */
export type HomeRank = "profitPerUnit" | "profitPerHour";
export function homeRank(sort: RecipeSort): HomeRank {
  return sort === "profitPerHour" ? "profitPerHour" : "profitPerUnit";
}

/** Fully priced, sellable, within the member's skill tier, and actually profitable. */
export function isFeasible(ev: RecipeEvaluation): boolean {
  return !ev.flags.unknownCost && !ev.flags.productNoPrice && !ev.flags.productNotMarketable && !ev.flags.aboveSkill && ev.profitPerUnit > 0;
}

/** The number a recipe is ranked by. Imperial boxes have no per-hour value, so per hour they go last. */
function rankValue(ev: RecipeEvaluation, rank: HomeRank): number {
  if (rank === "profitPerHour" && ev.saleChannel === "imperial") return Number.NEGATIVE_INFINITY;
  const v = ev[rank];
  return Number.isFinite(v) ? v : Number.NEGATIVE_INFINITY;
}

/** Best first by `rank` (ties: profit per unit), one recipe per product, at most `n`. */
export function topPicks(list: readonly RecipeEvaluation[], rank: HomeRank, n: number): RecipeEvaluation[] {
  const sorted = [...list].sort((a, b) => {
    const ka = rankValue(a, rank);
    const kb = rankValue(b, rank);
    if (ka !== kb) return kb > ka ? 1 : -1;
    return b.profitPerUnit - a.profitPerUnit;
  });
  const seen = new Set<number>();
  const out: RecipeEvaluation[] = [];
  for (const ev of sorted) {
    if (out.length >= n) break;
    if (seen.has(ev.productId)) continue;
    seen.add(ev.productId);
    out.push(ev);
  }
  return out;
}

/**
 * The picks for HOME_PICKS_TITLE: market recipes only. An imperial box's profit is per box, many
 * times one potion's, so by profit per unit boxes would fill the card; they have their own card.
 */
export function heroPicks(list: readonly RecipeEvaluation[], rank: HomeRank, n: number): RecipeEvaluation[] {
  return topPicks(
    list.filter((ev) => ev.saleChannel === "market"),
    rank,
    n,
  );
}
