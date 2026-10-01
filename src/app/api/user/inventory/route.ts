import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/session";
import { readJsonBody } from "@/lib/http";
import { clearUserInventory, getUserInventory, setUserInventoryItem } from "@/lib/user-data";
import { parseAvgCost, parseId, parseQty } from "@/lib/validate";

export const dynamic = "force-dynamic";

const MAX_BODY_CHARS = 2000;

export async function GET() {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ inventory: await getUserInventory(user.id) });
}

/** PUT { id, qty, avgCost? } — qty 0 removes the item; avgCost null clears it, omitted keeps it */
export async function PUT(req: Request) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = await readJsonBody(req, MAX_BODY_CHARS);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = (parsed.body && typeof parsed.body === "object" ? parsed.body : {}) as { id?: unknown; qty?: unknown; avgCost?: unknown };
  const id = parseId(body.id);
  const qty = parseQty(body.qty);
  if (id === null || qty === null) return NextResponse.json({ error: "bad input" }, { status: 400 });
  const avgCost = parseAvgCost(body.avgCost);
  if (!avgCost.ok) return NextResponse.json({ error: "bad avgCost" }, { status: 400 });
  await setUserInventoryItem(user.id, id, qty, avgCost.value);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await clearUserInventory(user.id);
  return NextResponse.json({ ok: true });
}
