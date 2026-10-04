"use client";

import { useId, type ReactNode } from "react";
import { skillGroup } from "@/lib/engine/mastery";
import type { Inventory, Item, ItemId, MarketPrice, RecipeEvaluation } from "@/lib/engine/types";
import { pct, signedPct, silver, silverShort } from "@/lib/format";
import { GLOSSARY, perHourTip } from "@/lib/glossary";
import { NET } from "@/lib/settings-labels";
import { CostTree, type TreeTools } from "./CostTree";
import { MarketPanel } from "./market/MarketPanel";
import { ProductionPlan } from "./ProductionPlan";
import { useSettings } from "./UserDataProvider";
import { toggleCls } from "./ui/button";
import { SectionLabel } from "./ui/Card";
import { WithTip } from "./ui/InfoTip";
import { Money, pctTone } from "./ui/Money";
import { Notice } from "./ui/Notice";
import { Stat } from "./ui/Stat";

/**
 * Everything about one recipe, in the order a member asks: is it worth it (the verdict tiles), what
 * goes in (the cost tree), how much to buy for N (the production plan), and the product's market.
 *
 * Laid out by its own width (@container), not the screen's: the same detail opens under a row on a
 * phone, across a tablet and in the desktop side pane, and each gets the columns it has room for.
 * The cost tree and the plan read the same container.
 */
