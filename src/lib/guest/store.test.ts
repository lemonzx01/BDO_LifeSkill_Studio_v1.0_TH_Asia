import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/engine/types";
import { GUEST_IMPORT_DISMISSED_KEY, GUEST_KEYS, GUEST_MAX_FAVORITES, type StorageLike } from "./storage";
import { EMPTY_GUEST_SNAPSHOT, GuestStore } from "./store";

/** A Map-backed Storage; `broken` makes every write throw (full or blocked storage). */
function memoryStorage() {
  const map = new Map<string, string>();
  const s = {
    map,
    broken: false,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (s.broken) throw new Error("QuotaExceededError");
      map.set(k, v);
    },
    removeItem: (k: string) => {
      if (s.broken) throw new Error("SecurityError");
      map.delete(k);
    },
  };
  return s;
}

/** Lets the store's deferred write run (it waits for the current synchronous work to finish). */
const written = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function setup(local: (StorageLike & { map: Map<string, string> }) | null = memoryStorage()) {
  const session = memoryStorage();
  let fire: ((key: string | null) => void) | null = null;
  const store = new GuestStore({
    local: () => local,
    session: () => session,
    listen: (fn) => {
      fire = fn;
      return () => {
        fire = null;
      };
    },
  });
  let changes = 0;
  const off = store.subscribe(() => {
    changes += 1;
  });
  return { store, local, session, otherTab: (key: string | null) => fire?.(key), changes: () => changes, off, listening: () => fire !== null };
}

