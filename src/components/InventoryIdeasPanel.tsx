"use client";

import { useEffect, useMemo, useState } from "react";
import { ideasFromInventory } from "@/lib/engine/ideas";
import type { Item, ItemId, MarketPrice, Recipe } from "@/lib/engine/types";
import { describeError, fetchJson, problemAction, type FetchProblem } from "@/lib/fetch-error";
import { InventoryIdeas } from "./InventoryIdeas";
import { useInventory, useSettings, useUserData } from "./UserDataProvider";
import { Card, CardHeader } from "./ui/Card";
import { EmptyState } from "./ui/EmptyState";
import { Notice } from "./ui/Notice";
import { SkeletonList } from "./ui/Skeleton";

interface DataResponse {
  recipes: Recipe[];
  items: Record<ItemId, Item>;
}

/** Self-contained "what can I make from my inventory" box for the inventory page. */
export function InventoryIdeasPanel() {
  const [settings] = useSettings();
  const inventory = useInventory();
  // false while a guest's inventory has not been read from this browser yet
  const { ready } = useUserData();
  const [data, setData] = useState<DataResponse | null>(null);
  const [prices, setPrices] = useState<Record<ItemId, MarketPrice> | null>(null);
  const [problem, setProblem] = useState<FetchProblem | null>(null);
  const [attempt, setAttempt] = useState(0);

  // State is only touched inside promise callbacks so the effect body stays pure. A retry loads
  // whichever of the two is still missing.
  useEffect(() => {
    if (!data) {
      fetchJson<DataResponse>("/api/data", { cache: "no-cache" })
        .then(setData)
        .catch((e) => setProblem(describeError(e)));
    }
    if (!prices) {
      fetchJson<{ prices: Record<ItemId, MarketPrice> }>("/api/prices?ids=all")
        .then((j) => setPrices(j.prices))
        .catch((e) => setProblem(describeError(e)));
    }
    // data and prices are read once per attempt, not on every change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const ideas = useMemo(
    () => (data && prices ? ideasFromInventory({ recipes: data.recipes, items: data.items, prices, inventory, settings }) : []),
    [data, prices, inventory, settings],
  );
  const ownedCount = Object.values(inventory).filter((v) => v && v.qty > 0).length;
  const retry = () => {
    setProblem(null);
    setAttempt((a) => a + 1);
  };

  return (
    <Card className="mt-6">
      <CardHeader
        title="ทำอะไรได้จากของในคลัง"
        hint={<>สูตรที่ทำได้ทันทีด้วยของที่มี ไม่ต้องซื้อเพิ่ม (นับวัตถุดิบทดแทนให้) · &ldquo;กำไร&rdquo; = ขายผลผลิตหลังหักภาษี − มูลค่าวัตถุดิบที่ใช้ไปถ้าขายตรง ๆ แทน</>}
      />
      {problem ? (
        <div className="p-4">
          <Notice tone="bad" action={problemAction(problem, retry)}>
            โหลดข้อมูลไม่สำเร็จ: {problem.message}
          </Notice>
        </div>
      ) : ready && ownedCount === 0 ? (
        <EmptyState title="เพิ่มของที่มีเข้าคลังก่อน แล้วระบบจะบอกว่าเอาไปทำอะไรได้กำไรสุด" />
      ) : !ready || !data || !prices ? (
        <SkeletonList n={4} label="กำลังคำนวณจากของในคลัง…" />
      ) : (
        <InventoryIdeas ideas={ideas} items={data.items} emptyText="ของที่มีตอนนี้ยังประกอบเป็นสูตรไหนไม่ครบ (ต้องมีวัตถุดิบครบทุกอย่างของสูตร)" />
      )}
    </Card>
  );
}
