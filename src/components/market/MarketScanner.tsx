"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { isBoolean, isNumber, oneOf, usePersistentState } from "@/lib/use-persistent";
import { netRate } from "@/lib/engine/cost";
import { describeError, httpError, problemAction, type FetchProblem } from "@/lib/fetch-error";
import { pct, readsAsZero, signedPct, silver, silverShort } from "@/lib/format";
import { mainCategoryLabel, subCategoryLabel } from "@/lib/market/categories";
import { assessRecovery, sellEvidence, type Assessment, type EvidenceLine } from "@/lib/market/evidence";
import { SIGNAL_KEYS, SIGNAL_NAME, type SignalKey } from "@/lib/market/signals";
import type { ScanRow } from "@/lib/market/snapshot";
import { hiddenUnder, revealUnder, scrollBehavior } from "@/lib/scroll";
import type { SessionUser } from "../auth/UserMenu";
import { FavoriteStar } from "../FavoriteStar";
import { ItemIcon } from "../ItemIcon";
import { PerfBeacon } from "../PerfBeacon";
import { TimeAgo } from "../TimeAgo";
import { useSettings } from "../UserDataProvider";
import { Badge, type BadgeTone } from "../ui/Badge";
import { btn, btnShape, toggleCls } from "../ui/button";
import { Card, CardHeader, cardCls, SectionLabel } from "../ui/Card";
import { EmptyState, type EmptyAction } from "../ui/EmptyState";
import { WithTip } from "../ui/InfoTip";
import { checkboxCls, selectCls } from "../ui/field";
import { Money } from "../ui/Money";
import { Notice } from "../ui/Notice";
import { Page, PageHeader } from "../ui/Page";
import { SearchInput } from "../ui/SearchInput";
import { Segmented } from "../ui/Segmented";
import { Stat } from "../ui/Stat";
import { toast } from "../ui/Toast";
import { MarketPanel } from "./MarketPanel";

type SortKey = "roi" | "cheap" | "expensive" | "vol" | "price" | "trades";
type Mode = "all" | SignalKey;
type Signal = SignalKey | null;

/**
 * One name per signal (lib/market/signals, shared with the help page), used by the mode buttons,
 * the pick cards and the row badges. The colour follows the meaning map in ui/Badge.tsx.
 */
const SIGNAL: Record<SignalKey, { name: string; short: string; tone: BadgeTone }> = {
  trade: { ...SIGNAL_NAME.trade, tone: "good" },
  buy: { ...SIGNAL_NAME.buy, tone: "info" },
  sell: { ...SIGNAL_NAME.sell, tone: "accent" },
};

const MODES: { value: Mode; label: string; hint: string }[] = [
  { value: "all", label: "ทั้งหมด", hint: "ทุกไอเท็มในตลาด" },
  { value: "trade", label: SIGNAL.trade.name, hint: "ซื้อตอนนี้ แล้วตั้งขายที่ราคาปกติ ยังได้กำไรหลังหักภาษี" },
  { value: "buy", label: SIGNAL.buy.name, hint: "ราคาต่ำกว่าปกติ และหลักฐานชี้ว่ามีโอกาสฟื้น (ดูรายละเอียดในแต่ละแถว)" },
  { value: "sell", label: SIGNAL.sell.name, hint: "ราคาตอนนี้สูงกว่าปกติ ถ้ามีของอยู่ควรปล่อยตอนนี้" },
];
const PICK_TABS = SIGNAL_KEYS.map((k) => ({ value: k, label: SIGNAL[k].short }));
const PICK_HINT: Record<SignalKey, string> = {
  trade: "ซื้อตอนนี้ แล้วตั้งขายที่ราคาปกติ (เฉลี่ย 90 วัน) หักภาษีแล้วยังบวก",
  buy: "ราคาต่ำกว่าปกติ 10% ขึ้นไป และหลักฐาน (ค้างขายลด ขายเร็ว เริ่มเงย) ชี้ว่าน่าจะกลับขึ้น",
  sell: "ราคาสูงกว่าปกติ 15% ขึ้นไป ถ้ามีของอยู่ในคลังควรปล่อย",
};
const PICK_EMPTY: Record<SignalKey, string> = {
  trade: "ตอนนี้ยังไม่มีของที่ซื้อแล้วขายราคาปกติได้กำไร",
  buy: "ไม่มีของที่ราคาต่ำและหลักฐานพอตอนนี้",
  sell: "ไม่มีของที่แพงผิดปกติตอนนี้",
};
// full literal strings: Tailwind cannot see class names built at runtime
const PICK_METRIC_CLS: Record<SignalKey, string> = { trade: "text-good", buy: "text-info", sell: "text-accent" };

const SORTS: { key: SortKey; label: string }[] = [
  { key: "roi", label: "กำไรเทรด (ROI)" },
  { key: "cheap", label: "ถูกกว่าปกติมากที่สุด" },
  { key: "expensive", label: "แพงกว่าปกติมากที่สุด" },
  { key: "vol", label: "ซื้อขาย 14 วันมากที่สุด" },
  { key: "trades", label: "ซื้อขายสะสมมากที่สุด" },
  { key: "price", label: "ราคาสูงสุด" },
];
const VOL_OPTIONS = [
  { v: 0, label: "ซื้อขาย: ทั้งหมด" },
  { v: 50, label: "ซื้อขาย ≥ 50" },
  { v: 200, label: "ซื้อขาย ≥ 200" },
  { v: 1000, label: "ซื้อขาย ≥ 1,000" },
  { v: 10000, label: "ซื้อขาย ≥ 10,000" },
];
const PAGE = 100;
const LIQUID_MIN_VOL = 50;
/** a price within 5% of normal is shown grey: too close to call cheap or expensive */
const NEAR_NORMAL = 0.05;

/** the saved filters that "ล้างตัวกรอง" goes back to */
const DEFAULTS = { mode: "all" as Mode, cat: "all", minVol: 50, needStock: true };

