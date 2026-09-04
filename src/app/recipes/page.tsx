import { Suspense } from "react";
import { Studio } from "@/components/Studio";
import { UserDataProvider } from "@/components/UserDataProvider";
import { requireUser } from "@/lib/auth/session";
import { getUserInventory, getUserSettings } from "@/lib/user-data";

export const dynamic = "force-dynamic";

/** Full recipe table with filters (the home page shows the highlights). */
export default async function RecipesPage() {
  const user = await requireUser();
  const [settings, inventory] = await Promise.all([getUserSettings(user.id), getUserInventory(user.id)]);
  return (
    <UserDataProvider initialSettings={settings} initialInventory={inventory}>
      <Suspense fallback={null}>
        <Studio user={{ username: user.username, displayName: user.displayName, role: user.role }} />
      </Suspense>
    </UserDataProvider>
  );
}
