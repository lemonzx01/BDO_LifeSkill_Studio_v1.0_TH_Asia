import { and, eq, gt, inArray, lt, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { loginAttempts } from "@/lib/db/schema";

/**
 * Login throttle kept in the database, so every serverless instance sees the same
 * counters. Counting and checking are one atomic upsert: the increment is the gate,
 * so a burst of parallel requests cannot all slip through before the count lands.
 */
export const THROTTLE_WINDOW_MS = 15 * 60 * 1000;

/** attempts allowed per key within THROTTLE_WINDOW_MS */
export const THROTTLE_LIMITS = {
  /** one username from one address */
  pair: 10,
  /** one address, any username */
  ip: 30,
  /**
   * one username from anywhere, so a botnet cannot guess forever. Addresses that recently signed in to that
   * account skip it (see KNOWN_ADDRESS_MS), so strangers filling it cannot lock the owner out of a usual device.
   */
  user: 50,
  /** current-password re-check on the account page */
  reauth: 10,
} as const;

export interface HitResult {
  allowed: boolean;
  /** attempts counted in the current window, this one included */
  count: number;
  /** seconds until the window for this key resets */
  retryAfterSec: number;
}

/** Counts one attempt for `key` and says whether it is still within `limit` for the current window. */
export async function hit(key: string, limit: number, windowMs: number): Promise<HitResult> {
  const db = await getDb();
  const t = loginAttempts;
  const until = sql`now() + make_interval(secs => ${windowMs / 1000}::float8)`;
  const expired = sql`${t.resetAt} < now()`;
  const [row] = await db
    .insert(t)
    .values({ key, count: 1, resetAt: until })
    .onConflictDoUpdate({
      target: t.key,
      set: {
        count: sql`CASE WHEN ${expired} THEN 1 ELSE ${t.count} + 1 END`,
        resetAt: sql`CASE WHEN ${expired} THEN ${until} ELSE ${t.resetAt} END`,
      },
    })
    .returning({
      count: t.count,
      // computed by the database so app/database clock skew does not matter
      retryAfterSec: sql<number>`GREATEST(1, CEIL(EXTRACT(EPOCH FROM (${t.resetAt} - now()))))::int`,
    });
  const count = Number(row.count);
  return { allowed: count <= limit, count, retryAfterSec: Number(row.retryAfterSec) };
}

/** Forgets the attempts counted for `key`. */
export async function clear(key: string) {
  const db = await getDb();
  await db.delete(loginAttempts).where(eq(loginAttempts.key, key));
}

/** Drops counters whose window ended more than a day ago, so the table stays small. */
export async function cleanupAttempts() {
  const db = await getDb();
  await db.delete(loginAttempts).where(lt(loginAttempts.resetAt, sql`now() - interval '1 day'`));
}

/** Whole minutes to show in a "please wait" message (at least 1). */
export function waitMinutes(retryAfterSec: number): number {
  return Math.max(1, Math.ceil(retryAfterSec / 60));
}

/**
 * Client address as set by Vercel's edge (x-real-ip, else the first x-forwarded-for entry), in the form
 * the throttle counts by (see throttleAddress). Off Vercel these headers can be forged; the per-user cap
 * still bounds guessing then.
 */
export function clientIp(h: { get(name: string): string | null }): string {
  const real = h.get("x-real-ip")?.trim();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return throttleAddress(real || forwarded || "local");
}

/**
 * The address the throttle counts by. IPv4 stays as it is. IPv6 is cut to its /64 network, because one
 * home or phone line usually gets a whole /64 and could otherwise pick a fresh address for every try.
 * An IPv4 address written as IPv6 (::ffff:1.2.3.4) counts as that IPv4 address. Anything unreadable
 * is used as it is, capped at 64 characters.
 */
export function throttleAddress(raw: string): string {
  const a = raw.trim().toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  if (!a.includes(":")) return a.slice(0, 64);
  const g = ipv6Groups(a);
  if (!g) return a.slice(0, 64);
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) {
    return [g[6] >> 8, g[6] & 255, g[7] >> 8, g[7] & 255].join(".");
  }
  return `${g
    .slice(0, 4)
    .map((x) => x.toString(16))
    .join(":")}::/64`;
}

