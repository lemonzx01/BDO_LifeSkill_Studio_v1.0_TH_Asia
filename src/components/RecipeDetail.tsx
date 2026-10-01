"use client";

import { skillGroup } from "@/lib/engine/mastery";
import type { Inventory, Item, ItemId, MarketPrice, RecipeEvaluation } from "@/lib/engine/types";
import { pct, signedPct, silver, silverShort } from "@/lib/format";
import { GLOSSARY, perHourTip } from "@/lib/glossary";
import { CostTree, type TreeTools } from "./CostTree";
import { MarketPanel } from "./market/MarketPanel";
import { ProductionPlan } from "./ProductionPlan";
import { useSettings } from "./UserDataProvider";
import { toggleCls } from "./ui/button";
import { Card, SectionLabel } from "./ui/Card";
import { WithTip } from "./ui/InfoTip";
import { Money, pctTone } from "./ui/Money";
import { Notice } from "./ui/Notice";
import { Stat } from "./ui/Stat";

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

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div>
        {alternatives.length > 1 && (
          <Card as="div" className="mb-3 p-2">
            <SectionLabel as="div" className="mb-1">
              ของชิ้นนี้ทำได้ {alternatives.length} สูตร (เลือกดู)
            </SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {alternatives.map((alt) => {
                const active = alt.recipe.id === ev.recipe.id;
                const mats = alt.recipe.materials.map((m) => `${items[m.id]?.th ?? `#${m.id}`} ×${m.qty}`).join(" + ");
                return (
                  <button
                    key={alt.recipe.id}
                    onClick={() => onPick?.(alt.recipe.id)}
                    title={mats}
                    aria-pressed={active}
                    className={`max-w-full rounded px-2 py-1 text-left text-xs transition-colors ${toggleCls(active)}`}
                  >
                    <span className="line-clamp-2">
                      {alt.flags.unknownCost ? "ต้นทุนไม่ครบ" : `ต้นทุน ${silverShort(alt.unitCost)}/ชิ้น`} · ผลผลิต {alt.expectedYield.toFixed(1)} · {mats}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        )}
        {ev.flags.unknownCost && (
          <Notice tone="bad" className="mb-3">
            ต้นทุนไม่ครบ: วัตถุดิบบางตัวไม่มีราคาในตลาดและไม่มีสูตรทำ (ดูแถวที่ขึ้น &ldquo;ไม่ทราบราคา&rdquo; ด้านล่าง) ตัวเลขกำไรของสูตรนี้จึงเชื่อไม่ได้
          </Notice>
        )}
        <div className="mb-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <Stat label="ผลผลิต/รอบ" value={ev.expectedYield.toFixed(2)} />
          <Stat label="ต้นทุน/รอบ" value={silver(ev.materialCostPerCraft)} />
          <Stat label="ต้นทุน/ชิ้น" value={silver(ev.unitCost)} />
          <Stat
            label={
              imperial ? <WithTip label="ได้จาก NPC ราชวัง/กล่อง (รวมโบนัส Mastery)" tip={GLOSSARY.imperial} /> : `ได้รับสุทธิ/ชิ้น (${pct(ev.netRate, 1)})`
            }
            value={silver(ev.netPerUnit)}
          />
          <Stat label={<WithTip label="กำไร/ชิ้น" tip={GLOSSARY.profitPerUnit} />} value={<Money value={ev.profitPerUnit} tone="profit" />} emphasis />
          <Stat label={<WithTip label="กำไร/รอบ" tip={GLOSSARY.profitPerCraft} />} value={<Money value={ev.profitPerCraft} tone="profit" />} />
          <Stat label={<WithTip label="ROI" tip={GLOSSARY.roi} />} value={signedPct(ev.roi, 1)} tone={pctTone(ev.roi, 1)} />
          {imperial ? (
            <Stat label={<WithTip label="กำไร/ชม." tip={GLOSSARY.imperialPerHour} />} value="- (มีโควตาต่อวัน)" />
          ) : (
            <Stat
              label={<WithTip label="กำไร/ชม." tip={perHourTip(settings.craftsPerHour, skillGroup(ev.recipe.type))} />}
              value={<Money value={ev.profitPerHour} tone="profit" />}
            />
          )}
        </div>
        <SectionLabel as="h4" className="mb-1">
          วัตถุดิบต่อ 1 รอบ (เลือกทางที่ถูกที่สุดให้แล้ว)
        </SectionLabel>
        {/* the cost tree's columns (CostTree rows): name cell, then จำนวน / ราคา/ชิ้น (from sm) / รวม */}
        <div className="mb-1 flex items-center gap-2 px-1 text-xs text-muted">
          <span className="min-w-0 flex-1" />
          <span className="w-14 shrink-0 text-right sm:w-16">จำนวน</span>
          <span className="hidden w-24 shrink-0 text-right sm:block">ราคา/ชิ้น</span>
          <span className="w-24 shrink-0 text-right sm:w-28">รวม</span>
        </div>
        {ev.tree.children && (
          <CostTree items={items} tools={tools}>
            {ev.tree.children}
          </CostTree>
        )}
        {tools && <p className="mt-1 text-xs text-muted">กดชื่อวัตถุดิบเพื่อดูว่าทำเองต้องใช้อะไร และกดปุ่มเพื่อบังคับซื้อ/ทำเองต่อชั้น (มีผลทั้งหน้าจนกว่าจะรีเฟรช)</p>}
        <ProductionPlan ev={ev} items={items} prices={prices} inventory={inventory} />
      </div>

      <MarketPanel id={ev.productId} name={product?.th ?? ""} price={mp?.price} stock={mp?.stock} market={!!product?.market} />
    </div>
  );
}
