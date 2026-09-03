/**
 * Best-effort in-memory login throttle (per serverless instance). Enough to
 * blunt password guessing for a small guild tool without extra infrastructure.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;

const failures = new Map<string, { count: number; resetAt: number }>();

export function isThrottled(key: string): boolean {
  const e = failures.get(key);
  if (!e) return false;
  if (Date.now() > e.resetAt) {
    failures.delete(key);
    return false;
  }
  return e.count >= MAX_FAILURES;
}

export function recordFailure(key: string) {
  const now = Date.now();
  const e = failures.get(key);
  if (!e || now > e.resetAt) failures.set(key, { count: 1, resetAt: now + WINDOW_MS });
  else e.count += 1;
}

export function clearFailures(key: string) {
  failures.delete(key);
}
