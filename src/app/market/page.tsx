import { after } from "next/server";
import { MarketScanner } from "@/components/market/MarketScanner";
import { UserDataProvider } from "@/components/UserDataProvider";
import { getVisitor } from "@/lib/auth/session";
import { stopwatch } from "@/lib/timing";
import { getUserSettings } from "@/lib/user-data";
import {
  AUTO_REFRESH_MS,
  autoRefreshMarket,
  backfillHistoryThrottled,
  countItemsWithoutHistory,
  getLastRefresh,
  getMarketScan,
  isSnapshotStale,
  recordTiming,
  refreshMarket,
} from "@/lib/market/snapshot";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ?q= (an item name from home or quick search) is read by MarketScanner from the address bar.
// Open to everyone; the diagnostic timing records are written for signed-in members' views only,
// so anonymous traffic cannot turn into database writes here.
export default async function MarketPage() {
  const clock = stopwatch();
  const { user, sessionEnded } = await getVisitor();
  const authMs = clock.lap();
  // marker written before the heavy part: if /api/health shows a start without a matching
  // finish, the request died while building or streaming the page
  // (no account name: these records are diagnostics, not an access log)
  if (user) await recordTiming("timing_market_page_start", { at: new Date().toISOString(), authMs, region: process.env.VERCEL_REGION ?? null }).catch(() => {});

  const last = await getLastRefresh();
  let refreshError: string | null = null;
  if (!last.at) {
    // very first visit: build the snapshot before rendering
    try {
      await refreshMarket({ force: true, backfill: 20 });
    } catch (e) {
      // the reason is for members (and the logs); a visitor who is not signed in gets no internals
      console.error("first market refresh failed:", e);
      refreshError = user ? (e as Error).message : "ลองใหม่อีกครั้งภายหลัง";
    }
  } else if (isSnapshotStale(last.at, AUTO_REFRESH_MS)) {
    // stale: serve what we have and refresh after the response is sent, but only if this view wins
    // the shared slot (one refresh per AUTO_REFRESH_MS, however many visitors and servers). The
    // history backfill is left to the cron and to members' views below.
    after(() => autoRefreshMarket().catch((e) => console.error("background market refresh failed:", e)));
  } else if (user && (await countItemsWithoutHistory()) > 0) {
    // history still incomplete: members' views keep filling it in (at most once a minute per server),
    // as before the site was public; visitors who are not signed in never start upstream work here
    after(() => backfillHistoryThrottled(100).catch((e) => console.error("background history backfill failed:", e)));
  }

  const staleCheckMs = clock.lap();
  const [scan, settings] = await Promise.all([getMarketScan(), user ? getUserSettings(user.id) : null]);
  const dataMs = clock.lap();
  const timing = {
    at: new Date().toISOString(),
    authMs,
    staleCheckMs,
    dataMs,
    totalMs: clock.total(),
    scanCached: scan.cached,
    rows: scan.rows.length,
    region: process.env.VERCEL_REGION ?? null,
  };
  console.log("market page timing", JSON.stringify(timing));
  // written after the response so measuring never slows the page itself
  if (user) after(() => recordTiming("timing_market_page", timing).catch(() => {}));
  return (
    // this page does not load the inventory (null: the provider must not treat it as empty)
    <UserDataProvider userId={user?.id ?? null} initialSettings={settings} initialInventory={null} sessionEnded={sessionEnded}>
      <MarketScanner
        rows={scan.rows}
        totalItems={scan.totalItems}
        refreshedAt={scan.refreshedAt ? scan.refreshedAt.toISOString() : null}
        source={scan.source}
        refreshError={refreshError}
        user={user && { username: user.username, displayName: user.displayName, role: user.role }}
      />
    </UserDataProvider>
  );
}
