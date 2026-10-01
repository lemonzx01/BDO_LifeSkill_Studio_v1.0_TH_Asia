"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isBoolean, oneOf, usePersistentState } from "@/lib/use-persistent";
import { CostEngine, mainProduct } from "@/lib/engine/cost";
import { IMPERIAL_TYPES, PROCESSING_TYPES, RECIPE_TYPE_TH } from "@/lib/engine/mastery";
import type { Inventory, Item, ItemId, MarketPrice, Overrides, Recipe, RecipeEvaluation, RecipeType, SkillGroup } from "@/lib/engine/types";
import { downloadCsv, toCsv } from "@/lib/csv";
import { describeError, fetchJson, problemAction, type FetchProblem } from "@/lib/fetch-error";
import { signedPct, silver, silverShort, timeAgo } from "@/lib/format";
import { GLOSSARY, perHourTip } from "@/lib/glossary";
import { hiddenUnder, revealUnder } from "@/lib/scroll";
import { SETTINGS_TITLE } from "@/lib/settings-labels";
import type { TreeTools } from "./CostTree";
import { FavoriteStar } from "./FavoriteStar";
import { ItemIcon } from "./ItemIcon";
import { RecipeDetail } from "./RecipeDetail";
import { SettingsDrawer } from "./SettingsDrawer";
import type { SessionUser } from "./auth/UserMenu";
import { useInventory, useSettings } from "./UserDataProvider";
import { Badge, type BadgeTone } from "./ui/Badge";
import { btn, btnShape, toggleCls } from "./ui/button";
import { cardCls } from "./ui/Card";
import { EmptyState, type EmptyAction } from "./ui/EmptyState";
import { checkboxCls, selectCls } from "./ui/field";
import { WithTip } from "./ui/InfoTip";
import { Money, pctCls } from "./ui/Money";
import { Notice } from "./ui/Notice";
import { Page, PageHeader } from "./ui/Page";
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
  { key: "all", label: "ทุกสภาพตลาด" },
  { key: "soldout", label: "ขาดตลาด" },
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

/**
 * A deep link's one-off view: one product (?open=<recipeId>, from the home page and the inventory
 * ideas) or one search (?q=, from quick search and the home favourites). While it is on, the tab,
 * market and hide filters do not apply; they are not changed either, so closing it brings back
 * exactly what the member had saved.
 */
interface Focus {
  /** ?open=: only this product's rows; null for a ?q= search (the query narrows the list) */
  productId: ItemId | null;
  /** shown in the chip "กำลังดู: {name}" */
  name: string;
}

interface Filters {
  tab: Tab;
  method: RecipeType | "all";
  query: string;
  hideIncomplete: boolean;
  hideSoldOut: boolean;
  marketFilter: MarketFilter;
  focus: Focus | null;
}

