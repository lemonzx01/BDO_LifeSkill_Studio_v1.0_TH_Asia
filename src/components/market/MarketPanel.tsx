"use client";

import { useEffect, useId, useState } from "react";
import { describeError, fetchJson, problemAction, type FetchProblem } from "@/lib/fetch-error";
import { pct, silver, silverShort } from "@/lib/format";
import { Badge } from "../ui/Badge";
import { Card, CardHeader } from "../ui/Card";
import { Icon } from "../ui/Icon";
import { Notice } from "../ui/Notice";
import { Sparkline } from "../ui/Sparkline";
import { Stat } from "../ui/Stat";

interface MarketDetail {
  history: number[];
  orders: { price: number; sellers: number; buyers: number }[];
  daily?: { day: string; price: number }[];
}

/** a Stat value that is still on its way: a shimmering block, and a word for screen readers */
const PENDING = (
  <>
    <span aria-hidden className="skeleton inline-block h-5 w-16 rounded-md align-middle" />
    <span className="sr-only">กำลังโหลด</span>
  </>
);

/**
 * Live market box for one item: current price/stock, order book totals and a 90-day sparkline.
 * The one copy used by both the market scanner and the recipe detail. In the market scanner it is
 * the 360px side card of an opened row (full width below lg). In the recipe detail it closes the
 * single column, full width, and is drawn `nested`: a Taviraj title over a bordered block, like
 * the detail's other sections, instead of a card inside the card around it.
 *
 * `headingAs` keeps the outline in order: h4 beside the scanner's h4 evidence card, h3 after the
 * recipe detail's h3 sections.
 */
export function MarketPanel({
  id,
  name,
  price,
  stock,
  market,
  nested = false,
  headingAs: Heading = "h4",
}: {
  id: number;
  name: string;
  price: number | undefined;
  stock: number | undefined;
  market: boolean;
  nested?: boolean;
  headingAs?: "h3" | "h4";
}) {
  // `key` is the load the answer belongs to (item + attempt), so a stale one reads as loading
  const [state, setState] = useState<{ key: string; detail: MarketDetail | null; problem: FetchProblem | null } | null>(null);
  // ลองใหม่ bumps this to load again
  const [attempt, setAttempt] = useState(0);
  const loadKey = `${id}:${attempt}`;
  const headingId = useId();

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
  const above = price !== undefined && price > avg;

  const title = `ตลาด: ${name}`;
  const body = !market ? (
    <p className="flex items-start gap-2 p-4 text-sm text-muted">
      <Icon name="ban" className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
      ไอเท็มนี้ซื้อขายในตลาดกลางไม่ได้
    </p>
  ) : (
    <div className="space-y-4 p-4 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <Stat label="ราคาตอนนี้" value={price !== undefined ? silver(price) : "-"} />
        <Stat label="ของค้างขาย" value={stock !== undefined ? silver(stock) : "-"} />
        <Stat label="รอซื้อ (ทุกช่วงราคา)" value={detail ? silver(buyers) : loading ? PENDING : "-"} />
        <Stat label="รอขาย (ทุกช่วงราคา)" value={detail ? silver(sellers) : loading ? PENDING : "-"} />
      </div>
      {problem ? (
        // a failed load is not "no history": say what happened and offer ลองใหม่ / ล็อกอินใหม่
        <Notice tone="warn" action={problemAction(problem, retry)}>
          โหลดราคาย้อนหลังไม่สำเร็จ: {problem.message}
        </Notice>
      ) : series.length > 1 ? (
        <div>
          <Sparkline data={series} />
          {/* low / average / high, under the line they describe */}
          <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
            <div className="min-w-0">
              <dt className="text-muted">ต่ำสุด 90 วัน</dt>
              <dd className="num font-medium text-foreground">{silverShort(min)}</dd>
            </div>
            <div className="min-w-0 text-center">
              <dt className="text-muted">เฉลี่ย</dt>
              <dd className="num font-medium text-foreground">{silverShort(avg)}</dd>
            </div>
            <div className="min-w-0 text-right">
              <dt className="text-muted">สูงสุด</dt>
              <dd className="num font-medium text-foreground">{silverShort(max)}</dd>
            </div>
          </dl>
          {price !== undefined && avg > 0 && (
            <div className="mt-3 space-y-2 border-t border-border pt-3 text-xs">
              <p className="flex items-start gap-1.5 text-muted">
                <Icon name={above ? "trending-up" : "trending-down"} className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" />
                <span>
                  ราคาตอนนี้ {above ? "สูงกว่า" : "ต่ำกว่า"}ค่าเฉลี่ย 90 วัน <span className="num font-medium text-foreground">{pct(Math.abs(price / avg - 1))}</span>
                </span>
              </p>
              {/* what the order book says about selling, as a pill: good news (it sells at once) or a caution */}
              {stock === 0 && buyers > 0 ? (
                <p>
                  <Badge tone="good" icon="check" wrap>
                    ของหมด มีคนรอซื้อ ขายได้ทันที
                  </Badge>
                </p>
              ) : (stock ?? 0) > 0 && sellers > buyers ? (
                <p>
                  <Badge tone="warn" icon="alert-triangle" wrap>
                    ของค้างขายเยอะ อาจขายช้า
                  </Badge>
                </p>
              ) : null}
            </div>
          )}
        </div>
      ) : loading ? (
        <div>
          <div aria-hidden className="skeleton h-14 w-full rounded-lg" />
          <p className="mt-2 text-xs text-faint">กำลังโหลดราคาย้อนหลัง…</p>
        </div>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <Icon name="clock" className="h-3.5 w-3.5 shrink-0 text-faint" />
          ไม่มีข้อมูลราคาย้อนหลัง
        </p>
      )}
    </div>
  );

  if (nested) {
    return (
      <aside aria-labelledby={headingId}>
        <Heading id={headingId} className="mb-2 font-display text-title font-semibold text-balance text-foreground">
          {title}
        </Heading>
        <div className="rounded-xl border border-border">{body}</div>
      </aside>
    );
  }
  return (
    <Card as="aside" aria-labelledby={headingId} className="self-start">
      <CardHeader as={Heading} id={headingId} icon="chart" title={title} />
      {body}
    </Card>
  );
}
