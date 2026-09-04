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
        // what the browser had to download to get here, split by kind
        const res = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
        const sum = (pred: (r: PerformanceResourceTiming) => boolean) => {
          let bytes = 0;
          let count = 0;
          let lastEnd = 0;
          for (const r of res) {
            if (!pred(r)) continue;
            bytes += r.transferSize || 0;
            count += 1;
            lastEnd = Math.max(lastEnd, r.responseEnd);
          }
          return { bytes, count, lastEndMs: Math.round(lastEnd) };
        };
        const scripts = sum((r) => r.initiatorType === "script" || r.name.endsWith(".js"));
        const images = sum((r) => r.initiatorType === "img" || /\.(webp|png|jpg|ico)(\?|$)/.test(r.name));
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
          scriptBytes: scripts.bytes,
          scriptCount: scripts.count,
          scriptsDoneMs: scripts.lastEndMs,
          imageBytes: images.bytes,
          imageCount: images.count,
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
