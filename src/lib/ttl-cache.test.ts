import { describe, expect, it } from "vitest";
import { TtlCache } from "./ttl-cache";

describe("TtlCache", () => {
  it("returns fresh entries and forgets expired ones", () => {
    const c = new TtlCache<number, string>(10, 1000);
    c.set(1, "a", 0);
    expect(c.get(1, 999)).toBe("a");
    expect(c.get(1, 1000)).toBeUndefined();
    expect(c.size).toBe(0);
  });

  it("drops the oldest write once over the cap", () => {
    const c = new TtlCache<number, number>(3, 60_000);
    for (let i = 1; i <= 3; i++) c.set(i, i, i);
    c.set(1, 10, 4); // rewriting moves 1 to the newest position
    c.set(4, 4, 5); // over the cap: 2 is now the oldest write
    expect(c.size).toBe(3);
    expect(c.get(2, 6)).toBeUndefined();
    expect(c.get(1, 6)).toBe(10);
    expect(c.get(3, 6)).toBe(3);
    expect(c.get(4, 6)).toBe(4);
  });

  it("never grows past the cap however many keys are asked for", () => {
    const c = new TtlCache<number, number>(500, 60_000);
    for (let i = 0; i < 5000; i++) c.set(i, i, i);
    expect(c.size).toBe(500);
    expect(c.get(4999, 5000)).toBe(4999);
    expect(c.get(4499, 5000)).toBeUndefined();
  });
});
