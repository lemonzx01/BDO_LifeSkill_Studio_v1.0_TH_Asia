import { describe, expect, it } from "vitest";
import type { RecipeEvaluation } from "./engine/types";
import { heroPicks, homeRank, isFeasible, isRecipeSort, topPicks } from "./home-picks";

let nextId = 1;
function ev(over: { productId: number; profitPerUnit: number; profitPerHour?: number; imperial?: boolean; flags?: Partial<RecipeEvaluation["flags"]> }): RecipeEvaluation {
  return {
    recipe: { id: nextId++ },
    productId: over.productId,
    profitPerUnit: over.profitPerUnit,
    profitPerHour: over.profitPerHour ?? 0,
    saleChannel: over.imperial ? "imperial" : "market",
    flags: { unknownCost: false, materialSoldOut: false, productNoPrice: false, productNotMarketable: false, aboveSkill: false, ...over.flags },
  } as unknown as RecipeEvaluation;
}

describe("homeRank", () => {
  it("keeps per hour and maps every other saved sort to per unit", () => {
    expect(homeRank("profitPerHour")).toBe("profitPerHour");
    expect(homeRank("profitPerUnit")).toBe("profitPerUnit");
    expect(homeRank("roi")).toBe("profitPerUnit");
    expect(homeRank("unitCost")).toBe("profitPerUnit");
  });

  it("accepts only the recipes page's sort names", () => {
    expect(isRecipeSort("roi")).toBe(true);
    expect(isRecipeSort("price")).toBe(false);
    expect(isRecipeSort(3)).toBe(false);
  });
});

describe("isFeasible", () => {
  it("needs a known cost, a price, a market, the skill tier and a profit", () => {
    expect(isFeasible(ev({ productId: 1, profitPerUnit: 10 }))).toBe(true);
    expect(isFeasible(ev({ productId: 1, profitPerUnit: 0 }))).toBe(false);
    expect(isFeasible(ev({ productId: 1, profitPerUnit: 10, flags: { unknownCost: true } }))).toBe(false);
    expect(isFeasible(ev({ productId: 1, profitPerUnit: 10, flags: { aboveSkill: true } }))).toBe(false);
    // a sold-out material still counts: it only gets a note
    expect(isFeasible(ev({ productId: 1, profitPerUnit: 10, flags: { materialSoldOut: true } }))).toBe(true);
  });
});

describe("topPicks", () => {
  const a = ev({ productId: 1, profitPerUnit: 100, profitPerHour: 1000 });
  const b = ev({ productId: 2, profitPerUnit: 300, profitPerHour: 500 });
  const c = ev({ productId: 3, profitPerUnit: 200, profitPerHour: 2000 });
  const box = ev({ productId: 4, profitPerUnit: 5000, imperial: true });

  it("ranks by profit per unit", () => {
    expect(topPicks([a, b, c, box], "profitPerUnit", 3).map((e) => e.productId)).toEqual([4, 2, 3]);
  });

  it("ranks by profit per hour, imperial boxes last", () => {
    expect(topPicks([box, a, b, c], "profitPerHour", 4).map((e) => e.productId)).toEqual([3, 1, 2, 4]);
  });

  it("keeps one recipe per product, the best one", () => {
    const a2 = ev({ productId: 1, profitPerUnit: 150, profitPerHour: 100 });
    const picks = topPicks([a, a2, b], "profitPerUnit", 5);
    expect(picks.map((e) => e.productId)).toEqual([2, 1]);
    expect(picks[1]).toBe(a2);
  });

  it("breaks a per-hour tie by profit per unit", () => {
    const x = ev({ productId: 5, profitPerUnit: 10, profitPerHour: 0 });
    const y = ev({ productId: 6, profitPerUnit: 20, profitPerHour: 0 });
    expect(topPicks([x, y], "profitPerHour", 2).map((e) => e.productId)).toEqual([6, 5]);
  });

  it("stops at n and leaves the input alone", () => {
    const list = [a, b, c];
    expect(topPicks(list, "profitPerUnit", 1)).toHaveLength(1);
    expect(list.map((e) => e.productId)).toEqual([1, 2, 3]);
  });
});

describe("heroPicks", () => {
  it("leaves imperial boxes out in both orders", () => {
    const a = ev({ productId: 1, profitPerUnit: 100, profitPerHour: 1000 });
    const b = ev({ productId: 2, profitPerUnit: 300, profitPerHour: 500 });
    const box = ev({ productId: 4, profitPerUnit: 5000, imperial: true });
    expect(heroPicks([box, a, b], "profitPerUnit", 3).map((e) => e.productId)).toEqual([2, 1]);
    expect(heroPicks([box, a, b], "profitPerHour", 3).map((e) => e.productId)).toEqual([1, 2]);
  });
});
