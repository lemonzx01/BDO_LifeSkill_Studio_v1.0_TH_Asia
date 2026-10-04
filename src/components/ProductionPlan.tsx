"use client";

import { useMemo, useState } from "react";
import { planProduction, type ConsumeChange } from "@/lib/engine/consume";
import { flattenRequirements } from "@/lib/engine/cost";
import type { Inventory, Item, ItemId, MarketPrice, OwnedCostMode, RecipeEvaluation } from "@/lib/engine/types";
import { silver } from "@/lib/format";
import { GUEST_STORAGE_NOTE } from "@/lib/guest/storage";
import { NET, OWNED_COST, SETTINGS_TITLE } from "@/lib/settings-labels";
import { ItemIcon } from "./ItemIcon";
import { NumberInput } from "./NumberInput";
import { useSettings, useUserData } from "./UserDataProvider";
import { Badge } from "./ui/Badge";
import { btn } from "./ui/button";
import { useConfirm } from "./ui/ConfirmDialog";
import { checkboxCls, fieldCls } from "./ui/field";
import { Icon } from "./ui/Icon";
import { Money } from "./ui/Money";
import { Notice } from "./ui/Notice";
import { Stat } from "./ui/Stat";
import { fillCellCls, headCls, itemCellCls, itemNameCls, rowCls, tableCls, tdCls, tdNumCls, thCls, thNumCls } from "./ui/table";

/**
 * The profit at the recipe's own cost (qty × กำไร/ชิ้น), named after how that cost counts the
 * stock you own (the "ของที่มีอยู่แล้ว คิดต้นทุน" setting), so it never claims market prices
 * when the setting says otherwise.
 */
const FULL_PROFIT_LABEL: Record<OwnedCostMode, string> = {
  market: "กำไรถ้าคิดของในคลังตามราคาตลาด",
  avg: "กำไรถ้าคิดของในคลังตามราคาที่จ่ายจริง",
  zero: "กำไรตามต้นทุน/ชิ้นของสูตร",
};

