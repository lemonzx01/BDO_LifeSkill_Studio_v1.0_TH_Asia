import { describe, expect, it } from "vitest";
import { planProduction } from "./consume";

describe("planProduction", () => {
  const inventory = { 1: { qty: 10 }, 2: { qty: 3 }, 9: { qty: 5 } };

  it("deducts what is owned up to what the plan needs and adds the product", () => {
    const changes = planProduction(inventory, [{ id: 1, need: 4 }, { id: 2, need: 8 }, { id: 3, need: 2 }], { id: 9, units: 7.6 });
    expect(changes).toEqual([
      { id: 1, before: 10, after: 6 },
      { id: 2, before: 3, after: 0 }, // short by five: those were bought, so only the owned three go
      { id: 9, before: 5, after: 13 },
    ]);
  });

  it("skips materials that are not owned and rounds fractional needs up", () => {
    expect(planProduction(inventory, [{ id: 3, need: 2 }, { id: 1, need: 0.2 }])).toEqual([{ id: 1, before: 10, after: 9 }]);
  });
});
