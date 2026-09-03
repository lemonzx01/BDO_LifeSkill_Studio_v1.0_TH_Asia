import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { clearUserInventory, getUserInventory, setUserInventoryItem } from "@/lib/user-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ inventory: await getUserInventory(user.id) });
}

/** PUT { id, qty, avgCost? } — qty 0 removes the item */
export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: { id?: unknown; qty?: unknown; avgCost?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const id = Number(body.id);
  const qty = Number(body.qty);
  if (!Number.isInteger(id) || id <= 0 || !Number.isFinite(qty) || qty < 0) {
    return NextResponse.json({ error: "bad input" }, { status: 400 });
  }
  const avgCost = body.avgCost === undefined ? undefined : body.avgCost === null ? null : Number(body.avgCost);
  if (avgCost !== undefined && avgCost !== null && (!Number.isFinite(avgCost) || avgCost < 0)) {
    return NextResponse.json({ error: "bad avgCost" }, { status: 400 });
  }
  await setUserInventoryItem(user.id, id, qty, avgCost);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await clearUserInventory(user.id);
  return NextResponse.json({ ok: true });
}
