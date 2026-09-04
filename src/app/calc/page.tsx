import { Suspense } from "react";
import { TradeCalc } from "@/components/TradeCalc";
import { UserDataProvider } from "@/components/UserDataProvider";
import { requireUser } from "@/lib/auth/session";
import { getUserSettings } from "@/lib/user-data";

export const dynamic = "force-dynamic";

/** Tax / trade calculator: buy at X, sell at Y, how much do I actually make. */
export default async function CalcPage() {
  const user = await requireUser();
  const settings = await getUserSettings(user.id);
  return (
    <UserDataProvider initialSettings={settings} initialInventory={{}}>
      <Suspense fallback={null}>
        <TradeCalc user={{ username: user.username, displayName: user.displayName, role: user.role }} />
      </Suspense>
    </UserDataProvider>
  );
}
