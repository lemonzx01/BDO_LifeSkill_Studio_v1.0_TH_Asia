"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { fetchJson, isAbort } from "@/lib/fetch-error";
import { silver } from "@/lib/format";
import { ItemIcon } from "./ItemIcon";
import { btn } from "./ui/button";
import { fieldCls } from "./ui/field";

interface Hit {
  id: number;
  th: string;
  en: string | null;
  price: number;
  stock: number;
  grade: number;
}

const PAGES = [
  { href: "/", label: "หน้าแรก" },
  { href: "/recipes", label: "คำนวณสูตร" },
  { href: "/market", label: "สแกนตลาด" },
  { href: "/inventory", label: "คลังของ" },
  { href: "/calc", label: "คิดภาษี" },
  { href: "/help", label: "วิธีใช้" },
];

/**
 * Ctrl+K from any page: type an item name, jump to its recipes, its market
 * row or the tax calculator. Searches the market snapshot on the server, so
 * nothing heavy is loaded until the box is opened.
 *
 * `compact`: the header version. Below md it is a 40x40 ⌕ button next to the avatar; from md up
 * the "ค้นหา" label (lg) and the Ctrl K hint (xl) come back as room allows. Render one per page:
 * each instance listens for Ctrl+K.
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
  const inputRef = useRef<HTMLInputElement>(null);

  // keyboard shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // a modal <dialog> (settings drawer, confirm) is open: the search would open behind it, out of
      // reach, so it waits until that is closed
      if (document.querySelector("dialog[open]")) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // focus the box when it opens, reset when it closes
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

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
        })
        .catch((e) => {
          if (isAbort(e)) return;
          setHits([]);
          setFailed(true);
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

  const showPages = q.trim().length < 2;
  const pageHits = showPages ? PAGES.filter((p) => !q.trim() || p.label.includes(q.trim())) : [];
  const count = showPages ? pageHits.length : hits.length;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (count ? (a + 1) % count : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (count ? (a - 1 + count) % count : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (showPages) {
        const p = pageHits[active];
        if (p) go(p.href);
      } else {
        const h = hits[active];
        if (h) (e.shiftKey ? toMarket : toRecipes)(h);
      }
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          compact
            ? "flex h-10 w-10 items-center justify-center gap-1.5 rounded-full border border-border bg-panel text-lg text-muted hover:text-foreground md:h-8 md:w-auto md:rounded md:px-2.5 md:text-sm"
            : "flex items-center gap-1.5 rounded border border-border bg-panel px-2.5 py-1.5 text-sm text-muted hover:text-foreground"
        }
        title="ค้นหาไอเทมจากทุกหน้า (Ctrl+K)"
        aria-label="ค้นหาด่วน"
        aria-haspopup="dialog"
      >
        <span aria-hidden>⌕</span>
        <span className={compact ? "hidden lg:inline" : "hidden sm:inline"}>ค้นหา</span>
        <kbd className={`hidden rounded border border-border bg-panel-2 px-1 text-[10px] text-muted ${compact ? "xl:inline" : "md:inline"}`}>Ctrl K</kbd>
      </button>

      {open && (
        // z-[60]: above the header menus (z-40) and the toasts (z-50)
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 p-3 pt-[12vh]" onClick={() => setOpen(false)} role="presentation">
          <div
            className="w-full max-w-lg overflow-hidden rounded-lg border border-border bg-panel shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="ค้นหาด่วน"
          >
            <div className="border-b border-border p-2">
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                aria-label="ชื่อไอเทมหรือหน้า"
                placeholder="พิมพ์ชื่อไอเทม… (Enter = ดูสูตร, Shift+Enter = ดูในตลาด)"
                className={fieldCls()}
              />
            </div>
            <ul className="max-h-[60vh] overflow-y-auto">
              {showPages &&
                pageHits.map((p, i) => (
                  <li key={p.href}>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(p.href)}
                      className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm ${i === active ? "bg-panel-2" : "hover:bg-panel-2/60"}`}
                    >
                      <span className="text-muted">ไปหน้า</span> {p.label}
                    </button>
                  </li>
                ))}
              {!showPages && hits.length === 0 && (
                <li role="status" className="px-4 py-6 text-center text-sm text-muted">
                  {busy ? (
                    "กำลังค้นหา…"
                  ) : failed ? (
                    <span className="text-bad">
                      ค้นหาไม่สำเร็จ ·{" "}
                      <button type="button" onClick={() => setAttempt((a) => a + 1)} className="underline hover:text-foreground">
                        ลองใหม่
                      </button>
                    </span>
                  ) : (
                    "ไม่พบไอเทมในตลาดที่ชื่อตรงกับคำนี้"
                  )}
                </li>
              )}
              {!showPages &&
                hits.map((h, i) => (
                  <li key={h.id} className={`${i === active ? "bg-panel-2" : ""}`} onMouseEnter={() => setActive(i)}>
                    <div className="flex items-center gap-2 px-4 py-2 text-sm">
                      <ItemIcon id={h.id} grade={h.grade} size={28} />
                      <button type="button" onClick={() => toRecipes(h)} className="min-w-0 flex-1 text-left">
                        <div className="truncate font-medium">{h.th}</div>
                        <div className="line-clamp-2 text-xs text-muted">
                          {silver(h.price)} · ค้างขาย {silver(h.stock)}
                          {h.en ? ` · ${h.en}` : ""}
                        </div>
                      </button>
                      <div className="flex shrink-0 gap-1">
                        <button type="button" onClick={() => toRecipes(h)} className={btn("secondary", "sm")}>
                          สูตร
                        </button>
                        <button type="button" onClick={() => toMarket(h)} className={btn("secondary", "sm")}>
                          ตลาด
                        </button>
                        <button type="button" onClick={() => toCalc(h)} className={btn("secondary", "sm")}>
                          คิดภาษี
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
            </ul>
            <div className="border-t border-border px-4 py-1.5 text-xs text-muted">↑↓ เลือก · Enter ดูสูตร · Shift+Enter ดูในตลาด · Esc ปิด</div>
          </div>
        </div>
      )}
    </>
  );
}
