/**
 * One look for text, number and select fields. Every field sits on bg-panel-2, so it reads as a
 * field on a panel and on the page background alike. Phones get 16px text (no iOS zoom on focus).
 *
 * - "md": a normal form field; inputs fill their container (add width classes at the call site
 *   for a field in a toolbar, e.g. "min-w-[200px] flex-1").
 * - "sm": a number cell inside a table; give it a width at the call site (e.g. "w-24").
 */
export type FieldSize = "sm" | "md";

// outline-hidden (not outline-none): the ring below is a box-shadow, which Windows high-contrast
// mode drops; outline-hidden leaves a transparent outline there that the system then draws
const BASE =
  "rounded border border-border bg-panel-2 text-foreground outline-hidden placeholder:text-muted/70 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 disabled:opacity-50";
/** a select that is narrowing the list right now: accent border and text, like an "on" toggle */
const BASE_ON =
  "rounded border border-accent bg-accent/10 text-accent outline-hidden focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 disabled:opacity-50";

const SIZE: Record<FieldSize, string> = {
  md: "min-h-10 md:min-h-9 px-3 text-base md:text-sm",
  sm: "h-9 md:h-8 px-2 text-base md:text-sm",
};

export function fieldCls(size: FieldSize = "md"): string {
  return size === "md" ? `w-full ${BASE} ${SIZE.md}` : `${BASE} ${SIZE.sm} num text-right`;
}

/**
 * A <select>: our own chevron (select-chevron in globals.css) with room for it on the right.
 * Selects size to their content; add w-full where one should fill its cell. `on` marks a filter
 * that is active (anything but "all").
 */
export function selectCls(size: FieldSize = "md", on = false): string {
  return `${on ? BASE_ON : BASE} ${SIZE[size]} select-chevron pr-8`;
}

/**
 * A <select> in a narrow grid cell (the skill tiers in Settings): the md height with less side
 * padding and a smaller chevron, so a short Thai label still fits. Add w-full at the call site.
 */
export function selectTightCls(): string {
  return `${BASE} min-h-10 md:min-h-9 pl-2 pr-6 text-base md:text-sm select-chevron select-chevron-tight`;
}

export const checkboxCls = "h-4 w-4 accent-accent";
