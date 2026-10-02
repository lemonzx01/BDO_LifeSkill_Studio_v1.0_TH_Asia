"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { SessionEnded } from "@/lib/auth/session";
import { DEFAULT_SETTINGS, type Inventory, type ItemId, type Settings } from "@/lib/engine/types";
import { fetchJson } from "@/lib/fetch-error";
import { summarizeGuestData, type GuestSummary } from "@/lib/guest/storage";
import { guestStore } from "@/lib/guest/store";
import { IDLE_SAVE, overlayFavorites, overlayInventory, overlaySettings, saveQueue, type SaveSnapshot } from "@/lib/save-queue";
import { dismissActionToasts } from "./ui/Toast";
import { LEGACY_INVENTORY_KEY, LEGACY_SETTINGS_KEY, normalizeSettings } from "@/lib/settings";

/** What a star knows about its item: kept with a guest's star, so the home page can name it. */
export interface FavoriteMeta {
  th?: string | null;
  grade?: number | null;
}

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
  toggleFavorite: (id: ItemId, meta?: FavoriteMeta) => void;
  /** a visitor who is not signed in: settings, inventory and stars stay in this browser */
  guest: boolean;
  /**
   * The data on screen is the real one. False only for a guest while the page is being hydrated:
   * the server cannot see this browser's storage, so until then inventory and stars look empty
   * (show a skeleton, not "nothing here").
   */
  ready: boolean;
  /** a guest whose browser still sent a session cookie that no longer works (see SessionEndedNotice) */
  sessionEnded: SessionEnded | null;
  /**
   * Whether character settings have been saved (the home page's first-time setup card): a member's
   * before this page or copied in from this browser, a guest's in this browser. null while not known
   * yet: a guest's are read from the browser once the page is live.
   */
  hasSavedSettings: boolean | null;
  /**
   * Signed-in member only: what this browser kept from before signing in, offered for copying into
   * the account while the account's inventory and stars are still empty. null when there is no offer.
   */
  guestImport: GuestSummary | null;
  /** copies that data into the account (through the save queue); the browser's copy is forgotten once all of it is saved */
  importGuestData: () => void;
  /** no more offer in this tab */
  dismissGuestImport: () => void;
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
const noop = () => {};
const subscribeNothing = () => noop;

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
 * Data copied in from this browser's guest storage is still on its way to the account: the browser's
 * copy is forgotten only once every change in the save queue has been confirmed, so a failed save
 * never loses it from both places. Module state, like the queue, so it outlives the page.
 */
let clearGuestAfterSaving: number | null = null;
/** For account `userId`'s pages: forgets the browser's copy once everything copied in is saved. */
function clearGuestIfSaved(userId: number) {
  if (clearGuestAfterSaving === null) return;
  // another account took this tab's queue over (and dropped the first one's changes): the copy stays
  if (clearGuestAfterSaving !== userId) clearGuestAfterSaving = null;
  else if (saveQueue.allSaved()) {
    clearGuestAfterSaving = null;
    guestStore.clearAll();
  }
}

/**
 * Settings, inventory and starred items for the page. `userId` null is a visitor who is not signed
 * in: everything lives in this browser's storage (lib/guest) and nothing is sent anywhere. With an
 * account it all belongs to the account (see MemberDataProvider).
 *
 * `initialInventory` is null on a page that does not load the inventory (market, calc).
 * `sessionEnded` (guests only) says the browser sent a session cookie that no longer works.
 */
export function UserDataProvider({
  userId,
  initialSettings,
  initialInventory,
  sessionEnded = null,
  children,
}: {
  userId: number | null;
  initialSettings: Settings | null;
  initialInventory: Inventory | null;
  sessionEnded?: SessionEnded | null;
  children: ReactNode;
}) {
  if (userId === null) return <GuestDataProvider sessionEnded={sessionEnded}>{children}</GuestDataProvider>;
  return (
    <MemberDataProvider userId={userId} initialSettings={initialSettings} initialInventory={initialInventory}>
      {children}
    </MemberDataProvider>
  );
}

/**
 * A visitor who is not signed in. The data is read from localStorage once the page is live (the
 * server cannot see it, so it renders the defaults), written back on every change, and follows
 * changes made in another tab. Nothing goes through the save queue or the network.
 */
