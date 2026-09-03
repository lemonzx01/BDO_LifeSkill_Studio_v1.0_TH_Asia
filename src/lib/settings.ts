"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/engine/types";

const KEY = "bdo-lifeskill-studio:settings:v1";

export function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      mastery: { ...DEFAULT_SETTINGS.mastery, ...(parsed.mastery ?? {}) },
      yieldMultiplier: { ...DEFAULT_SETTINGS.yieldMultiplier, ...(parsed.yieldMultiplier ?? {}) },
      craftsPerHour: { ...DEFAULT_SETTINGS.craftsPerHour, ...(parsed.craftsPerHour ?? {}) },
      skillTier: { ...DEFAULT_SETTINGS.skillTier, ...(parsed.skillTier ?? {}) },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable (private mode etc.) */
  }
}

// Tiny external store so React can hydrate with defaults and then switch to the
// browser's saved settings without a hydration mismatch.
let cached: Settings | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): Settings {
  if (!cached) cached = loadSettings();
  return cached;
}
function getServerSnapshot(): Settings {
  return DEFAULT_SETTINGS;
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function setSettings(next: Settings) {
  cached = next;
  saveSettings(next);
  for (const l of listeners) l();
}

/** Settings persisted to localStorage (defaults during server render / first paint). */
export function useSettings(): [Settings, (next: Settings) => void] {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return [settings, setSettings];
}
