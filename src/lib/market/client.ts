import type { ItemId, MarketPrice } from "@/lib/engine/types";

/**
 * Central market clients for the Asia region (TH players were merged into Asia).
 * Primary: official Pearl Abyss trade API. Fallback: api.arsha.io (region "th").
 * Both are server-side only (the official API has no CORS).
 */

const OFFICIAL_BASE = "https://asia-trade.blackdesert.pearlabyss.com/Trademarket";
const ARSHA_BASE = "https://api.arsha.io/v2/th";
const CHUNK = 100;
const TIMEOUT_MS = 12000;

async function withTimeout<T>(p: Promise<T>, ms = TIMEOUT_MS): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, rej) => {
    t = setTimeout(() => rej(new Error("timeout")), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (t) clearTimeout(t);
  }
}

async function officialPost<T = { resultCode: number; resultMsg: string }>(path: string, body: unknown): Promise<T> {
  const res = await withTimeout(
    fetch(`${OFFICIAL_BASE}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "BlackDesert" },
      body: JSON.stringify(body),
      cache: "no-store",
    }),
  );
  if (!res.ok) throw new Error(`official ${path} HTTP ${res.status}`);
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    // the market API returns an HTML page instead of JSON when it throttles or is down
    throw new SourceUnavailableError(`official ${path} answered with ${text.trimStart().startsWith("<") ? "an HTML page" : "non-JSON"} (throttled or down)`);
  }
}

/** The upstream is refusing us for now (HTML instead of JSON): callers should back off, not retry item by item. */
export class SourceUnavailableError extends Error {}

/** Current price/stock for many items in one call (official GetWorldMarketSearchList). */
export async function fetchPricesOfficial(ids: ItemId[]): Promise<MarketPrice[]> {
  const out: MarketPrice[] = [];
  const now = Date.now();
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const json = await officialPost("GetWorldMarketSearchList", { searchResult: chunk.join(",") });
    if (json.resultCode !== 0) throw new Error(`official resultCode ${json.resultCode}`);
    for (const rec of json.resultMsg.split("|")) {
      if (!rec) continue;
      const [id, stock, price, trades] = rec.split("-").map(Number);
      if (!id) continue;
      out.push({ id, price, stock, totalTrades: trades, updatedAt: now });
    }
  }
  return out;
}

export async function fetchPricesArsha(ids: ItemId[]): Promise<MarketPrice[]> {
  const out: MarketPrice[] = [];
  const now = Date.now();
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const res = await withTimeout(
      fetch(`${ARSHA_BASE}/GetWorldMarketSearchList?ids=${chunk.join(",")}`, { cache: "no-store" }),
    );
    if (!res.ok) throw new Error(`arsha HTTP ${res.status}`);
    const json = (await res.json()) as Array<{ id: number; currentStock: number; basePrice: number; totalTrades: number }>;
    for (const r of json) {
      out.push({ id: r.id, price: r.basePrice, stock: r.currentStock, totalTrades: r.totalTrades, updatedAt: now });
    }
  }
  return out;
}

/** Try official first, then arsha. Returns whichever succeeds plus the source name. */
export async function fetchPrices(ids: ItemId[]): Promise<{ prices: MarketPrice[]; source: "official" | "arsha" }> {
  const unique = [...new Set(ids.filter((n) => Number.isFinite(n) && n > 0))];
  if (unique.length === 0) return { prices: [], source: "official" };
  try {
    return { prices: await fetchPricesOfficial(unique), source: "official" };
  } catch (e) {
    console.warn("official market API failed, falling back to arsha:", (e as Error).message);
    return { prices: await fetchPricesArsha(unique), source: "arsha" };
  }
}

/** 90-day daily price history (oldest first). */
export async function fetchHistory(id: ItemId, sid = 0): Promise<number[]> {
  const json = await officialPost("GetMarketPriceInfo", { keyType: 0, mainKey: id, subKey: sid });
  if (json.resultCode !== 0) throw new Error(`official history resultCode ${json.resultCode}`);
  return json.resultMsg.split("-").map(Number).filter((n) => Number.isFinite(n));
}

export interface OrderBookRow {
  price: number;
  sellers: number;
  buyers: number;
}

/** Order book (arsha decodes the official binary payload for us). */
export async function fetchOrderBook(id: ItemId, sid = 0): Promise<OrderBookRow[]> {
  const res = await withTimeout(fetch(`${ARSHA_BASE}/GetBiddingInfoList?id=${id}&sid=${sid}`, { cache: "no-store" }));
  if (!res.ok) throw new Error(`arsha bidding HTTP ${res.status}`);
  const json = (await res.json()) as { orders?: OrderBookRow[] };
  return json.orders ?? [];
}
