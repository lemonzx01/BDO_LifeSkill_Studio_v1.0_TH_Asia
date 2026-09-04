"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useState that remembers its last value in this browser (per key), so filters,
 * sort orders and modes come back the way the member left them. The first
 * render always uses `initial` (matches the server); the stored value is
 * applied right after mount. `accept` rejects stale or malformed stored values.
 */
export function usePersistentState<T>(key: string, initial: T, accept?: (v: unknown) => v is T): [T, (next: T | ((cur: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial);
  const loaded = useRef(false);
  const storageKey = `bls:${key}`;

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (raw !== null) {
          const parsed: unknown = JSON.parse(raw);
          if (!accept || accept(parsed)) setValue(parsed as T);
        }
      } catch {
        /* storage unavailable or corrupt: keep the default */
      }
      loaded.current = true;
    }, 0);
    return () => clearTimeout(t);
    // load once per key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const set = useCallback(
    (next: T | ((cur: T) => T)) => {
      setValue((cur) => {
        const resolved = typeof next === "function" ? (next as (cur: T) => T)(cur) : next;
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(resolved));
        } catch {
          /* ignore */
        }
        return resolved;
      });
    },
    [storageKey],
  );

  return [value, set];
}

/** Type guard factory for string unions: usePersistentState("x", "a", oneOf(["a", "b"] as const)). */
export function oneOf<const A extends readonly string[]>(values: A) {
  return (v: unknown): v is A[number] => typeof v === "string" && (values as readonly string[]).includes(v);
}

export const isBoolean = (v: unknown): v is boolean => typeof v === "boolean";
export const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
