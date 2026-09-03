"use client";

import { useEffect, useMemo, useState } from "react";
import type { ItemId, MarketPrice } from "@/lib/engine/types";
import { silver } from "@/lib/format";
import type { SessionUser } from "./auth/UserMenu";
import { ItemIcon } from "./ItemIcon";
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
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const owned = useMemo(
    () =>
      Object.entries(inventory)
        .filter(([, v]) => v && v.qty > 0)
        .map(([id, v]) => ({ id: Number(id), qty: v!.qty, avgCost: v!.avgCost }))
        .sort((a, b) => (byId.get(a.id)?.th ?? "").localeCompare(byId.get(b.id)?.th ?? "", "th")),
    [inventory, byId],
  );
  const ownedKey = owned.map((o) => o.id).join(",");

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
    return items.filter((i) => `${i.th} ${i.en}`.toLowerCase().includes(q) && !inventory[i.id]).slice(0, 12);
  }, [query, items, inventory]);

  const totalValue = owned.reduce((a, o) => a + o.qty * (prices[o.id]?.price ?? 0), 0);
  const totalCost = owned.reduce((a, o) => a + o.qty * (o.avgCost ?? 0), 0);

  return (
    <main className="mx-auto w-full max-w-5xl px-3 py-4 md:px-6">
      <TopNav user={user} subtitle="ของที่มีอยู่ ใช้หักออกจากวัตถุดิบที่ต้องซื้อในแผนผลิต และคิดต้นทุนตามที่ตั้งค่า" />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">คลังของ ({owned.length} รายการ)</h2>
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

      <div className="overflow-x-auto rounded-lg border border-border bg-panel">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-panel-2 text-xs text-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium">ไอเท็ม</th>
              <th className="px-2 py-2 text-right font-medium">จำนวน</th>
              <th className="px-2 py-2 text-right font-medium">ต้นทุน/ชิ้นที่จ่ายไป</th>
              <th className="px-2 py-2 text-right font-medium">ราคาตลาดตอนนี้</th>
              <th className="px-2 py-2 text-right font-medium">มูลค่าตลาด</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {owned.map((o) => {
              const it = byId.get(o.id);
              const price = prices[o.id]?.price ?? 0;
              return (
                <tr key={o.id} className="border-t border-border">
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
                    <input
                      type="number"
                      min={0}
                      value={o.qty}
                      onChange={(e) => setOwned(o.id, Math.max(0, Number(e.target.value) || 0), o.avgCost)}
                      className="num w-24 rounded border border-border bg-panel-2 px-2 py-0.5 text-right"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <input
                      type="number"
                      min={0}
                      value={o.avgCost ?? ""}
                      placeholder={price ? silver(price) : "-"}
                      onChange={(e) => setOwned(o.id, o.qty, e.target.value === "" ? undefined : Math.max(0, Number(e.target.value) || 0))}
                      className="num w-28 rounded border border-border bg-panel-2 px-2 py-0.5 text-right"
                    />
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
        &ldquo;ต้นทุน/ชิ้นที่จ่ายไป&rdquo; ใช้เมื่อตั้งค่า &ldquo;ของที่มีอยู่แล้ว คิดต้นทุน = ตามที่บันทึก&rdquo; ปล่อยว่างได้ถ้าไม่รู้
      </p>
    </main>
  );
}
