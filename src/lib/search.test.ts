import { describe, expect, it } from "vitest";
import { rankByName } from "./search";

const items = [
  { id: 1, th: "น้ำบริสุทธิ์แห่งธรรมชาติ", en: "Essence of Nature" },
  { id: 2, th: "น้ำบริสุทธิ์สีดำ", en: "Black Essence" },
  { id: 3, th: "น้ำสมุนไพรบริสุทธิ์", en: "Refined Herbal Juice" },
  { id: 4, th: "น้ำบริสุทธิ์", en: "Purified Water" },
  { id: 5, th: "ขวดน้ำบริสุทธิ์พิเศษ", en: "Special Purified Water" },
];

describe("rankByName", () => {
  it("puts the exact name first, then prefixes by length, then substrings", () => {
    expect(rankByName(items, "น้ำบริสุทธิ์").map((i) => i.id)).toEqual([4, 2, 1, 5]);
  });
  it("matches English names too and respects the limit", () => {
    expect(rankByName(items, "purified water", 2).map((i) => i.id)).toEqual([4, 5]);
  });
  it("needs at least two characters", () => {
    expect(rankByName(items, "น")).toEqual([]);
  });
});
