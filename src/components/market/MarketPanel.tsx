"use client";

import { useEffect, useState } from "react";
import { describeError, fetchJson, problemAction, type FetchProblem } from "@/lib/fetch-error";
import { pct, silver, silverShort } from "@/lib/format";
import { Card, SectionLabel } from "../ui/Card";
import { Notice } from "../ui/Notice";
import { Sparkline } from "../ui/Sparkline";
import { Stat } from "../ui/Stat";

interface MarketDetail {
  history: number[];
  orders: { price: number; sellers: number; buyers: number }[];
  daily?: { day: string; price: number }[];
}

/**
 * Live market box for one item: current price/stock, order book totals and a 90-day sparkline.
 * The one copy used by both the market scanner and the recipe detail.
 */
export function MarketPanel({ id, name, price, stock, market }: { id: number; name: string; price: number | undefined; stock: number | undefined; market: boolean }) {
  // `key` is the load the answer belongs to (item + attempt), so a stale one reads as loading
  const [state, setState] = useState<{ key: string; detail: MarketDetail | null; problem: FetchProblem | null } | null>(null);
  // ลองใหม่ bumps this to load again
  const [attempt, setAttempt] = useState(0);
  const loadKey = `${id}:${attempt}`;

  useEffect(() => {
    if (!market) return;
    let cancelled = false;
    fetchJson<MarketDetail>(`/api/market/${id}`)
      .then((d) => {
        if (!cancelled) setState({ key: loadKey, detail: d, problem: null });
      })
      .catch((e) => {
        if (!cancelled) setState({ key: loadKey, detail: null, problem: describeError(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [id, market, loadKey]);

  const current = state?.key === loadKey ? state : null;
  const detail = current?.detail ?? null;
  const problem = current?.problem ?? null;
  const loading = current === null;
  const retry = () => setAttempt((a) => a + 1);
  // the official history when it has points, else our own daily snapshots
  const series = detail?.history && detail.history.length > 1 ? detail.history : (detail?.daily?.map((d) => d.price) ?? []);
  const min = series.length ? Math.min(...series) : 0;
  const max = series.length ? Math.max(...series) : 0;
  const avg = series.length ? series.reduce((a, b) => a + b, 0) / series.length : 0;
  const buyers = detail?.orders.reduce((a, o) => a + o.buyers, 0) ?? 0;
  const sellers = detail?.orders.reduce((a, o) => a + o.sellers, 0) ?? 0;

  return (
    <Card as="aside" className="p-3 text-sm">
      <SectionLabel as="h4" className="mb-2">
        ตลาด: {name}
      </SectionLabel>
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
          {problem ? (
            // a failed load is not "no history": say what happened and offer ลองใหม่ / ล็อกอินใหม่
            <Notice tone="warn" action={problemAction(problem, retry)}>
              โหลดราคาย้อนหลังไม่สำเร็จ: {problem.message}
            </Notice>
          ) : series.length > 1 ? (
            <>
              <Sparkline data={series} />
              <div className="mt-1 grid grid-cols-3 gap-1 text-xs text-muted">
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
                <p className="mt-2 text-xs text-muted">
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
    </Card>
  );
}
