import { createHash } from "node:crypto";
import { and, eq, not, sql } from "drizzle-orm";
import { hit } from "@/lib/auth/ratelimit";
import { getDb, type Db } from "@/lib/db";
import { usageCappedDays, usagePageViews, usageVisitorDays, usageVisitors } from "@/lib/db/schema";
import {
  NEW_VISITOR_WINDOW_MS,
  NEW_VISITORS_PER_ADDRESS_PER_DAY,
  NEW_VISITORS_PER_DAY,
  NEW_VISITORS_PER_NETWORK_PER_DAY,
  network48,
  TRACK_LIMIT,
  TRACK_WINDOW_MS,
  type TrackedPath,
} from "./track";

/**
 * Server side of usage counting. What reaches the database is the sha256 of the browser's random
 * id, a page name from TRACKED_PATHS, a day and a member yes/no: never the raw id, the IP address,
 * the user id or the username. The address is only part of the throttle keys in login_attempts,
 * which expire like every other throttle counter.
 */

/** The stored form of a browser id. */
export function hashVisitor(vid: string): string {
  return createHash("sha256").update(vid.toLowerCase()).digest("hex");
}

/** Counts one report against the address ("track:<ip>"); false when it is over TRACK_LIMIT. */
export async function allowTrack(ip: string): Promise<boolean> {
  return (await hit(`track:${ip}`, TRACK_LIMIT, TRACK_WINDOW_MS)).allowed;
}

export interface Visit {
  /** the browser's random id (a UUID) */
  vid: string;
  path: TrackedPath;
  /** a valid session came with the request */
  member: boolean;
  /** throttle address from clientIp() */
  ip: string;
  /** calendar day in Asia/Bangkok, YYYY-MM-DD */
  day: string;
}

/**
 * - "new": the browser's first report today, so it now counts as a visitor for the day
 * - "known": the browser was already counted today
 * - "capped": the address, its IPv6 /48 or the whole site already added as many new visitors today
 *   as allowed (see withinNewVisitorCaps), so this browser is not counted (its page view still is)
 *   and the day is marked incomplete
 */
export type VisitResult = "new" | "known" | "capped";

/** Counts one page view and, once a day per browser, one visitor. Call allowTrack() first. */
export async function recordVisit(v: Visit): Promise<VisitResult> {
  const db = await getDb();
  const visitor = hashVisitor(v.vid);
  const [, result] = await Promise.all([countPageView(db, v.day, v.path), countVisitor(db, v, visitor)]);
  return result;
}

async function countPageView(db: Db, day: string, path: TrackedPath) {
  await db
    .insert(usagePageViews)
    .values({ day, path, views: 1 })
    .onConflictDoUpdate({ target: [usagePageViews.day, usagePageViews.path], set: { views: sql`${usagePageViews.views} + 1` } });
}

async function countVisitor(db: Db, v: Visit, visitor: string): Promise<VisitResult> {
  const d = usageVisitorDays;
  const thisDay = and(eq(d.day, v.day), eq(d.visitor, visitor));
  /** a member on any request that day counts as a member for that day */
  const markMember = async () => {
    if (v.member) await db.update(d).set({ member: true }).where(and(thisDay, not(d.member)));
  };

  const [known] = await db.select({ member: d.member }).from(d).where(thisDay).limit(1);
  if (known) {
    if (!known.member) await markMember();
    return "known";
  }

  // a browser new for the day costs its address, its IPv6 /48 and the whole site one new visitor each
  if (!(await withinNewVisitorCaps(v))) {
    await noteCapped(db, v.day);
    return "capped";
  }

  const inserted = await db.insert(d).values({ day: v.day, visitor, member: v.member }).onConflictDoNothing().returning({ visitor: d.visitor });
  if (inserted.length === 0) {
    // a parallel report from the same browser counted it first
    await markMember();
    return "known";
  }
  await db
    .insert(usageVisitors)
    .values({ visitor, firstDay: v.day, lastDay: v.day, days: 1 })
    .onConflictDoUpdate({
      target: usageVisitors.visitor,
      set: {
        firstDay: sql`LEAST(${usageVisitors.firstDay}, excluded.first_day)`,
        lastDay: sql`GREATEST(${usageVisitors.lastDay}, excluded.last_day)`,
        days: sql`${usageVisitors.days} + 1`,
      },
    });
  // the throttle counters these caps add to login_attempts are dropped by the daily cron
  return "new";
}

/**
 * The caps against invented ids, checked in order and stopping at the first one that is full:
 * NEW_VISITORS_PER_ADDRESS_PER_DAY per address (IPv4, or IPv6 /64), NEW_VISITORS_PER_NETWORK_PER_DAY
 * per IPv6 /48, and NEW_VISITORS_PER_DAY for the whole site.
 */
async function withinNewVisitorCaps(v: Visit): Promise<boolean> {
  const caps: [string, number][] = [[`trackvid:${v.ip}:${v.day}`, NEW_VISITORS_PER_ADDRESS_PER_DAY]];
  const net = network48(v.ip);
  if (net) caps.push([`trackvid48:${net}:${v.day}`, NEW_VISITORS_PER_NETWORK_PER_DAY]);
  caps.push([`trackvid:all:${v.day}`, NEW_VISITORS_PER_DAY]);
  for (const [key, limit] of caps) {
    if (!(await hit(key, limit, NEW_VISITOR_WINDOW_MS)).allowed) return false;
  }
  return true;
}

/** Remembers that the day's visitor count is incomplete (shown on the stats page). */
async function noteCapped(db: Db, day: string) {
  await db
    .insert(usageCappedDays)
    .values({ day, reports: 1 })
    .onConflictDoUpdate({ target: usageCappedDays.day, set: { reports: sql`${usageCappedDays.reports} + 1` } });
}
