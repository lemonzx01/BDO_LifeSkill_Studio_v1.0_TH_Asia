import { Studio } from "@/components/Studio";
import { items, meta, recipes } from "@/lib/data";

export default function Home() {
  return <Studio recipes={recipes} items={items} importedAt={meta.importedAt} />;
}
