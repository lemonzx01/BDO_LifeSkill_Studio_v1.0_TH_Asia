"use client";

import { useSyncExternalStore } from "react";
import type { Inventory, ItemId } from "@/lib/engine/types";

const KEY = "bdo-lifeskill-studio:inventory:v1";
const EMPTY: Inventory = {};

function load(): Inventory {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Inventory) : EMPTY;
  } catch {
    return EMPTY;
  }
}

let cached: Inventory | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): Inventory {
  if (!cached) cached = load();
  return cached;
}
function getServerSnapshot(): Inventory {
  return EMPTY;
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function persist(next: Inventory) {
  cached = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  for (const l of listeners) l();
}

/** Set how many of an item you own (0 removes the entry). */
export function setOwned(id: ItemId, qty: number, avgCost?: number) {
  const cur = getSnapshot();
  const next: Inventory = { ...cur };
  if (qty > 0) next[id] = { qty, avgCost: avgCost ?? cur[id]?.avgCost };
  else delete next[id];
  persist(next);
}

export function clearInventory() {
  persist({});
}

export function useInventory(): Inventory {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
