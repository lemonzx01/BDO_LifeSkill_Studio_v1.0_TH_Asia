import { clientIp, hit, type HitResult } from "@/lib/auth/ratelimit";
import { TtlCache } from "@/lib/ttl-cache";

/**
 * Per-address limits for the API routes anyone may call without signing in (signed-in members
 * are not counted). Built on the login throttle's database counters (hit), so every serverless
 * instance sees the same counts; the address is the same one the login throttle uses (clientIp:
 * IPv6 counted per /64). A browser using the site normally stays far below these numbers.
 */
export const PUBLIC_WINDOW_MS = 15 * 60 * 1000;

/**
 * Requests per address within PUBLIC_WINDOW_MS. One address is often several people (a game cafe, a
 * guild playing together, a phone carrier's shared address), so these sit far above one person's use;
 * they are there to stop scripts. The answers that are the same for everyone are also kept by the CDN
 * (see the routes), and a request the CDN answers never reaches the server or this count.
 */
export const PUBLIC_LIMITS = {
  /** GET /api/data, full downloads only: "still the same?" checks are answered 304 and not counted */
  data: 120,
  /** GET /api/prices (every page view asks once; the inventory page again as rows are added) */
  prices: 600,
  /** GET /api/market/search (quick search asks as you type) */
  search: 300,
  /** GET /api/market/[id] (may ask the official market API) */
  item: 120,
} as const;

/**
 * Item lookups (/api/market/[id]) that visitors who are not signed in may send on to the official
 * market API per PUBLIC_WINDOW_MS, all of them together: many addresses (a VPS's IPv6 range) cannot
 * add up to more than this. Past it they get the item's history from the database only.
 */
export const GUEST_ITEM_UPSTREAM_BUDGET = 300;
export const GUEST_ITEM_UPSTREAM_KEY = "pub:item-upstream";

export type PublicRoute = keyof typeof PUBLIC_LIMITS;

export const publicLimitKey = (route: PublicRoute, ip: string) => `pub:${route}:${ip}`;

type HitFn = (key: string, limit: number, windowMs: number) => Promise<HitResult>;

/**
 * Used only while the database cannot count (it is down or unreachable): the same limits per
 * server instance, so a database outage does not open the public routes up completely.
 */
const MEMORY_MAX_KEYS = 10_000;
const memory = new TtlCache<string, { count: number; resetAt: number }>(MEMORY_MAX_KEYS, PUBLIC_WINDOW_MS);

export function memoryHit(key: string, limit: number, windowMs: number, now: number): HitResult {
  const cur = memory.get(key, now);
  const fresh = !cur || cur.resetAt <= now;
  const next = fresh ? { count: 1, resetAt: now + windowMs } : { count: cur.count + 1, resetAt: cur.resetAt };
  memory.set(key, next, now);
  return { allowed: next.count <= limit, count: next.count, retryAfterSec: Math.max(1, Math.ceil((next.resetAt - now) / 1000)) };
}

export interface PublicLimitDeps {
  hit: HitFn;
  now: () => number;
}

const defaultDeps: PublicLimitDeps = { hit, now: () => Date.now() };

/** The 429 answer: how long to wait, in the Retry-After header and in the body. */
export function tooManyRequests(retryAfterSec: number): Response {
  const wait = Math.max(1, Math.ceil(retryAfterSec));
  return new Response(JSON.stringify({ error: "too many requests", retryAfterSec: wait }), {
    status: 429,
    headers: { "Content-Type": "application/json", "Retry-After": String(wait), "Cache-Control": "no-store" },
  });
}

/** Counts one use of `key` in the database, or in this instance's memory while the database cannot count. */
async function count(key: string, limit: number, d: PublicLimitDeps): Promise<HitResult> {
  try {
    return await d.hit(key, limit, PUBLIC_WINDOW_MS);
  } catch (e) {
    console.error("public rate limit: database unavailable, counting in memory:", (e as Error).message);
    return memoryHit(key, limit, PUBLIC_WINDOW_MS, d.now());
  }
}

/**
 * Counts one request to a public route from a visitor who is not signed in (call it only then).
 * Returns null when it may go ahead, or the 429 response to send back.
 */
export async function limitGuest(route: PublicRoute, headers: { get(name: string): string | null }, deps: Partial<PublicLimitDeps> = {}): Promise<Response | null> {
  const result = await count(publicLimitKey(route, clientIp(headers)), PUBLIC_LIMITS[route], { ...defaultDeps, ...deps });
  return result.allowed ? null : tooManyRequests(result.retryAfterSec);
}

/** Takes one item lookup from GUEST_ITEM_UPSTREAM_BUDGET; false once it is used up for this window. */
export async function takeGuestItemUpstream(deps: Partial<PublicLimitDeps> = {}): Promise<boolean> {
  return (await count(GUEST_ITEM_UPSTREAM_KEY, GUEST_ITEM_UPSTREAM_BUDGET, { ...defaultDeps, ...deps })).allowed;
}
