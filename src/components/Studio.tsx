"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CostEngine } from "@/lib/engine/cost";
import { IMPERIAL_TYPES, PROCESSING_TYPES, RECIPE_TYPE_TH } from "@/lib/engine/mastery";
import type { Inventory, Item, ItemId, MarketPrice, Recipe, RecipeEvaluation, RecipeType } from "@/lib/engine/types";
import { downloadCsv, toCsv } from "@/lib/csv";
import { pct, silver, silverShort, timeAgo } from "@/lib/format";
import { ItemIcon } from "./ItemIcon";
import { RecipeDetail } from "./RecipeDetail";
import { SettingsPanel } from "./SettingsPanel";
import type { SessionUser } from "./auth/UserMenu";
import { TopNav } from "./TopNav";
import { useInventory, useSettings } from "./UserDataProvider";

type Tab = "all" | "alchemy" | "cooking" | "processing" | "imperial";
type SortKey = "profitPerHour" | "profitPerUnit" | "profitPerCraft" | "roi" | "unitCost";
type MarketFilter = "all" | "soldout" | "instock";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "alchemy", label: "แปรธาตุ" },
  { key: "cooking", label: "ทำอาหาร" },
  { key: "processing", label: "แปรรูป" },
  { key: "imperial", label: "ราชวัง" },
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

