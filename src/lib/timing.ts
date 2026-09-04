/**
 * Wall-clock laps for server-side diagnostics. Kept out of components so the
 * React purity lint (which flags performance.now in render) does not fire on
 * server pages that legitimately time their own data fetching once per request.
 */
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
