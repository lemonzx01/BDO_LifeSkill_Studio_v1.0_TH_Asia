import { describe, expect, it } from "vitest";
import itemsJson from "@/data/items.json";
import recipesJson from "@/data/recipes.json";
import { ideasFromInventory } from "./ideas";
import { DEFAULT_SETTINGS, type Inventory, type Item, type ItemId, type PriceBook, type Recipe } from "./types";

/** Runs against the real recipe database so a regression in the inventory search shows up as a slow test. */
describe("ideasFromInventory on the real database", () => {
  const recipes = recipesJson as unknown as Recipe[];
  const items = itemsJson as unknown as Record<ItemId, Item>;

  it("stays fast with a realistic stock and finds chained recipes", () => {
    // pretend every market item is priced (its NPC price or 10k) so most recipes are sellable
    const prices: PriceBook = {};
    for (const it of Object.values(items)) if (it.market) prices[it.id] = { id: it.id, price: 10_000, stock: 100, totalTrades: 1000 };
    // stock: the 60 most-used raw materials, 500 each
    const counts = new Map<ItemId, number>();
    for (const r of recipes) for (const m of r.materials) counts.set(m.id, (counts.get(m.id) ?? 0) + 1);
    const inventory: Inventory = {};
    for (const [id] of [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60)) inventory[id] = { qty: 500 };

    const t0 = performance.now();
    const ideas = ideasFromInventory({ recipes, items, prices, inventory, settings: DEFAULT_SETTINGS });
    const ms = performance.now() - t0;
    console.log(`ideas: ${ideas.length} in ${ms.toFixed(0)} ms; chained: ${ideas.filter((i) => i.steps.length).length}`);
    expect(ideas.length).toBeGreaterThan(0);
    expect(ideas.some((i) => i.steps.length > 0)).toBe(true);
    // generous: this guards against an algorithmic regression, not a busy CPU (tsc + eslint often run alongside)
    expect(ms).toBeLessThan(8000);
  });
});
