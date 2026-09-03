import { expectedUnits, maxQuantityChance, skillGroup } from "./mastery";
import type {
  CostChild,
  CostContext,
  CostNode,
  Item,
  ItemId,
  Recipe,
  RecipeEvaluation,
  RecipeMaterial,
  Settings,
} from "./types";

const MAX_DEPTH = 12;
/**
 * Every item in the game data carries a nominal "buy price" even when no NPC
 * actually sells it. Real vendor materials (salt, sugar, olive oil, cooking
 * wine, leavening agent, ...) are cheap and never listed on the market, so an
 * NPC purchase is only considered for non-market items under this price.
 */
const MAX_NPC_PRICE = 10_000;

/** Fraction of the listed price you actually receive after market tax and bonuses. */
export function netRate(s: Settings): number {
  const bonus =
    (s.valuePack ? 0.3 : 0) + (s.familyFame ?? 0) + (s.merchantRing ? 0.05 : 0) + (s.extraBonus ?? 0);
  return 0.65 * (1 + bonus);
}

export function mainProduct(recipe: Recipe) {
  return recipe.products.find((p) => p.kind === "main") ?? recipe.products[0];
}

/** Average main-product units per craft before any mastery multiplier. */
export function baseYield(recipe: Recipe): number {
  const p = mainProduct(recipe);
  if (!p) return 1;
  return (p.min + p.max) / 2;
}

export function expectedYield(recipe: Recipe, settings: Settings): number {
  const p = mainProduct(recipe);
  if (!p) return 1;
  const group = skillGroup(recipe.type);
  const mastery = settings.mastery?.[group] ?? 0;
  const units = expectedUnits(p.min, p.max, maxQuantityChance(group, mastery));
  const mult = settings.yieldMultiplier?.[group] ?? 1;
  return Math.max(0.0001, units * mult);
}

interface Candidate {
  node: CostNode;
  rank: number; // lower is better: known costs before unknown ones
}

/**
 * Resolves the cheapest way to obtain each item (buy on market, NPC, craft, or
 * use owned stock) recursively through the recipe graph. One instance is bound
 * to one context (prices, settings, inventory) and memoises per item.
 */
export class CostEngine {
  private recipesByProduct = new Map<ItemId, Recipe[]>();
  private memo = new Map<ItemId, CostNode>();

  constructor(public readonly ctx: CostContext) {
    for (const r of ctx.recipes) {
      const p = mainProduct(r);
      if (!p) continue;
      const list = this.recipesByProduct.get(p.id) ?? [];
      list.push(r);
      this.recipesByProduct.set(p.id, list);
    }
  }

  item(id: ItemId): Item | undefined {
    return this.ctx.items[id];
  }

  recipesFor(id: ItemId): Recipe[] {
    return this.recipesByProduct.get(id) ?? [];
  }

  /** Cost node for one unit of `id`. */
  costOf(id: ItemId, stack: Set<ItemId> = new Set(), depth = 0): CostNode {
    const cached = this.memo.get(id);
    if (cached) return cached;
    const { node, cycleHit } = this.compute(id, stack, depth);
    if (!cycleHit) this.memo.set(id, node);
    return node;
  }

