"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CostEngine } from "@/lib/engine/cost";
import { ideasFromInventory } from "@/lib/engine/ideas";
import { IMPERIAL_TYPES, PROCESSING_TYPES, RECIPE_TYPE_TH } from "@/lib/engine/mastery";
import type { Item, ItemId, MarketPrice, Recipe, RecipeEvaluation, RecipeType } from "@/lib/engine/types";
import { signed, signedPct, silverShort, timeAgo } from "@/lib/format";
import type { SessionUser } from "./auth/UserMenu";
import { InventoryIdeas } from "./InventoryIdeas";
import { ItemIcon } from "./ItemIcon";
import { OnboardingCard } from "./OnboardingCard";
import { TopNav } from "./TopNav";
import { FavoriteStar } from "./FavoriteStar";
import { useInventory, useSettings, useUserData } from "./UserDataProvider";
import { btn } from "./ui/button";
import { Card, CardHeader } from "./ui/Card";
import { EmptyState } from "./ui/EmptyState";
import { Money } from "./ui/Money";
import { Notice } from "./ui/Notice";
import { SkeletonCards } from "./ui/Skeleton";

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
  const { favorites, favoriteItems } = useUserData();
  const [data, setData] = useState<DataResponse | null>(null);
  const [prices, setPrices] = useState<Record<ItemId, MarketPrice>>({});
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [pricesLoaded, setPricesLoaded] = useState(false);
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
      .catch((e: Error) => setError(e.message))
      .finally(() => setPricesLoaded(true));
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

  const ideas = useMemo(
    () => (data && pricesLoaded ? ideasFromInventory({ recipes: data.recipes, items: data.items, prices, inventory, settings }) : []),
    [data, pricesLoaded, prices, inventory, settings],
  );
  const ownedCount = Object.values(inventory).filter((v) => v && v.qty > 0).length;

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

  // best profit per unit for each starred product, when a recipe makes it
  const bestByProduct = useMemo(() => {
    const m = new Map<ItemId, RecipeEvaluation>();
    for (const ev of evaluations) {
      if (!Number.isFinite(ev.profitPerUnit)) continue;
      const cur = m.get(ev.productId);
      if (!cur || ev.profitPerUnit > cur.profitPerUnit) m.set(ev.productId, ev);
    }
    return m;
  }, [evaluations]);

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

      {error && (
        <Notice tone="bad" className="mb-3">
          โหลดข้อมูลไม่สำเร็จ: {error}
        </Notice>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>
          คิดจาก Mastery ของคุณ: แปรธาตุ <b className="num text-foreground">{settings.mastery.alchemy ?? 0}</b> · ทำอาหาร{" "}
          <b className="num text-foreground">{settings.mastery.cooking ?? 0}</b> · แปรรูป <b className="num text-foreground">{settings.mastery.processing ?? 0}</b> · Value Pack{" "}
          <b className="text-foreground">{settings.valuePack ? "เปิด" : "ปิด"}</b>
        </span>
        <button onClick={() => setShowSetup(true)} className={btn("secondary", "sm")}>
          แก้ไข
        </button>
      </div>

      {!data || !pricesLoaded ? (
        <SkeletonCards n={6} label={!data ? "กำลังโหลดฐานสูตร…" : "กำลังโหลดราคาตลาด…"} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {/* the one gold card on the page: the thing to act on first */}
          <Card tone="highlight">
            <CardHeader
              tone="highlight"
              title="ทำอะไรได้จากของในคลัง"
              action={
                <Link href="/inventory" className={btn("ghost", "sm")}>
                  คลังของ →
                </Link>
              }
            />
            {ownedCount === 0 ? (
              <EmptyState
                title="ยังไม่มีของในคลัง"
                hint="เพิ่มของที่มีไว้ แล้วระบบจะบอกว่าเอาไปทำอะไรได้กำไรสุด"
                action={{ label: "เพิ่มของในคลัง", href: "/inventory" }}
              />
            ) : (
              <InventoryIdeas ideas={ideas} items={items} limit={TOP} emptyText="ของที่มีตอนนี้ยังประกอบเป็นสูตรไหนไม่ครบ" />
            )}
          </Card>
          {favorites.length > 0 && (
            <Card>
              <CardHeader title="ของที่ฉันเฝ้า" hint="กด ★ ในหน้าคำนวณสูตร / สแกนตลาด" />
              <ul className="divide-y divide-border">
                {favorites.map((id) => {
                  const it = items[id];
                  const fav = favoriteItems.find((f) => f.id === id);
                  const name = it?.th ?? fav?.th ?? `#${id}`;
                  const price = prices[id]?.price ?? fav?.price ?? null;
                  const stock = prices[id]?.stock ?? fav?.stock ?? null;
                  const best = bestByProduct.get(id);
                  return (
                    <li key={id} className="flex items-center gap-3 px-4 py-2 text-sm">
                      <ItemIcon id={id} grade={it?.grade ?? fav?.grade ?? 0} size={28} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{name}</div>
                        <div className="line-clamp-2 text-xs text-muted">
                          {price ? `ราคา ${silverShort(price)} · ค้างขาย ${silverShort(stock ?? 0)}` : "ไม่มีในตลาด"}
                          {best ? ` · ทำเองกำไร ${signed(best.profitPerUnit, silverShort)}/ชิ้น` : ""}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Link href={`/market?q=${encodeURIComponent(name)}`} className={btn("secondary", "sm")}>
                          ตลาด
                        </Link>
                        <Link href={`/recipes?q=${encodeURIComponent(name)}`} className={btn("secondary", "sm")}>
                          สูตร
                        </Link>
                        <FavoriteStar id={id} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
          {sections.map((s) => (
            <Card key={s.key}>
              <CardHeader
                title={s.title}
                action={
                  <Link href={s.href} className={btn("ghost", "sm")}>
                    ดูทั้งหมด →
                  </Link>
                }
              />
              {s.rows.length === 0 ? (
                <EmptyState title="ยังไม่มีสูตรที่กำไรเป็นบวกในหมวดนี้ตอนนี้" />
              ) : (
                <ul className="divide-y divide-border">
                  {s.rows.map((ev, i) => (
                    <HighlightRow key={ev.recipe.id} rank={i + 1} ev={ev} item={items[ev.productId]} stock={prices[ev.productId]?.stock} />
                  ))}
                </ul>
              )}
            </Card>
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
          <div className="line-clamp-2 text-xs text-muted">
            {RECIPE_TYPE_TH[ev.recipe.type]} · ต้นทุน {silverShort(ev.unitCost)} → {ev.saleChannel === "imperial" ? "ส่งราชวัง" : "ขาย"} {silverShort(ev.sellPrice)}
            {ev.flags.materialSoldOut ? " · วัตถุดิบบางตัวหมดตลาด" : ""}
            {ev.saleChannel === "market" && stock === 0 ? " · ขาดตลาด" : ""}
          </div>
        </div>
        <div className="text-right">
          <div className="font-semibold">
            <Money value={ev.profitPerUnit} tone="profit" compact />
          </div>
          <div className="num text-xs text-muted">ROI {signedPct(ev.roi)}</div>
        </div>
      </Link>
    </li>
  );
}
