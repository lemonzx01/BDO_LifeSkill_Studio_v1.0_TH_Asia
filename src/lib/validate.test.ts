import { describe, expect, it } from "vitest";
import { AVG_COST_MAX, parseAvgCost, parseId, parseIdList, parseQty, PG_INT_MAX } from "./validate";

describe("parseId", () => {
  it("accepts whole ids from numbers and digit strings", () => {
    expect(parseId(1)).toBe(1);
    expect(parseId(5301)).toBe(5301);
    expect(parseId("5301")).toBe(5301);
    expect(parseId(PG_INT_MAX)).toBe(PG_INT_MAX);
    expect(parseId(String(PG_INT_MAX))).toBe(PG_INT_MAX);
  });

  it("rejects zero, negatives, fractions, out-of-range and non-numbers", () => {
    for (const v of [0, -1, 1.5, PG_INT_MAX + 1, Number.NaN, Infinity, "0", "-3", "1.5", "1e3", " 7", "", "abc", "99999999999", null, undefined, true, {}, [1]]) {
      expect(parseId(v), String(v)).toBeNull();
    }
  });
});

describe("parseQty", () => {
  it("floors finite numbers and keeps 0..PG_INT_MAX", () => {
    expect(parseQty(0)).toBe(0);
    expect(parseQty(40)).toBe(40);
    expect(parseQty(3.9)).toBe(3);
    expect(parseQty(PG_INT_MAX)).toBe(PG_INT_MAX);
    expect(parseQty(PG_INT_MAX + 0.5)).toBe(PG_INT_MAX);
  });

  it("rejects negatives, overflow and anything that is not a finite number", () => {
    for (const v of [-1, -0.5, PG_INT_MAX + 1, 1e20, Number.NaN, Infinity, "5", null, undefined, true]) {
      expect(parseQty(v), String(v)).toBeNull();
    }
  });
});

describe("parseAvgCost", () => {
  it("passes undefined and null through and rounds numbers", () => {
    expect(parseAvgCost(undefined)).toEqual({ ok: true, value: undefined });
    expect(parseAvgCost(null)).toEqual({ ok: true, value: null });
    expect(parseAvgCost(0)).toEqual({ ok: true, value: 0 });
    expect(parseAvgCost(12000.6)).toEqual({ ok: true, value: 12001 });
    expect(parseAvgCost(AVG_COST_MAX)).toEqual({ ok: true, value: AVG_COST_MAX });
  });

  it("rejects negatives, huge values and non-numbers", () => {
    for (const v of [-1, AVG_COST_MAX + 1, Number.NaN, Infinity, "100", true, {}]) {
      expect(parseAvgCost(v).ok, String(v)).toBe(false);
    }
  });
});

describe("parseIdList", () => {
  it("parses, skips empty pieces and drops duplicates", () => {
    expect(parseIdList("1,2,3", 10)).toEqual([1, 2, 3]);
    expect(parseIdList("5, 6,,5,", 10)).toEqual([5, 6]);
    expect(parseIdList("", 10)).toEqual([]);
  });

  it("refuses non-integers and too many pieces", () => {
    expect(parseIdList("1,2.5", 10)).toBeNull();
    expect(parseIdList("1,abc", 10)).toBeNull();
    expect(parseIdList("1,-2", 10)).toBeNull();
    expect(parseIdList("1,2,3", 2)).toBeNull();
    expect(parseIdList(",,,", 2)).toBeNull(); // 4 pieces, even though all are empty
  });
});
