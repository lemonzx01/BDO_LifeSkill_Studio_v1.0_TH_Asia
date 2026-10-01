"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { isBoolean, oneOf, usePersistentState } from "@/lib/use-persistent";
import { CostEngine } from "@/lib/engine/cost";
import { IMPERIAL_TYPES, PROCESSING_TYPES, RECIPE_TYPE_TH } from "@/lib/engine/mastery";
import type { Inventory, Item, ItemId, MarketPrice, Overrides, Recipe, RecipeEvaluation, RecipeType } from "@/lib/engine/types";
import { downloadCsv, toCsv } from "@/lib/csv";
import { signedPct, silver, silverShort, timeAgo } from "@/lib/format";
import type { TreeTools } from "./CostTree";
import { FavoriteStar } from "./FavoriteStar";
import { ItemIcon } from "./ItemIcon";
import { RecipeDetail } from "./RecipeDetail";
import { SettingsPanel } from "./SettingsPanel";
import type { SessionUser } from "./auth/UserMenu";
import { TopNav } from "./TopNav";
import { useInventory, useSettings } from "./UserDataProvider";
import { Badge, type BadgeTone } from "./ui/Badge";
import { btn, btnShape, toggleCls } from "./ui/button";
import { cardCls } from "./ui/Card";
import { EmptyState } from "./ui/EmptyState";
import { checkboxCls, selectCls } from "./ui/field";
import { Money, pctCls } from "./ui/Money";
import { Notice } from "./ui/Notice";
import { SearchInput } from "./ui/SearchInput";
import { Segmented } from "./ui/Segmented";
import { SkeletonRows } from "./ui/Skeleton";

type Tab = "all" | "alchemy" | "cooking" | "processing" | "imperial";
type SortKey = "profitPerHour" | "profitPerUnit" | "profitPerCraft" | "roi" | "unitCost";
type MarketFilter = "all" | "soldout" | "instock";

const TABS: { value: Tab; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "alchemy", label: "แปรธาตุ" },
  { value: "cooking", label: "ทำอาหาร" },
  { value: "processing", label: "แปรรูป" },
  { value: "imperial", label: "ราชวัง" },
];
const SORTS: { key: SortKey; label: string }[] = [
  { key: "profitPerUnit", label: "กำไร/ชิ้น" },
  { key: "roi", label: "ROI" },
  { key: "profitPerCraft", label: "กำไร/รอบ" },
  { key: "profitPerHour", label: "กำไร/ชม." },
  { key: "unitCost", label: "ต้นทุนต่ำสุด" },
];
const MARKET_FILTERS: { key: MarketFilter; label: string }[] = [
  { key: "all", label: "สภาพตลาด: ทั้งหมด" },
  { key: "soldout", label: "ขาดตลาด (ของหมด ขายได้ทันที)" },
  { key: "instock", label: "มีของค้างขาย" },
];
const PAGE = 100;
const SOURCE_LABEL: Record<string, string> = {
  snapshot: "ฐานข้อมูลตลาด (อัปเดตทุก 5 นาที)",
  official: "Pearl Abyss",
  arsha: "arsha.io",
};

interface PricesResponse {
  prices: Record<ItemId, MarketPrice>;
  fetchedAt: number | null;
  source: "official" | "arsha" | "snapshot" | null;
}
interface DataResponse {
  recipes: Recipe[];
  items: Record<ItemId, Item>;
  meta: { importedAt: string; recipeCount: number; itemCount: number };
}

const TAB_KEYS: Tab[] = ["all", "alchemy", "cooking", "processing", "imperial"];

