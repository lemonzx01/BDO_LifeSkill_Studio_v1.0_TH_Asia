"use client";

import { useSyncExternalStore } from "react";
import { btnShape } from "./button";

/**
 * Short "done" messages that go away by themselves, with an optional เลิกทำ (undo). Call toast()
 * from any event handler; the one <ToastHost> that Page renders shows them.
 *
 * A message stays 6 seconds, longer while the pointer or keyboard focus is on it, so there is time
 * to reach its button.
 */

export type ToastTone = "good" | "info" | "bad";

export interface ToastInput {
  text: string;
  tone?: ToastTone;
  /** one button, e.g. { label: "เลิกทำ", onClick: undo }; the message closes when it is pressed */
  action?: { label: string; onClick: () => void };
}

interface ToastItem extends ToastInput {
  id: number;
}

const LIFE_MS = 6000;
const MAX = 3;

let items: readonly ToastItem[] = [];
let nextId = 0;
let paused = false;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function emit() {
  for (const fn of listeners) fn();
}

function arm(id: number) {
  timers.set(
    id,
    setTimeout(() => dismissToast(id), LIFE_MS),
  );
}

/** Shows a message; returns its id (for dismissToast). */
export function toast(input: ToastInput): number {
  const id = ++nextId;
  const dropped = items.slice(0, Math.max(0, items.length - (MAX - 1)));
  for (const t of dropped) {
    clearTimeout(timers.get(t.id));
    timers.delete(t.id);
  }
  items = [...items.slice(dropped.length), { ...input, id }];
  if (!paused) arm(id);
  emit();
  return id;
}

export function dismissToast(id: number) {
  clearTimeout(timers.get(id));
  timers.delete(id);
  if (!items.some((t) => t.id === id)) return;
  items = items.filter((t) => t.id !== id);
  // nothing left to hover or focus: the next message must time out normally
  if (items.length === 0) paused = false;
  emit();
}

/**
 * Closes every message that has a button (e.g. เลิกทำ). Called when a page's data goes away
 * (UserDataProvider unmounting), since such a button acts on that page's data.
 */
export function dismissActionToasts() {
  for (const t of items) if (t.action) dismissToast(t.id);
}

/** While the member is on a message, none of them time out; leaving restarts the full time. */
function pause(on: boolean) {
  if (paused === on) return;
  paused = on;
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
  if (!on) for (const t of items) arm(t.id);
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
const getSnapshot = () => items;
const EMPTY: readonly ToastItem[] = [];
const getServerSnapshot = () => EMPTY;

/**
 * Closing one by its own button: the button (and its focus) goes away without a blur event, so
 * the others start their time again here.
 */
function close(id: number) {
  dismissToast(id);
  pause(false);
}

const GLYPH: Record<ToastTone, { mark: string; cls: string }> = {
  good: { mark: "✓", cls: "text-good" },
  info: { mark: "ℹ︎", cls: "text-info" },
  bad: { mark: "⊘", cls: "text-bad" },
};

/** Fixed above the phone tab bar (bottom right of the page from md up). Rendered once, by Page. */
export function ToastHost() {
  const list = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-3 md:bottom-4 md:items-end md:px-6"
      onPointerEnter={() => pause(true)}
      onPointerLeave={() => pause(false)}
      onFocus={() => pause(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) pause(false);
      }}
    >
      {list.map((t) => {
        const g = GLYPH[t.tone ?? "good"];
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex w-full max-w-sm items-center gap-2 rounded-lg border border-border bg-panel-2 py-1.5 pl-3 pr-1.5 text-sm text-foreground shadow-lg"
          >
            <span aria-hidden className={`w-4 shrink-0 text-center ${g.cls}`}>
              {g.mark}
            </span>
            <span className="min-w-0 flex-1 py-1">{t.text}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick();
                  close(t.id);
                }}
                className={`${btnShape("sm")} text-accent hover:bg-panel`}
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => close(t.id)}
              aria-label="ปิด"
              title="ปิด"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded text-lg leading-none text-muted hover:bg-panel hover:text-foreground md:h-8 md:w-8"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
