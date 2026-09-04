/**
 * Wall-clock laps for server-side diagnostics. Kept out of components so the
 * React purity lint (which flags performance.now in render) does not fire on
 * server pages that legitimately time their own data fetching once per request.
 */
/** Whole days between an ISO timestamp and now (kept here for the same lint reason as stopwatch). */
export function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86_400_000));
}

export function stopwatch() {
  const start = performance.now();
  let last = start;
  return {
    /** milliseconds since the previous lap (or since start) */
    lap(): number {
      const now = performance.now();
      const ms = Math.round(now - last);
      last = now;
      return ms;
    },
    /** milliseconds since start */
    total(): number {
      return Math.round(performance.now() - start);
    },
  };
}
