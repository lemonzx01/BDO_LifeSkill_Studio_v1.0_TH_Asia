import { InventoryManager, type ItemLite } from "@/components/InventoryManager";
import { UserDataProvider } from "@/components/UserDataProvider";
import { requireUser } from "@/lib/auth/session";
import { items } from "@/lib/data";
import { getUserInventory, getUserSettings } from "@/lib/user-data";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const user = await requireUser();
  const [settings, inventory] = await Promise.all([getUserSettings(user.id), getUserInventory(user.id)]);
  const lite: ItemLite[] = Object.values(items).map((i) => ({ id: i.id, th: i.th, en: i.en, grade: i.grade, market: i.market }));
  return (
    <UserDataProvider initialSettings={settings} initialInventory={inventory}>
      <InventoryManager items={lite} user={{ username: user.username, displayName: user.displayName, role: user.role }} />
    </UserDataProvider>
  );
}
