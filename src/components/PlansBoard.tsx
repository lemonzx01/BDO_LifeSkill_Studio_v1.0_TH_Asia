"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RECIPE_TYPE_TH } from "@/lib/engine/mastery";
import type { RecipeType } from "@/lib/engine/types";
import { silver } from "@/lib/format";
import type { SessionUser } from "./auth/UserMenu";
import { ItemIcon } from "./ItemIcon";
import { TopNav } from "./TopNav";

export interface PlanRow {
  id: number;
  userId: number;
  owner: string;
  recipeId: number;
  productId: number;
  productTh: string;
  productGrade: number;
  recipeType: RecipeType | null;
  qty: number;
  note: string;
  unitCost: number | null;
  profitPerUnit: number | null;
  createdAt: string;
}

/** "แผนกิล": every member's saved production plans, newest first. */
export function PlansBoard({ plans, me, user }: { plans: PlanRow[]; me: { id: number; role: string }; user: SessionUser }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);

  const remove = async (id: number) => {
    if (!confirm("ลบแผนนี้?")) return;
    setBusy(id);
    try {
      await fetch(`/api/plans?id=${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const totalProfit = plans.reduce((a, p) => a + (p.profitPerUnit ?? 0) * p.qty, 0);

  return (
    <main className="mx-auto w-full max-w-6xl px-3 py-4 md:px-6">
      <TopNav user={user} subtitle="แผนผลิตที่สมาชิกบันทึกไว้ ทุกคนในกิลเห็นว่าใครกำลังทำอะไร (บันทึกได้จากปุ่มในแผนผลิตของแต่ละสูตร)" />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">แผนกิล ({plans.length} แผน)</h2>
        {plans.length > 0 && <span className="text-sm text-muted">กำไรรวมโดยประมาณ ณ วันที่บันทึก: <b className="num text-foreground">{silver(totalProfit)}</b></span>}
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-panel">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-panel-2 text-xs text-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium">สินค้า</th>
              <th className="px-2 py-2 text-left font-medium">ใคร</th>
              <th className="px-2 py-2 text-right font-medium">จำนวน</th>
              <th className="px-2 py-2 text-right font-medium">ต้นทุน/ชิ้น (ตอนบันทึก)</th>
              <th className="px-2 py-2 text-right font-medium">กำไร/ชิ้น (ตอนบันทึก)</th>
              <th className="px-2 py-2 text-left font-medium">หมายเหตุ</th>
              <th className="px-2 py-2 text-left font-medium">เมื่อ</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => {
              const mine = p.userId === me.id;
              const canDelete = mine || me.role === "admin";
              return (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <ItemIcon id={p.productId} grade={p.productGrade} size={28} />
                      <div className="min-w-0">
                        <div className="truncate font-medium">{p.productTh}</div>
                        <div className="text-[11px] text-muted">{p.recipeType ? RECIPE_TYPE_TH[p.recipeType] : ""}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    {p.owner} {mine && <span className="text-xs text-muted">(คุณ)</span>}
                  </td>
                  <td className="num px-2 py-1.5 text-right">{silver(p.qty)}</td>
                  <td className="num px-2 py-1.5 text-right text-muted">{p.unitCost !== null ? silver(p.unitCost) : "-"}</td>
                  <td className={`num px-2 py-1.5 text-right ${(p.profitPerUnit ?? 0) >= 0 ? "text-good" : "text-bad"}`}>
                    {p.profitPerUnit !== null ? silver(p.profitPerUnit) : "-"}
                  </td>
                  <td className="max-w-[260px] truncate px-2 py-1.5 text-muted" title={p.note}>
                    {p.note || "-"}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-xs text-muted">{new Date(p.createdAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}</td>
                  <td className="px-2 py-1.5 text-right">
                    {canDelete && (
                      <button onClick={() => remove(p.id)} disabled={busy === p.id} className="text-xs text-muted hover:text-bad disabled:opacity-50">
                        ลบ
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {plans.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted">
                  ยังไม่มีแผน เปิดสูตรในหน้า &ldquo;คำนวณสูตร&rdquo; กรอกจำนวนในแผนผลิต แล้วกด &ldquo;บันทึกแผนให้กิลเห็น&rdquo;
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
