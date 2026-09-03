"use client";

import { useMemo, useState } from "react";
import { flattenRequirements } from "@/lib/engine/cost";
import type { Inventory, Item, ItemId, MarketPrice, RecipeEvaluation } from "@/lib/engine/types";
import { silver } from "@/lib/format";
import { setOwned } from "@/lib/inventory";
import { ItemIcon } from "./ItemIcon";

/**
 * "I want N of this" -> crafts needed, every raw material across all recipe
 * layers, what you already own, what is left to buy and what it costs.
 */
export function ProductionPlan({
  ev,
  items,
  prices,
  inventory,
}: {
  ev: RecipeEvaluation;
  items: Record<ItemId, Item>;
  prices: Record<ItemId, MarketPrice>;
  inventory: Inventory;
}) {
  const [qty, setQty] = useState(100);
  const rounds = Math.max(0, Math.ceil(qty / ev.expectedYield));

  const rows = useMemo(() => {
    const req = flattenRequirements(ev.tree, rounds);
    return [...req.entries()]
      .map(([id, r]) => {
        const item = items[id];
        const need = Math.ceil(r.units);
        const owned = inventory[id]?.qty ?? 0;
        const toBuy = Math.max(0, need - owned);
        const mp = prices[id];
        // price you would pay for one more unit (market, else NPC, else the engine's own estimate)
        const price = item?.market && mp && mp.price > 0 ? mp.price : item?.npcBuy && item.npcBuy > 0 ? item.npcBuy : r.units > 0 ? r.cost / r.units : 0;
        return { id, item, need, owned, toBuy, price, cost: toBuy * price, source: r.source, soldOut: !!(item?.market && mp && mp.stock <= 0) };
      })
      .sort((a, b) => b.cost - a.cost || b.need - a.need);
  }, [ev.tree, rounds, items, inventory, prices]);

  const buyCost = rows.reduce((a, r) => a + r.cost, 0);
  const revenue = qty * ev.netPerUnit;
  const cashProfit = revenue - buyCost;
  const fullProfit = qty * ev.profitPerUnit;

  return (
    <section className="mt-4 rounded-lg border border-border bg-panel p-3">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">แผนผลิต</h4>
        <label className="flex items-center gap-2 text-sm">
          อยากได้
          <input
            type="number"
            min={0}
            step={10}
            value={qty}
            onChange={(e) => setQty(Math.max(0, Number(e.target.value) || 0))}
            className="num w-24 rounded border border-border bg-panel-2 px-2 py-1 text-right"
          />
          ชิ้น
        </label>
        <span className="text-sm text-muted">
          = <b className="num text-foreground">{silver(rounds)}</b> รอบ (ผลผลิต {ev.expectedYield.toFixed(2)}/รอบ)
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-[11px] text-muted">
            <tr>
              <th className="py-1 text-left font-medium">วัตถุดิบ (ทุกชั้น)</th>
              <th className="py-1 text-right font-medium">ต้องใช้</th>
              <th className="py-1 text-right font-medium">มีอยู่แล้ว</th>
              <th className="py-1 text-right font-medium">ต้องซื้อเพิ่ม</th>
              <th className="py-1 text-right font-medium">ราคา/ชิ้น</th>
              <th className="py-1 text-right font-medium">ต้องจ่าย</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border/60">
                <td className="py-1">
                  <div className="flex items-center gap-2">
                    <ItemIcon id={r.id} grade={r.item?.grade} size={22} />
                    <span className="truncate">{r.item?.th ?? `#${r.id}`}</span>
                    {r.soldOut && <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] text-rose-300">ของหมด</span>}
                    {!r.item?.market && !r.item?.npcBuy && (
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300">ต้องหาเอง</span>
                    )}
                  </div>
                </td>
                <td className="num py-1 text-right">{silver(r.need)}</td>
                <td className="py-1 text-right">
                  <input
                    type="number"
                    min={0}
                    value={r.owned || ""}
                    placeholder="0"
                    onChange={(e) => setOwned(r.id, Math.max(0, Number(e.target.value) || 0))}
                    className="num w-24 rounded border border-border bg-panel-2 px-2 py-0.5 text-right"
                  />
                </td>
                <td className={`num py-1 text-right ${r.toBuy > 0 ? "" : "text-muted"}`}>{silver(r.toBuy)}</td>
                <td className="num py-1 text-right text-muted">{r.price ? silver(r.price) : "-"}</td>
                <td className="num py-1 text-right font-medium">{silver(r.cost)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border font-semibold">
              <td className="py-1.5" colSpan={5}>
                รวมต้องซื้อเพิ่ม
              </td>
              <td className="num py-1.5 text-right">{silver(buyCost)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Stat label={`ขายได้สุทธิ (${silver(qty)} ชิ้น)`} value={silver(revenue)} />
        <Stat label="เงินสดที่ต้องใช้ซื้อเพิ่ม" value={silver(buyCost)} />
        <Stat label="กำไร (หักเฉพาะที่ซื้อเพิ่ม)" value={silver(cashProfit)} tone={cashProfit >= 0 ? "good" : "bad"} />
        <Stat label="กำไรเทียบต้นทุนเต็ม" value={silver(fullProfit)} tone={fullProfit >= 0 ? "good" : "bad"} />
      </div>
      <p className="mt-2 text-[11px] text-muted">
        ช่อง &ldquo;มีอยู่แล้ว&rdquo; จำอยู่ในเบราว์เซอร์นี้และใช้ร่วมกันทุกสูตร · ต้นทุนของของที่มีอยู่ตั้งได้ในตั้งค่า (คิด 0 หรือคิดตามราคาตลาด)
      </p>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded border border-border bg-panel-2/60 px-2 py-1.5">
      <div className="text-[11px] text-muted">{label}</div>
      <div className={`num font-semibold ${tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : ""}`}>{value}</div>
    </div>
  );
}
