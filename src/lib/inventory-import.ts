import type { Inventory, ItemId } from "./engine/types";

export type ImportMode = "replace" | "add";

export interface ImportRow {
  id: ItemId;
  qty: number;
  /** cost per unit from the file, when the column was filled in */
  cost?: number;
}

/**
 * Totals per item for one imported file.
 * "replace": the file's number becomes the quantity (a repeated item in the same file adds up).
 * "add": the file's numbers are added to what is already owned, so one CSV per in-game storage can be imported in turn.
 * A cost in the file wins over the stored one; a blank cost keeps it.
 */
export function mergeImportRows(rows: ImportRow[], mode: ImportMode, inventory: Inventory): Map<ItemId, { qty: number; cost?: number }> {
  const totals = new Map<ItemId, { qty: number; cost?: number }>();
  for (const r of rows) {
    const q = Math.max(0, Math.floor(r.qty));
    const cur = totals.get(r.id) ?? { qty: mode === "add" ? (inventory[r.id]?.qty ?? 0) : 0, cost: undefined };
    totals.set(r.id, { qty: cur.qty + q, cost: r.cost !== undefined && r.cost > 0 ? r.cost : cur.cost });
  }
  return totals;
}