describe("guest store", () => {
  it("starts from what the browser holds, and renders empty on the server", () => {
    const local = memoryStorage();
    local.map.set(GUEST_KEYS.inventory, JSON.stringify({ "5": { qty: 3 } }));
    const { store } = setup(local);
    expect(store.getSnapshot().inventory).toEqual({ 5: { qty: 3 } });
    expect(store.getSnapshot()).toBe(store.getSnapshot());
    expect(store.getServerSnapshot()).toBe(EMPTY_GUEST_SNAPSHOT);
  });

  it("writes each change to its own key and tells subscribers", async () => {
    const { store, local, changes } = setup();
    store.setSettings({ ...DEFAULT_SETTINGS, valuePack: false });
    store.setOwned(10, 4, 250, 1000);
    store.setOwned(11, 1, undefined, 1001);
    store.toggleFavorite(10, { th: "น้ำ", grade: 1 });
    expect(changes()).toBe(4);
    await written();
    expect(JSON.parse(local!.map.get(GUEST_KEYS.settings)!).valuePack).toBe(false);
    expect(JSON.parse(local!.map.get(GUEST_KEYS.inventory)!)).toEqual({ "10": { qty: 4, avgCost: 250, updatedAt: 1000 }, "11": { qty: 1, updatedAt: 1001 } });
    expect(JSON.parse(local!.map.get(GUEST_KEYS.favorites)!)).toEqual([{ id: 10, th: "น้ำ", grade: 1 }]);
    const snap = store.getSnapshot();
    expect(snap.settings?.valuePack).toBe(false);
    expect(snap.favorites).toEqual([{ id: 10, th: "น้ำ", grade: 1 }]);
  });

  it("keeps, clears or replaces a row's cost like the member version", () => {
    const { store } = setup();
    store.setOwned(1, 5, 100, 1);
    store.setOwned(1, 6, undefined, 2);
    expect(store.getSnapshot().inventory[1]).toEqual({ qty: 6, avgCost: 100, updatedAt: 2 });
    store.setOwned(1, 6, null, 3);
    expect(store.getSnapshot().inventory[1]).toEqual({ qty: 6, updatedAt: 3 });
    store.setOwned(1, 0, undefined, 4);
    expect(store.getSnapshot().inventory).toEqual({});
    store.setOwned(2, 3, 50, 5);
    store.clearInventory();
    expect(store.getSnapshot().inventory).toEqual({});
  });

  it("refuses bad input instead of storing it", async () => {
    const { store, local } = setup();
    store.setOwned(1, Number.NaN, undefined, 1);
    store.setOwned(2, 5, -10, 1);
    store.setOwned(3, 1e12, undefined, 1);
    expect(store.getSnapshot().inventory).toEqual({ 2: { qty: 5, updatedAt: 1 } });
    store.toggleFavorite(4, { th: "<b>x</b>".repeat(50), grade: 99 });
    expect(store.getSnapshot().favorites[0].th?.length).toBe(100);
    expect(store.getSnapshot().favorites[0].grade).toBeUndefined();
    await written();
    expect(local!.map.get(GUEST_KEYS.inventory)).toBe(JSON.stringify({ "2": { qty: 5, updatedAt: 1 } }));
  });

  it("writes each key once however many changes a burst makes (a CSV import, an undo)", async () => {
    const local = memoryStorage();
    const writes: string[] = [];
    const counting = {
      ...local,
      setItem: (k: string, v: string) => {
        writes.push(k);
        local.setItem(k, v);
      },
    };
    const { store } = setup(counting);
    for (let id = 1; id <= 500; id++) store.setOwned(id, id, undefined, id);
    expect(Object.keys(store.getSnapshot().inventory)).toHaveLength(500);
    expect(writes).toEqual([]);
    await written();
    expect(writes).toEqual([GUEST_KEYS.inventory]);
    expect(Object.keys(JSON.parse(local.map.get(GUEST_KEYS.inventory)!))).toHaveLength(500);
  });

  it("reads storage again after nobody listened, so another tab's rows are seen and kept", async () => {
    const { store, local, off } = setup();
    store.setOwned(1, 1, undefined, 1);
    await written();
    expect(store.getSnapshot().inventory).toEqual({ 1: { qty: 1, updatedAt: 1 } });
    // this tab goes to a page without the provider (help, login): nobody listens to other tabs now
    off();
    // meanwhile another tab adds item 2
    local!.map.set(GUEST_KEYS.inventory, JSON.stringify({ "1": { qty: 1, updatedAt: 1 }, "2": { qty: 7, updatedAt: 2 } }));
    // back on a page with the provider
    store.subscribe(() => {});
    expect(store.getSnapshot().inventory).toEqual({ 1: { qty: 1, updatedAt: 1 }, 2: { qty: 7, updatedAt: 2 } });
    store.setOwned(3, 2, undefined, 3);
    await written();
    expect(Object.keys(JSON.parse(local!.map.get(GUEST_KEYS.inventory)!))).toEqual(["1", "2", "3"]);
  });

  it("reads the part again before changing it, so a change made elsewhere moments ago is not written over", async () => {
    const { store, local } = setup();
    store.toggleFavorite(1);
    await written();
    // another tab stars item 2; its storage event has not arrived yet
    local!.map.set(GUEST_KEYS.favorites, JSON.stringify([{ id: 1 }, { id: 2 }]));
    store.toggleFavorite(3);
    await written();
    expect(JSON.parse(local!.map.get(GUEST_KEYS.favorites)!)).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it("stars and unstars, up to the cap", () => {
    const { store } = setup();
    for (let id = 1; id <= GUEST_MAX_FAVORITES + 5; id++) store.toggleFavorite(id);
    expect(store.getSnapshot().favorites).toHaveLength(GUEST_MAX_FAVORITES);
    store.toggleFavorite(1);
    expect(store.getSnapshot().favorites.some((f) => f.id === 1)).toBe(false);
  });

  it("still changes on screen when the browser will not store anything", async () => {
    const local = memoryStorage();
    local.broken = true;
    const { store } = setup(local);
    store.setOwned(9, 2, undefined, 1);
    store.toggleFavorite(9);
    await written();
    // the next change keeps this tab's copy (storage holds nothing to read back)
    store.setOwned(10, 1, undefined, 2);
    expect(store.getSnapshot().inventory).toEqual({ 9: { qty: 2, updatedAt: 1 }, 10: { qty: 1, updatedAt: 2 } });
    expect(store.getSnapshot().favorites).toEqual([{ id: 9 }]);
    await written();
    expect(local.map.size).toBe(0);

    const none = setup(null);
    none.store.setOwned(1, 1, undefined, 1);
    expect(none.store.getSnapshot().inventory).toEqual({ 1: { qty: 1, updatedAt: 1 } });
  });

  it("re-reads when another tab changes a guest key, and ignores other keys", () => {
    const { store, local, otherTab, changes } = setup();
    expect(store.getSnapshot().favorites).toEqual([]);
    local!.map.set(GUEST_KEYS.favorites, JSON.stringify([42]));
    otherTab("bls:recipes.sort");
    expect(changes()).toBe(0);
    expect(store.getSnapshot().favorites).toEqual([]);
    otherTab(GUEST_KEYS.favorites);
    expect(changes()).toBe(1);
    expect(store.getSnapshot().favorites).toEqual([{ id: 42 }]);
    // localStorage.clear() in another tab
    local!.map.clear();
    otherTab(null);
    expect(store.getSnapshot().favorites).toEqual([]);
  });

  it("stops listening to other tabs when the last subscriber leaves", () => {
    const { off, listening } = setup();
    expect(listening()).toBe(true);
    off();
    expect(listening()).toBe(false);
  });

  it("clearAll forgets the guest data; dismissImport is kept for the tab", () => {
    const { store, local, session } = setup();
    store.setSettings(DEFAULT_SETTINGS);
    store.setOwned(1, 1, undefined, 1);
    store.toggleFavorite(1);
    store.dismissImport();
    expect(session.map.get(GUEST_IMPORT_DISMISSED_KEY)).toBe("1");
    store.clearAll();
    expect(local!.map.size).toBe(0);
    const snap = store.getSnapshot();
    expect(snap).toMatchObject({ settings: null, inventory: {}, favorites: [], importDismissed: true });
  });
});
