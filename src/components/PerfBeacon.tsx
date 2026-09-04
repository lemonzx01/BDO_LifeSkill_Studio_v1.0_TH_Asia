"use client";

import { useEffect } from "react";

/**
 * Reports how long this page took in the visitor's browser (server wait, download,
 * hydration) to /api/perf once after mount, so slowness can be diagnosed from
 * /api/health without asking anyone to open devtools. Never blocks rendering.
 */
export function PerfBeacon({ page, rows }: { page: string; rows?: number }) {
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
        const fullLoad = nav && nav.name.includes(`/${page}`);
        const body = {
          page,
          rows: rows ?? null,
          // full page load (typing the URL / refresh); a client-side link click has no navigation entry for this page
          ttfbMs: fullLoad ? Math.round(nav.responseStart) : null,
          responseMs: fullLoad ? Math.round(nav.responseEnd - nav.responseStart) : null,
          domReadyMs: fullLoad ? Math.round(nav.domContentLoadedEventEnd) : null,
          transferBytes: fullLoad ? nav.transferSize : null,
          decodedBytes: fullLoad ? nav.decodedBodySize : null,
          // time from navigation start until this component mounted = "page usable" for a full load
          mountedMs: Math.round(performance.now()),
          fullLoad: Boolean(fullLoad),
          mobile: /Mobi|Android/i.test(navigator.userAgent),
          connection: (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType ?? null,
        };
        void fetch("/api/perf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true });
      } catch {
        /* measuring is optional */
      }
    }, 0);
    return () => clearTimeout(t);
  }, [page, rows]);
  return null;
}
