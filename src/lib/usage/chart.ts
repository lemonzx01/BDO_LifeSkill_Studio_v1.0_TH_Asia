/** Geometry for the daily-visitors column chart (src/components/admin/UsageChart.tsx). */

/** 0 and up to four round steps that cover `max`: 0 / 5 / 10 / 15, 0 / 200 / 400… (whole numbers only) */
export function yTicks(max: number): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow);
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}

/** A column with 4px rounded corners at its top and a square foot on the baseline. */
export function columnPath(x: number, y: number, w: number, h: number): string {
  const r = Math.max(0, Math.min(4, w / 2, h));
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/**
 * Which days get a date under the axis: every `step`-th day counted back from the newest, so the
 * newest day is always labelled and labels sit at least `minPx` apart.
 */
export function labelStep(bandPx: number, minPx = 64): number {
  return Math.max(1, Math.ceil(minPx / Math.max(bandPx, 0.0001)));
}
