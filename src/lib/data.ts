import recipesJson from "@/data/recipes.json";
import itemsJson from "@/data/items.json";
import metaJson from "@/data/meta.json";
import type { Item, ItemId, Recipe } from "@/lib/engine/types";

export const recipes = recipesJson as unknown as Recipe[];
export const items = itemsJson as unknown as Record<ItemId, Item>;
export const meta = metaJson as { importedAt: string; recipeCount: number; itemCount: number };

let _allIds: ItemId[] | null = null;

/** Every item id referenced by the recipe database (materials, substitutes, products). */
export function allItemIds(): ItemId[] {
  if (_allIds) return _allIds;
  const set = new Set<ItemId>();
  for (const r of recipes) {
    for (const m of r.materials) {
      set.add(m.id);
      for (const g of m.group ?? []) set.add(g.id);
    }
    for (const p of r.products) set.add(p.id);
  }
  _allIds = [...set];
  return _allIds;
}

export function itemName(id: ItemId, lang: "th" | "en" = "th"): string {
  const it = items[id];
  if (!it) return `#${id}`;
  return lang === "th" ? it.th : it.en;
}
