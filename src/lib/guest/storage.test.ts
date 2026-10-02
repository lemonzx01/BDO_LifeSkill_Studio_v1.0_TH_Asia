import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/engine/types";
import { normalizeSettings } from "@/lib/settings";
import {
  GUEST_KEYS,
  GUEST_MAX_CHARS,
  GUEST_MAX_FAVORITES,
  GUEST_MAX_ITEMS,
  GUEST_NAME_MAX,
  hasGuestData,
  parseGuestFavorites,
  parseGuestInventory,
  parseGuestSettings,
  readGuestData,
  summarizeGuestData,
} from "./storage";

const json = (v: unknown) => JSON.stringify(v);

describe("guest settings", () => {
  it("reads saved settings and fills in what is missing", () => {
    const s = parseGuestSettings(json({ valuePack: false, mastery: { alchemy: 1200 } }));
    expect(s?.valuePack).toBe(false);
    expect(s?.mastery).toEqual({ alchemy: 1200, cooking: 0, processing: 0 });
    expect(s?.craftsPerHour).toEqual(DEFAULT_SETTINGS.craftsPerHour);
  });

  it("is null when nothing usable is stored", () => {
    for (const raw of [null, "", "{", "null", "42", '"text"', "[]", "[1,2]", "true"]) expect(parseGuestSettings(raw), String(raw)).toBeNull();
  });

  it("drops junk values, unknown keys and prototype tricks", () => {
    const s = parseGuestSettings(
      '{"__proto__":{"polluted":1},"valuePack":"yes","familyFame":"1e9","extraBonus":1e999,"ownedCostMode":"free",' +
        '"mastery":{"alchemy":"999","cooking":null,"processing":800,"constructor":5,"__proto__":{"x":1}},"skillTier":[1,2,3]}',
    );
    expect(s).not.toBeNull();
    expect(s!.valuePack).toBe(DEFAULT_SETTINGS.valuePack);
    expect(s!.familyFame).toBe(DEFAULT_SETTINGS.familyFame);
    expect(s!.extraBonus).toBe(DEFAULT_SETTINGS.extraBonus);
    expect(s!.ownedCostMode).toBe("market");
    expect(s!.mastery).toEqual({ alchemy: 0, cooking: 0, processing: 800 });
    expect(Object.keys(s!.mastery).sort()).toEqual(["alchemy", "cooking", "processing"]);
    expect(s!.skillTier).toEqual(DEFAULT_SETTINGS.skillTier);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("normalizeSettings keeps valid settings exactly as they were", () => {
    const valid = { ...DEFAULT_SETTINGS, valuePack: false, familyFame: 0.05, mastery: { alchemy: 1500, cooking: 900, processing: 300 }, ownedCostMode: "avg" as const };
    expect(normalizeSettings(valid)).toEqual(valid);
  });

  it("ignores a value that is far too long", () => {
    const big = json({ valuePack: false, pad: "x".repeat(GUEST_MAX_CHARS) });
    expect(parseGuestSettings(big)).toBeNull();
  });
});

describe("guest inventory", () => {
  it("reads rows with quantity, cost and time", () => {
    const inv = parseGuestInventory(json({ "5301": { qty: 40, avgCost: 12000, updatedAt: 1700000000000 }, "6354": { qty: 3 } }));
    expect(inv).toEqual({ 5301: { qty: 40, avgCost: 12000, updatedAt: 1700000000000 }, 6354: { qty: 3 } });
  });

  it("drops rows with a bad id or quantity, and costs or times that are not sane", () => {
    const inv = parseGuestInventory(
      json({
        "0": { qty: 1 },
        "-5": { qty: 1 },
        "007": { qty: 1 },
        "1e3": { qty: 1 },
        "2147483648": { qty: 1 },
        abc: { qty: 1 },
        "10": { qty: 0 },
        "11": { qty: -4 },
        "12": { qty: "5" },
        "13": { qty: 2147483648 },
        "14": null,
        "15": [1, 2],
        "16": 5,
        "17": { qty: 2.9, avgCost: -1, updatedAt: "now" },
        "18": { qty: 1, avgCost: 1e13 },
        "19": { qty: 1, avgCost: 10.6, updatedAt: -1 },
        "2147483647": { qty: 2147483647, avgCost: 1e12 },
      }),
    );
    expect(inv).toEqual({ 17: { qty: 2 }, 18: { qty: 1 }, 19: { qty: 1, avgCost: 11 }, 2147483647: { qty: 2147483647, avgCost: 1e12 } });
  });

  it("is empty for corrupt or malicious JSON", () => {
    for (const raw of [null, "", "not json", "[]", "[{\"qty\":1}]", "123", "null", '"x"']) expect(parseGuestInventory(raw), String(raw)).toEqual({});
    const polluted = parseGuestInventory('{"__proto__":{"qty":5},"constructor":{"qty":5},"7":{"qty":1,"__proto__":{"avgCost":5}}}');
    expect(polluted).toEqual({ 7: { qty: 1 } });
    expect(Object.getPrototypeOf(polluted)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).qty).toBeUndefined();
  });

  it("keeps at most GUEST_MAX_ITEMS rows and ignores an oversized value", () => {
    const many: Record<string, { qty: number }> = {};
    for (let i = 1; i <= GUEST_MAX_ITEMS + 50; i++) many[String(i)] = { qty: 1 };
    expect(Object.keys(parseGuestInventory(json(many)))).toHaveLength(GUEST_MAX_ITEMS);
    expect(parseGuestInventory(json({ "1": { qty: 1, pad: "x".repeat(GUEST_MAX_CHARS) } }))).toEqual({});
  });
});

describe("guest favorites", () => {
  it("reads ids and { id, th, grade } entries, oldest first, each id once", () => {
    expect(parseGuestFavorites(json([5, { id: 7, th: "  น้ำบริสุทธิ์ ", grade: 1 }, 5, { id: 9 }]))).toEqual([{ id: 5 }, { id: 7, th: "น้ำบริสุทธิ์", grade: 1 }, { id: 9 }]);
  });

  it("drops bad ids, names and grades", () => {
    const favs = parseGuestFavorites(
      json([0, -1, 1.5, "8", 2147483648, null, [3], { id: "4" }, { id: 6, th: 42, grade: 9 }, { id: 7, th: "", grade: 2.5 }, { id: 8, th: "x".repeat(500), grade: -1 }]),
    );
    expect(favs).toEqual([{ id: 6 }, { id: 7 }, { id: 8, th: "x".repeat(GUEST_NAME_MAX) }]);
  });

  it("keeps at most GUEST_MAX_FAVORITES and is empty for anything that is not a list", () => {
    const ids = Array.from({ length: GUEST_MAX_FAVORITES + 30 }, (_, i) => i + 1);
    expect(parseGuestFavorites(json(ids))).toHaveLength(GUEST_MAX_FAVORITES);
    for (const raw of [null, "", "{}", "oops", '{"0":1}', "42"]) expect(parseGuestFavorites(raw), String(raw)).toEqual([]);
    expect(parseGuestFavorites(json([1, { id: 2, pad: "x".repeat(GUEST_MAX_CHARS) }]))).toEqual([]);
  });
});

describe("readGuestData", () => {
  it("reads all three keys, and survives storage that throws", () => {
    const store = new Map<string, string>([
      [GUEST_KEYS.settings, json({ valuePack: false })],
      [GUEST_KEYS.inventory, json({ "3": { qty: 2 } })],
      [GUEST_KEYS.favorites, json([3])],
    ]);
    const d = readGuestData({ getItem: (k) => store.get(k) ?? null });
    expect(d.settings?.valuePack).toBe(false);
    expect(d.inventory).toEqual({ 3: { qty: 2 } });
    expect(d.favorites).toEqual([{ id: 3 }]);
    expect(summarizeGuestData(d)).toEqual({ items: 1, favorites: 1, settings: true });
    expect(hasGuestData(d)).toBe(true);

    const blocked = readGuestData({
      getItem: () => {
        throw new Error("SecurityError");
      },
    });
    expect(blocked).toEqual({ settings: null, inventory: {}, favorites: [] });
    expect(hasGuestData(blocked)).toBe(false);
    expect(readGuestData(null)).toEqual({ settings: null, inventory: {}, favorites: [] });
  });
});
