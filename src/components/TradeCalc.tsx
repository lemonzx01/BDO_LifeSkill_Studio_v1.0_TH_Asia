"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { tradeMath } from "@/lib/engine/trade";
import { fetchJson, isAbort } from "@/lib/fetch-error";
import { pct, signedPct, silver, silverShort } from "@/lib/format";
import { scrollBehavior } from "@/lib/scroll";
import { FAMILY_FAME, FAMILY_FAME_OPTIONS, MERCHANT_RING, NET, SETTINGS_TITLE, VALUE_PACK } from "@/lib/settings-labels";
import { normalPrice, tradeVerdict, type TradeVerdict, type VerdictTone } from "@/lib/trade-verdict";
import type { SessionUser } from "./auth/UserMenu";
import { ItemIcon } from "./ItemIcon";
import { NumberInput } from "./NumberInput";
import { useSettings } from "./UserDataProvider";
import { btn } from "./ui/button";
import { fieldCls, selectCls } from "./ui/field";
import { Money, pctCls } from "./ui/Money";
import { Page, PageHeader } from "./ui/Page";

interface MarketHit {
  id: number;
  th: string;
  en: string | null;
  price: number;
  stock: number;
  grade: number;
}
interface OrderRow {
  price: number;
  sellers: number;
  buyers: number;
}
/** GET /api/market/:id */
interface MarketDetail {
  orders: OrderRow[];
  /** official 90-day daily prices, oldest first */
  history: number[];
  /** our own daily snapshot rows */
  daily?: { day: string; price: number }[];
}

const inputCls = `${fieldCls()} num`;
const labelCls = "flex flex-col gap-1 text-sm";

