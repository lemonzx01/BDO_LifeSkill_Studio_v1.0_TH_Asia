"use client";

import { mergeImportRows, type ImportMode, type ImportRow } from "@/lib/inventory-import";
import { rankByName } from "@/lib/search";
import { useEffect, useMemo, useState } from "react";
import { oneOf, usePersistentState } from "@/lib/use-persistent";
import type { ItemId, MarketPrice } from "@/lib/engine/types";
import { downloadCsv, parseCsv, toCsv } from "@/lib/csv";
import { describeError, fetchJson, isAbort, problemAction, type FetchProblem } from "@/lib/fetch-error";
import { silver } from "@/lib/format";
import { OWNED_COST, OWNED_COST_LABEL, SETTINGS_TITLE } from "@/lib/settings-labels";
import type { SessionUser } from "./auth/UserMenu";
import { InventoryIdeasPanel } from "./InventoryIdeasPanel";
import { ItemIcon } from "./ItemIcon";
import { NumberInput } from "./NumberInput";
import { useUserData } from "./UserDataProvider";
import { Badge } from "./ui/Badge";
import { btn } from "./ui/button";
import { useConfirm } from "./ui/ConfirmDialog";
import { EmptyState } from "./ui/EmptyState";
import { fieldCls, selectCls } from "./ui/field";
import { Notice, type NoticeTone } from "./ui/Notice";
import { Page, PageHeader } from "./ui/Page";
import { SearchInput } from "./ui/SearchInput";
import { Segmented } from "./ui/Segmented";

type InventorySort = "name" | "recent" | "value";
const SORTS: { value: InventorySort; label: string }[] = [
  { value: "name", label: "ชื่อ" },
  { value: "recent", label: "เพิ่ม/แก้ล่าสุด" },
  { value: "value", label: "มูลค่า" },
];

export interface ItemLite {
  id: ItemId;
  th: string;
  en: string;
  grade: number;
  market: boolean;
}

