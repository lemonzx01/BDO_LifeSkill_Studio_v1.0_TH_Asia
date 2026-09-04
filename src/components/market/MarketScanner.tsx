"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { netRate } from "@/lib/engine/cost";
import { pct, silver, silverShort } from "@/lib/format";
import { mainCategoryLabel, subCategoryLabel } from "@/lib/market/categories";
import { assessRecovery, sellEvidence, type Assessment, type EvidenceLine } from "@/lib/market/evidence";
import type { ScanRow } from "@/lib/market/snapshot";
import type { SessionUser } from "../auth/UserMenu";
import { ItemIcon } from "../ItemIcon";
import { TimeAgo } from "../TimeAgo";
import { TopNav } from "../TopNav";
import { useSettings } from "../UserDataProvider";
import { MarketPanel } from "./MarketPanel";

type SortKey = "roi" | "cheap" | "expensive" | "vol" | "price" | "trades";
type Mode = "all" | "trade" | "buy" | "sell";
type Signal = "trade" | "buy" | "sell" | null;

const MODES: { key: Mode; label: string; hint: string }[] = [
  { key: "all", label: "ดูทั้งหมด", hint: "ทุกไอเท็มในตลาด" },
  { key: "trade", label: "หาของเทรด", hint: "ซื้อตอนนี้ แล้วตั้งขายที่ราคาปกติ ยังได้กำไรหลังหักภาษี" },
  { key: "buy", label: "ซื้อของถูก", hint: "ราคาต่ำกว่าปกติ และหลักฐานชี้ว่ามีโอกาสฟื้น (ดูรายละเอียดในแต่ละแถว)" },
  { key: "sell", label: "ขายของที่มี", hint: "ราคาตอนนี้สูงกว่าปกติ ถ้ามีของอยู่ควรปล่อยตอนนี้" },
];
const SORTS: { key: SortKey; label: string }[] = [
  { key: "roi", label: "กำไรเทรด (ROI)" },
  { key: "cheap", label: "ถูกกว่าปกติมากที่สุด" },
  { key: "expensive", label: "แพงกว่าปกติมากที่สุด" },
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
const LIQUID_MIN_VOL = 50;

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

const LEVEL_CLS: Record<Assessment["level"], string> = {
  สูง: "bg-good/15 text-good",
  ปานกลาง: "bg-warn/15 text-warn",
  ต่ำ: "bg-bad/15 text-bad",
  ไม่พอข้อมูล: "bg-panel-2 text-muted",
};

function signalText(c: Computed): { text: string; cls: string } | null {
  if (c.signal === "trade") return { text: `เทรดได้ +${pct(c.roi ?? 0)}`, cls: "bg-good/15 text-good" };
  if (c.signal === "buy") return { text: `ถูกกว่าปกติ ${pct(Math.abs(c.dev ?? 0))} · โอกาสฟื้น ${c.assess.level}`, cls: "bg-sky-500/15 text-sky-300" };
  if (c.signal === "sell") return { text: `น่าขายตอนนี้ แพงกว่าปกติ ${pct(c.dev ?? 0)}`, cls: "bg-accent/15 text-accent" };
  return null;
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

  const [mode, setMode] = useState<Mode>("all");
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");
  const [minVol, setMinVol] = useState(50);
  const [needStock, setNeedStock] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("roi");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const filterKey = JSON.stringify([mode, query, cat, minVol, needStock, sortKey]);
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

  const picks = useMemo(
    () => ({
      trade: computed.filter((c) => c.signal === "trade").sort((a, b) => (b.roi ?? 0) - (a.roi ?? 0)).slice(0, 10),
      buy: computed
        .filter((c) => c.signal === "buy")
        .sort((a, b) => b.assess.score - a.assess.score || (a.dev ?? 0) - (b.dev ?? 0))
        .slice(0, 10),
      sell: computed.filter((c) => c.signal === "sell").sort((a, b) => (b.dev ?? 0) - (a.dev ?? 0)).slice(0, 10),
    }),
    [computed],
  );

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = computed.filter((c) => {
      const r = c.row;
      if (mode !== "all" && c.signal !== mode) return false;
      if (cat !== "all" && r.cat !== cat) return false;
      if (minVol > 0 && (r.vol14 ?? 0) < minVol) return false;
      if (needStock && mode !== "sell" && r.stock <= 0) return false;
      if (q && !`${r.th} ${r.en ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const last = (v: number | null) => (v === null ? Number.NEGATIVE_INFINITY : v);
    const key: SortKey = mode === "buy" && sortKey === "roi" ? "cheap" : mode === "sell" && sortKey === "roi" ? "expensive" : sortKey;
    out.sort((a, b) => {
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
    return out;
  }, [computed, mode, query, cat, minVol, needStock, sortKey]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await fetch("/api/market/refresh", { method: "POST" });
      router.refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const focus = (c: Computed) => {
    setMode("all");
    setQuery(c.row.th);
    setNeedStock(false);
    setMinVol(0);
    setExpanded(c.row.id);
  };

  const withHistory = rows.filter((r) => r.avg90 !== null).length;
  const modeInfo = MODES.find((m) => m.key === mode)!;

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-4 md:px-6">
      <TopNav
        user={user}
        subtitle={
          <>
            ตลาดกลาง Asia · {silver(rows.length)} ไอเท็ม · อัปเดต <TimeAgo at={refreshedAt} placeholder="-" />
            {source ? ` · แหล่ง ${source}` : ""} · มีประวัติแล้ว {silver(withHistory)} ไอเท็ม
          </>
        }
      />

      {refreshError && <div className="mb-3 rounded border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">ดึงข้อมูลตลาดไม่สำเร็จ: {refreshError}</div>}
      {withHistory < rows.length * 0.5 && rows.length > 0 && (
        <div className="mb-3 rounded border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
          ระบบกำลังทยอยเก็บราคาย้อนหลัง 90 วันของแต่ละไอเท็ม (ทุกครั้งที่เปิดหน้านี้จะได้เพิ่ม) คำแนะนำจะแม่นขึ้นเมื่อครบ ตอนนี้มี {silver(withHistory)} ไอเท็ม
        </div>
      )}

      {/* today's picks */}
      <section className="mb-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">แนะนำวันนี้</h2>
            <p className="text-xs text-muted">
              ดูจากราคา ของค้างขาย และยอดซื้อขายเท่านั้น ระบบ<b>ไม่รู้</b>อีเวนต์ แพตช์ หรือของแจกล่วงหน้า กดแต่ละรายการเพื่อดูหลักฐานแล้วตัดสินใจเอง
            </p>
          </div>
          <button onClick={refresh} disabled={refreshing} className="rounded border border-border bg-panel px-3 py-1.5 text-sm hover:bg-panel-2 disabled:opacity-50">
            {refreshing ? "กำลังอัปเดต…" : "อัปเดตตลาดตอนนี้"}
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <PickList
            title="เทรดได้กำไร"
            hint="ซื้อตอนนี้ แล้วตั้งขายที่ราคาปกติ (เฉลี่ย 90 วัน) หักภาษีแล้วยังบวก"
            empty="ตอนนี้ยังไม่มีของที่ซื้อแล้วขายราคาปกติได้กำไร"
            items={picks.trade}
            metric={(c) => `+${pct(c.roi ?? 0)}`}
            metricCls="text-good"
            onPick={focus}
          />
          <PickList
            title="ราคาต่ำ มีโอกาสฟื้น"
            hint="ราคาต่ำกว่าปกติ 10% ขึ้นไป และหลักฐาน (ค้างขายลด ขายเร็ว เริ่มเงย) ชี้ว่าน่าจะกลับขึ้น"
            empty="ไม่มีของที่ราคาต่ำและหลักฐานพอตอนนี้"
            items={picks.buy}
            metric={(c) => `โอกาสฟื้น ${c.assess.level} ${c.assess.score} · ถูกกว่า ${pct(Math.abs(c.dev ?? 0))}`}
            metricCls="text-sky-300"
            onPick={focus}
          />
          <PickList
            title="น่าขายตอนนี้"
            hint="ราคาสูงกว่าปกติ 15% ขึ้นไป ถ้ามีของอยู่ในคลังควรปล่อย"
            empty="ไม่มีของที่แพงผิดปกติตอนนี้"
            items={picks.sell}
            metric={(c) => `แพงกว่าปกติ ${pct(c.dev ?? 0)}`}
            metricCls="text-accent"
            onPick={focus}
          />
        </div>
      </section>

      {/* mode */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">ฉันอยากจะ:</span>
        <div className="flex flex-wrap gap-1 rounded border border-border bg-panel p-0.5">
          {MODES.map((m) => (
            <button key={m.key} onClick={() => setMode(m.key)} className={`rounded px-3 py-1.5 text-sm ${mode === m.key ? "bg-accent text-black" : "text-muted hover:text-foreground"}`}>
              {m.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted">{modeInfo.hint}</span>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาชื่อไอเท็ม…"
          className="min-w-[200px] flex-1 rounded border border-border bg-panel px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="rounded border border-border bg-panel px-2 py-2 text-sm">
          <option value="all">หมวด: ทั้งหมด</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {mainCategoryLabel(c.slug)} ({c.n})
            </option>
          ))}
        </select>
        <select value={minVol} onChange={(e) => setMinVol(Number(e.target.value))} className="rounded border border-border bg-panel px-2 py-2 text-sm">
          {VOL_OPTIONS.map((o) => (
            <option key={o.v} value={o.v}>
              {o.label}
            </option>
          ))}
        </select>
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="rounded border border-border bg-panel px-2 py-2 text-sm">
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              เรียง: {s.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-muted">
          <input type="checkbox" checked={needStock} onChange={(e) => setNeedStock(e.target.checked)} className="h-4 w-4 accent-accent" />
          เฉพาะที่มีของขายอยู่
        </label>
      </div>

      {/* phones: cards */}
      <div className="space-y-2 md:hidden">
        {list.slice(0, limit).map((c) => (
          <MarketCard key={c.row.id} c={c} rate={rate} open={expanded === c.row.id} onToggle={() => setExpanded(expanded === c.row.id ? null : c.row.id)} />
        ))}
        {list.length === 0 && <div className="rounded-lg border border-border bg-panel px-3 py-8 text-center text-muted">ไม่พบไอเท็มที่ตรงเงื่อนไข</div>}
      </div>

      {/* desktop: table */}
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-panel md:block">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-panel-2 text-xs text-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium">ไอเท็ม</th>
              <th className="px-2 py-2 text-right font-medium">ราคาตอนนี้</th>
              <th className="px-2 py-2 text-right font-medium">ราคาปกติ (90 วัน)</th>
              <th className="px-2 py-2 text-right font-medium">เทียบปกติ</th>
              <th className="px-2 py-2 text-right font-medium">กำไรถ้าเทรด</th>
              <th className="px-2 py-2 text-right font-medium">ซื้อขาย 14 วัน</th>
              <th className="px-2 py-2 text-left font-medium">คำแนะนำ</th>
            </tr>
          </thead>
          <tbody>
            {list.slice(0, limit).map((c) => (
              <Row key={c.row.id} c={c} rate={rate} open={expanded === c.row.id} onToggle={() => setExpanded(expanded === c.row.id ? null : c.row.id)} />
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted">
                  ไม่พบไอเท็มที่ตรงเงื่อนไข ลองเปลี่ยนโหมด ลดปริมาณซื้อขายขั้นต่ำ หรือปิด &ldquo;เฉพาะที่มีของขายอยู่&rdquo;
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {list.length > limit && (
        <div className="mt-3 text-center">
          <button onClick={() => setLimitState({ key: filterKey, limit: limit + PAGE })} className="rounded border border-border bg-panel px-4 py-2 text-sm hover:bg-panel-2">
            แสดงเพิ่ม ({list.length - limit} รายการ)
          </button>
        </div>
      )}

      <footer className="mt-6 space-y-1 text-xs text-muted">
        <p>
          <b>ราคาปกติ</b> = ราคาเฉลี่ย 90 วันของไอเท็มนั้น · <b>กำไรถ้าเทรด</b> = ขายที่ราคาปกติ × อัตราได้รับจริง {pct(rate, 1)} − ราคาซื้อตอนนี้ (ราคาต้องขึ้นเกิน{" "}
          {pct(1 / rate - 1)} ถึงคุ้มภาษี)
        </p>
        <p>คำแนะนำนับเฉพาะของที่ซื้อขาย 14 วัน ≥ {LIQUID_MIN_VOL} ชิ้น เพื่อกันของที่ราคาแกว่งเพราะไม่มีคนซื้อขาย · ข้อมูล: bdolytics (snapshot) / Pearl Abyss (ราคาย้อนหลัง)</p>
      </footer>
    </main>
  );
}

function PickList({
  title,
  hint,
  empty,
  items,
  metric,
  metricCls,
  onPick,
}: {
  title: string;
  hint: string;
  empty: string;
  items: Computed[];
  metric: (c: Computed) => string;
  metricCls: string;
  onPick: (c: Computed) => void;
}) {
  return (
    <section className="rounded-lg border border-border bg-panel">
      <header className="border-b border-border px-3 py-2">
        <h3 className="text-sm font-semibold text-accent">{title}</h3>
        <p className="text-[11px] text-muted">{hint}</p>
      </header>
      {items.length === 0 ? (
        <p className="px-3 py-4 text-center text-xs text-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((c) => (
            <li key={c.row.id}>
              <button onClick={() => onPick(c)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-panel-2/60">
                <ItemIcon id={c.row.id} grade={c.row.grade} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{c.row.th}</span>
                  <span className="block truncate text-[11px] text-muted">
                    {silverShort(c.row.price)} · ปกติ {silverShort(c.row.avg90 ?? 0)} · ซื้อขาย {silverShort(c.row.vol14 ?? 0)}/14 วัน
                  </span>
                </span>
                <span className={`num whitespace-nowrap text-xs font-semibold ${metricCls}`}>{metric(c)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Row({ c, rate, open, onToggle }: { c: Computed; rate: number; open: boolean; onToggle: () => void }) {
  const r = c.row;
  const good = (c.profit ?? 0) > 0;
  const sig = signalText(c);
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
        <td className={`num px-2 py-1.5 text-right ${c.profit === null ? "text-muted" : good ? "text-good" : "text-bad"}`}>
          {c.profit === null ? "-" : `${silver(c.profit)} (${pct(c.roi ?? 0)})`}
        </td>
        <td className="num px-2 py-1.5 text-right">{r.vol14 === null ? "-" : silver(r.vol14)}</td>
        <td className="px-2 py-1.5">
          <div className="flex flex-wrap gap-1">
            {sig && <span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] ${sig.cls}`}>{sig.text}</span>}
            {r.stock > 0 ? (
              <span className="whitespace-nowrap rounded bg-panel-2 px-1.5 py-0.5 text-[11px] text-muted">ค้างขาย {silverShort(r.stock)}</span>
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
          <td colSpan={7} className="px-3 py-3">
            <Detail c={c} rate={rate} />
          </td>
        </tr>
      )}
    </>
  );
}

function MarketCard({ c, rate, open, onToggle }: { c: Computed; rate: number; open: boolean; onToggle: () => void }) {
  const r = c.row;
  const sig = signalText(c);
  return (
    <div className={`rounded-lg border bg-panel ${open ? "border-accent/60" : "border-border"}`}>
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-3 py-3 text-left">
        <ItemIcon id={r.id} grade={r.grade} size={40} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{r.th}</div>
          <div className="truncate text-[11px] text-muted">
            {silver(r.price)} · ปกติ {r.avg90 !== null ? silverShort(r.avg90) : "-"} · ซื้อขาย {r.vol14 === null ? "-" : silverShort(r.vol14)}/14 วัน
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {sig && <span className={`rounded px-1.5 py-0.5 text-[11px] ${sig.cls}`}>{sig.text}</span>}
            {r.stock > 0 ? (
              <span className="rounded bg-panel-2 px-1.5 py-0.5 text-[11px] text-muted">ค้างขาย {silverShort(r.stock)}</span>
            ) : (
              <span className="rounded bg-good/15 px-1.5 py-0.5 text-[11px] text-good">ขาดตลาด</span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className={`num text-base font-semibold ${c.dev === null ? "text-muted" : c.dev < 0 ? "text-good" : "text-bad"}`}>
            {c.dev === null ? "-" : `${c.dev > 0 ? "+" : ""}${pct(c.dev)}`}
          </div>
          <div className="text-[11px] text-muted">เทียบปกติ</div>
        </div>
      </button>
      {open && (
        <div className="border-t border-border px-3 py-3">
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

        <div className="mb-2 rounded-lg border border-border bg-panel p-3">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">{sellLines ? "หลักฐานฝั่งขาย" : "หลักฐานว่าจะฟื้น"}</span>
            {!sellLines && (
              <span className={`rounded px-2 py-0.5 text-xs font-semibold ${LEVEL_CLS[a.level]}`}>
                โอกาสฟื้น {a.level}
                {a.level !== "ไม่พอข้อมูล" ? ` ${a.score}/100` : ""}
              </span>
            )}
            {a.daysToClear !== null && a.daysToClear > 0 && <span className="text-xs">ที่ความเร็วขายตอนนี้ ของค้างขายหมดใน ~{Math.max(1, Math.round(a.daysToClear))} วัน</span>}
          </div>
          <EvidenceList lines={sellLines ?? a.lines} />
          <p className="mt-2 text-[11px]">
            คะแนนมาจากตัวเลขในตลาดเท่านั้น ไม่รวมอีเวนต์ แพตช์ หรือของแจก ถ้ารู้ว่ากำลังจะมีอีเวนต์ที่ใช้ของนี้ ให้ถือว่าหลักฐานแรงกว่านี้ ถ้ามีแพตช์เพิ่มแหล่งดรอป ให้ถือว่าอ่อนกว่านี้
          </p>
        </div>

        <p className="text-xs">
          ซื้อขายสะสม {silver(r.trades)} ครั้ง{r.tradesPerDay !== null ? ` (วันละ ~${silver(r.tradesPerDay)})` : ""}
          {r.en ? ` · ${r.en}` : ""} · id {r.id}
        </p>
      </div>
      <MarketPanel id={r.id} name={r.th} price={r.price} stock={r.stock} market />
    </div>
  );
}

function EvidenceList({ lines }: { lines: EvidenceLine[] }) {
  return (
    <ul className="space-y-0.5 text-sm">
      {lines.map((l, i) => (
        <li key={i} className="flex gap-2">
          <span className={`w-4 shrink-0 text-center ${l.ok === true ? "text-good" : l.ok === false ? "text-bad" : "text-muted"}`}>{l.ok === true ? "✓" : l.ok === false ? "✗" : "–"}</span>
          <span className={l.ok === null ? "text-muted" : "text-foreground"}>{l.text}</span>
        </li>
      ))}
    </ul>
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
