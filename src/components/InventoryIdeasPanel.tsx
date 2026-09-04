"use client";

import { useEffect, useMemo, useState } from "react";
import { ideasFromInventory } from "@/lib/engine/ideas";
import type { Item, ItemId, MarketPrice, Recipe } from "@/lib/engine/types";
import { InventoryIdeas } from "./InventoryIdeas";
import { Loading } from "./Loading";
import { useInventory, useSettings } from "./UserDataProvider";

interface DataResponse {
  recipes: Recipe[];
  items: Record<ItemId, Item>;
}

/** Self-contained "what can I make from my inventory" box for the inventory page. */
export function InventoryIdeasPanel() {
  const [settings] = useSettings();
  const inventory = useInventory();
  const [data, setData] = useState<DataResponse | null>(null);
  const [prices, setPrices] = useState<Record<ItemId, MarketPrice> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/data", { cache: "no-cache" })
      .then((r) => (r.ok ? (r.json() as Promise<DataResponse>) : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setData)
      .catch((e: Error) => setError(e.message));
    fetch("/api/prices?ids=all")
      .then((r) => (r.ok ? (r.json() as Promise<{ prices: Record<ItemId, MarketPrice> }>) : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => setPrices(j.prices))
      .catch((e: Error) => setError(e.message));
  }, []);

  const ideas = useMemo(
    () => (data && prices ? ideasFromInventory({ recipes: data.recipes, items: data.items, prices, inventory, settings }) : []),
    [data, prices, inventory, settings],
  );
  const ownedCount = Object.values(inventory).filter((v) => v && v.qty > 0).length;

  return (
    <section className="mt-6 rounded-lg border border-border bg-panel">
      <header className="border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-semibold text-accent">ทำอะไรได้จากของในคลัง</h2>
        <p className="text-[11px] text-muted">
          สูตรที่ทำได้ทันทีด้วยของที่มี ไม่ต้องซื้อเพิ่ม (นับวัตถุดิบทดแทนให้) · &ldquo;กำไร&rdquo; = ขายผลผลิตหลังหักภาษี − มูลค่าวัตถุดิบที่ใช้ไปถ้าขายตรง ๆ แทน
        </p>
      </header>
      {error ? (
        <p className="px-4 py-4 text-sm text-bad">โหลดข้อมูลไม่สำเร็จ: {error}</p>
      ) : ownedCount === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted">เพิ่มของที่มีเข้าคลังก่อน แล้วระบบจะบอกว่าเอาไปทำอะไรได้กำไรสุด</p>
      ) : !data || !prices ? (
        <Loading text="กำลังคำนวณจากของในคลัง…" className="border-0" />
      ) : (
        <InventoryIdeas ideas={ideas} items={data.items} emptyText="ของที่มีตอนนี้ยังประกอบเป็นสูตรไหนไม่ครบ (ต้องมีวัตถุดิบครบทุกอย่างของสูตร)" />
      )}
    </section>
  );
}
