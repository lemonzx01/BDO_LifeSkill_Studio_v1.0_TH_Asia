import { silver } from "@/lib/format";

const W = 280;
const H = 56;
const PAD = 3;

export type SparklineTone = "accent" | "muted" | "trend";

// full literal strings: Tailwind cannot see class names built at runtime
const STROKE = { accent: "stroke-accent", muted: "stroke-muted", good: "stroke-good", bad: "stroke-bad" } as const;
const FILL = { accent: "fill-accent/10", muted: "fill-muted/10", good: "fill-good/10", bad: "fill-bad/10" } as const;

/**
 * Price history as a small line: a 10% fill under it and a dashed line at the average. Screen
 * readers get the low / average / high instead of the drawing.
 *
 * - tone "accent" (default): a gold line. "muted": a grey line, for a series whose direction is
 *   neither good nor bad news by itself (e.g. listed stock). "trend": green when the last point is
 *   at or above the first, red when below (the words around it still say which way it went).
 * - `className` sizes it: "h-14 w-full" by default; "h-8 w-24" in a table column.
 * - `avg={false}` drops the dashed average, for a tiny one.
 */
export function Sparkline({
  data,
  tone = "accent",
  avg: showAvg = true,
  label = "ราคา 90 วัน",
  className = "h-14 w-full",
}: {
  data: number[];
  tone?: SparklineTone;
  avg?: boolean;
  /** what the line is, read out before the numbers */
  label?: string;
  className?: string;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const avg = data.reduce((a, b) => a + b, 0) / data.length;
  const span = max - min || 1;
  const x = (i: number) => (i / (data.length - 1)) * W;
  const y = (v: number) => H - ((v - min) / span) * (H - 2 * PAD) - PAD;
  const line = data.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const avgY = y(avg);
  const key = tone !== "trend" ? tone : data[data.length - 1] >= data[0] ? "good" : "bad";
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      preserveAspectRatio="none"
      role="img"
      aria-label={`${label} ต่ำสุด ${silver(min)} เฉลี่ย ${silver(avg)} สูงสุด ${silver(max)}`}
    >
      <polygon points={`0,${H} ${line} ${W},${H}`} className={FILL[key]} />
      {showAvg && (
        <line x1={0} x2={W} y1={avgY} y2={avgY} className="stroke-faint/60" strokeWidth={1} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
      )}
      <polyline points={line} fill="none" className={STROKE[key]} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