  private compute(id: ItemId, stack: Set<ItemId>, depth: number): { node: CostNode; cycleHit: boolean } {
    const { prices, overrides, inventory, ownedCostMode = "market" } = this.ctx;
    const item = this.item(id);
    const override = overrides?.[id];
    const base = (partial: Partial<CostNode>): CostNode => ({
      id,
      unitCost: 0,
      source: "unknown",
      unknown: false,
      hasUnknown: false,
      soldOut: false,
      hasSoldOut: false,
      ...partial,
    });

    if (override?.mode === "price") {
      return { node: base({ unitCost: override.price, source: "override" }), cycleHit: false };
    }

    const inv = inventory?.[id];
    if (inv && inv.qty > 0 && ownedCostMode !== "market") {
      const market = prices[id]?.price ?? 0;
      const unitCost = ownedCostMode === "zero" ? 0 : (inv.avgCost ?? market);
      return { node: base({ unitCost, source: "owned" }), cycleHit: false };
    }

    const candidates: Candidate[] = [];

    // Buy on the central market
    const mp = prices[id];
    if (item?.market && mp && mp.price > 0) {
      const soldOut = mp.stock <= 0;
      candidates.push({
        node: base({ unitCost: mp.price, source: "market", soldOut, hasSoldOut: soldOut }),
        rank: 0,
      });
    } else if (item && !item.market && item.npcBuy && item.npcBuy > 0 && item.npcBuy <= MAX_NPC_PRICE) {
      candidates.push({ node: base({ unitCost: item.npcBuy, source: "npc" }), rank: 0 });
    }

    // Craft it
    let cycleHit = false;
    if (override?.mode !== "buy" && depth < MAX_DEPTH) {
      for (const recipe of this.recipesFor(id)) {
        if (stack.has(id)) {
          cycleHit = true;
          continue;
        }
        const next = new Set(stack);
        next.add(id);
        const res = this.craftCost(recipe, next, depth + 1);
        if (res.cycleHit) cycleHit = true;
        const yieldPerCraft = expectedYield(recipe, this.ctx.settings);
        const node = base({
          unitCost: res.total / yieldPerCraft,
          source: "craft",
          recipeId: recipe.id,
          hasUnknown: res.hasUnknown,
          hasSoldOut: res.hasSoldOut,
          children: res.children,
        });
        candidates.push({ node, rank: res.hasUnknown ? 1 : 0 });
      }
    }

    if (candidates.length === 0) {
      return { node: base({ unknown: true, hasUnknown: true }), cycleHit };
    }

    if (override?.mode === "craft") {
      const craft = candidates.filter((c) => c.node.source === "craft");
      if (craft.length) candidates.splice(0, candidates.length, ...craft);
    }
    if (override?.mode === "buy") {
      const buy = candidates.filter((c) => c.node.source !== "craft");
      if (buy.length) candidates.splice(0, candidates.length, ...buy);
    }

    candidates.sort((a, b) => a.rank - b.rank || a.node.unitCost - b.node.unitCost);
    return { node: candidates[0].node, cycleHit };
  }

  /** Total material cost for one craft of `recipe`, choosing the cheapest substitute per slot. */
  craftCost(
    recipe: Recipe,
    stack: Set<ItemId> = new Set(),
    depth = 0,
  ): { total: number; children: CostChild[]; hasUnknown: boolean; hasSoldOut: boolean; cycleHit: boolean } {
    let total = 0;
    let hasUnknown = false;
    let hasSoldOut = false;
    let cycleHit = false;
    const children: CostChild[] = [];
    for (const mat of recipe.materials) {
      const slot = this.slotCost(mat, stack, depth);
      if (slot.cycleHit) cycleHit = true;
      total += slot.child.lineCost;
      hasUnknown ||= slot.child.node.unknown || slot.child.node.hasUnknown;
      hasSoldOut ||= slot.child.node.soldOut || slot.child.node.hasSoldOut;
      children.push(slot.child);
    }
    return { total, children, hasUnknown, hasSoldOut, cycleHit };
  }

  private slotCost(mat: RecipeMaterial, stack: Set<ItemId>, depth: number): { child: CostChild; cycleHit: boolean } {
    const members = mat.group && mat.group.length ? mat.group : [{ id: mat.id, value: 1 }];
    let best: { node: CostNode; units: number; lineCost: number; rank: number } | null = null;
    let cycleHit = false;
    for (const m of members) {
      if (stack.has(m.id)) {
        cycleHit = true;
        continue;
      }
      const node = this.costOf(m.id, stack, depth);
      // each craft consumes whole items; a high-value substitute cannot be split across crafts
      const units = Math.ceil(mat.qty / (m.value || 1));
      const lineCost = units * node.unitCost;
      const rank = node.unknown || node.hasUnknown ? 1 : 0;
      if (!best || rank < best.rank || (rank === best.rank && lineCost < best.lineCost)) {
        best = { node: m.id === mat.id ? node : { ...node, substituteFor: mat.id }, units, lineCost, rank };
      }
    }
    if (!best) {
      // every member is on the current stack (cycle): treat as unknown
      const node: CostNode = {
        id: mat.id,
        unitCost: 0,
        source: "unknown",
        unknown: true,
        hasUnknown: true,
        soldOut: false,
        hasSoldOut: false,
      };
      return { child: { slotId: mat.id, qty: mat.qty, node, units: mat.qty, lineCost: 0 }, cycleHit: true };
    }
    return {
      child: { slotId: mat.id, qty: mat.qty, node: best.node, units: best.units, lineCost: best.lineCost },
      cycleHit,
    };
  }

