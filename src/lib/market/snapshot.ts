import { and, asc, desc, eq, gte, isNull, lt, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { marketDaily, marketItems, marketMeta } from "@/lib/db/schema";
import type { ItemId, MarketPrice } from "@/lib/engine/types";
import { fetchHistory, fetchPricesOfficial } from "./client";

/**
 * Whole-market snapshot kept in the database.
 *
 * Primary source: bdolytics market snapshot for the ASIA region (one request,
 * every item, includes 14-day traded volume). Fallback: the official
 * GetWorldMarketSearchList over the item ids we already know. Each refresh also
 * writes today's row into market_daily and backfills a few items' official
 * 90-day history so "price vs usual" has data from day one.
 */

export const SNAPSHOT_TTL_MS = 5 * 60 * 1000;
const HISTORY_REFRESH_MS = 3 * 24 * 60 * 60 * 1000;
const CHUNK = 500;

export interface SnapshotItem {
  id: ItemId;
  th: string;
  en?: string | null;
  icon?: string | null;
  grade?: number;
  cat?: string | null;
  sub?: string | null;
  price: number;
  stock: number;
  trades: number;
  vol14?: number | null;
}

export interface RefreshDeps {
  fetchSnapshot?: (lang: "th" | "en") => Promise<SnapshotItem[]>;
  fetchByIds?: (ids: ItemId[]) => Promise<MarketPrice[]>;
  fetchHistory?: (id: ItemId) => Promise<number[]>;
  now?: () => Date;
}

export interface RefreshResult {
  refreshed: boolean;
  source: "bdolytics" | "official" | null;
  count: number;
  backfilled: number;
  at: Date | null;
}

// ---------- upstream ----------

export async function fetchBdolyticsSnapshot(lang: "th" | "en" = "th"): Promise<SnapshotItem[]> {
  const input = encodeURIComponent(JSON.stringify({ language: lang, region: "ASIA" }));
  const res = await fetch(`https://bdolytics.com/api/trpc/market.getMarket?input=${input}`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; bdo-lifeskill-studio; guild tool)" },
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`bdolytics HTTP ${res.status}`);
  const json = (await res.json()) as {
    result?: {
      data?: Array<{
        itemId: number;
        name: string;
        icon?: string;
        grade?: number;
        mainCategory?: string;
        subCategory?: string;
        price: number;
        inStock: number;
        totalTrades: number;
        fourteenDayVolume?: number;
      }>;
    };
  };
  const rows = json.result?.data;
  if (!Array.isArray(rows) || rows.length < 1000) throw new Error("bdolytics snapshot looks incomplete");
  return rows.map((r) => ({
    id: r.itemId,
    th: r.name,
    icon: r.icon ?? null,
    grade: r.grade ?? 0,
    cat: r.mainCategory ?? null,
    sub: r.subCategory ?? null,
    price: r.price,
    stock: r.inStock,
    trades: r.totalTrades,
    vol14: r.fourteenDayVolume ?? null,
  }));
}

// ---------- meta ----------

async function getMeta(key: string): Promise<string | null> {
  const db = await getDb();
  const [row] = await db.select().from(marketMeta).where(eq(marketMeta.key, key)).limit(1);
  return row?.value ?? null;
}

async function setMeta(key: string, value: string) {
  const db = await getDb();
  await db
    .insert(marketMeta)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: marketMeta.key, set: { value, updatedAt: new Date() } });
}

export async function getLastRefresh(): Promise<{ at: Date | null; source: string | null }> {
  const at = await getMeta("last_refresh_at");
  const source = await getMeta("last_source");
  return { at: at ? new Date(at) : null, source };
}

/** True when the snapshot is missing or older than the TTL. */
export function isSnapshotStale(at: Date | null, ttlMs = SNAPSHOT_TTL_MS): boolean {
  return !at || Date.now() - at.getTime() > ttlMs;
}

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ---------- refresh ----------

let inflight: Promise<RefreshResult> | null = null;

/** Refreshes the snapshot when it is older than the TTL (or when forced). Concurrent calls share one run. */
export function refreshMarket(opts: { force?: boolean; backfill?: number } = {}, deps: RefreshDeps = {}): Promise<RefreshResult> {
  if (inflight) return inflight;
  inflight = doRefresh(opts, deps).finally(() => {
    inflight = null;
  });
  return inflight;
}

