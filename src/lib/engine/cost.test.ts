import { describe, expect, it } from "vitest";
import { CostEngine, expectedYield, flattenRequirements, netRate } from "./cost";
import { DEFAULT_SETTINGS, type CostContext, type Item, type PriceBook, type Recipe, type Settings } from "./types";

// Fixture mirrors the sample data in BDO_LifeSkill_Studio_v2.0_TH_Asia.xlsx
// MAT001..MAT012 -> 1..12, ALC001..003 -> 101..103, ELX001..003 -> 201..203
const item = (id: number, th: string, market = true, extra: Partial<Item> = {}): Item => ({
  id,
  th,
  en: th,
  cat: null,
  sub: null,
  grade: 0,
  icon: null,
  market,
  ...extra,
});

const items: Record<number, Item> = Object.fromEntries(
  [
    item(1, "น้ำบริสุทธิ์"),
    item(2, "สมุนไพรป่า"),
    item(3, "หญ้าพระอาทิตย์ขึ้น"),
    item(4, "ดอกอาซาเลียสีเงิน"),
    item(5, "น้ำตาล", false, { npcBuy: 200 }),
    item(6, "เกลือ", false, { npcBuy: 200 }),
    item(7, "เลือดหมู"),
    item(8, "ยางไม้สน"),
    item(9, "ร่องรอยแห่งความป่าเถื่อน"),
    item(10, "ผงแห่งความมืด"),
    item(11, "เห็ดลูกศร"),
    item(12, "เนื้อสิงโต"),
    item(101, "น้ำยาเคมีใส"),
    item(102, "ผงเคมีบริสุทธิ์"),
    item(103, "เลือดคนบาป"),
    item(201, "อีลิกเซอร์บ้าคลั่ง"),
    item(202, "อีลิกเซอร์ป้องกัน"),
    item(203, "อีลิกเซอร์ขั้นสูง"),
  ].map((i) => [i.id, i]),
);

const recipe = (id: number, product: number, mats: [number, number][]): Recipe => ({
  id,
  type: "alchemy",
  name: items[product].th,
  skill: { display: "", tier: 0, tierName: "", level: 1, sort: 1 },
  exp: 0,
  weight: 0,
  materials: mats.map(([mid, qty]) => ({ id: mid, qty, fixed: false })),
  products: [{ id: product, min: 1, max: 1, kind: "main" }],
});

const recipes: Recipe[] = [
  recipe(1, 101, [[1, 1], [2, 1], [5, 1], [6, 1]]),
  recipe(2, 102, [[1, 1], [3, 1], [5, 1], [10, 1]]),
  recipe(3, 103, [[101, 1], [7, 2], [10, 1], [9, 1]]),
  recipe(4, 201, [[103, 1], [8, 2], [11, 4], [102, 1]]),
  recipe(5, 202, [[101, 1], [4, 3], [8, 1]]),
  recipe(6, 203, [[201, 1], [12, 5], [102, 2]]),
];

const price = (id: number, p: number, stock = 100) => ({ id, price: p, stock, totalTrades: 1000 });
const prices: PriceBook = {
  1: price(1, 3000),
  2: price(2, 2500),
  3: price(3, 3200),
  4: price(4, 3500),
  7: price(7, 8000),
  8: price(8, 12000),
  9: price(9, 45000),
  10: price(10, 5000),
  11: price(11, 6000),
  12: price(12, 14900),
  203: price(203, 400000),
};

const settings: Settings = { ...DEFAULT_SETTINGS, valuePack: true, familyFame: 0, merchantRing: false };
const ctx = (over: Partial<CostContext> = {}): CostContext => ({ items, recipes, prices, settings, ...over });

describe("netRate", () => {
  it("uses the in-game multiplicative formula", () => {
    expect(netRate({ ...settings, valuePack: false })).toBeCloseTo(0.65);
    expect(netRate({ ...settings, valuePack: true })).toBeCloseTo(0.845);
    expect(netRate({ ...settings, valuePack: true, familyFame: 0.015 })).toBeCloseTo(0.85475);
    expect(netRate({ ...settings, valuePack: true, merchantRing: true })).toBeCloseTo(0.8775);
  });
});

describe("CostEngine recursive cost (Excel sample)", () => {
  const engine = new CostEngine(ctx());

  it("prices raw materials from the market or NPC", () => {
    expect(engine.costOf(1)).toMatchObject({ unitCost: 3000, source: "market" });
    expect(engine.costOf(5)).toMatchObject({ unitCost: 200, source: "npc" });
  });

  it("computes nested craft costs like the spreadsheet", () => {
    expect(engine.costOf(101).unitCost).toBe(5900); // 3000+2500+200+200
    expect(engine.costOf(102).unitCost).toBe(11400); // 3000+3200+200+5000
    expect(engine.costOf(103).unitCost).toBe(71900); // 5900+16000+5000+45000
    expect(engine.costOf(201).unitCost).toBe(131300); // 71900+24000+24000+11400
    expect(engine.costOf(202).unitCost).toBe(28400); // 5900+10500+12000
    expect(engine.costOf(203).unitCost).toBe(228600); // 131300+74500+22800
  });

  it("evaluates profit with the corrected net rate", () => {
    const ev = engine.evaluate(recipes[5])!;
    expect(ev.unitCost).toBe(228600);
    expect(ev.sellPrice).toBe(400000);
    expect(ev.netPerUnit).toBeCloseTo(338000);
    expect(ev.profitPerUnit).toBeCloseTo(109400);
    expect(ev.roi).toBeCloseTo(109400 / 228600);
    expect(ev.flags.unknownCost).toBe(false);
  });

  it("flattens the tree into raw material requirements", () => {
    const ev = engine.evaluate(recipes[5])!;
    const req = flattenRequirements(ev.tree, 10);
    // ELX003 x10 -> 10 ELX001 -> 10 ALC003 -> 10 ALC001 -> 10 purified water; plus 10 ALC002 (from ELX001) + 20 ALC002 (direct) -> 30 water
    expect(req.get(1)?.units).toBe(40);
    expect(req.get(12)?.units).toBe(50);
    expect(req.get(5)?.units).toBe(10 + 30); // sugar: 1 per ALC001 + 1 per ALC002
  });
});

