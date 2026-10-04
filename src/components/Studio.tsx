"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { isBoolean, usePersistentState } from "@/lib/use-persistent";
import { CostEngine, mainProduct } from "@/lib/engine/cost";
import { IMPERIAL_TYPES, PROCESSING_TYPES, RECIPE_TYPE_TH } from "@/lib/engine/mastery";
import type { Inventory, Item, ItemId, MarketPrice, Overrides, Recipe, RecipeEvaluation, RecipeType, SkillGroup } from "@/lib/engine/types";
import { downloadCsv, toCsv } from "@/lib/csv";
import { describeError, fetchJson, problemAction, type FetchProblem } from "@/lib/fetch-error";
import { signedPct, silver, silverShort } from "@/lib/format";
import { GLOSSARY, perHourTip } from "@/lib/glossary";
import { isRecipeSort, RECIPE_SORT_KEY, type RecipeSort } from "@/lib/home-picks";
import { priceSourceLabel } from "@/lib/market/source-label";
import { hiddenUnder, revealUnder } from "@/lib/scroll";
import { NET, SETTINGS_TITLE } from "@/lib/settings-labels";
import type { TreeTools } from "./CostTree";
import { FavoriteStar } from "./FavoriteStar";
import { ItemIcon } from "./ItemIcon";
import { RecipeDetail } from "./RecipeDetail";
import { SettingsDrawer } from "./SettingsDrawer";
import { TimeAgo } from "./TimeAgo";
import type { SessionUser } from "./auth/UserMenu";
import { useInventory, useSettings } from "./UserDataProvider";
import { Badge, type BadgeTone } from "./ui/Badge";
import { btn, iconBtn } from "./ui/button";
import { Card, cardCls } from "./ui/Card";
import { EmptyState, type EmptyAction } from "./ui/EmptyState";
import { checkboxCls, selectCls } from "./ui/field";
import { filterPanelCls, FilterToggle, FocusChip } from "./ui/FilterControls";
import { Icon, type IconName } from "./ui/Icon";
import { InfoTip } from "./ui/InfoTip";
import { Money, pctCls } from "./ui/Money";
import { Notice } from "./ui/Notice";
import { Page, PageHeader } from "./ui/Page";
import { SearchInput } from "./ui/SearchInput";
import { Segmented } from "./ui/Segmented";
import { SkeletonListPane } from "./ui/Skeleton";

type Tab = "all" | "alchemy" | "cooking" | "processing" | "imperial";
// the saved sort is shared with the home page (lib/home-picks), so its names live there
type SortKey = RecipeSort;
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
/** The number each row leads with is the one the list is sorted by, so the order explains itself. */
const MAIN_LABEL: Record<SortKey, string> = {
  profitPerUnit: "กำไร/ชิ้น",
  roi: "ROI",
  profitPerCraft: "กำไร/รอบ",
  profitPerHour: "กำไร/ชม.",
  unitCost: "ต้นทุน/ชิ้น",
};
const MARKET_FILTERS: { key: MarketFilter; label: string }[] = [
  { key: "all", label: "ทุกสภาพตลาด" },
  { key: "soldout", label: "ขาดตลาด" },
  { key: "instock", label: "มีของค้างขาย" },
];
const PAGE = 100;

/** the side pane that shows the open recipe on wide screens, and its title (focus lands there from the keyboard) */
const PANE_ID = "recipe-pane";
const PANE_TITLE_ID = "recipe-pane-title";
const rowDomId = (recipeId: number) => `recipe-row-${recipeId}`;

/**
 * lg and up (Tailwind's lg, 64rem): the open recipe shows in the side pane instead of under its row.
 * Read from the screen, not CSS alone, so the detail (and its market request) exists once. The
 * server and hydration render the narrow layout; nothing can be open before the recipe data loads.
 */
