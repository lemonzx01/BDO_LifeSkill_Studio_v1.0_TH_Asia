import { mainProduct } from "@/lib/engine/cost";
import type { ItemId, Recipe } from "@/lib/engine/types";

/**
 * The ids of every item some recipe makes as its main product: the items the recipes page lists a
 * row for, so a search there finds them. Extra products (a by-product of another craft) are left
 * out, as the recipes page does not list them under their own name.
 */
export function recipeProductIds(recipes: readonly Pick<Recipe, "products">[]): Set<ItemId> {
  const ids = new Set<ItemId>();
  for (const r of recipes) {
    const p = mainProduct(r as Recipe);
    if (p) ids.add(p.id);
  }
  return ids;
}