/** The eight 16-bit groups of an IPv6 address, or null when it is not one. */
function ipv6Groups(addr: string): number[] | null {
  let s = addr;
  // dotted IPv4 in the last 32 bits, e.g. ::ffff:192.0.2.1
  const v4 = s.match(/^(.*:)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const b = v4.slice(2, 6).map(Number);
    if (b.some((x) => x > 255)) return null;
    s = `${v4[1]}${((b[0] << 8) | b[1]).toString(16)}:${((b[2] << 8) | b[3]).toString(16)}`;
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const split = (part: string) => (part === "" ? [] : part.split(":"));
  const head = split(halves[0]);
  const tail = halves.length === 2 ? split(halves[1]) : [];
  const given = head.length + tail.length;
  if (halves.length === 2 ? given > 7 : given !== 8) return null;
  const parts = [...head, ...Array<string>(8 - given).fill("0"), ...tail];
  if (!parts.every((p) => /^[0-9a-f]{1,4}$/.test(p))) return null;
  return parts.map((p) => parseInt(p, 16));
}

/** How long an address that signed in to an account skips that account's overall cap. */
export const KNOWN_ADDRESS_MS = 30 * 24 * 60 * 60 * 1000;

export const loginPairKey = (username: string, ip: string) => `pair:${username}|${ip}`;
const addressKey = (ip: string) => `ip:${ip}`;
const userKey = (username: string) => `user:${username}`;
const knownKey = (username: string, ip: string) => `known:${username}|${ip}`;

/** True when this address signed in to this account within KNOWN_ADDRESS_MS. */
async function isKnownAddress(username: string, ip: string): Promise<boolean> {
  const db = await getDb();
  const [row] = await db
    .select({ key: loginAttempts.key })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.key, knownKey(username, ip)), gt(loginAttempts.resetAt, sql`now()`)))
    .limit(1);
  return Boolean(row);
}

export interface LoginGate {
  /** seconds to wait when the attempt is refused, null when it may go ahead */
  wait: number | null;
  /** counter keys this attempt was added to (given back by recordLoginSuccess) */
  counted: string[];
}

/**
 * Counts one login attempt against the username+address pair, then the address, then the username.
 * Stops at the first refusal, so attempts an address keeps sending after its own limit do not count
 * towards the username's cap: one address adds at most 10 to it. The username step is skipped for an
 * address that signed in to that account recently, so strangers who fill the username's cap from many
 * addresses still cannot lock the owner out of a device they use.
 */
export async function gateLogin(username: string, ip: string): Promise<LoginGate> {
  const counted: string[] = [];
  const steps: [string, number][] = [
    [loginPairKey(username, ip), THROTTLE_LIMITS.pair],
    [addressKey(ip), THROTTLE_LIMITS.ip],
  ];
  if (!(await isKnownAddress(username, ip))) steps.push([userKey(username), THROTTLE_LIMITS.user]);
  for (const [key, limit] of steps) {
    const r = await hit(key, limit, THROTTLE_WINDOW_MS);
    counted.push(key);
    if (!r.allowed) return { wait: r.retryAfterSec, counted };
  }
  return { wait: null, counted };
}

/**
 * After a correct password: forgets the pair's failures, takes this attempt back off the address and
 * username counters (only wrong passwords should use them up, so members sharing one address are not
 * made to wait), and remembers the address for this account for KNOWN_ADDRESS_MS.
 */
export async function recordLoginSuccess(username: string, ip: string, counted: readonly string[]): Promise<void> {
  const db = await getDb();
  const pair = loginPairKey(username, ip);
  await clear(pair);
  const giveBack = counted.filter((k) => k !== pair);
  if (giveBack.length) {
    await db
      .update(loginAttempts)
      .set({ count: sql`GREATEST(${loginAttempts.count} - 1, 0)` })
      .where(and(inArray(loginAttempts.key, giveBack), gt(loginAttempts.resetAt, sql`now()`)));
  }
  const until = sql`now() + make_interval(secs => ${KNOWN_ADDRESS_MS / 1000}::float8)`;
  await db
    .insert(loginAttempts)
    .values({ key: knownKey(username, ip), count: 0, resetAt: until })
    .onConflictDoUpdate({ target: loginAttempts.key, set: { resetAt: until } });
}

/** Counts one current-password re-check for an account; returns seconds to wait when over the limit, else null. */
export async function gateReauth(userId: number): Promise<number | null> {
  const r = await hit(`reauth:${userId}`, THROTTLE_LIMITS.reauth, THROTTLE_WINDOW_MS);
  return r.allowed ? null : r.retryAfterSec;
}

export const clearReauth = (userId: number) => clear(`reauth:${userId}`);
