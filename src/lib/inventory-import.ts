import type { Inventory, ItemId } from "./engine/types";

export type ImportMode = "replace" | "add";

/** The two import modes as the page names them. */
export const IMPORT_MODE_LABEL: Record<ImportMode, string> = { replace: "ทับจำนวนเดิม", add: "บวกเพิ่มจากที่มี" };

export interface ImportRow {
  id: ItemId;
  qty: number;
  /** cost per unit from the file, when the column was filled in */
  cost?: number;
}

/** What the file reader needs to know about an item to match a row to it. */
export interface ImportItem {
  id: ItemId;
  th: string;
  en: string;
}

export type ReadImportResult = { ok: true; rows: ImportRow[]; missing: string[] } | { ok: false; error: string };

/**
 * Reads parsed CSV rows (header first). Accepts our export, or any CSV with a name/id column plus a
 * quantity column (e.g. the old Excel sheet). `missing` lists the names that matched no item.
 */
export function readImportRows(rows: string[][], items: readonly ImportItem[]): ReadImportResult {
  if (rows.length < 2) return { ok: false, error: "ไฟล์ว่างหรืออ่านไม่ได้" };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) => header.findIndex((h) => names.some((n) => h === n || h.includes(n)));
  const idCol = col("id", "รหัส");
  const nameCol = col("ชื่อไทย", "ชื่อไอเท็ม", "ชื่อ", "name");
  const enCol = col("ชื่ออังกฤษ", "english");
  const qtyCol = col("จำนวน", "qty", "quantity");
  const costCol = col("ต้นทุน", "cost", "avg");
  if (qtyCol < 0 || (idCol < 0 && nameCol < 0)) return { ok: false, error: "ต้องมีคอลัมน์ จำนวน และ id หรือ ชื่อไอเท็ม" };

  const ids = new Set(items.map((i) => i.id));
  const byTh = new Map(items.map((i) => [i.th.trim().toLowerCase(), i.id]));
  const byEn = new Map(items.map((i) => [i.en.trim().toLowerCase(), i.id]));
  const missing: string[] = [];
  const parsed: ImportRow[] = [];
  for (const r of rows.slice(1)) {
    const qty = Number(String(r[qtyCol] ?? "").replace(/[^\d.]/g, ""));
    if (!Number.isFinite(qty)) continue;
    let id = idCol >= 0 ? Number(r[idCol]) : NaN;
    if (!Number.isInteger(id) || !ids.has(id)) {
      const th = nameCol >= 0 ? String(r[nameCol] ?? "").trim().toLowerCase() : "";
      const en = enCol >= 0 ? String(r[enCol] ?? "").trim().toLowerCase() : "";
      id = byTh.get(th) ?? byEn.get(en) ?? byEn.get(th) ?? NaN;
    }
    if (!Number.isInteger(id)) {
      if (nameCol >= 0 && r[nameCol]) missing.push(String(r[nameCol]));
      continue;
    }
    const cost = costCol >= 0 ? Number(String(r[costCol] ?? "").replace(/[^\d.]/g, "")) : NaN;
    parsed.push({ id, qty, cost: Number.isFinite(cost) && cost > 0 ? cost : undefined });
  }
  return { ok: true, rows: parsed, missing };
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

export interface ImportChange {
  id: ItemId;
  before: number;
  /** 0 = the item leaves the inventory */
  after: number;
  /** set when the file overwrites the recorded cost of an item that stays (before undefined = ตามตลาด) */
  cost?: { before: number | undefined; after: number };
}

export interface ImportDiff {
  /** items not in the inventory yet that come in */
  added: ImportChange[];
  /** owned items whose quantity changes (to 0 = taken out); `cost` is set when the cost changes too */
  changed: ImportChange[];
  /** owned items whose quantity stays but whose cost the file changes */
  costChanged: ImportChange[];
}

/**
 * What applying the merged file would do. Items the file leaves exactly as they are (same quantity,
 * and no cost or the same cost) are in none of the lists.
 */
export function diffImport(totals: ReadonlyMap<ItemId, { qty: number; cost?: number }>, inventory: Inventory): ImportDiff {
  const added: ImportChange[] = [];
  const changed: ImportChange[] = [];
  const costChanged: ImportChange[] = [];
  for (const [id, t] of totals) {
    const before = inventory[id]?.qty ?? 0;
    if (before <= 0) {
      if (t.qty > 0) added.push({ id, before: 0, after: t.qty });
      continue;
    }
    const oldCost = inventory[id]?.avgCost;
    const change: ImportChange = { id, before, after: t.qty };
    // a cost only matters for an item that stays
    if (t.qty > 0 && t.cost !== undefined && t.cost !== oldCost) change.cost = { before: oldCost, after: t.cost };
    if (t.qty !== before) changed.push(change);
    else if (change.cost) costChanged.push(change);
  }
  return { added, changed, costChanged };
}

/** How many items the import changes: the number its confirm, button and message use. */
export function importChangeCount(diff: ImportDiff): number {
  return diff.added.length + diff.changed.length + diff.costChanged.length;
}

/**
 * "เพิ่มใหม่ 3 · เปลี่ยนจำนวน 2 · เปลี่ยนต้นทุน 1 · ไม่พบชื่อ 1 (โหมด ทับจำนวนเดิม)"; the cost and
 * not-found parts only when there are some. `costChanged` counts every item whose cost changes,
 * with or without a new quantity.
 */
export function importSummary(added: number, changed: number, missing: number, mode: ImportMode, costChanged = 0): string {
  const parts = [`เพิ่มใหม่ ${added}`, `เปลี่ยนจำนวน ${changed}`];
  if (costChanged > 0) parts.push(`เปลี่ยนต้นทุน ${costChanged}`);
  if (missing > 0) parts.push(`ไม่พบชื่อ ${missing}`);
  return `${parts.join(" · ")} (โหมด ${IMPORT_MODE_LABEL[mode]})`;
}
