import { silver } from "@/lib/format";

const W = 280;
const H = 56;
const PAD = 3;

/**
 * Price history as a small line: a faint fill under it and a dashed line at the average.
 * Screen readers get the low / average / high instead of the drawing.
 */
export function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const avg = data.reduce((a, b) => a + b, 0) / data.length;
  const span = max - min || 1;
  const x = (i: number) => (i / (data.length - 1)) * W;
  const y = (v: number) => H - ((v - min) / span) * (H - 2 * PAD) - PAD;
  const line = data.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const avgY = y(avg);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-14 w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label={`ราคา 90 วัน ต่ำสุด ${silver(min)} เฉลี่ย ${silver(avg)} สูงสุด ${silver(max)}`}
    >
      <polygon points={`0,${H} ${line} ${W},${H}`} className="fill-accent/10" />
      <line x1={0} x2={W} y1={avgY} y2={avgY} className="stroke-muted/60" strokeWidth={1} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
      <polyline points={line} fill="none" className="stroke-accent" strokeWidth={1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
