import { pct, readsAsZero, signed, silver, silverShort } from "@/lib/format";

export type ProfitTone = "good" | "bad" | "muted";

/** Green above zero, red below, grey at zero or when the number cannot be trusted. */
export function profitTone(n: number, unknown = false): ProfitTone {
  if (unknown || !Number.isFinite(n) || n === 0) return "muted";
  return n > 0 ? "good" : "bad";
}

const TONE_CLS: Record<ProfitTone, string> = { good: "text-good", bad: "text-bad", muted: "text-muted" };

/** The colour class for a profit-like number, matching <Money tone="profit">. */
function profitCls(n: number, unknown = false): string {
  return TONE_CLS[profitTone(n, unknown)];
}

/** profitTone for a ratio shown as a percentage: grey when it reads "0%" at `digits` decimals (0.004 -> "0%"). */
export function pctTone(ratio: number, digits = 0, unknown = false): ProfitTone {
  return profitTone(readsAsZero(pct(ratio, digits)) ? 0 : ratio, unknown);
}

/** The colour class for a percentage cell (ROI), matching signedPct(ratio, digits). */
export function pctCls(ratio: number, digits = 0, unknown = false): string {
  return TONE_CLS[pctTone(ratio, digits, unknown)];
}

/**
 * A silver amount. tone "profit" adds the sign and the colour (green / red, grey at zero);
 * "plain" keeps the surrounding text colour. `unknown` shows a grey "?" (a cost is missing).
 *
 * Desktop tables use full silver in every money column; `compact` (1.23M) is for phone cards and
 * grey secondary lines only.
 */
export function Money({
  value,
  tone = "plain",
  compact = false,
  unknown = false,
  suffix,
  className = "",
}: {
  value: number;
  tone?: "profit" | "plain";
  compact?: boolean;
  unknown?: boolean;
  /** a unit after the number, e.g. "/ชิ้น" */
  suffix?: string;
  /** layout only (e.g. "block"); the colour comes from `tone` */
  className?: string;
}) {
  if (unknown) return <span className={`num whitespace-nowrap text-muted ${className}`}>?</span>;
  const fmt = compact ? silverShort : silver;
  const profit = tone === "profit";
  const text = profit ? signed(value, fmt) : fmt(value);
  // colour by the value as shown: 0.3 reads "0", so it is grey, not green
  return (
    <span className={`num whitespace-nowrap ${profit ? profitCls(readsAsZero(text) ? 0 : value) : ""} ${className}`}>
      {text}
      {suffix}
    </span>
  );
}
