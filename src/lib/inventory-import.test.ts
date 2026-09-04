import { describe, expect, it } from "vitest";
import { mergeImportRows } from "./inventory-import";

const owned = { 6656: { qty: 50, avgCost: 5000 }, 6653: { qty: 30 } };

describe("mergeImportRows", () => {
  it("replace: the file's number wins, repeated rows in one file add up, missing items are untouched", () => {
    const out = mergeImportRows([{ id: 6656, qty: 500 }, { id: 6656, qty: 20 }, { id: 9007, qty: 3, cost: 120 }], "replace", owned);
    expect(out.get(6656)).toEqual({ qty: 520, cost: undefined });
    expect(out.get(9007)).toEqual({ qty: 3, cost: 120 });
    expect(out.has(6653)).toBe(false);
  });

  it("add: starts from what is owned so one file per storage sums up", () => {
    const first = mergeImportRows([{ id: 6656, qty: 100 }], "add", owned);
    expect(first.get(6656)?.qty).toBe(150);
    const second = mergeImportRows([{ id: 6656, qty: 30 }, { id: 6653, qty: 0 }], "add", { ...owned, 6656: { qty: 150 } });
    expect(second.get(6656)?.qty).toBe(180);
    expect(second.get(6653)?.qty).toBe(30); // adding zero keeps the item
  });

  it("ignores negative or fractional quantities and blank costs", () => {
    const out = mergeImportRows([{ id: 1, qty: -5 }, { id: 2, qty: 2.9, cost: 0 }], "replace", {});
    expect(out.get(1)).toEqual({ qty: 0, cost: undefined });
    expect(out.get(2)).toEqual({ qty: 2, cost: undefined });
  });
});