interface Computed {
  row: ScanRow;
  net: number | null;
  profit: number | null;
  roi: number | null;
  dev: number | null;
  trend7: number | null;
  signal: Signal;
  assess: Assessment;
}

interface Filters {
  mode: Mode;
  cat: string;
  minVol: number;
  needStock: boolean;
  /** trimmed, lower case */
  q: string;
}

/**
 * A temporary view of one item (a pick, or a ?q= link from home or quick search). While it is set
 * the list ignores the saved filters; it never changes them.
 */
interface Focus {
  /** the one item to open and scroll to, or null when several are shown */
  id: number | null;
  /** every item to show */
  ids: number[];
  name: string;
}

// colours follow the one meaning map in ui/Badge.tsx
const LEVEL_TONE: Record<Assessment["level"], BadgeTone> = {
  สูง: "good",
  ปานกลาง: "warn",
  ต่ำ: "bad",
  ไม่พอข้อมูล: "neutral",
};

const nameMatches = (r: ScanRow, q: string) => `${r.th} ${r.en ?? ""}`.toLowerCase().includes(q);

function matches(c: Computed, f: Filters): boolean {
  const r = c.row;
  if (f.mode !== "all" && c.signal !== f.mode) return false;
  if (f.cat !== "all" && r.cat !== f.cat) return false;
  if (f.minVol > 0 && (r.vol14 ?? 0) < f.minVol) return false;
  if (f.needStock && f.mode !== "sell" && r.stock <= 0) return false;
  if (f.q && !nameMatches(r, f.q)) return false;
  return true;
}

function sortRows(out: Computed[], mode: Mode, sortKey: SortKey): Computed[] {
  const last = (v: number | null) => (v === null ? Number.NEGATIVE_INFINITY : v);
  const key: SortKey = mode === "buy" && sortKey === "roi" ? "cheap" : mode === "sell" && sortKey === "roi" ? "expensive" : sortKey;
  return out.sort((a, b) => {
    switch (key) {
      case "roi":
        return last(b.roi) - last(a.roi);
      case "cheap":
        return last(b.dev === null ? null : -b.dev) - last(a.dev === null ? null : -a.dev);
      case "expensive":
        return last(b.dev) - last(a.dev);
      case "vol":
        return (b.row.vol14 ?? 0) - (a.row.vol14 ?? 0);
      case "trades":
        return b.row.trades - a.row.trades;
      case "price":
        return b.row.price - a.row.price;
    }
  });
}

/** ?q= is an item name: show that item (or every match) without touching the saved filters */
function focusFromQuery(q: string, rows: ScanRow[]): Focus | null {
  const name = q.trim();
  if (!name) return null;
  const lc = name.toLowerCase();
  // Thai names repeat (items.json has a few dozen shared names): an exact name shared by several
  // items shows all of them, never just the first one found
  const exact = rows.filter((r) => r.th.toLowerCase() === lc || (r.en ?? "").toLowerCase() === lc);
  const hits = exact.length > 0 ? exact : rows.filter((r) => nameMatches(r, lc));
  return { id: hits.length === 1 ? hits[0].id : null, ids: hits.map((r) => r.id), name };
}

/** drop ?q= from the address bar so a reload does not bring a closed view back */
function dropUrlQuery() {
  if (new URLSearchParams(window.location.search).has("q")) window.history.replaceState(null, "", window.location.pathname);
}

function signalBadge(c: Computed): { text: string; tone: BadgeTone } | null {
  if (!c.signal) return null;
  const s = SIGNAL[c.signal];
  if (c.signal === "trade") return { text: `${s.name} ${signedPct(c.roi ?? 0)}`, tone: s.tone };
  if (c.signal === "buy") return { text: `${s.name} · โอกาสฟื้น ${c.assess.level}`, tone: s.tone };
  return { text: s.name, tone: s.tone };
}

/** the trade calculator, filled in with this row's numbers: buy now, sell at the 90-day average */
function calcHref(r: ScanRow): string {
  const p = new URLSearchParams({ item: String(r.id), name: r.th, price: String(r.price), buy: String(r.price) });
  if (r.avg90 !== null) p.set("sell", String(Math.round(r.avg90)));
  return `/calc?${p.toString()}`;
}

