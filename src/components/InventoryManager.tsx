"use client";

import {
  diffImport,
  IMPORT_MODE_LABEL,
  importChangeCount,
  importSummary,
  mergeImportRows,
  readImportRows,
  type ImportChange,
  type ImportMode,
} from "@/lib/inventory-import";
import { rankByName } from "@/lib/search";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { btn, btnShape, toggleCls } from "./ui/button";
import { Card, cardCls } from "./ui/Card";
import { useConfirm } from "./ui/ConfirmDialog";
import { EmptyState } from "./ui/EmptyState";
import { checkboxCls, fieldCls } from "./ui/field";
import { Notice, type NoticeTone } from "./ui/Notice";
import { Page, PageHeader } from "./ui/Page";
import { SearchInput } from "./ui/SearchInput";
import { Segmented } from "./ui/Segmented";
import { Stat } from "./ui/Stat";
import { toast } from "./ui/Toast";

type InventorySort = "name" | "recent" | "value";
const SORTS: { value: InventorySort; label: string }[] = [
  { value: "name", label: "ชื่อ" },
  { value: "recent", label: "เพิ่ม/แก้ล่าสุด" },
  { value: "value", label: "มูลค่า" },
];

const IMPORT_MODES: { value: ImportMode; hint: string }[] = [
  { value: "replace", hint: "ใช้เมื่อนำเข้าไฟล์เดิมซ้ำ" },
  { value: "add", hint: "ใช้เมื่อนำเข้าทีละคลังในเกม" },
];

const UNDO = "เลิกทำ";

/** One line of the import preview: "30 → 50", "ใหม่ → 5", "30 → เอาออก", "ต้นทุน 5,000 → 4,000". */
function changeText(c: ImportChange): string {
  const parts: string[] = [];
  if (c.after !== c.before) parts.push(`${c.before > 0 ? silver(c.before) : "ใหม่"} → ${c.after > 0 ? silver(c.after) : "เอาออก"}`);
  if (c.cost) parts.push(`ต้นทุน ${c.cost.before !== undefined ? silver(c.cost.before) : "ตามตลาด"} → ${silver(c.cost.after)}`);
  return parts.join(" · ");
}

export interface ItemLite {
  id: ItemId;
  th: string;
  en: string;
  grade: number;
  market: boolean;
}

interface OwnedRow {
  id: ItemId;
  qty: number;
  avgCost?: number;
  updatedAt: number;
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
  // the row just added from the search box: scrolled into view, tinted for a moment and its quantity
  // box focused (a new object per add, so adding the same item again runs it again)
  const [highlight, setHighlight] = useState<{ id: ItemId } | null>(null);
  const highlightId = highlight?.id ?? null;
  const [toolsOpen, setToolsOpen] = useState(false);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const nameOf = (id: ItemId) => byId.get(id)?.th ?? `#${id}`;

  // the inventory as it is now, for an เลิกทำ pressed after later changes
  const inventoryRef = useRef(inventory);
  useEffect(() => {
    inventoryRef.current = inventory;
  }, [inventory]);
  // each row's quantity box, per layout ("t-" table, "c-" phone card), to focus a row just added
  const qtyBoxes = useRef(new Map<string, HTMLInputElement>());
  const qtyBoxRef = (key: string) => (el: HTMLInputElement | null) => {
    if (el) qtyBoxes.current.set(key, el);
    else qtyBoxes.current.delete(key);
  };

  const owned = useMemo<OwnedRow[]>(
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

  // After ลบ, a quantity set to 0 or ล้างทั้งหมด the focused control is gone and focus would drop to
  // the top of the page, far from the เลิกทำ message. For keyboard users only (a tap must not pop up
  // a phone keyboard) it goes to the next row's quantity box, or to the add box when none is left.
  const usingKeyboard = useRef(false);
  useEffect(() => {
    const onKey = () => {
      usingKeyboard.current = true;
    };
    const onPointer = () => {
      usingKeyboard.current = false;
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointer, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointer, true);
    };
  }, []);
  // a new object per removal, set in the same update as the removal so this runs once it is gone
  const [refocus, setRefocus] = useState<{ to: ItemId | "add" } | null>(null);
  useEffect(() => {
    if (!refocus || !usingKeyboard.current) return;
    const active = document.activeElement;
    // the member already moved on (e.g. Tab to another field)
    if (active && active !== document.body) return;
    const target =
      refocus.to === "add"
        ? document.getElementById("inventory-add")
        : [qtyBoxes.current.get(`t-${refocus.to}`), qtyBoxes.current.get(`c-${refocus.to}`)].find((el) => el && el.getClientRects().length > 0);
    target?.focus();
  }, [refocus]);