const WIDE = "(min-width: 64rem)";
function subscribeWide(onChange: () => void) {
  const mq = window.matchMedia(WIDE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
const isWide = () => window.matchMedia(WIDE).matches;
const notWide = () => false;

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

/** `user` null: a visitor who is not signed in. */
export function Studio({ user }: { user: SessionUser | null }) {
  const params = useSearchParams();
  const [settings] = useSettings();
  const inventory = useInventory();
  const wide = useSyncExternalStore(subscribeWide, isWide, notWide);
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
  const [sortKey, setSortKey] = usePersistentState<SortKey>(RECIPE_SORT_KEY, "profitPerUnit", isRecipeSort);
  const [focus, setFocus] = useState<Focus | null>(null);
  const filterKey = JSON.stringify([tab, method, query, hideIncomplete, hideSoldOut, marketFilter, sortKey, focus]);
  const [limitState, setLimitState] = useState({ key: filterKey, limit: PAGE });
  const limit = limitState.key === filterKey ? limitState.limit : PAGE;
  const showMore = () => setLimitState({ key: filterKey, limit: limit + PAGE });
  const [expanded, setExpanded] = useState<number | null>(null);
  // which recipe's detail is shown for the open row (a row can switch to one of its alternatives)
  const [detailId, setDetailId] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // phones: the second toolbar row (method, market, the two hide boxes) folds away
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
  /** The chip's x: a ?q= view also clears the search it typed in. */
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

  /** A row is open when it or one of its other recipes was opened (a link can open either). */
  const isOpen = (ev: RecipeEvaluation) =>
    expanded !== null && (expanded === ev.recipe.id || (alts.get(ev.recipe.id) ?? []).some((a) => a.recipe.id === expanded));
  /** What a row (and, on wide screens, the side pane) needs. */
  const rowProps = (ev: RecipeEvaluation): RowProps => {
    const open = isOpen(ev);
    return {
      ev,
      items,
      prices,
      inventory,
      tools,
      alts: alts.get(ev.recipe.id) ?? [],
      detail: (open && detailId !== null ? evById.get(detailId) : undefined) ?? ev,
      onPickDetail: setDetailId,
      open,
      onToggle: () => {
        setDetailId(null);
        setExpanded(open ? null : ev.recipe.id);
      },
      sortKey,
      wide,
    };
  };

  const busy = loading || !data;
  const group: SkillGroup | undefined = !focus && (tab === "alchemy" || tab === "cooking" || tab === "processing") ? tab : undefined;
  const perHourText = !focus && tab === "imperial" ? GLOSSARY.imperialPerHour : perHourTip(settings.craftsPerHour, group);
  // what the number each row leads with means (ต้นทุน needs no explaining)
  const sortTip: string | undefined =
    sortKey === "profitPerHour" ? perHourText : sortKey === "unitCost" ? undefined : GLOSSARY[sortKey];

  const exportCsv = () => {
    const header = ["สูตร", "ประเภท", "ระดับทักษะ", "ผลผลิต/รอบ", "ต้นทุน/ชิ้น", "ราคาขาย", `${NET}/ชิ้น`, "กำไร/ชิ้น", "ROI %", "กำไร/รอบ", "กำไร/ชม.", "สถานะ"];
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

  const shown = rows.slice(0, limit);
  // the pane shows the open row only while that row is in the list
  const openRow = shown.find(isOpen);
  // the side pane exists only on wide screens, so the open detail is never drawn twice
  const twoPane = wide && rows.length > 0;

  return (
    <Page user={user}>
      <PageHeader
        title="คำนวณสูตร"
        description="จัดอันดับกำไรสูตร แปรธาตุ / ทำอาหาร / แปรรูป"
        meta={[
          "ตลาดกลาง Asia",
          <>ราคาอัปเดต {loading ? "กำลังโหลด…" : <TimeAgo at={fetchedAt} placeholder="-" />}</>,
          source && `แหล่ง ${priceSourceLabel(source)}`,
        ]}
        actions={
          <>
            <button type="button" onClick={() => load(true)} disabled={loading} className={btn("secondary")}>
              <Icon name={loading ? "loader" : "refresh"} className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "กำลังโหลด…" : "รีเฟรชราคา"}
            </button>
            <button type="button" onClick={() => setSettingsOpen(true)} aria-haspopup="dialog" title={SETTINGS_TITLE} className={btn("secondary")}>
              <Icon name="settings" className="h-4 w-4" />
              ตั้งค่า
            </button>
          </>
        }
      />
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {problem && (
        <Notice tone="bad" className="mb-4" action={problemAction(problem, () => load(true), loading)}>
          โหลดราคาไม่สำเร็จ: {problem.message} · ตัวเลขที่เห็นอาจไม่ครบ
        </Notice>
      )}
      {dataProblem && (
        <Notice
          tone="bad"
          className="mb-4"
          action={problemAction(dataProblem, () => {
            setDataProblem(null);
            setDataAttempt((a) => a + 1);
          })}
        >
          โหลดฐานข้อมูลสูตรไม่สำเร็จ: {dataProblem.message}
        </Notice>
      )}

      {/* The filters, one toolbar card from md up. On phones the card's own box is dropped
          (display: contents), because a sticky element only sticks inside its parent: row 1 (tabs,
          search) stays at the top of the screen while the list scrolls, and row 2 folds away behind
          ตัวกรอง. Row 2 is outside the sticky bar so an open panel scrolls away with the list
          instead of covering it. */}
      <div className="max-md:contents md:mb-4 md:rounded-xl md:border md:border-border md:bg-panel md:p-3 md:shadow-card">
        <div
          ref={barRef}
          className={`sticky top-(--header-h) z-30 -mx-4 bg-background/95 px-4 py-2 backdrop-blur md:static md:mx-0 md:bg-transparent md:p-0 md:backdrop-blur-none ${filtersOpen ? "" : "mb-3 md:mb-0"}`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Segmented label="สายอาชีพ" options={TABS} value={tab} onChange={changeTab} />
            <div className="flex w-full min-w-0 items-center gap-2 md:w-auto md:min-w-[200px] md:flex-1">
              <SearchInput label="ค้นหาชื่อไอเท็ม" value={query} onChange={changeQuery} placeholder="ค้นหาชื่อไอเท็ม…" className="min-w-0 flex-1" />
              <FilterToggle open={filtersOpen} count={panelChanged} controls="recipe-filters" onClick={toggleFilters} />
            </div>
          </div>
        </div>
        <div ref={filtersRef} id="recipe-filters" className={`mb-3 md:mb-0 ${filterPanelCls(filtersOpen)}`}>
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
          <select aria-label="สภาพตลาด" value={marketFilter} onChange={(e) => changeMarket(e.target.value as MarketFilter)} className={selectCls("md", marketFilter !== "all")}>
            {MARKET_FILTERS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
          <label className="flex min-h-10 items-center gap-2 text-sm text-muted md:min-h-0">
            <input type="checkbox" checked={hideIncomplete} onChange={(e) => changeHideIncomplete(e.target.checked)} className={checkboxCls} />
            ซ่อนที่ข้อมูลไม่ครบ
          </label>
          <label className="flex min-h-10 items-center gap-2 text-sm text-muted md:min-h-0">
            <input type="checkbox" checked={hideSoldOut} onChange={(e) => changeHideSoldOut(e.target.checked)} className={checkboxCls} />
            ซ่อนที่วัตถุดิบหมดตลาด
          </label>
          {anyChanged && (
            <button type="button" onClick={resetFilters} className={btn("ghost", "sm")}>
              <Icon name="x" className="h-4 w-4" />
              ล้างตัวกรอง
            </button>
          )}
        </div>
      </div>

      {focus && <FocusChip name={focus.name} onClose={closeFocus} className="mb-4" />}

      {busy && rows.length === 0 ? (
        <SkeletonListPane n={8} label={!data ? "กำลังโหลดฐานสูตร…" : "กำลังโหลดราคาตลาด…"} />
      ) : (
        // lg and up: the ranking on the left, the open recipe in a pane on the right that stays in
        // view while the list scrolls. Narrower: one column, the detail opens under its row.
        <div
          className={
            twoPane
              ? "lg:grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-6 xl:grid-cols-[minmax(0,30rem)_minmax(0,1fr)]"
              : undefined
          }
        >
          {/* @container: a row shows more of its numbers the wider the list is (see Facts), most of
              them in a tablet's one-column list */}
          <Card className="@container overflow-clip" aria-labelledby="recipe-list-title">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <h2 id="recipe-list-title" className="font-display text-title font-semibold text-balance text-foreground">
                  อันดับสูตร
                </h2>
                <p className="text-xs text-muted">
                  {silver(rows.length)} สูตร
                  {rows.length > limit ? ` · แสดง ${silver(limit)} อันดับแรก` : ""}
                </p>
              </div>
              {/* gap-2: on a touch screen the InfoTip's hit area reaches 8px past its icon */}
              <div className="flex items-center gap-2">
                <select aria-label="เรียงตาม" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className={selectCls()}>
                  {SORTS.map((s) => (
                    <option key={s.key} value={s.key}>
                      เรียง: {s.label}
                    </option>
                  ))}
                </select>
                {sortTip && <InfoTip label={MAIN_LABEL[sortKey]}>{sortTip}</InfoTip>}
                <button type="button" onClick={exportCsv} disabled={csvDisabled} title="ส่งออก CSV" className={btn("ghost")}>
                  <Icon name="download" className="h-4 w-4" />
                  <span className="sr-only">ส่งออก </span>CSV
                </button>
              </div>
            </div>

            {rows.length === 0 ? (
              <EmptyState icon="search" title="ไม่พบสูตรที่ตรงเงื่อนไข" hint={emptyHint} action={emptyAction} />
            ) : (
              <ul className="divide-y divide-border">
                {shown.map((ev) => (
                  <RecipeRow key={ev.recipe.id} {...rowProps(ev)} />
                ))}
              </ul>
            )}
            {rows.length > limit && (
              <div className="border-t border-border p-3 text-center">
                <button type="button" onClick={showMore} className={btn("secondary")}>
                  แสดงเพิ่ม ({rows.length - limit} รายการ)
                </button>
              </div>
            )}
          </Card>

          {twoPane && (
            <aside id={PANE_ID} aria-label="รายละเอียดสูตร" className="hidden lg:sticky lg:top-[calc(var(--header-h)_+_1rem)] lg:block">
              {/* keyed by the open row, so a newly opened recipe starts at the top of the pane */}
              <RecipePane key={openRow?.recipe.id ?? 0} row={openRow ? rowProps(openRow) : null} />
            </aside>
          )}
        </div>
      )}

      {!focus && tab === "imperial" && (
        <p className="mt-4 flex gap-2 text-xs text-muted">
          <Icon name="info" className="mt-px h-4 w-4 text-info" />
          <span>
            กล่องราชวังขายให้ NPC ส่งของราชวังเท่านั้น: &ldquo;ราคาขาย&rdquo; คือเงินที่ได้ต่อกล่อง รวมโบนัส Mastery แปรธาตุ/ทำอาหารแล้ว ไม่หักภาษีตลาด
            · แต่ละกล่องมีโควตารับซื้อจำกัดต่อรอบ และส่งได้จำกัดต่อวันต่อครอบครัว จึงไม่แสดงกำไร/ชม.
          </span>
        </p>
      )}

      <footer className="mt-6 text-xs text-faint">
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
  /** the list's order: the row leads with that number */
  sortKey: SortKey;
  /** lg and up: the detail shows in the side pane, not under the row */
  wide: boolean;
}

/** "type · skill · yield" under a recipe's name. */
function recipeMeta(ev: RecipeEvaluation): string {
  return `${RECIPE_TYPE_TH[ev.recipe.type]}${ev.recipe.skill.sort > 0 ? ` · ${ev.recipe.skill.display}` : ""} · ผลผลิต ${ev.expectedYield.toFixed(1)}/รอบ`;
}

/**
 * One recipe in the ranking: the name and the number it is ranked by on the first line, then its
 * type, its other numbers and its status pills. Pressing it opens the detail: under the row on
 * narrow screens, in the side pane from lg up.
 */
function RecipeRow({ ev, items, prices, inventory, tools, alts, detail, onPickDetail, open, onToggle, sortKey, wide }: RowProps) {
  const item = items[ev.productId];
  const name = item?.th ?? ev.recipe.name;
  const alt = alts.length;
  const detailDomId = `detail-${ev.recipe.id}`;
  return (
    // the open row carries a gold bar down its left edge, past the detail under it as well, so the
    // pair reads as one block
    <li className={open ? "relative before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-accent" : undefined}>
      {/* the star sits beside the toggle, not inside it: a button inside a button is not allowed */}
      <div className={`flex items-start transition-colors duration-150 ${open ? "bg-accent/6" : "hover:bg-panel-2/60"}`}>
        <button
          id={rowDomId(ev.recipe.id)}
          type="button"
          onClick={(e) => {
            onToggle();
            // opened from the keyboard on a wide screen: the pane comes after the whole list in the
            // reading order, so take focus there (a mouse click leaves focus where it is)
            if (wide && !open && e.detail === 0) requestAnimationFrame(() => document.getElementById(PANE_TITLE_ID)?.focus({ preventScroll: true }));
          }}
          aria-expanded={open}
          aria-controls={wide ? PANE_ID : detailDomId}
          className="flex min-w-0 flex-1 items-start gap-3 py-3 pl-4 pr-1 text-left text-sm focus-visible:-outline-offset-2"
        >
          <ItemIcon id={ev.productId} grade={item?.grade} size={36} />
          <span className="block min-w-0 flex-1">
            <span className="flex min-w-0 items-baseline gap-3">
              <span className="min-w-0 flex-1 truncate font-medium text-foreground">{name}</span>
              <span className="shrink-0 text-base font-semibold text-foreground">
                <MainNumber ev={ev} sortKey={sortKey} />
              </span>
            </span>
            <span className="mt-0.5 flex min-w-0 items-start gap-3 text-xs">
              <span className="line-clamp-2 min-w-0 flex-1 text-muted">
                {recipeMeta(ev)}
                {alt > 0 ? ` · +${alt} สูตรอื่น` : ""}
              </span>
              <span className="shrink-0 text-muted">{MAIN_LABEL[sortKey]}</span>
            </span>
            <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
              <Facts ev={ev} sortKey={sortKey} />
              <Flags ev={ev} stock={prices[ev.productId]?.stock} />
            </span>
          </span>
          <Icon
            name={wide ? "chevron-right" : "chevron-down"}
            className={`mt-2.5 h-4 w-4 text-faint transition-transform duration-150 ${open && !wide ? "rotate-180" : ""}`}
          />
        </button>
        <div className="shrink-0 py-1.5 pr-1.5">
          <FavoriteStar id={ev.productId} name={name} />
        </div>
      </div>
      {open && !wide && (
        <div id={detailDomId} className="border-t border-border bg-background/40 px-4 py-4">
          <RecipeDetail key={detail.recipe.id} ev={detail} items={items} prices={prices} inventory={inventory} alternatives={[ev, ...alts]} onPick={onPickDetail} tools={tools} />
        </div>
      )}
    </li>
  );
}

/** The number a row leads with: the one the list is sorted by (short silver, as on a card). */
function MainNumber({ ev, sortKey }: { ev: RecipeEvaluation; sortKey: SortKey }) {
  const unk = ev.flags.unknownCost;
  if (sortKey === "roi") return <span className={`num whitespace-nowrap ${pctCls(ev.roi, 0, unk)}`}>{unk ? "?" : signedPct(ev.roi)}</span>;
  if (sortKey === "unitCost") {
    return unk ? <span className="num whitespace-nowrap text-muted">? ({silverShort(ev.unitCost)}+)</span> : <Money value={ev.unitCost} compact />;
  }
  // imperial boxes have a daily quota, so they have no per-hour figure
  if (sortKey === "profitPerHour" && ev.saleChannel === "imperial" && !unk) return <span className="text-muted">-</span>;
  return <Money value={ev[sortKey]} tone="profit" compact unknown={unk} />;
}

/** One small "label number" pair on a row's second line. */
function Fact({ label, className = "inline-flex", children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <span className={`items-baseline gap-1 whitespace-nowrap ${className}`}>
      {label}
      <span className="num font-medium text-foreground">{children}</span>
    </span>
  );
}

/** A row's other numbers: what it costs, what it sells for, then the profit figures it does not lead with. */
function Facts({ ev, sortKey }: { ev: RecipeEvaluation; sortKey: SortKey }) {
  const unk = ev.flags.unknownCost;
  const imperial = ev.saleChannel === "imperial";
  return (
    <>
      {sortKey !== "unitCost" && <Fact label="ต้นทุน">{unk ? `? (${silverShort(ev.unitCost)}+)` : silverShort(ev.unitCost)}</Fact>}
      <Fact label={imperial ? "ส่ง" : "ขาย"}>{ev.sellPrice ? silverShort(ev.sellPrice) : "-"}</Fact>
      {sortKey !== "profitPerUnit" && (
        <Fact label="กำไร/ชิ้น">
          <Money value={ev.profitPerUnit} tone="profit" compact unknown={unk} />
        </Fact>
      )}
      {sortKey !== "roi" && (
        <Fact label="ROI">
          <span className={pctCls(ev.roi, 0, unk)}>{unk ? "?" : signedPct(ev.roi)}</span>
        </Fact>
      )}
      {/* only where the list is wide enough: on a phone each one would add a line to every row.
          กำไร/ชม. from a 24rem list (the lg side column and wider); กำไร/รอบ only in a 42rem list
          (the one-column list of a tablet), never beside the pane, which shows it in its detail */}
      {sortKey !== "profitPerHour" && !imperial && (
        <Fact label="กำไร/ชม." className="hidden @sm:inline-flex">
          <Money value={ev.profitPerHour} tone="profit" compact unknown={unk} />
        </Fact>
      )}
      {sortKey !== "profitPerCraft" && (
        <Fact label="กำไร/รอบ" className="hidden @2xl:inline-flex">
          <Money value={ev.profitPerCraft} tone="profit" compact unknown={unk} />
        </Fact>
      )}
    </>
  );
}

/**
 * The side pane (lg and up): the open recipe's name, its star and a close button over its detail.
 * It scrolls by itself, so the list beside it keeps its place. With nothing open it invites a pick.
 */
function RecipePane({ row }: { row: RowProps | null }) {
  if (!row) {
    return (
      <EmptyState
        icon="book"
        title="เลือกสูตรเพื่อดูว่าคุ้มไหม"
        hint="กดสูตรในรายการ จะเห็นกำไร ต้นทุน วัตถุดิบทุกชั้น แผนผลิต และราคาตลาดตรงนี้"
        className={cardCls()}
      />
    );
  }
  const { ev, items, prices, inventory, tools, alts, detail, onPickDetail, onToggle } = row;
  const item = items[ev.productId];
  const name = item?.th ?? ev.recipe.name;
  const close = () => {
    onToggle();
    // back to the row it came from, so the keyboard does not start over at the top of the page
    document.getElementById(rowDomId(ev.recipe.id))?.focus({ preventScroll: true });
  };
  return (
    <div className={`${cardCls()} max-h-[calc(100dvh_-_var(--header-h)_-_2rem)] overflow-y-auto overscroll-contain`}>
      <header className="sticky top-0 z-10 flex items-start gap-3 border-b border-border bg-panel px-4 py-3">
        <ItemIcon id={ev.productId} grade={item?.grade} size={40} />
        <div className="min-w-0 flex-1">
          <h2 id={PANE_TITLE_ID} tabIndex={-1} className="font-display text-title font-semibold text-balance text-foreground">
            {name}
          </h2>
          <p className="mt-0.5 text-xs text-muted">{recipeMeta(detail)}</p>
        </div>
        <FavoriteStar id={ev.productId} name={name} />
        <button type="button" onClick={close} aria-label="ปิดรายละเอียด" title="ปิด" className={iconBtn("ghost", "sm")}>
          <Icon name="x" className="h-4 w-4" />
        </button>
      </header>
      <div className="p-4">
        <RecipeDetail key={detail.recipe.id} ev={detail} items={items} prices={prices} inventory={inventory} alternatives={[ev, ...alts]} onPick={onPickDetail} tools={tools} />
      </div>
    </div>
  );
}

function Flags({ ev, stock }: { ev: RecipeEvaluation; stock?: number }) {
  const f = ev.flags;
  // the word carries the meaning; the icon only helps the eye find the ones that need a look
  const chips: { text: string; tone: BadgeTone; icon?: IconName }[] = [];
  if (ev.saleChannel === "imperial") chips.push({ text: "ส่งราชวัง ไม่หักภาษี", tone: "accent", icon: "crown" });
  else if (f.productNotMarketable) chips.push({ text: "ขายตลาดไม่ได้", tone: "neutral" });
  else if (f.productNoPrice) chips.push({ text: "ไม่มีราคาขาย", tone: "neutral" });
  if (f.unknownCost) chips.push({ text: "ต้นทุนไม่ครบ", tone: "bad", icon: "alert-circle" });
  if (f.materialSoldOut) chips.push({ text: "วัตถุดิบหมด", tone: "warn", icon: "alert-triangle" });
  if (f.aboveSkill) chips.push({ text: "เกินระดับ", tone: "warn", icon: "lock" });
  if (ev.saleChannel === "market" && !f.productNotMarketable && !f.productNoPrice && stock !== undefined) {
    if (stock > 0) chips.push({ text: `ค้างขาย ${silverShort(stock)}`, tone: "neutral" });
    else chips.push({ text: "ขาดตลาด", tone: "good", icon: "trending-up" });
  }
  if (chips.length === 0) chips.push({ text: "พร้อม", tone: "good", icon: "check" });
  // a <span>: the chips sit inside the row's toggle button, which only takes inline content
  return (
    <span className="flex flex-wrap gap-1">
      {chips.map((c) => (
        <Badge key={c.text} tone={c.tone} icon={c.icon}>
          {c.text}
        </Badge>
      ))}
    </span>
  );
}
