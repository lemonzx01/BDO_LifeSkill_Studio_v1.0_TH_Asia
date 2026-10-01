/**
 * Browser timing reports sent by PerfBeacon. Only pages on the allow-list are stored, under a
 * fixed key per page, so a member cannot create new rows in market_meta; no account name is kept.
 */
export const PERF_PAGES = ["market"] as const;
export type PerfPage = (typeof PERF_PAGES)[number];

/** Largest number a report may carry (bytes or milliseconds); anything above is clamped. */
export const PERF_MAX = 10_000_000;

export const PERF_NUMBER_FIELDS = [
  "rows",
  "ttfbMs",
  "responseMs",
  "domReadyMs",
  "transferBytes",
  "decodedBytes",
  "mountedMs",
  "scriptBytes",
  "scriptCount",
  "scriptsDoneMs",
  "imageBytes",
  "imageCount",
] as const;

export function perfKey(page: PerfPage): string {
  return `timing_${page}_client`;
}

function isPerfPage(v: unknown): v is PerfPage {
  return typeof v === "string" && (PERF_PAGES as readonly string[]).includes(v);
}

/** A whole number clamped to 0..PERF_MAX, or null when the value is not a finite number. */
export function clampPerfNumber(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.min(PERF_MAX, Math.max(0, Math.round(v)));
}

/** The record to store for one report, or null when the page is not on the allow-list. */
export function buildPerfRecord(body: unknown, at: Date): { key: string; data: Record<string, unknown> } | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (!isPerfPage(b.page)) return null;
  const data: Record<string, unknown> = { at: at.toISOString(), fullLoad: b.fullLoad === true, mobile: b.mobile === true };
  for (const k of PERF_NUMBER_FIELDS) data[k] = clampPerfNumber(b[k]);
  // navigator.connection.effectiveType: "slow-2g", "2g", "3g", "4g"
  data.connection = typeof b.connection === "string" && /^[a-z0-9-]{1,10}$/.test(b.connection) ? b.connection : null;
  return { key: perfKey(b.page), data };
}
