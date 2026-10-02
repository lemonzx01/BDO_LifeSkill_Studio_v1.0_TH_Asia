import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { hit, type HitResult } from "@/lib/auth/ratelimit";
import { getDb, resetDbCache } from "@/lib/db";
import { loginAttempts } from "@/lib/db/schema";
import {
  GUEST_ITEM_UPSTREAM_BUDGET,
  GUEST_ITEM_UPSTREAM_KEY,
  limitGuest,
  memoryHit,
  PUBLIC_LIMITS,
  PUBLIC_WINDOW_MS,
  publicLimitKey,
  takeGuestItemUpstream,
  tooManyRequests,
} from "./public-rate-limit";

const from = (ip: string, extra: Record<string, string> = {}) => new Headers({ "x-real-ip": ip, ...extra });

// NODE_ENV=test -> getDb() uses an in-memory PGlite instance
beforeAll(() => {
  delete process.env.DATABASE_URL;
  resetDbCache();
});

describe("public API rate limit (database counters)", () => {
  it("lets `limit` requests through per address, then answers 429 with Retry-After", async () => {
    const limit = PUBLIC_LIMITS.data;
    for (let i = 0; i < limit; i++) expect(await limitGuest("data", from("198.51.100.7"))).toBeNull();
    const res = await limitGuest("data", from("198.51.100.7"));
    expect(res?.status).toBe(429);
    const wait = Number(res!.headers.get("Retry-After"));
    expect(wait).toBeGreaterThan(14 * 60);
    expect(wait).toBeLessThanOrEqual(15 * 60);
    expect(res!.headers.get("Cache-Control")).toBe("no-store");
    expect(await res!.json()).toEqual({ error: "too many requests", retryAfterSec: wait });

    // counted in the shared table under the route's own key
    const db = await getDb();
    const [row] = await db.select().from(loginAttempts).where(eq(loginAttempts.key, publicLimitKey("data", "198.51.100.7")));
    expect(row.count).toBe(limit + 1);
  });

  it("counts each address and each route separately", async () => {
    for (let i = 0; i < PUBLIC_LIMITS.data; i++) await limitGuest("data", from("198.51.100.8"));
    expect((await limitGuest("data", from("198.51.100.8")))?.status).toBe(429);
    expect(await limitGuest("data", from("198.51.100.9"))).toBeNull();
    expect(await limitGuest("prices", from("198.51.100.8"))).toBeNull();
  });

  it("counts one IPv6 /64 as one address (a fresh address per request does not help)", async () => {
    const results: (Response | null)[] = [];
    for (let i = 0; i <= PUBLIC_LIMITS.data; i++) results.push(await limitGuest("data", from(`2001:db8:1:2::${(i + 1).toString(16)}`)));
    expect(results.slice(0, -1).every((r) => r === null)).toBe(true);
    expect(results.at(-1)?.status).toBe(429);
  });

  it("uses the limits and window it advertises for every route", async () => {
    const seen: [string, number, number][] = [];
    const fake = async (key: string, limit: number, windowMs: number): Promise<HitResult> => {
      seen.push([key, limit, windowMs]);
      return { allowed: true, count: 1, retryAfterSec: 900 };
    };
    for (const route of ["data", "prices", "search", "item"] as const) await limitGuest(route, from("203.0.113.1"), { hit: fake });
    expect(seen).toEqual([
      ["pub:data:203.0.113.1", 120, PUBLIC_WINDOW_MS],
      ["pub:prices:203.0.113.1", 600, PUBLIC_WINDOW_MS],
      ["pub:search:203.0.113.1", 300, PUBLIC_WINDOW_MS],
      ["pub:item:203.0.113.1", 120, PUBLIC_WINDOW_MS],
    ]);
    expect(PUBLIC_WINDOW_MS).toBe(15 * 60 * 1000);
  });

  it("takes the address from x-real-ip, else the first x-forwarded-for entry", async () => {
    const keys: string[] = [];
    const fake = async (key: string): Promise<HitResult> => {
      keys.push(key);
      return { allowed: true, count: 1, retryAfterSec: 1 };
    };
    await limitGuest("search", new Headers({ "x-forwarded-for": "192.0.2.5, 10.0.0.1" }), { hit: fake });
    await limitGuest("search", new Headers({ "x-real-ip": "192.0.2.6", "x-forwarded-for": "192.0.2.99" }), { hit: fake });
    expect(keys).toEqual(["pub:search:192.0.2.5", "pub:search:192.0.2.6"]);
  });

  it("still limits, per server instance, while the database cannot count", async () => {
    const down = async (): Promise<HitResult> => {
      throw new Error("connection refused");
    };
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    let now = 1_000_000;
    const deps = { hit: down, now: () => now };
    for (let i = 0; i < PUBLIC_LIMITS.item; i++) expect(await limitGuest("item", from("192.0.2.77"), deps)).toBeNull();
    const res = await limitGuest("item", from("192.0.2.77"), deps);
    expect(res?.status).toBe(429);
    expect(Number(res!.headers.get("Retry-After"))).toBe(15 * 60);
    // a new window once the old one is over
    now += PUBLIC_WINDOW_MS;
    expect(await limitGuest("item", from("192.0.2.77"), deps)).toBeNull();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("works with the real hit() for a burst of parallel requests", async () => {
    const results = await Promise.all(Array.from({ length: PUBLIC_LIMITS.data + 5 }, () => limitGuest("data", from("198.51.100.200"), { hit })));
    expect(results.filter((r) => r === null)).toHaveLength(PUBLIC_LIMITS.data);
    expect(results.filter((r) => r?.status === 429)).toHaveLength(5);
  });
});

describe("guest item lookups sent upstream (one budget for all addresses)", () => {
  it("allows GUEST_ITEM_UPSTREAM_BUDGET per window, whoever asks", async () => {
    const seen: [string, number][] = [];
    let used = 0;
    const fake = async (key: string, limit: number): Promise<HitResult> => {
      seen.push([key, limit]);
      used += 1;
      return { allowed: used <= limit, count: used, retryAfterSec: 900 };
    };
    const results: boolean[] = [];
    for (let i = 0; i <= GUEST_ITEM_UPSTREAM_BUDGET; i++) results.push(await takeGuestItemUpstream({ hit: fake }));
    expect(results.slice(0, -1).every(Boolean)).toBe(true);
    expect(results.at(-1)).toBe(false);
    expect(new Set(seen.map(([k, l]) => `${k}/${l}`))).toEqual(new Set([`${GUEST_ITEM_UPSTREAM_KEY}/${GUEST_ITEM_UPSTREAM_BUDGET}`]));
  });

  it("counts in the shared table with the real hit()", async () => {
    expect(await takeGuestItemUpstream()).toBe(true);
    const db = await getDb();
    const [row] = await db.select().from(loginAttempts).where(eq(loginAttempts.key, GUEST_ITEM_UPSTREAM_KEY));
    expect(row.count).toBe(1);
  });
});

describe("memoryHit and tooManyRequests", () => {
  it("counts within a window and starts again after it", () => {
    expect(memoryHit("k", 2, 1000, 0)).toEqual({ allowed: true, count: 1, retryAfterSec: 1 });
    expect(memoryHit("k", 2, 1000, 10).allowed).toBe(true);
    expect(memoryHit("k", 2, 1000, 20)).toMatchObject({ allowed: false, count: 3 });
    expect(memoryHit("k", 2, 1000, 1000)).toMatchObject({ allowed: true, count: 1 });
  });

  it("never asks to wait less than a second", () => {
    expect(tooManyRequests(0).headers.get("Retry-After")).toBe("1");
    expect(tooManyRequests(12.2).headers.get("Retry-After")).toBe("13");
  });
});