export function Studio({ user }: { user: SessionUser }) {
  const params = useSearchParams();
  const [settings, setSettings] = useSettings();
  const inventory = useInventory();
  const [data, setData] = useState<DataResponse | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<ItemId, MarketPrice>>({});
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // links from the home page can preselect a tab / market filter / search / an open recipe
  const paramTab = params.get("tab") as Tab | null;
  const openId = Number(params.get("open"));
  const [tab, setTab] = useState<Tab>(paramTab && TAB_KEYS.includes(paramTab) ? paramTab : "all");
  const [method, setMethod] = useState<RecipeType | "all">("all");
  const [query, setQuery] = useState(params.get("q") ?? "");
  // remembered per browser
  const [hideIncomplete, setHideIncomplete] = usePersistentState<boolean>("recipes.hideIncomplete", true, isBoolean);
  const [hideSoldOut, setHideSoldOut] = usePersistentState<boolean>("recipes.hideSoldOut", false, isBoolean);
  const [marketFilter, setMarketFilter] = useState<MarketFilter>(params.get("market") === "soldout" ? "soldout" : "all");
  const [sortKey, setSortKey] = usePersistentState<SortKey>("recipes.sort", "profitPerUnit", oneOf(["profitPerHour", "profitPerUnit", "profitPerCraft", "roi", "unitCost"] as const));
  const filterKey = JSON.stringify([tab, method, query, hideIncomplete, hideSoldOut, marketFilter, sortKey]);
  const [limitState, setLimitState] = useState({ key: filterKey, limit: PAGE });
  const limit = limitState.key === filterKey ? limitState.limit : PAGE;
  const showMore = () => setLimitState({ key: filterKey, limit: limit + PAGE });
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // State is only touched inside promise callbacks so the effect bodies stay pure.
  const fetchPrices = useCallback((force: boolean) => {
    return fetch(`/api/prices?ids=all${force ? "&force=1" : ""}`)
      .then((res) => (res.ok ? (res.json() as Promise<PricesResponse>) : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((json) => {
        setPrices(json.prices);
        setFetchedAt(json.fetchedAt);
        setSource(json.source);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    void fetchPrices(false);
  }, [fetchPrices]);
  useEffect(() => {
    fetch("/api/data", { cache: "no-cache" })
      .then((res) => (res.ok ? (res.json() as Promise<DataResponse>) : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((json) => {
        setData(json);
        // "?open=<recipeId>": show that recipe expanded, whatever the filters would have hidden
        if (openId) {
          const r = json.recipes.find((x) => x.id === openId);
          if (r) {
            const product = r.products.find((p) => p.kind === "main") ?? r.products[0];
            setQuery(json.items[product?.id ?? 0]?.th ?? r.name);
            setTab("all");
            setHideIncomplete(false);
            setMarketFilter("all");
            setExpanded(r.id);
          }
        }
      })
      .catch((e: Error) => setDataError(e.message));
  }, [openId, setHideIncomplete]);
  const load = (force = false) => {
    setLoading(true);
    void fetchPrices(force);
  };

  const recipes = useMemo(() => data?.recipes ?? [], [data]);
  const items = useMemo(() => data?.items ?? ({} as Record<ItemId, Item>), [data]);
  // per-item "force buy" / "force craft" chosen in the cost tree (page-local, not saved)
  const [overrides, setOverrides] = useState<Overrides>({});
  const engine = useMemo(
    () => new CostEngine({ items, recipes, prices, settings, inventory, ownedCostMode: settings.ownedCostMode, overrides }),
    [items, recipes, prices, settings, inventory, overrides],
  );
  const tools = useMemo<TreeTools>(
    () => ({
      engine,
      overrides,
      onOverride: (id, mode) =>
        setOverrides((prev) => {
          const next: Overrides = { ...prev };
          if (mode) next[id] = { mode };
          else delete next[id];
          return next;
        }),
    }),
    [engine, overrides],
  );
  const evaluations = useMemo(() => engine.evaluateAll(), [engine]);

  const rowsAndAlts = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = evaluations.filter((ev) => {
      const t = ev.recipe.type;
      if (tab === "alchemy" && t !== "alchemy") return false;
      if (tab === "cooking" && t !== "cooking") return false;
      if (tab === "processing") {
        if (!PROCESSING_TYPES.includes(t)) return false;
        if (method !== "all" && t !== method) return false;
      }
      if (tab === "imperial" && !IMPERIAL_TYPES.includes(t)) return false;
      if (hideIncomplete && (ev.flags.unknownCost || ev.flags.productNoPrice || ev.flags.productNotMarketable || ev.flags.aboveSkill)) return false;
      if (hideSoldOut && ev.flags.materialSoldOut) return false;
      if (marketFilter !== "all") {
        const stock = prices[ev.productId]?.stock;
        if (stock === undefined || ev.flags.productNotMarketable) return false;
        if (marketFilter === "soldout" && stock > 0) return false;
        if (marketFilter === "instock" && stock <= 0) return false;
      }
      if (q) {
        const it = items[ev.productId];
        const hay = `${ev.recipe.name} ${it?.th ?? ""} ${it?.en ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // recipes whose cost is incomplete (an ingredient has no price) can never rank by profit: always last
    const cmp = (a: RecipeEvaluation, b: RecipeEvaluation) => (sortKey === "unitCost" ? a.unitCost - b.unitCost : b[sortKey] - a[sortKey]);
    list.sort((a, b) => (a.flags.unknownCost === b.flags.unknownCost ? cmp(a, b) : a.flags.unknownCost ? 1 : -1));
    // one row per product: the best recipe leads, the other recipes for the same item are reachable from its detail
    const seen = new Map<string, RecipeEvaluation>();
    const alts = new Map<number, RecipeEvaluation[]>();
    const out: RecipeEvaluation[] = [];
    for (const ev of list) {
      const key = `${ev.recipe.type}:${ev.productId}`;
      const prev = seen.get(key);
      if (prev) {
        alts.get(prev.recipe.id)!.push(ev);
        continue;
      }
      seen.set(key, ev);
      alts.set(ev.recipe.id, []);
      out.push(ev);
    }
    return { rows: out, alts };
  }, [evaluations, tab, method, query, hideIncomplete, hideSoldOut, marketFilter, sortKey, items, prices]);
  const rows = rowsAndAlts.rows;
  const alts = rowsAndAlts.alts;
  const evById = useMemo(() => new Map(evaluations.map((ev) => [ev.recipe.id, ev])), [evaluations]);
  // which recipe's detail is shown inside the expanded row (a row can switch to one of its alternatives)
  const [detailId, setDetailId] = useState<number | null>(null);

  const busy = loading || !data;

  const exportCsv = () => {
    const header = ["สูตร", "ประเภท", "ระดับทักษะ", "ผลผลิต/รอบ", "ต้นทุน/ชิ้น", "ราคาขาย", "ได้รับสุทธิ/ชิ้น", "กำไร/ชิ้น", "ROI %", "กำไร/รอบ", "กำไร/ชม.", "สถานะ"];
    const body = rows.map((ev) => [
      items[ev.productId]?.th ?? ev.recipe.name,
      RECIPE_TYPE_TH[ev.recipe.type],
      ev.recipe.skill.display,
      ev.expectedYield.toFixed(2),
      Math.round(ev.unitCost),
      Math.round(ev.sellPrice),
      Math.round(ev.netPerUnit),
      Math.round(ev.profitPerUnit),
      (ev.roi * 100).toFixed(1),
      Math.round(ev.profitPerCraft),
      ev.saleChannel === "imperial" ? "" : Math.round(ev.profitPerHour),
      [
        ev.flags.unknownCost ? "ต้นทุนไม่ครบ" : "",
        ev.flags.materialSoldOut ? "วัตถุดิบหมด" : "",
        ev.flags.productNoPrice ? "ไม่มีราคาขาย" : "",
        ev.saleChannel === "imperial" ? "ส่งราชวัง" : "",
      ]
        .filter(Boolean)
        .join(" / "),
    ]);
    downloadCsv(`bdo-profit-${new Date().toISOString().slice(0, 10)}.csv`, toCsv([header, ...body]));
  };

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-4 md:px-6">
      <TopNav
        user={user}
        subtitle={`ตลาดกลาง Asia · ราคาอัปเดต ${loading ? "กำลังโหลด…" : timeAgo(fetchedAt)}${source ? ` · แหล่ง ${SOURCE_LABEL[source] ?? source}` : ""}`}
      />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">จัดอันดับกำไรสูตร แปรธาตุ / ทำอาหาร / แปรรูป</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => load(true)} disabled={loading} className={btn("secondary")}>
            {loading ? "กำลังโหลด…" : "รีเฟรชราคา"}
          </button>
          <button onClick={exportCsv} disabled={busy || rows.length === 0} className={btn("secondary")}>
            ส่งออก CSV
          </button>
          <button onClick={() => setShowSettings((s) => !s)} aria-pressed={showSettings} className={`${btnShape()} ${toggleCls(showSettings)}`}>
            ตั้งค่า
          </button>
        </div>
      </div>

      {error && (
        <Notice tone="bad" className="mb-3" action={{ label: loading ? "กำลังโหลด…" : "ลองใหม่", onClick: () => load(true), disabled: loading }}>
          โหลดราคาไม่สำเร็จ: {error} ตัวเลขที่เห็นอาจไม่ครบ
        </Notice>
      )}
      {dataError && (
        <Notice tone="bad" className="mb-3">
          โหลดฐานข้อมูลสูตรไม่สำเร็จ: {dataError}
        </Notice>
      )}

      {showSettings && (
        <div className="mb-4">
          <SettingsPanel settings={settings} onChange={setSettings} />
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Segmented label="สายอาชีพ" options={TABS} value={tab} onChange={setTab} />
        {tab === "processing" && (
          <select aria-label="วิธีแปรรูป" value={method} onChange={(e) => setMethod(e.target.value as RecipeType | "all")} className={selectCls()}>
            <option value="all">วิธีแปรรูป: ทั้งหมด</option>
            {PROCESSING_TYPES.map((t) => (
              <option key={t} value={t}>
                {RECIPE_TYPE_TH[t]}
              </option>
            ))}
          </select>
        )}
        <SearchInput label="ค้นหาชื่อไอเท็ม" value={query} onChange={setQuery} placeholder="ค้นหาชื่อไอเท็ม…" className="min-w-[200px] flex-1" />
        <select aria-label="เรียงตาม" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className={selectCls()}>
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              เรียงตาม: {s.label}
            </option>
          ))}
        </select>
        <select aria-label="สภาพตลาด" value={marketFilter} onChange={(e) => setMarketFilter(e.target.value as MarketFilter)} className={selectCls("md", marketFilter !== "all")}>
          {MARKET_FILTERS.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-muted">
          <input type="checkbox" checked={hideIncomplete} onChange={(e) => setHideIncomplete(e.target.checked)} className={checkboxCls} />
          ซ่อนที่ข้อมูลไม่ครบ
        </label>
        <label className="flex items-center gap-1.5 text-sm text-muted">
          <input type="checkbox" checked={hideSoldOut} onChange={(e) => setHideSoldOut(e.target.checked)} className={checkboxCls} />
          ซ่อนที่วัตถุดิบหมดตลาด
        </label>
      </div>

      {busy && rows.length === 0 && <SkeletonRows n={8} label={!data ? "กำลังโหลดฐานสูตร…" : "กำลังโหลดราคาตลาด…"} className="mb-3" />}

      {/* phones: one card per recipe */}
      <div className={`space-y-2 md:hidden ${busy && rows.length === 0 ? "hidden" : ""}`}>
        {rows.slice(0, limit).map((ev) => (
          <RecipeCard
            key={ev.recipe.id}
            ev={ev}
            items={items}
            prices={prices}
            inventory={inventory}
            tools={tools}
            alts={alts.get(ev.recipe.id) ?? []}
            detail={(detailId !== null && expanded === ev.recipe.id ? evById.get(detailId) : undefined) ?? ev}
            onPickDetail={setDetailId}
            open={expanded === ev.recipe.id}
            onToggle={() => {
              setDetailId(null);
              setExpanded(expanded === ev.recipe.id ? null : ev.recipe.id);
            }}
          />
        ))}
        {/* while loading this list is hidden and the skeleton above shows instead */}
        {rows.length === 0 && <EmptyState title="ไม่พบสูตรที่ตรงเงื่อนไข" className={cardCls()} />}
      </div>

      <div className={`overflow-x-auto rounded-lg border border-border bg-panel lg:overflow-visible ${busy && rows.length === 0 ? "hidden" : "hidden md:block"}`}>
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-panel-2 text-xs text-muted lg:sticky lg:top-0 lg:z-10">
            <tr>
              <th className="px-3 py-2 text-left font-medium">สูตร</th>
              <th className="px-2 py-2 text-right font-medium">ต้นทุน/ชิ้น</th>
              <th className="px-2 py-2 text-right font-medium">ราคาขาย</th>
              <th className="px-2 py-2 text-right font-medium">กำไร/ชิ้น</th>
              <th className="px-2 py-2 text-right font-medium">ROI</th>
              <th className="px-2 py-2 text-right font-medium">กำไร/รอบ</th>
              <th className="px-2 py-2 text-right font-medium">กำไร/ชม.</th>
              <th className="px-2 py-2 text-left font-medium">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map((ev) => (
              <Row
                key={ev.recipe.id}
                ev={ev}
                items={items}
                prices={prices}
                inventory={inventory}
                tools={tools}
                alts={alts.get(ev.recipe.id) ?? []}
                detail={(detailId !== null && expanded === ev.recipe.id ? evById.get(detailId) : undefined) ?? ev}
                onPickDetail={setDetailId}
                open={expanded === ev.recipe.id}
                onToggle={() => {
                  setDetailId(null);
                  setExpanded(expanded === ev.recipe.id ? null : ev.recipe.id);
                }}
              />
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <EmptyState title="ไม่พบสูตรที่ตรงเงื่อนไข" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length > limit && (
        <div className="mt-3 text-center">
          <button onClick={showMore} className={btn("secondary")}>
            แสดงเพิ่ม ({rows.length - limit} รายการ)
          </button>
        </div>
      )}
      {tab === "imperial" && (
        <p className="mt-3 text-xs text-muted">
          กล่องราชวังขายให้ NPC ส่งของราชวังเท่านั้น: &ldquo;ราคาขาย&rdquo; คือเงินที่ได้ต่อกล่อง รวมโบนัส Mastery แปรธาตุ/ทำอาหารแล้ว ไม่หักภาษีตลาด
          · แต่ละกล่องมีโควตารับซื้อจำกัดต่อรอบ และส่งได้จำกัดต่อวันต่อครอบครัว จึงไม่แสดงกำไร/ชม.
        </p>
      )}

      <footer className="mt-6 text-xs text-muted">
        สูตร {silver(recipes.length)} รายการ
        {data ? ` (นำเข้าเมื่อ ${new Date(data.meta.importedAt).toLocaleDateString("th-TH")})` : ""} · ราคาจาก Pearl Abyss / arsha.io / bdolytics · ข้อมูลสูตร bdocodex
      </footer>
    </main>
  );
}

function Row({
  ev,
  items,
  prices,
  inventory,
  tools,
  alts,
  detail,
  onPickDetail,
  open,
  onToggle,
}: {
  ev: RecipeEvaluation;
  items: Record<ItemId, Item>;
  prices: Record<ItemId, MarketPrice>;
  inventory: Inventory;
  tools: TreeTools;
  alts: RecipeEvaluation[];
  detail: RecipeEvaluation;
  onPickDetail: (id: number) => void;
  open: boolean;
  onToggle: () => void;
}) {
  const item = items[ev.productId];
  const unk = ev.flags.unknownCost;
  const alt = alts.length;
  return (
    <>
      <tr onClick={onToggle} className={`cursor-pointer border-t border-border hover:bg-panel-2/60 ${open ? "bg-panel-2/40" : ""}`}>
        <td className="px-3 py-1.5">
          <div className="flex items-center gap-2">
            <FavoriteStar id={ev.productId} />
            <ItemIcon id={ev.productId} grade={item?.grade} size={30} />
            <div className="min-w-0">
              <div className="truncate font-medium">{item?.th ?? ev.recipe.name}</div>
              <div className="truncate text-xs text-muted">
                {RECIPE_TYPE_TH[ev.recipe.type]}
                {ev.recipe.skill.sort > 0 ? ` · ${ev.recipe.skill.display}` : ""} · ผลผลิต {ev.expectedYield.toFixed(1)}/รอบ
                {alt > 0 ? ` · มีสูตรอื่นอีก ${alt} แบบ (ดูในรายละเอียด)` : ""}
              </div>
            </div>
          </div>
        </td>
        <td className="num px-2 py-1.5 text-right">{unk ? <span className="text-muted">? ({silverShort(ev.unitCost)}+)</span> : silver(ev.unitCost)}</td>
        <td className="num px-2 py-1.5 text-right">{ev.sellPrice ? silver(ev.sellPrice) : "-"}</td>
        {/* desktop table: full silver in every money column */}
        <td className="px-2 py-1.5 text-right font-semibold">
          <Money value={ev.profitPerUnit} tone="profit" unknown={unk} />
        </td>
        <td className={`num px-2 py-1.5 text-right ${pctCls(ev.roi, 0, unk)}`}>{unk ? "?" : signedPct(ev.roi)}</td>
        <td className="px-2 py-1.5 text-right">
          <Money value={ev.profitPerCraft} tone="profit" unknown={unk} />
        </td>
        <td className="px-2 py-1.5 text-right font-semibold">
          {ev.saleChannel === "imperial" && !unk ? <span className="text-muted">-</span> : <Money value={ev.profitPerHour} tone="profit" unknown={unk} />}
        </td>
        <td className="px-2 py-1.5">
          <Flags ev={ev} stock={prices[ev.productId]?.stock} />
        </td>
      </tr>
      {open && (
        <tr className="border-t border-border bg-background/40">
          <td colSpan={8} className="px-3 py-3">
            <RecipeDetail key={detail.recipe.id} ev={detail} items={items} prices={prices} inventory={inventory} alternatives={[ev, ...alts]} onPick={onPickDetail} tools={tools} />
          </td>
        </tr>
      )}
    </>
  );
}

function RecipeCard({
  ev,
  items,
  prices,
  inventory,
  tools,
  alts,
  detail,
  onPickDetail,
  open,
  onToggle,
}: {
  ev: RecipeEvaluation;
  items: Record<ItemId, Item>;
  prices: Record<ItemId, MarketPrice>;
  inventory: Inventory;
  tools: TreeTools;
  alts: RecipeEvaluation[];
  detail: RecipeEvaluation;
  onPickDetail: (id: number) => void;
  open: boolean;
  onToggle: () => void;
}) {
  const item = items[ev.productId];
  const unk = ev.flags.unknownCost;
  const alt = alts.length;
  return (
    <div className={`rounded-lg border bg-panel ${open ? "border-accent/60" : "border-border"}`}>
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-3 py-3 text-left">
        <ItemIcon id={ev.productId} grade={item?.grade} size={40} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{item?.th ?? ev.recipe.name}</div>
          <div className="line-clamp-2 text-xs text-muted">
            {RECIPE_TYPE_TH[ev.recipe.type]}
            {ev.recipe.skill.sort > 0 ? ` · ${ev.recipe.skill.display}` : ""} · ต้นทุน {unk ? "?" : silverShort(ev.unitCost)} → {ev.saleChannel === "imperial" ? "ส่ง" : "ขาย"}{" "}
            {ev.sellPrice ? silverShort(ev.sellPrice) : "-"}
            {alt > 0 ? ` · +${alt} สูตรอื่น` : ""}
          </div>
          <div className="mt-1">
            <Flags ev={ev} stock={prices[ev.productId]?.stock} />
          </div>
        </div>
        <div className="text-right">
          <div className="text-base font-semibold">
            <Money value={ev.profitPerUnit} tone="profit" compact unknown={unk} />
          </div>
          <div className={`num text-xs ${pctCls(ev.roi, 0, unk)}`}>{unk ? "ต้นทุนไม่ครบ" : `ROI ${signedPct(ev.roi)}`}</div>
          <div className="num text-xs text-muted">/ชิ้น</div>
        </div>
      </button>
      {open && (
        <div className="border-t border-border px-3 py-3">
          <RecipeDetail key={detail.recipe.id} ev={detail} items={items} prices={prices} inventory={inventory} alternatives={[ev, ...alts]} onPick={onPickDetail} tools={tools} />
        </div>
      )}
    </div>
  );
}

function Flags({ ev, stock }: { ev: RecipeEvaluation; stock?: number }) {
  const f = ev.flags;
  const chips: { text: string; tone: BadgeTone }[] = [];
  if (ev.saleChannel === "imperial") chips.push({ text: "ส่งราชวัง ไม่หักภาษี", tone: "accent" });
  else if (f.productNotMarketable) chips.push({ text: "ขายตลาดไม่ได้", tone: "neutral" });
  else if (f.productNoPrice) chips.push({ text: "ไม่มีราคาขาย", tone: "neutral" });
  if (f.unknownCost) chips.push({ text: "ต้นทุนไม่ครบ", tone: "bad" });
  if (f.materialSoldOut) chips.push({ text: "วัตถุดิบหมด", tone: "warn" });
  if (f.aboveSkill) chips.push({ text: "เกินระดับ", tone: "warn" });
  if (ev.saleChannel === "market" && !f.productNotMarketable && !f.productNoPrice && stock !== undefined) {
    if (stock > 0) chips.push({ text: `ค้างขาย ${silverShort(stock)}`, tone: "neutral" });
    else chips.push({ text: "ขาดตลาด", tone: "good" });
  }
  if (chips.length === 0) chips.push({ text: "พร้อม", tone: "good" });
  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((c) => (
        <Badge key={c.text} tone={c.tone}>
          {c.text}
        </Badge>
      ))}
    </div>
  );
}
