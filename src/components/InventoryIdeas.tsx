"use client";

import Link from "next/link";
import type { Idea } from "@/lib/engine/ideas";
import { RECIPE_TYPE_TH } from "@/lib/engine/mastery";
import type { Item, ItemId } from "@/lib/engine/types";
import { silver, silverShort } from "@/lib/format";
import { NET } from "@/lib/settings-labels";
import { ItemIcon } from "./ItemIcon";
import { EmptyState } from "./ui/EmptyState";
import { Money } from "./ui/Money";

/** List of "make this from what you own" suggestions (shared by the home page and the inventory page). */
export function InventoryIdeas({ ideas, items, limit, emptyText }: { ideas: Idea[]; items: Record<ItemId, Item | undefined>; limit?: number; emptyText: string }) {
  const shown = limit ? ideas.slice(0, limit) : ideas;
  if (shown.length === 0) return <EmptyState title={emptyText} />;
  return (
    <ul className="divide-y divide-border">
      {shown.map((idea, i) => (
        <li key={idea.recipe.id}>
          <Link href={`/recipes?open=${idea.recipe.id}`} className="flex items-start gap-3 px-4 py-2.5 text-sm hover:bg-panel-2/60">
            <span className="w-4 pt-1 text-center text-xs text-muted">{i + 1}</span>
            <ItemIcon id={idea.productId} grade={items[idea.productId]?.grade} size={32} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{items[idea.productId]?.th ?? idea.recipe.name}</div>
              <div className="line-clamp-2 text-xs text-muted">
                {RECIPE_TYPE_TH[idea.recipe.type]} · ทำได้ {silver(idea.crafts)} รอบ → {silverShort(idea.units)} ชิ้น ·{" "}
                {idea.ev.saleChannel === "imperial" ? "ส่งราชวังได้" : NET} {silverShort(idea.revenue)}
              </div>
              <div className="line-clamp-2 text-xs text-muted">
                ใช้: {idea.uses.map((u) => `${items[u.id]?.th ?? `#${u.id}`} ×${silver(u.units)}`).join(", ")}
                {idea.valueIncomplete ? " · (บางอย่างไม่มีราคาตลาด)" : ""}
              </div>
              {idea.steps.length > 0 && (
                <div className="line-clamp-2 text-xs text-warn">
                  ทำของกลางก่อน: {idea.steps.map((s) => `${items[s.id]?.th ?? `#${s.id}`} ×${silver(s.units)} (${silver(s.crafts)} รอบ)`).join(" → ")}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="font-semibold">
                <Money value={idea.profit} tone="profit" compact />
              </div>
              <div className="num text-xs text-muted">เทียบขายวัตถุดิบ {silverShort(idea.materialsValue)}</div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