/** The test one recipe must pass to be listed: the filters, or a deep link's focus in their place. */
function recipeFilter(f: Filters, items: Record<ItemId, Item>, prices: Record<ItemId, MarketPrice>): (ev: RecipeEvaluation) => boolean {
  const q = f.query.trim().toLowerCase();
  return (ev) => {
    if (f.focus && f.focus.productId !== null) return ev.productId === f.focus.productId;
    if (!f.focus) {
      const t = ev.recipe.type;
      if (f.tab === "alchemy" && t !== "alchemy") return false;
      if (f.tab === "cooking" && t !== "cooking") return false;
      if (f.tab === "processing") {
        if (!PROCESSING_TYPES.includes(t)) return false;
        if (f.method !== "all" && t !== f.method) return false;
      }
      if (f.tab === "imperial" && !IMPERIAL_TYPES.includes(t)) return false;
      if (f.hideIncomplete && (ev.flags.unknownCost || ev.flags.productNoPrice || ev.flags.productNotMarketable || ev.flags.aboveSkill)) return false;
      if (f.hideSoldOut && ev.flags.materialSoldOut) return false;
      if (f.marketFilter !== "all") {
        const stock = prices[ev.productId]?.stock;
        if (stock === undefined || ev.flags.productNotMarketable) return false;
        if (f.marketFilter === "soldout" && stock > 0) return false;
        if (f.marketFilter === "instock" && stock <= 0) return false;
      }
    }
    if (q) {
      const it = items[ev.productId];
      const hay = `${ev.recipe.name} ${it?.th ?? ""} ${it?.en ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  };
}

export function Studio({ user }: { user: SessionUser }) {
  const params = useSearchParams();
  const [settings] = useSettings();
  const inventory = useInventory();
  const [data, setData] = useState<DataResponse | null>(null);
  const [dataProblem, setDataProblem] = useState<FetchProblem | null>(null);
  const [dataAttempt, setDataAttempt] = useState(0);
  const [prices, setPrices] = useState<Record<ItemId, MarketPrice>>({});
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<FetchProblem | null>(null);

  // links from the home page can preselect a tab or the market filter (page-local, never saved)
  const paramTab = params.get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(paramTab && TAB_KEYS.includes(paramTab) ? paramTab : "all");
  const [method, setMethod] = useState<RecipeType | "all">("all");
  const [query, setQuery] = useState("");
  // remembered per browser
  const [hideIncomplete, setHideIncomplete] = usePersistentState<boolean>("recipes.hideIncomplete", true, isBoolean);
  const [hideSoldOut, setHideSoldOut] = usePersistentState<boolean>("recipes.hideSoldOut", false, isBoolean);
  const [marketFilter, setMarketFilter] = useState<MarketFilter>(params.get("market") === "soldout" ? "soldout" : "all");
  const [sortKey, setSortKey] = usePersistentState<SortKey>("recipes.sort", "profitPerUnit", oneOf(["profitPerHour", "profitPerUnit", "profitPerCraft", "roi", "unitCost"] as const));
  const [focus, setFocus] = useState<Focus | null>(null);
  const filterKey = JSON.stringify([tab, method, query, hideIncomplete, hideSoldOut, marketFilter, sortKey, focus]);
  const [limitState, setLimitState] = useState({ key: filterKey, limit: PAGE });
  const limit = limitState.key === filterKey ? limitState.limit : PAGE;
  const showMore = () => setLimitState({ key: filterKey, limit: limit + PAGE });
  const [expanded, setExpanded] = useState<number | null>(null);
  // which recipe's detail is shown inside the expanded row (a row can switch to one of its alternatives)
  const [detailId, setDetailId] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // phones: the second toolbar row (method, sort, market, the two hide boxes) folds away
  const [filtersOpen, setFiltersOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);
  /** ตัวกรอง: the panel scrolls with the list (only row 1 sticks), so opening it, or pressing again
   *  once it has scrolled away, brings it back under the bar; pressing while it shows closes it */
  const toggleFilters = () => {
    if (filtersOpen && !hiddenUnder(filtersRef.current, barRef.current)) {
      setFiltersOpen(false);
      return;
    }
    setFiltersOpen(true);
    requestAnimationFrame(() => revealUnder(filtersRef.current, barRef.current));
  };

  // A deep link is applied once, and again whenever the address changes (quick search can link here
  // while this page is open). ?open= waits for the recipe data to find the product. This sets state
  // during render, guarded by the last link seen, as React documents for "information from previous
  // renders": no effect, and no extra render with the link not yet applied.
  const openParam = params.get("open");
  const qParam = params.get("q");
  const linkKey = `${openParam ?? ""}\n${qParam ?? ""}`;
  const [linkSeen, setLinkSeen] = useState<string | null>(null);
  if (linkSeen !== linkKey && (data || !openParam)) {
    setLinkSeen(linkKey);
    const recipe = openParam && data ? data.recipes.find((x) => x.id === Number(openParam)) : undefined;
    const product = recipe ? mainProduct(recipe) : undefined;
    if (recipe && product && data) {
      setFocus({ productId: product.id, name: data.items[product.id]?.th ?? recipe.name });
      setExpanded(recipe.id);
      setDetailId(recipe.id);
    } else if (qParam) {
      setQuery(qParam);
      setFocus({ productId: null, name: qParam });
    } else if (focus) {
      // plain /recipes (the nav or the tab bar) while a link's view is on: back to the saved filters.
      // Only the search the link typed in is cleared, never one the member typed.
      if (focus.productId === null && query === focus.name) setQuery("");
      setFocus(null);
    }
  }

  /** Leave a deep link's view (the saved filters apply again) and take the link out of the address. */
  const endFocus = () => {
    setFocus(null);
    const url = new URL(window.location.href);
    if (!url.searchParams.has("open") && !url.searchParams.has("q")) return;
    url.searchParams.delete("open");
    url.searchParams.delete("q");
    // the native history call syncs with useSearchParams without a server round trip
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  };
  /** The chip's ✕: a ?q= view also clears the search it typed in. */
  const closeFocus = () => {
    if (focus?.productId === null) setQuery("");
    endFocus();
  };
  // touching any filter leaves the deep link's view: from then on the list is the member's own
  const leaveFocus = () => {
    if (focus) endFocus();
  };
  const changeTab = (t: Tab) => {
    leaveFocus();
    setTab(t);
  };
  const changeMethod = (m: RecipeType | "all") => {
    leaveFocus();
    setMethod(m);
  };
  const changeQuery = (q: string) => {
    leaveFocus();
    setQuery(q);
  };
  const changeMarket = (m: MarketFilter) => {
    leaveFocus();
    setMarketFilter(m);
  };
  const changeHideIncomplete = (on: boolean) => {
    leaveFocus();
    setHideIncomplete(on);
  };
  const changeHideSoldOut = (on: boolean) => {
    leaveFocus();
    setHideSoldOut(on);
  };
  const resetFilters = () => {
    leaveFocus();
    setTab("all");
    setMethod("all");
    setQuery("");
    setMarketFilter("all");
    setHideIncomplete(true);
    setHideSoldOut(false);
  };
  // filters in the folding row that are not at their defaults (the count on the ตัวกรอง button)
  const panelChanged = [tab === "processing" && method !== "all", marketFilter !== "all", !hideIncomplete, hideSoldOut].filter(Boolean).length;
  const anyChanged = panelChanged > 0 || tab !== "all" || method !== "all" || query.trim() !== "";

  // State is only touched inside promise callbacks so the effect bodies stay pure.
  const fetchPrices = useCallback((force: boolean) => {
    return fetchJson<PricesResponse>(`/api/prices?ids=all${force ? "&force=1" : ""}`)
      .then((json) => {
        setPrices(json.prices);
        setFetchedAt(json.fetchedAt);
        setSource(json.source);
        setProblem(null);
      })
      .catch((e) => setProblem(describeError(e)))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    void fetchPrices(false);
  }, [fetchPrices]);
  useEffect(() => {
    fetchJson<DataResponse>("/api/data", { cache: "no-cache" })
      .then((json) => setData(json))
      .catch((e) => setDataProblem(describeError(e)));
  }, [dataAttempt]);
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
    const list = evaluations.filter(recipeFilter({ tab, method, query, hideIncomplete, hideSoldOut, marketFilter, focus }, items, prices));
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
  }, [evaluations, tab, method, query, hideIncomplete, hideSoldOut, marketFilter, focus, sortKey, items, prices]);
  const rows = rowsAndAlts.rows;
  const alts = rowsAndAlts.alts;
  const evById = useMemo(() => new Map(evaluations.map((ev) => [ev.recipe.id, ev])), [evaluations]);

  // Nothing matches: would unticking ซ่อนที่ข้อมูลไม่ครบ bring recipes back? (run only for an empty list)
  const hiddenIncomplete = useMemo(() => {
    if (rows.length > 0 || focus || !hideIncomplete) return 0;
    return evaluations.filter(recipeFilter({ tab, method, query, hideIncomplete: false, hideSoldOut, marketFilter, focus: null }, items, prices)).length;
  }, [rows.length, focus, hideIncomplete, evaluations, tab, method, query, hideSoldOut, marketFilter, items, prices]);
  // a link's view that finds nothing (e.g. quick search on a material no recipe makes) ignored the
  // saved filters, so it only ends the view: resetting them would overwrite the saved hide boxes
  const emptyAction: EmptyAction | undefined = focus
    ? { label: "กลับไปใช้ตัวกรองที่ตั้งไว้", onClick: closeFocus }
    : hiddenIncomplete > 0
      ? { label: "แสดงสูตรที่ข้อมูลไม่ครบด้วย", onClick: () => changeHideIncomplete(false) }
      : anyChanged
        ? { label: "ล้างตัวกรอง", onClick: resetFilters }
        : undefined;
  const emptyHint = focus
    ? `ไม่มีสูตรที่ชื่อตรงกับ "${focus.name}"`
    : hiddenIncomplete > 0
      ? `ซ่อนอยู่ ${silver(hiddenIncomplete)} สูตรเพราะข้อมูลไม่ครบ`
      : undefined;

  /** What a row or card needs; a row is open when it or one of its other recipes was opened (a link can open either). */
  const rowProps = (ev: RecipeEvaluation): RowProps => {
    const rowAlts = alts.get(ev.recipe.id) ?? [];
    const open = expanded !== null && (expanded === ev.recipe.id || rowAlts.some((a) => a.recipe.id === expanded));
    return {
      ev,
      items,
      prices,
      inventory,
      tools,
      alts: rowAlts,
      detail: (open && detailId !== null ? evById.get(detailId) : undefined) ?? ev,
      onPickDetail: setDetailId,
      open,
      onToggle: () => {
        setDetailId(null);
        setExpanded(open ? null : ev.recipe.id);
      },
    };
  };

  const busy = loading || !data;
  const group: SkillGroup | undefined = !focus && (tab === "alchemy" || tab === "cooking" || tab === "processing") ? tab : undefined;
  const perHourText = !focus && tab === "imperial" ? GLOSSARY.imperialPerHour : perHourTip(settings.craftsPerHour, group);

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
  const csvDisabled = busy || rows.length === 0;

  return (
    <Page user={user}>
      <PageHeader
        title="คำนวณสูตร"
        description="จัดอันดับกำไรสูตร แปรธาตุ / ทำอาหาร / แปรรูป"
        meta={["ตลาดกลาง Asia", `ราคาอัปเดต ${loading ? "กำลังโหลด…" : timeAgo(fetchedAt)}`, source && `แหล่ง ${SOURCE_LABEL[source] ?? source}`]}
        actions={
          <>
            <button type="button" onClick={() => load(true)} disabled={loading} className={btn("secondary")}>
              {loading ? "กำลังโหลด…" : "รีเฟรชราคา"}
            </button>
            {/* phones: in the filter panel instead */}
            <button type="button" onClick={exportCsv} disabled={csvDisabled} className={`${btn("secondary")} max-md:hidden`}>
              ส่งออก CSV
            </button>
            <button type="button" onClick={() => setSettingsOpen(true)} aria-haspopup="dialog" title={SETTINGS_TITLE} className={btn("secondary")}>
              ตั้งค่า
            </button>
          </>
        }
      />
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {problem &&
        (problem.status === 429 ? (
          // รีเฟรชราคา pressed again too soon: the prices on screen stay, it only has to wait
          <Notice tone="info" className="mb-3" onClose={() => setProblem(null)}>
            {problem.message}
          </Notice>
        ) : (
          <Notice tone="bad" className="mb-3" action={problemAction(problem, () => load(true), loading)}>
            โหลดราคาไม่สำเร็จ: {problem.message} · ตัวเลขที่เห็นอาจไม่ครบ
          </Notice>
        ))}
      {dataProblem && (
        <Notice
          tone="bad"
          className="mb-3"
          action={problemAction(dataProblem, () => {
            setDataProblem(null);
            setDataAttempt((a) => a + 1);
          })}
        >
          โหลดฐานข้อมูลสูตรไม่สำเร็จ: {dataProblem.message}
        </Notice>
      )}

      {/* Row 1 (tabs, search) stays at the top of a phone screen while the list scrolls; row 2 folds
          away behind ตัวกรอง on phones and is always shown from md up. Row 2 is outside the sticky
          bar so an open panel scrolls away with the list instead of covering it. */}
      <div
        ref={barRef}
        className={`sticky top-0 z-30 -mx-3 bg-background/95 px-3 py-2 backdrop-blur md:static md:mx-0 md:mb-0 md:bg-transparent md:p-0 md:backdrop-blur-none ${filtersOpen ? "" : "mb-3"}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="สายอาชีพ" options={TABS} value={tab} onChange={changeTab} />
          <div className="flex w-full min-w-0 items-center gap-2 md:w-auto md:min-w-[200px] md:flex-1">
            <SearchInput label="ค้นหาชื่อไอเท็ม" value={query} onChange={changeQuery} placeholder="ค้นหาชื่อไอเท็ม…" className="min-w-0 flex-1" />
            <button
              type="button"
              onClick={toggleFilters}
              aria-expanded={filtersOpen}
              aria-controls="recipe-filters"
              className={`${btnShape()} ${toggleCls(filtersOpen)} shrink-0 md:hidden`}
            >
              ตัวกรอง
              {panelChanged > 0 && (
                <span className="num text-accent">
                  • {panelChanged}
                  <span className="sr-only"> ที่เปลี่ยนไว้</span>
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
      <div ref={filtersRef} id="recipe-filters" className={`${filtersOpen ? "flex" : "hidden"} mb-3 flex-wrap items-center gap-2 md:mt-2 md:flex`}>
        {tab === "processing" && (
          <select aria-label="วิธีแปรรูป" value={method} onChange={(e) => changeMethod(e.target.value as RecipeType | "all")} className={selectCls("md", method !== "all")}>
            <option value="all">วิธีแปรรูป: ทั้งหมด</option>
            {PROCESSING_TYPES.map((t) => (
              <option key={t} value={t}>
                {RECIPE_TYPE_TH[t]}
              </option>
            ))}
          </select>
        )}
        <select aria-label="เรียงตาม" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className={selectCls()}>
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              เรียง: {s.label}
            </option>
          ))}
        </select>
        <select aria-label="สภาพตลาด" value={marketFilter} onChange={(e) => changeMarket(e.target.value as MarketFilter)} className={selectCls("md", marketFilter !== "all")}>
          {MARKET_FILTERS.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
        <label className="flex min-h-10 items-center gap-1.5 text-sm text-muted md:min-h-0">
          <input type="checkbox" checked={hideIncomplete} onChange={(e) => changeHideIncomplete(e.target.checked)} className={checkboxCls} />
          ซ่อนที่ข้อมูลไม่ครบ
        </label>
        <label className="flex min-h-10 items-center gap-1.5 text-sm text-muted md:min-h-0">
          <input type="checkbox" checked={hideSoldOut} onChange={(e) => changeHideSoldOut(e.target.checked)} className={checkboxCls} />
          ซ่อนที่วัตถุดิบหมดตลาด
        </label>
        {anyChanged && (
          <button type="button" onClick={resetFilters} className={btn("ghost", "sm")}>
            ล้างตัวกรอง
          </button>
        )}
        <button type="button" onClick={exportCsv} disabled={csvDisabled} className={`${btn("secondary", "sm")} md:hidden`}>
          ส่งออก CSV
        </button>
      </div>

      {focus && (
        <div className="mb-3 flex">
          <div className="inline-flex max-w-full items-center gap-1 rounded-full border border-accent/40 bg-accent/10 py-0.5 pl-3 pr-0.5 text-sm text-accent">
            <span className="truncate">กำลังดู: {focus.name}</span>
            <button
              type="button"
              onClick={closeFocus}
              aria-label={`เลิกดู ${focus.name} กลับไปใช้ตัวกรองที่ตั้งไว้`}
              title="กลับไปใช้ตัวกรองที่ตั้งไว้"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full leading-none hover:bg-accent/20 md:h-7 md:w-7"
            >
              <span aria-hidden>✕</span>
            </button>
          </div>
        </div>
      )}

      {busy && rows.length === 0 && <SkeletonRows n={8} label={!data ? "กำลังโหลดฐานสูตร…" : "กำลังโหลดราคาตลาด…"} className="mb-3" />}

      {/* phones: one card per recipe */}
      <div className={`space-y-2 md:hidden ${busy && rows.length === 0 ? "hidden" : ""}`}>
        {rows.slice(0, limit).map((ev) => (
          <RecipeCard key={ev.recipe.id} {...rowProps(ev)} />
        ))}
        {/* while loading this list is hidden and the skeleton above shows instead */}
        {rows.length === 0 && <EmptyState title="ไม่พบสูตรที่ตรงเงื่อนไข" hint={emptyHint} action={emptyAction} className={cardCls()} />}
      </div>

      <div className={`overflow-x-auto rounded-lg border border-border bg-panel lg:overflow-visible ${busy && rows.length === 0 ? "hidden" : "hidden md:block"}`}>
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-panel-2 text-xs text-muted lg:sticky lg:top-0 lg:z-10">
            <tr>
              <th className="px-3 py-2 text-left font-medium">สูตร</th>
              <th className="px-2 py-2 text-right font-medium">ต้นทุน/ชิ้น</th>
              <th className="px-2 py-2 text-right font-medium">{!focus && tab === "imperial" ? <WithTip label="ราคาขาย" tip={GLOSSARY.imperial} /> : "ราคาขาย"}</th>
              <th className="px-2 py-2 text-right font-medium">
                <WithTip label="กำไร/ชิ้น" tip={GLOSSARY.profitPerUnit} />
              </th>
              <th className="px-2 py-2 text-right font-medium">
                <WithTip label="ROI" tip={GLOSSARY.roi} />
              </th>
              <th className="px-2 py-2 text-right font-medium">
                <WithTip label="กำไร/รอบ" tip={GLOSSARY.profitPerCraft} />
              </th>
              <th className="px-2 py-2 text-right font-medium">
                <WithTip label="กำไร/ชม." tip={perHourText} />
              </th>
              <th className="px-2 py-2 text-left font-medium">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map((ev) => (
              <Row key={ev.recipe.id} {...rowProps(ev)} />
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <EmptyState title="ไม่พบสูตรที่ตรงเงื่อนไข" hint={emptyHint} action={emptyAction} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length > limit && (
        <div className="mt-3 text-center">
          <button type="button" onClick={showMore} className={btn("secondary")}>
            แสดงเพิ่ม ({rows.length - limit} รายการ)
          </button>
        </div>
      )}
      {!focus && tab === "imperial" && (
        <p className="mt-3 text-xs text-muted">
          กล่องราชวังขายให้ NPC ส่งของราชวังเท่านั้น: &ldquo;ราคาขาย&rdquo; คือเงินที่ได้ต่อกล่อง รวมโบนัส Mastery แปรธาตุ/ทำอาหารแล้ว ไม่หักภาษีตลาด
          · แต่ละกล่องมีโควตารับซื้อจำกัดต่อรอบ และส่งได้จำกัดต่อวันต่อครอบครัว จึงไม่แสดงกำไร/ชม.
        </p>
      )}

      <footer className="mt-6 text-xs text-muted">
        สูตร {silver(recipes.length)} รายการ
        {data ? ` (นำเข้าเมื่อ ${new Date(data.meta.importedAt).toLocaleDateString("th-TH")})` : ""} · ราคาจาก Pearl Abyss / arsha.io / bdolytics · ข้อมูลสูตร bdocodex
      </footer>
    </Page>
  );
}

interface RowProps {
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
}

/** ▸ before a row's name; turns to point down while the row is open. */
function Chevron({ open }: { open: boolean }) {
  return (
    <span aria-hidden className={`w-3 shrink-0 text-center text-xs text-muted transition-transform ${open ? "rotate-90" : ""}`}>
      ▸
    </span>
  );
}

function Row({ ev, items, prices, inventory, tools, alts, detail, onPickDetail, open, onToggle }: RowProps) {
  const item = items[ev.productId];
  const name = item?.th ?? ev.recipe.name;
  const unk = ev.flags.unknownCost;
  const alt = alts.length;
  const detailDomId = `detail-${ev.recipe.id}`;
  // the open row and its detail share a gold bar on the left, so the pair reads as one block (on the
  // cells: a box-shadow on a <tr> itself is not drawn by every browser)
  const bar = open ? "shadow-[inset_3px_0_0_var(--accent)]" : "";
  return (
    <>
      {/* the whole row opens on a click; the name button is the same control for the keyboard */}
      <tr onClick={onToggle} className={`cursor-pointer border-t border-border hover:bg-panel-2/60 ${open ? "bg-panel-2/40" : ""}`}>
        <td className={`px-3 py-1.5 ${bar}`}>
          <div className="flex items-center gap-1">
            <FavoriteStar id={ev.productId} name={name} />
            <button
              type="button"
              aria-expanded={open}
              aria-controls={detailDomId}
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              className="flex min-w-0 flex-1 items-center gap-2 rounded text-left"
            >
              <Chevron open={open} />
              <ItemIcon id={ev.productId} grade={item?.grade} size={30} />
              <span className="block min-w-0">
                <span className="block truncate font-medium">{name}</span>
                <span className="block truncate text-xs text-muted">
                  {RECIPE_TYPE_TH[ev.recipe.type]}
                  {ev.recipe.skill.sort > 0 ? ` · ${ev.recipe.skill.display}` : ""} · ผลผลิต {ev.expectedYield.toFixed(1)}/รอบ
                  {alt > 0 ? ` · มีสูตรอื่นอีก ${alt} แบบ (ดูในรายละเอียด)` : ""}
                </span>
              </span>
            </button>
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
        <tr id={detailDomId} className="border-t border-border bg-background/40">
          <td colSpan={8} className={`px-3 py-3 ${bar}`}>
            <RecipeDetail key={detail.recipe.id} ev={detail} items={items} prices={prices} inventory={inventory} alternatives={[ev, ...alts]} onPick={onPickDetail} tools={tools} />
          </td>
        </tr>
      )}
    </>
  );
}

