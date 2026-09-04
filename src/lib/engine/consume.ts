import type { Inventory, ItemId } from "./types";

export interface ConsumeChange {
  id: ItemId;
  before: number;
  after: number;
}

/**
 * "I crafted this": take the materials the plan said you already had out of the
 * inventory (never below zero, never more than the plan needs) and optionally
 * put the product in. Returns the changes so the caller can apply or undo them.
 */
export function planProduction(
  inventory: Inventory,
  needs: { id: ItemId; need: number }[],
  product?: { id: ItemId; units: number },
): ConsumeChange[] {
  const changes: ConsumeChange[] = [];
  for (const n of needs) {
    const before = inventory[n.id]?.qty ?? 0;
    if (before <= 0 || n.need <= 0) continue;
    const after = Math.max(0, before - Math.ceil(n.need));
    if (after !== before) changes.push({ id: n.id, before, after });
  }
  if (product && product.units > 0) {
    const before = inventory[product.id]?.qty ?? 0;
    changes.push({ id: product.id, before, after: before + Math.round(product.units) });
  }
  return changes;
}
