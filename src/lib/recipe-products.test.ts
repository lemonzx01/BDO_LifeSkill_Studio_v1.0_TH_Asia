import { describe, expect, it } from "vitest";
import type { RecipeProduct } from "@/lib/engine/types";
import { recipeProductIds } from "./recipe-products";

const prod = (id: number, kind: RecipeProduct["kind"] = "main"): RecipeProduct => ({ id, min: 1, max: 1, kind });

describe("recipeProductIds", () => {
  it("collects the main product of every recipe", () => {
    const ids = recipeProductIds([{ products: [prod(1)] }, { products: [prod(2), prod(3, "extra")] }]);
    expect([...ids].sort()).toEqual([1, 2]);
  });

  it("leaves out extra products and items that are only materials", () => {
    const ids = recipeProductIds([{ products: [prod(5, "extra"), prod(6)] }]);
    expect(ids.has(5)).toBe(false);
    expect(ids.has(6)).toBe(true);
  });

  it("falls back to the first product when none is marked main, and skips recipes with none", () => {
    const ids = recipeProductIds([{ products: [prod(7, "extra")] }, { products: [] }]);
    expect([...ids]).toEqual([7]);
  });

  it("returns an empty set for no recipes", () => {
    expect(recipeProductIds([]).size).toBe(0);
  });
});
