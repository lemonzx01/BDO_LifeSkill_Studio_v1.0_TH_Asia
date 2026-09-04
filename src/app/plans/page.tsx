import { PlansBoard } from "@/components/PlansBoard";
import { UserDataProvider } from "@/components/UserDataProvider";
import { requireUser } from "@/lib/auth/session";
import { items, recipes } from "@/lib/data";
import { listPlans } from "@/lib/plans";
import { getUserSettings } from "@/lib/user-data";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const user = await requireUser();
  const [plansList, settings] = await Promise.all([listPlans(), getUserSettings(user.id)]);
  const recipeType = new Map(recipes.map((r) => [r.id, r.type]));
  const rows = plansList.map((p) => {
    const it = items[p.productId];
    return {
      ...p,
      productTh: it?.th ?? `#${p.productId}`,
      productGrade: it?.grade ?? 0,
      recipeType: recipeType.get(p.recipeId) ?? null,
    };
  });
  return (
    <UserDataProvider initialSettings={settings} initialInventory={{}}>
      <PlansBoard
        plans={rows}
        me={{ id: user.id, role: user.role }}
        user={{ username: user.username, displayName: user.displayName, role: user.role }}
      />
    </UserDataProvider>
  );
}
