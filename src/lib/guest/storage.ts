import type { Inventory, InventoryEntry, ItemId, Settings } from "@/lib/engine/types";
import { normalizeSettings } from "@/lib/settings";
import { AVG_COST_MAX, parseId, PG_INT_MAX } from "@/lib/validate";

/**
 * What a visitor who is not signed in keeps in this browser (localStorage): character settings,
 * inventory and starred items. Nothing of it is sent to the server. Every value is checked when it
 * is read, because anything in localStorage may have been edited by hand or left by another
 * version: bad entries are dropped, never trusted.
 *
 * The keys carry a version, so a later format can live beside this one instead of misreading it.
 */
export const GUEST_PREFIX = "bls:guest:v1:";
export const GUEST_KEYS = {
  settings: `${GUEST_PREFIX}settings`,
  inventory: `${GUEST_PREFIX}inventory`,
  favorites: `${GUEST_PREFIX}favorites`,
} as const;
/** The line shown wherever a guest's data is edited (inventory, settings). */
export const GUEST_STORAGE_NOTE = "เก็บไว้ในเครื่องนี้ (ไม่ได้ล็อกอิน)";

/** sessionStorage: a signed-in member closed the offer to copy this browser's data into the account (this tab only) */
export const GUEST_IMPORT_DISMISSED_KEY = `${GUEST_PREFIX}import-dismissed`;

/** A stored value longer than this is ignored as a whole (real data is far smaller). */
export const GUEST_MAX_CHARS = 1_000_000;
/** Most inventory rows kept; far more than one character owns. */
export const GUEST_MAX_ITEMS = 5000;
/** Most starred items kept. */
export const GUEST_MAX_FAVORITES = 200;
/** A starred item's remembered name is cut to this length. */
export const GUEST_NAME_MAX = 100;
const GRADE_MAX = 5;
/** Latest timestamp a Date can hold (ms). */
const TIME_MAX = 8.64e15;

/**
 * A starred item, with the name and grade it was starred under (for the home page card: items
 * outside the recipe data have no name there). Only the id is copied into an account.
 */
export interface GuestFavorite {
  id: ItemId;
  th?: string;
  grade?: number;
}

export interface GuestData {
  /** null: never saved in this browser */
  settings: Settings | null;
  inventory: Inventory;
  favorites: GuestFavorite[];
}

/** Nothing stored (also what the server renders, since it cannot see localStorage). Never mutated. */
export const EMPTY_GUEST_DATA: GuestData = { settings: null, inventory: {}, favorites: [] };

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function parseJson(raw: string | null): unknown {
  if (raw === null || raw.length > GUEST_MAX_CHARS) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Stored settings filled in with defaults, or null when there are none (or they are not an object). */
export function parseGuestSettings(raw: string | null): Settings | null {
  const v = parseJson(raw);
  return isPlainObject(v) ? normalizeSettings(v) : null;
}

/** One inventory row, or null when it is not a usable one (quantity 0 included: that is "not owned"). */
export function parseGuestEntry(v: unknown): InventoryEntry | null {
  if (!isPlainObject(v)) return null;
  if (typeof v.qty !== "number" || !Number.isFinite(v.qty)) return null;
  const qty = Math.floor(v.qty);
  if (qty < 1 || qty > PG_INT_MAX) return null;
  const entry: InventoryEntry = { qty };
  // a cost that is not a sane number is dropped (the row then follows the market price)
  if (typeof v.avgCost === "number" && Number.isFinite(v.avgCost) && v.avgCost >= 0 && v.avgCost <= AVG_COST_MAX) entry.avgCost = Math.round(v.avgCost);
  if (typeof v.updatedAt === "number" && Number.isFinite(v.updatedAt) && v.updatedAt >= 0 && v.updatedAt <= TIME_MAX) entry.updatedAt = v.updatedAt;
  return entry;
}

/** Stored inventory: `{ "<id>": { qty, avgCost?, updatedAt? } }`, at most GUEST_MAX_ITEMS rows. */
export function parseGuestInventory(raw: string | null): Inventory {
  const v = parseJson(raw);
  const out: Inventory = {};
  if (!isPlainObject(v)) return out;
  let n = 0;
  for (const [key, value] of Object.entries(v)) {
    if (n >= GUEST_MAX_ITEMS) break;
    // keys are plain digit strings; "__proto__", "1e3", " 7" and the like are not ids
    const id = /^[1-9]\d{0,9}$/.test(key) ? parseId(key) : null;
    if (id === null) continue;
    const entry = parseGuestEntry(value);
    if (!entry) continue;
    out[id] = entry;
    n += 1;
  }
  return out;
}

/** One starred item: an id, or `{ id, th?, grade? }`. */
function parseGuestFavorite(v: unknown): GuestFavorite | null {
  if (typeof v === "number") {
    const id = parseId(v);
    return id === null ? null : { id };
  }
  if (!isPlainObject(v) || typeof v.id !== "number") return null;
  const id = parseId(v.id);
  if (id === null) return null;
  const fav: GuestFavorite = { id };
  if (typeof v.th === "string") {
    const th = v.th.trim().slice(0, GUEST_NAME_MAX);
    if (th) fav.th = th;
  }
  if (typeof v.grade === "number" && Number.isInteger(v.grade) && v.grade >= 0 && v.grade <= GRADE_MAX) fav.grade = v.grade;
  return fav;
}

/** Stored starred items, oldest first, each id once, at most GUEST_MAX_FAVORITES. */
export function parseGuestFavorites(raw: string | null): GuestFavorite[] {
  const v = parseJson(raw);
  if (!Array.isArray(v)) return [];
  const out: GuestFavorite[] = [];
  const seen = new Set<ItemId>();
  for (const x of v) {
    if (out.length >= GUEST_MAX_FAVORITES) break;
    const fav = parseGuestFavorite(x);
    if (!fav || seen.has(fav.id)) continue;
    seen.add(fav.id);
    out.push(fav);
  }
  return out;
}

/** A starred item's remembered name and grade, checked the same way as when they are read back. */
export function guestFavorite(id: ItemId, meta?: { th?: string | null; grade?: number | null }): GuestFavorite {
  return parseGuestFavorite({ id, th: meta?.th ?? undefined, grade: meta?.grade ?? undefined }) ?? { id };
}

function read(storage: Pick<Storage, "getItem"> | null, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    // storage switched off or blocked: as if nothing were stored
    return null;
  }
}

/** Everything this browser holds for a visitor who is not signed in. */
export function readGuestData(storage: Pick<Storage, "getItem"> | null): GuestData {
  return {
    settings: parseGuestSettings(read(storage, GUEST_KEYS.settings)),
    inventory: parseGuestInventory(read(storage, GUEST_KEYS.inventory)),
    favorites: parseGuestFavorites(read(storage, GUEST_KEYS.favorites)),
  };
}

/** How much there is to copy into an account. */
export interface GuestSummary {
  items: number;
  favorites: number;
  settings: boolean;
}

export function summarizeGuestData(d: GuestData): GuestSummary {
  return {
    items: Object.values(d.inventory).filter((e) => e && e.qty > 0).length,
    favorites: d.favorites.length,
    settings: d.settings !== null,
  };
}

export function hasGuestData(d: GuestData): boolean {
  const s = summarizeGuestData(d);
  return s.items > 0 || s.favorites > 0 || s.settings;
}
