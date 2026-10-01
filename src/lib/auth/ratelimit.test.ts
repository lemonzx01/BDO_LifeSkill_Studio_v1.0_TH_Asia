import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { getDb, resetDbCache } from "@/lib/db";
import { loginAttempts } from "@/lib/db/schema";
import {
  cleanupAttempts,
  clear,
  clientIp,
  gateLogin,
  hit,
  loginPairKey,
  recordLoginSuccess,
  throttleAddress,
  THROTTLE_LIMITS,
  THROTTLE_WINDOW_MS,
  waitMinutes,
} from "./ratelimit";

/** seconds to wait, or null when the attempt may go ahead */
const gate = async (username: string, ip: string) => (await gateLogin(username, ip)).wait;

/** one login with the right password: gated, then recorded as a success */
async function goodLogin(username: string, ip: string): Promise<number | null> {
  const g = await gateLogin(username, ip);
  if (g.wait === null) await recordLoginSuccess(username, ip, g.counted);
  return g.wait;
}

// NODE_ENV=test -> getDb() uses an in-memory PGlite instance
beforeAll(() => {
  delete process.env.DATABASE_URL;
  resetDbCache();
});

async function rowFor(key: string) {
  const db = await getDb();
  const [row] = await db.select().from(loginAttempts).where(eq(loginAttempts.key, key)).limit(1);
  return row;
}

/** pretends the window of `key` ended `agoSql` ago */
async function expire(key: string, agoSql = "1 second") {
  const db = await getDb();
  await db
    .update(loginAttempts)
    .set({ resetAt: sql`now() - ${agoSql}::interval` })
    .where(eq(loginAttempts.key, key));
}

