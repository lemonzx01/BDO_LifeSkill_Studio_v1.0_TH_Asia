"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { netRate } from "@/lib/engine/cost";
import { pct, silver, silverShort, timeAgo } from "@/lib/format";
import { mainCategoryLabel, subCategoryLabel } from "@/lib/market/categories";
import type { ScanRow } from "@/lib/market/snapshot";
import { useSettings } from "@/lib/settings";
import type { SessionUser } from "../auth/UserMenu";
import { ItemIcon } from "../ItemIcon";
import { TopNav } from "../TopNav";
import { MarketPanel } from "./MarketPanel";

type SortKey = "roi" | "cheap" | "expensive" | "vol" | "price" | "trades";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "roi", label: "ROI: ซื้อตอนนี้ ขายที่ราคาปกติ" },
  { key: "cheap", label: "ถูกกว่าปกติมากที่สุด" },
  { key: "expensive", label: "แพงกว่าปกติมากที่สุด (ขายของที่มี)" },
  { key: "vol", label: "ซื้อขาย 14 วันมากที่สุด" },
  { key: "trades", label: "ซื้อขายสะสมมากที่สุด" },
  { key: "price", label: "ราคาสูงสุด" },
];
const VOL_OPTIONS = [
  { v: 0, label: "ปริมาณซื้อขาย: ทั้งหมด" },
  { v: 50, label: "ซื้อขาย 14 วัน ≥ 50" },
  { v: 200, label: "ซื้อขาย 14 วัน ≥ 200" },
  { v: 1000, label: "ซื้อขาย 14 วัน ≥ 1,000" },
  { v: 10000, label: "ซื้อขาย 14 วัน ≥ 10,000" },
];
const PAGE = 100;

interface Computed {
  row: ScanRow;
  net: number | null;
  profit: number | null;
  roi: number | null;
  dev: number | null;
  trend7: number | null;
}

