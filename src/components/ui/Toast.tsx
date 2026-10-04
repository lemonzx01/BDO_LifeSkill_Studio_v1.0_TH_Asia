"use client";

import { useSyncExternalStore } from "react";
import { btnShape, iconBtn } from "./button";
import { Icon, type IconName } from "./Icon";

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

// an icon as well as the colour, so the tone never rests on colour alone
const MARK: Record<ToastTone, { icon: IconName; cls: string }> = {
  good: { icon: "check-circle", cls: "text-good" },
  info: { icon: "info", cls: "text-info" },
  bad: { icon: "alert-circle", cls: "text-bad" },
};

/**
 * Fixed above the phone tab bar (bottom right of the page from md up). Rendered once, by Page.
 * Each message rises in (200ms); it leaves at once, without an exit animation.
 */
export function ToastHost() {
  const list = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:px-6"
      onPointerEnter={() => pause(true)}
      onPointerLeave={() => pause(false)}
      onFocus={() => pause(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) pause(false);
      }}
    >
      {list.map((t) => {
        const m = MARK[t.tone ?? "good"];
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex w-full max-w-sm animate-rise-in items-center gap-2.5 rounded-xl border border-border-strong bg-panel py-1.5 pl-3.5 pr-1.5 text-sm text-foreground shadow-pop"
          >
            <Icon name={m.icon} className={`h-5 w-5 ${m.cls}`} />
            <span className="min-w-0 flex-1 py-1.5">{t.text}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick();
                  close(t.id);
                }}
                className={`${btnShape("sm")} text-accent hover:bg-panel-2`}
              >
                {t.action.label}
              </button>
            )}
            <button type="button" onClick={() => close(t.id)} aria-label="ปิด" title="ปิด" className={iconBtn("ghost", "sm")}>
              <Icon name="x" className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
