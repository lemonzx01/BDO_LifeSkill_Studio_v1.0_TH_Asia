import { Suspense } from "react";
import { TradeCalc } from "@/components/TradeCalc";
import { UserDataProvider } from "@/components/UserDataProvider";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { requireUser } from "@/lib/auth/session";
import { getUserSettings } from "@/lib/user-data";

export const dynamic = "force-dynamic";

/** Tax / trade calculator: buy at X, sell at Y, how much do I actually make. */
export default async function CalcPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const [settings, { item }] = await Promise.all([getUserSettings(user.id), searchParams]);
  // this page does not load the inventory (null: the provider must not treat it as empty)
  return (
    <UserDataProvider userId={user.id} initialSettings={settings} initialInventory={null}>
      <Suspense fallback={<PageSkeleton width="narrow" rows={4} />}>
        {/* a fresh calculator per ?item= (e.g. Ctrl+K → คิดภาษี while already here): the buy and sell
            prices start from the new item's link, not the previous item's numbers */}
        <TradeCalc key={String(item ?? "")} user={{ username: user.username, displayName: user.displayName, role: user.role }} />
      </Suspense>
    </UserDataProvider>
  );
}
