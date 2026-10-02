import { toCsv } from "@/lib/csv";
import type { DailyUsage } from "./stats";

/**
 * Labels for the stats page. Written out by hand rather than with toLocaleDateString, so the
 * server render and the browser always print the same text (no hydration mismatch).
 */
const MONTHS_TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/** "2026-10-02" -> "2 ต.ค." or, with the year, "2 ต.ค. 2569" (Thai Buddhist year). */
export function dayLabel(day: string, withYear = false): string {
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return day;
  return `${d} ${MONTHS_TH[m - 1]}${withYear ? ` ${y + 543}` : ""}`;
}

const nf0 = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 1 });

/** 1234 -> "1,234" */
export function count(v: number): string {
  return nf0.format(Math.round(v) || 0);
}

/** an average: 4.25 -> "4.3", 4 -> "4" */
export function decimal(v: number): string {
  return Number.isFinite(v) ? nf1.format(v) : "0";
}

/** share of a whole as a whole percent: 1 of 3 -> "33%"; nothing of nothing -> "0%" */
export function share(part: number, whole: number): string {
  return `${whole > 0 ? Math.round((part / whole) * 100) : 0}%`;
}

/** The daily series as CSV (ISO dates, so a spreadsheet reads them as dates). */
export function dailyCsv(rows: readonly DailyUsage[]): string {
  return toCsv([["วันที่", "ผู้ใช้ (คน)", "เปิดหน้า (ครั้ง)"], ...rows.map((r) => [r.day, r.visitors, r.views])]);
}