async function doRefresh(opts: { force?: boolean; backfill?: number }, deps: RefreshDeps): Promise<RefreshResult> {
  const now = deps.now ? deps.now() : new Date();
  const last = await getLastRefresh();
  if (!opts.force && last.at && now.getTime() - last.at.getTime() < SNAPSHOT_TTL_MS) {
    return { refreshed: false, source: (last.source as RefreshResult["source"]) ?? null, count: 0, backfilled: 0, at: last.at };
  }

  const db = await getDb();
  let items: SnapshotItem[];
  let source: RefreshResult["source"];
  try {
    items = await (deps.fetchSnapshot ?? fetchBdolyticsSnapshot)("th");
    source = "bdolytics";
  } catch (e) {
    console.warn("bdolytics snapshot failed, falling back to official search list:", (e as Error).message);
    const known = await db.select({ id: marketItems.id, th: marketItems.nameTh }).from(marketItems);
    if (known.length === 0) throw new Error("no market snapshot yet and bdolytics is unavailable");
    const prices = await (deps.fetchByIds ?? fetchPricesOfficial)(known.map((k) => k.id));
    const nameById = new Map(known.map((k) => [k.id, k.th]));
    items = prices.map((p) => ({ id: p.id, th: nameById.get(p.id) ?? `#${p.id}`, price: p.price, stock: p.stock, trades: p.totalTrades }));
    source = "official";
  }

  // 1) latest state
  for (let i = 0; i < items.length; i += CHUNK) {
    const chunk = items.slice(i, i + CHUNK);
    if (source === "bdolytics") {
      await db
        .insert(marketItems)
        .values(
          chunk.map((it) => ({
            id: it.id,
            nameTh: it.th,
            nameEn: it.en ?? null,
            icon: it.icon ?? null,
            grade: it.grade ?? 0,
            cat: it.cat ?? null,
            sub: it.sub ?? null,
            price: it.price,
            stock: it.stock,
            totalTrades: it.trades,
            volume14d: it.vol14 ?? null,
            updatedAt: now,
          })),
        )
        .onConflictDoUpdate({
          target: marketItems.id,
          set: {
            nameTh: sql`excluded.name_th`,
            icon: sql`excluded.icon`,
            grade: sql`excluded.grade`,
            cat: sql`excluded.cat`,
            sub: sql`excluded.sub`,
            price: sql`excluded.price`,
            stock: sql`excluded.stock`,
            totalTrades: sql`excluded.total_trades`,
            volume14d: sql`excluded.volume_14d`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
    } else {
      // official fallback only knows price/stock/trades
      await db
        .insert(marketItems)
        .values(chunk.map((it) => ({ id: it.id, nameTh: it.th, price: it.price, stock: it.stock, totalTrades: it.trades, updatedAt: now })))
        .onConflictDoUpdate({
          target: marketItems.id,
          set: {
            price: sql`excluded.price`,
            stock: sql`excluded.stock`,
            totalTrades: sql`excluded.total_trades`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
    }
  }

  // 2) today's row in the daily history
  const day = isoDay(now);
  for (let i = 0; i < items.length; i += CHUNK) {
    const chunk = items.slice(i, i + CHUNK).filter((it) => it.price > 0);
    if (!chunk.length) continue;
    await db
      .insert(marketDaily)
      .values(chunk.map((it) => ({ itemId: it.id, day, price: it.price, stock: it.stock, totalTrades: it.trades })))
      .onConflictDoUpdate({
        target: [marketDaily.itemId, marketDaily.day],
        set: { price: sql`excluded.price`, stock: sql`excluded.stock`, totalTrades: sql`excluded.total_trades` },
      });
  }

  // 3) English names once for items that still lack them
  if (source === "bdolytics") {
    const [missing] = await db.select({ id: marketItems.id }).from(marketItems).where(isNull(marketItems.nameEn)).limit(1);
    if (missing) {
      try {
        const en = await (deps.fetchSnapshot ?? fetchBdolyticsSnapshot)("en");
        for (let i = 0; i < en.length; i += CHUNK) {
          const chunk = en.slice(i, i + CHUNK);
          await db
            .insert(marketItems)
            .values(chunk.map((it) => ({ id: it.id, nameTh: it.th, nameEn: it.th, price: it.price, stock: it.stock, totalTrades: it.trades })))
            .onConflictDoUpdate({ target: marketItems.id, set: { nameEn: sql`excluded.name_en` } });
        }
      } catch (e) {
        console.warn("english names skipped:", (e as Error).message);
      }
    }
  }

  await setMeta("last_refresh_at", now.toISOString());
  await setMeta("last_source", source);
  invalidateScanCache();

  const backfilled = await backfillHistory(opts.backfill ?? 100, deps);
  return { refreshed: true, source, count: items.length, backfilled, at: now };
}

/** Merges the official 90-day price history for the N items whose history is missing or stale. */
export async function backfillHistory(limit: number, deps: RefreshDeps = {}): Promise<number> {
  if (limit <= 0) return 0;
  const db = await getDb();
  const now = deps.now ? deps.now() : new Date();
  const stale = new Date(now.getTime() - HISTORY_REFRESH_MS);
  const candidates = await db
    .select({ id: marketItems.id })
    .from(marketItems)
    .where(and(sql`${marketItems.price} > 0`, or(isNull(marketItems.historyFetchedAt), lt(marketItems.historyFetchedAt, stale))))
    .orderBy(sql`${marketItems.historyFetchedAt} ASC NULLS FIRST`, desc(marketItems.volume14d), desc(marketItems.totalTrades))
    .limit(limit);
  const fetcher = deps.fetchHistory ?? fetchHistory;
  let done = 0;
  const worker = async (id: ItemId) => {
    let history: number[];
    try {
      history = await fetcher(id);
    } catch (e) {
      console.warn("history backfill failed", id, (e as Error).message);
      return;
    }
    const rows = history
      .map((price, i) => {
        const d = new Date(now);
        d.setUTCDate(d.getUTCDate() - (history.length - 1 - i));
        return { itemId: id, day: isoDay(d), price };
      })
      .filter((r) => r.price > 0);
    if (rows.length) await db.insert(marketDaily).values(rows).onConflictDoNothing();
    await db.update(marketItems).set({ historyFetchedAt: now }).where(eq(marketItems.id, id));
    done += 1;
  };
  const queue = candidates.map((c) => c.id);
  const concurrency = 4;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      while (queue.length) {
        const id = queue.shift();
        if (id !== undefined) await worker(id);
      }
    }),
  );
  if (done) invalidateScanCache();
  return done;
}

let lastBackfillAt = 0;

/** Fire-and-forget history backfill for page views, at most once a minute per instance. */
export async function backfillHistoryThrottled(limit = 100): Promise<number> {
  const now = Date.now();
  if (now - lastBackfillAt < 60_000) return 0;
  lastBackfillAt = now;
  return backfillHistory(limit);
}

/** How many priced items still have no official history merged in. */
export async function countItemsWithoutHistory(): Promise<number> {
  const db = await getDb();
  const res = await db.execute(sql`SELECT COUNT(*) AS n FROM market_items WHERE price > 0 AND history_fetched_at IS NULL`);
  const rows = (res as unknown as { rows: { n: string | number }[] }).rows ?? (res as unknown as { n: string | number }[]);
  return Number(rows[0]?.n ?? 0);
}

// ---------- scan (read side) ----------

export interface ScanRow {
  id: ItemId;
  th: string;
  en: string | null;
  icon: string | null;
  grade: number;
  cat: string | null;
  sub: string | null;
  price: number;
  stock: number;
  trades: number;
  vol14: number | null;
  /** aggregates over our daily history (null when fewer than 2 days known) */
  avg90: number | null;
  min90: number | null;
  max90: number | null;
  avg30: number | null;
  avg7: number | null;
  days: number;
  /** listed stock per day over the last week (oldest first), from our own snapshots */
  stockHist: number[];
  /** real units traded per day, from the change in the item's cumulative trade counter (null until 2+ days known) */
  tradesPerDay: number | null;
}

let scanCache: { key: string; rows: ScanRow[]; at: number } | null = null;

export function invalidateScanCache() {
  scanCache = null;
}

interface AggRow {
  item_id: number;
  avg: string | number;
  min: string | number | null;
  max: string | number | null;
  days: string | number;
}

async function aggregate(daysBack: number, now: Date): Promise<Map<number, AggRow>> {
  const db = await getDb();
  const since = new Date(now);
  since.setUTCDate(since.getUTCDate() - daysBack);
  const res = await db.execute(sql`
    SELECT item_id, AVG(price) AS avg, MIN(price) AS min, MAX(price) AS max, COUNT(*) AS days
    FROM market_daily WHERE day >= ${isoDay(since)} GROUP BY item_id
  `);
  const rows = (res as unknown as { rows: AggRow[] }).rows ?? (res as unknown as AggRow[]);
  return new Map(rows.map((r) => [Number(r.item_id), r]));
}

interface RecentRow {
  item_id: number;
  day: string;
  stock: number | null;
  total_trades: string | number | null;
}

/** Last week of our own daily rows (stock + cumulative trades) per item. */
async function recentDaily(now: Date): Promise<Map<number, RecentRow[]>> {
  const db = await getDb();
  const since = new Date(now);
  since.setUTCDate(since.getUTCDate() - 7);
  const res = await db.execute(sql`
    SELECT item_id, day, stock, total_trades FROM market_daily
    WHERE day >= ${isoDay(since)} AND stock IS NOT NULL ORDER BY item_id, day
  `);
  const rows = (res as unknown as { rows: RecentRow[] }).rows ?? (res as unknown as RecentRow[]);
  const out = new Map<number, RecentRow[]>();
  for (const r of rows) {
    const id = Number(r.item_id);
    const list = out.get(id) ?? [];
    list.push(r);
    out.set(id, list);
  }
  return out;
}

function tradesPerDayFrom(rows: RecentRow[] | undefined): number | null {
  if (!rows || rows.length < 2) return null;
  const withTrades = rows.filter((r) => r.total_trades !== null && r.total_trades !== undefined);
  if (withTrades.length < 2) return null;
  const first = withTrades[0];
  const last = withTrades[withTrades.length - 1];
  const spanDays = (Date.parse(String(last.day)) - Date.parse(String(first.day))) / 86_400_000;
  if (spanDays < 1) return null;
  const diff = Number(last.total_trades) - Number(first.total_trades);
  return diff >= 0 ? diff / spanDays : null;
}

/** Every priced market item with 7/30/90-day aggregates. Cached for 5 minutes per snapshot. */
export async function getMarketScan(deps: { now?: () => Date } = {}): Promise<{ rows: ScanRow[]; refreshedAt: Date | null; source: string | null }> {
  const now = deps.now ? deps.now() : new Date();
  const last = await getLastRefresh();
  const key = last.at?.toISOString() ?? "none";
  if (scanCache && scanCache.key === key && now.getTime() - scanCache.at < 5 * 60 * 1000) {
    return { rows: scanCache.rows, refreshedAt: last.at, source: last.source };
  }
  const db = await getDb();
  const [items, a90, a30, a7, recent] = await Promise.all([
    db.select().from(marketItems).where(sql`${marketItems.price} > 0`),
    aggregate(90, now),
    aggregate(30, now),
    aggregate(7, now),
    recentDaily(now),
  ]);
  const num = (v: string | number | null | undefined) => (v === null || v === undefined ? null : Number(v));
  const rows: ScanRow[] = items.map((it) => {
    const g90 = a90.get(it.id);
    const g30 = a30.get(it.id);
    const g7 = a7.get(it.id);
    const days = g90 ? Number(g90.days) : 0;
    return {
      id: it.id,
      th: it.nameTh,
      en: it.nameEn,
      icon: it.icon,
      grade: it.grade,
      cat: it.cat,
      sub: it.sub,
      price: it.price,
      stock: it.stock,
      trades: it.totalTrades,
      vol14: it.volume14d,
      avg90: days >= 2 ? num(g90?.avg) : null,
      min90: days >= 2 ? num(g90?.min) : null,
      max90: days >= 2 ? num(g90?.max) : null,
      avg30: g30 && Number(g30.days) >= 2 ? num(g30.avg) : null,
      avg7: g7 ? num(g7.avg) : null,
      days,
      stockHist: (recent.get(it.id) ?? []).map((r) => Number(r.stock ?? 0)),
      tradesPerDay: tradesPerDayFrom(recent.get(it.id)),
    };
  });
  scanCache = { key, rows, at: now.getTime() };
  return { rows, refreshedAt: last.at, source: last.source };
}

/** Current prices straight from the snapshot (for the recipe engine), keyed by id. */
export async function getSnapshotPrices(ids: ItemId[]): Promise<{ prices: Record<ItemId, MarketPrice>; at: Date | null }> {
  const db = await getDb();
  const last = await getLastRefresh();
  if (!last.at) return { prices: {}, at: null };
  const out: Record<ItemId, MarketPrice> = {};
  for (let i = 0; i < ids.length; i += 1000) {
    const chunk = ids.slice(i, i + 1000);
    const rows = await db
      .select({ id: marketItems.id, price: marketItems.price, stock: marketItems.stock, trades: marketItems.totalTrades, vol: marketItems.volume14d })
      .from(marketItems)
      .where(sql`${marketItems.id} IN (${sql.join(chunk.map((c) => sql`${c}`), sql`, `)})`);
    for (const r of rows) {
      out[r.id] = { id: r.id, price: r.price, stock: r.stock, totalTrades: r.trades, volume14d: r.vol ?? undefined, updatedAt: last.at.getTime() };
    }
  }
  return { prices: out, at: last.at };
}

/** Our own daily history for one item (oldest first). */
export async function getDailyHistory(id: ItemId, daysBack = 90): Promise<{ day: string; price: number }[]> {
  const db = await getDb();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - daysBack);
  const rows = await db
    .select({ day: marketDaily.day, price: marketDaily.price })
    .from(marketDaily)
    .where(and(eq(marketDaily.itemId, id), gte(marketDaily.day, isoDay(since))))
    .orderBy(asc(marketDaily.day));
  return rows.map((r) => ({ day: String(r.day), price: r.price }));
}
