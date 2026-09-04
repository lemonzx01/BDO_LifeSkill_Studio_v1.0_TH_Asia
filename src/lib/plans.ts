import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { plans, users } from "@/lib/db/schema";

export interface PlanView {
  id: number;
  userId: number;
  owner: string;
  recipeId: number;
  productId: number;
  qty: number;
  note: string;
  unitCost: number | null;
  profitPerUnit: number | null;
  createdAt: string;
}

export async function listPlans(): Promise<PlanView[]> {
  const db = await getDb();
  const rows = await db
    .select({ plan: plans, owner: users.displayName })
    .from(plans)
    .innerJoin(users, eq(users.id, plans.userId))
    .orderBy(desc(plans.createdAt), desc(plans.id))
    .limit(500);
  return rows.map(({ plan, owner }) => ({
    id: plan.id,
    userId: plan.userId,
    owner,
    recipeId: plan.recipeId,
    productId: plan.productId,
    qty: plan.qty,
    note: plan.note,
    unitCost: plan.unitCost,
    profitPerUnit: plan.profitPerUnit,
    createdAt: plan.createdAt.toISOString(),
  }));
}

export async function createPlan(
  userId: number,
  input: { recipeId: number; productId: number; qty: number; note?: string; unitCost?: number | null; profitPerUnit?: number | null },
): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .insert(plans)
    .values({
      userId,
      recipeId: input.recipeId,
      productId: input.productId,
      qty: Math.max(1, Math.floor(input.qty)),
      note: (input.note ?? "").trim().slice(0, 500),
      unitCost: input.unitCost == null ? null : Math.round(input.unitCost),
      profitPerUnit: input.profitPerUnit == null ? null : Math.round(input.profitPerUnit),
    })
    .returning({ id: plans.id });
  return row.id;
}

/** Members delete their own plans; admins can delete any. */
export async function deletePlan(planId: number, requester: { id: number; role: string }): Promise<boolean> {
  const db = await getDb();
  const [row] = await db.select({ userId: plans.userId }).from(plans).where(eq(plans.id, planId)).limit(1);
  if (!row) return false;
  if (row.userId !== requester.id && requester.role !== "admin") return false;
  await db.delete(plans).where(eq(plans.id, planId));
  return true;
}
