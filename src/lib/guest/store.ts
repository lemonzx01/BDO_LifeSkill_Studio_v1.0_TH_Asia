import type { Inventory, ItemId, Settings } from "@/lib/engine/types";
import { normalizeSettings } from "@/lib/settings";
import {
  EMPTY_GUEST_DATA,
  GUEST_IMPORT_DISMISSED_KEY,
  GUEST_KEYS,
  GUEST_MAX_FAVORITES,
  GUEST_MAX_ITEMS,
  GUEST_PREFIX,
  guestFavorite,
  parseGuestEntry,
  parseGuestFavorites,
  parseGuestInventory,
  parseGuestSettings,
  readGuestData,
  type GuestData,
  type GuestFavorite,
  type StorageLike,
} from "./storage";

/** The guest data, plus whether the offer to copy it into an account was closed in this tab. */
export interface GuestSnapshot extends GuestData {
  importDismissed: boolean;
}

export const EMPTY_GUEST_SNAPSHOT: GuestSnapshot = { ...EMPTY_GUEST_DATA, importDismissed: false };

export interface GuestStoreEnv {
  /** localStorage, or null when it cannot be used */
  local: () => StorageLike | null;
  /** sessionStorage, or null when it cannot be used */
  session: () => StorageLike | null;
  /** calls `fn` with the key another tab changed (null: storage cleared); returns the unsubscribe */
  listen: (fn: (key: string | null) => void) => () => void;
  /** runs `fn` once the current synchronous work is done (default: queueMicrotask) */
  defer?: (fn: () => void) => void;
}

/** One part of the guest data, each kept under its own storage key. */
type Part = keyof typeof GUEST_KEYS;

/** A part as stored, or null when there is nothing to keep (the key is removed). */
function serialize(part: Part, d: GuestData): string | null {
  switch (part) {
    case "settings":
      return d.settings ? JSON.stringify(d.settings) : null;
    case "inventory":
      return Object.keys(d.inventory).length ? JSON.stringify(d.inventory) : null;
    case "favorites":
      return d.favorites.length ? JSON.stringify(d.favorites) : null;
  }
}

/** A part read back from storage (checked like every other read). */
function parsePart(part: Part, raw: string | null): Partial<GuestData> {
  switch (part) {
    case "settings":
      return { settings: parseGuestSettings(raw) };
    case "inventory":
      return { inventory: parseGuestInventory(raw) };
    case "favorites":
      return { favorites: parseGuestFavorites(raw) };
  }
}

/**
 * The guest data as an external store for useSyncExternalStore: read from localStorage on first
 * use, changed only through the methods below, and re-read when another tab changes it.
 *
 * - A change shows at once; storage is written once the current work is done, one write per part
 *   however many changes were made (a CSV import or an undo is hundreds of setOwned calls).
 * - Before a change, the part is read again from storage, so a change never writes back an old copy
 *   over what another tab saved meanwhile. While nobody is subscribed (a page without the provider)
 *   the store does not hear other tabs, so it forgets its copy and reads storage again next time.
 * - Writing can fail (storage full or switched off): the change then still applies in this tab, it
 *   is just not kept, and this tab's copy of that part is not replaced by what storage holds.
 */
export class GuestStore {
  private snap: GuestSnapshot | null = null;
  private listeners = new Set<() => void>();
  private stopListening: (() => void) | null = null;
  /** parts changed in this tab and not written to storage yet */
  private dirty = new Set<Part>();
  /** parts whose last write failed: this tab holds the only copy */
  private unsaved = new Set<Part>();
  private readonly defer: (fn: () => void) => void;

  constructor(private readonly env: GuestStoreEnv) {
    this.defer = env.defer ?? ((fn) => queueMicrotask(fn));
  }

