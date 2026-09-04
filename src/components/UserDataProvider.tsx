"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { DEFAULT_SETTINGS, type Inventory, type ItemId, type Settings } from "@/lib/engine/types";
import { LEGACY_INVENTORY_KEY, LEGACY_SETTINGS_KEY, normalizeSettings } from "@/lib/settings";

interface UserData {
  settings: Settings;
  setSettings: (next: Settings) => void;
  inventory: Inventory;
  /** avgCost: number = record that cost, null = follow the market price, undefined = keep as is */
  setOwned: (id: ItemId, qty: number, avgCost?: number | null) => void;
  clearInventory: () => void;
}

const Ctx = createContext<UserData | null>(null);

/**
 * Per-account settings and inventory. Initial values come from the database
 * (server render); changes apply immediately and are saved back with a short
 * debounce. Values saved by the old browser-only version are migrated once.
 */
export function UserDataProvider({
  initialSettings,
  initialInventory,
  children,
}: {
  initialSettings: Settings | null;
  initialInventory: Inventory;
  children: ReactNode;
}) {
  const [settings, setSettingsState] = useState<Settings>(initialSettings ?? DEFAULT_SETTINGS);
  const [inventory, setInventory] = useState<Inventory>(initialInventory);
  const settingsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemTimers = useRef(new Map<ItemId, ReturnType<typeof setTimeout>>());

  const saveSettings = useCallback((next: Settings) => {
    if (settingsTimer.current) clearTimeout(settingsTimer.current);
    settingsTimer.current = setTimeout(() => {
      fetch("/api/user/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) }).catch(() => {});
    }, 600);
  }, []);

  const saveItem = useCallback((id: ItemId, qty: number, avgCost?: number | null) => {
    const timers = itemTimers.current;
    const t = timers.get(id);
    if (t) clearTimeout(t);
    timers.set(
      id,
      setTimeout(() => {
        timers.delete(id);
        fetch("/api/user/inventory", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, qty, avgCost }),
        }).catch(() => {});
      }, 400),
    );
  }, []);

  const setSettings = useCallback(
    (next: Settings) => {
      setSettingsState(next);
      saveSettings(next);
    },
    [saveSettings],
  );

  const setOwned = useCallback(
    (id: ItemId, qty: number, avgCost?: number | null) => {
      setInventory((cur) => {
        const next: Inventory = { ...cur };
        if (qty > 0) next[id] = { qty, avgCost: avgCost === null ? undefined : (avgCost ?? cur[id]?.avgCost) };
        else delete next[id];
        return next;
      });
      saveItem(id, qty, avgCost);
    },
    [saveItem],
  );

  const clearInventory = useCallback(() => {
    setInventory({});
    fetch("/api/user/inventory", { method: "DELETE" }).catch(() => {});
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
            saveSettings(migrated);
            window.localStorage.removeItem(LEGACY_SETTINGS_KEY);
          }
        }
        if (Object.keys(initialInventory).length === 0) {
          const raw = window.localStorage.getItem(LEGACY_INVENTORY_KEY);
          if (raw) {
            const legacy = JSON.parse(raw) as Inventory;
            const entries = Object.entries(legacy).filter(([, v]) => v && v.qty > 0);
            if (entries.length) {
              setInventory(Object.fromEntries(entries) as Inventory);
              for (const [id, v] of entries) saveItem(Number(id), v!.qty, v!.avgCost);
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

  return <Ctx.Provider value={{ settings, setSettings, inventory, setOwned, clearInventory }}>{children}</Ctx.Provider>;
}

export function useUserData(): UserData {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useUserData must be used inside <UserDataProvider>");
  return ctx;
}

export function useSettings(): [Settings, (next: Settings) => void] {
  const { settings, setSettings } = useUserData();
  return [settings, setSettings];
}

export function useInventory(): Inventory {
  return useUserData().inventory;
}