  /** Full profit evaluation of one recipe (per craft / per unit / per hour). */
  evaluate(recipe: Recipe): RecipeEvaluation | null {
    const product = mainProduct(recipe);
    if (!product) return null;
    const { settings, prices } = this.ctx;
    const stack = new Set<ItemId>([product.id]);
    const craft = this.craftCost(recipe, stack, 1);
    const yieldPerCraft = expectedYield(recipe, settings);
    const unitCost = craft.total / yieldPerCraft;
    const item = this.item(product.id);
    const mp = prices[product.id];
    const sellPrice = item?.market && mp && mp.price > 0 ? mp.price : 0;
    const rate = netRate(settings);
    const netPerUnit = sellPrice * rate;
    const profitPerUnit = netPerUnit - unitCost;
    const profitPerCraft = profitPerUnit * yieldPerCraft;
    const group = skillGroup(recipe.type);
    const cph = settings.craftsPerHour?.[group] ?? 0;
    const skillTier = settings.skillTier?.[group];
    const tree: CostNode = {
      id: product.id,
      unitCost,
      source: "craft",
      recipeId: recipe.id,
      unknown: false,
      hasUnknown: craft.hasUnknown,
      soldOut: false,
      hasSoldOut: craft.hasSoldOut,
      children: craft.children,
    };
    return {
      recipe,
      productId: product.id,
      expectedYield: yieldPerCraft,
      materialCostPerCraft: craft.total,
      unitCost,
      sellPrice,
      netRate: rate,
      netPerUnit,
      profitPerUnit,
      profitPerCraft,
      profitPerHour: profitPerCraft * cph,
      roi: unitCost > 0 ? profitPerUnit / unitCost : 0,
      tree,
      flags: {
        unknownCost: craft.hasUnknown,
        materialSoldOut: craft.hasSoldOut,
        productNoPrice: sellPrice <= 0,
        productNotMarketable: !item?.market,
        aboveSkill: skillTier !== undefined && recipe.skill.tier > skillTier,
      },
    };
  }

  evaluateAll(recipes: Recipe[] = this.ctx.recipes): RecipeEvaluation[] {
    const out: RecipeEvaluation[] = [];
    for (const r of recipes) {
      const e = this.evaluate(r);
      if (e) out.push(e);
    }
    return out;
  }
}

/** Flattens a cost tree into total raw-material requirements for `crafts` crafts. */
export function flattenRequirements(tree: CostNode, crafts = 1): Map<ItemId, { units: number; cost: number; source: CostNode["source"] }> {
  const acc = new Map<ItemId, { units: number; cost: number; source: CostNode["source"] }>();
  const walk = (node: CostNode, multiplier: number) => {
    if (!node.children || node.children.length === 0 || node.source !== "craft") {
      const cur = acc.get(node.id) ?? { units: 0, cost: 0, source: node.source };
      cur.units += multiplier;
      cur.cost += multiplier * node.unitCost;
      acc.set(node.id, cur);
      return;
    }
    for (const child of node.children) walk(child.node, multiplier * child.units);
  };
  // the root represents one craft, whose children are per-craft quantities
  for (const child of tree.children ?? []) walk(child.node, crafts * child.units);
  return acc;
}
