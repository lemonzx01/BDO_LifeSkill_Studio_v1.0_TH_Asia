/**
 * One look for every button-like control. These return class strings, so the same look works on
 * <button>, <Link>, <a> and the <label> that wraps a file input.
 *
 * Use size "md" for page actions and "sm" for buttons inside rows, cards and lists. Both are at
 * least 36px tall on phones so they are easy to tap, and compact from the md breakpoint up.
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "dangerGhost";
export type ButtonSize = "sm" | "md";

const SHAPE = "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded font-medium transition-colors disabled:pointer-events-none disabled:opacity-50";

const SIZE: Record<ButtonSize, string> = {
  md: "min-h-10 md:min-h-9 px-3 text-sm",
  sm: "min-h-9 md:min-h-8 px-2.5 text-xs",
};

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent text-black hover:bg-accent-hover",
  secondary: "border border-border bg-panel text-foreground hover:bg-panel-2",
  ghost: "text-muted hover:bg-panel-2 hover:text-foreground",
  danger: "border border-bad/40 bg-bad/10 text-bad hover:bg-bad/20",
  /** a quiet destructive action inside a row (e.g. remove one item): grey until hovered, then red */
  dangerGhost: "text-muted hover:bg-bad/10 hover:text-bad",
};

/** Shape and size of a button, without colours: pair it with toggleCls(). */
export function btnShape(size: ButtonSize = "md"): string {
  return `${SHAPE} ${SIZE[size]}`;
}

export function btn(variant: ButtonVariant, size: ButtonSize = "md"): string {
  return `${SHAPE} ${SIZE[size]} ${VARIANT[variant]}`;
}

/**
 * Colours for an on/off control (a panel that is open, the option that is chosen). Border and
 * colours only, so it fits a normal button (`${btnShape()} ${toggleCls(on)}`) or a custom layout.
 * Give the element aria-pressed={on} as well.
 */
export function toggleCls(on: boolean): string {
  return on ? "border border-accent bg-accent/10 text-accent" : "border border-border bg-panel text-foreground hover:bg-panel-2";
}
