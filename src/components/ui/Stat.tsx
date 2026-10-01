import type { ReactNode } from "react";

export type StatTone = "good" | "bad" | "muted";

const VALUE_TONE: Record<StatTone | "default", string> = {
  default: "text-foreground",
  good: "text-good",
  bad: "text-bad",
  muted: "text-muted",
};

/**
 * One number with a small label above it. `emphasis` makes the value larger: use it for the one
 * figure in a group that matters most (e.g. กำไร/ชิ้น). A <Money> value brings its own colour.
 * The larger size starts at sm: on a phone the tile is ~120px wide and a full-silver figure such
 * as "+1,234,567,890" cannot break, so text-lg there would run into the next tile.
 */
export function Stat({ label, value, tone, emphasis = false }: { label: ReactNode; value: ReactNode; tone?: StatTone; emphasis?: boolean }) {
  return (
    <div className="rounded border border-border bg-panel-2/60 px-2.5 py-2">
      <div className="text-xs text-muted">{label}</div>
      <div className={`num font-semibold ${emphasis ? "text-base sm:text-lg" : ""} ${VALUE_TONE[tone ?? "default"]}`}>{value}</div>
    </div>
  );
}
