"use client";

import { useMemo, useState } from "react";
import type { CostEngine } from "@/lib/engine/cost";
import type { CostChild, CostNode, Item, ItemId, Overrides } from "@/lib/engine/types";
import { silver, silverShort } from "@/lib/format";
import { ItemIcon } from "./ItemIcon";
import { Badge, badgeCls, type BadgeTone } from "./ui/Badge";
import { btn } from "./ui/button";
import { Icon, type IconName } from "./ui/Icon";

const SOURCE_LABEL: Record<CostNode["source"], { text: string; tone: BadgeTone; icon?: IconName }> = {
  market: { text: "ตลาด", tone: "info" },
  npc: { text: "NPC", tone: "neutral" },
  craft: { text: "ทำเอง", tone: "accent" },
  owned: { text: "ในคลัง", tone: "good" },
  override: { text: "กำหนดเอง", tone: "special" },
  unknown: { text: "ไม่ทราบราคา", tone: "bad", icon: "alert-circle" },
};

export interface TreeTools {
  engine: CostEngine;
  overrides: Overrides;
  /** mode null clears the override */
  onOverride: (id: ItemId, mode: "buy" | "craft" | null) => void;
}

/**
 * The materials of a recipe, layer by layer. Each level below the first hangs off a thin guide line
 * under its parent's chevron. The number columns follow the header in RecipeDetail and read its
 * @container, so every level shows the same columns.
 */
export function CostTree({
  children,
  items,
  depth = 0,
  tools,
}: {
  children: CostChild[];
  items: Record<ItemId, Item | undefined>;
  depth?: number;
  tools?: TreeTools;
}) {
  return (
    <ul className={depth === 0 ? "space-y-0.5" : "ml-3 mt-0.5 space-y-0.5 border-l border-border pl-2"}>
      {children.map((c, i) => (
        <TreeRow key={`${c.slotId}-${c.node.id}-${i}`} child={c} items={items} depth={depth} tools={tools} />
      ))}
    </ul>
  );
}

