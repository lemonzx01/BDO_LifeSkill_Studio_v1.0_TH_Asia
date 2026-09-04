import { describe, expect, it } from "vitest";
import { tradeMath } from "./trade";

describe("tradeMath", () => {
  it("matches the in-game tax with Value Pack (15.5%)", () => {
    const r = tradeMath({ qty: 1, buyPrice: 0, sellPrice: 9900, valuePack: true, merchantRing: false, familyFame: 0 });
    expect(r.taxRate).toBeCloseTo(0.155);
    expect(Math.round(r.tax)).toBe(1535); // the game shows 1,534 due to floor rounding
    expect(Math.round(r.received)).toBe(8366);
  });

  it("computes profit, loss and break-even for buy-then-sell", () => {
    const r = tradeMath({ qty: 100, buyPrice: 1000, sellPrice: 1300, valuePack: true, merchantRing: true, familyFame: 0.015 });
    expect(r.rate).toBeCloseTo(0.65 * 1.365);
    expect(r.cost).toBe(100000);
    expect(r.received).toBeCloseTo(130000 * 0.65 * 1.365);
    expect(r.profit).toBeCloseTo(r.received - 100000);
    expect(r.breakEvenSell).toBeCloseTo(1000 / (0.65 * 1.365));
    const loss = tradeMath({ qty: 10, buyPrice: 1000, sellPrice: 1100, valuePack: false, merchantRing: false, familyFame: 0 });
    expect(loss.profit).toBeLessThan(0); // 1100 * 0.65 = 715 < 1000
  });
});