export function RecipeDetail({
  ev,
  items,
  prices,
  inventory,
  alternatives = [],
  onPick,
  tools,
}: {
  ev: RecipeEvaluation;
  items: Record<ItemId, Item>;
  prices: Record<ItemId, MarketPrice>;
  inventory: Inventory;
  /** every recipe that makes this product (including `ev`), best first */
  alternatives?: RecipeEvaluation[];
  onPick?: (recipeId: number) => void;
  /** lets the cost tree peek into bought materials and force buy/craft per item */
  tools?: TreeTools;
}) {
  const [settings] = useSettings();
  const product = items[ev.productId];
  const mp = prices[ev.productId];
  const imperial = ev.saleChannel === "imperial";
  const altLabelId = useId();

  return (
    <div className="@container">
      <div className="space-y-5">
        {alternatives.length > 1 && (
          <div>
            <SectionLabel as="div" className="mb-2">
              <span id={altLabelId}>ของชิ้นนี้ทำได้ {alternatives.length} สูตร (เลือกดู)</span>
            </SectionLabel>
            <div role="group" aria-labelledby={altLabelId} className="grid grid-cols-1 gap-2 @xl:grid-cols-2">
              {alternatives.map((alt) => {
                const active = alt.recipe.id === ev.recipe.id;
                const mats = alt.recipe.materials.map((m) => `${items[m.id]?.th ?? `#${m.id}`} ×${m.qty}`).join(" + ");
                return (
                  <button
                    key={alt.recipe.id}
                    type="button"
                    onClick={() => onPick?.(alt.recipe.id)}
                    title={mats}
                    aria-pressed={active}
                    className={`flex min-h-10 min-w-0 flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left text-xs transition-colors duration-150 ${toggleCls(active)}`}
                  >
                    <span className="num font-medium">
                      {alt.flags.unknownCost ? "ต้นทุนไม่ครบ" : `ต้นทุน ${silverShort(alt.unitCost)}/ชิ้น`} · ผลผลิต {alt.expectedYield.toFixed(1)}
                    </span>
                    <span className={`line-clamp-2 ${active ? "" : "text-muted"}`}>{mats}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {ev.flags.unknownCost && (
          <Notice tone="bad">
            ต้นทุนไม่ครบ: วัตถุดิบบางตัวไม่มีราคาในตลาดและไม่มีสูตรทำ (ดูแถวที่ขึ้น &ldquo;ไม่ทราบราคา&rdquo; ด้านล่าง) ตัวเลขกำไรของสูตรนี้จึงเชื่อไม่ได้
          </Notice>
        )}

        {/* the verdict: profit, cost, ROI and what one sells for, then the per-craft and per-hour
            figures in a quieter row. Four tiles across only from @3xl: in the side pane (~700px)
            a figure like 21,276,000,000 needs half the row */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 @3xl:grid-cols-4">
            <Stat label={<WithTip label="กำไร/ชิ้น" tip={GLOSSARY.profitPerUnit} />} value={<Money value={ev.profitPerUnit} tone="profit" />} emphasis />
            <Stat label="ต้นทุน/ชิ้น" value={silver(ev.unitCost)} />
            <Stat label={<WithTip label="ROI" tip={GLOSSARY.roi} />} value={signedPct(ev.roi, 1)} tone={pctTone(ev.roi, 1)} />
            <Stat
              label={
                imperial ? <WithTip label="ได้จาก NPC ราชวัง/กล่อง (รวมโบนัส Mastery)" tip={GLOSSARY.imperial} /> : `${NET}/ชิ้น (${pct(ev.netRate, 1)})`
              }
              value={silver(ev.netPerUnit)}
              hint={!imperial && ev.sellPrice > 0 ? `ราคาขาย ${silver(ev.sellPrice)}` : undefined}
            />
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-xl border border-border px-3 py-2.5 @xl:grid-cols-4">
            <Fact label="ผลผลิต/รอบ">{ev.expectedYield.toFixed(2)}</Fact>
            <Fact label="ต้นทุน/รอบ">{silver(ev.materialCostPerCraft)}</Fact>
            <Fact label={<WithTip label="กำไร/รอบ" tip={GLOSSARY.profitPerCraft} />}>
              <Money value={ev.profitPerCraft} tone="profit" />
            </Fact>
            {imperial ? (
              <Fact label={<WithTip label="กำไร/ชม." tip={GLOSSARY.imperialPerHour} />}>- (มีโควตาต่อวัน)</Fact>
            ) : (
              <Fact label={<WithTip label="กำไร/ชม." tip={perHourTip(settings.craftsPerHour, skillGroup(ev.recipe.type))} />}>
                <Money value={ev.profitPerHour} tone="profit" />
              </Fact>
            )}
          </dl>
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <h3 className="font-display text-title font-semibold text-balance text-foreground">วัตถุดิบต่อ 1 รอบ</h3>
            <p className="text-xs text-muted">เลือกทางที่ถูกที่สุดให้แล้ว</p>
          </div>
          <div className="rounded-xl border border-border">
            {/* the cost tree's columns (CostTree rows): name cell, then จำนวน / ราคา/ชิ้น (from @md) / รวม */}
            <div className="flex items-center gap-2 rounded-t-xl border-b border-border bg-panel-2 px-3 py-2 text-xs font-medium text-muted">
              <span className="min-w-0 flex-1">วัตถุดิบ</span>
              <span className="w-14 shrink-0 text-right @md:w-16">จำนวน</span>
              <span className="hidden w-24 shrink-0 text-right @md:block">ราคา/ชิ้น</span>
              <span className="w-24 shrink-0 text-right @md:w-28">รวม</span>
            </div>
            {ev.tree.children && (
              <div className="px-1.5 py-1">
                <CostTree items={items} tools={tools}>
                  {ev.tree.children}
                </CostTree>
              </div>
            )}
          </div>
          {tools && <p className="mt-2 text-xs text-muted">กดชื่อวัตถุดิบเพื่อดูว่าทำเองต้องใช้อะไร และกดปุ่มเพื่อบังคับซื้อ/ทำเองต่อชั้น (มีผลทั้งหน้าจนกว่าจะรีเฟรช)</p>}
        </div>

        <ProductionPlan ev={ev} items={items} prices={prices} inventory={inventory} />

        {/* nested, under an h3 like the sections above: it already sits inside the pane's card */}
        <MarketPanel id={ev.productId} name={product?.th ?? ""} price={mp?.price} stock={mp?.stock} market={!!product?.market} nested headingAs="h3" />
      </div>
    </div>
  );
}

/** One figure in the quieter row under the verdict tiles. */
function Fact({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="num mt-0.5 text-sm font-semibold text-foreground">{children}</dd>
    </div>
  );
}
