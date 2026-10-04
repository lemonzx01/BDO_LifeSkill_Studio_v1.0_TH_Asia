import type { ReactNode } from "react";

export type StatTone = "good" | "bad" | "muted";

const VALUE_TONE: Record<StatTone | "default" | "emphasis", string> = {
  default: "text-foreground",
  emphasis: "text-accent",
  good: "text-good",
  bad: "text-bad",
  muted: "text-muted",
};

/**
 * One number with a small label above it, in a tile. Lay tiles out in a grid, two across on a
 * phone: `grid grid-cols-2 gap-2 sm:grid-cols-4`.
 *
 * `emphasis` is for the one figure in a group that matters most (e.g. กำไร/ชิ้น): a larger value,
 * gold unless `tone` (or a <Money> value, which brings its own colour) says otherwise, and a gold
 * border. The value is sized by the tile's own width (a container query), not the screen's, since
 * the same tile sits in a phone grid, a 4-across row and the narrow recipe side pane: a ~150px tile
 * holds "1,234,567,890" at text-base. A figure too long even for that breaks between digits
 * (wrap-anywhere, which also overrides <Money>'s nowrap) rather than spill over the border.
 */
export function Stat({
  label,
  value,
  tone,
  emphasis = false,
  hint,
  className = "",
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: StatTone;
  emphasis?: boolean;
  /** a small grey line under the value (e.g. "ต่อชั่วโมง", a comparison, the sell price) */
  hint?: ReactNode;
  /** spacing only */
  className?: string;
}) {
  return (
    <div className={`@container min-w-0 rounded-xl border bg-panel-2/60 p-3 ${emphasis ? "border-accent/40" : "border-border"} ${className}`}>
      <div className="text-xs text-muted">{label}</div>
      <div
        className={`num mt-0.5 font-semibold wrap-anywhere [&_span]:whitespace-normal ${emphasis ? "text-base @[12rem]:text-xl @[16rem]:text-2xl" : "text-base @[12rem]:text-lg @[16rem]:text-xl"} ${VALUE_TONE[tone ?? (emphasis ? "emphasis" : "default")]}`}
      >
        {value}
      </div>
      {/* muted, not faint: a hint can carry a real figure (ราคาขาย 12,345) */}
      {hint && <div className="num mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}
