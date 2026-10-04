/**
 * One look for every button-like control. These return class strings, so the same look works on
 * <button>, <Link>, <a> and the <label> that wraps a file input.
 *
 * Use size "md" for page actions, "sm" for buttons inside rows, cards and lists, and "lg" for the
 * one big action of a form (sign in, save). Every size is at least 40px tall on phones so it is easy
 * to tap, and compact from the md breakpoint up. One primary button per view: gold means "act here".
 *
 * An icon goes inside as a child (<Icon name="plus" className="h-4 w-4" />); the gap is built in.
 * For a button that is only an icon, use iconBtn() and give it an aria-label.
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "dangerGhost";
export type ButtonSize = "sm" | "md" | "lg";
/** "start" left-aligns the label, for a full-width row in a menu (add w-full at the call site). */
export type ButtonAlign = "center" | "start";

const SHAPE =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-colors duration-150 ease-out disabled:pointer-events-none disabled:opacity-50";

const ALIGN: Record<ButtonAlign, string> = {
  center: "justify-center",
  start: "justify-start text-left",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "min-h-10 md:min-h-8 px-2.5 text-xs",
  md: "min-h-10 md:min-h-9 px-3.5 text-sm",
  lg: "min-h-11 md:min-h-10 px-5 text-sm",
};

/** square, for iconBtn(): the same heights as SIZE */
const SQUARE: Record<ButtonSize, string> = {
  sm: "h-10 w-10 md:h-8 md:w-8",
  md: "h-10 w-10 md:h-9 md:w-9",
  lg: "h-11 w-11 md:h-10 md:w-10",
};

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent shadow-sm hover:bg-accent-hover",
  secondary: "border border-border-strong bg-panel-2 text-foreground hover:bg-panel-3",
  ghost: "text-muted hover:bg-panel-2 hover:text-foreground",
  danger: "border border-bad/45 bg-bad/12 text-bad hover:bg-bad/20",
  /** a quiet destructive action inside a row (e.g. remove one item): grey until hovered, then red */
  dangerGhost: "text-muted hover:bg-bad/12 hover:text-bad",
};

/** Shape and size of a button, without colours: pair it with toggleCls(). */
export function btnShape(size: ButtonSize = "md", align: ButtonAlign = "center"): string {
  return `${SHAPE} ${ALIGN[align]} ${SIZE[size]}`;
}

export function btn(variant: ButtonVariant, size: ButtonSize = "md", align: ButtonAlign = "center"): string {
  return `${SHAPE} ${ALIGN[align]} ${SIZE[size]} ${VARIANT[variant]}`;
}

/**
 * A square button that holds only an icon (close, remove, settings). Same heights as btn(); always
 * give it an aria-label (and a title for mouse users).
 */
export function iconBtn(variant: ButtonVariant = "ghost", size: ButtonSize = "md"): string {
  return `inline-flex shrink-0 items-center justify-center rounded-lg transition-colors duration-150 ease-out disabled:pointer-events-none disabled:opacity-50 ${SQUARE[size]} ${VARIANT[variant]}`;
}

/**
 * Colours for an on/off control (a panel that is open, the option that is chosen). Border and
 * colours only, so it fits a normal button (`${btnShape()} ${toggleCls(on)}`) or a custom layout.
 * Off looks like a secondary button. Give the element aria-pressed={on} as well.
 */
export function toggleCls(on: boolean): string {
  return on ? "border border-accent/60 bg-accent/12 text-accent" : "border border-border-strong bg-panel-2 text-foreground hover:bg-panel-3";
}