  // arrow properties: useSyncExternalStore needs stable functions
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    if (!this.stopListening) {
      this.stopListening = this.env.listen((key) => {
        if (key !== null && !key.startsWith(GUEST_PREFIX)) return;
        this.forget();
        this.emit();
      });
    }
    return () => {
      this.listeners.delete(fn);
      if (this.listeners.size === 0 && this.stopListening) {
        this.stopListening();
        this.stopListening = null;
        // other tabs can change the data while nobody here listens: read it again on the next use
        this.forget();
      }
    };
  };

  getSnapshot = (): GuestSnapshot => {
    if (!this.snap) {
      let dismissed = false;
      try {
        dismissed = this.env.session()?.getItem(GUEST_IMPORT_DISMISSED_KEY) === "1";
      } catch {
        /* sessionStorage blocked */
      }
      this.snap = { ...readGuestData(this.env.local()), importDismissed: dismissed };
    }
    return this.snap;
  };

  /** The server cannot see the browser's storage: it renders as if nothing were stored. */
  getServerSnapshot = (): GuestSnapshot => EMPTY_GUEST_SNAPSHOT;

  setSettings(settings: Settings): void {
    this.commit("settings", { settings: normalizeSettings(settings) });
  }

  /** avgCost: number = record that cost, null = follow the market price, undefined = keep as is. */
  setOwned(id: ItemId, qty: number, avgCost: number | null | undefined, updatedAt: number): void {
    const cur = this.current("inventory").inventory;
    const next: Inventory = { ...cur };
    const entry = parseGuestEntry({ qty, avgCost: avgCost === null ? undefined : (avgCost ?? cur[id]?.avgCost), updatedAt });
    if (entry) {
      // a new row past the cap is not kept (the cap is far above what anyone owns)
      if (!cur[id] && Object.keys(cur).length >= GUEST_MAX_ITEMS) return;
      next[id] = entry;
    } else {
      if (!cur[id]) return;
      delete next[id];
    }
    this.commit("inventory", { inventory: next });
  }

  clearInventory(): void {
    this.commit("inventory", { inventory: {} });
  }

  /** Stars (with the name and grade it was starred under) or unstars an item. */
  toggleFavorite(id: ItemId, meta?: { th?: string | null; grade?: number | null }): void {
    const cur = this.current("favorites").favorites;
    let next: GuestFavorite[];
    if (cur.some((f) => f.id === id)) next = cur.filter((f) => f.id !== id);
    else if (cur.length >= GUEST_MAX_FAVORITES) return;
    else next = [...cur, guestFavorite(id, meta)];
    this.commit("favorites", { favorites: next });
  }

  /** Forgets everything stored for the guest (after it reached an account). */
  clearAll(): void {
    const local = this.env.local();
    for (const key of Object.values(GUEST_KEYS)) {
      try {
        local?.removeItem(key);
      } catch {
        /* storage blocked */
      }
    }
    this.dirty.clear();
    this.unsaved.clear();
    this.snap = { ...EMPTY_GUEST_DATA, importDismissed: this.getSnapshot().importDismissed };
    this.emit();
  }

  /** The member closed the offer to copy this browser's data into the account: not again in this tab. */
  dismissImport(): void {
    try {
      this.env.session()?.setItem(GUEST_IMPORT_DISMISSED_KEY, "1");
    } catch {
      /* kept in memory only */
    }
    this.snap = { ...this.getSnapshot(), importDismissed: true };
    this.emit();
  }

  /** Writes the parts changed since the last write (normally run by itself, see `defer`). */
  persist = (): void => {
    if (this.dirty.size === 0 || !this.snap) return;
    const snap = this.snap;
    const parts = [...this.dirty];
    this.dirty.clear();
    const local = this.env.local();
    for (const part of parts) {
      try {
        if (!local) throw new Error("no storage");
        const value = serialize(part, snap);
        if (value === null) local.removeItem(GUEST_KEYS[part]);
        else local.setItem(GUEST_KEYS[part], value);
        this.unsaved.delete(part);
      } catch {
        // storage full or blocked: the change stays in this tab only
        this.unsaved.add(part);
      }
    }
  };

  /** The snapshot with `part` read again from storage first, unless this tab holds a newer copy of it. */
  private current(part: Part): GuestSnapshot {
    const snap = this.getSnapshot();
    if (this.dirty.has(part) || this.unsaved.has(part)) return snap;
    let raw: string | null;
    try {
      const local = this.env.local();
      if (!local) return snap;
      raw = local.getItem(GUEST_KEYS[part]);
    } catch {
      return snap;
    }
    this.snap = { ...snap, ...parsePart(part, raw) };
    return this.snap;
  }

  /** Drops this tab's copy so the next read comes from storage; parts only this tab holds are kept. */
  private forget(): void {
    this.persist();
    if (!this.snap) return;
    if (this.unsaved.size === 0) {
      this.snap = null;
      return;
    }
    for (const part of Object.keys(GUEST_KEYS) as Part[]) this.current(part);
  }

  private commit(part: Part, patch: Partial<GuestData>): void {
    this.snap = { ...this.getSnapshot(), ...patch };
    if (this.dirty.size === 0) this.defer(this.persist);
    this.dirty.add(part);
    this.emit();
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }
}

function browserStorage(kind: "localStorage" | "sessionStorage"): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window[kind];
  } catch {
    return null;
  }
}

/** This tab's guest store. */
export const guestStore = new GuestStore({
  local: () => browserStorage("localStorage"),
  session: () => browserStorage("sessionStorage"),
  listen: (fn) => {
    if (typeof window === "undefined") return () => {};
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea === null || e.storageArea === browserStorage("localStorage")) fn(e.key);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  },
});
