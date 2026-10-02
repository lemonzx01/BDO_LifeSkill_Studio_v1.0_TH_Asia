"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { DEFAULT_SETTINGS, type Inventory, type ItemId, type Settings } from "@/lib/engine/types";
import { fetchJson } from "@/lib/fetch-error";
import { IDLE_SAVE, overlayFavorites, overlayInventory, overlaySettings, saveQueue, type SaveSnapshot } from "@/lib/save-queue";
import { dismissActionToasts } from "./ui/Toast";
import { LEGACY_INVENTORY_KEY, LEGACY_SETTINGS_KEY, normalizeSettings } from "@/lib/settings";

interface UserData {
  settings: Settings;
  setSettings: (next: Settings) => void;
  inventory: Inventory;
  /** avgCost: number = record that cost, null = follow the market price, undefined = keep as is */
  setOwned: (id: ItemId, qty: number, avgCost?: number | null) => void;
  clearInventory: () => void;
  /** starred item ids, and what the market knows about them (for the home page card) */
  favorites: ItemId[];
  favoriteItems: FavoriteItem[];
  toggleFavorite: (id: ItemId) => void;
}

export interface FavoriteItem {
  id: ItemId;
  th: string | null;
  grade: number | null;
  price: number | null;
  stock: number | null;
}

const Ctx = createContext<UserData | null>(null);

const SETTINGS_DELAY_MS = 600;
const ITEM_DELAY_MS = 400;

const serverSave = () => IDLE_SAVE;

/**
 * Browser back/forward shows a page as it was first rendered (Next reuses that render), which can
 * predate changes this tab saved since: the queue forgets confirmed changes at the next page change,
 * so it cannot lay them over again. A provider mounted after back/forward reloads the account's
 * settings and inventory instead. Set on every popstate; cleared once a reload has gone through
 * (not when it starts, so React's development double mount does not lose it).
 */
let reloadAfterHistory = false;
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    reloadAfterHistory = true;
  });
}
const needsHistoryReload = () => reloadAfterHistory;
const historyReloadDone = () => {
  reloadAfterHistory = false;
};

/**
 * Per-account settings, inventory and starred items. Initial values come from the database
 * (server render); changes apply on screen at once and go to the server through the tab's save
 * queue (lib/save-queue), which checks every answer, keeps and retries what failed, and outlives
 * the page. Changes the server render may not include yet are laid over it here. Values saved by
 * the old browser-only version are migrated once.
 *
 * `userId` ties the queue to this account, so another account signing in on the same tab never
 * receives its changes. `initialInventory` is null on a page that does not load the inventory
 * (market, calc): it is then neither shown as empty to the old-version migration nor migrated.
 */
