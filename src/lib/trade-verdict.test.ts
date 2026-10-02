import { describe, expect, it } from "vitest";
import { tradeMath } from "./engine/trade";
import { normalPrice, tradeVerdict } from "./trade-verdict";

const calc = (qty: number, buy: number, sell: number) => tradeMath({ qty, buyPrice: buy, sellPrice: sell, valuePack: true, merchantRing: false, familyFame: 0 });

describe("normalPrice", () => {
  it("averages the official history, skipping empty days", () => {
    expect(normalPrice([100, 0, 200, 300], [{ price: 9999 }])).toBe(200);
  });

  it("falls back to our daily rows, then to null", () => {
    expect(normalPrice([], [{ price: 1000 }, { price: 2001 }])).toBe(1501);
    expect(normalPrice([0, 0], [])).toBeNull();
    expect(normalPrice(undefined, undefined)).toBeNull();
  });
});

describe("tradeVerdict", () => {
  it("says คุ้ม with the profit and ROI when the sale beats the cost after tax", () => {
    const v = tradeVerdict(calc(10, 100_000, 140_000), { qty: 10, buy: 100_000, sell: 140_000 });
    expect(v.tone).toBe("good");
    // 1,400,000 × 0.845 = 1,183,000 − 1,000,000 = 183,000 (ROI 18.3%)
    expect(v.text).toBe("คุ้ม · กำไร 183.0K (ROI 18%)");
    expect(v.breakEven).toBe(`ต้องขายอย่างน้อย ${(118_344).toLocaleString("th-TH")} ถึงเท่าทุน`);
  });

  it("says ไม่คุ้ม with the loss when the tax eats the margin", () => {
    const v = tradeVerdict(calc(1, 1_000_000, 1_000_000), { qty: 1, buy: 1_000_000, sell: 1_000_000 });
    expect(v.tone).toBe("bad");
    expect(v.text).toBe("ไม่คุ้ม · ขาดทุน 155.0K");
  });

  it("shows a small ROI with one decimal instead of 0%", () => {
    // 1,186 × 0.845 = 1,002.17: a profit of 2 on 1,000
    const v = tradeVerdict(calc(1, 1000, 1186), { qty: 1, buy: 1000, sell: 1186 });
    expect(v.text).toBe("คุ้ม · กำไร 2 (ROI 0.2%)");
  });

  it("asks for what is missing", () => {
    expect(tradeVerdict(calc(1, 0, 5000), { qty: 1, buy: 0, sell: 5000 })).toEqual({ tone: "neutral", text: "ใส่ราคาซื้อเพื่อดูกำไร", breakEven: null });
    expect(tradeVerdict(calc(1, 5000, 0), { qty: 1, buy: 5000, sell: 0 }).text).toBe("ใส่ราคาขายเพื่อดูกำไร");
    expect(tradeVerdict(calc(0, 5000, 9000), { qty: 0, buy: 5000, sell: 9000 }).text).toBe("ใส่จำนวนเพื่อดูกำไร");
  });

  it("calls an exact break-even neither good nor bad", () => {
    const r = { ...calc(1, 845, 1000), profit: 0.2 };
    expect(tradeVerdict(r, { qty: 1, buy: 845, sell: 1000 }).tone).toBe("neutral");
  });
});
