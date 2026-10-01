"use client";

import { useMemo, useState } from "react";
import { planProduction, type ConsumeChange } from "@/lib/engine/consume";
import { flattenRequirements } from "@/lib/engine/cost";
import type { Inventory, Item, ItemId, MarketPrice, RecipeEvaluation } from "@/lib/engine/types";
import { silver } from "@/lib/format";
import { ItemIcon } from "./ItemIcon";
import { NumberInput } from "./NumberInput";
import { useUserData } from "./UserDataProvider";
import { Badge } from "./ui/Badge";
import { btn } from "./ui/button";
import { Card, SectionLabel } from "./ui/Card";
import { useConfirm } from "./ui/ConfirmDialog";
import { checkboxCls, fieldCls } from "./ui/field";
import { Money } from "./ui/Money";
import { Notice } from "./ui/Notice";
import { Stat } from "./ui/Stat";

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
  const { setOwned } = useUserData();
  const [confirm, confirmDialog] = useConfirm();
  const [qty, setQty] = useState(100);
  const rounds = Math.max(0, Math.ceil(qty / ev.expectedYield));
  const [addProduct, setAddProduct] = useState(true);
  // what the last "ผลิตแล้ว" changed, so it can be undone
  const [done, setDone] = useState<{ changes: ConsumeChange[]; costs: Record<ItemId, number | undefined>; units: number } | null>(null);

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
  const ownedRows = rows.filter((r) => r.owned > 0);
  const productUnits = Math.round(rounds * ev.expectedYield);

  /** Record that the crafts happened: owned materials go out, the product comes in. */
  const produce = async () => {
    const changes = planProduction(inventory, rows.map((r) => ({ id: r.id, need: r.need })), addProduct ? { id: ev.productId, units: productUnits } : undefined);
    if (changes.length === 0) return;
    const ok = await confirm({
      title: `บันทึกว่าผลิตแล้ว ${silver(rounds)} รอบ?`,
      body: "จำนวนในคลังจะเปลี่ยนตามนี้ (กดเลิกทำได้ทีหลัง)",
      details: changes.map((c) => (
        <span key={c.id} className="flex justify-between gap-3">
          <span className="truncate">{items[c.id]?.th ?? `#${c.id}`}</span>
          <span className="num shrink-0 text-foreground">
            {silver(c.before)} → {silver(c.after)}
          </span>
        </span>
      )),
      confirmLabel: `ปรับคลัง ${changes.length} รายการ`,
    });
    if (!ok) return;
    const costs: Record<ItemId, number | undefined> = {};
    for (const c of changes) costs[c.id] = inventory[c.id]?.avgCost;
    for (const c of changes) setOwned(c.id, c.after);
    setDone({ changes, costs, units: addProduct ? productUnits : 0 });
  };
  const undo = () => {
    if (!done) return;
    for (const c of done.changes) setOwned(c.id, c.before, c.before > 0 ? done.costs[c.id] : undefined);
    setDone(null);
  };
  const revenue = qty * ev.netPerUnit;
  const cashProfit = revenue - buyCost;
  const fullProfit = qty * ev.profitPerUnit;

  return (
    <Card className="mt-4 p-3">
      {confirmDialog}
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <SectionLabel as="h4">แผนผลิต</SectionLabel>
        <label className="flex items-center gap-2 text-sm">
          อยากได้
          <NumberInput min={0} step={10} value={qty} onChange={(v) => setQty(Math.floor(v))} className={`${fieldCls("sm")} w-24`} />
          ชิ้น
        </label>
        <span className="text-sm text-muted">
          = <b className="num text-foreground">{silver(rounds)}</b> รอบ (ผลผลิต {ev.expectedYield.toFixed(2)}/รอบ)
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-xs text-muted">
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
                    {r.soldOut && <Badge tone="warn">ของหมด</Badge>}
                    {!r.item?.market && !r.item?.npcBuy && <Badge tone="warn">ต้องหาเอง</Badge>}
                  </div>
                </td>
                <td className="num py-1 text-right">{silver(r.need)}</td>
                <td className="py-1 text-right">
                  <NumberInput
                    min={0}
                    value={r.owned}
                    blankZero
                    placeholder="0"
                    onChange={(v) => setOwned(r.id, Math.floor(v))}
                    aria-label={`มีอยู่แล้ว ${r.item?.th ?? `#${r.id}`}`}
                    className={`${fieldCls("sm")} w-24`}
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

      <div className="mt-2 flex flex-wrap items-center gap-3 rounded border border-border bg-panel-2/60 px-2 py-1.5 text-sm">
        <button
          onClick={produce}
          disabled={rounds <= 0 || (ownedRows.length === 0 && !addProduct)}
          className={btn("primary")}
          title="หักวัตถุดิบที่มีอยู่แล้วออกจากคลังตามจำนวนที่ใช้ และเพิ่มผลผลิตเข้าคลัง"
        >
          ผลิตแล้ว {silver(rounds)} รอบ → ปรับคลัง
        </button>
        <label className="flex items-center gap-1.5 text-muted">
          <input type="checkbox" checked={addProduct} onChange={(e) => setAddProduct(e.target.checked)} className={checkboxCls} />
          เพิ่ม {items[ev.productId]?.th ?? "ผลผลิต"} ×{silver(productUnits)} เข้าคลังด้วย
        </label>
        {ownedRows.length > 0 ? (
          <span className="text-muted">จะหัก {ownedRows.length} รายการที่มีอยู่แล้ว</span>
        ) : (
          <span className="text-muted">ยังไม่มีวัตถุดิบในคลังให้หัก</span>
        )}
      </div>
      {done && (
        <Notice tone="good" className="mt-2" action={{ label: "เลิกทำ", onClick: undo }}>
          ปรับคลังแล้ว {done.changes.length} รายการ
        </Notice>
      )}

      <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Stat label={`ขายได้สุทธิ (${silver(qty)} ชิ้น)`} value={silver(revenue)} />
        <Stat label="เงินสดที่ต้องใช้ซื้อเพิ่ม" value={silver(buyCost)} />
        <Stat label="กำไร (หักเฉพาะที่ซื้อเพิ่ม)" value={<Money value={cashProfit} tone="profit" />} emphasis />
        <Stat label="กำไรเทียบต้นทุนเต็ม" value={<Money value={fullProfit} tone="profit" />} />
      </div>
      <p className="mt-2 text-xs text-muted">
        ช่อง &ldquo;มีอยู่แล้ว&rdquo; บันทึกไว้กับบัญชีของคุณ ใช้ร่วมกันทุกสูตรและทุกเครื่อง (ดู/แก้รวมได้ที่หน้า &ldquo;คลังของ&rdquo;) · ต้นทุนของของที่มีอยู่ตั้งได้ในตั้งค่า
      </p>
    </Card>
  );
}
