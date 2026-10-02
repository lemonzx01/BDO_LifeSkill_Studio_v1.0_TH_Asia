import { sql } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDb, resetDbCache } from "@/lib/db";
import { loginAttempts, usageCappedDays, usagePageViews, usageVisitorDays, usageVisitors } from "@/lib/db/schema";
import { allowTrack, hashVisitor, recordVisit, type Visit } from "./record";
import { network48, NEW_VISITORS_PER_ADDRESS_PER_DAY, NEW_VISITORS_PER_DAY, NEW_VISITORS_PER_NETWORK_PER_DAY, TRACK_LIMIT } from "./track";

// NODE_ENV=test -> getDb() uses an in-memory PGlite instance
beforeAll(() => {
  delete process.env.DATABASE_URL;
  resetDbCache();
});

beforeEach(async () => {
  const db = await getDb();
  await db.execute(sql`DELETE FROM usage_visitor_days`);
  await db.execute(sql`DELETE FROM usage_visitors`);
  await db.execute(sql`DELETE FROM usage_page_views`);
  await db.execute(sql`DELETE FROM usage_capped_days`);
  await db.execute(sql`DELETE FROM login_attempts`);
});

/** a different valid version-4 UUID for every n */
const vid = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;

const visit = (over: Partial<Visit> = {}): Visit => ({ vid: vid(1), path: "/", member: false, ip: "203.0.113.7", day: "2026-10-02", ...over });

async function tables() {
  const db = await getDb();
  return {
    days: await db.select().from(usageVisitorDays).orderBy(usageVisitorDays.day, usageVisitorDays.visitor),
    visitors: await db.select().from(usageVisitors),
    views: await db.select().from(usagePageViews).orderBy(usagePageViews.day, usagePageViews.path),
    capped: await db.select().from(usageCappedDays).orderBy(usageCappedDays.day),
  };
}

