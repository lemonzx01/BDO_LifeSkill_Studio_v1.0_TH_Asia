"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { isVisitorId, VISITOR_STORAGE_KEY } from "@/lib/usage/track";

/**
 * Counts this browser as one visitor (see /admin/stats). It keeps a random id in localStorage and
 * reports { id, page } to /api/track on load and on every page change, for guests and members
 * alike. Nothing is sent when the browser asks not to be tracked (Global Privacy Control or Do Not
 * Track) or cannot keep the id. Runs after paint and never waits for the answer.
 */
export function UsageBeacon() {
  const pathname = usePathname();
  // React's dev double-run of effects must not count the same page twice
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || lastSent.current === pathname) return;
    lastSent.current = pathname;
    try {
      if (optedOut()) return;
      const vid = visitorId();
      if (!vid) return;
      void fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vid, path: pathname }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* counting is optional */
    }
  }, [pathname]);

  return null;
}

function optedOut(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  const w = window as Window & { doNotTrack?: string };
  return nav.globalPrivacyControl === true || nav.doNotTrack === "1" || w.doNotTrack === "1";
}

/** This browser's id, made on the first visit; null when localStorage is unavailable (no id is invented per page load). */
function visitorId(): string | null {
  try {
    const kept = localStorage.getItem(VISITOR_STORAGE_KEY);
    if (isVisitorId(kept)) return kept;
    const fresh = randomId();
    localStorage.setItem(VISITOR_STORAGE_KEY, fresh);
    return localStorage.getItem(VISITOR_STORAGE_KEY) === fresh ? fresh : null;
  } catch {
    return null;
  }
}

/** crypto.randomUUID() exists only on https and localhost; build the same version-4 UUID otherwise */
function randomId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
