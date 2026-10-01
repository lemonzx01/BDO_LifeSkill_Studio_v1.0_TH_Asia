"use client";

import { useMemo, useState } from "react";
import type { CostEngine } from "@/lib/engine/cost";
import type { CostChild, CostNode, Item, ItemId, Overrides } from "@/lib/engine/types";
import { silver, silverShort } from "@/lib/format";
import { ItemIcon } from "./ItemIcon";
import { Badge, badgeCls, type BadgeTone } from "./ui/Badge";
import { btn } from "./ui/button";

const SOURCE_LABEL: Record<CostNode["source"], { text: string; tone: BadgeTone }> = {
  market: { text: "ตลาด", tone: "info" },
  npc: { text: "NPC", tone: "neutral" },
  craft: { text: "ทำเอง", tone: "accent" },
  owned: { text: "ในคลัง", tone: "good" },
  override: { text: "กำหนดเอง", tone: "special" },
  unknown: { text: "ไม่ทราบราคา", tone: "bad" },
};

export interface TreeTools {
  engine: CostEngine;
  overrides: Overrides;
  /** mode null clears the override */
  onOverride: (id: ItemId, mode: "buy" | "craft" | null) => void;
}

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
    <ul className={depth === 0 ? "space-y-1" : "mt-1 space-y-1 border-l border-border pl-3"}>
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

  return (
    <li>
      <div className="flex flex-wrap items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-panel-2/60">
        {canOpen ? (
          <button onClick={() => setOpen((o) => !o)} className="w-4 text-xs text-muted" aria-label="toggle" title={isCraft ? "ดูวัตถุดิบ" : "ดูว่าทำเองต้องใช้อะไร"}>
            {open ? "▾" : "▸"}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <ItemIcon id={node.id} grade={item?.grade} size={24} />
        <button onClick={() => canOpen && setOpen((o) => !o)} className={`min-w-0 flex-1 truncate text-left ${canOpen ? "cursor-pointer" : "cursor-default"}`}>
          {item?.th ?? `#${node.id}`}
          {node.substituteFor && slotItem && <span className="ml-1 text-xs text-muted">(แทน {slotItem.th})</span>}
        </button>
        <span className="num w-16 text-right text-muted">× {formatUnits(child.units)}</span>
        <Badge tone={src.tone}>{src.text}</Badge>
        {override && (
          <button onClick={() => tools?.onOverride(node.id, null)} className={`${badgeCls("special")} hover:bg-special/25`} title="ยกเลิกการบังคับ">
            บังคับ{override.mode === "craft" ? "ทำเอง" : override.mode === "buy" ? "ซื้อ" : ""} ✕
          </button>
        )}
        {node.soldOut && <Badge tone="warn">ของหมด</Badge>}
        <span className="num w-24 text-right text-muted">{node.unknown ? "-" : silver(node.unitCost)}</span>
        <span className="num w-28 text-right font-medium">{silver(child.lineCost)}</span>
      </div>

      {isCraft && open && node.children && (
        <>
          {tools && buyPrice !== null && (
            <div className="ml-6 mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
              <span>
                ทำเอง {silverShort(node.unitCost)}/ชิ้น · ซื้อได้ {silverShort(buyPrice)}/ชิ้น
              </span>
              {override?.mode !== "buy" && (
                <button onClick={() => tools.onOverride(node.id, "buy")} className={btn("secondary", "sm")}>
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

      {craftable && open && tools && (
        <div className="ml-6 mt-1">
          {best ? (
            <>
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span>
                  ถ้าทำเอง {best.node.hasUnknown ? "ต้นทุนไม่ครบ" : `${silverShort(best.node.unitCost)}/ชิ้น`} (ตอนนี้{src.text} {node.unknown ? "-" : silverShort(node.unitCost)})
                  {craftOptions.length > 1 ? ` · มี ${craftOptions.length} สูตร แสดงสูตรที่ถูกสุด` : ""}
                </span>
                {override?.mode !== "craft" && !best.node.hasUnknown && (
                  <button onClick={() => tools.onOverride(node.id, "craft")} className={btn("secondary", "sm")}>
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
            <span className="text-xs text-muted">ไม่มีสูตรที่คำนวณได้</span>
          )}
        </div>
      )}
    </li>
  );
}

function formatUnits(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
