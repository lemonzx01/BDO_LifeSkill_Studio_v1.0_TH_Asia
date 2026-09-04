"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { tradeMath } from "@/lib/engine/trade";
import { pct, silver } from "@/lib/format";
import type { SessionUser } from "./auth/UserMenu";
import { ItemIcon } from "./ItemIcon";
import { NumberInput } from "./NumberInput";
import { TopNav } from "./TopNav";
import { useSettings } from "./UserDataProvider";

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

const FAME_OPTIONS = [
  { v: 0, label: "0" },
  { v: 0.005, label: "+0.5% (1,000–3,999)" },
  { v: 0.01, label: "+1% (4,000–6,999)" },
  { v: 0.015, label: "+1.5% (7,000+)" },
];

const inputCls = "num w-full rounded border border-border bg-panel-2 px-3 py-2 text-base outline-none focus:border-accent";
const labelCls = "flex flex-col gap-1 text-sm";

export function TradeCalc({ user }: { user: SessionUser }) {
  const params = useSearchParams();
  const [settings] = useSettings();

  // bonuses start from the member's saved settings but can be changed here without saving
  const [valuePack, setValuePack] = useState(settings.valuePack);
  const [merchantRing, setMerchantRing] = useState(settings.merchantRing);
  const [familyFame, setFamilyFame] = useState(settings.familyFame);

  const [qty, setQty] = useState(1);
  const [buy, setBuy] = useState(Number(params.get("buy")) || 0);
  const [sell, setSell] = useState(Number(params.get("sell")) || 0);

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<MarketHit[]>([]);
  const [item, setItem] = useState<MarketHit | null>(null);
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // search as you type (market snapshot, all 10k items)
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      const t = setTimeout(() => setHits([]), 0);
      return () => clearTimeout(t);
    }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/market/search?q=${encodeURIComponent(q)}`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((j: { items: MarketHit[] }) => setHits(j.items))
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [query]);

  // "?item=ID" from the market page preselects an item
  const paramItem = Number(params.get("item"));
  useEffect(() => {
    if (!paramItem) return;
    const ctl = new AbortController();
    fetch(`/api/market/search?q=${paramItem}`, { signal: ctl.signal }).catch(() => {});
    // the search endpoint matches names only; load the item via its order book instead
    fetch(`/api/market/${paramItem}`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: { orders: OrderRow[]; history: number[] }) => {
        const last = d.history.length ? d.history[d.history.length - 1] : 0;
        const name = params.get("name") ?? `#${paramItem}`;
        const current = Number(params.get("price")) || last;
        setItem({ id: paramItem, th: name, en: null, price: current, stock: 0, grade: 0 });
        setOrders(d.orders);
        setBuy((b) => b || current);
        setSell((s) => s || current);
      })
      .catch(() => {});
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramItem]);

  const pick = (hit: MarketHit) => {
    setItem(hit);
    setHits([]);
    setQuery("");
    setBuy(hit.price);
    setSell(hit.price);
    setOrders(null);
    setLoadingOrders(true);
    fetch(`/api/market/${hit.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: { orders: OrderRow[] }) => setOrders(d.orders))
      .catch(() => setOrders([]))
      .finally(() => setLoadingOrders(false));
  };

  const rungs = useMemo(() => (orders ? [...orders].sort((a, b) => b.price - a.price) : []), [orders]);
  const result = useMemo(() => tradeMath({ qty, buyPrice: buy, sellPrice: sell, valuePack, merchantRing, familyFame }), [qty, buy, sell, valuePack, merchantRing, familyFame]);
  const good = result.profit > 0;

  return (
    <main className="mx-auto w-full max-w-5xl px-3 py-4 md:px-6">
      <TopNav user={user} subtitle="ซื้อราคานี้ ขายราคานี้ จะได้เงินเท่าไหร่ หลังหักภาษีตลาดกลาง" />
      <h2 className="mb-3 text-base font-semibold">คิดภาษี / กำไรเทรด</h2>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <section className="space-y-4 rounded-lg border border-border bg-panel p-4">
          {/* item picker (optional) */}
          <div className="relative">
            <label className={labelCls}>
              <span className="font-medium">ไอเท็ม (ไม่บังคับ — เลือกแล้วจะเห็นช่องราคาจริงในตลาด)</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="พิมพ์ชื่อไอเท็ม…" className="w-full rounded border border-border bg-panel-2 px-3 py-2 text-base outline-none focus:border-accent" />
            </label>
            {hits.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded border border-border bg-panel shadow-lg">
                {hits.map((h) => (
                  <li key={h.id}>
                    <button onClick={() => pick(h)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-panel-2">
                      <ItemIcon id={h.id} grade={h.grade} size={24} />
                      <span className="min-w-0 flex-1 truncate">{h.th}</span>
                      <span className="num text-xs text-muted">
                        {silver(h.price)} · ค้างขาย {silver(h.stock)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {item && (
              <div className="mt-2 flex items-center gap-2 rounded border border-border bg-panel-2/60 px-3 py-2 text-sm">
                <ItemIcon id={item.id} grade={item.grade} size={28} />
                <span className="min-w-0 flex-1 truncate font-medium">{item.th}</span>
                <span className="num text-xs text-muted">ราคาตอนนี้ {silver(item.price)}</span>
                <button
                  onClick={() => {
                    setItem(null);
                    setOrders(null);
                  }}
                  className="text-xs text-muted hover:text-foreground"
                >
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
            <PriceField label="ราคาขาย (ต่อชิ้น)" value={sell} onChange={setSell} rungs={rungs} side="sell" loading={loadingOrders} />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className={labelCls}>
              <span className="font-medium">Value Pack</span>
              <select value={valuePack ? "1" : "0"} onChange={(e) => setValuePack(e.target.value === "1")} className="rounded border border-border bg-panel-2 px-3 py-2 text-base">
                <option value="1">มี (+30%)</option>
                <option value="0">ไม่มี</option>
              </select>
            </label>
            <label className={labelCls}>
              <span className="font-medium">แหวนพ่อค้าผู้มั่งคั่ง</span>
              <select value={merchantRing ? "1" : "0"} onChange={(e) => setMerchantRing(e.target.value === "1")} className="rounded border border-border bg-panel-2 px-3 py-2 text-base">
                <option value="0">ไม่มี</option>
                <option value="1">มี (+5%)</option>
              </select>
            </label>
            <label className={labelCls}>
              <span className="font-medium">Family Fame</span>
              <select value={familyFame} onChange={(e) => setFamilyFame(Number(e.target.value))} className="rounded border border-border bg-panel-2 px-3 py-2 text-base">
                {FAME_OPTIONS.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="space-y-2 rounded-lg border border-border bg-panel p-4">
          <Line label={`ภาษี (${pct(result.taxRate, 2)})`} value={`-${silver(result.tax)}`} cls="text-bad" />
          <Line label="ขายได้ก่อนหักภาษี" value={silver(result.gross)} muted />
          <Line label="ได้รับจริง" value={silver(result.received)} big />
          {buy > 0 && (
            <>
              <Line label="ต้นทุนซื้อ" value={`-${silver(result.cost)}`} muted />
              <Line label={good ? "กำไร" : "ขาดทุน"} value={silver(result.profit)} cls={good ? "text-good" : "text-bad"} big />
              <Line label="กำไร/ชิ้น" value={silver(result.profitPerUnit)} cls={good ? "text-good" : "text-bad"} />
              {result.roi !== null && <Line label="ROI" value={pct(result.roi, 1)} cls={good ? "text-good" : "text-bad"} />}
              <Line label="ขายอย่างน้อยเท่านี้ถึงเท่าทุน" value={silver(Math.ceil(result.breakEvenSell))} muted />
            </>
          )}
          <p className="pt-2 text-[11px] text-muted">
            ได้รับจริง = ราคาขาย × 0.65 × (1 + Value Pack 0.30 + แหวน 0.05 + Family Fame) · ตัวเลขในเกมอาจต่างกันไม่กี่ซิลเวอร์จากการปัดเศษ
          </p>
        </section>
      </div>
    </main>
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
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  rungs: OrderRow[];
  side: "buy" | "sell";
  loading: boolean;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`${labelCls} relative`}>
      <span className="font-medium">{label}</span>
      <NumberInput min={0} value={value} blankZero placeholder="0" onChange={onChange} className={inputCls} />
      {rungs.length > 0 ? (
        <>
          {/* our own list so it always opens downwards (a native <select> flips upwards near the bottom of the screen) */}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center justify-between rounded border border-border bg-panel-2 px-2 py-1.5 text-sm text-muted hover:text-foreground"
          >
            <span>เลือกจากช่องราคาในตลาด ({rungs.length} ช่อง)</span>
            <span className="text-xs">{open ? "▴" : "▾"}</span>
          </button>
          {open && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded border border-border bg-panel shadow-lg">
              <div className="sticky top-0 grid grid-cols-[1fr_auto_auto] gap-x-3 border-b border-border bg-panel-2 px-2 py-1 text-[11px] text-muted">
                <span>ราคา</span>
                <span className="w-16 text-right">มีขาย</span>
                <span className="w-16 text-right">รอซื้อ</span>
              </div>
              {rungs.map((r) => {
                const active = r.price === value;
                const highlight = side === "buy" ? r.sellers > 0 : r.buyers > 0;
                return (
                  <button
                    key={r.price}
                    type="button"
                    onClick={() => {
                      onChange(r.price);
                      setOpen(false);
                    }}
                    className={`grid w-full grid-cols-[1fr_auto_auto] gap-x-3 px-2 py-1.5 text-left text-sm hover:bg-panel-2 ${active ? "bg-accent/10 text-accent" : ""}`}
                  >
                    <span className={`num ${highlight ? "font-medium" : "text-muted"}`}>{silver(r.price)}</span>
                    <span className={`num w-16 text-right ${r.sellers > 0 ? "text-foreground" : "text-muted"}`}>{r.sellers > 0 ? silver(r.sellers) : "-"}</span>
                    <span className={`num w-16 text-right ${r.buyers > 0 ? "text-good" : "text-muted"}`}>{r.buyers > 0 ? silver(r.buyers) : "-"}</span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <span className="text-[11px] text-muted">{loading ? "กำลังโหลดช่องราคา…" : (hint ?? "เลือกไอเท็มด้านบนเพื่อดึงช่องราคาจากตลาด")}</span>
      )}
    </div>
  );
}

function Line({ label, value, cls = "", muted = false, big = false }: { label: string; value: string; cls?: string; muted?: boolean; big?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 rounded border border-border px-3 ${big ? "bg-panel-2/60 py-2.5" : "py-1.5"}`}>
      <span className={`${muted ? "text-muted" : ""} ${big ? "text-base" : "text-sm"}`}>{label}</span>
      <span className={`num font-semibold ${big ? "text-xl" : "text-base"} ${cls}`}>{value}</span>
    </div>
  );
}