describe("options", () => {
  it("prefers buying when the market is cheaper than crafting", () => {
    const engine = new CostEngine(ctx({ prices: { ...prices, 101: price(101, 4000) } }));
    expect(engine.costOf(101)).toMatchObject({ unitCost: 4000, source: "market" });
    const forced = new CostEngine(ctx({ prices: { ...prices, 101: price(101, 4000) }, overrides: { 101: { mode: "craft" } } }));
    expect(forced.costOf(101)).toMatchObject({ unitCost: 5900, source: "craft" });
  });

  it("values owned stock as zero or at recorded average cost", () => {
    const inventory = { 9: { qty: 50, avgCost: 30000 } };
    expect(new CostEngine(ctx({ inventory, ownedCostMode: "zero" })).costOf(103).unitCost).toBe(26900);
    expect(new CostEngine(ctx({ inventory, ownedCostMode: "avg" })).costOf(103).unitCost).toBe(56900);
    expect(new CostEngine(ctx({ inventory, ownedCostMode: "market" })).costOf(103).unitCost).toBe(71900);
  });

  it("picks the cheapest substitute per base unit inside a group", () => {
    const grouped: Recipe = {
      ...recipes[0],
      materials: [
        { id: 2, qty: 6, fixed: false, group: [{ id: 2, value: 1 }, { id: 3, value: 3 }] },
      ],
    };
    // wild herb 2500/unit vs sunrise herb 3200 for 3 units (=1066/unit)
    const engine = new CostEngine(ctx({ recipes: [grouped] }));
    const node = engine.costOf(101);
    expect(node.unitCost).toBeCloseTo(6400); // 6/3 = 2 sunrise herbs * 3200
    expect(node.children?.[0].node.substituteFor).toBe(2);
    expect(node.children?.[0].units).toBe(2);
  });

  it("never splits a high-value substitute below one whole item per craft", () => {
    const grouped: Recipe = {
      ...recipes[0],
      materials: [{ id: 6, qty: 1, fixed: false, group: [{ id: 6, value: 1 }, { id: 3, value: 16 }] }],
    };
    // salt (NPC 200) vs a "16 salts" item at 3200: one craft still needs one whole item, so salt wins
    const engine = new CostEngine(ctx({ recipes: [grouped] }));
    const node = engine.costOf(101);
    expect(node.children?.[0].node.id).toBe(6);
    expect(node.children?.[0].units).toBe(1);
    expect(node.unitCost).toBe(200);
  });

  it("flags unknown costs and sold-out materials", () => {
    const engine = new CostEngine(ctx({ prices: { ...prices, 12: undefined, 9: price(9, 45000, 0) } }));
    const ev = engine.evaluate(recipes[5])!;
    expect(ev.flags.unknownCost).toBe(true);
    expect(ev.flags.materialSoldOut).toBe(true);
  });

  it("survives recipe cycles", () => {
    const cyc: Recipe[] = [recipe(90, 101, [[102, 1]]), recipe(91, 102, [[101, 1]])];
    const engine = new CostEngine(ctx({ recipes: cyc, prices: { ...prices, 101: price(101, 1000) } }));
    expect(engine.costOf(102).unitCost).toBe(1000);
    expect(engine.costOf(101).unitCost).toBe(1000);
  });

  it("derives the expected yield from mastery", () => {
    const r: Recipe = { ...recipes[0], products: [{ id: 101, min: 1, max: 4, kind: "main" }] };
    expect(expectedYield(r, settings)).toBe(2.5); // mastery 0
    expect(expectedYield(r, { ...settings, mastery: { alchemy: 2000 } })).toBeCloseTo(3.25); // 50% max proc
    expect(expectedYield(r, { ...settings, mastery: { alchemy: 1000 } })).toBeCloseTo(2.5 + 1.5 * 0.219, 3);
    expect(expectedYield({ ...r, type: "cooking" }, { ...settings, mastery: { cooking: 2000 } })).toBeCloseTo(2.5 + 1.5 * 0.6115, 3);
    const fixed: Recipe = { ...r, products: [{ id: 101, min: 1, max: 1, kind: "main" }] };
    expect(expectedYield(fixed, { ...settings, mastery: { alchemy: 3000 } })).toBe(1);
    expect(expectedYield(r, { ...settings, yieldMultiplier: { alchemy: 1.4 } })).toBeCloseTo(3.5);
  });
});