export function MarketScanner({
  rows,
  refreshedAt,
  source,
  refreshError,
  user,
}: {
  rows: ScanRow[];
  refreshedAt: string | null;
  source: string | null;
  refreshError: string | null;
  user: SessionUser;
}) {
  const router = useRouter();
  const [settings] = useSettings();
  const rate = netRate(settings);

  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");
  const [minVol, setMinVol] = useState(50);
  const [needStock, setNeedStock] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("roi");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const filterKey = JSON.stringify([query, cat, minVol, needStock, sortKey]);
  const [limitState, setLimitState] = useState({ key: filterKey, limit: PAGE });
  const limit = limitState.key === filterKey ? limitState.limit : PAGE;

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
        return {
          row,
          net,
          profit,
          roi: profit !== null && row.price > 0 ? profit / row.price : null,
          dev: row.avg90 ? row.price / row.avg90 - 1 : null,
          trend7: row.avg7 ? row.price / row.avg7 - 1 : null,
        };
      }),
    [rows, rate],
  );

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = computed.filter((c) => {
      const r = c.row;
      if (cat !== "all" && r.cat !== cat) return false;
      if (minVol > 0 && (r.vol14 ?? 0) < minVol) return false;
      if (needStock && r.stock <= 0) return false;
      if (q && !`${r.th} ${r.en ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const last = (v: number | null) => (v === null ? Number.NEGATIVE_INFINITY : v);
    out.sort((a, b) => {
      switch (sortKey) {
        case "roi":
          return last(b.roi) - last(a.roi);
        case "cheap":
          // most negative deviation first, unknown last
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
    return out;
  }, [computed, query, cat, minVol, needStock, sortKey]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await fetch("/api/market/refresh", { method: "POST" });
      router.refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const withHistory = rows.filter((r) => r.avg90 !== null).length;

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-4 md:px-6">
      <TopNav
        user={user}
        subtitle={`ตลาดกลาง Asia · ${silver(rows.length)} ไอเท็ม · อัปเดต ${refreshedAt ? timeAgo(new Date(refreshedAt).getTime()) : "-"}${source ? ` · แหล่ง ${source}` : ""} · มีประวัติแล้ว ${silver(withHistory)} ไอเท็ม`}
      />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">สแกนตลาด: ของที่ราคาตอนนี้ต่ำกว่าปกติและมีคนซื้อขายจริง</h2>
        <button onClick={refresh} disabled={refreshing} className="rounded border border-border bg-panel px-3 py-1.5 text-sm hover:bg-panel-2 disabled:opacity-50">
          {refreshing ? "กำลังอัปเดต…" : "อัปเดตตลาดตอนนี้"}
        </button>
      </div>

      {refreshError && (
        <div className="mb-3 rounded border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">ดึงข้อมูลตลาดไม่สำเร็จ: {refreshError}</div>
      )}
      {withHistory < rows.length * 0.5 && rows.length > 0 && (
        <div className="mb-3 rounded border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
          ระบบกำลังทยอยเก็บราคาย้อนหลัง 90 วันของแต่ละไอเท็ม (ทุกครั้งที่อัปเดตจะได้เพิ่ม) ค่า &ldquo;เฉลี่ย 90 วัน&rdquo; จะครบขึ้นเรื่อย ๆ ตอนนี้มี {silver(withHistory)} ไอเท็ม
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาชื่อไอเท็ม (ไทย/อังกฤษ)…"
          className="min-w-[200px] flex-1 rounded border border-border bg-panel px-3 py-1.5 text-sm outline-none focus:border-accent"
        />
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="rounded border border-border bg-panel px-2 py-1.5 text-sm">
          <option value="all">หมวด: ทั้งหมด</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {mainCategoryLabel(c.slug)} ({c.n})
            </option>
          ))}
        </select>
        <select value={minVol} onChange={(e) => setMinVol(Number(e.target.value))} className="rounded border border-border bg-panel px-2 py-1.5 text-sm">
          {VOL_OPTIONS.map((o) => (
            <option key={o.v} value={o.v}>
              {o.label}
            </option>
          ))}
        </select>
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="rounded border border-border bg-panel px-2 py-1.5 text-sm">
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              เรียง: {s.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-muted">
          <input type="checkbox" checked={needStock} onChange={(e) => setNeedStock(e.target.checked)} className="accent-accent" />
          เฉพาะที่มีของขายอยู่ (ซื้อได้เลย)
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-panel">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-panel-2 text-xs text-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium">ไอเท็ม</th>
              <th className="px-2 py-2 text-right font-medium">ราคาตอนนี้</th>
              <th className="px-2 py-2 text-right font-medium">เฉลี่ย 90 วัน</th>
              <th className="px-2 py-2 text-right font-medium">เทียบปกติ</th>
              <th className="px-2 py-2 text-right font-medium">กำไรถ้าขายราคาปกติ</th>
              <th className="px-2 py-2 text-right font-medium">ROI</th>
              <th className="px-2 py-2 text-right font-medium">ซื้อขาย 14 วัน</th>
              <th className="px-2 py-2 text-left font-medium">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {list.slice(0, limit).map((c) => (
              <Row key={c.row.id} c={c} rate={rate} open={expanded === c.row.id} onToggle={() => setExpanded(expanded === c.row.id ? null : c.row.id)} />
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted">
                  ไม่พบไอเท็มที่ตรงเงื่อนไข ลองลดปริมาณซื้อขายขั้นต่ำหรือปิด &ldquo;เฉพาะที่มีของขายอยู่&rdquo;
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {list.length > limit && (
        <div className="mt-3 text-center">
          <button onClick={() => setLimitState({ key: filterKey, limit: limit + PAGE })} className="rounded border border-border bg-panel px-4 py-1.5 text-sm hover:bg-panel-2">
            แสดงเพิ่ม ({list.length - limit} รายการ)
          </button>
        </div>
      )}

      <footer className="mt-6 text-xs text-muted">
        กำไรคิดจาก ขายที่ราคาเฉลี่ย 90 วัน × อัตราได้รับจริง {pct(rate, 1)} (ตั้งค่า Value Pack ฯลฯ ที่หน้าคำนวณสูตร) − ราคาซื้อตอนนี้ · ข้อมูล: bdolytics (snapshot) / Pearl Abyss (ราคาย้อนหลัง)
      </footer>
    </main>
  );
}

function Row({ c, rate, open, onToggle }: { c: Computed; rate: number; open: boolean; onToggle: () => void }) {
  const r = c.row;
  const good = (c.profit ?? 0) > 0;
  return (
    <>
      <tr onClick={onToggle} className={`cursor-pointer border-t border-border hover:bg-panel-2/60 ${open ? "bg-panel-2/40" : ""}`}>
        <td className="px-3 py-1.5">
          <div className="flex items-center gap-2">
            <ItemIcon id={r.id} grade={r.grade} size={30} />
            <div className="min-w-0">
              <div className="truncate font-medium">{r.th}</div>
              <div className="truncate text-[11px] text-muted">
                {mainCategoryLabel(r.cat)}
                {r.sub ? ` · ${subCategoryLabel(r.sub)}` : ""}
                {r.days > 0 ? ` · ประวัติ ${r.days} วัน` : " · ยังไม่มีประวัติ"}
              </div>
            </div>
          </div>
        </td>
        <td className="num px-2 py-1.5 text-right">{silver(r.price)}</td>
        <td className="num px-2 py-1.5 text-right text-muted">{r.avg90 !== null ? silver(r.avg90) : "-"}</td>
        <td className={`num px-2 py-1.5 text-right ${c.dev === null ? "text-muted" : c.dev < 0 ? "text-good" : "text-bad"}`}>
          {c.dev === null ? "-" : `${c.dev > 0 ? "+" : ""}${pct(c.dev)}`}
        </td>
        <td className={`num px-2 py-1.5 text-right font-semibold ${c.profit === null ? "text-muted" : good ? "text-good" : "text-bad"}`}>
          {c.profit === null ? "-" : silver(c.profit)}
        </td>
        <td className={`num px-2 py-1.5 text-right ${c.roi === null ? "text-muted" : good ? "text-good" : "text-bad"}`}>{c.roi === null ? "-" : pct(c.roi)}</td>
        <td className="num px-2 py-1.5 text-right">{r.vol14 === null ? "-" : silver(r.vol14)}</td>
        <td className="px-2 py-1.5">
          <div className="flex flex-wrap gap-1">
            {r.stock > 0 ? (
              <span className="whitespace-nowrap rounded bg-sky-500/10 px-1.5 py-0.5 text-[11px] text-sky-300">ค้างขาย {silverShort(r.stock)}</span>
            ) : (
              <span className="whitespace-nowrap rounded bg-good/15 px-1.5 py-0.5 text-[11px] text-good">ขาดตลาด</span>
            )}
            {c.trend7 !== null && Math.abs(c.trend7) >= 0.05 && (
              <span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] ${c.trend7 > 0 ? "bg-good/15 text-good" : "bg-bad/15 text-bad"}`}>
                7 วัน {c.trend7 > 0 ? "▲" : "▼"} {pct(Math.abs(c.trend7))}
              </span>
            )}
          </div>
        </td>
      </tr>
      {open && (
        <tr className="border-t border-border bg-background/40">
          <td colSpan={8} className="px-3 py-3">
            <div className="grid gap-3 lg:grid-cols-[1fr_360px]">
              <div className="text-sm text-muted">
                <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Stat label="ต่ำสุด 90 วัน" value={r.min90 !== null ? silver(r.min90) : "-"} />
                  <Stat label="สูงสุด 90 วัน" value={r.max90 !== null ? silver(r.max90) : "-"} />
                  <Stat label="เฉลี่ย 30 วัน" value={r.avg30 !== null ? silver(r.avg30) : "-"} />
                  <Stat label={`ได้รับสุทธิถ้าขายราคาปกติ (${pct(rate, 1)})`} value={c.net !== null ? silver(c.net) : "-"} />
                </div>
                <p className="text-xs">
                  ซื้อขายสะสม {silver(r.trades)} ครั้ง{r.en ? ` · ${r.en}` : ""} · id {r.id}
                </p>
              </div>
              <MarketPanel id={r.id} name={r.th} price={r.price} stock={r.stock} market />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border bg-panel-2/60 px-2 py-1.5">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="num font-semibold text-foreground">{value}</div>
    </div>
  );
}
