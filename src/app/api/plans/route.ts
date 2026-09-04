import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createPlan, deletePlan, listPlans } from "@/lib/plans";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ plans: await listPlans() });
}

/** POST { recipeId, productId, qty, note?, unitCost?, profitPerUnit? } */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const recipeId = Number(body.recipeId);
  const productId = Number(body.productId);
  const qty = Number(body.qty);
  if (!Number.isInteger(recipeId) || !Number.isInteger(productId) || !Number.isFinite(qty) || qty <= 0) {
    return NextResponse.json({ error: "bad input" }, { status: 400 });
  }
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const id = await createPlan(user.id, {
    recipeId,
    productId,
    qty,
    note: typeof body.note === "string" ? body.note : "",
    unitCost: num(body.unitCost),
    profitPerUnit: num(body.profitPerUnit),
  });
  return NextResponse.json({ ok: true, id });
}

/** DELETE ?id=123 — own plan, or any plan for admins */
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const ok = await deletePlan(id, user);
  return NextResponse.json({ ok }, { status: ok ? 200 : 403 });
}