  useEffect(() => {
    if (!highlight) return;
    // the table on wide screens, the card on phones: whichever one is showing
    const box = [qtyBoxes.current.get(`t-${highlight.id}`), qtyBoxes.current.get(`c-${highlight.id}`)].find((el) => el && el.getClientRects().length > 0);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    box?.closest("tr, li")?.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
    // ready for the real number: type it and press Enter
    box?.focus({ preventScroll: true });
    box?.select();
    const t = setTimeout(() => setHighlight(null), 4000);
    return () => clearTimeout(t);
  }, [highlight]);

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

  /** null until 2 characters are typed; `ownedHits` = names that match but are in the inventory already */
  const search = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return null;
    const ranked = rankByName(items, q, 12 + Object.keys(inventory).length);
    return { matches: ranked.filter((i) => !inventory[i.id]).slice(0, 12), ownedHits: ranked.filter((i) => inventory[i.id]).length };
  }, [query, items, inventory]);
  const noMatchText = search && search.ownedHits > 0 ? "ไอเท็มชื่อนี้อยู่ในคลังแล้ว" : "ไม่พบไอเท็มชื่อนี้";

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

  /** Reads the file, shows what it would change, and applies it only after the member agrees. */
  const importCsv = async (file: File) => {
    const read = readImportRows(parseCsv(await file.text()), items);
    if (!read.ok) {
      setImportMsg({ tone: "bad", text: read.error });
      return;
    }
    const mode = importMode;
    const base = inventory;
    const missing = read.missing;
    const missingNames = missing.length ? `${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}` : "";
    const totals = mergeImportRows(read.rows, mode, base);
    if (totals.size === 0) {
      setImportMsg({ tone: "bad", text: `ไม่มีรายการที่นำเข้าได้${missing.length ? ` · ไม่พบชื่อ ${missing.length} รายการ: ${missingNames}` : ""}` });
      return;
    }
    const diff = diffImport(totals, base);
    const count = importChangeCount(diff);
    if (count === 0) {
      // e.g. the same export imported again: nothing to ask about
      setImportMsg({
        tone: missing.length ? "warn" : "info",
        text: `ไฟล์นี้ตรงกับคลังอยู่แล้ว ไม่มีอะไรเปลี่ยน${missing.length ? ` · ไม่พบชื่อ ${missing.length} รายการ: ${missingNames}` : ""}`,
      });
      return;
    }
    const changes = [...diff.added, ...diff.changed, ...diff.costChanged];
    const costCount = changes.filter((c) => c.cost).length;
    const summary = importSummary(diff.added.length, diff.changed.length, missing.length, mode, costCount);
    const ok = await confirm({
      title: `นำเข้า ${count} รายการจากไฟล์?`,
      body: summary,
      details: [
        ...changes.map((c) => (
          <span key={c.id} className="flex justify-between gap-3">
            <span className="truncate">{nameOf(c.id)}</span>
            <span className="num shrink-0 text-right text-foreground">{changeText(c)}</span>
          </span>
        )),
        ...(missing.length ? [`ไม่พบชื่อ: ${missing.join(", ")}`] : []),
      ],
      confirmLabel: `นำเข้า ${count} รายการ`,
    });
    if (!ok) return;
    // only the items that change are written; what each was before is kept for เลิกทำ (an item that
    // was not there goes back out)
    const before = changes.map(({ id }) => ({ id, qty: base[id]?.qty ?? 0, avgCost: base[id]?.avgCost }));
    for (const { id } of changes) {
      const t = totals.get(id)!;
      setOwned(id, t.qty, t.cost);
    }
    setImportMsg({
      tone: missing.length ? "warn" : "good",
      text: `นำเข้าแล้ว: ${summary}${missing.length ? ` · ชื่อที่ไม่พบ: ${missingNames}` : ""}`,
    });
    toast({
      text: `นำเข้า ${count} รายการแล้ว`,
      action: {
        label: UNDO,
        onClick: () => {
          for (const b of before) setOwned(b.id, b.qty, b.qty > 0 ? (b.avgCost ?? null) : undefined);
          setImportMsg({ tone: "info", text: "เลิกทำการนำเข้าแล้ว" });
        },
      },
    });
  };

  const addItem = (id: ItemId) => {
    setOwned(id, 1);
    setQuery("");
    setListFilter("");
    setHighlight({ id });
  };

  /** Takes the row out at once; the message's เลิกทำ puts back its quantity and cost. */
  const removeRow = (o: OwnedRow) => {
    const i = visible.findIndex((v) => v.id === o.id);
    const next = i >= 0 ? (visible[i + 1] ?? visible[i - 1]) : undefined;
    setRefocus({ to: next ? next.id : "add" });
    setOwned(o.id, 0);
    toast({ text: `ลบ ${nameOf(o.id)} แล้ว`, action: { label: UNDO, onClick: () => setOwned(o.id, o.qty, o.avgCost ?? null) } });
  };

  /** A quantity typed in a row; 0 takes the row out (with เลิกทำ, like ลบ). */
  const changeQty = (o: OwnedRow, v: number) => {
    const qty = Math.floor(v);
    if (qty <= 0) removeRow(o);
    else setOwned(o.id, qty, o.avgCost);
  };

  const allCostsToMarket = () => {
    const custom = owned.filter((o) => o.avgCost !== undefined).map((o) => ({ id: o.id, qty: o.qty, avgCost: o.avgCost as number }));
    for (const c of custom) setOwned(c.id, c.qty, null);
    toast({
      text: `ต้นทุน ${custom.length} รายการกลับไปตามตลาดแล้ว`,
      action: {
        label: UNDO,
        onClick: () => {
          for (const c of custom) {
            const qty = inventoryRef.current[c.id]?.qty ?? 0;
            if (qty > 0) setOwned(c.id, qty, c.avgCost);
          }
        },
      },
    });
  };

  const clearAll = async () => {
    const snapshot = owned.map(({ id, qty, avgCost }) => ({ id, qty, avgCost }));
    const n = snapshot.length;
    const ok = await confirm({
      title: `ล้างคลัง ${n} รายการ?`,
      body: "ของทุกรายการด้านล่างจะออกจากคลัง รวมต้นทุนที่กรอกไว้ · กดเลิกทำได้ทันทีหลังล้าง",
      details: snapshot.map((s) => nameOf(s.id)),
      confirmLabel: `ล้าง ${n} รายการ`,
      tone: "danger",
    });
    if (!ok) return;
    setRefocus({ to: "add" });
    clearInventory();
    toast({
      text: `ล้างคลัง ${n} รายการแล้ว`,
      action: {
        label: UNDO,
        // one save per row, after the clear has gone through (the save queue keeps that order)
        onClick: () => {
          for (const s of snapshot) setOwned(s.id, s.qty, s.avgCost ?? null);
        },
      },
    });
  };

  /** the market price cell: price, "not on the market", loading or unknown */
  const priceText = (id: ItemId, price: number) => (price ? silver(price) : !byId.get(id)?.market ? "ไม่มีในตลาด" : pricesLoading ? "…" : "-");

  return (
    <Page user={user} width="narrow">
      <PageHeader
        title={`คลังของ (${owned.length})`}
        description="ของที่มีอยู่ ใช้หักออกจากวัตถุดิบที่ต้องซื้อในแผนผลิต และคิดต้นทุนตามที่ตั้งค่า"
        actions={
          <button type="button" aria-expanded={toolsOpen} aria-controls="inventory-tools" onClick={() => setToolsOpen((o) => !o)} className={`${btnShape()} ${toggleCls(toolsOpen)}`}>
            นำเข้า / ส่งออก
            <span aria-hidden className={`transition-transform ${toolsOpen ? "rotate-180" : ""}`}>
              ▾
            </span>
          </button>
        }
      />
      {confirmDialog}

      {toolsOpen && (
        <div id="inventory-tools" className={`${cardCls()} mb-4 p-3`}>
          <fieldset>
            <legend className="text-xs font-semibold text-muted">ถ้าในคลังมีไอเท็มนั้นอยู่แล้ว</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {IMPORT_MODES.map((m) => (
                <label
                  key={m.value}
                  className={`flex cursor-pointer items-start gap-2 rounded border px-3 py-2 ${importMode === m.value ? "border-accent bg-accent/10" : "border-border hover:bg-panel-2"}`}
                >
                  <input
                    type="radio"
                    name="inventory-import-mode"
                    value={m.value}
                    checked={importMode === m.value}
                    onChange={() => setImportMode(m.value)}
                    className={`${checkboxCls} mt-0.5 shrink-0`}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{IMPORT_MODE_LABEL[m.value]}</span>
                    <span className="block text-xs text-muted">{m.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {/* the ring only for keyboard focus: a mouse pick (and the dialog handing focus back) shows none */}
            <label className={`${btn("secondary")} cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent`}>
              เลือกไฟล์ CSV
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importCsv(f);
                  e.target.value = "";
                }}
              />
            </label>
            <button type="button" onClick={exportCsv} disabled={owned.length === 0} className={btn("secondary")}>
              ส่งออก CSV
            </button>
            <button type="button" onClick={downloadTemplate} className={btn("secondary")} title="ไฟล์ตัวอย่างสำหรับกรอกแล้วนำเข้า">
              ไฟล์ตัวอย่าง
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">ไฟล์ต้องมีคอลัมน์ จำนวน และ id หรือ ชื่อไอเท็ม · ก่อนนำเข้าจะให้ดูก่อนว่าอะไรเปลี่ยน</p>
          {importMsg && (
            <Notice tone={importMsg.tone} className="mt-3" onClose={() => setImportMsg(null)}>
              {importMsg.text}
            </Notice>
          )}
        </div>
      )}
      {!toolsOpen && importMsg && (
        <Notice tone={importMsg.tone} className="mb-3" onClose={() => setImportMsg(null)}>
          {importMsg.text}
        </Notice>
      )}

      <div className="relative mb-4">
        <SearchInput
          id="inventory-add"
          label="เพิ่มไอเท็มเข้าคลัง"
          value={query}
          onChange={setQuery}
          placeholder="พิมพ์ชื่อไอเท็มเพื่อเพิ่มเข้าคลัง…"
          className="w-full"
          onKeyDown={(e) => {
            // Enter adds the first match, so adding needs no mouse
            if (e.key === "Enter" && !e.nativeEvent.isComposing && search && search.matches.length > 0) {
              e.preventDefault();
              addItem(search.matches[0].id);
            }
          }}
        />
        {/* always in the page, so a screen reader announces the text when it changes */}
        <p role="status" className="sr-only">
          {search && search.matches.length === 0 ? noMatchText : ""}
        </p>
        {search &&
          (search.matches.length > 0 ? (
            <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded border border-border bg-panel shadow-lg">
              {search.matches.map((m, i) => (
                <li key={m.id}>
                  {/* the first row is what Enter adds: tinted, with the key shown from md up */}
                  <button
                    type="button"
                    onClick={() => addItem(m.id)}
                    className={`flex min-h-10 w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-panel-2 md:min-h-0 md:py-1.5 ${i === 0 ? "bg-panel-2" : ""}`}
                  >
                    <ItemIcon id={m.id} grade={m.grade} size={22} />
                    <span className="flex-1 truncate">{m.th}</span>
                    <span className="truncate text-xs text-muted">{m.en}</span>
                    {i === 0 && (
                      <kbd aria-hidden className="hidden shrink-0 rounded border border-border bg-panel px-1 text-[10px] text-muted md:inline">
                        Enter
                      </kbd>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p aria-hidden className="absolute z-10 mt-1 w-full rounded border border-border bg-panel px-3 py-2 text-sm text-muted shadow-lg">
              {noMatchText}
            </p>
          ))}
      </div>

      {customCount > 0 && settings.ownedCostMode !== "avg" && (
        <Notice
          tone="warn"
          className="mb-3"
          action={{ label: "ใช้ราคาที่จ่ายจริง", onClick: () => setSettings({ ...settings, ownedCostMode: "avg" }) }}
        >
          ต้นทุนที่กำหนดเองยังไม่ถูกใช้คิดกำไร · ตอนนี้คิดจาก &ldquo;{OWNED_COST_LABEL[settings.ownedCostMode]}&rdquo;
        </Notice>
      )}

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

      {owned.length === 0 ? (
        <Card>
          <EmptyState title="ยังไม่มีของในคลัง" hint={<>พิมพ์ชื่อไอเท็มด้านบนเพื่อเพิ่ม หรือกรอกช่อง &ldquo;มีอยู่แล้ว&rdquo; ในแผนผลิต</>} />
        </Card>
      ) : (
        <>
          {/* md and up: the table */}
          <div className="hidden overflow-x-auto rounded-lg border border-border bg-panel md:block lg:overflow-visible">
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
                  const name = nameOf(o.id);
                  const price = prices[o.id]?.price ?? 0;
                  return (
                    <tr key={o.id} id={`inv-${o.id}`} className={`border-t border-border transition-colors ${highlightId === o.id ? "bg-accent/15" : ""}`}>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <ItemIcon id={o.id} grade={it?.grade} size={26} />
                          <div className="min-w-0">
                            <div className="truncate">{name}</div>
                            <div className="truncate text-xs text-muted">{it?.en}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <NumberInput
                          ref={qtyBoxRef(`t-${o.id}`)}
                          min={0}
                          value={o.qty}
                          commitOnBlur
                          title="พิมพ์จำนวนแล้วกด Enter หรือคลิกออกจากช่อง · ใส่ 0 = เอาออกจากคลัง"
                          onChange={(v) => changeQty(o, v)}
                          aria-label={`จำนวน ${name}`}
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
                            <button
                              type="button"
                              onClick={() => setOwned(o.id, o.qty, price || 0)}
                              aria-label={`กำหนดเอง (ต้นทุน ${name})`}
                              className="text-xs text-muted hover:text-foreground"
                              title="กำหนดต้นทุนที่จ่ายจริงเอง"
                            >
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
                              aria-label={`ต้นทุนต่อชิ้น ${name}`}
                              className={`${fieldCls("sm")} w-28`}
                            />
                            <button
                              type="button"
                              onClick={() => setOwned(o.id, o.qty, null)}
                              aria-label={`ตามตลาด (ต้นทุน ${name})`}
                              className="text-xs text-muted hover:text-foreground"
                              title="กลับไปใช้ราคาตลาดเสมอ"
                            >
                              ตามตลาด
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="num px-2 py-1.5 text-right text-muted">{priceText(o.id, price)}</td>
                      <td className="num px-2 py-1.5 text-right font-medium">{price ? silver(o.qty * price) : "-"}</td>
                      <td className="px-2 py-1.5 text-right">
                        <button type="button" onClick={() => removeRow(o)} aria-label={`ลบ ${name}`} className={btn("dangerGhost", "sm")}>
                          ลบ
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState title={<>ไม่มีรายการในคลังที่ตรงกับ &ldquo;{listFilter}&rdquo;</>} />
                    </td>
                  </tr>
                )}
              </tbody>
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
            </table>
          </div>

          {/* phones: one card per item, then the totals */}
          <div className="space-y-2 md:hidden">
            {visible.length === 0 ? (
              <Card>
                <EmptyState title={<>ไม่มีรายการในคลังที่ตรงกับ &ldquo;{listFilter}&rdquo;</>} />
              </Card>
            ) : (
              <ul className="space-y-2" aria-label="ของในคลัง">
                {visible.map((o) => {
                  const it = byId.get(o.id);
                  const name = nameOf(o.id);
                  const price = prices[o.id]?.price ?? 0;
                  return (
                    <li
                      key={o.id}
                      id={`inv-card-${o.id}`}
                      className={`rounded-lg border p-3 transition-colors ${highlightId === o.id ? "border-accent/40 bg-accent/15" : "border-border bg-panel"}`}
                    >
                      <div className="flex items-center gap-2">
                        <ItemIcon id={o.id} grade={it?.grade} size={28} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm">{name}</div>
                          <div className="truncate text-xs text-muted">{it?.en}</div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="num text-sm font-medium">{price ? silver(o.qty * price) : "-"}</div>
                          <div className="num text-xs text-muted">{price ? `${silver(price)}/ชิ้น` : priceText(o.id, price)}</div>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div className="min-w-0">
                          <div aria-hidden className="mb-1 text-xs text-muted">
                            จำนวน
                          </div>
                          <NumberInput
                            ref={qtyBoxRef(`c-${o.id}`)}
                            min={0}
                            value={o.qty}
                            commitOnBlur
                            onChange={(v) => changeQty(o, v)}
                            aria-label={`จำนวน ${name}`}
                            className={`${fieldCls()} num`}
                          />
                        </div>
                        <div className="min-w-0">
                          <div aria-hidden className="mb-1 text-xs text-muted">
                            ต้นทุน/ชิ้น
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {o.avgCost === undefined ? (
                              <span className="num min-w-0 flex-1 text-sm text-muted">
                                {/* the caption above is hidden from screen readers: say what this number is */}
                                <span className="sr-only">ต้นทุนต่อชิ้น {name} ตามตลาด </span>
                                {price ? silver(price) : "-"}
                              </span>
                            ) : (
                              <NumberInput
                                min={0}
                                value={o.avgCost}
                                commitOnBlur
                                onChange={(v) => setOwned(o.id, o.qty, v)}
                                aria-label={`ต้นทุนต่อชิ้น ${name}`}
                                className={`${fieldCls()} num min-w-0 flex-1`}
                              />
                            )}
                            {o.avgCost === undefined ? (
                              <button
                                type="button"
                                onClick={() => setOwned(o.id, o.qty, price || 0)}
                                aria-label={`กำหนดเอง (ต้นทุน ${name})`}
                                className={btn("secondary", "sm")}
                                title="กำหนดต้นทุนที่จ่ายจริงเอง"
                              >
                                กำหนดเอง
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setOwned(o.id, o.qty, null)}
                                aria-label={`ตามตลาด (ต้นทุน ${name})`}
                                className={btn("secondary", "sm")}
                                title="กลับไปใช้ราคาตลาดเสมอ"
                              >
                                ตามตลาด
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-1 flex justify-end">
                        <button type="button" onClick={() => removeRow(o)} aria-label={`ลบ ${name}`} className={btn("ghost", "sm")}>
                          ลบ
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <Card className="p-3">
              <h2 className="mb-2 text-sm font-semibold">รวม {owned.length} รายการ</h2>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="ต้นทุนรวม" value={totalCost ? silver(totalCost) : "-"} />
                <Stat label="มูลค่าตลาด" value={priceProblem ? "-" : silver(totalValue)} emphasis />
              </div>
            </Card>
          </div>
        </>
      )}

      <div className="mt-3 flex flex-wrap items-start gap-x-3 gap-y-2">
        <p className="min-w-0 flex-1 basis-64 text-xs text-muted">
          ต้นทุน/ชิ้น: &ldquo;ตามตลาด&rdquo; = ใช้ราคาตลาดปัจจุบันเสมอ (ค่าเริ่มต้น) · &ldquo;กำหนดเอง&rdquo; = ใส่ราคาที่จ่ายจริง ใช้คิดกำไรเมื่อตั้ง &ldquo;{OWNED_COST}&rdquo; เป็น
          &ldquo;{OWNED_COST_LABEL.avg}&rdquo; ใน{SETTINGS_TITLE} · ช่องจำนวน: พิมพ์แล้วกด Enter หรือคลิกออก
        </p>
        {customCount > 0 && (
          <button type="button" onClick={allCostsToMarket} className={btn("ghost", "sm")} title="เปลี่ยนต้นทุนทุกรายการให้ใช้ราคาตลาดปัจจุบันเสมอ">
            ต้นทุนทั้งหมดตามตลาด
          </button>
        )}
      </div>
      {owned.length > 0 && (
        <div className="mt-3 flex justify-end">
          <button type="button" aria-haspopup="dialog" onClick={() => void clearAll()} className={btn("danger", "sm")}>
            ล้างทั้งหมด
          </button>
        </div>
      )}
      <InventoryIdeasPanel />
    </Page>
  );
}
