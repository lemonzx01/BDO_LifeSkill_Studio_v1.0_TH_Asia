import { Studio } from "@/components/Studio";
import { requireUser } from "@/lib/auth/session";
import { items, meta, recipes } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireUser();
  return (
    <Studio
      recipes={recipes}
      items={items}
      importedAt={meta.importedAt}
      user={{ username: user.username, displayName: user.displayName, role: user.role }}
    />
  );
}