describe("recordVisit", () => {
  it("counts a browser once a day and every page view", async () => {
    expect(await recordVisit(visit())).toBe("new");
    expect(await recordVisit(visit({ path: "/market" }))).toBe("known");
    expect(await recordVisit(visit({ path: "/market" }))).toBe("known");
    const t = await tables();
    expect(t.days).toEqual([{ day: "2026-10-02", visitor: hashVisitor(vid(1)), member: false }]);
    expect(t.visitors).toEqual([{ visitor: hashVisitor(vid(1)), firstDay: "2026-10-02", lastDay: "2026-10-02", days: 1 }]);
    expect(t.views).toEqual([
      { day: "2026-10-02", path: "/", views: 1 },
      { day: "2026-10-02", path: "/market", views: 2 },
    ]);
  });

  it("stores only the sha256 of the id: never the id, the address or a user", async () => {
    const raw = "3F2B8C1E-9A4D-4E6F-8B2A-1C3D5E7F9A0B";
    await recordVisit(visit({ vid: raw, ip: "198.51.100.23", member: true }));
    const t = await tables();
    expect(t.days[0].visitor).toBe(hashVisitor(raw.toLowerCase()));
    expect(t.days[0].visitor).toMatch(/^[0-9a-f]{64}$/);
    const dump = JSON.stringify(t);
    expect(dump).not.toContain(raw.toLowerCase());
    expect(dump).not.toContain(raw);
    expect(dump).not.toContain("198.51.100.23");
    // the same id in another case is the same browser
    expect(await recordVisit(visit({ vid: raw.toLowerCase(), ip: "198.51.100.23" }))).toBe("known");
  });

  it("counts a browser on separate days and remembers its first and last day", async () => {
    await recordVisit(visit({ day: "2026-09-30" }));
    await recordVisit(visit({ day: "2026-10-02" }));
    await recordVisit(visit({ day: "2026-10-02" }));
    // a late report for an earlier day does not move the last day back
    await recordVisit(visit({ day: "2026-10-01" }));
    const t = await tables();
    expect(t.days.map((r) => r.day)).toEqual(["2026-09-30", "2026-10-01", "2026-10-02"]);
    expect(t.visitors).toEqual([{ visitor: hashVisitor(vid(1)), firstDay: "2026-09-30", lastDay: "2026-10-02", days: 3 }]);
  });

  it("makes a browser a member for the day once any of its reports that day is signed in", async () => {
    await recordVisit(visit());
    expect((await tables()).days[0].member).toBe(false);
    await recordVisit(visit({ member: true }));
    expect((await tables()).days[0].member).toBe(true);
    // signing out later the same day does not take it back
    await recordVisit(visit({ member: false }));
    expect((await tables()).days[0].member).toBe(true);
    // the next day starts as a guest again
    await recordVisit(visit({ day: "2026-10-03" }));
    const days = (await tables()).days;
    expect(days.map((r) => [r.day, r.member])).toEqual([
      ["2026-10-02", true],
      ["2026-10-03", false],
    ]);
  });

  it("lets one address add at most 10 new visitors a day, while their page views still count", async () => {
    const results = [];
    for (let i = 1; i <= 15; i++) results.push(await recordVisit(visit({ vid: vid(i) })));
    expect(results.filter((r) => r === "new")).toHaveLength(NEW_VISITORS_PER_ADDRESS_PER_DAY);
    expect(results.slice(NEW_VISITORS_PER_ADDRESS_PER_DAY).every((r) => r === "capped")).toBe(true);
    let t = await tables();
    expect(t.days).toHaveLength(10);
    expect(t.visitors).toHaveLength(10);
    expect(t.views).toEqual([{ day: "2026-10-02", path: "/", views: 15 }]);

    // visitors already counted keep counting as known, and a capped one is still not counted
    expect(await recordVisit(visit({ vid: vid(3) }))).toBe("known");
    expect(await recordVisit(visit({ vid: vid(12) }))).toBe("capped");
    // another address still has its own 10, and the next day the first address starts over
    expect(await recordVisit(visit({ vid: vid(12), ip: "198.51.100.1" }))).toBe("new");
    expect(await recordVisit(visit({ vid: vid(13), day: "2026-10-03" }))).toBe("new");
    t = await tables();
    expect(t.days).toHaveLength(12);
    // the day is marked incomplete: 5 held back, then vid(12) once more
    expect(t.capped).toEqual([{ day: "2026-10-02", reports: 6 }]);
  });

  it("lets one IPv6 /48 add at most 50 new visitors a day, however many /64s it uses", async () => {
    const perNet = NEW_VISITORS_PER_NETWORK_PER_DAY / NEW_VISITORS_PER_ADDRESS_PER_DAY;
    const results = [];
    let n = 0;
    // every /64 of the /48 2001:db8:77::/48 fills its own 10, until the /48 is full
    for (let net = 0; net <= perNet; net++) {
      for (let i = 0; i < NEW_VISITORS_PER_ADDRESS_PER_DAY; i++) results.push(await recordVisit(visit({ vid: vid(++n), ip: `2001:db8:77:${net.toString(16)}::/64` })));
    }
    expect(results.filter((r) => r === "new")).toHaveLength(NEW_VISITORS_PER_NETWORK_PER_DAY);
    expect(results.slice(NEW_VISITORS_PER_NETWORK_PER_DAY).every((r) => r === "capped")).toBe(true);
    // another /48 is not affected
    expect(await recordVisit(visit({ vid: vid(++n), ip: "2001:db8:78:1::/64" }))).toBe("new");
    expect((await tables()).capped).toEqual([{ day: "2026-10-02", reports: NEW_VISITORS_PER_ADDRESS_PER_DAY }]);
  });

  it("stops adding new visitors once the whole site reached its daily ceiling", async () => {
    const db = await getDb();
    // as if NEW_VISITORS_PER_DAY browsers had been counted today already
    await db.insert(loginAttempts).values({ key: "trackvid:all:2026-10-02", count: NEW_VISITORS_PER_DAY, resetAt: sql`now() + interval '1 day'` });
    expect(await recordVisit(visit({ vid: vid(1), ip: "192.0.2.1" }))).toBe("capped");
    expect(await recordVisit(visit({ vid: vid(2), ip: "192.0.2.2" }))).toBe("capped");
    // the next day has a ceiling of its own
    expect(await recordVisit(visit({ vid: vid(1), ip: "192.0.2.1", day: "2026-10-03" }))).toBe("new");
    const t = await tables();
    expect(t.capped).toEqual([{ day: "2026-10-02", reports: 2 }]);
    expect(t.views).toHaveLength(2);
  });

  it("counts a burst of parallel first reports from one browser once", async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => recordVisit(visit({ member: true }))));
    expect(results.filter((r) => r === "new")).toHaveLength(1);
    const t = await tables();
    expect(t.days).toEqual([{ day: "2026-10-02", visitor: hashVisitor(vid(1)), member: true }]);
    expect(t.visitors[0].days).toBe(1);
    expect(t.views[0].views).toBe(5);
  });
});

describe("network48", () => {
  it("gives an IPv6 /64's /48, and nothing for IPv4", () => {
    expect(network48("2001:db8:1:2::/64")).toBe("2001:db8:1::/48");
    expect(network48("203.0.113.7")).toBeNull();
    expect(network48("local")).toBeNull();
  });
});

describe("allowTrack", () => {
  it("allows 120 reports per address per 15 minutes", async () => {
    let allowed = 0;
    for (let i = 0; i < TRACK_LIMIT + 5; i++) if (await allowTrack("192.0.2.50")) allowed++;
    expect(allowed).toBe(TRACK_LIMIT);
    expect(await allowTrack("192.0.2.51")).toBe(true);
  });
});
