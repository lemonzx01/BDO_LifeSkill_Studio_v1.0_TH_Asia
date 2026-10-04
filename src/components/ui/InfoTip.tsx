"use client";

import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Icon } from "./Icon";

/** the popover's width (14rem); fixed so it can be placed before it renders */
const WIDTH = 224;
/** space kept between the popover and the screen edge / the button */
const EDGE = 8;
const GAP = 6;
/** below this much room under the button (the phone tab bar is ~72px), open upwards */
const ROOM_BELOW = 140;
/** how long a hover-opened tip waits after the mouse leaves, so the mouse can cross onto it */
const HOVER_GRACE = 150;

type Pos = { left: number; top: number; bottom?: undefined } | { left: number; bottom: number; top?: undefined };

/**
 * A small help-circle icon after a label that explains it in one line (texts in lib/glossary).
 *
 * - mouse: shows while the pointer is on it or on its text; a click keeps it open, a second
 *   click closes it
 * - tap, Enter or Space: opens, and the same again closes
 * - Escape, a tap anywhere else, a scroll or a resize closes it
 *
 * The text comes right after the button in the page, so a screen reader reaches it next; the
 * button also points at it (aria-describedby) while it is open. It is drawn fixed to the screen
 * and kept inside it, so a table that scrolls sideways or a narrow phone tile cannot cut it off.
 */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const [pinned, setPinned] = useState(false);
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();
  const open = (pinned || hover) && pos !== null;

  const cancelLeave = () => {
    if (leaveTimer.current !== null) clearTimeout(leaveTimer.current);
    leaveTimer.current = null;
  };
  /** the mouse left the button or the text: hide a hover-opened tip unless it comes back soon */
  const leaveSoon = (e: ReactPointerEvent) => {
    if (e.pointerType !== "mouse") return;
    cancelLeave();
    leaveTimer.current = setTimeout(() => {
      leaveTimer.current = null;
      setHover(false);
    }, HOVER_GRACE);
  };
  useEffect(
    () => () => {
      if (leaveTimer.current !== null) clearTimeout(leaveTimer.current);
    },
    [],
  );

  /** where to draw it: centred under the button (over it near the bottom), inside the screen */
  const place = () => {
    const b = btnRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const left = Math.max(EDGE, Math.min(r.left + r.width / 2 - WIDTH / 2, vw - WIDTH - EDGE));
    setPos(window.innerHeight - r.bottom >= ROOM_BELOW ? { left, top: r.bottom + GAP } : { left, bottom: window.innerHeight - r.top + GAP });
  };

  useEffect(() => {
    if (!pinned && !hover) return;
    const close = () => {
      setPinned(false);
      setHover(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (t && (btnRef.current?.contains(t) || tipRef.current?.contains(t))) return;
      close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // only this popover closes: not a dialog or drawer it sits in
      e.preventDefault();
      e.stopPropagation();
      close();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [pinned, hover]);

  return (
    <span className="relative inline-flex align-middle">
      <button
        ref={btnRef}
        type="button"
        aria-label={`ความหมายของ ${label}`}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-describedby={open ? id : undefined}
        onClick={(e) => {
          // never also open or sort the row / header it sits in
          e.stopPropagation();
          // a click keeps open what hovering showed, so it never hides what the member just reached for
          if (pinned) {
            setPinned(false);
            setHover(false);
          } else {
            if (!open) place();
            setPinned(true);
          }
        }}
        onPointerEnter={(e) => {
          if (e.pointerType !== "mouse") return;
          cancelLeave();
          if (!open) place();
          setHover(true);
        }}
        onPointerLeave={leaveSoon}
        // 24px to look at; on a touch screen the ::before widens what a finger can hit to 40px
        className={`relative -my-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors duration-150 before:absolute before:inset-0 before:content-[''] hover:text-foreground pointer-coarse:before:-inset-2 ${
          open ? "text-accent" : "text-faint"
        }`}
      >
        <Icon name="help-circle" className="h-4 w-4" />
      </button>
      {open && (
        <span
          ref={tipRef}
          id={id}
          role="tooltip"
          // the mouse can move onto the text and stay there to read or select it
          onPointerEnter={(e) => {
            if (e.pointerType === "mouse") cancelLeave();
          }}
          onPointerLeave={leaveSoon}
          style={{ left: pos.left, top: pos.top, bottom: pos.bottom, width: WIDTH }}
          className="fixed z-50 animate-fade-in rounded-lg border border-border-strong bg-panel-3 px-3 py-2 text-left text-xs font-normal whitespace-normal text-foreground shadow-pop"
        >
          {children}
        </span>
      )}
    </span>
  );
}

/** A label with its help icon after it, for a table header or a <Stat> label: "กำไร/ชิ้น (?)". */
export function WithTip({ label, tip }: { label: string; tip: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {label}
      <InfoTip label={label}>{tip}</InfoTip>
    </span>
  );
}
