import { after } from "next/server";
import { MarketScanner } from "@/components/market/MarketScanner";
import { UserDataProvider } from "@/components/UserDataProvider";
import { requireUser } from "@/lib/auth/session";
import { getUserSettings } from "@/lib/user-data";
import { backfillHistoryThrottled, countItemsWithoutHistory, getLastRefresh, getMarketScan, isSnapshotStale, refreshMarket } from "@/lib/market/snapshot";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function MarketPage() {
  const user = await requireUser();

  const last = await getLastRefresh();
  let refreshError: string | null = null;
  if (!last.at) {
    // very first visit: build the snapshot before rendering
    try {
      await refreshMarket({ force: true, backfill: 20 });
    } catch (e) {
      refreshError = (e as Error).message;
    }
  } else if (isSnapshotStale(last.at)) {
    // stale: serve what we have, refresh after the response is sent
    after(() => refreshMarket().catch((e) => console.error("background market refresh failed:", e)));
  } else if ((await countItemsWithoutHistory()) > 0) {
    // fresh snapshot but history still incomplete: keep filling it in behind each page view
    after(() => backfillHistoryThrottled(100).catch((e) => console.error("background history backfill failed:", e)));
  }

  const [scan, settings] = await Promise.all([getMarketScan(), getUserSettings(user.id)]);
  return (
    <UserDataProvider initialSettings={settings} initialInventory={{}}>
      <MarketScanner
        rows={scan.rows}
        refreshedAt={scan.refreshedAt ? scan.refreshedAt.toISOString() : null}
        source={scan.source}
        refreshError={refreshError}
        user={{ username: user.username, displayName: user.displayName, role: user.role }}
      />
    </UserDataProvider>
  );
}
