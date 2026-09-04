"use client";

import { useEffect, useState } from "react";
import type { Inventory, Item, ItemId, MarketPrice, RecipeEvaluation } from "@/lib/engine/types";
import { pct, silver, silverShort } from "@/lib/format";
import { CostTree, type TreeTools } from "./CostTree";
import { ProductionPlan } from "./ProductionPlan";

interface MarketDetail {
  history: number[];
  orders: { price: number; sellers: number; buyers: number }[];
}

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
  // The parent keys this component by product id, so state resets per product.
  const [state, setState] = useState<{ status: "loading" | "done" | "error"; detail: MarketDetail | null }>({ status: "loading", detail: null });
  const detail = state.detail;
  const loading = state.status === "loading";
  const product = items[ev.productId];
  const mp = prices[ev.productId];

  useEffect(() => {
    if (!product?.market) return;
    let cancelled = false;
    fetch(`/api/market/${ev.productId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: MarketDetail) => {
        if (!cancelled) setState({ status: "done", detail: d });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", detail: null });
      });
    return () => {
      cancelled = true;
    };
  }, [ev.productId, product?.market]);

  const hist = detail?.history ?? [];
  const min = hist.length ? Math.min(...hist) : 0;
  const max = hist.length ? Math.max(...hist) : 0;
  const avg = hist.length ? hist.reduce((a, b) => a + b, 0) / hist.length : 0;
  const buyers = detail?.orders.reduce((a, o) => a + o.buyers, 0) ?? 0;
  const sellers = detail?.orders.reduce((a, o) => a + o.sellers, 0) ?? 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div>
        {alternatives.length > 1 && (
          <div className="mb-3 rounded-lg border border-border bg-panel p-2">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">ของชิ้นนี้ทำได้ {alternatives.length} สูตร (เลือกดู)</div>
            <div className="flex flex-wrap gap-1.5">
              {alternatives.map((alt) => {
                const active = alt.recipe.id === ev.recipe.id;
                const mats = alt.recipe.materials.map((m) => `${items[m.id]?.th ?? `#${m.id}`} ×${m.qty}`).join(" + ");
                return (
                  <button
                    key={alt.recipe.id}
                    onClick={() => onPick?.(alt.recipe.id)}
                    title={mats}
                    className={`max-w-full truncate rounded border px-2 py-1 text-left text-xs ${active ? "border-accent bg-accent/10 text-accent" : "border-border bg-panel-2 text-muted hover:text-foreground"}`}
                  >
                    {alt.flags.unknownCost ? "ต้นทุนไม่ครบ" : `ต้นทุน ${silverShort(alt.unitCost)}/ชิ้น`} · ผลผลิต {alt.expectedYield.toFixed(1)} · {mats}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {ev.flags.unknownCost && (
          <div className="mb-3 rounded border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
            ต้นทุนไม่ครบ: วัตถุดิบบางตัวไม่มีราคาในตลาดและไม่มีสูตรทำ (ดูแถวที่ขึ้น &ldquo;ไม่ทราบราคา&rdquo; ด้านล่าง) ตัวเลขกำไรของสูตรนี้จึงเชื่อไม่ได้
          </div>
        )}
        <div className="mb-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <Stat label="ผลผลิต/รอบ" value={ev.expectedYield.toFixed(2)} />
          <Stat label="ต้นทุน/รอบ" value={silver(ev.materialCostPerCraft)} />
          <Stat label="ต้นทุน/ชิ้น" value={silver(ev.unitCost)} />
          <Stat
            label={ev.saleChannel === "imperial" ? "ได้จาก NPC ราชวัง/กล่อง (รวมโบนัส Mastery)" : `ได้รับสุทธิ/ชิ้น (${pct(ev.netRate, 1)})`}
            value={silver(ev.netPerUnit)}
          />
          <Stat label="กำไร/ชิ้น" value={silver(ev.profitPerUnit)} tone={ev.profitPerUnit >= 0 ? "good" : "bad"} />
          <Stat label="กำไร/รอบ" value={silver(ev.profitPerCraft)} tone={ev.profitPerCraft >= 0 ? "good" : "bad"} />
          <Stat label="ROI" value={pct(ev.roi, 1)} tone={ev.roi >= 0 ? "good" : "bad"} />
          {ev.saleChannel === "imperial" ? (
            <Stat label="กำไร/ชม." value="- (มีโควตาต่อวัน)" />
          ) : (
            <Stat label="กำไร/ชม." value={silverShort(ev.profitPerHour)} tone={ev.profitPerHour >= 0 ? "good" : "bad"} />
          )}
        </div>
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">วัตถุดิบต่อ 1 รอบ (เลือกทางที่ถูกที่สุดให้แล้ว)</h4>
        <div className="mb-1 flex justify-end gap-2 pr-1 text-[11px] text-muted">
          <span className="w-16 text-right">จำนวน</span>
          <span className="w-16" />
          <span className="w-24 text-right">ราคา/ชิ้น</span>
          <span className="w-28 text-right">รวม</span>
        </div>
        {ev.tree.children && (
          <CostTree items={items} tools={tools}>
            {ev.tree.children}
          </CostTree>
        )}
        {tools && <p className="mt-1 text-[11px] text-muted">กดชื่อวัตถุดิบเพื่อดูว่าทำเองต้องใช้อะไร และกดปุ่มเพื่อบังคับซื้อ/ทำเองต่อชั้น (มีผลทั้งหน้าจนกว่าจะรีเฟรช)</p>}
        <ProductionPlan ev={ev} items={items} prices={prices} inventory={inventory} />
      </div>

      <aside className="rounded-lg border border-border bg-panel p-3 text-sm">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">ตลาด: {product?.th}</h4>
        {!product?.market ? (
          <p className="text-muted">ไอเท็มนี้ซื้อขายในตลาดกลางไม่ได้</p>
        ) : (
          <>
            <div className="mb-2 grid grid-cols-2 gap-1">
              <Stat label="ราคาตอนนี้" value={mp ? silver(mp.price) : "-"} />
              <Stat label="ของค้างขาย" value={mp ? silver(mp.stock) : "-"} />
              <Stat label="รอซื้อ (ทุกช่วงราคา)" value={detail ? silver(buyers) : loading ? "…" : "-"} />
              <Stat label="รอขาย (ทุกช่วงราคา)" value={detail ? silver(sellers) : loading ? "…" : "-"} />
            </div>
            {hist.length > 1 ? (
              <>
                <Sparkline data={hist} />
                <div className="mt-1 grid grid-cols-3 gap-1 text-[11px] text-muted">
                  <span>ต่ำสุด 90 วัน: <b className="text-foreground">{silverShort(min)}</b></span>
                  <span>เฉลี่ย: <b className="text-foreground">{silverShort(avg)}</b></span>
                  <span>สูงสุด: <b className="text-foreground">{silverShort(max)}</b></span>
                </div>
                {mp && avg > 0 && (
                  <p className="mt-2 text-[11px] text-muted">
                    ราคาตอนนี้ {mp.price > avg ? "สูงกว่า" : "ต่ำกว่า"}ค่าเฉลี่ย 90 วัน {pct(Math.abs(mp.price / avg - 1))}
                    {mp.stock === 0 && buyers > 0 && " · ของหมด มีคนรอซื้อ ขายได้ทันที"}
                    {mp.stock > 0 && sellers > buyers && " · ของค้างขายเยอะ อาจขายช้า"}
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-muted">{loading ? "กำลังโหลดราคาย้อนหลัง…" : "ไม่มีข้อมูลราคาย้อนหลัง"}</p>
            )}
          </>
        )}
      </aside>
    </div>
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

function Sparkline({ data }: { data: number[] }) {
  const w = 280;
  const h = 56;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / span) * (h - 6) - 3}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-14 w-full" preserveAspectRatio="none" aria-label="ราคาย้อนหลัง 90 วัน">
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