/**
 * "I want N of this" -> crafts needed, every raw material across all recipe
 * layers, what you already own, what is left to buy and what it costs.
 *
 * Read top to bottom: how many (the question), what it comes to (the tiles), the material list
 * (a table where RecipeDetail's @container is wide enough, stacked rows where it is not), then
 * the one button that records the crafts in the inventory.
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
  const { setOwned, guest } = useUserData();
  const [settings] = useSettings();
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
          <span className="num inline-flex shrink-0 items-center gap-1.5 text-foreground">
            {silver(c.before)}
            <Icon name="arrow-right" className="h-3.5 w-3.5 text-muted" />
            <span className="sr-only">เป็น</span>
            {silver(c.after)}
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
    <div>
      {confirmDialog}
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h3 className="font-display text-title font-semibold text-balance text-foreground">แผนผลิต</h3>
        <p className="text-xs text-muted">วัตถุดิบทุกชั้น ของที่มีแล้ว และที่ต้องซื้อเพิ่ม</p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-panel-2/40 px-3 py-2.5 text-sm">
          <label className="flex items-center gap-2">
            อยากได้
            <NumberInput min={0} step={10} value={qty} onChange={(v) => setQty(Math.floor(v))} className={`${fieldCls("sm")} w-24`} />
            ชิ้น
          </label>
          <span className="text-muted">
            = <b className="num font-semibold text-foreground">{silver(rounds)}</b> รอบ (ผลผลิต {ev.expectedYield.toFixed(2)}/รอบ)
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 @3xl:grid-cols-4">
          <Stat label={`${NET} (${silver(qty)} ชิ้น)`} value={silver(revenue)} />
          <Stat label="เงินสดที่ต้องใช้ซื้อเพิ่ม" value={silver(buyCost)} />
          <Stat label="กำไรเงินสด (ของในคลังคิดฟรี)" value={<Money value={cashProfit} tone="profit" />} emphasis />
          <Stat label={FULL_PROFIT_LABEL[settings.ownedCostMode]} value={<Money value={fullProfit} tone="profit" />} />
        </div>

        {/* a narrow detail (a phone, the side pane on a small desktop): one block per material */}
        <ul className="divide-y divide-border overflow-clip rounded-xl border border-border text-sm @2xl:hidden">
          {rows.map((r) => {
            const th = r.item?.th ?? `#${r.id}`;
            return (
              <li key={r.id} className="flex flex-col gap-1.5 px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <ItemIcon id={r.id} grade={r.item?.grade} size={28} />
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">{th}</span>
                  <span className="shrink-0 text-xs text-muted" title={r.price ? `ราคา/ชิ้น ${silver(r.price)}` : undefined}>
                    จ่าย <b className="num text-sm font-semibold text-foreground">{silver(r.cost)}</b>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-9.5 text-xs text-muted">
                  <span>
                    ต้องใช้ <b className="num font-medium text-foreground">{silver(r.need)}</b>
                  </span>
                  <span className="flex items-center gap-1.5">
                    มี
                    <NumberInput
                      min={0}
                      value={r.owned}
                      blankZero
                      placeholder="0"
                      onChange={(v) => setOwned(r.id, Math.floor(v))}
                      aria-label={`มีอยู่แล้ว ${th}`}
                      className={`${fieldCls("sm")} w-20`}
                    />
                  </span>
                  <span>
                    ซื้อ <b className={`num font-medium ${r.toBuy > 0 ? "text-foreground" : ""}`}>{silver(r.toBuy)}</b>
                  </span>
                  {r.soldOut && (
                    <Badge tone="warn" icon="alert-triangle">
                      ของหมด
                    </Badge>
                  )}
                  {!r.item?.market && !r.item?.npcBuy && <Badge tone="warn">ต้องหาเอง</Badge>}
                </div>
              </li>
            );
          })}
          <li className="flex justify-between gap-3 bg-panel-2/60 px-3 py-2.5 font-semibold">
            <span>รวมต้องซื้อเพิ่ม</span>
            <span className="num">{silver(buyCost)}</span>
          </li>
        </ul>

        {/* a wide detail: the table (the name column takes what is left and truncates) */}
        <div className="hidden overflow-clip rounded-xl border border-border @2xl:block">
          <table className={tableCls}>
            <thead className={headCls}>
              <tr>
                <th className={thCls}>วัตถุดิบ (ทุกชั้น)</th>
                <th className={thNumCls}>ต้องใช้</th>
                <th className={thNumCls}>มีอยู่แล้ว</th>
                <th className={thNumCls}>ต้องซื้อเพิ่ม</th>
                <th className={thNumCls}>ราคา/ชิ้น</th>
                <th className={thNumCls}>ต้องจ่าย</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={rowCls}>
                  <td className={`${tdCls} ${fillCellCls}`}>
                    <span className={itemCellCls}>
                      <ItemIcon id={r.id} grade={r.item?.grade} size={24} />
                      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        <span className={itemNameCls}>{r.item?.th ?? `#${r.id}`}</span>
                        {r.soldOut && (
                          <Badge tone="warn" icon="alert-triangle">
                            ของหมด
                          </Badge>
                        )}
                        {!r.item?.market && !r.item?.npcBuy && <Badge tone="warn">ต้องหาเอง</Badge>}
                      </span>
                    </span>
                  </td>
                  <td className={tdNumCls}>{silver(r.need)}</td>
                  <td className={tdNumCls}>
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
                  <td className={`${tdNumCls} ${r.toBuy > 0 ? "" : "text-muted"}`}>{silver(r.toBuy)}</td>
                  <td className={`${tdNumCls} text-muted`}>{r.price ? silver(r.price) : "-"}</td>
                  <td className={`${tdNumCls} font-medium`}>{silver(r.cost)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-panel-2/60 font-semibold">
                <td className={tdCls} colSpan={5}>
                  รวมต้องซื้อเพิ่ม
                </td>
                <td className={tdNumCls}>{silver(buyCost)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-panel-2/40 px-3 py-3 text-sm">
          <button
            type="button"
            onClick={produce}
            disabled={rounds <= 0 || (ownedRows.length === 0 && !addProduct)}
            className={btn("primary")}
            title="หักวัตถุดิบที่มีอยู่แล้วออกจากคลังตามจำนวนที่ใช้ และเพิ่มผลผลิตเข้าคลัง"
          >
            ผลิตแล้ว {silver(rounds)} รอบ
            <Icon name="arrow-right" className="h-4 w-4" />
            ปรับคลัง
          </button>
          <label className="flex min-h-10 items-center gap-2 text-muted md:min-h-0">
            <input type="checkbox" checked={addProduct} onChange={(e) => setAddProduct(e.target.checked)} className={checkboxCls} />
            เพิ่ม {items[ev.productId]?.th ?? "ผลผลิต"} ×{silver(productUnits)} เข้าคลังด้วย
          </label>
          {ownedRows.length > 0 ? (
            <span className="text-xs text-muted">จะหัก {ownedRows.length} รายการที่มีอยู่แล้ว</span>
          ) : (
            <span className="text-xs text-muted">ยังไม่มีวัตถุดิบในคลังให้หัก</span>
          )}
        </div>
        {done && (
          <Notice tone="good" action={{ label: "เลิกทำ", onClick: undo }}>
            ปรับคลังแล้ว {done.changes.length} รายการ
          </Notice>
        )}

        <p className="text-xs text-muted">
          {guest ? (
            <>ช่อง &ldquo;มีอยู่แล้ว&rdquo; {GUEST_STORAGE_NOTE} ใช้ร่วมกันทุกสูตร</>
          ) : (
            <>ช่อง &ldquo;มีอยู่แล้ว&rdquo; บันทึกไว้กับบัญชีของคุณ ใช้ร่วมกันทุกสูตรและทุกเครื่อง</>
          )}{" "}
          (ดู/แก้รวมได้ที่หน้า &ldquo;คลังของ&rdquo;) · &ldquo;{OWNED_COST}&rdquo; ตั้งได้ใน{SETTINGS_TITLE}
        </p>
      </div>
    </div>
  );
}
