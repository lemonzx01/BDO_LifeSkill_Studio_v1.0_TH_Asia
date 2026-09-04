"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { silver } from "@/lib/format";
import { ItemIcon } from "./ItemIcon";

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
 */
export function QuickSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // keyboard shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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
      }, 0);
      return () => clearTimeout(t);
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setBusy(true);
      fetch(`/api/market/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? (r.json() as Promise<{ items: Hit[] }>) : Promise.reject(new Error(String(r.status)))))
        .then((j) => {
          setHits(j.items ?? []);
          setActive(0);
        })
        .catch(() => {})
        .finally(() => setBusy(false));
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

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
        className="flex items-center gap-1.5 rounded border border-border bg-panel px-2.5 py-1.5 text-sm text-muted hover:text-foreground"
        title="ค้นหาไอเทมจากทุกหน้า (Ctrl+K)"
        aria-label="ค้นหาด่วน"
      >
        <span aria-hidden>⌕</span>
        <span className="hidden sm:inline">ค้นหา</span>
        <kbd className="hidden rounded border border-border bg-panel-2 px-1 text-[10px] text-muted md:inline">Ctrl K</kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-3 pt-[12vh]" onClick={() => setOpen(false)} role="presentation">
          <div
            className="w-full max-w-lg overflow-hidden rounded-lg border border-border bg-panel shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="ค้นหาด่วน"
          >
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="พิมพ์ชื่อไอเทม… (Enter = ดูสูตร, Shift+Enter = ดูในตลาด)"
              className="w-full border-b border-border bg-transparent px-4 py-3 text-sm outline-none"
            />
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
                <li className="px-4 py-6 text-center text-sm text-muted">{busy ? "กำลังค้นหา…" : "ไม่พบไอเทมในตลาดที่ชื่อตรงกับคำนี้"}</li>
              )}
              {!showPages &&
                hits.map((h, i) => (
                  <li key={h.id} className={`${i === active ? "bg-panel-2" : ""}`} onMouseEnter={() => setActive(i)}>
                    <div className="flex items-center gap-2 px-4 py-2 text-sm">
                      <ItemIcon id={h.id} grade={h.grade} size={28} />
                      <button type="button" onClick={() => toRecipes(h)} className="min-w-0 flex-1 text-left">
                        <div className="truncate font-medium">{h.th}</div>
                        <div className="truncate text-[11px] text-muted">
                          {silver(h.price)} · ค้างขาย {silver(h.stock)}
                          {h.en ? ` · ${h.en}` : ""}
                        </div>
                      </button>
                      <div className="flex shrink-0 gap-1">
                        <button type="button" onClick={() => toRecipes(h)} className="rounded border border-border px-2 py-0.5 text-xs hover:bg-panel">
                          สูตร
                        </button>
                        <button type="button" onClick={() => toMarket(h)} className="rounded border border-border px-2 py-0.5 text-xs hover:bg-panel">
                          ตลาด
                        </button>
                        <button type="button" onClick={() => toCalc(h)} className="rounded border border-border px-2 py-0.5 text-xs hover:bg-panel">
                          คิดภาษี
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
            </ul>
            <div className="border-t border-border px-4 py-1.5 text-[11px] text-muted">↑↓ เลือก · Enter ดูสูตร · Shift+Enter ดูในตลาด · Esc ปิด</div>
          </div>
        </div>
      )}
    </>
  );
}
