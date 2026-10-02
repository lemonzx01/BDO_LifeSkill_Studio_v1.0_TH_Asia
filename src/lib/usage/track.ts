/**
 * Pure rules for counting usage: which pages are counted, what a valid report looks like, which
 * clients are bots and what "today" is. No server or browser APIs here, so the beacon and the API
 * route share one definition and every rule can be unit tested.
 */

/** where the beacon keeps this browser's random id */
export const VISITOR_STORAGE_KEY = "bls:vid";

/** the largest report body the API reads (a real one is about 70 characters) */
export const TRACK_MAX_BODY_CHARS = 500;

/** reports one address may send per window ("track:<ip>") */
export const TRACK_LIMIT = 120;
export const TRACK_WINDOW_MS = 15 * 60 * 1000;

/**
 * New visitors one address may add per day ("trackvid:<ip>:<day>"). Past this, page views from
 * the address still count but no new visitor does, so a script inventing ids adds at most this many.
 */
export const NEW_VISITORS_PER_ADDRESS_PER_DAY = 10;
/**
 * New visitors one IPv6 /48 may add per day ("trackvid48:<prefix>:<day>"). An address is counted per
 * /64 (one home or phone line), but one server can hold a /48 with 65,536 of those.
 */
export const NEW_VISITORS_PER_NETWORK_PER_DAY = 50;
/** New visitors the whole site may add per day ("trackvid:all:<day>"), a ceiling far above real use. */
export const NEW_VISITORS_PER_DAY = 5000;
/** the key carries the day, so a full day always covers the rest of that calendar day */
export const NEW_VISITOR_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * The IPv6 /48 a throttle address ("2001:db8:1:2::/64", see throttleAddress) belongs to, or null for
 * an IPv4 address (one IPv4 address is often a whole carrier's customers, so it gets no wider key).
 */
export function network48(address: string): string | null {
  const m = /^([0-9a-f]{1,4}):([0-9a-f]{1,4}):([0-9a-f]{1,4}):[0-9a-f]{1,4}::\/64$/.exec(address);
  return m ? `${m[1]}:${m[2]}:${m[3]}::/48` : null;
}

/** Every page of the app that is counted by name. Anything else is counted as "other". */
export const TRACKED_PATHS = [
  "/",
  "/recipes",
  "/market",
  "/inventory",
  "/calc",
  "/help",
  "/account",
  "/admin",
  "/admin/stats",
  "/login",
] as const;

export type TrackedPath = (typeof TRACKED_PATHS)[number] | "other";

const KNOWN = new Set<string>(TRACKED_PATHS);

/** Thai names for the pages, for the stats page. */
export const PATH_LABEL: Record<TrackedPath, string> = {
  "/": "หน้าแรก",
  "/recipes": "สูตร",
  "/market": "ตลาด",
  "/inventory": "คลัง",
  "/calc": "คำนวณ",
  "/help": "วิธีใช้",
  "/account": "บัญชี",
  "/admin": "จัดการสมาชิก",
  "/admin/stats": "สถิติการใช้งาน",
  "/login": "ล็อกอิน",
  other: "อื่น ๆ",
};

/**
 * The page a path counts as: one of TRACKED_PATHS or "other". The query string and hash are
 * dropped (they may hold search words) and so is a trailing slash; matching is exact otherwise.
 */
export function normalizePath(raw: string): TrackedPath {
  let p = raw.split(/[?#]/, 1)[0] ?? "";
  if (p.length > 1) p = p.replace(/\/+$/, "") || "/";
  return KNOWN.has(p) ? (p as TrackedPath) : "other";
}

/** a random (version 4) UUID, as crypto.randomUUID() makes */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isVisitorId(v: unknown): v is string {
  return typeof v === "string" && UUID_V4.test(v);
}

export interface TrackReport {
  /** the browser's id, lower-cased so one id cannot count twice by changing case */
  vid: string;
  path: TrackedPath;
}

/** A report from the beacon, or null when it is not one: `{ vid: uuid, path: string }`. */
export function parseTrackBody(body: unknown): TrackReport | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const { vid, path } = body as Record<string, unknown>;
  if (!isVisitorId(vid) || typeof path !== "string") return null;
  return { vid: vid.toLowerCase(), path: normalizePath(path) };
}

/**
 * Crawlers, link previews, monitors, headless browsers and HTTP libraries. Real browsers (in-app
 * ones such as LINE and Facebook's included) all start their user agent with "Mozilla/".
 * "bot" counts only as a word or before "/", ";" or "-" (Googlebot/2.1, DuckDuckBot-Https), so a
 * phone model such as "CUBOT X30" is not taken for one.
 */
const BOT_UA =
  /\bbot\b|bot[/;-]|slackbot|telegrambot|twitterbot|discordbot|crawl|spider|slurp|scrape|archiver|facebookexternalhit|facebookcatalog|meta-externalagent|embedly|preview|whatsapp|lighthouse|pagespeed|gtmetrix|pingdom|uptime|statuscake|monitor|headless|phantomjs|selenium|puppeteer|playwright|webdriver|curl|wget|python|httpclient|axios|node-fetch|undici|go-http-client|java\/|okhttp|libwww|vercel/i;

export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua || !/^Mozilla\/\d/.test(ua.trim())) return true;
  return BOT_UA.test(ua);
}

/**
 * False when the request carries an Origin header that is not this site (another site's page
 * posting here). A missing Origin is allowed: same-origin fetches from older browsers omit it,
 * and a non-browser client can set any header it likes anyway.
 */
export function isSameOrigin(origin: string | null, hosts: readonly (string | null | undefined)[]): boolean {
  if (origin === null) return true;
  let host: string;
  try {
    host = new URL(origin).host.toLowerCase();
  } catch {
    return false; // includes the opaque "null" origin
  }
  return hosts.some((h) => typeof h === "string" && h.trim().toLowerCase() === host);
}

/** Thailand has stayed on UTC+7 with no daylight saving, so a fixed offset gives its calendar day. */
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

/** The calendar day in Asia/Bangkok at `at`, as YYYY-MM-DD. */
export function bangkokDay(at: Date): string {
  return new Date(at.getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
}

/** Today in Asia/Bangkok. A function here rather than `new Date()` in a page, which the React purity lint flags. */
export function bangkokToday(): string {
  return bangkokDay(new Date());
}

/** `day` (YYYY-MM-DD) moved by `n` days. */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
