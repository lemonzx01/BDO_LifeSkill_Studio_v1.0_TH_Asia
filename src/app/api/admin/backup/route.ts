import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { marketMeta, userInventory, users, userSettings } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/backup — one JSON file with everything members put in:
 * accounts (with password hashes, so a restore keeps logins working), settings
 * and inventories. The market snapshot is not included: it rebuilds itself.
 * แอดมินใหญ่ only, because of the hashes.
 */
export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role !== "owner") return NextResponse.json({ error: "แอดมินใหญ่เท่านั้น" }, { status: 403 });
  const db = await getDb();
  const [accounts, settings, inventory, meta] = await Promise.all([
    db.select().from(users),
    db.select().from(userSettings),
    db.select().from(userInventory),
    db.select().from(marketMeta),
  ]);
  const body = {
    format: "bdo-life-backup/1",
    exportedAt: new Date().toISOString(),
    exportedBy: me.username,
    accounts,
    settings,
    inventory,
    meta: meta.filter((m) => !m.key.startsWith("timing_")),
  };
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  return new NextResponse(JSON.stringify(body, null, 1), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="bdo-life-backup-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