function TreeRow({ child, items, depth, tools }: { child: CostChild; items: Record<ItemId, Item | undefined>; depth: number; tools?: TreeTools }) {
  const { node } = child;
  const item = items[node.id];
  const slotItem = items[child.slotId];
  const [open, setOpen] = useState(depth < 1 && node.source === "craft");
  const src = SOURCE_LABEL[node.source];
  const isCraft = node.source === "craft" && !!node.children?.length;
  // a bought / owned / unknown material can still be "peeked into" when a recipe exists
  const craftable = !isCraft && !!tools && tools.engine.recipesFor(node.id).length > 0;
  const canOpen = isCraft || craftable;
  const override = tools?.overrides[node.id];
  const buyPrice = tools ? tools.engine.buyPrice(node.id) : null;

  const craftOptions = useMemo(() => (craftable && open && tools ? tools.engine.craftOptions(node.id) : []), [craftable, open, tools, node.id]);
  const best = craftOptions[0];

  const name = (
    <>
      <ItemIcon id={node.id} grade={item?.grade} size={24} />
      {/* a narrow detail (a phone, the side pane on a small desktop) wraps the name to two lines:
          one line left "สะเก็ดแห่งเ…", too little to tell which material it is */}
      <span className="min-w-0 line-clamp-2 @2xl:line-clamp-none @2xl:truncate" title={item?.th}>
        {item?.th ?? `#${node.id}`}
        {node.substituteFor && slotItem && <span className="ml-1 text-xs text-muted">(แทน {slotItem.th})</span>}
      </span>
    </>
  );

  return (
    <li>
      {/* same columns as the header in RecipeDetail: the name cell takes the rest, the numbers keep
          their widths at the right whatever pills a row has. In a narrow detail (a phone) the pills
          drop under the name instead of squeezing it */}
      <div className="flex items-center gap-2 rounded-lg px-1.5 text-sm transition-colors duration-150 hover:bg-panel-2/60">
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5 @md:flex-nowrap">
          {canOpen ? (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              title={isCraft ? "ดูวัตถุดิบ" : "ดูว่าทำเองต้องใช้อะไร"}
              className="flex min-h-10 max-w-full min-w-0 items-center gap-1.5 rounded-md text-left md:min-h-9"
            >
              <Icon name="chevron-right" className={`h-3.5 w-3.5 text-faint transition-transform duration-150 ${open ? "rotate-90" : ""}`} strokeWidth={2} />
              {name}
            </button>
          ) : (
            <span className="flex min-h-10 max-w-full min-w-0 items-center gap-1.5 md:min-h-9">
              <span aria-hidden className="w-3.5 shrink-0" />
              {name}
            </span>
          )}
          <Badge tone={src.tone} icon={src.icon} className="shrink-0">
            {src.text}
          </Badge>
          {override && (
            <button
              type="button"
              onClick={() => tools?.onOverride(node.id, null)}
              // a pill to look at; on a touch screen the ::before makes it a taller target
              className={`${badgeCls("special")} relative shrink-0 transition-colors duration-150 before:absolute before:inset-0 hover:bg-special/25 pointer-coarse:before:-inset-y-2.5`}
              title="ยกเลิกการบังคับ"
            >
              บังคับ{override.mode === "craft" ? "ทำเอง" : override.mode === "buy" ? "ซื้อ" : ""}
              <Icon name="x" className="h-3 w-3" strokeWidth={2} />
              <span className="sr-only"> (กดเพื่อยกเลิก)</span>
            </button>
          )}
          {node.soldOut && (
            <Badge tone="warn" icon="alert-triangle" className="shrink-0">
              ของหมด
            </Badge>
          )}
        </span>
        <span className="num w-14 shrink-0 text-right text-muted @md:w-16">× {formatUnits(child.units)}</span>
        <span className="num hidden w-24 shrink-0 text-right text-muted @md:block">{node.unknown ? "-" : silver(node.unitCost)}</span>
        <span className="num w-24 shrink-0 text-right font-medium text-foreground @md:w-28">{silver(child.lineCost)}</span>
      </div>

      {isCraft && open && node.children && (
        <>
          {tools && buyPrice !== null && (
            <div className="ml-5 mt-0.5 mb-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
              <span className="num">
                ทำเอง {silverShort(node.unitCost)}/ชิ้น · ซื้อได้ {silverShort(buyPrice)}/ชิ้น
              </span>
              {override?.mode !== "buy" && (
                <button type="button" onClick={() => tools.onOverride(node.id, "buy")} className={btn("secondary", "sm")}>
                  ซื้อแทนทำเอง
                </button>
              )}
            </div>
          )}
          <CostTree items={items} depth={depth + 1} tools={tools}>
            {node.children}
          </CostTree>
        </>
      )}

      {/* a "what if I crafted it" look at a bought material: framed with a dashed line, as it is not
          what the cost above counts (until ใช้ทำเองแทน… is pressed) */}
      {craftable && open && tools && (
        <div className="mb-1.5 ml-5 mt-0.5 rounded-lg border border-dashed border-border-strong bg-panel-2/40 px-1 py-1.5">
          {best ? (
            <>
              <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1.5 text-xs text-muted">
                <span className="num">
                  ถ้าทำเอง {best.node.hasUnknown ? "ต้นทุนไม่ครบ" : `${silverShort(best.node.unitCost)}/ชิ้น`} (ตอนนี้{src.text} {node.unknown ? "-" : silverShort(node.unitCost)})
                  {craftOptions.length > 1 ? ` · มี ${craftOptions.length} สูตร แสดงสูตรที่ถูกสุด` : ""}
                </span>
                {override?.mode !== "craft" && !best.node.hasUnknown && (
                  <button type="button" onClick={() => tools.onOverride(node.id, "craft")} className={btn("secondary", "sm")}>
                    ใช้ทำเองแทน{src.text}
                  </button>
                )}
              </div>
              {best.node.children && (
                <CostTree items={items} depth={depth + 1} tools={tools}>
                  {best.node.children}
                </CostTree>
              )}
            </>
          ) : (
            <span className="px-1.5 text-xs text-muted">ไม่มีสูตรที่คำนวณได้</span>
          )}
        </div>
      )}
    </li>
  );
}

function formatUnits(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
