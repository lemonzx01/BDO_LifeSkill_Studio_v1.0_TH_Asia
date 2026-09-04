"use client";

import { rankByName } from "@/lib/search";
import { useEffect, useMemo, useState } from "react";
import type { ItemId, MarketPrice } from "@/lib/engine/types";
import { downloadCsv, parseCsv, toCsv } from "@/lib/csv";
import { silver } from "@/lib/format";
import type { SessionUser } from "./auth/UserMenu";
import { InventoryIdeasPanel } from "./InventoryIdeasPanel";
import { ItemIcon } from "./ItemIcon";
import { NumberInput } from "./NumberInput";
import { TopNav } from "./TopNav";
import { useUserData } from "./UserDataProvider";

export interface ItemLite {
  id: ItemId;
  th: string;
  en: string;
  grade: number;
  market: boolean;
}

/** "คลังของ": everything the member owns, with quantity, recorded cost and current market value. */
export function InventoryManager({ items, user }: { items: ItemLite[]; user: SessionUser }) {
  const { inventory, setOwned, clearInventory } = useUserData();
  const [query, setQuery] = useState("");
  const [prices, setPrices] = useState<Record<ItemId, MarketPrice>>({});
  const [sort, setSort] = useState<"name" | "recent" | "value">("name");
  const [listFilter, setListFilter] = useState("");
  // the row just added from the search box: scrolled into view and tinted for a moment
  const [highlightId, setHighlightId] = useState<ItemId | null>(null);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const owned = useMemo(
    () =>
      Object.entries(inventory)
        .filter(([, v]) => v && v.qty > 0)
        .map(([id, v]) => ({ id: Number(id), qty: v!.qty, avgCost: v!.avgCost, updatedAt: v!.updatedAt ?? 0 }))
        .sort((a, b) => (byId.get(a.id)?.th ?? "").localeCompare(byId.get(b.id)?.th ?? "", "th")),
    [inventory, byId],
  );
  const ownedKey = owned.map((o) => o.id).join(",");

  /** rows actually shown: filtered by the list search box and ordered by the chosen sort */
  const visible = useMemo(() => {
    const f = listFilter.trim().toLowerCase();
    const list = f ? owned.filter((o) => `${byId.get(o.id)?.th ?? ""} ${byId.get(o.id)?.en ?? ""}`.toLowerCase().includes(f)) : owned.slice();
    if (sort === "recent") list.sort((a, b) => b.updatedAt - a.updatedAt);
    else if (sort === "value") list.sort((a, b) => b.qty * (prices[b.id]?.price ?? 0) - a.qty * (prices[a.id]?.price ?? 0));
    return list;
  }, [owned, byId, listFilter, sort, prices]);

  useEffect(() => {
    if (highlightId === null) return;
    document.getElementById(`inv-${highlightId}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    const t = setTimeout(() => setHighlightId(null), 4000);
    return () => clearTimeout(t);
  }, [highlightId]);

  useEffect(() => {
    if (!ownedKey) return;
    fetch(`/api/prices?ids=${ownedKey}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((json: { prices: Record<ItemId, MarketPrice> }) => setPrices(json.prices))
      .catch(() => {});
  }, [ownedKey]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return rankByName(items, q, 12 + Object.keys(inventory).length).filter((i) => !inventory[i.id]).slice(0, 12);
  }, [query, items, inventory]);

  const totalValue = owned.reduce((a, o) => a + o.qty * (prices[o.id]?.price ?? 0), 0);
  const totalCost = owned.reduce((a, o) => a + o.qty * (o.avgCost ?? prices[o.id]?.price ?? 0), 0);
  const customCount = owned.filter((o) => o.avgCost !== undefined).length;
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const exportCsv = () => {
    const rows = owned.map((o) => {
      const it = byId.get(o.id);
      return [o.id, it?.th ?? "", it?.en ?? "", o.qty, o.avgCost ?? ""];
    });
    downloadCsv(`bdo-inventory-${new Date().toISOString().slice(0, 10)}.csv`, toCsv([["id", "ชื่อไทย", "ชื่ออังกฤษ", "จำนวน", "ต้นทุน/ชิ้น"], ...rows]));
  };

  /** Accepts our export, or any CSV with a name/id column plus a quantity column (e.g. the old Excel sheet). */
  const importCsv = async (file: File) => {
    const rows = parseCsv(await file.text());
    if (rows.length < 2) {
      setImportMsg("ไฟล์ว่างหรืออ่านไม่ได้");
      return;
    }
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const col = (...names: string[]) => header.findIndex((h) => names.some((n) => h === n || h.includes(n)));
    const idCol = col("id", "รหัส");
    const nameCol = col("ชื่อไทย", "ชื่อไอเท็ม", "ชื่อ", "name");
    const enCol = col("ชื่ออังกฤษ", "english");
    const qtyCol = col("จำนวน", "qty", "quantity");
    const costCol = col("ต้นทุน", "cost", "avg");
    if (qtyCol < 0 || (idCol < 0 && nameCol < 0)) {
      setImportMsg("ต้องมีคอลัมน์ จำนวน และ id หรือ ชื่อไอเท็ม");
      return;
    }
    const byTh = new Map(items.map((i) => [i.th.trim().toLowerCase(), i.id]));
    const byEn = new Map(items.map((i) => [i.en.trim().toLowerCase(), i.id]));
    let ok = 0;
    const missing: string[] = [];
    for (const r of rows.slice(1)) {
      const qty = Number(String(r[qtyCol] ?? "").replace(/[^\d.]/g, ""));
      if (!Number.isFinite(qty)) continue;
      let id = idCol >= 0 ? Number(r[idCol]) : NaN;
      if (!Number.isInteger(id) || !byId.has(id)) {
        const th = nameCol >= 0 ? String(r[nameCol] ?? "").trim().toLowerCase() : "";
        const en = enCol >= 0 ? String(r[enCol] ?? "").trim().toLowerCase() : "";
        id = byTh.get(th) ?? byEn.get(en) ?? byEn.get(th) ?? NaN;
      }
      if (!Number.isInteger(id)) {
        if (nameCol >= 0 && r[nameCol]) missing.push(String(r[nameCol]));
        continue;
      }
      const cost = costCol >= 0 ? Number(String(r[costCol] ?? "").replace(/[^\d.]/g, "")) : NaN;
      setOwned(id, Math.max(0, Math.floor(qty)), Number.isFinite(cost) && cost > 0 ? cost : undefined);
      ok += 1;
    }
    setImportMsg(`นำเข้า ${ok} รายการ${missing.length ? ` · ไม่พบชื่อ ${missing.length} รายการ: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}` : ""}`);
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-3 py-4 md:px-6">
      <TopNav user={user} subtitle="ของที่มีอยู่ ใช้หักออกจากวัตถุดิบที่ต้องซื้อในแผนผลิต และคิดต้นทุนตามที่ตั้งค่า" />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">คลังของ ({owned.length} รายการ)</h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="cursor-pointer rounded border border-border bg-panel px-3 py-1.5 text-sm hover:bg-panel-2">
            นำเข้า CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importCsv(f);
                e.target.value = "";
              }}
            />
          </label>
          <button onClick={exportCsv} disabled={owned.length === 0} className="rounded border border-border bg-panel px-3 py-1.5 text-sm hover:bg-panel-2 disabled:opacity-50">
            ส่งออก CSV
          </button>
          {customCount > 0 && (
            <button
              onClick={() => {
                for (const o of owned) if (o.avgCost !== undefined) setOwned(o.id, o.qty, null);
              }}
              className="rounded border border-border bg-panel px-3 py-1.5 text-sm hover:bg-panel-2"
              title="เปลี่ยนต้นทุนทุกรายการให้ใช้ราคาตลาดปัจจุบันเสมอ"
            >
              ต้นทุนทั้งหมดตามตลาด
            </button>
          )}
          {owned.length > 0 && (
            <button
              onClick={() => {
                if (confirm("ล้างคลังทั้งหมด?")) clearInventory();
              }}
              className="rounded border border-bad/40 bg-bad/10 px-3 py-1.5 text-sm text-bad hover:bg-bad/20"
            >
              ล้างทั้งหมด
            </button>
          )}
        </div>
      </div>
      {importMsg && <div className="mb-3 rounded border border-border bg-panel px-3 py-2 text-sm text-muted">{importMsg}</div>}

      <div className="relative mb-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="พิมพ์ชื่อไอเท็มเพื่อเพิ่มเข้าคลัง…"
          className="w-full rounded border border-border bg-panel px-3 py-2 text-sm outline-none focus:border-accent"
        />
        {matches.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded border border-border bg-panel shadow-lg">
            {matches.map((m) => (
              <li key={m.id}>
                <button
                  onClick={() => {
                    setOwned(m.id, 1);
                    setQuery("");
                    setListFilter("");
                    setHighlightId(m.id);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-panel-2"
                >
                  <ItemIcon id={m.id} grade={m.grade} size={22} />
                  <span className="flex-1 truncate">{m.th}</span>
                  <span className="truncate text-xs text-muted">{m.en}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {owned.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
          <input
            value={listFilter}
            onChange={(e) => setListFilter(e.target.value)}
            placeholder="ค้นหาในคลัง…"
            className="w-52 rounded border border-border bg-panel px-2 py-1 text-sm outline-none focus:border-accent"
          />
          <span className="text-xs text-muted">เรียงตาม</span>
          {(
            [
              ["name", "ชื่อ"],
              ["recent", "เพิ่ม/แก้ล่าสุด"],
              ["value", "มูลค่า"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setSort(k)}
              className={`rounded border px-2 py-0.5 text-xs ${sort === k ? "border-accent bg-accent/15 text-foreground" : "border-border bg-panel text-muted hover:bg-panel-2"}`}
            >
              {label}
            </button>
          ))}
          {listFilter && (
            <span className="text-xs text-muted">
              แสดง {visible.length} จาก {owned.length}
            </span>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-panel">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-panel-2 text-xs text-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium">ไอเท็ม</th>
              <th className="px-2 py-2 text-right font-medium">จำนวน</th>
              <th className="px-2 py-2 text-right font-medium">ต้นทุน/ชิ้น</th>
              <th className="px-2 py-2 text-right font-medium">ราคาตลาดตอนนี้</th>
              <th className="px-2 py-2 text-right font-medium">มูลค่าตลาด</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {visible.map((o) => {
              const it = byId.get(o.id);
              const price = prices[o.id]?.price ?? 0;
              return (
                <tr key={o.id} id={`inv-${o.id}`} className={`border-t border-border transition-colors ${highlightId === o.id ? "bg-accent/15" : ""}`}>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <ItemIcon id={o.id} grade={it?.grade} size={26} />
                      <div className="min-w-0">
                        <div className="truncate">{it?.th ?? `#${o.id}`}</div>
                        <div className="truncate text-[11px] text-muted">{it?.en}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <NumberInput
                      min={0}
                      value={o.qty}
                      commitOnBlur
                      title="พิมพ์จำนวนแล้วกด Enter หรือคลิกออกจากช่อง · ใส่ 0 = เอาออกจากคลัง"
                      onChange={(v) => setOwned(o.id, Math.floor(v), o.avgCost)}
                      className="num w-24 rounded border border-border bg-panel-2 px-2 py-0.5 text-right"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {o.avgCost === undefined ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="num text-muted">{price ? silver(price) : "-"}</span>
                        <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-300" title="ใช้ราคาตลาดปัจจุบันเสมอ">
                          ตามตลาด
                        </span>
                        <button onClick={() => setOwned(o.id, o.qty, price || 0)} className="text-[11px] text-muted hover:text-foreground" title="กำหนดต้นทุนที่จ่ายจริงเอง">
                          กำหนดเอง
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1.5">
                        <NumberInput
                          min={0}
                          value={o.avgCost}
                          commitOnBlur
                          onChange={(v) => setOwned(o.id, o.qty, v)}
                          className="num w-28 rounded border border-border bg-panel-2 px-2 py-0.5 text-right"
                        />
                        <button onClick={() => setOwned(o.id, o.qty, null)} className="text-[11px] text-muted hover:text-foreground" title="กลับไปใช้ราคาตลาดเสมอ">
                          ตามตลาด
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="num px-2 py-1.5 text-right text-muted">{price ? silver(price) : it?.market ? "…" : "ไม่มีในตลาด"}</td>
                  <td className="num px-2 py-1.5 text-right font-medium">{silver(o.qty * price)}</td>
                  <td className="px-2 py-1.5 text-right">
                    <button onClick={() => setOwned(o.id, 0)} className="text-xs text-muted hover:text-bad">
                      ลบ
                    </button>
                  </td>
                </tr>
              );
            })}
            {owned.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted">
                  ยังไม่มีของในคลัง พิมพ์ชื่อไอเท็มด้านบนเพื่อเพิ่ม หรือกรอกช่อง &ldquo;มีอยู่แล้ว&rdquo; ในแผนผลิต
                </td>
              </tr>
            )}
            {owned.length > 0 && visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted">
                  ไม่มีรายการในคลังที่ตรงกับ &ldquo;{listFilter}&rdquo;
                </td>
              </tr>
            )}
          </tbody>
          {owned.length > 0 && (
            <tfoot>
              <tr className="border-t border-border font-semibold">
                <td className="px-3 py-2" colSpan={2}>
                  รวม
                </td>
                <td className="num px-2 py-2 text-right">{totalCost ? silver(totalCost) : "-"}</td>
                <td />
                <td className="num px-2 py-2 text-right">{silver(totalValue)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">
        ต้นทุน/ชิ้น: &ldquo;ตามตลาด&rdquo; = ใช้ราคาตลาดปัจจุบันเสมอ (ค่าเริ่มต้น) · &ldquo;กำหนดเอง&rdquo; = ใส่ราคาที่จ่ายจริง ใช้เมื่อตั้งค่า &ldquo;ของที่มีอยู่แล้ว
        คิดต้นทุน = ตามที่บันทึก&rdquo; · ช่องจำนวน: พิมพ์แล้วกด Enter หรือคลิกออก
      </p>
      <InventoryIdeasPanel />
    </main>
  );
}
