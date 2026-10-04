"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { fetchJson, isAbort } from "@/lib/fetch-error";
import { silver } from "@/lib/format";
import { ItemIcon } from "./ItemIcon";
import { Badge } from "./ui/Badge";
import { btn } from "./ui/button";
import { fieldCls } from "./ui/field";
import { Icon, type IconName } from "./ui/Icon";

interface Hit {
  id: number;
  th: string;
  en: string | null;
  price: number;
  stock: number;
  grade: number;
  /** the recipes page lists it (some recipe makes it); otherwise it opens in the market */
  hasRecipe: boolean;
}

const PAGES: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "หน้าแรก", icon: "home" },
  { href: "/recipes", label: "คำนวณสูตร", icon: "book" },
  { href: "/market", label: "สแกนตลาด", icon: "chart" },
  { href: "/inventory", label: "คลังของ", icon: "package" },
  { href: "/calc", label: "คิดภาษี", icon: "calculator" },
  { href: "/help", label: "วิธีใช้", icon: "help-circle" },
];

/** a key cap in the hint line */
const KBD = "rounded border border-border-strong bg-panel px-1 font-sans text-xs leading-4 text-muted";

// one quick search per page (see below), so fixed ids are unique
const LIST_ID = "qs-list";
/** the name cell of row i: what aria-activedescendant points at */
const optId = (i: number) => `qs-opt-${i}`;

/**
 * Ctrl+K from any page: type an item name, jump to its recipes, its market
 * row or the tax calculator. Searches the market snapshot on the server, so
 * nothing heavy is loaded until the box is opened.
 *
 * A native <dialog> opened with showModal(): focus stays inside, the page behind is inert, Escape
 * closes it and focus goes back to where it was. Full screen on phones, a centred card from md up.
 * The box is a combobox whose popup is a grid (ARIA 1.2): each hit is a row with the name cell (the
 * one ↑↓ move through) and a cell of buttons (สูตร / ตลาด / คิดภาษี, reached with Tab), so buttons
 * never sit inside a listbox option. Enter opens the item's recipes (or the market when no recipe
 * makes it), Shift+Enter its market row.
 *
 * `compact`: the top bar version. Below md it is a 40x40 search-icon button next to the avatar;
 * from md up it looks like a field, and the "ค้นหา…" label (lg) and the Ctrl K hint (xl) come back
 * as room allows. Render one per page: each instance listens for Ctrl+K.
 */
