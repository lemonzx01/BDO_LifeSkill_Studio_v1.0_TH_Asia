"use client";

import Link from "next/link";
import type { Idea } from "@/lib/engine/ideas";
import { RECIPE_TYPE_TH } from "@/lib/engine/mastery";
import type { Item, ItemId } from "@/lib/engine/types";
import { silver, silverShort } from "@/lib/format";
import { ItemIcon } from "./ItemIcon";

/** List of "make this from what you own" suggestions (shared by the home page and the inventory page). */
export function InventoryIdeas({ ideas, items, limit, emptyText }: { ideas: Idea[]; items: Record<ItemId, Item | undefined>; limit?: number; emptyText: string }) {
  const shown = limit ? ideas.slice(0, limit) : ideas;
  if (shown.length === 0) return <p className="px-4 py-6 text-center text-sm text-muted">{emptyText}</p>;
  return (
    <ul className="divide-y divide-border">
      {shown.map((idea, i) => {
        const good = idea.profit > 0;
        return (
          <li key={idea.recipe.id}>
            <Link href={`/recipes?open=${idea.recipe.id}`} className="flex items-start gap-3 px-4 py-2.5 text-sm hover:bg-panel-2/60">
              <span className="w-4 pt-1 text-center text-xs text-muted">{i + 1}</span>
              <ItemIcon id={idea.productId} grade={items[idea.productId]?.grade} size={32} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{items[idea.productId]?.th ?? idea.recipe.name}</div>
                <div className="truncate text-[11px] text-muted">
                  {RECIPE_TYPE_TH[idea.recipe.type]} · ทำได้ {silver(idea.crafts)} รอบ → {silverShort(idea.units)} ชิ้น ·{" "}
                  {idea.ev.saleChannel === "imperial" ? "ส่งราชวังได้" : "ขายได้สุทธิ"} {silverShort(idea.revenue)}
                </div>
                <div className="truncate text-[11px] text-muted">
                  ใช้: {idea.uses.map((u) => `${items[u.id]?.th ?? `#${u.id}`} ×${silver(u.units)}`).join(", ")}
                  {idea.valueIncomplete ? " · (บางอย่างไม่มีราคาตลาด)" : ""}
                </div>
                {idea.steps.length > 0 && (
                  <div className="truncate text-[11px] text-amber-300/90">
                    ทำของกลางก่อน: {idea.steps.map((s) => `${items[s.id]?.th ?? `#${s.id}`} ×${silver(s.units)} (${silver(s.crafts)} รอบ)`).join(" → ")}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className={`num font-semibold ${good ? "text-good" : "text-bad"}`}>{good ? "+" : ""}{silverShort(idea.profit)}</div>
                <div className="num text-[11px] text-muted">เทียบขายวัตถุดิบ {silverShort(idea.materialsValue)}</div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
