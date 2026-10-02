const nf0 = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 1 });

/** 1234567 -> "1,234,567" */
export function silver(n: number): string {
  if (!Number.isFinite(n)) return "-";
  // `|| 0` turns -0 (Math.round(-0.3)) into 0, which Intl would print as "-0"
  return nf0.format(Math.round(n) || 0);
}

/** Compact silver: 1234567 -> "1.23M", 12345 -> "12.3K" */
export function silverShort(n: number): string {
  if (!Number.isFinite(n)) return "-";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${nf0.format(abs)}`;
}

export function pct(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return "-";
  return `${(n * 100).toFixed(digits)}%`;
}

/** True when a formatted number reads as zero ("0", "-0", "0.0%"): it gets no sign and no colour. */
export function readsAsZero(s: string): boolean {
  return !/[1-9]/.test(s);
}

/**
 * A change or a profit: "+" in front when above zero (a negative already has "-"). 1234 -> "+1,234".
 * Decided on the text as shown, so 0.3 and -0.3 both read "0", never "+0" or "-0".
 */
export function signed(n: number, fmt: (n: number) => string = silver): string {
  const s = fmt(n);
  if (!Number.isFinite(n)) return s;
  if (readsAsZero(s)) return s.replace(/^-/, "");
  return n > 0 ? `+${s}` : s;
}

/** 0.125 -> "+13%", -0.05 -> "-5%" */
export function signedPct(n: number, digits = 0): string {
  return signed(n, (v) => pct(v, digits));
}

export function num(n: number): string {
  return nf1.format(n);
}

/** "5 นาทีที่แล้ว". Pass `now` when rendering (TimeAgo does), so render stays pure. */
export function timeAgo(ts: number | null | undefined, now: number = Date.now()): string {
  if (!ts) return "-";
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return `${s} วิ.ที่แล้ว`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} นาทีที่แล้ว`;
  const h = Math.round(m / 60);
  return `${h} ชม.ที่แล้ว`;
}
