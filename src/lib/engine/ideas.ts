import { CostEngine, expectedYield } from "./cost";
import type { Inventory, Item, ItemId, PriceBook, Recipe, RecipeEvaluation, Settings } from "./types";

export interface IdeaUse {
  id: ItemId;
  /** units of this owned item consumed in total (raw materials taken from the inventory) */
  units: number;
  /** what those units are worth at today's market/NPC price (0 when unknown) */
  value: number;
  valueKnown: boolean;
}

export interface IdeaStep {
  id: ItemId;
  /** intermediate units that must be crafted first */
  units: number;
  crafts: number;
}

export interface Idea {
  recipe: Recipe;
  productId: ItemId;
  ev: RecipeEvaluation;
  /** crafts of the final recipe possible with what is owned right now, without buying anything */
  crafts: number;
  /** expected product units from those crafts */
  units: number;
  /** silver received after tax (or imperial payout) */
  revenue: number;
  /** what the consumed raw materials would fetch if sold as-is instead */
  materialsValue: number;
  /** revenue − materialsValue: the extra silver made by crafting instead of selling the inputs */
  profit: number;
  uses: IdeaUse[];
  /** intermediates that have to be crafted along the way (deepest first) */
  steps: IdeaStep[];
  /** some consumed inputs have no known price, so materialsValue is understated */
  valueIncomplete: boolean;
}

type Stock = Map<ItemId, number>;

const MAX_DEPTH = 3;

/**
 * "What can I make from what I have?" — for every recipe, how many crafts the
 * inventory supports when missing ingredients may themselves be crafted from
 * owned stock (up to three levels deep, substitutes included), and whether
 * crafting beats selling the ingredients outright.
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

  const initial: Stock = new Map();
  for (const [id, v] of Object.entries(inventory)) if (v && v.qty > 0) initial.set(Number(id), v.qty);
  if (initial.size === 0) return [];

  const unitPrice = (id: ItemId): number | null => {
    const it = items[id];
    const mp = prices[id];
    if (it?.market && mp && mp.price > 0) return mp.price;
    if (it && !it.market && it.npcBuy && it.npcBuy > 0 && it.npcBuy <= 10_000) return it.npcBuy;
    return null;
  };

  // recipes that can make an item, cheapest first (engine cost is only used for ordering); cached per item
  const recipesForCache = new Map<ItemId, Recipe[]>();
  const recipesFor = (id: ItemId): Recipe[] => {
    let list = recipesForCache.get(id);
    if (!list) {
      list = [...engine.recipesFor(id)].sort((a, b) => (engine.evaluate(a)?.unitCost ?? Infinity) - (engine.evaluate(b)?.unitCost ?? Infinity));
      recipesForCache.set(id, list);
    }
    return list;
  };

  /** Take `units` of `id` from the stock, crafting more from stock when short. Mutates `stock`/`made`; false = impossible. */
  const take = (id: ItemId, units: number, stock: Stock, made: Map<ItemId, number>, depth: number, path: Set<ItemId>): boolean => {
    const have = stock.get(id) ?? 0;
    const used = Math.min(have, units);
    if (used > 0) stock.set(id, have - used);
    const short = units - used;
    if (short <= 1e-9) return true;
    if (depth >= MAX_DEPTH || path.has(id)) {
      stock.set(id, have); // roll back the partial take
      return false;
    }
    for (const recipe of recipesFor(id)) {
      const y = expectedYield(recipe, settings);
      const crafts = Math.ceil(short / y - 1e-9);
      const trial = new Map(stock);
      const trialMade = new Map(made);
      const nextPath = new Set(path).add(id);
      let ok = true;
      for (const mat of recipe.materials) {
        if (!takeSlot(mat, crafts, trial, trialMade, depth + 1, nextPath)) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      const produced = crafts * y;
      trial.set(id, (trial.get(id) ?? 0) + produced - short);
      trialMade.set(id, (trialMade.get(id) ?? 0) + produced);
      // commit
      stock.clear();
      for (const [k, v] of trial) stock.set(k, v);
      made.clear();
      for (const [k, v] of trialMade) made.set(k, v);
      return true;
    }
    stock.set(id, have);
    return false;
  };

  /** One recipe slot × crafts: prefer a substitute that is already in stock, else anything craftable. */
  const takeSlot = (mat: Recipe["materials"][number], crafts: number, stock: Stock, made: Map<ItemId, number>, depth: number, path: Set<ItemId>): boolean => {
    const members = mat.group?.length ? mat.group : [{ id: mat.id, value: 1 }];
    const ordered = [...members].sort((a, b) => (stock.get(b.id) ?? 0) / (b.value || 1) - (stock.get(a.id) ?? 0) / (a.value || 1));
    for (const m of ordered) {
      const units = Math.ceil(mat.qty / (m.value || 1)) * crafts;
      const trial = new Map(stock);
      const trialMade = new Map(made);
      if (take(m.id, units, trial, trialMade, depth, path)) {
        stock.clear();
        for (const [k, v] of trial) stock.set(k, v);
        made.clear();
        for (const [k, v] of trialMade) made.set(k, v);
        return true;
      }
    }
    return false;
  };

  const simulate = (recipe: Recipe, crafts: number): { stock: Stock; made: Map<ItemId, number> } | null => {
    const stock = new Map(initial);
    const made = new Map<ItemId, number>();
    const product = recipe.products.find((p) => p.kind === "main") ?? recipe.products[0];
    const path = new Set<ItemId>(product ? [product.id] : []);
    for (const mat of recipe.materials) if (!takeSlot(mat, crafts, stock, made, 1, path)) return null;
    return { stock, made };
  };

  const ideas: Idea[] = [];
  for (const recipe of recipes) {
    if (!recipe.materials.length) continue;
    if (!simulate(recipe, 1)) continue;
    // largest feasible craft count by binary search (feasibility is monotonic)
    let lo = 1;
    let hi = maxCrafts;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (simulate(recipe, mid)) lo = mid;
      else hi = mid - 1;
    }
    const crafts = lo;
    const sim = simulate(recipe, crafts)!;

    const ev = engine.evaluate(recipe);
    if (!ev || ev.flags.productNoPrice || ev.flags.productNotMarketable) continue;

    let materialsValue = 0;
    let valueIncomplete = false;
    const uses: IdeaUse[] = [];
    for (const [id, before] of initial) {
      const consumed = before - (sim.stock.get(id) ?? 0);
      if (consumed <= 1e-9) continue;
      const price = unitPrice(id);
      if (price === null) valueIncomplete = true;
      const value = (price ?? 0) * consumed;
      materialsValue += value;
      uses.push({ id, units: Math.round(consumed * 100) / 100, value, valueKnown: price !== null });
    }
    const steps: IdeaStep[] = [...sim.made.entries()].map(([id, units]) => {
      const r = recipesFor(id)[0];
      return { id, units: Math.round(units * 100) / 100, crafts: r ? Math.ceil(units / expectedYield(r, settings) - 1e-9) : 0 };
    });
    const units = crafts * ev.expectedYield;
    const revenue = units * ev.netPerUnit;
    ideas.push({ recipe, productId: ev.productId, ev, crafts, units, revenue, materialsValue, profit: revenue - materialsValue, uses, steps, valueIncomplete });
  }

  // one entry per product: keep the most profitable recipe
  ideas.sort((a, b) => b.profit - a.profit);
  const seen = new Set<ItemId>();
  return ideas.filter((i) => (seen.has(i.productId) ? false : (seen.add(i.productId), true)));
}