/** "คลังของ": everything the member owns, with quantity, recorded cost and current market value. */
export function InventoryManager({ items, user }: { items: ItemLite[]; user: SessionUser }) {
  const { inventory, setOwned, clearInventory, settings, setSettings } = useUserData();
  const [confirm, confirmDialog] = useConfirm();
  const [query, setQuery] = useState("");
  const [prices, setPrices] = useState<Record<ItemId, MarketPrice>>({});
  // which list of ids the prices were loaded for, and why the last load failed (cells then show "-")
  const [pricesFor, setPricesFor] = useState<string | null>(null);
  const [priceProblem, setPriceProblem] = useState<FetchProblem | null>(null);
  const [priceAttempt, setPriceAttempt] = useState(0);
  const [sort, setSort] = usePersistentState<InventorySort>("inventory.sort", "name", oneOf(["name", "recent", "value"] as const));
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
    const ctl = new AbortController();
    fetchJson<{ prices: Record<ItemId, MarketPrice> }>(`/api/prices?ids=${ownedKey}`, { signal: ctl.signal })
      .then((json) => {
        setPrices(json.prices);
        setPricesFor(ownedKey);
        setPriceProblem(null);
      })
      .catch((e) => {
        if (!isAbort(e)) setPriceProblem(describeError(e));
      });
    return () => ctl.abort();
  }, [ownedKey, priceAttempt]);
  const pricesLoading = !priceProblem && pricesFor !== ownedKey;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return rankByName(items, q, 12 + Object.keys(inventory).length).filter((i) => !inventory[i.id]).slice(0, 12);
  }, [query, items, inventory]);

  const totalValue = owned.reduce((a, o) => a + o.qty * (prices[o.id]?.price ?? 0), 0);
  const totalCost = owned.reduce((a, o) => a + o.qty * (o.avgCost ?? prices[o.id]?.price ?? 0), 0);
  const customCount = owned.filter((o) => o.avgCost !== undefined).length;
  // bad = the file could not be read, warn = some names were not found, good = everything imported
  const [importMsg, setImportMsg] = useState<{ tone: NoticeTone; text: string } | null>(null);
  // "add" lets one CSV per in-game storage be imported one after another and summed up
  const [importMode, setImportMode] = usePersistentState<ImportMode>("inventory.importMode", "replace", oneOf(["replace", "add"] as const));

  const CSV_HEADER = ["id", "ชื่อไทย", "ชื่ออังกฤษ", "จำนวน", "ต้นทุน/ชิ้น"];

  const exportCsv = () => {
    const rows = owned.map((o) => {
      const it = byId.get(o.id);
      return [o.id, it?.th ?? "", it?.en ?? "", o.qty, o.avgCost ?? ""];
    });
    downloadCsv(`bdo-inventory-${new Date().toISOString().slice(0, 10)}.csv`, toCsv([CSV_HEADER, ...rows]));
  };

  /** A filled-in example of the import format: id or Thai name is enough, cost is optional. */
  const downloadTemplate = () => {
    const example = (id: ItemId, qty: number, cost: number | "") => {
      const it = byId.get(id);
      return [id, it?.th ?? "", it?.en ?? "", qty, cost];
    };
    downloadCsv(
      "bdo-inventory-template.csv",
      toCsv([
        CSV_HEADER,
        example(6656, 500, ""), // Purified Water, cost follows the market
        example(6653, 1000, 300), // Bottle of River Water bought at 300 each
        example(6651, 200, ""),
        ["", "ใส่ชื่อไทยแทน id ก็ได้ (ต้องสะกดตรงกับในเว็บ)", "", 10, ""],
      ]),
    );
  };

  /** Accepts our export, or any CSV with a name/id column plus a quantity column (e.g. the old Excel sheet). */
  const importCsv = async (file: File) => {
    const rows = parseCsv(await file.text());
    if (rows.length < 2) {
      setImportMsg({ tone: "bad", text: "ไฟล์ว่างหรืออ่านไม่ได้" });
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
      setImportMsg({ tone: "bad", text: "ต้องมีคอลัมน์ จำนวน และ id หรือ ชื่อไอเท็ม" });
      return;
    }
    const byTh = new Map(items.map((i) => [i.th.trim().toLowerCase(), i.id]));
    const byEn = new Map(items.map((i) => [i.en.trim().toLowerCase(), i.id]));
    let ok = 0;
    const missing: string[] = [];
    const parsed: ImportRow[] = [];
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
      parsed.push({ id, qty, cost: Number.isFinite(cost) && cost > 0 ? cost : undefined });
      ok += 1;
    }
    for (const [id, t] of mergeImportRows(parsed, importMode, inventory)) setOwned(id, t.qty, t.cost);
    setImportMsg({
      tone: missing.length ? "warn" : "good",
      text: `นำเข้า ${ok} รายการ (${importMode === "add" ? "บวกเพิ่มจากที่มี" : "ทับจำนวนเดิม"})${missing.length ? ` · ไม่พบชื่อ ${missing.length} รายการ: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}` : ""}`,
    });
  };

  return (
    <Page user={user} width="narrow">
      <PageHeader
        title={`คลังของ (${owned.length})`}
        description="ของที่มีอยู่ ใช้หักออกจากวัตถุดิบที่ต้องซื้อในแผนผลิต และคิดต้นทุนตามที่ตั้งค่า"
        actions={
          <>
            <select
              value={importMode}
              onChange={(e) => setImportMode(e.target.value as ImportMode)}
              className={selectCls()}
              aria-label="วิธีนำเข้า"
              title="ของที่ซ้ำกับในคลัง: ทับด้วยตัวเลขในไฟล์ หรือบวกเพิ่มจากที่มี (ใช้เมื่อนำเข้าทีละคลังในเกม)"
            >
              <option value="replace">ไฟล์ทับจำนวนเดิม</option>
              <option value="add">ไฟล์บวกเพิ่มจากที่มี</option>
            </select>
            <label className={`${btn("secondary")} cursor-pointer`}>
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
            <button onClick={exportCsv} disabled={owned.length === 0} className={btn("secondary")}>
              ส่งออก CSV
            </button>
            <button onClick={downloadTemplate} className={btn("secondary")} title="ไฟล์ตัวอย่างสำหรับกรอกแล้วนำเข้า">
              ไฟล์ตัวอย่าง CSV
            </button>
            {customCount > 0 && (
              <button
                onClick={() => {
                  for (const o of owned) if (o.avgCost !== undefined) setOwned(o.id, o.qty, null);
                }}
                className={btn("secondary")}
                title="เปลี่ยนต้นทุนทุกรายการให้ใช้ราคาตลาดปัจจุบันเสมอ"
              >
                ต้นทุนทั้งหมดตามตลาด
              </button>
            )}
            {owned.length > 0 && (
              <button
                aria-haspopup="dialog"
                onClick={async () => {
                  const ok = await confirm({
                    title: "ล้างคลังทั้งหมด?",
                    body: "ของทุกรายการด้านล่างจะออกจากคลัง รวมต้นทุนที่กรอกไว้ กู้คืนไม่ได้",
                    details: owned.map((o) => byId.get(o.id)?.th ?? `#${o.id}`),
                    confirmLabel: `ลบ ${owned.length} รายการ`,
                    tone: "danger",
                  });
                  if (ok) clearInventory();
                }}
                className={btn("danger")}
              >
                ล้างทั้งหมด
              </button>
            )}
          </>
        }
      />
      {confirmDialog}
      {customCount > 0 && settings.ownedCostMode !== "avg" && (
        <Notice
          tone="warn"
          className="mb-3"
          action={{ label: "ใช้ราคาที่จ่ายจริง", onClick: () => setSettings({ ...settings, ownedCostMode: "avg" }) }}
        >
          ต้นทุนที่กำหนดเองยังไม่ถูกใช้คิดกำไร · ตอนนี้คิดจาก &ldquo;{OWNED_COST_LABEL[settings.ownedCostMode]}&rdquo;
        </Notice>
      )}
      {importMsg && (
        <Notice tone={importMsg.tone} className="mb-3" onClose={() => setImportMsg(null)}>
          {importMsg.text}
        </Notice>
      )}

      <div className="relative mb-4">
        <SearchInput label="เพิ่มไอเท็มเข้าคลัง" value={query} onChange={setQuery} placeholder="พิมพ์ชื่อไอเท็มเพื่อเพิ่มเข้าคลัง…" className="w-full" />
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
          <SearchInput label="ค้นหาในคลัง" value={listFilter} onChange={setListFilter} placeholder="ค้นหาในคลัง…" className="w-52" />
          <span className="text-xs text-muted">เรียงตาม</span>
          <Segmented label="เรียงตาม" options={SORTS} value={sort} onChange={setSort} />
          {listFilter && (
            <span className="text-xs text-muted">
              แสดง {visible.length} จาก {owned.length}
            </span>
          )}
        </div>
      )}

      {priceProblem && owned.length > 0 && (
        <Notice
          tone="warn"
          className="mb-3"
          action={problemAction(priceProblem, () => {
            setPriceProblem(null);
            setPriceAttempt((a) => a + 1);
          })}
        >
          โหลดราคาตลาดไม่สำเร็จ: {priceProblem.message} · ราคาและมูลค่าในตารางจึงเป็น &ldquo;-&rdquo;
        </Notice>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-panel lg:overflow-visible">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-panel-2 text-xs text-muted lg:sticky lg:top-0 lg:z-10">
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
                        <div className="truncate text-xs text-muted">{it?.en}</div>
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
                      aria-label={`จำนวน ${it?.th ?? `#${o.id}`}`}
                      className={`${fieldCls("sm")} w-24`}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {o.avgCost === undefined ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="num text-muted">{price ? silver(price) : "-"}</span>
                        <Badge tone="info" title="ใช้ราคาตลาดปัจจุบันเสมอ">
                          ตามตลาด
                        </Badge>
                        <button onClick={() => setOwned(o.id, o.qty, price || 0)} className="text-xs text-muted hover:text-foreground" title="กำหนดต้นทุนที่จ่ายจริงเอง">
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
                          aria-label={`ต้นทุนต่อชิ้น ${it?.th ?? `#${o.id}`}`}
                          className={`${fieldCls("sm")} w-28`}
                        />
                        <button onClick={() => setOwned(o.id, o.qty, null)} className="text-xs text-muted hover:text-foreground" title="กลับไปใช้ราคาตลาดเสมอ">
                          ตามตลาด
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="num px-2 py-1.5 text-right text-muted">
                    {price ? silver(price) : !it?.market ? "ไม่มีในตลาด" : pricesLoading ? "…" : "-"}
                  </td>
                  <td className="num px-2 py-1.5 text-right font-medium">{price ? silver(o.qty * price) : "-"}</td>
                  <td className="px-2 py-1.5 text-right">
                    <button onClick={() => setOwned(o.id, 0)} className={btn("dangerGhost", "sm")}>
                      ลบ
                    </button>
                  </td>
                </tr>
              );
            })}
            {owned.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <EmptyState title="ยังไม่มีของในคลัง" hint={<>พิมพ์ชื่อไอเท็มด้านบนเพื่อเพิ่ม หรือกรอกช่อง &ldquo;มีอยู่แล้ว&rdquo; ในแผนผลิต</>} />
                </td>
              </tr>
            )}
            {owned.length > 0 && visible.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <EmptyState title={<>ไม่มีรายการในคลังที่ตรงกับ &ldquo;{listFilter}&rdquo;</>} />
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
                <td className="num px-2 py-2 text-right">{priceProblem ? "-" : silver(totalValue)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">
        ต้นทุน/ชิ้น: &ldquo;ตามตลาด&rdquo; = ใช้ราคาตลาดปัจจุบันเสมอ (ค่าเริ่มต้น) · &ldquo;กำหนดเอง&rdquo; = ใส่ราคาที่จ่ายจริง ใช้คิดกำไรเมื่อตั้ง &ldquo;{OWNED_COST}&rdquo; เป็น
        &ldquo;{OWNED_COST_LABEL.avg}&rdquo; ใน{SETTINGS_TITLE} · ช่องจำนวน: พิมพ์แล้วกด Enter หรือคลิกออก
      </p>
      <InventoryIdeasPanel />
    </Page>
  );
}
