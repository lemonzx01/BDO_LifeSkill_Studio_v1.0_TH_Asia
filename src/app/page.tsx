import { Dashboard } from "@/components/Dashboard";
import { UserDataProvider } from "@/components/UserDataProvider";
import { requireUser } from "@/lib/auth/session";
import { getUserInventory, getUserSettings } from "@/lib/user-data";

export const dynamic = "force-dynamic";

/** Home: "what should I make today" highlights + first-time setup. */
export default async function Home() {
  const user = await requireUser();
  const [settings, inventory] = await Promise.all([getUserSettings(user.id), getUserInventory(user.id)]);
  return (
    <UserDataProvider userId={user.id} initialSettings={settings} initialInventory={inventory}>
      <Dashboard user={{ username: user.username, displayName: user.displayName, role: user.role }} hasSettings={settings !== null} />
    </UserDataProvider>
  );
}
