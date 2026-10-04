"use client";

import Link from "next/link";
import { Fragment } from "react";
import type { Idea } from "@/lib/engine/ideas";
import { RECIPE_TYPE_TH } from "@/lib/engine/mastery";
import type { Item, ItemId } from "@/lib/engine/types";
import { silver, silverShort } from "@/lib/format";
import { NET } from "@/lib/settings-labels";
import { ItemIcon } from "./ItemIcon";
import { EmptyState } from "./ui/EmptyState";
import { Icon } from "./ui/Icon";
import { Money } from "./ui/Money";

/**
 * List of "make this from what you own" suggestions (shared by the home page and the inventory
 * page, where it sits in a narrow side card on lg). Each row: the product and its profit on the
 * first line, then what it pays against what the materials would sell for, what it uses, and any
 * in-between product to make first.
 */
export function InventoryIdeas({ ideas, items, limit, emptyText }: { ideas: Idea[]; items: Record<ItemId, Item | undefined>; limit?: number; emptyText: string }) {
  const shown = limit ? ideas.slice(0, limit) : ideas;
  if (shown.length === 0) return <EmptyState compact icon="package" title={emptyText} />;
  return (
    <ul className="divide-y divide-border">
      {shown.map((idea, i) => (
        <li key={idea.recipe.id}>
          <Link href={`/recipes?open=${idea.recipe.id}`} className="flex items-start gap-3 px-4 py-3 text-sm transition-colors duration-150 hover:bg-panel-2">
            <span className="num w-4 shrink-0 pt-1.5 text-center text-xs text-faint">{i + 1}</span>
            <ItemIcon id={idea.productId} grade={items[idea.productId]?.grade} size={32} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-3">
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">{items[idea.productId]?.th ?? idea.recipe.name}</span>
                <Money value={idea.profit} tone="profit" compact className="shrink-0 font-semibold" />
              </div>
              <p className="text-xs text-muted">
                {RECIPE_TYPE_TH[idea.recipe.type]} · ทำได้ <span className="num">{silver(idea.crafts)}</span> รอบ (<span className="num">{silverShort(idea.units)}</span> ชิ้น)
              </p>
              <p className="text-xs text-muted">
                {idea.ev.saleChannel === "imperial" ? "ส่งราชวังได้" : NET} <span className="num">{silverShort(idea.revenue)}</span> · เทียบขายวัตถุดิบ{" "}
                <span className="num">{silverShort(idea.materialsValue)}</span>
              </p>
              <p className="mt-1 line-clamp-2 text-xs text-muted">
                ใช้: {idea.uses.map((u) => `${items[u.id]?.th ?? `#${u.id}`} ×${silver(u.units)}`).join(", ")}
                {idea.valueIncomplete ? " · (บางอย่างไม่มีราคาตลาด)" : ""}
              </p>
              {idea.steps.length > 0 && (
                <p className="mt-1 line-clamp-2 text-xs text-warn">
                  ทำของกลางก่อน:{" "}
                  {idea.steps.map((s, k) => (
                    <Fragment key={k}>
                      {/* in order: an arrow between steps (read out as "แล้ว") */}
                      {k > 0 && (
                        <>
                          {" "}
                          <Icon name="arrow-right" className="inline h-3 w-3 align-[-1px]" />
                          <span className="sr-only">แล้ว</span>{" "}
                        </>
                      )}
                      {`${items[s.id]?.th ?? `#${s.id}`} ×${silver(s.units)} (${silver(s.crafts)} รอบ)`}
                    </Fragment>
                  ))}
                </p>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
