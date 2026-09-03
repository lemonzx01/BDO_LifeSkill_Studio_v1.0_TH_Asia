const nf0 = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 1 });

/** 1234567 -> "1,234,567" */
export function silver(n: number): string {
  if (!Number.isFinite(n)) return "-";
  return nf0.format(Math.round(n));
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

export function num(n: number): string {
  return nf1.format(n);
}

export function timeAgo(ts: number | null | undefined): string {
  if (!ts) return "-";
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s} วิ.ที่แล้ว`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} นาทีที่แล้ว`;
  const h = Math.round(m / 60);
  return `${h} ชม.ที่แล้ว`;
}