/** `user` null: a visitor who is not signed in. */
export function TradeCalc({ user }: { user: SessionUser | null }) {
  const params = useSearchParams();
  const [settings] = useSettings();

  // the bonuses follow ตั้งค่าตัวละคร (so a change made in the drawer applies here at once);
  // changing one here is a page-only override (null = follow the settings), never saved
  const [valuePackOverride, setValuePackOverride] = useState<boolean | null>(null);
  const [merchantRingOverride, setMerchantRingOverride] = useState<boolean | null>(null);
  const [familyFameOverride, setFamilyFameOverride] = useState<number | null>(null);
  const valuePack = valuePackOverride ?? settings.valuePack;
  const merchantRing = merchantRingOverride ?? settings.merchantRing;
  const familyFame = familyFameOverride ?? settings.familyFame;
  const overridden = valuePackOverride !== null || merchantRingOverride !== null || familyFameOverride !== null;
  const resetBonuses = () => {
    setValuePackOverride(null);
    setMerchantRingOverride(null);
    setFamilyFameOverride(null);
  };

  const [qty, setQty] = useState(1);
  const [buy, setBuy] = useState(Number(params.get("buy")) || 0);
  const [sell, setSell] = useState(Number(params.get("sell")) || 0);

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<MarketHit[]>([]);
  // the hit list is a combobox popup: shown while the box has focus, closed by Escape, blur or a pick
  const [listOpen, setListOpen] = useState(false);
  const [activeHit, setActiveHit] = useState(-1);
  // the last search failed (shown apart from "nothing found"); bumping searchAttempt runs it again
  const [searchFailed, setSearchFailed] = useState(false);
  const [searchAttempt, setSearchAttempt] = useState(0);
  const [item, setItem] = useState<MarketHit | null>(null);
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [loadingOrders, setLoadingOrders] = useState(false);
  /** the item's 90-day average price, once loaded */
  const [normal, setNormal] = useState<number | null>(null);
  // each item load gets a number; an answer for an item that was replaced or removed is dropped
  const loadSeq = useRef(0);
  const listId = useId();
  const optionId = (id: number) => `${listId}-${id}`;
  const resultRef = useRef<HTMLElement>(null);

  // search as you type (market snapshot, all 10k items)
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      const t = setTimeout(() => {
        setHits([]);
        setActiveHit(-1);
        setSearchFailed(false);
      }, 0);
      return () => clearTimeout(t);
    }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetchJson<{ items: MarketHit[] }>(`/api/market/search?q=${encodeURIComponent(q)}`, { signal: ctl.signal })
        .then((j) => {
          setHits(j.items);
          setActiveHit(-1);
          setSearchFailed(false);
        })
        .catch((e) => {
          if (isAbort(e)) return;
          setHits([]);
          setActiveHit(-1);
          setSearchFailed(true);
        });
    }, 250);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [query, searchAttempt]);

  // keep the option picked with the arrow keys in view (the list scrolls on a short screen)
  useEffect(() => {
    const h = activeHit >= 0 ? hits[activeHit] : undefined;
    if (h) document.getElementById(`${listId}-${h.id}`)?.scrollIntoView({ block: "nearest" });
  }, [activeHit, hits, listId]);

  // "?item=ID" from the market page preselects an item
  const paramItem = Number(params.get("item"));
  useEffect(() => {
    if (!paramItem) return;
    const seq = ++loadSeq.current;
    const ctl = new AbortController();
    // the search endpoint matches names only; load the item via its order book instead
    fetchJson<MarketDetail>(`/api/market/${paramItem}`, { signal: ctl.signal })
      .then((d) => {
        if (seq !== loadSeq.current) return;
        const last = d.history.length ? d.history[d.history.length - 1] : 0;
        const name = params.get("name") ?? `#${paramItem}`;
        const current = Number(params.get("price")) || last;
        const avg = normalPrice(d.history, d.daily);
        setItem({ id: paramItem, th: name, en: null, price: current, stock: 0, grade: 0 });
        setOrders(d.orders);
        setNormal(avg);
        setBuy((b) => b || current);
        // no ?sell=: sell at the normal price, so "buy now, sell now" does not show a loss of exactly the tax
        setSell((s) => s || avg || current);
      })
      .catch(() => {});
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramItem]);

  const pick = (hit: MarketHit) => {
    const seq = ++loadSeq.current;
    setItem(hit);
    setHits([]);
    setActiveHit(-1);
    setListOpen(false);
    setQuery("");
    setBuy(hit.price);
    setSell(hit.price);
    setNormal(null);
    setOrders(null);
    setLoadingOrders(true);
    fetchJson<MarketDetail>(`/api/market/${hit.id}`)
      .then((d) => {
        if (seq !== loadSeq.current) return;
        setOrders(d.orders);
        const avg = normalPrice(d.history, d.daily);
        setNormal(avg);
        // sell at the normal price, unless the sell price was changed while this loaded
        if (avg) setSell((s) => (s === hit.price ? avg : s));
      })
      .catch(() => {
        if (seq === loadSeq.current) setOrders([]);
      })
      .finally(() => {
        if (seq === loadSeq.current) setLoadingOrders(false);
      });
  };

  const removeItem = () => {
    loadSeq.current++;
    setItem(null);
    setOrders(null);
    setNormal(null);
    setLoadingOrders(false);
  };

  const showList = listOpen && hits.length > 0;
  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (hits.length === 0) return;
      e.preventDefault();
      const down = e.key === "ArrowDown";
      setListOpen(true);
      setActiveHit((a) => (down ? (a + 1) % hits.length : a <= 0 ? hits.length - 1 : a - 1));
    } else if (e.key === "Enter") {
      const h = showList && activeHit >= 0 ? hits[activeHit] : undefined;
      if (h) {
        e.preventDefault();
        pick(h);
      }
    } else if (e.key === "Escape" && showList) {
      e.preventDefault();
      setListOpen(false);
      setActiveHit(-1);
    }
  };

  const rungs = useMemo(() => (orders ? [...orders].sort((a, b) => b.price - a.price) : []), [orders]);
  const result = useMemo(() => tradeMath({ qty, buyPrice: buy, sellPrice: sell, valuePack, merchantRing, familyFame }), [qty, buy, sell, valuePack, merchantRing, familyFame]);
  const verdict = tradeVerdict(result, { qty, buy, sell });
  const good = result.profit > 0;

  // the phone bar under the form: jump to the full result
  const showResult = () => {
    const el = resultRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
    el.focus({ preventScroll: true });
  };

  return (
    <Page user={user} width="narrow">
      <PageHeader title="คิดภาษี / กำไรเทรด" description="ซื้อราคานี้ ขายราคานี้ จะได้เงินเท่าไหร่ หลังหักภาษีตลาดกลาง" />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <section className="space-y-4 rounded-lg border border-border bg-panel p-4">
          {/* item picker (optional) */}
          <div className="relative">
            <label className={labelCls}>
              <span className="font-medium">ไอเท็ม (ไม่บังคับ — เลือกแล้วจะเห็นช่องราคาจริงในตลาด)</span>
              <input
                role="combobox"
                aria-expanded={showList}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={showList && activeHit >= 0 && hits[activeHit] ? optionId(hits[activeHit].id) : undefined}
                autoComplete="off"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setListOpen(true);
                }}
                onFocus={() => setListOpen(true)}
                onBlur={() => {
                  setListOpen(false);
                  setActiveHit(-1);
                }}
                onKeyDown={onSearchKey}
                placeholder="พิมพ์ชื่อไอเท็ม…"
                className={fieldCls()}
              />
            </label>
            {searchFailed && (
              <p role="status" className="mt-1 flex flex-wrap items-center gap-x-1 text-xs text-bad">
                ค้นหาไม่สำเร็จ ·
                <button type="button" onClick={() => setSearchAttempt((a) => a + 1)} className="underline hover:text-foreground">
                  ลองใหม่
                </button>
              </p>
            )}
            {/* always in the page (hidden when closed) so aria-controls points at something */}
            <ul
              id={listId}
              role="listbox"
              aria-label="ผลค้นหาไอเท็ม"
              hidden={!showList}
              className="absolute z-40 mt-1 max-h-72 w-full overflow-y-auto rounded border border-border bg-panel shadow-lg"
            >
              {hits.map((h, i) => (
                <li
                  key={h.id}
                  id={optionId(h.id)}
                  role="option"
                  aria-selected={i === activeHit}
                  // keep focus in the box, so its blur does not close the list before the click lands
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(h)}
                  className={`flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm hover:bg-panel-2 ${i === activeHit ? "bg-panel-2" : ""}`}
                >
                  <ItemIcon id={h.id} grade={h.grade} size={24} />
                  <span className="min-w-0 flex-1 truncate">{h.th}</span>
                  <span className="num text-xs text-muted">
                    {silver(h.price)} · ค้างขาย {silver(h.stock)}
                  </span>
                </li>
              ))}
            </ul>
            {item && (
              <div className="mt-2 flex items-center gap-2 rounded border border-border bg-panel-2/60 px-3 py-2 text-sm">
                <ItemIcon id={item.id} grade={item.grade} size={28} />
                <span className="min-w-0 flex-1 truncate font-medium">{item.th}</span>
                <span className="num text-xs text-muted">ราคาตอนนี้ {silver(item.price)}</span>
                <button type="button" onClick={removeItem} aria-label={`เอาออก ${item.th}`} className={btn("ghost", "sm")}>
                  เอาออก
                </button>
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className={labelCls}>
              <span className="font-medium">จำนวน</span>
              <NumberInput min={0} step={1} value={qty} onChange={(v) => setQty(Math.floor(v))} className={inputCls} />
            </label>
            <PriceField label="ราคาซื้อ (ต่อชิ้น)" value={buy} onChange={setBuy} rungs={rungs} side="buy" loading={loadingOrders} hint="ใส่ 0 ถ้าไม่ได้ซื้อมา (คิดแค่ภาษี)" />
            <PriceField
              label="ราคาขาย (ต่อชิ้น)"
              value={sell}
              onChange={setSell}
              rungs={rungs}
              side="sell"
              loading={loadingOrders}
              extra={
                normal !== null && (
                  <p className="text-xs text-muted">
                    ราคาปกติ 90 วัน: <span className="num">{silver(normal)}</span>
                    {sell !== normal && (
                      <>
                        {" · "}
                        <button type="button" onClick={() => setSell(normal)} className="text-accent underline hover:text-accent-hover">
                          ใช้ราคานี้
                        </button>
                      </>
                    )}
                  </p>
                )
              }
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className={labelCls}>
              <span className="font-medium">{VALUE_PACK.name}</span>
              <select value={valuePack ? "1" : "0"} onChange={(e) => setValuePackOverride(e.target.value === "1")} className={`${selectCls()} w-full`}>
                <option value="1">{VALUE_PACK.on}</option>
                <option value="0">{VALUE_PACK.off}</option>
              </select>
            </label>
            <label className={labelCls}>
              <span className="font-medium">{MERCHANT_RING.name}</span>
              <select value={merchantRing ? "1" : "0"} onChange={(e) => setMerchantRingOverride(e.target.value === "1")} className={`${selectCls()} w-full`}>
                <option value="0">{MERCHANT_RING.off}</option>
                <option value="1">{MERCHANT_RING.on}</option>
              </select>
            </label>
            <label className={labelCls}>
              <span className="font-medium">{FAMILY_FAME}</span>
              <select value={familyFame} onChange={(e) => setFamilyFameOverride(Number(e.target.value))} className={`${selectCls()} w-full`}>
                {FAMILY_FAME_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="-mt-1 flex flex-wrap items-center gap-x-1 text-xs text-muted">
            ใช้ค่าจาก{SETTINGS_TITLE} · เปลี่ยนตรงนี้ไม่บันทึก
            {overridden && (
              <>
                {" · "}
                <button type="button" onClick={resetBonuses} className="text-accent underline hover:text-accent-hover">
                  คืนค่า
                </button>
              </>
            )}
          </p>
        </section>

        {/* below lg the result sits under the whole form: this bar keeps the outcome in sight */}
        <button
          type="button"
          onClick={showResult}
          className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 flex w-full items-center gap-3 rounded-lg border border-border bg-panel/95 px-4 py-2 text-left shadow-lg backdrop-blur md:bottom-0 lg:hidden"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-muted">{NET}</span>
            <Money value={result.received} compact className="text-base font-semibold" />
          </span>
          <span className="min-w-0 flex-1 text-right">
            <span className="block text-xs text-muted">กำไร/ขาดทุน</span>
            {buy > 0 ? (
              <Money value={result.profit} tone="profit" compact className="text-base font-semibold" />
            ) : (
              <span className="text-xs text-muted">ใส่ราคาซื้อ</span>
            )}
          </span>
          <span aria-hidden className="text-muted">
            ↓
          </span>
          <span className="sr-only">ดูผลคำนวณทั้งหมด</span>
        </button>

        <section ref={resultRef} tabIndex={-1} aria-label="ผลคำนวณ" className="scroll-mt-2 space-y-2 rounded-lg border border-border bg-panel p-4 outline-hidden lg:self-start">
          <Verdict verdict={verdict} />
          <Line label="ขายได้ก่อนหักภาษี" value={silver(result.gross)} muted />
          <Line label={`ภาษี (${pct(result.taxRate, 2)})`} value={`-${silver(result.tax)}`} cls="text-bad" />
          <Line label={NET} value={silver(result.received)} big />
          {buy > 0 && (
            <>
              <Line label="ต้นทุนซื้อ" value={`-${silver(result.cost)}`} muted />
              {/* the verdict rounds the total (1.2M); the exact one, when it differs from per unit */}
              {qty > 1 && <Line label={good ? "กำไรรวม" : "ขาดทุนรวม"} value={<Money value={result.profit} tone="profit" />} />}
              <Line label="กำไร/ชิ้น" value={<Money value={result.profitPerUnit} tone="profit" />} />
              {result.roi !== null && <Line label="ROI" value={signedPct(result.roi, 1)} cls={pctCls(result.roi, 1)} />}
            </>
          )}
          <p className="pt-2 text-xs text-muted">
            {NET} = ราคาขาย × 0.65 × (1 + Value Pack 0.30 + แหวน 0.05 + Family Fame) · ตัวเลขในเกมอาจต่างกันไม่กี่ซิลเวอร์จากการปัดเศษ
          </p>
        </section>
      </div>
    </Page>
  );
}

const VERDICT_CLS: Record<VerdictTone, string> = {
  good: "border-good/40 bg-good/10 text-good",
  bad: "border-bad/40 bg-bad/10 text-bad",
  neutral: "border-border bg-panel-2/60 text-muted",
};

/** The answer first: worth it or not, by how much, and the lowest price that breaks even. */
function Verdict({ verdict }: { verdict: TradeVerdict }) {
  return (
    <div className={`rounded border px-3 py-3 ${VERDICT_CLS[verdict.tone]}`}>
      <p className="text-lg font-semibold">{verdict.text}</p>
      {verdict.breakEven && <p className="mt-0.5 text-xs text-muted">{verdict.breakEven}</p>}
    </div>
  );
}

function PriceField({
  label,
  value,
  onChange,
  rungs,
  side,
  loading,
  hint,
  extra,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  rungs: OrderRow[];
  side: "buy" | "sell";
  loading: boolean;
  hint?: string;
  /** a line under the field (the sell field's 90-day price) */
  extra?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputId = useId();
  const approxId = useId();
  const listId = useId();

  const close = () => {
    setOpen(false);
    toggleRef.current?.focus();
  };

  // While open: Escape or a press outside closes it and puts focus back on the toggle. The chosen
  // price (or the top one) takes focus, so the arrow keys work at once.
  useEffect(() => {
    if (!open) return;
    const options = listRef.current?.querySelectorAll<HTMLElement>('[role="option"]');
    const chosen = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    (chosen ?? options?.[0])?.focus();
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // arrow keys, Home and End move between the prices
  const onListKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const options = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
    if (options.length === 0) return;
    const at = options.indexOf(document.activeElement as HTMLElement);
    let next = -1;
    if (e.key === "ArrowDown") next = Math.min(options.length - 1, at + 1);
    else if (e.key === "ArrowUp") next = Math.max(0, at - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = options.length - 1;
    if (next < 0) return;
    e.preventDefault();
    options[next].focus();
  };

  const selectedAt = rungs.findIndex((r) => r.price === value);

  return (
    <div className={labelCls}>
      <label htmlFor={inputId} className="font-medium">
        {label}
      </label>
      <NumberInput id={inputId} aria-describedby={approxId} min={0} value={value} blankZero placeholder="0" onChange={onChange} className={inputCls} />
      {/* type=number shows no thousands separators: the short form, so 1250000 reads as 1.25M */}
      <span id={approxId} className="num text-xs text-muted">
        {value >= 1000 ? `≈ ${silverShort(value)}` : " "}
      </span>
      {extra}
      {rungs.length > 0 ? (
        <div
          ref={wrapRef}
          className="relative"
          // focus leaving the list (Tab) closes it
          onBlur={(e) => {
            if (open && !e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
          }}
        >
          {/* our own list so it always opens downwards (a native <select> flips upwards near the bottom of the screen) */}
          <button
            ref={toggleRef}
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            onClick={() => setOpen((o) => !o)}
            className="flex min-h-10 w-full items-center justify-between rounded border border-border bg-panel-2 px-3 text-sm text-muted hover:text-foreground md:min-h-9"
          >
            <span>
              เลือกจากช่องราคาในตลาด ({rungs.length} ช่อง)<span className="sr-only"> สำหรับ{label}</span>
            </span>
            <span aria-hidden className="text-xs">
              {open ? "▴" : "▾"}
            </span>
          </button>
          {open && (
            <>
              {/* phones: a sheet from the bottom over a dimmed page; a tap on the dim closes it (on click,
                  not on press, so the tap cannot land on whatever is under the dim once it is gone) */}
              <div aria-hidden className="fixed inset-0 z-50 bg-black/60 md:hidden" onMouseDown={(e) => e.preventDefault()} onClick={close} />
              {/* tabIndex -1: a press on the title or the column names focuses this box, inside the
                  wrapper, so the wrapper's blur does not close the list (focus would fall to <main>) */}
              <div
                tabIndex={-1}
                className="fixed inset-x-0 bottom-0 z-50 max-h-[70dvh] overflow-y-auto rounded-t-xl border-t border-border bg-panel pb-[env(safe-area-inset-bottom)] outline-hidden md:absolute md:inset-x-0 md:bottom-auto md:top-full md:z-40 md:mt-1 md:max-h-72 md:rounded md:border md:pb-0 md:shadow-lg"
              >
                <div className="sticky top-0 z-10 bg-panel">
                  <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2 md:hidden">
                    <span className="text-sm font-semibold">{label}</span>
                    <button type="button" onClick={close} className={btn("ghost", "sm")}>
                      ปิด
                    </button>
                  </div>
                  <div aria-hidden className="grid grid-cols-[1fr_auto_auto] gap-x-3 border-b border-border bg-panel-2 px-2 py-1 text-xs text-muted">
                    <span>ราคา</span>
                    <span className="w-16 text-right">มีขาย</span>
                    <span className="w-16 text-right">รอซื้อ</span>
                  </div>
                </div>
                <div ref={listRef} id={listId} role="listbox" aria-label={`ช่องราคาในตลาด ${label}`} onKeyDown={onListKey}>
                  {rungs.map((r, i) => {
                    const active = r.price === value;
                    const highlight = side === "buy" ? r.sellers > 0 : r.buyers > 0;
                    return (
                      <button
                        key={r.price}
                        type="button"
                        role="option"
                        aria-selected={active}
                        // one tab stop: the chosen price, else the top one; the arrow keys reach the rest
                        tabIndex={i === (selectedAt >= 0 ? selectedAt : 0) ? 0 : -1}
                        aria-label={`${silver(r.price)} · มีขาย ${r.sellers > 0 ? silver(r.sellers) : "0"} · รอซื้อ ${r.buyers > 0 ? silver(r.buyers) : "0"}`}
                        onClick={() => {
                          onChange(r.price);
                          close();
                        }}
                        className={`grid min-h-11 w-full grid-cols-[1fr_auto_auto] items-center gap-x-3 px-2 py-1.5 text-left text-sm hover:bg-panel-2 focus-visible:-outline-offset-2 ${active ? "bg-accent/10 text-accent" : ""}`}
                      >
                        <span className={`num ${highlight ? "font-medium" : "text-muted"}`}>{silver(r.price)}</span>
                        <span className={`num w-16 text-right ${r.sellers > 0 ? "text-foreground" : "text-muted"}`}>{r.sellers > 0 ? silver(r.sellers) : "-"}</span>
                        <span className={`num w-16 text-right ${r.buyers > 0 ? "text-good" : "text-muted"}`}>{r.buyers > 0 ? silver(r.buyers) : "-"}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <span className="text-xs text-muted">{loading ? "กำลังโหลดช่องราคา…" : (hint ?? "เลือกไอเท็มด้านบนเพื่อดึงช่องราคาจากตลาด")}</span>
      )}
    </div>
  );
}

function Line({ label, value, cls = "", muted = false, big = false }: { label: string; value: ReactNode; cls?: string; muted?: boolean; big?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 rounded border border-border px-3 ${big ? "bg-panel-2/60 py-2.5" : "py-1.5"}`}>
      <span className={`${muted ? "text-muted" : ""} ${big ? "text-base" : "text-sm"}`}>{label}</span>
      <span className={`num font-semibold ${big ? "text-xl" : "text-base"} ${cls}`}>{value}</span>
    </div>
  );
}
