import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { userInventory, userSettings } from "@/lib/db/schema";
import type { Inventory, ItemId, Settings } from "@/lib/engine/types";
import { normalizeSettings } from "@/lib/settings";

export async function getUserSettings(userId: number): Promise<Settings | null> {
  const db = await getDb();
  const [row] = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  if (!row) return null;
  try {
    return normalizeSettings(JSON.parse(row.data));
  } catch {
    return null;
  }
}

export async function saveUserSettings(userId: number, settings: Settings): Promise<void> {
  const db = await getDb();
  const data = JSON.stringify(normalizeSettings(settings));
  await db
    .insert(userSettings)
    .values({ userId, data, updatedAt: new Date() })
    .onConflictDoUpdate({ target: userSettings.userId, set: { data, updatedAt: new Date() } });
}

export async function getUserInventory(userId: number): Promise<Inventory> {
  const db = await getDb();
  const rows = await db.select().from(userInventory).where(eq(userInventory.userId, userId));
  const out: Inventory = {};
  for (const r of rows) if (r.qty > 0) out[r.itemId] = { qty: r.qty, avgCost: r.avgCost ?? undefined };
  return out;
}

export async function setUserInventoryItem(userId: number, itemId: ItemId, qty: number, avgCost?: number | null): Promise<void> {
  const db = await getDb();
  if (!(qty > 0)) {
    await db.delete(userInventory).where(sql`${userInventory.userId} = ${userId} AND ${userInventory.itemId} = ${itemId}`);
    return;
  }
  await db
    .insert(userInventory)
    .values({ userId, itemId, qty: Math.floor(qty), avgCost: avgCost ?? null, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [userInventory.userId, userInventory.itemId],
      set: {
        qty: Math.floor(qty),
        // keep the previously recorded cost when the caller did not send one
        avgCost: avgCost === undefined ? sql`${userInventory.avgCost}` : (avgCost ?? null),
        updatedAt: new Date(),
      },
    });
}

export async function clearUserInventory(userId: number): Promise<void> {
  const db = await getDb();
  await db.delete(userInventory).where(eq(userInventory.userId, userId));
}
