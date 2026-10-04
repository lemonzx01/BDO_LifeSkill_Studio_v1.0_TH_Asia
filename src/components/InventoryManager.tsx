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
import { GUEST_STORAGE_NOTE } from "@/lib/guest/storage";
import { describeError, fetchJson, isAbort, problemAction, type FetchProblem } from "@/lib/fetch-error";
import { silver } from "@/lib/format";
import { INVENTORY_SORT_LABEL, OWNED_COST, OWNED_COST_LABEL, SETTINGS_TITLE } from "@/lib/settings-labels";
import type { SessionUser } from "./auth/UserMenu";
import { InventoryIdeasPanel } from "./InventoryIdeasPanel";
import { ItemIcon } from "./ItemIcon";
import { NumberInput } from "./NumberInput";
import { useUserData } from "./UserDataProvider";
import { Badge } from "./ui/Badge";
import { btn, btnShape, iconBtn, toggleCls } from "./ui/button";
import { Card, cardCls } from "./ui/Card";
import { useConfirm } from "./ui/ConfirmDialog";
import { EmptyState } from "./ui/EmptyState";
import { checkboxCls, fieldCls } from "./ui/field";
import { Icon } from "./ui/Icon";
import { Notice, type NoticeTone } from "./ui/Notice";
import { Page, PageHeader } from "./ui/Page";
import { SearchInput } from "./ui/SearchInput";
import { Segmented } from "./ui/Segmented";
import { SkeletonRows } from "./ui/Skeleton";
import { Stat } from "./ui/Stat";
import {
  headCls,
  headStickyCls,
  itemCellCls,
  itemNameCls,
  fillCellCls,
  rowCls,
  stackedListLgCls,
  stackedMainCls,
  tableCls,
  tdCls,
  tdNumCls,
  thCls,
  thNumCls,
  toolbarCls,
} from "./ui/table";
import { toast } from "./ui/Toast";

type InventorySort = keyof typeof INVENTORY_SORT_LABEL;
const SORTS: { value: InventorySort; label: string }[] = (["name", "recent", "value"] as const).map((value) => ({ value, label: INVENTORY_SORT_LABEL[value] }));

const IMPORT_MODES: { value: ImportMode; hint: string }[] = [
  { value: "replace", hint: "ใช้เมื่อนำเข้าไฟล์เดิมซ้ำ" },
  { value: "add", hint: "ใช้เมื่อนำเข้าทีละคลังในเกม" },
];