export function QuickSearch({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  // the last search failed (said apart from "nothing found"); bumping attempt runs it again
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // the term the hits (or the failure) belong to: until it matches what is typed, nothing is
  // announced as found or not found (the 180 ms before a search starts included)
  const [doneTerm, setDoneTerm] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  // keyboard shortcut (Escape is the dialog's own)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")) return;
      // another modal <dialog> (settings drawer, confirm) is open: this one waits until it is closed
      for (const d of document.querySelectorAll("dialog[open]")) if (d !== dialogRef.current) return;
      e.preventDefault();
      setOpen((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // the native dialog follows `open`; the box gets focus as it opens
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) {
      const was = document.activeElement;
      returnTo.current = was instanceof HTMLElement && was !== document.body ? was : triggerRef.current;
      d.showModal();
      inputRef.current?.focus();
      inputRef.current?.select();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);

  // closed by Escape, ปิด, a press on the backdrop or a pick: focus goes back to where it was
  const onDialogClose = () => {
    setOpen(false);
    const back = returnTo.current;
    returnTo.current = null;
    if (back?.isConnected) back.focus();
  };

  // debounced server search
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      const t = setTimeout(() => {
        setHits([]);
        setActive(0);
        setFailed(false);
      }, 0);
      return () => clearTimeout(t);
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setBusy(true);
      setFailed(false);
      fetchJson<{ items: Hit[] }>(`/api/market/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal })
        .then((j) => {
          setHits(j.items ?? []);
          setActive(0);
          setDoneTerm(term);
        })
        .catch((e) => {
          if (isAbort(e)) return;
          setHits([]);
          setFailed(true);
          setDoneTerm(term);
        })
        .finally(() => setBusy(false));
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, attempt]);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };
  const toRecipes = (h: Hit) => go(`/recipes?q=${encodeURIComponent(h.th)}`);
  const toMarket = (h: Hit) => go(`/market?q=${encodeURIComponent(h.th)}`);
  const toCalc = (h: Hit) => go(`/calc?item=${h.id}&name=${encodeURIComponent(h.th)}&price=${h.price}`);
  /** Enter or a press on the name: the recipes when some recipe makes it, else its market row */
  const openHit = (h: Hit) => (h.hasRecipe ? toRecipes(h) : toMarket(h));

  const term = q.trim();
  const showPages = term.length < 2;
  const pageHits = showPages ? PAGES.filter((p) => !term || p.label.includes(term)) : [];
  // the hits on screen are the answer for what is typed now
  const settled = !busy && doneTerm === term;
  const count = showPages ? pageHits.length : hits.length;
  // the highlighted row, kept inside the list while it changes
  const sel = count ? Math.min(active, count - 1) : -1;

  const move = (delta: number) => {
    if (!count) return;
    const next = (sel + delta + count) % count;
    setActive(next);
    document.getElementById(optId(next))?.scrollIntoView({ block: "nearest" });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (sel < 0) return;
      if (showPages) {
        const p = pageHits[sel];
        if (p) go(p.href);
      } else {
        const h = hits[sel];
        if (h) (e.shiftKey ? toMarket : openHit)(h);
      }
    }
  };

  // read out once the list has settled (not while it is loading or about to)
  const live = showPages || !settled ? "" : failed ? "ค้นหาไม่สำเร็จ" : `พบ ${hits.length} รายการ`;
  const retrySearch = () => {
    setDoneTerm(null);
    setAttempt((a) => a + 1);
    // the button goes away as the search starts: keep focus in the box, not on the inert page
    inputRef.current?.focus();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className={
          compact
            ? "flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-lg text-muted transition-colors duration-150 hover:bg-panel-2 hover:text-foreground md:h-9 md:w-auto md:border md:border-border-strong md:bg-panel-2 md:px-2.5 md:hover:border-border-field lg:min-w-40 lg:justify-start"
            : "flex min-h-10 items-center gap-2 rounded-lg border border-border-strong bg-panel-2 px-3 text-sm text-muted transition-colors duration-150 hover:border-border-field hover:text-foreground md:min-h-9"
        }
        title="ค้นหาไอเทมจากทุกหน้า (Ctrl+K)"
        aria-label="ค้นหาด่วน"
        aria-haspopup="dialog"
      >
        <Icon name="search" className="h-[18px] w-[18px]" />
        <span className={`text-sm ${compact ? "hidden lg:inline" : "hidden sm:inline"}`}>ค้นหา…</span>
        <kbd
          className={`ml-auto hidden rounded border border-border-strong bg-panel px-1.5 font-sans text-xs leading-4 text-faint ${compact ? "xl:inline" : "md:inline"}`}
        >
          Ctrl K
        </kbd>
      </button>

      <dialog
        ref={dialogRef}
        aria-label="ค้นหาด่วน"
        onClose={onDialogClose}
        // a press on the dimmed backdrop (outside the card) closes it
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        // full screen on phones (fades in), a card that rises in from md up
        className="m-0 h-[100dvh] max-h-none w-full max-w-none animate-fade-in overflow-hidden rounded-none border-0 bg-panel p-0 text-foreground backdrop:bg-black/60 backdrop:backdrop-blur-[2px] md:mx-auto md:mb-auto md:mt-[12vh] md:h-fit md:max-h-[80vh] md:max-w-xl md:animate-rise-in md:rounded-xl md:border md:border-border-strong md:shadow-pop"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-2 border-b border-border p-3 pt-[calc(0.75rem+env(safe-area-inset-top))] md:pt-3">
            <div className="relative min-w-0 flex-1">
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
              <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-haspopup="grid"
                aria-expanded={count > 0}
                aria-controls={LIST_ID}
                aria-activedescendant={sel >= 0 ? optId(sel) : undefined}
                aria-autocomplete="list"
                aria-label="ค้นหาไอเท็ม"
                placeholder="พิมพ์ชื่อไอเท็ม…"
                enterKeyHint="search"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                className={`${fieldCls()} pl-9`}
              />
            </div>
            <button type="button" onClick={() => setOpen(false)} className={`${btn("ghost")} min-h-11 shrink-0 md:min-h-9`}>
              ปิด
            </button>
          </div>
          <p className="sr-only" aria-live="polite">
            {live}
          </p>
          {!showPages && hits.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted">
              {!settled ? (
                <>
                  <Icon name="loader" className="h-5 w-5 animate-spin text-faint" />
                  กำลังค้นหา…
                </>
              ) : failed ? (
                <>
                  <Icon name="alert-circle" className="h-5 w-5 text-bad" />
                  <span className="text-bad">
                    ค้นหาไม่สำเร็จ ·{" "}
                    {/* min-h-10: a 40px target on a phone, where this dialog fills the screen */}
                    <button
                      type="button"
                      onClick={retrySearch}
                      className="-mx-1.5 inline-flex min-h-10 items-center rounded-md px-1.5 underline underline-offset-2 hover:text-foreground md:min-h-7"
                    >
                      ลองใหม่
                    </button>
                  </span>
                </>
              ) : (
                <>
                  <Icon name="search" className="h-5 w-5 text-faint" />
                  ไม่พบไอเทมในตลาดที่ชื่อตรงกับคำนี้
                </>
              )}
            </div>
          )}
          {/* rows hold their cells directly (no wrapper), as the grid role expects; the bottom padding
              keeps the last row clear of the phone's home indicator (the dialog is full screen there) */}
          <div
            id={LIST_ID}
            role="grid"
            aria-label="ผลการค้นหา"
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] md:max-h-[60vh] md:flex-none md:pb-1.5"
          >
            {showPages &&
              pageHits.map((p, i) => (
                <div key={p.href} role="row" onMouseEnter={() => setActive(i)}>
                  <div id={optId(i)} role="gridcell" aria-selected={i === sel}>
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => go(p.href)}
                      className={`flex min-h-11 w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors duration-150 md:min-h-10 ${
                        i === sel ? "bg-panel-2 text-foreground" : "hover:bg-panel-2/60"
                      }`}
                    >
                      <Icon name={p.icon} className={`h-[18px] w-[18px] ${i === sel ? "text-accent" : "text-muted"}`} />
                      <span>
                        <span className="text-muted">ไปหน้า</span> {p.label}
                      </span>
                    </button>
                  </div>
                </div>
              ))}
            {!showPages &&
              hits.map((h, i) => (
                <div
                  key={h.id}
                  role="row"
                  className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors duration-150 ${i === sel ? "bg-panel-2" : "hover:bg-panel-2/60"}`}
                  onMouseEnter={() => setActive(i)}
                >
                  <div id={optId(i)} role="gridcell" aria-selected={i === sel} className="flex min-w-0 flex-1 items-center gap-2.5">
                    <ItemIcon id={h.id} grade={h.grade} size={28} />
                    <button type="button" tabIndex={-1} onClick={() => openHit(h)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate font-medium">{h.th}</span>
                      {/* มีสูตร sits on this line, so the name keeps the whole width on a phone */}
                      <span className="num line-clamp-2 text-xs text-muted">
                        {h.hasRecipe && (
                          <Badge tone="accent" className="mr-1">
                            มีสูตร
                          </Badge>
                        )}
                        {silver(h.price)} · ค้างขาย {silver(h.stock)}
                        {h.en ? ` · ${h.en}` : ""}
                      </span>
                    </button>
                  </div>
                  <div role="gridcell" className="flex shrink-0 gap-2 md:gap-1">
                    {h.hasRecipe && (
                      <button type="button" onClick={() => toRecipes(h)} aria-label={`สูตร ${h.th}`} className={btn("secondary", "sm")}>
                        สูตร
                      </button>
                    )}
                    <button type="button" onClick={() => toMarket(h)} aria-label={`ตลาด ${h.th}`} className={btn("secondary", "sm")}>
                      ตลาด
                    </button>
                    <button type="button" onClick={() => toCalc(h)} aria-label={`คิดภาษี ${h.th}`} className={btn("secondary", "sm")}>
                      คิดภาษี
                    </button>
                  </div>
                </div>
              ))}
          </div>
          {/* the keys, as key caps; the arrows here are the names of keys, not icons */}
          <div className="hidden flex-wrap items-center gap-x-3 gap-y-1 border-t border-border bg-panel-2/40 px-4 py-2 text-xs text-faint md:flex">
            <span>
              <kbd className={KBD}>↑</kbd> <kbd className={KBD}>↓</kbd> เลือก
            </span>
            <span>
              <kbd className={KBD}>Enter</kbd> เปิดสูตร (ไม่มีสูตร = ตลาด)
            </span>
            <span>
              <kbd className={KBD}>Shift+Enter</kbd> ดูในตลาด
            </span>
            <span>
              <kbd className={KBD}>Esc</kbd> ปิด
            </span>
          </div>
        </div>
      </dialog>
    </>
  );
}
