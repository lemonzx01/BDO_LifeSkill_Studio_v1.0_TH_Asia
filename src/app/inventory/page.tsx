import { InventoryManager, type ItemLite } from "@/components/InventoryManager";
import { UserDataProvider } from "@/components/UserDataProvider";
import { getVisitor } from "@/lib/auth/session";
import { items } from "@/lib/data";
import { getUserInventory, getUserSettings } from "@/lib/user-data";

export const dynamic = "force-dynamic";

/** Open to everyone: a visitor who is not signed in keeps the inventory in this browser. */
export default async function InventoryPage() {
  const { user, sessionEnded } = await getVisitor();
  const [settings, inventory] = user ? await Promise.all([getUserSettings(user.id), getUserInventory(user.id)]) : [null, null];
  const lite: ItemLite[] = Object.values(items).map((i) => ({ id: i.id, th: i.th, en: i.en, grade: i.grade, market: i.market }));
  return (
    <UserDataProvider userId={user?.id ?? null} initialSettings={settings} initialInventory={inventory} sessionEnded={sessionEnded}>
      <InventoryManager items={lite} user={user && { username: user.username, displayName: user.displayName, role: user.role }} />
    </UserDataProvider>
  );
}
