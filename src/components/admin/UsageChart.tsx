"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { btn } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Segmented } from "@/components/ui/Segmented";
import { downloadCsv } from "@/lib/csv";
import { columnPath, labelStep, yTicks } from "@/lib/usage/chart";
import { count, dailyCsv, dayLabel } from "@/lib/usage/format";
import type { DailyUsage } from "@/lib/usage/stats";

type Range = "30" | "90";
const RANGES = [
  { value: "30", label: "30 วัน" },
  { value: "90", label: "90 วัน" },
] as const;

const H = 200;
const TOP = 12;
const BOTTOM = 24;
/** room for a 12px count such as "1,000" left of the plot */
const LEFT = 40;
const RIGHT = 4;
/** about half the width of a 12px date such as "30 พ.ย." under the axis */
const EDGE_LABEL_PX = 22;

/**
 * Unique visitors per day as gold columns, for the last 30 or 90 days, with a tooltip per day on
 * hover, tap or arrow keys, the peak and the average written over the chart (also its caption), a
 * table for screen readers and a CSV of the days shown.
 */
export function UsageChart({ daily, today }: { daily: DailyUsage[]; today: string }) {
  const [range, setRange] = useState<Range>("30");
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0]?.contentRect.width ?? 0);
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rows = daily.slice(-Number(range));
  const max = Math.max(0, ...rows.map((r) => r.visitors));
  const ticks = yTicks(max);
  const yMax = ticks[ticks.length - 1];
  const plotW = Math.max(1, width - LEFT - RIGHT);
  const plotH = H - TOP - BOTTOM;
  const band = plotW / rows.length;
  // columns leave a 2px gap between neighbours and never grow past 24px
  const colW = Math.max(1, Math.min(24, band - 2));
  const x = (i: number) => LEFT + i * band + (band - colW) / 2;
  const y = (v: number) => TOP + plotH - (v / yMax) * plotH;
  const every = labelStep(band);

  const total = rows.reduce((s, r) => s + r.visitors, 0);
  const peak = rows.reduce<DailyUsage | null>((best, r) => (r.visitors > 0 && (!best || r.visitors > best.visitors) ? r : best), null);
  const average = (total / rows.length).toFixed(1);
  const summary =
    `ผู้ใช้ต่อวัน ${range} วันล่าสุด ` + (peak ? `สูงสุด ${count(peak.visitors)} คน (${dayLabel(peak.day)}) เฉลี่ย ${average} คนต่อวัน` : "ยังไม่มีผู้ใช้");

  const shown = active !== null && active < rows.length ? active : null;
  const tip = shown !== null ? rows[shown] : null;
  // beside the column, never over it: to its left in the right half of the chart, else to its right
  const tipStyle =
    shown === null ? undefined : x(shown) + colW / 2 > width / 2 ? { right: width - x(shown) + 6 } : { left: x(shown) + colW + 6 };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const last = rows.length - 1;
    const at = shown ?? last;
    const moves: Record<string, number> = { ArrowLeft: at - 1, ArrowRight: at + 1, Home: 0, End: last };
    const next = moves[e.key];
    if (next === undefined) return;
    e.preventDefault();
    setActive(Math.max(0, Math.min(last, next)));
  };

  return (
    <Card>
      <CardHeader icon="chart-bar" title="ผู้ใช้ต่อวัน" hint="นับคนไม่ซ้ำในแต่ละวัน ตามเวลาไทย" />
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
        <Segmented
          label="ช่วงเวลา"
          options={RANGES}
          value={range}
          size="sm"
          onChange={(r) => {
            setRange(r);
            setActive(null);
          }}
        />
        <button type="button" className={btn("ghost", "sm")} onClick={() => downloadCsv(`usage-${range}d-${today}.csv`, dailyCsv(rows))}>
          <Icon name="download" className="h-4 w-4" />
          ดาวน์โหลด CSV
        </button>
      </div>
      <figure className="m-0 px-4 pb-4 pt-3">
        {/* the chart's headline numbers, in words (the first part only for screen readers: the card title says it) */}
        <figcaption className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-muted">
          <span className="sr-only">ผู้ใช้ต่อวัน {range} วันล่าสุด</span>
          {peak ? (
            <>
              <span>
                สูงสุด <span className="num text-sm font-semibold text-foreground">{count(peak.visitors)}</span> คน ({dayLabel(peak.day)})
              </span>
              <span>
                เฉลี่ย <span className="num text-sm font-semibold text-foreground">{average}</span> คนต่อวัน
              </span>
            </>
          ) : (
            <span>ยังไม่มีผู้ใช้</span>
          )}
        </figcaption>
        <div
          ref={boxRef}
          tabIndex={0}
          role="group"
          aria-label={`${summary} กดลูกศรซ้ายขวาเพื่อดูทีละวัน`}
          onKeyDown={onKey}
          onFocus={() => setActive((a) => a ?? rows.length - 1)}
          onBlur={() => setActive(null)}
          onPointerLeave={(e) => {
            if (e.pointerType === "mouse") setActive(null);
          }}
          className="relative rounded-lg focus-visible:outline-offset-4"
        >
          <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} className="block max-w-full" aria-hidden>
            {ticks.map((t) => (
              <g key={t}>
                {/* quiet grid lines; the baseline a step stronger */}
                <line
                  x1={LEFT}
                  x2={width - RIGHT}
                  y1={y(t)}
                  y2={y(t)}
                  className={t === 0 ? "stroke-border-strong" : "stroke-border"}
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
                <text x={LEFT - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-xs tabular-nums">
                  {count(t)}
                </text>
              </g>
            ))}
            {rows.map((r, i) => {
              const h = (r.visitors / yMax) * plotH;
              const labelled = (rows.length - 1 - i) % every === 0;
              // a date under the first or last column is pulled inside the chart instead of being cut off
              const cx = x(i) + colW / 2;
              const anchor = cx + EDGE_LABEL_PX > width - RIGHT ? "end" : cx - EDGE_LABEL_PX < LEFT ? "start" : "middle";
              const labelX = anchor === "end" ? width - RIGHT : anchor === "start" ? LEFT : cx;
              return (
                <g key={r.day}>
                  {r.visitors > 0 && (
                    <path
                      d={columnPath(x(i), y(r.visitors), colW, h)}
                      className={shown === i ? "fill-accent-hover" : shown === null ? "fill-accent" : "fill-accent/50"}
                    />
                  )}
                  {labelled && (
                    <text x={labelX} y={H - 6} textAnchor={anchor} className="fill-muted text-xs">
                      {dayLabel(r.day)}
                    </text>
                  )}
                  {/* the whole height of the day's band answers the pointer, not only the column */}
                  <rect
                    x={LEFT + i * band}
                    y={TOP}
                    width={band}
                    height={plotH}
                    fill="transparent"
                    onPointerEnter={() => setActive(i)}
                    onPointerDown={() => setActive(i)}
                  />
                </g>
              );
            })}
          </svg>
          {tip && (
            <div
              className="pointer-events-none absolute top-0 rounded-lg border border-border-strong bg-panel-3 px-2.5 py-1.5 text-xs whitespace-nowrap shadow-pop"
              style={tipStyle}
            >
              <div className="text-muted">{dayLabel(tip.day, true)}</div>
              <div className="num font-semibold text-foreground">
                {count(tip.visitors)} คน · เปิด {count(tip.views)} หน้า
              </div>
            </div>
          )}
          <p className="sr-only" aria-live="polite">
            {tip ? `${dayLabel(tip.day, true)} ผู้ใช้ ${count(tip.visitors)} คน เปิด ${count(tip.views)} หน้า` : ""}
          </p>
        </div>
        <table className="sr-only">
          <caption>ผู้ใช้ต่อวัน {range} วันล่าสุด</caption>
          <thead>
            <tr>
              <th scope="col">วันที่</th>
              <th scope="col">ผู้ใช้ (คน)</th>
              <th scope="col">เปิดหน้า (ครั้ง)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.day}>
                <td>{dayLabel(r.day, true)}</td>
                <td>{count(r.visitors)}</td>
                <td>{count(r.views)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figure>
    </Card>
  );
}