export function Studio({ user }: { user: SessionUser }) {
  const [settings, setSettings] = useSettings();
  const inventory = useInventory();
  const [data, setData] = useState<DataResponse | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<ItemId, MarketPrice>>({});
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>("all");
  const [method, setMethod] = useState<RecipeType | "all">("all");
  const [query, setQuery] = useState("");
  const [hideIncomplete, setHideIncomplete] = useState(true);
  const [hideSoldOut, setHideSoldOut] = useState(false);
  const [marketFilter, setMarketFilter] = useState<MarketFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("profitPerUnit");
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
      .then((json) => setData(json))
      .catch((e: Error) => setDataError(e.message));
  }, []);
  const load = (force = false) => {
    setLoading(true);
    void fetchPrices(force);
  };

  const recipes = useMemo(() => data?.recipes ?? [], [data]);
  const items = useMemo(() => data?.items ?? ({} as Record<ItemId, Item>), [data]);
  const engine = useMemo(
    () => new CostEngine({ items, recipes, prices, settings, inventory, ownedCostMode: settings.ownedCostMode }),
    [items, recipes, prices, settings, inventory],
  );
  const evaluations = useMemo(() => engine.evaluateAll(), [engine]);

  const rows = useMemo(() => {
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
    list.sort((a, b) => (sortKey === "unitCost" ? a.unitCost - b.unitCost : b[sortKey] - a[sortKey]));
    return list;
  }, [evaluations, tab, method, query, hideIncomplete, hideSoldOut, marketFilter, sortKey, items, prices]);

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
          <button onClick={() => load(true)} disabled={loading} className="rounded border border-border bg-panel px-3 py-1.5 text-sm hover:bg-panel-2 disabled:opacity-50">
            {loading ? "กำลังโหลด…" : "รีเฟรชราคา"}
          </button>
          <button onClick={exportCsv} disabled={busy || rows.length === 0} className="rounded border border-border bg-panel px-3 py-1.5 text-sm hover:bg-panel-2 disabled:opacity-50">
            ส่งออก CSV
          </button>
          <button
            onClick={() => setShowSettings((s) => !s)}
            className={`rounded border px-3 py-1.5 text-sm ${showSettings ? "border-accent bg-accent/10 text-accent" : "border-border bg-panel hover:bg-panel-2"}`}
          >
            ตั้งค่า
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">โหลดราคาไม่สำเร็จ: {error} — ตัวเลขที่เห็นอาจไม่ครบ ลองกดรีเฟรชอีกครั้ง</div>
      )}
      {dataError && <div className="mb-3 rounded border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">โหลดฐานข้อมูลสูตรไม่สำเร็จ: {dataError}</div>}

      {showSettings && (
        <div className="mb-4">
          <SettingsPanel settings={settings} onChange={setSettings} />
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded border border-border bg-panel p-0.5">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`rounded px-3 py-1 text-sm ${tab === t.key ? "bg-accent text-black" : "text-muted hover:text-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>
        {tab === "processing" && (
          <select value={method} onChange={(e) => setMethod(e.target.value as RecipeType | "all")} className="rounded border border-border bg-panel px-2 py-1.5 text-sm">
            <option value="all">วิธีแปรรูป: ทั้งหมด</option>
            {PROCESSING_TYPES.map((t) => (
              <option key={t} value={t}>
                {RECIPE_TYPE_TH[t]}
              </option>
            ))}
          </select>
        )}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาชื่อไอเท็ม (ไทย/อังกฤษ)…"
          className="min-w-[200px] flex-1 rounded border border-border bg-panel px-3 py-1.5 text-sm outline-none focus:border-accent"
        />
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="rounded border border-border bg-panel px-2 py-1.5 text-sm">
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              เรียงตาม: {s.label}
            </option>
          ))}
        </select>
        <select
          value={marketFilter}
          onChange={(e) => setMarketFilter(e.target.value as MarketFilter)}
          className={`rounded border px-2 py-1.5 text-sm ${marketFilter === "all" ? "border-border bg-panel" : "border-accent bg-accent/10 text-accent"}`}
        >
          {MARKET_FILTERS.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-muted">
          <input type="checkbox" checked={hideIncomplete} onChange={(e) => setHideIncomplete(e.target.checked)} className="accent-accent" />
          ซ่อนที่ข้อมูลไม่ครบ
        </label>
        <label className="flex items-center gap-1.5 text-sm text-muted">
          <input type="checkbox" checked={hideSoldOut} onChange={(e) => setHideSoldOut(e.target.checked)} className="accent-accent" />
          ซ่อนที่วัตถุดิบหมดตลาด
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-panel">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-panel-2 text-xs text-muted">
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
                open={expanded === ev.recipe.id}
                onToggle={() => setExpanded(expanded === ev.recipe.id ? null : ev.recipe.id)}
              />
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted">
                  {busy ? "กำลังโหลดสูตรและราคา…" : "ไม่พบสูตรที่ตรงเงื่อนไข"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length > limit && (
        <div className="mt-3 text-center">
          <button onClick={showMore} className="rounded border border-border bg-panel px-4 py-1.5 text-sm hover:bg-panel-2">
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
  open,
  onToggle,
}: {
  ev: RecipeEvaluation;
  items: Record<ItemId, Item>;
  prices: Record<ItemId, MarketPrice>;
  inventory: Inventory;
  open: boolean;
  onToggle: () => void;
}) {
  const item = items[ev.productId];
  const good = ev.profitPerUnit > 0;
  return (
    <>
      <tr onClick={onToggle} className={`cursor-pointer border-t border-border hover:bg-panel-2/60 ${open ? "bg-panel-2/40" : ""}`}>
        <td className="px-3 py-1.5">
          <div className="flex items-center gap-2">
            <ItemIcon id={ev.productId} grade={item?.grade} size={30} />
            <div className="min-w-0">
              <div className="truncate font-medium">{item?.th ?? ev.recipe.name}</div>
              <div className="truncate text-[11px] text-muted">
                {RECIPE_TYPE_TH[ev.recipe.type]}
                {ev.recipe.skill.sort > 0 ? ` · ${ev.recipe.skill.display}` : ""} · ผลผลิต {ev.expectedYield.toFixed(1)}/รอบ
              </div>
            </div>
          </div>
        </td>
        <td className="num px-2 py-1.5 text-right">{silver(ev.unitCost)}</td>
        <td className="num px-2 py-1.5 text-right">{ev.sellPrice ? silver(ev.sellPrice) : "-"}</td>
        <td className={`num px-2 py-1.5 text-right font-semibold ${good ? "text-good" : "text-bad"}`}>{silver(ev.profitPerUnit)}</td>
        <td className={`num px-2 py-1.5 text-right ${good ? "text-good" : "text-bad"}`}>{pct(ev.roi)}</td>
        <td className="num px-2 py-1.5 text-right">{silverShort(ev.profitPerCraft)}</td>
        <td className={`num px-2 py-1.5 text-right font-semibold ${good ? "text-good" : "text-bad"}`}>
          {ev.saleChannel === "imperial" ? <span className="text-muted">-</span> : silverShort(ev.profitPerHour)}
        </td>
        <td className="px-2 py-1.5">
          <Flags ev={ev} stock={prices[ev.productId]?.stock} />
        </td>
      </tr>
      {open && (
        <tr className="border-t border-border bg-background/40">
          <td colSpan={8} className="px-3 py-3">
            <RecipeDetail key={ev.productId} ev={ev} items={items} prices={prices} inventory={inventory} />
          </td>
        </tr>
      )}
    </>
  );
}

function Flags({ ev, stock }: { ev: RecipeEvaluation; stock?: number }) {
  const f = ev.flags;
  const chips: { text: string; cls: string }[] = [];
  if (ev.saleChannel === "imperial") chips.push({ text: "ส่งราชวัง ไม่หักภาษี", cls: "bg-accent/15 text-accent" });
  else if (f.productNotMarketable) chips.push({ text: "ขายตลาดไม่ได้", cls: "bg-zinc-500/20 text-zinc-300" });
  else if (f.productNoPrice) chips.push({ text: "ไม่มีราคาขาย", cls: "bg-zinc-500/20 text-zinc-300" });
  if (f.unknownCost) chips.push({ text: "ต้นทุนไม่ครบ", cls: "bg-rose-500/15 text-rose-300" });
  if (f.materialSoldOut) chips.push({ text: "วัตถุดิบหมด", cls: "bg-warn/15 text-warn" });
  if (f.aboveSkill) chips.push({ text: "เกินระดับ", cls: "bg-violet-500/15 text-violet-300" });
  if (ev.saleChannel === "market" && !f.productNotMarketable && !f.productNoPrice && stock !== undefined) {
    if (stock > 0) chips.push({ text: `ค้างขาย ${silverShort(stock)}`, cls: "bg-sky-500/10 text-sky-300" });
    else chips.push({ text: "ขาดตลาด", cls: "bg-good/15 text-good" });
  }
  if (chips.length === 0) chips.push({ text: "พร้อม", cls: "bg-good/15 text-good" });
  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((c) => (
        <span key={c.text} className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] ${c.cls}`}>
          {c.text}
        </span>
      ))}
    </div>
  );
}