describe("database login throttle", () => {
  it("lets exactly `limit` of a burst of parallel attempts through", async () => {
    const results = await Promise.all(Array.from({ length: 15 }, () => hit("burst", 10, THROTTLE_WINDOW_MS)));
    expect(results.filter((r) => r.allowed)).toHaveLength(10);
    expect(results.map((r) => r.count).sort((a, b) => a - b)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
    const blocked = results.find((r) => !r.allowed)!;
    expect(blocked.retryAfterSec).toBeGreaterThan(14 * 60);
    expect(blocked.retryAfterSec).toBeLessThanOrEqual(15 * 60);
    expect((await rowFor("burst"))?.count).toBe(15);
  });

  it("starts a new window once the old one has passed", async () => {
    for (let i = 0; i < 3; i++) await hit("window", 2, 60_000);
    expect((await hit("window", 2, 60_000)).allowed).toBe(false);
    await expire("window");
    const fresh = await hit("window", 2, 60_000);
    expect(fresh).toMatchObject({ allowed: true, count: 1 });
    expect(fresh.retryAfterSec).toBeGreaterThan(55);
    expect(fresh.retryAfterSec).toBeLessThanOrEqual(60);
  });

  it("keeps the window end fixed while it runs", async () => {
    const first = await hit("fixed", 5, 60_000);
    const before = (await rowFor("fixed"))!.resetAt.getTime();
    await hit("fixed", 5, 60_000);
    expect((await rowFor("fixed"))!.resetAt.getTime()).toBe(before);
    expect(first.count).toBe(1);
  });

  it("clear() forgets a key", async () => {
    for (let i = 0; i < 4; i++) await hit("clearme", 3, 60_000);
    expect((await hit("clearme", 3, 60_000)).allowed).toBe(false);
    await clear("clearme");
    expect(await rowFor("clearme")).toBeUndefined();
    expect(await hit("clearme", 3, 60_000)).toMatchObject({ allowed: true, count: 1 });
  });

  it("cleanup drops only counters that ended more than a day ago", async () => {
    await hit("stale", 3, 60_000);
    await hit("recent", 3, 60_000);
    await hit("live", 3, 60_000);
    await expire("stale", "25 hours");
    await expire("recent", "1 hour");
    await cleanupAttempts();
    expect(await rowFor("stale")).toBeUndefined();
    expect(await rowFor("recent")).toBeDefined();
    expect(await rowFor("live")).toBeDefined();
  });

  it("gates logins per username+address, per address and per username", async () => {
    // 10 tries for one username from one address, then that pair waits
    for (let i = 0; i < THROTTLE_LIMITS.pair; i++) expect(await gate("owner", "1.1.1.1")).toBeNull();
    const wait = await gate("owner", "1.1.1.1");
    expect(wait).toBeGreaterThan(0);
    expect(waitMinutes(wait!)).toBe(15);
    // hammering on after the refusal does not eat into the username's cap
    for (let i = 0; i < 60; i++) expect(await gate("owner", "1.1.1.1")).not.toBeNull();
    expect((await rowFor("user:owner"))?.count).toBe(THROTTLE_LIMITS.pair);
    // so the real owner on another address is not locked out by that stranger
    expect(await gate("owner", "2.2.2.2")).toBeNull();
    // once the pair is cleared the address may try again, and every try still counts
    await clear(loginPairKey("owner", "1.1.1.1"));
    expect(await gate("owner", "1.1.1.1")).toBeNull();
    expect((await rowFor("user:owner"))?.count).toBe(12);
    expect((await rowFor("ip:1.1.1.1"))?.count).toBe(11);
  });

  it("caps one address across many usernames", async () => {
    for (let i = 0; i < THROTTLE_LIMITS.ip; i++) expect(await gate(`spray${i}`, "3.3.3.3")).toBeNull();
    expect(await gate("spray-next", "3.3.3.3")).not.toBeNull();
    expect(await rowFor("user:spray-next")).toBeUndefined(); // refused at the address, not counted further
    expect(await gate("spray-next", "4.4.4.4")).toBeNull();
  });

  it("caps one username across many addresses", async () => {
    for (let i = 0; i < THROTTLE_LIMITS.user; i++) expect(await gate("target", `10.0.0.${i}`)).toBeNull();
    expect(await gate("target", "10.0.1.1")).not.toBeNull();
    expect(await gate("someone-else", "10.0.1.1")).toBeNull();
  });

  it("lets an address that signed in before past a username cap that strangers filled", async () => {
    // the owner signed in from home earlier
    expect(await goodLogin("boss", "8.8.8.8")).toBeNull();
    // five strangers use up 10 tries each: the username's cap of 50 is full
    for (let s = 0; s < 5; s++) {
      for (let i = 0; i < THROTTLE_LIMITS.pair; i++) expect(await gate("boss", `20.0.0.${s}`)).toBeNull();
    }
    expect((await rowFor("user:boss"))?.count).toBe(THROTTLE_LIMITS.user);
    expect(await gate("boss", "20.0.0.99")).not.toBeNull(); // a new address is refused
    // the owner's usual address still gets in, and is not counted towards the username
    expect(await goodLogin("boss", "8.8.8.8")).toBeNull();
    expect((await rowFor("user:boss"))?.count).toBe(THROTTLE_LIMITS.user + 1); // only the refused try above
    // the address's own limits still apply to it
    for (let i = 0; i < THROTTLE_LIMITS.pair; i++) expect(await gate("boss", "8.8.8.8")).toBeNull();
    expect(await gate("boss", "8.8.8.8")).not.toBeNull();
  });

  it("a known address is per account and runs out", async () => {
    expect(await goodLogin("alice", "9.9.9.9")).toBeNull();
    expect(await rowFor("known:alice|9.9.9.9")).toBeDefined();
    expect(await rowFor("known:bob|9.9.9.9")).toBeUndefined();
    await expire("known:alice|9.9.9.9");
    await gate("alice", "9.9.9.9");
    expect((await rowFor("user:alice"))?.count).toBe(1); // counted again once the memory ran out
  });

  it("does not use up the counters with correct passwords", async () => {
    // members sharing one address (internet cafe, phone network) sign in again and again
    for (let i = 0; i < THROTTLE_LIMITS.ip + 5; i++) expect(await goodLogin(`member${i % 3}`, "30.0.0.1")).toBeNull();
    expect((await rowFor("ip:30.0.0.1"))?.count).toBe(0);
    expect((await rowFor("user:member0"))?.count).toBe(0);
    expect(await rowFor(loginPairKey("member0", "30.0.0.1"))).toBeUndefined();
    // wrong passwords from that address still count
    await gate("member0", "30.0.0.1");
    expect((await rowFor("ip:30.0.0.1"))?.count).toBe(1);
  });

  it("gives back only the counters this attempt was added to", async () => {
    // refused at the address step: the username step never ran, so nothing to give back there
    for (let i = 0; i < THROTTLE_LIMITS.ip; i++) await gate(`x${i}`, "40.0.0.1");
    const refused = await gateLogin("carol", "40.0.0.1");
    expect(refused.wait).not.toBeNull();
    expect(refused.counted).toEqual([loginPairKey("carol", "40.0.0.1"), "ip:40.0.0.1"]);
    // an attempt from a fresh address counts towards all three
    const ok = await gateLogin("carol", "40.0.0.2");
    expect(ok).toEqual({ wait: null, counted: [loginPairKey("carol", "40.0.0.2"), "ip:40.0.0.2", "user:carol"] });
  });

  it("counts one IPv6 network as one address", async () => {
    const net = "2001:db8:aaaa:1";
    for (let i = 0; i < THROTTLE_LIMITS.pair; i++) {
      expect(await gate("dave", throttleAddress(`${net}::${(i + 1).toString(16)}`))).toBeNull();
    }
    // a fresh address from the same /64 is the same address to the throttle
    expect(await gate("dave", throttleAddress(`${net}:ffff:ffff:ffff:fff0`))).not.toBeNull();
    // the next /64 over is not
    expect(await gate("dave", throttleAddress("2001:db8:aaaa:2::1"))).toBeNull();
  });

  it("reads the client address from Vercel's headers", () => {
    const h = (o: Record<string, string>) => new Headers(o);
    expect(clientIp(h({ "x-real-ip": "5.5.5.5", "x-forwarded-for": "6.6.6.6, 7.7.7.7" }))).toBe("5.5.5.5");
    expect(clientIp(h({ "x-forwarded-for": " 6.6.6.6 , 7.7.7.7" }))).toBe("6.6.6.6");
    expect(clientIp(h({}))).toBe("local");
    expect(clientIp(h({ "x-real-ip": "x".repeat(500) }))).toHaveLength(64);
    expect(clientIp(h({ "x-real-ip": "2001:DB8:1:2:3:4:5:6" }))).toBe("2001:db8:1:2::/64");
  });

  it("groups IPv6 addresses by their /64 network", () => {
    expect(throttleAddress("2001:db8:1:2:aaaa:bbbb:cccc:dddd")).toBe("2001:db8:1:2::/64");
    expect(throttleAddress("2001:0db8:0001:0002::1")).toBe("2001:db8:1:2::/64");
    expect(throttleAddress("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(throttleAddress("[2001:db8:1:2::9]")).toBe("2001:db8:1:2::/64");
    expect(throttleAddress("fe80::1%eth0")).toBe("fe80:0:0:0::/64");
    expect(throttleAddress("::1")).toBe("0:0:0:0::/64");
    // IPv4 written as IPv6 counts as the IPv4 address
    expect(throttleAddress("::ffff:192.0.2.7")).toBe("192.0.2.7");
    expect(throttleAddress("::FFFF:c000:207")).toBe("192.0.2.7");
    // IPv4 and anything unreadable stay as they are
    expect(throttleAddress("192.0.2.7")).toBe("192.0.2.7");
    expect(throttleAddress("1:2:3")).toBe("1:2:3");
    expect(throttleAddress("1::2::3")).toBe("1::2::3");
    expect(throttleAddress("1:2:3:4:5:6:7:8:9")).toBe("1:2:3:4:5:6:7:8:9");
    expect(throttleAddress("::ffff:300.1.1.1")).toBe("::ffff:300.1.1.1");
    expect(throttleAddress("gggg::1")).toBe("gggg::1");
    expect(throttleAddress(`${"1:".repeat(40)}1`)).toHaveLength(64);
  });

  it("rounds the wait up to whole minutes", () => {
    expect(waitMinutes(1)).toBe(1);
    expect(waitMinutes(60)).toBe(1);
    expect(waitMinutes(61)).toBe(2);
    expect(waitMinutes(900)).toBe(15);
  });
});