const UNDO = "เลิกทำ";
/** how long new rows wait for more before their prices are asked for together */
const PRICE_BATCH_MS = 400;

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
export function InventoryManager({ items, user }: { items: ItemLite[]; user: SessionUser | null }) {
  const { inventory, setOwned, clearInventory, settings, setSettings, guest, ready } = useUserData();
  const [confirm, confirmDialog] = useConfirm();
  const [query, setQuery] = useState("");
  const [prices, setPrices] = useState<Record<ItemId, MarketPrice>>({});
  // ids whose price has been asked for and answered (a row added later asks for its own price only),
  // and why the last load failed (cells then show "-")
  const [pricedIds, setPricedIds] = useState<ReadonlySet<ItemId>>(() => new Set());
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
  // each row's quantity box, per layout ("t-" table, "c-" stacked row), to focus a row just added
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
  /** owned ids with no price asked for yet */
  const needKey = owned
    .filter((o) => !pricedIds.has(o.id))
    .map((o) => o.id)
    .join(",");
  const firstPriceLoad = pricedIds.size === 0;

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
    // the table from lg up, the stacked row below it: whichever one is showing
    const box = [qtyBoxes.current.get(`t-${highlight.id}`), qtyBoxes.current.get(`c-${highlight.id}`)].find((el) => el && el.getClientRects().length > 0);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    box?.closest("tr, li")?.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
    // ready for the real number: type it and press Enter
    box?.focus({ preventScroll: true });
    box?.select();
    const t = setTimeout(() => setHighlight(null), 4000);
    return () => clearTimeout(t);
  }, [highlight]);

  // Prices for the rows that have none yet. After the first load it waits a moment, so rows added
  // one after another (or a CSV import) are asked for together, not one request per row.
  useEffect(() => {
    if (!needKey) return;
    const ctl = new AbortController();
    const timer = setTimeout(
      () => {
        fetchJson<{ prices: Record<ItemId, MarketPrice> }>(`/api/prices?ids=${needKey}`, { signal: ctl.signal })
          .then((json) => {
            setPrices((cur) => ({ ...cur, ...json.prices }));
            setPricedIds((cur) => {
              const next = new Set(cur);
              for (const id of needKey.split(",")) next.add(Number(id));
              return next;
            });
            setPriceProblem(null);
          })
          .catch((e) => {
            if (!isAbort(e)) setPriceProblem(describeError(e));
          });
      },
      firstPriceLoad ? 0 : PRICE_BATCH_MS,
    );
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, [needKey, priceAttempt, firstPriceLoad]);
  const pricesLoading = !priceProblem && needKey !== "";

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

  /** the line under a row's market value: the price per piece, "not on the market", or nothing (loading or unknown) */
  const unitText = (id: ItemId, price: number) => (price ? `${silver(price)}/ชิ้น` : !byId.get(id)?.market ? "ไม่มีในตลาด" : null);
  /** a row's market value: the number, a grey bar while its price is on the way, or "-" (unknown) */
  const valueText = (o: OwnedRow, price: number) =>
    price ? silver(o.qty * price) : byId.get(o.id)?.market && pricesLoading ? <PricePending /> : "-";

  return (
    <Page user={user} width="wide">
      <PageHeader
        // no count until a guest's rows have been read from this browser
        title={ready ? `คลังของ (${owned.length})` : "คลังของ"}
        description="ของที่มีอยู่ ใช้หักออกจากวัตถุดิบที่ต้องซื้อในแผนผลิต และคิดต้นทุนตามที่ตั้งค่า"
        meta={[guest && GUEST_STORAGE_NOTE]}
      />
      {confirmDialog}

      {/* xl: the list on the left and the ideas as a side card. Below xl the ideas follow the list:
          the table's editable cells need about 800px, which a 1024px screen cannot spare next to it */}
      <div className="grid grid-cols-1 items-start gap-4 md:gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          {/* the answer first: what everything is worth now, and what it cost */}
          {ready && owned.length > 0 && (
            <div className="grid grid-cols-2 gap-2 md:gap-3">
              <Stat
                label="มูลค่าตลาด"
                value={priceProblem ? "-" : silver(totalValue)}
                emphasis
                hint={pricesLoading ? "กำลังโหลดราคา…" : "ตามราคาตลาดตอนนี้"}
              />
              <Stat
                label="ต้นทุนรวม"
                value={totalCost ? silver(totalCost) : "-"}
                hint={customCount > 0 ? `กำหนดเอง ${silver(customCount)} รายการ` : "ตามราคาตลาดทุกรายการ"}
              />
            </div>
          )}

          <div className={toolbarCls}>
            <div className="relative min-w-0 flex-1 basis-64">
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
              {/* z-20: over the table's sticky header row (z-10) that follows it on the page */}
              {search &&
                (search.matches.length > 0 ? (
                  <ul className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-border-strong bg-panel shadow-pop">
                    {search.matches.map((m, i) => (
                      <li key={m.id}>
                        {/* the first row is what Enter adds: tinted, with the key shown from md up */}
                        <button
                          type="button"
                          onClick={() => addItem(m.id)}
                          className={`flex min-h-10 w-full items-center gap-3 px-3 py-1.5 text-left text-sm transition-colors duration-150 hover:bg-panel-2 ${i === 0 ? "bg-panel-2" : ""}`}
                        >
                          <ItemIcon id={m.id} grade={m.grade} size={24} />
                          <span className="min-w-0 flex-1 truncate text-foreground">{m.th}</span>
                          <span className="min-w-0 max-w-[45%] truncate text-xs text-muted">{m.en}</span>
                          {i === 0 && (
                            <kbd aria-hidden className="hidden shrink-0 rounded-md border border-border-strong bg-panel-3 px-1.5 font-sans text-xs text-muted md:inline">
                              Enter
                            </kbd>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p
                    aria-hidden
                    className="absolute inset-x-0 top-full z-20 mt-1 flex items-center gap-2 rounded-xl border border-border-strong bg-panel px-3 py-2.5 text-sm text-muted shadow-pop"
                  >
                    <Icon name="search" className="h-4 w-4 text-faint" />
                    {noMatchText}
                  </p>
                ))}
            </div>
            <button
              type="button"
              aria-expanded={toolsOpen}
              aria-controls="inventory-tools"
              onClick={() => setToolsOpen((o) => !o)}
              className={`${btnShape()} ${toggleCls(toolsOpen)}`}
            >
              นำเข้า / ส่งออก
              <Icon name="chevron-down" className={`h-4 w-4 transition-transform duration-150 ${toolsOpen ? "rotate-180" : ""}`} />
            </button>
          </div>

          {toolsOpen && (
            <div id="inventory-tools" className={`${cardCls()} space-y-4 p-4`}>
              <fieldset>
                <legend className="text-xs font-medium text-muted">ถ้าในคลังมีไอเท็มนั้นอยู่แล้ว</legend>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {IMPORT_MODES.map((m) => (
                    <label
                      key={m.value}
                      className={`${toggleCls(importMode === m.value)} flex cursor-pointer items-start gap-2.5 rounded-lg px-3 py-2.5 transition-colors duration-150`}
                    >
                      <input
                        type="radio"
                        name="inventory-import-mode"
                        value={m.value}
                        checked={importMode === m.value}
                        onChange={() => setImportMode(m.value)}
                        className={`${checkboxCls} mt-0.5`}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{IMPORT_MODE_LABEL[m.value]}</span>
                        {/* grey in both states: only the choice itself turns gold */}
                        <span className="block text-xs text-muted">{m.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="flex flex-wrap items-center gap-2">
                {/* the ring only for keyboard focus: a mouse pick (and the dialog handing focus back) shows none */}
                <label className={`${btn("secondary")} cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent`}>
                  <Icon name="upload" className="h-4 w-4" />
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
                  <Icon name="download" className="h-4 w-4" />
                  ส่งออก CSV
                </button>
                <button type="button" onClick={downloadTemplate} className={btn("ghost")} title="ไฟล์ตัวอย่างสำหรับกรอกแล้วนำเข้า">
                  ไฟล์ตัวอย่าง
                </button>
              </div>
              <p className="text-xs text-muted">ไฟล์ต้องมีคอลัมน์ จำนวน และ id หรือ ชื่อไอเท็ม · ก่อนนำเข้าจะให้ดูก่อนว่าอะไรเปลี่ยน</p>
              {importMsg && (
                <Notice tone={importMsg.tone} onClose={() => setImportMsg(null)}>
                  {importMsg.text}
                </Notice>
              )}
            </div>
          )}
          {!toolsOpen && importMsg && (
            <Notice tone={importMsg.tone} onClose={() => setImportMsg(null)}>
              {importMsg.text}
            </Notice>
          )}

          {customCount > 0 && settings.ownedCostMode !== "avg" && (
            <Notice tone="warn" action={{ label: "ใช้ราคาที่จ่ายจริง", onClick: () => setSettings({ ...settings, ownedCostMode: "avg" }) }}>
              ต้นทุนที่กำหนดเองยังไม่ถูกใช้คิดกำไร · ตอนนี้คิดจาก &ldquo;{OWNED_COST_LABEL[settings.ownedCostMode]}&rdquo;
            </Notice>
          )}

          {priceProblem && owned.length > 0 && (
            <Notice
              tone="warn"
              action={problemAction(priceProblem, () => {
                setPriceProblem(null);
                setPriceAttempt((a) => a + 1);
              })}
            >
              โหลดราคาตลาดไม่สำเร็จ: {priceProblem.message} · ราคาและมูลค่าในตารางจึงเป็น &ldquo;-&rdquo;
            </Notice>
          )}

          {!ready ? (
            // a guest's rows are in this browser, read once the page is live: not "nothing here" before that
            <SkeletonRows n={6} label="กำลังโหลดคลังของ…" />
          ) : owned.length === 0 ? (
            <Card>
              <EmptyState
                icon="package"
                title="เริ่มจากเพิ่มของที่มีเข้าคลัง"
                hint={
                  <>
                    พิมพ์ชื่อไอเท็มในช่องด้านบนเพื่อเพิ่ม หรือกรอกช่อง &ldquo;มีอยู่แล้ว&rdquo; ในแผนผลิต · มีไฟล์ CSV อยู่แล้ว กด &ldquo;นำเข้า / ส่งออก&rdquo;
                  </>
                }
              />
            </Card>
          ) : (
            <Card as="div">
              {/* the list's own controls: narrow it down and order it */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border p-3">
                <SearchInput
                  label="ค้นหาในคลัง"
                  value={listFilter}
                  onChange={setListFilter}
                  placeholder="ค้นหาในคลัง…"
                  className="min-w-0 flex-1 basis-48 sm:max-w-xs"
                />
                <div className="flex min-w-0 max-w-full items-center gap-2">
                  <span className="shrink-0 text-xs text-muted">เรียงตาม</span>
                  <Segmented label="เรียงตาม" options={SORTS} value={sort} onChange={setSort} />
                </div>
                {listFilter && (
                  <span className="text-xs text-muted">
                    แสดง <span className="num">{visible.length}</span> จาก <span className="num">{owned.length}</span>
                  </span>
                )}
              </div>

              {visible.length === 0 ? (
                <EmptyState
                  compact
                  icon="search"
                  title={<>ไม่มีรายการในคลังที่ตรงกับ &ldquo;{listFilter}&rdquo;</>}
                  action={{ label: "ล้างคำค้น", onClick: () => setListFilter("") }}
                />
              ) : (
                <>
                  {/* lg and up: the table, its header row kept in view under the top bar */}
                  <table className={`${tableCls} hidden lg:table`}>
                    <thead className={`${headCls} ${headStickyCls}`}>
                      <tr>
                        <th className={thCls}>ไอเท็ม</th>
                        <th className={thNumCls}>จำนวน</th>
                        <th className={thNumCls}>ต้นทุน/ชิ้น</th>
                        <th className={thCls}>
                          <span className="sr-only">ที่มาของต้นทุน</span>
                        </th>
                        <th className={thNumCls}>มูลค่าตลาด</th>
                        <th className={thCls}>
                          <span className="sr-only">ลบ</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((o) => {
                        const it = byId.get(o.id);
                        const name = nameOf(o.id);
                        const price = prices[o.id]?.price ?? 0;
                        const unit = unitText(o.id, price);
                        return (
                          <tr key={o.id} id={`inv-${o.id}`} className={`${rowCls} ${highlightId === o.id ? "bg-accent/12" : ""}`}>
                            {/* fillCellCls: a long name is cut short instead of pushing the table past its card */}
                            <td className={`${tdCls} ${fillCellCls}`}>
                              <div className={itemCellCls}>
                                <ItemIcon id={o.id} grade={it?.grade} size={28} />
                                <div className="min-w-0">
                                  <div className={itemNameCls}>{name}</div>
                                  <div className="truncate text-xs text-faint">{it?.en}</div>
                                </div>
                              </div>
                            </td>
                            <td className={tdNumCls}>
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
                            <td className={tdNumCls}>
                              {o.avgCost === undefined ? (
                                <span className="text-muted">{price ? silver(price) : "-"}</span>
                              ) : (
                                <NumberInput
                                  min={0}
                                  value={o.avgCost}
                                  commitOnBlur
                                  onChange={(v) => setOwned(o.id, o.qty, v)}
                                  aria-label={`ต้นทุนต่อชิ้น ${name}`}
                                  className={`${fieldCls("sm")} w-28`}
                                />
                              )}
                            </td>
                            {/* where the cost comes from, and the switch to the other source */}
                            <td className="py-2.5 pr-3 align-middle">
                              <div className="flex items-center gap-1.5">
                                {o.avgCost === undefined ? (
                                  <>
                                    <Badge tone="info" title="ใช้ราคาตลาดปัจจุบันเสมอ">
                                      ตามตลาด
                                    </Badge>
                                    <button
                                      type="button"
                                      onClick={() => setOwned(o.id, o.qty, price || 0)}
                                      aria-label={`กำหนดเอง (ต้นทุน ${name})`}
                                      className={btn("ghost", "sm")}
                                      title="กำหนดต้นทุนที่จ่ายจริงเอง"
                                    >
                                      กำหนดเอง
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <Badge tone="special" title="ใช้ราคาที่จ่ายจริงที่กรอกไว้">
                                      กำหนดเอง
                                    </Badge>
                                    <button
                                      type="button"
                                      onClick={() => setOwned(o.id, o.qty, null)}
                                      aria-label={`ตามตลาด (ต้นทุน ${name})`}
                                      className={btn("ghost", "sm")}
                                      title="กลับไปใช้ราคาตลาดเสมอ"
                                    >
                                      ตามตลาด
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                            <td className={tdNumCls}>
                              <div className="font-semibold text-foreground">{valueText(o, price)}</div>
                              {unit && <div className="text-xs text-muted">{unit}</div>}
                            </td>
                            <td className={`${tdCls} w-px`}>
                              <button type="button" onClick={() => removeRow(o)} aria-label={`ลบ ${name}`} title="ลบ" className={iconBtn("dangerGhost", "sm")}>
                                <Icon name="trash" className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* below lg: one stacked row per item, the value on the right of the name */}
                  <ul className={stackedListLgCls} aria-label="ของในคลัง">
                    {visible.map((o) => {
                      const it = byId.get(o.id);
                      const name = nameOf(o.id);
                      const price = prices[o.id]?.price ?? 0;
                      const unit = unitText(o.id, price);
                      return (
                        <li
                          key={o.id}
                          id={`inv-card-${o.id}`}
                          // stackedRowCls with more room between the lines: this row holds fields
                          className={`flex flex-col gap-3 px-4 py-3 transition-colors duration-150 ${highlightId === o.id ? "bg-accent/12" : ""}`}
                        >
                          <div className={stackedMainCls}>
                            <ItemIcon id={o.id} grade={it?.grade} size={32} />
                            <div className="min-w-0 flex-1">
                              <div className={itemNameCls}>{name}</div>
                              <div className="truncate text-xs text-faint">{it?.en}</div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="num font-semibold text-foreground">{valueText(o, price)}</div>
                              {unit && <div className="num text-xs text-muted">{unit}</div>}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-end gap-x-4 gap-y-2 sm:pl-11">
                            <div className="grid min-w-0 flex-1 grid-cols-2 gap-3 sm:max-w-sm">
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
                                  className={fieldCls()}
                                />
                              </div>
                              <div className="min-w-0">
                                <div aria-hidden className="mb-1 text-xs text-muted">
                                  ต้นทุน/ชิ้น
                                </div>
                                {o.avgCost === undefined ? (
                                  <div className="flex min-h-10 min-w-0 items-center gap-1.5 md:min-h-9">
                                    <span className="num min-w-0 truncate text-sm text-muted">
                                      {/* the caption above is hidden from screen readers: say what this number is */}
                                      <span className="sr-only">ต้นทุนต่อชิ้น {name} ตามตลาด </span>
                                      {price ? silver(price) : "-"}
                                    </span>
                                    {/* the words are in the sr-only line already */}
                                    <span aria-hidden className="shrink-0">
                                      <Badge tone="info">ตามตลาด</Badge>
                                    </span>
                                  </div>
                                ) : (
                                  <NumberInput
                                    min={0}
                                    value={o.avgCost}
                                    commitOnBlur
                                    onChange={(v) => setOwned(o.id, o.qty, v)}
                                    aria-label={`ต้นทุนต่อชิ้น ${name}`}
                                    className={fieldCls()}
                                  />
                                )}
                              </div>
                            </div>
                            <div className="flex w-full items-center justify-between gap-2 sm:ml-auto sm:w-auto">
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
                              <button type="button" onClick={() => removeRow(o)} aria-label={`ลบ ${name}`} className={btn("dangerGhost", "sm")}>
                                <Icon name="trash" className="h-4 w-4" />
                                ลบ
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}

              {/* how the cost column works, and the actions on the whole list */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-border px-4 py-3">
                <p className="min-w-0 flex-1 basis-72 text-xs text-muted">
                  ต้นทุน/ชิ้น: &ldquo;ตามตลาด&rdquo; = ใช้ราคาตลาดปัจจุบันเสมอ (ค่าเริ่มต้น) · &ldquo;กำหนดเอง&rdquo; = ใส่ราคาที่จ่ายจริง ใช้คิดกำไรเมื่อตั้ง &ldquo;{OWNED_COST}&rdquo; เป็น
                  &ldquo;{OWNED_COST_LABEL.avg}&rdquo; ใน{SETTINGS_TITLE} · ช่องจำนวน: พิมพ์แล้วกด Enter หรือคลิกออก
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {customCount > 0 && (
                    <button type="button" onClick={allCostsToMarket} className={btn("ghost", "sm")} title="เปลี่ยนต้นทุนทุกรายการให้ใช้ราคาตลาดปัจจุบันเสมอ">
                      ต้นทุนทั้งหมดตามตลาด
                    </button>
                  )}
                  <button type="button" aria-haspopup="dialog" onClick={() => void clearAll()} className={btn("danger", "sm")}>
                    <Icon name="trash" className="h-4 w-4" />
                    ล้างทั้งหมด
                  </button>
                </div>
              </div>
            </Card>
          )}
        </div>

        <InventoryIdeasPanel />
      </div>
    </Page>
  );
}

/** A market price still on its way: a grey bar where the number will be, named for screen readers. */
function PricePending() {
  return (
    <>
      <span aria-hidden className="skeleton inline-block h-3 w-14 rounded-full align-middle" />
      <span className="sr-only">กำลังโหลดราคา</span>
    </>
  );
}
