import { describe, expect, it } from "vitest";
import { diffImport, importChangeCount, importSummary, mergeImportRows, readImportRows } from "./inventory-import";

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

const items = [
  { id: 6656, th: "น้ำบริสุทธิ์", en: "Purified Water" },
  { id: 6653, th: "ขวดน้ำแม่น้ำ", en: "Bottle of River Water" },
];

describe("readImportRows", () => {
  it("reads our own export: id first, then the Thai or English name; cost is optional", () => {
    const out = readImportRows(
      [
        ["id", "ชื่อไทย", "ชื่ออังกฤษ", "จำนวน", "ต้นทุน/ชิ้น"],
        ["6656", "น้ำบริสุทธิ์", "Purified Water", "1,500", ""],
        ["", "ขวดน้ำแม่น้ำ", "", "20", "300"],
        ["", "", "purified water", "5", ""],
        ["", "ไม่มีชื่อนี้", "", "3", ""],
      ],
      items,
    );
    expect(out).toEqual({
      ok: true,
      rows: [
        { id: 6656, qty: 1500, cost: undefined },
        { id: 6653, qty: 20, cost: 300 },
        { id: 6656, qty: 5, cost: undefined },
      ],
      missing: ["ไม่มีชื่อนี้"],
    });
  });

  it("explains an empty file or one without the needed columns", () => {
    expect(readImportRows([["id", "จำนวน"]], items)).toEqual({ ok: false, error: "ไฟล์ว่างหรืออ่านไม่ได้" });
    expect(readImportRows([["ชื่อไทย", "ราคา"], ["น้ำบริสุทธิ์", "1"]], items)).toEqual({ ok: false, error: "ต้องมีคอลัมน์ จำนวน และ id หรือ ชื่อไอเท็ม" });
  });
});

describe("diffImport and importSummary", () => {
  it("counts new items and owned items whose quantity changes, not the ones that stay the same", () => {
    const totals = mergeImportRows([{ id: 6656, qty: 50 }, { id: 6653, qty: 0 }, { id: 9007, qty: 3 }, { id: 9008, qty: 0 }], "replace", owned);
    const diff = diffImport(totals, owned);
    expect(diff.added).toEqual([{ id: 9007, before: 0, after: 3 }]);
    expect(diff.changed).toEqual([{ id: 6653, before: 30, after: 0 }]);
    expect(diff.costChanged).toEqual([]);
    expect(importChangeCount(diff)).toBe(2);
  });

  it("reports a cost the file overwrites, with or without a new quantity, but not a cost that stays", () => {
    const totals = mergeImportRows(
      [
        { id: 6656, qty: 50, cost: 4000 }, // same quantity, new cost
        { id: 6653, qty: 40, cost: 300 }, // new quantity and a first cost
        { id: 9007, qty: 3, cost: 120 }, // a new item: its cost is not a change
      ],
      "replace",
      owned,
    );
    const diff = diffImport(totals, owned);
    expect(diff.costChanged).toEqual([{ id: 6656, before: 50, after: 50, cost: { before: 5000, after: 4000 } }]);
    expect(diff.changed).toEqual([{ id: 6653, before: 30, after: 40, cost: { before: undefined, after: 300 } }]);
    expect(diff.added).toEqual([{ id: 9007, before: 0, after: 3 }]);
    expect(importChangeCount(diff)).toBe(3);

    // re-importing the same numbers and costs changes nothing
    const same = diffImport(mergeImportRows([{ id: 6656, qty: 50, cost: 5000 }, { id: 6653, qty: 30 }], "replace", owned), owned);
    expect(importChangeCount(same)).toBe(0);
  });

  it("names the mode and leaves out the cost and not-found parts when there are none", () => {
    expect(importSummary(3, 2, 1, "replace")).toBe("เพิ่มใหม่ 3 · เปลี่ยนจำนวน 2 · ไม่พบชื่อ 1 (โหมด ทับจำนวนเดิม)");
    expect(importSummary(0, 4, 0, "add")).toBe("เพิ่มใหม่ 0 · เปลี่ยนจำนวน 4 (โหมด บวกเพิ่มจากที่มี)");
    expect(importSummary(0, 1, 0, "replace", 2)).toBe("เพิ่มใหม่ 0 · เปลี่ยนจำนวน 1 · เปลี่ยนต้นทุน 2 (โหมด ทับจำนวนเดิม)");
  });
});