function RecipeCard({ ev, items, prices, inventory, tools, alts, detail, onPickDetail, open, onToggle }: RowProps) {
  const item = items[ev.productId];
  const name = item?.th ?? ev.recipe.name;
  const unk = ev.flags.unknownCost;
  const alt = alts.length;
  const detailDomId = `detail-card-${ev.recipe.id}`;
  return (
    <div className={`rounded-lg border bg-panel ${open ? "border-accent/60" : "border-border"}`}>
      {/* the star sits beside the toggle, not inside it: a button inside a button is not allowed */}
      <div className="flex items-start">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={detailDomId}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg py-3 pl-2 pr-1 text-left"
        >
          <Chevron open={open} />
          <ItemIcon id={ev.productId} grade={item?.grade} size={40} />
          <span className="block min-w-0 flex-1">
            <span className="block truncate font-medium">{name}</span>
            <span className="line-clamp-2 text-xs text-muted">
              {RECIPE_TYPE_TH[ev.recipe.type]}
              {ev.recipe.skill.sort > 0 ? ` · ${ev.recipe.skill.display}` : ""} · ต้นทุน {unk ? "?" : silverShort(ev.unitCost)} → {ev.saleChannel === "imperial" ? "ส่ง" : "ขาย"}{" "}
              {ev.sellPrice ? silverShort(ev.sellPrice) : "-"}
              {alt > 0 ? ` · +${alt} สูตรอื่น` : ""}
            </span>
            <span className="mt-1 block">
              <Flags ev={ev} stock={prices[ev.productId]?.stock} />
            </span>
          </span>
          <span className="block shrink-0 text-right">
            <span className="block text-base font-semibold">
              <Money value={ev.profitPerUnit} tone="profit" compact unknown={unk} suffix="/ชิ้น" />
            </span>
            <span className={`num block text-xs ${pctCls(ev.roi, 0, unk)}`}>{unk ? "ต้นทุนไม่ครบ" : `ROI ${signedPct(ev.roi)}`}</span>
          </span>
        </button>
        <div className="shrink-0 pr-1 pt-1">
          <FavoriteStar id={ev.productId} name={name} />
        </div>
      </div>
      {open && (
        <div id={detailDomId} className="border-t border-border px-3 py-3">
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
  // a <span>: on phones the chips sit inside the card's toggle button, which only takes inline content
  return (
    <span className="flex flex-wrap gap-1">
      {chips.map((c) => (
        <Badge key={c.text} tone={c.tone}>
          {c.text}
        </Badge>
      ))}
    </span>
  );
}
