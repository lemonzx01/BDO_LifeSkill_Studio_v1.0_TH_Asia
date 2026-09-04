import { describe, expect, it } from "vitest";
import { assessRecovery, sellEvidence } from "./evidence";
import type { ScanRow } from "./snapshot";

const base: ScanRow = {
  id: 1,
  th: "ของทดสอบ",
  en: "Test",
  grade: 0,
  cat: "material",
  sub: null,
  price: 800,
  stock: 5000,
  trades: 100000,
  vol14: 14000,
  avg90: 1000,
  min90: 700,
  max90: 1300,
  avg30: 950,
  avg7: 780,
  days: 60,
  stockHist: [9000, 7000, 5000],
  tradesPerDay: 1000,
};

describe("recovery evidence", () => {
  it("scores a cheap, shrinking-stock, fast-selling item as likely to recover", () => {
    const a = assessRecovery(base);
    expect(a.level).toBe("สูง");
    expect(a.score).toBeGreaterThanOrEqual(65);
    expect(a.daysToClear).toBe(5);
    expect(a.lines.filter((l) => l.ok === true).length).toBeGreaterThanOrEqual(3);
    expect(a.lines.some((l) => l.text.includes("ลดลง 2 วันติด"))).toBe(true);
  });

  it("scores a cheap item with piling stock and no buyers as unlikely", () => {
    const a = assessRecovery({ ...base, stock: 200000, stockHist: [100000, 150000, 200000], vol14: 30, tradesPerDay: null, avg7: 900 });
    expect(a.level).toBe("ต่ำ");
    expect(a.lines.some((l) => l.ok === false && l.text.includes("เพิ่มขึ้น"))).toBe(true);
    expect(a.lines.some((l) => l.ok === false && l.text.includes("ราคาแกว่งง่าย"))).toBe(true);
  });

  it("refuses to score without price history and explains missing stock history", () => {
    expect(assessRecovery({ ...base, avg90: null, days: 1 }).level).toBe("ไม่พอข้อมูล");
    const a = assessRecovery({ ...base, stockHist: [5000] });
    expect(a.lines.some((l) => l.ok === null && l.text.includes("เก็บแล้ว 1 วัน"))).toBe(true);
    expect(a.level).not.toBe("สูง"); // capped until stock history exists
  });

  it("describes the sell side", () => {
    const lines = sellEvidence({ ...base, price: 1290, stock: 0 });
    expect(lines[0].ok).toBe(true);
    expect(lines.some((l) => l.text.includes("สูงสุดใน 90 วัน"))).toBe(true);
    expect(lines.some((l) => l.text.includes("ของหมดตลาด"))).toBe(true);
  });
});
