import { CostEngine } from "./cost";
import type { Inventory, Item, ItemId, PriceBook, Recipe, RecipeEvaluation, Settings } from "./types";

export interface IdeaUse {
  id: ItemId;
  /** units of this item consumed in total */
  units: number;
  /** what those units are worth at today's market/NPC price (0 when unknown) */
  value: number;
  valueKnown: boolean;
}

export interface Idea {
  recipe: Recipe;
  productId: ItemId;
  ev: RecipeEvaluation;
  /** crafts possible with what is owned right now, without buying anything */
  crafts: number;
  /** expected product units from those crafts */
  units: number;
  /** silver received after tax (or imperial payout) */
  revenue: number;
  /** what the consumed materials would fetch if sold as-is instead */
  materialsValue: number;
  /** revenue − materialsValue: the extra silver made by crafting instead of selling the inputs */
  profit: number;
  uses: IdeaUse[];
  /** some consumed inputs have no known price, so materialsValue is understated */
  valueIncomplete: boolean;
}

/**
 * "What can I make from what I have?" — every recipe whose direct ingredients
 * are already in the inventory (substitutes included), how many times, and
 * whether crafting beats selling the ingredients outright.
 */
export function ideasFromInventory(input: {
  recipes: Recipe[];
  items: Record<ItemId, Item | undefined>;
  prices: PriceBook;
  inventory: Inventory;
  settings: Settings;
  /** cap crafts so a stack of 10,000 salt does not suggest 10,000 crafts of a product nobody buys */
  maxCrafts?: number;
}): Idea[] {
  const { recipes, items, prices, inventory, settings } = input;
  const maxCrafts = input.maxCrafts ?? 1000;
  const engine = new CostEngine({ items, recipes, prices, settings, inventory: {}, ownedCostMode: "market" });
  const unitPrice = (id: ItemId): number | null => {
    const it = items[id];
    const mp = prices[id];
    if (it?.market && mp && mp.price > 0) return mp.price;
    if (it && !it.market && it.npcBuy && it.npcBuy > 0 && it.npcBuy <= 10_000) return it.npcBuy;
    return null;
  };

  const ideas: Idea[] = [];
  for (const recipe of recipes) {
    if (!recipe.materials.length) continue;
    let crafts = Number.POSITIVE_INFINITY;
    const plan: { id: ItemId; unitsPerCraft: number }[] = [];
    for (const mat of recipe.materials) {
      const members = mat.group?.length ? mat.group : [{ id: mat.id, value: 1 }];
      let best: { id: ItemId; unitsPerCraft: number; possible: number } | null = null;
      for (const m of members) {
        const owned = inventory[m.id]?.qty ?? 0;
        if (owned <= 0) continue;
        const unitsPerCraft = Math.ceil(mat.qty / (m.value || 1));
        const possible = Math.floor(owned / unitsPerCraft);
        if (possible > 0 && (!best || possible > best.possible)) best = { id: m.id, unitsPerCraft, possible };
      }
      if (!best) {
        crafts = 0;
        break;
      }
      crafts = Math.min(crafts, best.possible);
      plan.push({ id: best.id, unitsPerCraft: best.unitsPerCraft });
    }
    if (!Number.isFinite(crafts) || crafts < 1) continue;
    crafts = Math.min(crafts, maxCrafts);

    const ev = engine.evaluate(recipe);
    if (!ev || ev.flags.productNoPrice || ev.flags.productNotMarketable) continue;

    let materialsValue = 0;
    let valueIncomplete = false;
    const uses: IdeaUse[] = plan.map((p) => {
      const units = p.unitsPerCraft * crafts;
      const price = unitPrice(p.id);
      if (price === null) valueIncomplete = true;
      const value = (price ?? 0) * units;
      materialsValue += value;
      return { id: p.id, units, value, valueKnown: price !== null };
    });
    const units = crafts * ev.expectedYield;
    const revenue = units * ev.netPerUnit;
    ideas.push({ recipe, productId: ev.productId, ev, crafts, units, revenue, materialsValue, profit: revenue - materialsValue, uses, valueIncomplete });
  }

  // one entry per product: keep the most profitable recipe
  ideas.sort((a, b) => b.profit - a.profit);
  const seen = new Set<ItemId>();
  return ideas.filter((i) => (seen.has(i.productId) ? false : (seen.add(i.productId), true)));
}
