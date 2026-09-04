"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CostEngine } from "@/lib/engine/cost";
import { IMPERIAL_TYPES, PROCESSING_TYPES, RECIPE_TYPE_TH } from "@/lib/engine/mastery";
import type { Item, ItemId, MarketPrice, Recipe, RecipeEvaluation, RecipeType } from "@/lib/engine/types";
import { pct, silverShort, timeAgo } from "@/lib/format";
import type { SessionUser } from "./auth/UserMenu";
import { ItemIcon } from "./ItemIcon";
import { OnboardingCard } from "./OnboardingCard";
import { TopNav } from "./TopNav";
import { useInventory, useSettings } from "./UserDataProvider";

interface DataResponse {
  recipes: Recipe[];
  items: Record<ItemId, Item>;
  meta: { importedAt: string };
}
interface PricesResponse {
  prices: Record<ItemId, MarketPrice>;
  fetchedAt: number | null;
}
const TOP = 10;

export function Dashboard({ user, hasSettings }: { user: SessionUser; hasSettings: boolean }) {
  const [settings, setSettings] = useSettings();
  const inventory = useInventory();
  const [data, setData] = useState<DataResponse | null>(null);
  const [prices, setPrices] = useState<Record<ItemId, MarketPrice>>({});
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(!hasSettings);

  useEffect(() => {
    fetch("/api/data", { cache: "no-cache" })
      .then((r) => (r.ok ? (r.json() as Promise<DataResponse>) : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setData)
      .catch((e: Error) => setError(e.message));
    fetch("/api/prices?ids=all")
      .then((r) => (r.ok ? (r.json() as Promise<PricesResponse>) : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => {
        setPrices(j.prices);
        setFetchedAt(j.fetchedAt);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const items = useMemo(() => data?.items ?? ({} as Record<ItemId, Item>), [data]);
  const evaluations = useMemo(() => {
    if (!data) return [] as RecipeEvaluation[];
    const engine = new CostEngine({ items: data.items, recipes: data.recipes, prices, settings, inventory, ownedCostMode: settings.ownedCostMode });
    return engine.evaluateAll();
  }, [data, prices, settings, inventory]);

  // "feasible" = fully priced, sellable, within the member's skill tier, and actually profitable
  const feasible = useMemo(
    () =>
      evaluations.filter(
        (ev) => !ev.flags.unknownCost && !ev.flags.productNoPrice && !ev.flags.productNotMarketable && !ev.flags.aboveSkill && ev.profitPerUnit > 0,
      ),
    [evaluations],
  );
  const byProfit = (list: RecipeEvaluation[]) => [...list].sort((a, b) => b.profitPerUnit - a.profitPerUnit);
  const dedupe = (list: RecipeEvaluation[]) => {
    const seen = new Set<number>();
    return list.filter((ev) => (seen.has(ev.productId) ? false : (seen.add(ev.productId), true)));
  };
  const top = (pred: (t: RecipeType) => boolean) => dedupe(byProfit(feasible.filter((ev) => pred(ev.recipe.type)))).slice(0, TOP);

  const sections = useMemo(
    () =>
      data
        ? [
            { key: "alchemy", title: "แปรธาตุที่คุ้มสุดตอนนี้", href: "/recipes?tab=alchemy", rows: top((t) => t === "alchemy") },
            { key: "cooking", title: "ทำอาหารที่คุ้มสุดตอนนี้", href: "/recipes?tab=cooking", rows: top((t) => t === "cooking") },
            { key: "processing", title: "แปรรูปที่คุ้มสุดตอนนี้", href: "/recipes?tab=processing", rows: top((t) => PROCESSING_TYPES.includes(t)) },
            { key: "imperial", title: "กล่องราชวังที่คุ้มสุด", href: "/recipes?tab=imperial", rows: top((t) => IMPERIAL_TYPES.includes(t)) },
            {
              key: "shortage",
              title: "ของที่ตลาดขาดตอนนี้ (ทำแล้วขายได้ทันที)",
              href: "/recipes?market=soldout",
              rows: dedupe(byProfit(feasible.filter((ev) => ev.saleChannel === "market" && (prices[ev.productId]?.stock ?? 1) === 0))).slice(0, TOP),
            },
          ]
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, feasible, prices],
  );

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-4 md:px-6">
      <TopNav user={user} subtitle={`สวัสดี ${user.displayName} · ตลาดกลาง Asia · ราคาอัปเดต ${fetchedAt ? timeAgo(fetchedAt) : "กำลังโหลด…"}`} />

      {showSetup && (
        <OnboardingCard
          settings={settings}
          onSave={(next) => {
            setSettings(next);
            setShowSetup(false);
          }}
          onSkip={() => setShowSetup(false)}
        />
      )}

      {error && <div className="mb-3 rounded border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">โหลดข้อมูลไม่สำเร็จ: {error}</div>}

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>
          คิดจาก Mastery ของคุณ: แปรธาตุ <b className="num text-foreground">{settings.mastery.alchemy ?? 0}</b> · ทำอาหาร{" "}
          <b className="num text-foreground">{settings.mastery.cooking ?? 0}</b> · แปรรูป <b className="num text-foreground">{settings.mastery.processing ?? 0}</b> · Value Pack{" "}
          <b className="text-foreground">{settings.valuePack ? "เปิด" : "ปิด"}</b>
        </span>
        <button onClick={() => setShowSetup(true)} className="rounded border border-border bg-panel px-2 py-1 hover:bg-panel-2">
          แก้ไข
        </button>
      </div>

      {!data ? (
        <div className="rounded-lg border border-border bg-panel px-4 py-10 text-center text-muted">กำลังโหลดสูตรและราคา…</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sections.map((s) => (
            <section key={s.key} className="rounded-lg border border-border bg-panel">
              <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <h2 className="text-sm font-semibold text-accent">{s.title}</h2>
                <Link href={s.href} className="text-xs text-muted hover:text-foreground">
                  ดูทั้งหมด →
                </Link>
              </header>
              {s.rows.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted">ยังไม่มีสูตรที่กำไรเป็นบวกในหมวดนี้ตอนนี้</p>
              ) : (
                <ul className="divide-y divide-border">
                  {s.rows.map((ev, i) => (
                    <HighlightRow key={ev.recipe.id} rank={i + 1} ev={ev} item={items[ev.productId]} stock={prices[ev.productId]?.stock} />
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      <footer className="mt-6 text-xs text-muted">
        แสดงเฉพาะสูตรที่ราคาครบ ขายได้ และไม่เกินระดับทักษะที่ตั้งไว้ · ตัวเลขเปลี่ยนตามราคาตลาดและ Mastery ของแต่ละคน · รายละเอียดและตัวกรองทั้งหมดอยู่ที่หน้า{" "}
        <Link href="/recipes" className="underline">
          คำนวณสูตร
        </Link>
      </footer>
    </main>
  );
}

function HighlightRow({ rank, ev, item, stock }: { rank: number; ev: RecipeEvaluation; item: Item | undefined; stock: number | undefined }) {
  const href = `/recipes?open=${ev.recipe.id}`;
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-panel-2/60">
        <span className="w-4 text-center text-xs text-muted">{rank}</span>
        <ItemIcon id={ev.productId} grade={item?.grade} size={32} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{item?.th ?? ev.recipe.name}</div>
          <div className="truncate text-[11px] text-muted">
            {RECIPE_TYPE_TH[ev.recipe.type]} · ต้นทุน {silverShort(ev.unitCost)} → {ev.saleChannel === "imperial" ? "ส่งราชวัง" : "ขาย"} {silverShort(ev.sellPrice)}
            {ev.flags.materialSoldOut ? " · วัตถุดิบบางตัวหมดตลาด" : ""}
            {ev.saleChannel === "market" && stock === 0 ? " · ขาดตลาด" : ""}
          </div>
        </div>
        <div className="text-right">
          <div className="num font-semibold text-good">+{silverShort(ev.profitPerUnit)}</div>
          <div className="num text-[11px] text-muted">ROI {pct(ev.roi)}</div>
        </div>
      </Link>
    </li>
  );
}
