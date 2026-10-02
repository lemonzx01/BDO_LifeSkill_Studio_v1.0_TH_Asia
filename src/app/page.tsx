import { Dashboard } from "@/components/Dashboard";
import { UserDataProvider } from "@/components/UserDataProvider";
import { getVisitor } from "@/lib/auth/session";
import { getUserInventory, getUserSettings } from "@/lib/user-data";

export const dynamic = "force-dynamic";

/** Home: "what should I make today" highlights + first-time setup. Open to everyone. */
export default async function Home() {
  const { user, sessionEnded } = await getVisitor();
  if (!user) {
    // not signed in: settings, inventory and stars come from this browser (UserDataProvider)
    return (
      <UserDataProvider userId={null} initialSettings={null} initialInventory={null} sessionEnded={sessionEnded}>
        <Dashboard user={null} />
      </UserDataProvider>
    );
  }
  const [settings, inventory] = await Promise.all([getUserSettings(user.id), getUserInventory(user.id)]);
  return (
    <UserDataProvider userId={user.id} initialSettings={settings} initialInventory={inventory}>
      <Dashboard user={{ username: user.username, displayName: user.displayName, role: user.role }} />
    </UserDataProvider>
  );
}
