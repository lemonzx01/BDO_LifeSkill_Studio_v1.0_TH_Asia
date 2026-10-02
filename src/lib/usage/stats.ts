import { and, between, desc, eq, gt, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { usageCappedDays, usagePageViews, usageVisitorDays, usageVisitors } from "@/lib/db/schema";
import { addDays, normalizePath, type TrackedPath } from "./track";

export interface DailyUsage {
  /** YYYY-MM-DD, Asia/Bangkok */
  day: string;
  /** browsers counted that day */
  visitors: number;
  /** pages opened that day */
  views: number;
}

export interface UsageStats {
  /** the day the numbers run up to (YYYY-MM-DD, Asia/Bangkok) */
  today: string;
  /** the first day anyone was counted, null before then */
  firstDay: string | null;
  visitorsToday: number;
  /** the last 7 days, today included */
  visitors7d: number;
  /** the last 30 days, today included */
  visitors30d: number;
  visitorsAllTime: number;
  /** of visitors30d: first counted within the 30 days */
  new30d: number;
  /** of visitors30d: first counted before the 30 days and back again within them */
  returning30d: number;
  /** of visitors30d: came on two or more different days within the 30 days */
  repeat30d: number;
  /** of visitors30d: signed in on at least one of their days */
  members30d: number;
  /** of visitors30d: never signed in within the 30 days */
  guests30d: number;
  pageViews30d: number;
  /** page views in the last 30 days per page, most viewed first */
  topPages: { path: TrackedPath; views: number }[];
  /** the last 90 days, oldest first, days with nobody as 0 */
  daily: DailyUsage[];
  /**
   * Days within the last 30, newest first, on which a cap against inflated counts held back new
   * visitors (src/lib/usage/record.ts): their visitor numbers are incomplete.
   */
  cappedDays30: string[];
}

export const SERIES_DAYS = 90;

const n = (v: unknown) => Number(v ?? 0) || 0;

/** Usage numbers for the admin stats page, up to and including `today` (YYYY-MM-DD, Asia/Bangkok). */
export async function getUsageStats(today: string): Promise<UsageStats> {
  const db = await getDb();
  const d = usageVisitorDays;
  const v = usageVisitors;
  const pv = usagePageViews;
  const from7 = addDays(today, -6);
  const from30 = addDays(today, -29);
  const from90 = addDays(today, -(SERIES_DAYS - 1));

  // one row per visitor of the last 30 days: member on any day, on how many days. The aliases are
  // unique because drizzle names them unqualified in the outer query, where usage_visitors.days exists too
  const per = db
    .select({
      visitor: d.visitor,
      isMember: sql<boolean>`bool_or(${d.member})`.as("per_member"),
      dayCount: sql<number>`count(*)`.as("per_days"),
    })
    .from(d)
    .where(between(d.day, from30, today))
    .groupBy(d.visitor)
    .as("per");

  const [windows, people, allTime, pages, visitorSeries, viewSeries, capped] = await Promise.all([
    db
      .select({
        today: sql<number>`(count(DISTINCT ${d.visitor}) FILTER (WHERE ${d.day} = ${today}::date))::int`,
        last7: sql<number>`(count(DISTINCT ${d.visitor}) FILTER (WHERE ${d.day} >= ${from7}::date))::int`,
        last30: sql<number>`count(DISTINCT ${d.visitor})::int`,
      })
      .from(d)
      .where(between(d.day, from30, today)),
    db
      .select({
        total: sql<number>`count(*)::int`,
        members: sql<number>`(count(*) FILTER (WHERE ${per.isMember}))::int`,
        // no usage_visitors row cannot happen (both are written together); count it as new if it does
        fresh: sql<number>`(count(*) FILTER (WHERE ${v.firstDay} IS NULL OR ${v.firstDay} >= ${from30}::date))::int`,
        repeat: sql<number>`(count(*) FILTER (WHERE ${per.dayCount} >= 2))::int`,
      })
      .from(per)
      .leftJoin(v, eq(v.visitor, per.visitor)),
    db
      .select({
        total: sql<number>`count(*)::int`,
        firstDay: sql<string | null>`min(${v.firstDay})::text`,
      })
      .from(v),
    db
      .select({ path: pv.path, views: sql<number>`sum(${pv.views})::int` })
      .from(pv)
      .where(between(pv.day, from30, today))
      .groupBy(pv.path)
      .orderBy(desc(sql`sum(${pv.views})`), pv.path),
    db
      .select({ day: sql<string>`${d.day}::text`, visitors: sql<number>`count(*)::int` })
      .from(d)
      .where(between(d.day, from90, today))
      .groupBy(d.day),
    db
      .select({ day: sql<string>`${pv.day}::text`, views: sql<number>`sum(${pv.views})::int` })
      .from(pv)
      .where(between(pv.day, from90, today))
      .groupBy(pv.day),
    db
      .select({ day: sql<string>`${usageCappedDays.day}::text` })
      .from(usageCappedDays)
      .where(and(between(usageCappedDays.day, from30, today), gt(usageCappedDays.reports, 0)))
      .orderBy(desc(usageCappedDays.day)),
  ]);

  const visitorsByDay = new Map(visitorSeries.map((r) => [r.day, n(r.visitors)]));
  const viewsByDay = new Map(viewSeries.map((r) => [r.day, n(r.views)]));
  const daily: DailyUsage[] = Array.from({ length: SERIES_DAYS }, (_, i) => {
    const day = addDays(from90, i);
    return { day, visitors: visitorsByDay.get(day) ?? 0, views: viewsByDay.get(day) ?? 0 };
  });

  const w = windows[0];
  const p = people[0];
  const a = allTime[0];
  const total30 = n(p?.total);
  const fresh30 = n(p?.fresh);
  const members30 = n(p?.members);
  const topPages = pages.map((r) => ({ path: normalizePath(r.path), views: n(r.views) }));
  return {
    today,
    firstDay: a?.firstDay ?? null,
    visitorsToday: n(w?.today),
    visitors7d: n(w?.last7),
    visitors30d: n(w?.last30),
    visitorsAllTime: n(a?.total),
    new30d: fresh30,
    returning30d: total30 - fresh30,
    repeat30d: n(p?.repeat),
    members30d: members30,
    guests30d: total30 - members30,
    pageViews30d: topPages.reduce((s, r) => s + r.views, 0),
    topPages,
    daily,
    cappedDays30: capped.map((r) => r.day),
  };
}
