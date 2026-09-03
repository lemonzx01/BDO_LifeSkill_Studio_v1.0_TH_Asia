"use client";

import { useEffect, useState } from "react";
import { pct, silver, silverShort } from "@/lib/format";

interface MarketDetail {
  history: number[];
  orders: { price: number; sellers: number; buyers: number }[];
  daily?: { day: string; price: number }[];
}

/** Live market box for one item: current price/stock, order book totals and a 90-day sparkline. */
export function MarketPanel({ id, name, price, stock, market }: { id: number; name: string; price: number | undefined; stock: number | undefined; market: boolean }) {
  const [state, setState] = useState<{ status: "loading" | "done" | "error"; detail: MarketDetail | null }>({ status: "loading", detail: null });

  useEffect(() => {
    if (!market) return;
    let cancelled = false;
    fetch(`/api/market/${id}`)
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
  }, [id, market]);

  const detail = state.detail;
  const loading = state.status === "loading";
  const series = detail?.history && detail.history.length > 1 ? detail.history : (detail?.daily?.map((d) => d.price) ?? []);
  const min = series.length ? Math.min(...series) : 0;
  const max = series.length ? Math.max(...series) : 0;
  const avg = series.length ? series.reduce((a, b) => a + b, 0) / series.length : 0;
  const buyers = detail?.orders.reduce((a, o) => a + o.buyers, 0) ?? 0;
  const sellers = detail?.orders.reduce((a, o) => a + o.sellers, 0) ?? 0;

  return (
    <aside className="rounded-lg border border-border bg-panel p-3 text-sm">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">ตลาด: {name}</h4>
      {!market ? (
        <p className="text-muted">ไอเท็มนี้ซื้อขายในตลาดกลางไม่ได้</p>
      ) : (
        <>
          <div className="mb-2 grid grid-cols-2 gap-1">
            <Stat label="ราคาตอนนี้" value={price !== undefined ? silver(price) : "-"} />
            <Stat label="ของค้างขาย" value={stock !== undefined ? silver(stock) : "-"} />
            <Stat label="รอซื้อ (ทุกช่วงราคา)" value={detail ? silver(buyers) : loading ? "…" : "-"} />
            <Stat label="รอขาย (ทุกช่วงราคา)" value={detail ? silver(sellers) : loading ? "…" : "-"} />
          </div>
          {series.length > 1 ? (
            <>
              <Sparkline data={series} />
              <div className="mt-1 grid grid-cols-3 gap-1 text-[11px] text-muted">
                <span>
                  ต่ำสุด 90 วัน: <b className="text-foreground">{silverShort(min)}</b>
                </span>
                <span>
                  เฉลี่ย: <b className="text-foreground">{silverShort(avg)}</b>
                </span>
                <span>
                  สูงสุด: <b className="text-foreground">{silverShort(max)}</b>
                </span>
              </div>
              {price !== undefined && avg > 0 && (
                <p className="mt-2 text-[11px] text-muted">
                  ราคาตอนนี้ {price > avg ? "สูงกว่า" : "ต่ำกว่า"}ค่าเฉลี่ย 90 วัน {pct(Math.abs(price / avg - 1))}
                  {stock === 0 && buyers > 0 && " · ของหมด มีคนรอซื้อ ขายได้ทันที"}
                  {(stock ?? 0) > 0 && sellers > buyers && " · ของค้างขายเยอะ อาจขายช้า"}
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-muted">{loading ? "กำลังโหลดราคาย้อนหลัง…" : "ไม่มีข้อมูลราคาย้อนหลัง"}</p>
          )}
        </>
      )}
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border bg-panel-2/60 px-2 py-1.5">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="num font-semibold">{value}</div>
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
