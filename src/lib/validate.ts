/**
 * Input checks shared by the API routes. Everything here is pure so it can be unit tested;
 * a route turns a `null` / `{ ok: false }` into a 400.
 */

/** Largest value a Postgres `integer` column holds (item ids, quantities). */
export const PG_INT_MAX = 2_147_483_647;

/** Highest average cost per unit we accept (silver); far above anything the market lists. */
export const AVG_COST_MAX = 1e12;

/** A whole id 1..PG_INT_MAX from a JSON number or a plain digit string, else null. */
export function parseId(v: unknown): number | null {
  let n: number;
  if (typeof v === "number") n = v;
  else if (typeof v === "string" && /^\d{1,10}$/.test(v)) n = Number(v);
  else return null;
  return Number.isInteger(n) && n >= 1 && n <= PG_INT_MAX ? n : null;
}

/** Item quantity: a finite JSON number, floored, that lands in 0..PG_INT_MAX; anything else is null. */
export function parseQty(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const n = Math.floor(v);
  return n >= 0 && n <= PG_INT_MAX ? n : null;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false };

/**
 * Average cost per unit: undefined (keep the stored one), null (clear it) or a finite
 * number 0..AVG_COST_MAX rounded to whole silver.
 */
export function parseAvgCost(v: unknown): Parsed<number | null | undefined> {
  if (v === undefined) return { ok: true, value: undefined };
  if (v === null) return { ok: true, value: null };
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > AVG_COST_MAX) return { ok: false };
  return { ok: true, value: Math.round(v) };
}

/**
 * Comma-separated ids ("1,2,3"). Empty pieces are skipped and duplicates dropped.
 * Null when there are more than `max` pieces or any piece is not a valid id.
 */
export function parseIdList(param: string, max: number): number[] | null {
  const parts = param.split(",");
  if (parts.length > max) return null;
  const out = new Set<number>();
  for (const raw of parts) {
    const s = raw.trim();
    if (!s) continue;
    const id = parseId(s);
    if (id === null) return null;
    out.add(id);
  }
  return [...out];
}
