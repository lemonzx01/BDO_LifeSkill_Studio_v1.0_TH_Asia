import { describe, expect, it } from "vitest";
import { ideasFromInventory } from "./ideas";
import { DEFAULT_SETTINGS, type Item, type PriceBook, type Recipe } from "./types";

const item = (id: number, th: string, market = true, extra: Partial<Item> = {}): Item => ({ id, th, en: th, cat: null, sub: null, grade: 0, icon: null, market, ...extra });
const items: Record<number, Item> = Object.fromEntries(
  [item(1, "น้ำ"), item(2, "สมุนไพร"), item(3, "สมุนไพรระดับสูง"), item(5, "น้ำตาล", false, { npcBuy: 200 }), item(101, "น้ำยา"), item(201, "อีลิกเซอร์")].map((i) => [i.id, i]),
);
const recipes: Recipe[] = [
  {
    id: 1,
    type: "alchemy",
    name: "น้ำยา",
    skill: { display: "", tier: 0, tierName: "", level: 1, sort: 1 },
    exp: 0,
    weight: 0,
    materials: [
      { id: 1, qty: 1, fixed: false },
      { id: 2, qty: 2, fixed: false, group: [{ id: 2, value: 1 }, { id: 3, value: 3 }] },
      { id: 5, qty: 1, fixed: false },
    ],
    products: [{ id: 101, min: 1, max: 1, kind: "main" }],
  },
  {
    id: 2,
    type: "alchemy",
    name: "อีลิกเซอร์",
    skill: { display: "", tier: 0, tierName: "", level: 1, sort: 1 },
    exp: 0,
    weight: 0,
    materials: [{ id: 101, qty: 1, fixed: false }],
    products: [{ id: 201, min: 1, max: 1, kind: "main" }],
  },
];
const price = (id: number, p: number) => ({ id, price: p, stock: 10, totalTrades: 1 });
const prices: PriceBook = { 1: price(1, 1000), 2: price(2, 500), 3: price(3, 900), 101: price(101, 10000), 201: price(201, 50000) };
const settings = { ...DEFAULT_SETTINGS, valuePack: true };

describe("ideasFromInventory", () => {
  it("finds what can be crafted from owned stock, using substitutes and NPC items", () => {
    // 3 water, 1 high-grade herb (=3 herbs, enough for one craft needing 2), 10 sugar
    const ideas = ideasFromInventory({ recipes, items, prices, inventory: { 1: { qty: 3 }, 3: { qty: 1 }, 5: { qty: 10 } }, settings });
    expect(ideas).toHaveLength(1);
    const idea = ideas[0];
    expect(idea.productId).toBe(101);
    expect(idea.crafts).toBe(1); // limited by the single high-grade herb
    expect(idea.uses.map((u) => [u.id, u.units])).toEqual([
      [1, 1],
      [3, 1],
      [5, 1],
    ]);
    expect(idea.materialsValue).toBe(1000 + 900 + 200);
    expect(idea.revenue).toBeCloseTo(10000 * 0.845);
    expect(idea.profit).toBeCloseTo(8450 - 2100);
  });

  it("returns nothing when an ingredient is missing, and caps crafts", () => {
    expect(ideasFromInventory({ recipes, items, prices, inventory: { 1: { qty: 3 }, 5: { qty: 1 } }, settings })).toHaveLength(0);
    const many = ideasFromInventory({ recipes, items, prices, inventory: { 101: { qty: 5000 } }, settings, maxCrafts: 100 });
    expect(many[0].productId).toBe(201);
    expect(many[0].crafts).toBe(100);
  });
});