export function UserDataProvider({
  userId,
  initialSettings,
  initialInventory,
  children,
}: {
  userId: number;
  initialSettings: Settings | null;
  initialInventory: Inventory | null;
  children: ReactNode;
}) {
  const [settings, setSettingsState] = useState<Settings>(() => overlaySettings(initialSettings ?? DEFAULT_SETTINGS, saveQueue.jobsFor(userId)));
  const [inventory, setInventory] = useState<Inventory>(() => overlayInventory(initialInventory ?? {}, saveQueue.jobsFor(userId)));
  const [favorites, setFavorites] = useState<ItemId[]>([]);
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  // the list toggleFavorite reads, so the request says the same thing as the screen
  const favoritesRef = useRef<ItemId[]>([]);

  const loadFavorites = useCallback(() => {
    fetch("/api/user/favorites", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ ids: ItemId[]; items: FavoriteItem[] }>) : null))
      .then((j) => {
        if (!j) return;
        // stars this tab has not got onto the server yet win over what the server sent
        const ids = overlayFavorites(j.ids, saveQueue.jobsFor(userId));
        favoritesRef.current = ids;
        setFavorites(ids);
        setFavoriteItems(j.items);
      })
      .catch(() => {});
  }, [userId]);

  // the queue: claim it for this account, resend what failed, and send what is waiting before the page goes
  useEffect(() => {
    saveQueue.claim(userId);
    // this page rendered, so the session is good: send what a 401 held back or what failed earlier
    // (e.g. before signing back in)
    saveQueue.resume();
    const flushForUnload = () => saveQueue.flush(true);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushForUnload();
    };
    window.addEventListener("pagehide", flushForUnload);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", saveQueue.retry);
    // a starred item reached the server: reload the list with its name and price
    const offDone = saveQueue.onDone((job) => {
      if (job.kind === "favorite") loadFavorites();
    });
    return () => {
      window.removeEventListener("pagehide", flushForUnload);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", saveQueue.retry);
      offDone();
      // leaving this page (providers are per page): send what is still waiting now, so the next
      // page's server render is more likely to have it; the next provider lays the rest over.
      // keepalive in case this unmount is the tab going away (a refused keepalive request just
      // fails and is retried like any other)
      saveQueue.flush(true);
      saveQueue.markNavigation();
      // an undo (เลิกทำ) acts on this page's data: it must not outlive the page and change data the
      // next page does not show
      dismissActionToasts();
    };
  }, [userId, loadFavorites]);

  // starred items come from the account, fetched once after mount
  useEffect(() => {
    const t = setTimeout(loadFavorites, 0);
    return () => clearTimeout(t);
  }, [loadFavorites]);

  // after browser back/forward this page may show settings and inventory older than what this tab
  // saved since: load the account's current ones and lay the changes not on the server yet over them
  useEffect(() => {
    if (!needsHistoryReload()) return;
    const ctrl = new AbortController();
    const opts = { cache: "no-store" as const, signal: ctrl.signal };
    Promise.all([
      fetchJson<{ settings: Settings | null }>("/api/user/settings", opts),
      fetchJson<{ inventory: Inventory }>("/api/user/inventory", opts),
    ])
      .then(([s, inv]) => {
        historyReloadDone();
        const jobs = saveQueue.jobsFor(userId);
        setSettingsState(overlaySettings(s.settings ?? DEFAULT_SETTINGS, jobs));
        setInventory(overlayInventory(inv.inventory, jobs));
      })
      // aborted (the page went), or failed: the page keeps what it showed, and the next page tries again
      .catch(() => {});
    return () => ctrl.abort();
  }, [userId]);

  const toggleFavorite = useCallback((id: ItemId) => {
    const cur = favoritesRef.current;
    const on = !cur.includes(id);
    const next = on ? [...cur, id] : cur.filter((x) => x !== id);
    favoritesRef.current = next;
    setFavorites(next);
    saveQueue.enqueue({ kind: "favorite", id, on });
  }, []);

  const setSettings = useCallback((next: Settings) => {
    setSettingsState(next);
    saveQueue.enqueue({ kind: "settings", settings: next }, SETTINGS_DELAY_MS);
  }, []);

  const setOwned = useCallback((id: ItemId, qty: number, avgCost?: number | null) => {
    const updatedAt = Date.now();
    setInventory((cur) => {
      const next: Inventory = { ...cur };
      if (qty > 0) next[id] = { qty, avgCost: avgCost === null ? undefined : (avgCost ?? cur[id]?.avgCost), updatedAt };
      else delete next[id];
      return next;
    });
    saveQueue.enqueue({ kind: "item", id, qty, avgCost, updatedAt }, ITEM_DELAY_MS);
  }, []);

  const clearInventory = useCallback(() => {
    setInventory({});
    saveQueue.enqueue({ kind: "clear" });
  }, []);

  // one-time migration from the browser-only version (runs in a callback after mount)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        if (!initialSettings) {
          const raw = window.localStorage.getItem(LEGACY_SETTINGS_KEY);
          if (raw) {
            const migrated = normalizeSettings(JSON.parse(raw));
            setSettingsState(migrated);
            saveQueue.enqueue({ kind: "settings", settings: migrated }, SETTINGS_DELAY_MS);
            window.localStorage.removeItem(LEGACY_SETTINGS_KEY);
          }
        }
        // only where the inventory was loaded and is really empty (not on the market or calc page,
        // whose empty placeholder would push old browser-only rows over the account's real ones)
        if (initialInventory && Object.keys(initialInventory).length === 0) {
          const raw = window.localStorage.getItem(LEGACY_INVENTORY_KEY);
          if (raw) {
            const legacy = JSON.parse(raw) as Inventory;
            const entries = Object.entries(legacy).filter(([, v]) => v && v.qty > 0);
            if (entries.length) {
              setInventory(Object.fromEntries(entries) as Inventory);
              for (const [id, v] of entries) saveQueue.enqueue({ kind: "item", id: Number(id), qty: v!.qty, avgCost: v!.avgCost }, ITEM_DELAY_MS);
            }
            window.localStorage.removeItem(LEGACY_INVENTORY_KEY);
          }
        }
      } catch {
        /* storage unavailable */
      }
    }, 0);
    return () => clearTimeout(timer);
    // run once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<UserData>(
    () => ({
      settings,
      setSettings,
      inventory,
      setOwned,
      clearInventory,
      favorites,
      favoriteItems,
      toggleFavorite,
    }),
    [settings, setSettings, inventory, setOwned, clearInventory, favorites, favoriteItems, toggleFavorite],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUserData(): UserData {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useUserData must be used inside <UserDataProvider>");
  return ctx;
}

/** The same data, or null on a page without a provider (help, account, admin, the loading skeleton). */
export function useOptionalUserData(): UserData | null {
  return useContext(Ctx);
}

/** Whether this tab's changes have reached the server (for SaveStatus). Separate from the data, so a save does not re-render every page. */
export function useSaveState(): SaveSnapshot {
  return useSyncExternalStore(saveQueue.subscribe, saveQueue.getSnapshot, serverSave);
}

export function useSettings(): [Settings, (next: Settings) => void] {
  const { settings, setSettings } = useUserData();
  return [settings, setSettings];
}

export function useInventory(): Inventory {
  return useUserData().inventory;
}
