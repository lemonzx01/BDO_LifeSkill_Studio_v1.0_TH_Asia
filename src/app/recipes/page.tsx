import { Suspense } from "react";
import { Studio } from "@/components/Studio";
import { UserDataProvider } from "@/components/UserDataProvider";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { getVisitor } from "@/lib/auth/session";
import { getUserInventory, getUserSettings } from "@/lib/user-data";

export const dynamic = "force-dynamic";

/** Full recipe table with filters (the home page shows the highlights). Open to everyone. */
export default async function RecipesPage() {
  const { user, sessionEnded } = await getVisitor();
  // not signed in: settings and inventory come from this browser (UserDataProvider)
  const [settings, inventory] = user ? await Promise.all([getUserSettings(user.id), getUserInventory(user.id)]) : [null, null];
  return (
    <UserDataProvider userId={user?.id ?? null} initialSettings={settings} initialInventory={inventory} sessionEnded={sessionEnded}>
      <Suspense fallback={<PageSkeleton label="กำลังโหลดสูตร…" />}>
        <Studio user={user && { username: user.username, displayName: user.displayName, role: user.role }} />
      </Suspense>
    </UserDataProvider>
  );
}
