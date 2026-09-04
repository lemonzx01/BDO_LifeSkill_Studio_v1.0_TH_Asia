import { beforeAll, describe, expect, it } from "vitest";
import { createUser } from "@/lib/auth/service";
import { resetDbCache } from "@/lib/db";
import { DEFAULT_SETTINGS } from "@/lib/engine/types";
import { clearUserInventory, getUserInventory, getUserSettings, saveUserSettings, setUserInventoryItem } from "./user-data";

beforeAll(() => {
  delete process.env.DATABASE_URL;
  resetDbCache();
});

describe("per-account settings and inventory", () => {
  it("round-trips settings and fills defaults for partial data", async () => {
    const u = await createUser({ username: "datauser", password: "secret123" });
    expect(await getUserSettings(u.id)).toBeNull();
    await saveUserSettings(u.id, { ...DEFAULT_SETTINGS, valuePack: false, mastery: { alchemy: 1500 } });
    const s = await getUserSettings(u.id);
    expect(s?.valuePack).toBe(false);
    expect(s?.mastery.alchemy).toBe(1500);
    expect(s?.mastery.cooking).toBe(0); // default filled in
    expect(s?.craftsPerHour.processing).toBe(3000);
  });

  it("stores inventory per user, keeps cost when omitted, removes at zero", async () => {
    const u = await createUser({ username: "invuser", password: "secret123" });
    await setUserInventoryItem(u.id, 5301, 40, 12000);
    await setUserInventoryItem(u.id, 6354, 3);
    const inv = await getUserInventory(u.id);
    expect(inv).toMatchObject({ 5301: { qty: 40, avgCost: 12000 }, 6354: { qty: 3, avgCost: undefined } });
    expect(typeof inv[5301]?.updatedAt).toBe("number");
    await setUserInventoryItem(u.id, 5301, 55); // avgCost omitted -> kept
    expect((await getUserInventory(u.id))[5301]).toMatchObject({ qty: 55, avgCost: 12000 });
    await setUserInventoryItem(u.id, 5301, 55, null); // explicit null clears the cost
    expect((await getUserInventory(u.id))[5301]).toMatchObject({ qty: 55, avgCost: undefined });
    await setUserInventoryItem(u.id, 6354, 0);
    expect(Object.keys(await getUserInventory(u.id))).toEqual(["5301"]);
    await clearUserInventory(u.id);
    expect(await getUserInventory(u.id)).toEqual({});
  });
});
