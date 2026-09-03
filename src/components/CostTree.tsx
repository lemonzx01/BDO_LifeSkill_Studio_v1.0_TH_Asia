"use client";

import { useState } from "react";
import type { CostChild, CostNode, Item, ItemId } from "@/lib/engine/types";
import { silver } from "@/lib/format";
import { ItemIcon } from "./ItemIcon";

const SOURCE_LABEL: Record<CostNode["source"], { text: string; cls: string }> = {
  market: { text: "ตลาด", cls: "bg-sky-500/15 text-sky-300" },
  npc: { text: "NPC", cls: "bg-zinc-500/20 text-zinc-300" },
  craft: { text: "ทำเอง", cls: "bg-amber-500/15 text-amber-300" },
  owned: { text: "ในคลัง", cls: "bg-emerald-500/15 text-emerald-300" },
  override: { text: "กำหนดเอง", cls: "bg-violet-500/15 text-violet-300" },
  unknown: { text: "ไม่ทราบราคา", cls: "bg-rose-500/15 text-rose-300" },
};

export function CostTree({ children, items, depth = 0 }: { children: CostChild[]; items: Record<ItemId, Item | undefined>; depth?: number }) {
  return (
    <ul className={depth === 0 ? "space-y-1" : "mt-1 space-y-1 border-l border-border pl-3"}>
      {children.map((c, i) => (
        <TreeRow key={`${c.slotId}-${c.node.id}-${i}`} child={c} items={items} depth={depth} />
      ))}
    </ul>
  );
}

function TreeRow({ child, items, depth }: { child: CostChild; items: Record<ItemId, Item | undefined>; depth: number }) {
  const { node } = child;
  const item = items[node.id];
  const slotItem = items[child.slotId];
  const [open, setOpen] = useState(depth < 1);
  const canOpen = node.source === "craft" && !!node.children?.length;
  const src = SOURCE_LABEL[node.source];

  return (
    <li>
      <div className="flex flex-wrap items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-panel-2/60">
        {canOpen ? (
          <button onClick={() => setOpen((o) => !o)} className="w-4 text-xs text-muted" aria-label="toggle">
            {open ? "▾" : "▸"}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <ItemIcon id={node.id} grade={item?.grade} size={24} />
        <span className="min-w-0 flex-1 truncate">
          {item?.th ?? `#${node.id}`}
          {node.substituteFor && slotItem && (
            <span className="ml-1 text-xs text-muted">(แทน {slotItem.th})</span>
          )}
        </span>
        <span className="num w-16 text-right text-muted">× {formatUnits(child.units)}</span>
        <span className={`rounded px-1.5 py-0.5 text-[11px] ${src.cls}`}>{src.text}</span>
        {node.soldOut && <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[11px] text-rose-300">ของหมด</span>}
        <span className="num w-24 text-right text-muted">{node.unknown ? "-" : silver(node.unitCost)}</span>
        <span className="num w-28 text-right font-medium">{silver(child.lineCost)}</span>
      </div>
      {canOpen && open && node.children && <CostTree items={items} depth={depth + 1}>{node.children}</CostTree>}
    </li>
  );
}

function formatUnits(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