function GuestDataProvider({ sessionEnded, children }: { sessionEnded: SessionEnded | null; children: ReactNode }) {
  const snap = useSyncExternalStore(guestStore.subscribe, guestStore.getSnapshot, guestStore.getServerSnapshot);
  // false while the server render is being hydrated (the stored data is not on screen yet)
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);

  useEffect(() => {
    // whatever an account left in this tab's save queue is neither shown nor sent on a guest page
    saveQueue.enterGuest();
    // an undo (เลิกทำ) acts on this page's data: it must not outlive the page
    return () => dismissActionToasts();
  }, []);

  const settings = snap.settings ?? DEFAULT_SETTINGS;
  const favorites = useMemo(() => snap.favorites.map((f) => f.id), [snap.favorites]);
  const favoriteItems = useMemo<FavoriteItem[]>(
    () => snap.favorites.map((f) => ({ id: f.id, th: f.th ?? null, grade: f.grade ?? null, price: null, stock: null })),
    [snap.favorites],
  );

  const setSettings = useCallback((next: Settings) => guestStore.setSettings(next), []);
  const setOwned = useCallback((id: ItemId, qty: number, avgCost?: number | null) => guestStore.setOwned(id, qty, avgCost, Date.now()), []);
  const clearInventory = useCallback(() => guestStore.clearInventory(), []);
  const toggleFavorite = useCallback((id: ItemId, meta?: FavoriteMeta) => guestStore.toggleFavorite(id, meta), []);

  const value = useMemo<UserData>(
    () => ({
      settings,
      setSettings,
      inventory: snap.inventory,
      setOwned,
      clearInventory,
      favorites,
      favoriteItems,
      toggleFavorite,
      guest: true,
      ready: hydrated,
      sessionEnded,
      hasSavedSettings: hydrated ? snap.settings !== null : null,
      guestImport: null,
      importGuestData: noop,
      dismissGuestImport: noop,
    }),
    [settings, setSettings, snap.inventory, snap.settings, setOwned, clearInventory, favorites, favoriteItems, toggleFavorite, hydrated, sessionEnded],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Per-account settings, inventory and starred items. Initial values come from the database
 * (server render); changes apply on screen at once and go to the server through the tab's save
 * queue (lib/save-queue), which checks every answer, keeps and retries what failed, and outlives
 * the page. Changes the server render may not include yet are laid over it here. Values saved by
 * the old browser-only version are migrated once; data kept while not signed in is only copied
 * when the member says so (guestImport).
 *
 * `userId` ties the queue to this account, so another account signing in on the same tab never
 * receives its changes. `initialInventory` is null on a page that does not load the inventory
 * (market, calc): it is then neither shown as empty to the old-version migration nor migrated.
 */
function MemberDataProvider({
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
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  // the account has settings of its own (saved before, or changed on this page): a guest copy must not replace them
  const [settingsSaved, setSettingsSaved] = useState(initialSettings !== null);
  // settings were just copied in from this browser's guest data (the first-time setup card can go)
  const [settingsImported, setSettingsImported] = useState(false);
  // the list toggleFavorite reads, so the request says the same thing as the screen
  const favoritesRef = useRef<ItemId[]>([]);
  // what this browser kept from before signing in (empty during the server render)
  const guestSnap = useSyncExternalStore(guestStore.subscribe, guestStore.getSnapshot, guestStore.getServerSnapshot);

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
        setFavoritesLoaded(true);
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
    // data copied in from this browser: forget the browser's copy once the account has all of it
    const offSaved = saveQueue.subscribe(() => clearGuestIfSaved(userId));
    clearGuestIfSaved(userId);
    return () => {
      window.removeEventListener("pagehide", flushForUnload);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", saveQueue.retry);
      offDone();
      offSaved();
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
    setSettingsSaved(true);
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
            setSettingsSaved(true);
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

  // The offer to copy this browser's guest data in: only while the account is clearly empty (this
  // page loaded its inventory and it has no rows, and its stars have loaded and there are none), so
  // nothing the member already has is mixed or overwritten. Settings come along only when the
  // account has none of its own.
  const ownedCount = useMemo(() => Object.values(inventory).filter((e) => e && e.qty > 0).length, [inventory]);
  const guestImport = useMemo<GuestSummary | null>(() => {
    if (initialInventory === null || !favoritesLoaded || favorites.length > 0 || ownedCount > 0 || guestSnap.importDismissed) return null;
    const s = summarizeGuestData(guestSnap);
    const offer = { ...s, settings: s.settings && !settingsSaved };
    return offer.items > 0 || offer.favorites > 0 || offer.settings ? offer : null;
  }, [initialInventory, favoritesLoaded, favorites.length, ownedCount, guestSnap, settingsSaved]);

  const importGuestData = useCallback(() => {
    const g = guestStore.getSnapshot();
    if (g.settings && !settingsSaved) {
      setSettings(g.settings);
      setSettingsImported(true);
    }
    for (const [id, e] of Object.entries(g.inventory)) {
      if (e && e.qty > 0) setOwned(Number(id), e.qty, e.avgCost);
    }
    for (const f of g.favorites) {
      if (!favoritesRef.current.includes(f.id)) toggleFavorite(f.id);
    }
    // no more offer in this tab; the browser's copy is forgotten only once the account has confirmed
    // every save (a failed one is retried like any other, and SaveStatus shows how it goes)
    guestStore.dismissImport();
    clearGuestAfterSaving = userId;
    saveQueue.flush(false);
    clearGuestIfSaved(userId);
  }, [userId, settingsSaved, setSettings, setOwned, toggleFavorite]);

  const dismissGuestImport = useCallback(() => guestStore.dismissImport(), []);

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
      guest: false,
      ready: true,
      sessionEnded: null,
      hasSavedSettings: initialSettings !== null || settingsImported,
      guestImport,
      importGuestData,
      dismissGuestImport,
    }),
    [settings, setSettings, inventory, setOwned, clearInventory, favorites, favoriteItems, toggleFavorite, initialSettings, settingsImported, guestImport, importGuestData, dismissGuestImport],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUserData(): UserData {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useUserData must be used inside <UserDataProvider>");
  return ctx;
}

/** The same data, or null on a page without a provider (account, admin, the loading skeleton). */
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