export function MarketScanner({
  rows,
  refreshedAt,
  source,
  refreshError,
  user,
  totalItems,
}: {
  rows: ScanRow[];
  /** every priced item in the snapshot, including the ones with no trades that are not sent */
  totalItems: number;
  refreshedAt: string | null;
  source: string | null;
  refreshError: string | null;
  user: SessionUser;
}) {
  const router = useRouter();
  const [settings] = useSettings();
  const rate = netRate(settings);

  // remembered per browser so the page opens the way it was left
  const [mode, setMode] = usePersistentState<Mode>("market.mode", "all", oneOf(["all", "trade", "buy", "sell"] as const));
  const [query, setQuery] = useState("");
  const [cat, setCat] = usePersistentState<string>("market.cat", "all", (v): v is string => typeof v === "string");
  const [minVol, setMinVol] = usePersistentState<number>("market.minVol", 50, isNumber);
  const [needStock, setNeedStock] = usePersistentState<boolean>("market.needStock", true, isBoolean);
  const [sortKey, setSortKey] = usePersistentState<SortKey>("market.sort", "roi", oneOf(["roi", "cheap", "expensive", "vol", "price", "trades"] as const));
  // the address bar, kept in sync by the router (also after dropUrlQuery's replaceState). The first
  // view is read from it, not from a server prop: on browser Back the cached page could still carry
  // a ?q= that this page already dropped from the address
  const urlQuery = useSearchParams().get("q") ?? "";
  // page-local: arriving with ?q= (or tapping a pick) shows one item and leaves the saved filters alone
  const [focus, setFocus] = useState<Focus | null>(() => focusFromQuery(urlQuery, rows));
  const [expanded, setExpanded] = useState<number | null>(() => focus?.id ?? null);
  const [seenQuery, setSeenQuery] = useState(urlQuery);
  if (seenQuery !== urlQuery) {
    setSeenQuery(urlQuery);
    // a new ?q= while already on this page (quick search) opens the same temporary view;
    // ?q= going away (dropped by this page) changes nothing
    if (urlQuery) {
      const f = focusFromQuery(urlQuery, rows);
      setFocus(f);
      if (f?.id != null) setExpanded(f.id);
    }
  }
  const [filtersOpen, setFiltersOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);
  /** ตัวกรอง (phones): the panel scrolls with the list (only row 1 sticks), so opening it, or pressing
   *  again once it has scrolled away, brings it back under the bar; pressing while it shows closes it */
  const toggleFilters = () => {
    if (filtersOpen && !hiddenUnder(filtersRef.current, barRef.current)) {
      setFiltersOpen(false);
      return;
    }
    setFiltersOpen(true);
    requestAnimationFrame(() => revealUnder(filtersRef.current, barRef.current));
  };
  const [pickTab, setPickTab] = useState<SignalKey>("trade");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshProblem, setRefreshProblem] = useState<FetchProblem | null>(null);

  const filters = useMemo<Filters>(() => ({ mode, cat, minVol, needStock, q: query.trim().toLowerCase() }), [mode, cat, minVol, needStock, query]);
  const filterKey = JSON.stringify([filters, sortKey, focus]);
  const [limitState, setLimitState] = useState({ key: filterKey, limit: PAGE });
  const limit = limitState.key === filterKey ? limitState.limit : PAGE;

  // the folded-away filters (phones) that differ from the defaults, for the "ตัวกรอง • n" count
  const filterCount = (cat !== DEFAULTS.cat ? 1 : 0) + (minVol !== DEFAULTS.minVol ? 1 : 0) + (needStock !== DEFAULTS.needStock ? 1 : 0);
  const atDefaults = mode === DEFAULTS.mode && filterCount === 0;

  const categories = useMemo(() => {
    const set = new Map<string, number>();
    for (const r of rows) if (r.cat) set.set(r.cat, (set.get(r.cat) ?? 0) + 1);
    return [...set.entries()].sort((a, b) => b[1] - a[1]).map(([slug, n]) => ({ slug, n }));
  }, [rows]);

  const computed = useMemo<Computed[]>(
    () =>
      rows.map((row) => {
        const net = row.avg90 !== null ? row.avg90 * rate : null;
        const profit = net !== null ? net - row.price : null;
        const roi = profit !== null && row.price > 0 ? profit / row.price : null;
        const dev = row.avg90 ? row.price / row.avg90 - 1 : null;
        const liquid = (row.vol14 ?? 0) >= LIQUID_MIN_VOL;
        const assess = assessRecovery(row);
        let signal: Signal = null;
        if (roi !== null && roi >= 0.05 && row.stock > 0 && liquid) signal = "trade";
        else if (dev !== null && dev <= -0.1 && row.stock > 0 && liquid && assess.score >= 45) signal = "buy";
        else if (dev !== null && dev >= 0.15 && liquid) signal = "sell";
        return { row, net, profit, roi, dev, trend7: row.avg7 ? row.price / row.avg7 - 1 : null, signal, assess };
      }),
    [rows, rate],
  );

  const picks = useMemo(() => {
    const of = (s: SignalKey) => computed.filter((c) => c.signal === s);
    const trade = of("trade").sort((a, b) => (b.roi ?? 0) - (a.roi ?? 0));
    const buy = of("buy").sort((a, b) => b.assess.score - a.assess.score || (a.dev ?? 0) - (b.dev ?? 0));
    const sell = of("sell").sort((a, b) => (b.dev ?? 0) - (a.dev ?? 0));
    return { top: { trade: trade.slice(0, 10), buy: buy.slice(0, 10), sell: sell.slice(0, 10) } as Record<SignalKey, Computed[]> };
  }, [computed]);

  const list = useMemo(() => {
    if (focus) {
      const ids = new Set(focus.ids);
      return sortRows(
        computed.filter((c) => ids.has(c.row.id)),
        "all",
        sortKey,
      );
    }
    return sortRows(
      computed.filter((c) => matches(c, filters)),
      mode,
      sortKey,
    );
  }, [computed, filters, mode, sortKey, focus]);

  // scroll to the item a pick or a ?q= link opened, below the sticky bar, and put keyboard focus on
  // its toggle; a name with several matches scrolls to the list instead
  useEffect(() => {
    if (!focus) return;
    const id = focus.id;
    const raf = requestAnimationFrame(() => {
      if (id === null) {
        document.getElementById("market-list")?.scrollIntoView({ block: "start", behavior: scrollBehavior() });
        return;
      }
      // the phone card and the desktop row are both in the page; only one is shown
      const el = [document.getElementById(`mk-card-${id}`), document.getElementById(`mk-row-${id}`)].find((e) => e !== null && e.getClientRects().length > 0);
      if (!el) return;
      el.scrollIntoView({ block: "start", behavior: scrollBehavior() });
      el.querySelector<HTMLElement>("[data-toggle]")?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [focus]);

  const refresh = async () => {
    setRefreshing(true);
    setRefreshProblem(null);
    try {
      const res = await fetch("/api/market/refresh", { method: "POST" });
      // a 502 (the refresh itself failed) or a 429 (someone refreshed moments ago) is not a success
      if (!res.ok) throw await httpError(res);
      toast({ text: "อัปเดตแล้ว" });
      router.refresh();
    } catch (e) {
      const p = describeError(e);
      // the server counts its 2-minute wait from this failed start too, so an immediate ลองใหม่
      // would only be refused: say when instead, with no button
      setRefreshProblem(p.status !== null && p.status >= 500 ? { ...p, message: "เซิร์ฟเวอร์ไม่ว่าง ลองใหม่ได้ในอีก 2 นาที", action: null } : p);
    } finally {
      setRefreshing(false);
    }
  };

  const endFocus = () => {
    if (!focus) return;
    dropUrlQuery();
    setFocus(null);
  };
  /** The chip and "กลับไปที่รายการ": both buttons disappear with the view, so keyboard focus moves
   *  to the list (without scrolling) instead of falling back to the top of the page. */
  const closeFocus = () => {
    endFocus();
    requestAnimationFrame(() => document.getElementById("market-list")?.focus({ preventScroll: true }));
  };
  // touching any filter means "back to my list": the temporary view ends
  const changeMode = (m: Mode) => {
    endFocus();
    setMode(m);
  };
  const changeQuery = (q: string) => {
    endFocus();
    setQuery(q);
  };
  const changeCat = (v: string) => {
    endFocus();
    setCat(v);
  };
  const changeMinVol = (v: number) => {
    endFocus();
    setMinVol(v);
  };
  const changeNeedStock = (v: boolean) => {
    endFocus();
    setNeedStock(v);
  };
  const resetFilters = () => {
    endFocus();
    setMode(DEFAULTS.mode);
    setCat(DEFAULTS.cat);
    setMinVol(DEFAULTS.minVol);
    setNeedStock(DEFAULTS.needStock);
  };

  const focusOn = (f: Focus | null) => {
    dropUrlQuery();
    setFocus(f);
    if (f?.id != null) setExpanded(f.id);
  };
  const pick = (c: Computed) => focusOn({ id: c.row.id, ids: [c.row.id], name: c.row.th });

  const showAll = (s: SignalKey) => {
    endFocus();
    setMode(s);
    // a typed search would hide most of them; it is page-local, not a saved filter
    setQuery("");
    requestAnimationFrame(() => document.getElementById("market-list")?.scrollIntoView({ block: "start", behavior: scrollBehavior() }));
  };
  // "ดูทั้งหมด (n)": how many that list will really show, with the saved category / volume / stock
  // filters applied (the search box is cleared by showAll)
  const allCounts = useMemo(() => {
    const n: Record<SignalKey, number> = { trade: 0, buy: 0, sell: 0 };
    for (const c of computed) if (c.signal && matches(c, { mode: c.signal, cat, minVol, needStock, q: "" })) n[c.signal]++;
    return n;
  }, [computed, cat, minVol, needStock]);

  // what to say when the list is empty: name what hides the results and offer the one fix
  const emptyView = (): { title: ReactNode; hint?: ReactNode; action?: EmptyAction } | null => {
    if (list.length > 0) return null;
    const back = { label: "กลับไปที่รายการ", onClick: closeFocus };
    if (focus) return { title: `ไม่พบ "${focus.name}" ในตลาด`, hint: "หน้านี้มีเฉพาะไอเท็มที่มีการซื้อขายใน 14 วัน", action: back };
    if (rows.length === 0) return { title: "ยังไม่มีข้อมูลตลาด", hint: "กด อัปเดตตลาดตอนนี้ ด้านบน" };
    const count = (f: Filters) => computed.reduce((n, c) => n + (matches(c, f) ? 1 : 0), 0);
    if (needStock && mode !== "sell") {
      const n = count({ ...filters, needStock: false });
      if (n > 0)
        return {
          title: "ไม่พบไอเท็มที่ตรงเงื่อนไข",
          hint: <>ตัวกรอง &ldquo;เฉพาะที่มีของขายอยู่&rdquo; ซ่อนไว้ {silver(n)} รายการ (ตอนนี้ไม่มีคนตั้งขาย)</>,
          action: { label: "รวมของที่ไม่มีขายอยู่", onClick: () => changeNeedStock(false) },
        };
    }
    if (!atDefaults && count({ ...filters, ...DEFAULTS }) > 0) {
      const names = [
        mode !== "all" && `แสดง "${MODES.find((m) => m.value === mode)?.label}"`,
        cat !== "all" && `หมวด ${mainCategoryLabel(cat)}`,
        minVol > DEFAULTS.minVol && `ซื้อขาย ≥ ${silver(minVol)}`,
      ].filter(Boolean);
      return {
        title: "ไม่พบไอเท็มที่ตรงเงื่อนไข",
        hint: names.length > 0 ? `ถูกซ่อนโดย: ${names.join(" · ")}` : "ตัวกรองที่ตั้งไว้ซ่อนทุกรายการ",
        action: { label: "ล้างตัวกรอง", onClick: resetFilters },
      };
    }
    if (filters.q) {
      const n = computed.reduce((acc, c) => acc + (nameMatches(c.row, filters.q) ? 1 : 0), 0);
      if (n > 0)
        return {
          title: `ไม่พบ "${query.trim()}" ที่ผ่านตัวกรอง`,
          hint: `มี ${silver(n)} รายการที่ชื่อตรง แต่ตัวกรองซ่อนไว้${minVol > 0 ? ` (เช่น ซื้อขาย 14 วันไม่ถึง ${silver(minVol)})` : ""}`,
          action: { label: "ดูโดยไม่ใช้ตัวกรอง", onClick: () => focusOn(focusFromQuery(query, rows)) },
        };
      return {
        title: `ไม่พบ "${query.trim()}"`,
        hint: "หน้านี้มีเฉพาะไอเท็มที่มีการซื้อขายใน 14 วัน ลองพิมพ์สั้นลงหรือใช้ชื่ออังกฤษ",
        action: { label: "ล้างคำค้น", onClick: () => changeQuery("") },
      };
    }
    return { title: "ไม่พบไอเท็มที่ตรงเงื่อนไข", action: atDefaults ? undefined : { label: "ล้างตัวกรอง", onClick: resetFilters } };
  };

  const withHistory = rows.filter((r) => r.avg90 !== null).length;
  const modeInfo = MODES.find((m) => m.value === mode)!;
  const shown = list.slice(0, limit);
  const empty = emptyView();

  return (
    <Page user={user}>
      <PerfBeacon page="market" rows={rows.length} />
      <PageHeader
        title="สแกนตลาด"
        meta={[
          "ตลาดกลาง Asia",
          <>
            อัปเดต <TimeAgo at={refreshedAt} placeholder="-" />
          </>,
          source && `แหล่ง ${source}`,
          `ซื้อขายใน 14 วัน ${silver(rows.length)} จาก ${silver(totalItems)} ไอเท็ม`,
          `มีประวัติแล้ว ${silver(withHistory)} ไอเท็ม`,
        ]}
        actions={
          <button type="button" onClick={refresh} disabled={refreshing} className={btn("secondary")}>
            {refreshing ? "กำลังอัปเดต…" : "อัปเดตตลาดตอนนี้"}
          </button>
        }
      />

      {refreshProblem && (
        <Notice tone="warn" className="mb-3" action={problemAction(refreshProblem, refresh, refreshing)} onClose={() => setRefreshProblem(null)}>
          อัปเดตไม่สำเร็จ ยังใช้ข้อมูลเดิม (อัปเดต <TimeAgo at={refreshedAt} placeholder="-" />) · {refreshProblem.message}
        </Notice>
      )}
      {refreshError && (
        <Notice tone="bad" className="mb-3" action={{ label: "ลองใหม่", onClick: () => router.refresh() }}>
          ดึงข้อมูลตลาดไม่สำเร็จ: {refreshError}
        </Notice>
      )}
      {withHistory < rows.length * 0.5 && rows.length > 0 && (
        <Notice tone="warn" className="mb-3">
          ระบบกำลังทยอยเก็บราคาย้อนหลัง 90 วันของแต่ละไอเท็ม (ทุกครั้งที่เปิดหน้านี้จะได้เพิ่ม) คำแนะนำจะแม่นขึ้นเมื่อครบ ตอนนี้มี {silver(withHistory)} ไอเท็ม
        </Notice>
      )}

      {/* today's picks */}
      <section className="mb-4" aria-labelledby="market-picks">
        <div className="mb-2">
          <h2 id="market-picks" className="text-base font-semibold">
            แนะนำวันนี้
          </h2>
          <p className="text-xs text-muted">
            ดูจากราคา ของค้างขาย และยอดซื้อขายเท่านั้น ระบบ<b>ไม่รู้</b>อีเวนต์ แพตช์ หรือของแจกล่วงหน้า กดแต่ละรายการเพื่อดูหลักฐานแล้วตัดสินใจเอง
          </p>
        </div>
        {/* phones: one card, switch between the three lists */}
        <PickList
          className="md:hidden"
          signal={pickTab}
          items={picks.top[pickTab].slice(0, 5)}
          total={allCounts[pickTab]}
          onPick={pick}
          onAll={showAll}
          switcher={
            <div className="px-4 pt-3">
              <Segmented label="แนะนำวันนี้" size="sm" options={PICK_TABS} value={pickTab} onChange={setPickTab} />
            </div>
          }
        />
        {/* desktop: three columns */}
        <div className="hidden gap-3 md:grid md:grid-cols-3">
          {SIGNAL_KEYS.map((s) => (
            <PickList key={s} signal={s} items={picks.top[s]} total={allCounts[s]} onPick={pick} onAll={showAll} />
          ))}
        </div>
      </section>

      {/* tabIndex -1: closing the "กำลังดู" view moves keyboard focus here (see closeFocus) */}
      <section id="market-list" tabIndex={-1} aria-label="รายการไอเท็ม" className="scroll-mt-2 outline-hidden">
        {/* row 1: what to show and the search box; stays at the top of the screen on phones */}
        <div ref={barRef} className="sticky top-0 z-30 -mx-3 bg-background/95 px-3 py-2 backdrop-blur md:static md:mx-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-w-0 max-w-full items-center gap-2">
              <span aria-hidden className="shrink-0 text-sm text-muted">
                แสดง:
              </span>
              <div className="min-w-0">
                <Segmented label="แสดง" options={MODES} value={mode} onChange={changeMode} />
              </div>
            </div>
            <div className="flex min-w-[200px] flex-1 items-center gap-2">
              <SearchInput label="ค้นหาชื่อไอเท็ม" value={query} onChange={changeQuery} placeholder="ค้นหาชื่อไอเท็ม…" className="min-w-0 flex-1" />
              <button
                type="button"
                aria-expanded={filtersOpen}
                aria-controls="market-filters"
                onClick={toggleFilters}
                className={`${btnShape()} ${toggleCls(filtersOpen)} shrink-0 md:hidden`}
              >
                ตัวกรอง
                {filterCount > 0 && (
                  <span>
                    <span aria-hidden>• </span>
                    {filterCount}
                    <span className="sr-only"> ตัวที่เปลี่ยนไว้</span>
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* row 2: the other filters; folded into "ตัวกรอง" on phones, right under row 1 but outside
            the sticky bar, so an open panel scrolls away with the list instead of covering it */}
        <div
          ref={filtersRef}
          id="market-filters"
          className={
            filtersOpen
              ? "flex flex-wrap items-center gap-2 rounded-lg border border-border bg-panel p-3 md:mt-2 md:rounded-none md:border-0 md:bg-transparent md:p-0"
              : "hidden flex-wrap items-center gap-2 md:mt-2 md:flex"
          }
        >
          <select aria-label="หมวด" value={cat} onChange={(e) => changeCat(e.target.value)} className={`${selectCls("md", cat !== DEFAULTS.cat)} w-full md:w-auto`}>
            <option value="all">หมวด: ทั้งหมด</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {mainCategoryLabel(c.slug)} ({c.n})
              </option>
            ))}
          </select>
          <select
            aria-label="ยอดซื้อขายใน 14 วัน ขั้นต่ำ"
            title="ยอดซื้อขายใน 14 วัน"
            value={minVol}
            onChange={(e) => changeMinVol(Number(e.target.value))}
            className={`${selectCls("md", minVol !== DEFAULTS.minVol)} w-full md:w-auto`}
          >
            {VOL_OPTIONS.map((o) => (
              <option key={o.v} value={o.v}>
                {o.label}
              </option>
            ))}
          </select>
          <select aria-label="เรียงตาม" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className={`${selectCls()} w-full md:w-auto`}>
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                เรียง: {s.label}
              </option>
            ))}
          </select>
          <label className="flex min-h-10 items-center gap-1.5 text-sm text-muted md:min-h-9">
            <input type="checkbox" checked={needStock} onChange={(e) => changeNeedStock(e.target.checked)} className={checkboxCls} />
            เฉพาะที่มีของขายอยู่
          </label>
          {!atDefaults && (
            <button type="button" onClick={resetFilters} className={btn("ghost", "sm")}>
              ล้างตัวกรอง
            </button>
          )}
        </div>

        <div className={`mb-3 space-y-0.5 text-xs text-muted md:mt-2 ${filtersOpen ? "mt-2" : "mt-0.5"}`}>
          <p>{modeInfo.hint}</p>
          <p>
            <span className="text-info">ฟ้า</span> = ถูกกว่าปกติ · <span className="text-accent">ทอง</span> = แพงกว่าปกติ · <span className="text-good">เขียว</span>/
            <span className="text-bad">แดง</span> = กำไร/ขาดทุน
          </p>
        </div>

        {focus && (
          <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            <button type="button" onClick={closeFocus} className={`${btnShape("sm")} ${toggleCls(true)} max-w-full`}>
              <span className="min-w-0 truncate">
                กำลังดู: {focus.name}
                {focus.ids.length > 1 ? ` (${focus.ids.length} รายการ)` : ""}
              </span>
              <span aria-hidden>✕</span>
              <span className="sr-only">(กดเพื่อกลับไปที่รายการ)</span>
            </button>
            <span className="text-xs text-muted">ตัวกรองที่ตั้งไว้ไม่เปลี่ยน</span>
          </div>
        )}

        {/* phones: cards */}
        <div className="space-y-2 md:hidden">
          {shown.map((c) => (
            <MarketCard key={c.row.id} c={c} rate={rate} open={expanded === c.row.id} onToggle={() => setExpanded(expanded === c.row.id ? null : c.row.id)} />
          ))}
          {empty && <EmptyState {...empty} className={cardCls()} />}
        </div>

        {/* desktop: table */}
        <div className="hidden overflow-x-auto rounded-lg border border-border bg-panel md:block lg:overflow-visible">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-panel-2 text-xs text-muted lg:sticky lg:top-0 lg:z-10">
              <tr>
                <th className="px-3 py-2 text-left font-medium">ไอเท็ม</th>
                <th className="px-2 py-2 text-right font-medium">ราคาตอนนี้</th>
                <th className="px-2 py-2 text-right font-medium">
                  <WithTip label="ราคาปกติ (90 วัน)" tip="ราคาเฉลี่ย 90 วันของไอเท็มนั้น" />
                </th>
                <th className="px-2 py-2 text-right font-medium">เทียบปกติ</th>
                <th className="px-2 py-2 text-right font-medium">
                  <WithTip label="กำไรถ้าเทรด" tip={`ขายที่ราคาปกติ × อัตราได้รับจริง ${pct(rate, 1)} − ราคาซื้อตอนนี้`} />
                </th>
                <th className="px-2 py-2 text-right font-medium">ซื้อขาย 14 วัน</th>
                <th className="px-2 py-2 text-left font-medium">คำแนะนำ</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <Row key={c.row.id} c={c} rate={rate} open={expanded === c.row.id} onToggle={() => setExpanded(expanded === c.row.id ? null : c.row.id)} />
              ))}
              {empty && (
                <tr>
                  <td colSpan={7}>
                    <EmptyState {...empty} />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {list.length > limit && (
          <div className="mt-3 text-center">
            <button type="button" onClick={() => setLimitState({ key: filterKey, limit: limit + PAGE })} className={btn("secondary")}>
              แสดงเพิ่ม ({list.length - limit} รายการ)
            </button>
          </div>
        )}
      </section>

      <footer className="mt-6 space-y-1 text-xs text-muted">
        <p>
          <b>ราคาปกติ</b> = ราคาเฉลี่ย 90 วันของไอเท็มนั้น · <b>กำไรถ้าเทรด</b> = ขายที่ราคาปกติ × อัตราได้รับจริง {pct(rate, 1)} − ราคาซื้อตอนนี้ (ราคาต้องขึ้นเกิน{" "}
          {pct(1 / rate - 1)} ถึงคุ้มภาษี)
        </p>
        <p>คำแนะนำนับเฉพาะของที่ซื้อขาย 14 วัน ≥ {LIQUID_MIN_VOL} ชิ้น เพื่อกันของที่ราคาแกว่งเพราะไม่มีคนซื้อขาย · ข้อมูล: bdolytics (snapshot) / Pearl Abyss (ราคาย้อนหลัง)</p>
      </footer>
    </Page>
  );
}

