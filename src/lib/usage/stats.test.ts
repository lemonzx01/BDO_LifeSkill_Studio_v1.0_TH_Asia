import { sql } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDb, resetDbCache } from "@/lib/db";
import { recordVisit } from "./record";
import { getUsageStats, SERIES_DAYS } from "./stats";
import { addDays, type TrackedPath } from "./track";

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

const TODAY = "2026-10-02";
const ago = (n: number) => addDays(TODAY, -n);
const vid = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;

/** browser n opens `path` on the day `daysAgo` before TODAY; every browser gets its own address so the cap stays out of the way */
const open = (n: number, daysAgo: number, opts: { path?: TrackedPath; member?: boolean } = {}) =>
  recordVisit({ vid: vid(n), path: opts.path ?? "/", member: opts.member ?? false, ip: `10.0.0.${n}`, day: ago(daysAgo) });

describe("getUsageStats", () => {
  it("is all zeros, with 90 empty days, before anyone is counted", async () => {
    const s = await getUsageStats(TODAY);
    expect(s).toMatchObject({
      today: TODAY,
      firstDay: null,
      visitorsToday: 0,
      visitors7d: 0,
      visitors30d: 0,
      visitorsAllTime: 0,
      new30d: 0,
      returning30d: 0,
      repeat30d: 0,
      members30d: 0,
      guests30d: 0,
      pageViews30d: 0,
      topPages: [],
      cappedDays30: [],
    });
    expect(s.daily).toHaveLength(SERIES_DAYS);
    expect(s.daily[0]).toEqual({ day: ago(89), visitors: 0, views: 0 });
    expect(s.daily[SERIES_DAYS - 1]).toEqual({ day: TODAY, visitors: 0, views: 0 });
  });

  it("lists the days within 30 on which the caps held back new visitors, newest first", async () => {
    // 11 new browsers from one address today: the 11th is held back
    for (let i = 1; i <= 11; i++) await recordVisit({ vid: vid(100 + i), path: "/", member: false, ip: "10.9.9.9", day: TODAY });
    for (let i = 1; i <= 11; i++) await recordVisit({ vid: vid(200 + i), path: "/", member: false, ip: "10.9.9.9", day: ago(3) });
    // too long ago to matter
    for (let i = 1; i <= 11; i++) await recordVisit({ vid: vid(300 + i), path: "/", member: false, ip: "10.9.9.9", day: ago(40) });
    const s = await getUsageStats(TODAY);
    expect(s.cappedDays30).toEqual([TODAY, ago(3)]);
    expect(s.visitorsToday).toBe(10);
  });

  it("counts unique visitors today, in 7 days, in 30 days and all time", async () => {
    // browser 1: today and yesterday (one person, not two)
    await open(1, 0);
    await open(1, 1, { path: "/market" });
    // browser 2: 6 days ago (inside 7 days) and 40 days ago (first seen before the 30 days)
    await open(2, 6, { member: true });
    await open(2, 40);
    // browser 3: 7 days ago (just outside 7 days)
    await open(3, 7, { path: "/recipes" });
    // browser 4: 29 days ago (the oldest day inside 30 days), as a member
    await open(4, 29, { path: "/recipes", member: true });
    // browser 5: 30 days ago only (outside 30 days)
    await open(5, 30);
    // browser 6: 100 days ago only (outside even the 90-day chart)
    await open(6, 100);
    // a report dated after `today` (another time zone's clock, a test) is not counted as today or before
    await open(7, -1);

    const s = await getUsageStats(TODAY);
    expect(s.firstDay).toBe(ago(100));
    expect(s.visitorsToday).toBe(1);
    expect(s.visitors7d).toBe(2); // 1, 2
    expect(s.visitors30d).toBe(4); // 1, 2, 3, 4
    expect(s.visitorsAllTime).toBe(7);
    // new = first seen within the 30 days (1, 3, 4); returning = seen before them (2)
    expect(s.new30d).toBe(3);
    expect(s.returning30d).toBe(1);
    // came on two or more days within the 30 days: only browser 1
    expect(s.repeat30d).toBe(1);
    // signed in on at least one day in the 30 days: 2 and 4
    expect(s.members30d).toBe(2);
    expect(s.guests30d).toBe(2);
    expect(s.new30d + s.returning30d).toBe(s.visitors30d);
    expect(s.members30d + s.guests30d).toBe(s.visitors30d);
  });

  it("sums page views over 30 days and ranks the pages", async () => {
    await open(1, 0, { path: "/recipes" });
    await open(1, 0, { path: "/recipes" });
    await open(1, 3, { path: "/recipes" });
    await open(2, 0, { path: "/market" });
    await open(2, 29, { path: "/market" });
    await open(2, 29, { path: "other" });
    await open(3, 30, { path: "/calc" }); // outside 30 days
    const s = await getUsageStats(TODAY);
    expect(s.topPages).toEqual([
      { path: "/recipes", views: 3 },
      { path: "/market", views: 2 },
      { path: "other", views: 1 },
    ]);
    expect(s.pageViews30d).toBe(6);
  });

  it("gives 90 days, oldest first, with days nobody came as 0", async () => {
    await open(1, 0);
    await open(2, 0);
    await open(2, 0, { path: "/help" });
    await open(1, 5);
    await open(3, 89);
    await open(4, 90); // one day too old for the chart
    const s = await getUsageStats(TODAY);
    expect(s.daily).toHaveLength(SERIES_DAYS);
    expect(s.daily.map((d) => d.day)).toEqual(Array.from({ length: SERIES_DAYS }, (_, i) => ago(89 - i)));
    const byDay = Object.fromEntries(s.daily.filter((d) => d.visitors || d.views).map((d) => [d.day, [d.visitors, d.views]]));
    expect(byDay).toEqual({
      [ago(89)]: [1, 1],
      [ago(5)]: [1, 1],
      [TODAY]: [2, 3],
    });
  });

  it("counts a member and a guest day of one browser in 30 days as one member", async () => {
    await open(1, 3, { member: true });
    await open(1, 1, { member: false });
    const s = await getUsageStats(TODAY);
    expect(s.visitors30d).toBe(1);
    expect(s.members30d).toBe(1);
    expect(s.guests30d).toBe(0);
    expect(s.repeat30d).toBe(1);
  });
});