function PickList({
  signal,
  items,
  total,
  onPick,
  onAll,
  switcher,
  className = "",
}: {
  signal: SignalKey;
  items: Computed[];
  /** how many the full list will show (the saved filters still apply), for "ดูทั้งหมด (n)" */
  total: number;
  onPick: (c: Computed) => void;
  onAll: (s: SignalKey) => void;
  /** the phone card's list switcher, above the title */
  switcher?: ReactNode;
  className?: string;
}) {
  const info = SIGNAL[signal];
  return (
    <Card className={className}>
      {switcher}
      <CardHeader
        as="h3"
        title={info.name}
        hint={PICK_HINT[signal]}
        action={
          // shown whenever the signal has items, even when the filters leave 0: that list then says
          // which filter hides them and offers ล้างตัวกรอง
          items.length > 0 ? (
            <button type="button" onClick={() => onAll(signal)} className={btn("ghost", "sm")}>
              ดูทั้งหมด ({silver(total)}) <span aria-hidden>→</span>
            </button>
          ) : undefined
        }
      />
      {items.length === 0 ? (
        <EmptyState title={PICK_EMPTY[signal]} />
      ) : (
        <ul className="divide-y divide-border">
          {items.map((c) => (
            <li key={c.row.id}>
              <button type="button" onClick={() => onPick(c)} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-panel-2/60">
                <ItemIcon id={c.row.id} grade={c.row.grade} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{c.row.th}</span>
                  <span className="line-clamp-2 text-xs text-muted">
                    {silverShort(c.row.price)} · ปกติ {silverShort(c.row.avg90 ?? 0)} · ซื้อขาย {silverShort(c.row.vol14 ?? 0)}/14 วัน
                  </span>
                </span>
                <span className={`num whitespace-nowrap text-xs font-semibold ${PICK_METRIC_CLS[signal]}`}>{pickMetric(signal, c)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function pickMetric(signal: SignalKey, c: Computed): string {
  if (signal === "trade") return signedPct(c.roi ?? 0);
  if (signal === "buy") return `โอกาสฟื้น ${c.assess.level} ${c.assess.score} · ถูกกว่า ${pct(Math.abs(c.dev ?? 0))}`;
  return `แพงกว่า ${pct(c.dev ?? 0)}`;
}

/**
 * Price against the 90-day average, in the signal colours: blue (cheaper, like the buy signal),
 * gold (dearer, like the sell signal), grey within 5%. Green and red are kept for money.
 */
function DevText({ dev, vsNormal = false, className = "" }: { dev: number | null; /** say "ปกติ" too, where no column header does */ vsNormal?: boolean; className?: string }) {
  if (dev === null) return <span className={`num text-muted ${className}`}>-</span>;
  const p = pct(Math.abs(dev));
  if (readsAsZero(p)) return <span className={`whitespace-nowrap text-muted ${className}`}>เท่าปกติ</span>;
  const cheap = dev < 0;
  const tone = Math.abs(dev) < NEAR_NORMAL ? "text-muted" : cheap ? "text-info" : "text-accent";
  return (
    <span className={`num whitespace-nowrap ${tone} ${className}`}>
      {cheap ? "ถูกกว่า" : "แพงกว่า"}
      {vsNormal ? "ปกติ" : ""} {p} <span aria-hidden>{cheap ? "▼" : "▲"}</span>
    </span>
  );
}

/** the 7-day trend: a direction, not good or bad, so it stays grey */
function TrendBadge({ trend }: { trend: number | null }) {
  if (trend === null || Math.abs(trend) < 0.05) return null;
  const up = trend > 0;
  return (
    <Badge tone="neutral" className="gap-1">
      <span>7 วัน</span>
      <span aria-hidden>{up ? "▲" : "▼"}</span>
      <span className="sr-only">{up ? "ขึ้น" : "ลง"}</span>
      <span>{pct(Math.abs(trend))}</span>
    </Badge>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <span aria-hidden className={`inline-block w-3 shrink-0 text-center text-xs text-muted transition-transform motion-reduce:transition-none ${open ? "rotate-90" : ""}`}>
      ▸
    </span>
  );
}

function Row({ c, rate, open, onToggle }: { c: Computed; rate: number; open: boolean; onToggle: () => void }) {
  const r = c.row;
  const sig = signalBadge(c);
  return (
    <>
      {/* the whole row opens on a mouse click; the button in the first cell is the keyboard control */}
      <tr id={`mk-row-${r.id}`} onClick={onToggle} className={`scroll-mt-28 cursor-pointer border-t border-border hover:bg-panel-2/60 ${open ? "bg-panel-2/40" : ""}`}>
        <td className={`px-3 py-1.5 ${open ? "shadow-[inset_3px_0_0_var(--accent)]" : ""}`}>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-toggle
              aria-expanded={open}
              aria-controls={`mk-detail-${r.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              className="flex min-w-0 flex-1 items-center gap-2 rounded text-left"
            >
              <Chevron open={open} />
              <ItemIcon id={r.id} grade={r.grade} size={30} />
              <span className="min-w-0">
                <span className="block truncate font-medium">{r.th}</span>
                <span className="block truncate text-xs text-muted">
                  {mainCategoryLabel(r.cat)}
                  {r.sub ? ` · ${subCategoryLabel(r.sub)}` : ""}
                  {r.days > 0 ? ` · ประวัติ ${r.days} วัน` : " · ยังไม่มีประวัติ"}
                </span>
              </span>
            </button>
            <FavoriteStar id={r.id} name={r.th} />
          </div>
        </td>
        <td className="num px-2 py-1.5 text-right">{silver(r.price)}</td>
        <td className="num px-2 py-1.5 text-right text-muted">{r.avg90 !== null ? silver(r.avg90) : "-"}</td>
        <td className="px-2 py-1.5 text-right">
          <DevText dev={c.dev} />
        </td>
        {/* profit on top, ROI underneath, so the silver digits line up from row to row */}
        <td className="px-2 py-1.5 text-right">
          {c.profit === null ? (
            <span className="num text-muted">-</span>
          ) : (
            <>
              <Money value={c.profit} tone="profit" className="block" />
              <span className="num block text-xs text-muted">ROI {signedPct(c.roi ?? 0)}</span>
            </>
          )}
        </td>
        <td className="num px-2 py-1.5 text-right">{r.vol14 === null ? "-" : silver(r.vol14)}</td>
        <td className="px-2 py-1.5">
          <div className="flex flex-wrap gap-1">
            {sig && <Badge tone={sig.tone}>{sig.text}</Badge>}
            {r.stock > 0 ? <Badge tone="neutral">ค้างขาย {silverShort(r.stock)}</Badge> : <Badge tone="good">ขาดตลาด</Badge>}
            <TrendBadge trend={c.trend7} />
          </div>
        </td>
      </tr>
      {open && (
        <tr id={`mk-detail-${r.id}`} className="border-t border-border bg-background/40">
          <td colSpan={7} className="px-3 py-3 shadow-[inset_3px_0_0_var(--accent)]">
            <Detail c={c} rate={rate} />
          </td>
        </tr>
      )}
    </>
  );
}

function MarketCard({ c, rate, open, onToggle }: { c: Computed; rate: number; open: boolean; onToggle: () => void }) {
  const r = c.row;
  const sig = signalBadge(c);
  return (
    <div id={`mk-card-${r.id}`} className={`scroll-mt-40 rounded-lg border bg-panel ${open ? "border-accent/60" : "border-border"}`}>
      {/* the star sits beside the toggle, not inside it: a button inside a button is invalid */}
      <div className="flex items-start">
        <button
          type="button"
          data-toggle
          aria-expanded={open}
          aria-controls={`mk-card-detail-${r.id}`}
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg py-3 pl-2 pr-1 text-left"
        >
          <Chevron open={open} />
          <ItemIcon id={r.id} grade={r.grade} size={40} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{r.th}</span>
            <span className="line-clamp-2 text-xs text-muted">
              {silver(r.price)} · ปกติ {r.avg90 !== null ? silverShort(r.avg90) : "-"} · ซื้อขาย {r.vol14 === null ? "-" : silverShort(r.vol14)}/14 วัน
            </span>
            {/* price against normal leads the badge row, so the name and numbers keep the card's width */}
            <span className="mt-1 flex flex-wrap items-center gap-1">
              {c.dev !== null && <DevText dev={c.dev} vsNormal className="mr-1 text-xs font-semibold" />}
              {sig && (
                <Badge tone={sig.tone} wrap>
                  {sig.text}
                </Badge>
              )}
              {r.stock > 0 ? <Badge tone="neutral">ค้างขาย {silverShort(r.stock)}</Badge> : <Badge tone="good">ขาดตลาด</Badge>}
              <TrendBadge trend={c.trend7} />
            </span>
          </span>
        </button>
        <div className="shrink-0 pr-1 pt-2">
          <FavoriteStar id={r.id} name={r.th} />
        </div>
      </div>
      {open && (
        <div id={`mk-card-detail-${r.id}`} className="border-t border-border px-3 py-3">
          <Detail c={c} rate={rate} />
        </div>
      )}
    </div>
  );
}

function Detail({ c, rate }: { c: Computed; rate: number }) {
  const r = c.row;
  const a = c.assess;
  const sellLines = c.dev !== null && c.dev > 0 ? sellEvidence(r) : null;
  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_360px]">
      <div className="text-sm text-muted">
        <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="ต่ำสุด 90 วัน" value={r.min90 !== null ? silver(r.min90) : "-"} />
          <Stat label="สูงสุด 90 วัน" value={r.max90 !== null ? silver(r.max90) : "-"} />
          <Stat label="เฉลี่ย 30 วัน" value={r.avg30 !== null ? silver(r.avg30) : "-"} />
          <Stat label={`ได้รับสุทธิถ้าขายราคาปกติ (${pct(rate, 1)})`} value={c.net !== null ? silver(c.net) : "-"} />
        </div>

        <Card as="div" className="mb-2 p-3">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <SectionLabel as="h4">{sellLines ? "หลักฐานฝั่งขาย" : "หลักฐานว่าจะฟื้น"}</SectionLabel>
            {!sellLines && (
              <Badge tone={LEVEL_TONE[a.level]}>
                โอกาสฟื้น {a.level}
                {a.level !== "ไม่พอข้อมูล" ? ` ${a.score}/100` : ""}
              </Badge>
            )}
            {a.daysToClear !== null && a.daysToClear > 0 && <span className="text-xs">ที่ความเร็วขายตอนนี้ ของค้างขายหมดใน ~{Math.max(1, Math.round(a.daysToClear))} วัน</span>}
          </div>
          <EvidenceList lines={sellLines ?? a.lines} />
          <p className="mt-2 text-xs">
            คะแนนมาจากตัวเลขในตลาดเท่านั้น ไม่รวมอีเวนต์ แพตช์ หรือของแจก ถ้ารู้ว่ากำลังจะมีอีเวนต์ที่ใช้ของนี้ ให้ถือว่าหลักฐานแรงกว่านี้ ถ้ามีแพตช์เพิ่มแหล่งดรอป ให้ถือว่าอ่อนกว่านี้
          </p>
        </Card>

        <p className="flex flex-wrap items-center gap-2 text-xs">
          <span>
            ซื้อขายสะสม {silver(r.trades)} ครั้ง{r.tradesPerDay !== null ? ` (วันละ ~${silver(r.tradesPerDay)})` : ""}
            {r.en ? ` · ${r.en}` : ""} · id {r.id}
          </span>
          <Link href={calcHref(r)} className={btn("secondary", "sm")}>
            คิดกำไรเทรดของนี้ <span aria-hidden>→</span>
          </Link>
        </p>
      </div>
      <MarketPanel id={r.id} name={r.th} price={r.price} stock={r.stock} market />
    </div>
  );
}

const EVIDENCE_WORD = { pass: "ผ่าน", fail: "ไม่ผ่าน", none: "ไม่มีข้อมูล" } as const;

function EvidenceList({ lines }: { lines: EvidenceLine[] }) {
  return (
    <ul className="space-y-0.5 text-sm">
      {lines.map((l, i) => (
        <li key={i} className="flex gap-2">
          <span aria-hidden className={`w-4 shrink-0 text-center ${l.ok === true ? "text-good" : l.ok === false ? "text-bad" : "text-muted"}`}>
            {l.ok === true ? "✓" : l.ok === false ? "✗" : "–"}
          </span>
          <span className={l.ok === null ? "text-muted" : "text-foreground"}>
            <span className="sr-only">{l.ok === true ? EVIDENCE_WORD.pass : l.ok === false ? EVIDENCE_WORD.fail : EVIDENCE_WORD.none}: </span>
            {l.text}
          </span>
        </li>
      ))}
    </ul>
  );
}
