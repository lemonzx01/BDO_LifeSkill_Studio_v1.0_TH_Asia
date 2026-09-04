import type { ScanRow } from "./snapshot";
import { pct } from "@/lib/format";

/**
 * "Chance to recover" for an item whose price sits below its usual level.
 * Not a forecast: it only summarises what the numbers we actually have say
 * (price vs usual, listed stock shrinking or piling up, how fast stock
 * clears, the last week's direction, liquidity). Events and patches are
 * unknown to it, and the UI says so.
 */
export interface EvidenceLine {
  /** true = supports a recovery, false = argues against it, null = no data yet / neutral */
  ok: boolean | null;
  text: string;
}

export interface Assessment {
  score: number; // 0..100
  level: "สูง" | "ปานกลาง" | "ต่ำ" | "ไม่พอข้อมูล";
  lines: EvidenceLine[];
  /** stock cleared per day (bdolytics 14-day volume or our own counter), null when unknown */
  perDay: number | null;
  /** days until the listed stock is gone at the current pace, null when unknown */
  daysToClear: number | null;
}

/** consecutive strictly-down (or up) days at the end of the series */
function streak(series: number[], dir: "down" | "up"): number {
  let n = 0;
  for (let i = series.length - 1; i > 0; i--) {
    const d = series[i] - series[i - 1];
    if ((dir === "down" && d < 0) || (dir === "up" && d > 0)) n += 1;
    else break;
  }
  return n;
}

export function assessRecovery(row: ScanRow): Assessment {
  const lines: EvidenceLine[] = [];
  let score = 40;
  const dev = row.avg90 ? row.price / row.avg90 - 1 : null;
  const perDay = row.tradesPerDay ?? (row.vol14 !== null ? row.vol14 / 14 : null);
  const daysToClear = perDay && perDay > 0 && row.stock > 0 ? row.stock / perDay : row.stock === 0 ? 0 : null;

  // 1) price vs usual
  if (dev === null) {
    lines.push({ ok: null, text: `ยังไม่มีราคาย้อนหลังพอ (มี ${row.days} วัน) เทียบราคาปกติไม่ได้` });
    return { score: 0, level: "ไม่พอข้อมูล", lines, perDay, daysToClear };
  }
  if (dev <= -0.3) {
    score += 25;
    lines.push({ ok: true, text: `ราคาต่ำกว่าปกติมาก ${pct(-dev)} (ปกติ ${Math.round(row.avg90!).toLocaleString("th-TH")})` });
  } else if (dev <= -0.15) {
    score += 15;
    lines.push({ ok: true, text: `ราคาต่ำกว่าปกติ ${pct(-dev)} (ปกติ ${Math.round(row.avg90!).toLocaleString("th-TH")})` });
  } else if (dev < 0) {
    score += 5;
    lines.push({ ok: null, text: `ราคาต่ำกว่าปกติเล็กน้อย ${pct(-dev)}` });
  } else {
    score -= 20;
    lines.push({ ok: false, text: `ราคาไม่ได้ต่ำกว่าปกติ (สูงกว่า ${pct(dev)})` });
  }

  // 2) listed stock shrinking or piling up (needs our own daily snapshots)
  const hist = row.stockHist;
  if (hist.length >= 3) {
    const down = streak(hist, "down");
    const up = streak(hist, "up");
    if (down >= 2) {
      score += 20;
      lines.push({ ok: true, text: `ของค้างขายลดลง ${down} วันติด ตลาดกำลังดูดของ` });
    } else if (up >= 2) {
      score -= 20;
      lines.push({ ok: false, text: `ของค้างขายเพิ่มขึ้น ${up} วันติด ของกำลังล้น` });
    } else {
      lines.push({ ok: null, text: "ของค้างขายทรง ๆ ไม่ชี้ทางชัด" });
    }
  } else {
    lines.push({ ok: null, text: `ยังไม่มีข้อมูลค้างขายย้อนหลังพอ (เก็บแล้ว ${hist.length} วัน ต้องการ 3 วัน)` });
  }

  // 3) how fast stock clears
  if (row.stock === 0) {
    score += 15;
    lines.push({ ok: true, text: "ของหมดตลาด มีแต่คนรอซื้อ" });
  } else if (daysToClear !== null) {
    if (daysToClear <= 3) {
      score += 20;
      lines.push({ ok: true, text: `ค้างขาย ${row.stock.toLocaleString("th-TH")} หมดใน ~${Math.max(1, Math.round(daysToClear))} วัน คนซื้อเร็ว` });
    } else if (daysToClear <= 10) {
      score += 8;
      lines.push({ ok: true, text: `ค้างขาย ${row.stock.toLocaleString("th-TH")} หมดใน ~${Math.round(daysToClear)} วัน` });
    } else if (daysToClear <= 30) {
      lines.push({ ok: null, text: `ค้างขาย ${row.stock.toLocaleString("th-TH")} ต้องใช้ ~${Math.round(daysToClear)} วันกว่าจะหมด` });
    } else {
      score -= 15;
      lines.push({ ok: false, text: `ค้างขาย ${row.stock.toLocaleString("th-TH")} ต้องใช้ ~${Math.round(daysToClear)} วันกว่าจะหมด ของล้น` });
    }
  } else {
    lines.push({ ok: null, text: "ไม่รู้ความเร็วในการขาย (ไม่มียอดซื้อขาย)" });
  }

  // 4) last week's direction
  const trend7 = row.avg7 ? row.price / row.avg7 - 1 : null;
  const momentum = row.avg7 && row.avg30 ? row.avg7 / row.avg30 - 1 : null;
  if (trend7 !== null && trend7 >= 0.03) {
    score += 12;
    lines.push({ ok: true, text: `7 วันหลังเริ่มเงยขึ้น (สูงกว่าเฉลี่ย 7 วัน ${pct(trend7)})` });
  } else if (trend7 !== null && trend7 <= -0.05) {
    score -= 10;
    lines.push({ ok: false, text: `ยังไหลลงอยู่ (ต่ำกว่าเฉลี่ย 7 วัน ${pct(-trend7)})` });
  } else if (momentum !== null && momentum <= -0.1) {
    score -= 5;
    lines.push({ ok: null, text: `7 วันหลังต่ำกว่า 30 วัน ${pct(-momentum)} แนวโน้มยังลง` });
  } else {
    lines.push({ ok: null, text: "ราคาช่วง 7 วันทรงตัว" });
  }

  // 5) liquidity
  const vol = row.vol14 ?? 0;
  if (vol >= 1000) {
    score += 8;
    lines.push({ ok: true, text: `ซื้อขาย ${vol.toLocaleString("th-TH")} ชิ้นใน 14 วัน คล่อง` });
  } else if (vol < 50) {
    score -= 20;
    lines.push({ ok: false, text: `ซื้อขายแค่ ${vol.toLocaleString("th-TH")} ชิ้นใน 14 วัน ราคาแกว่งง่าย เชื่อถือยาก` });
  } else {
    lines.push({ ok: null, text: `ซื้อขาย ${vol.toLocaleString("th-TH")} ชิ้นใน 14 วัน` });
  }

  // without a few days of our own stock snapshots the strongest evidence is missing: never call it "สูง"
  if (hist.length < 3) score = Math.min(score, 60);
  score = Math.max(0, Math.min(100, Math.round(score)));
  const level: Assessment["level"] = score >= 65 ? "สูง" : score >= 45 ? "ปานกลาง" : "ต่ำ";
  return { score, level, lines, perDay, daysToClear };
}

/** Plain-language evidence for an item priced above its usual level (sell now?). */
export function sellEvidence(row: ScanRow): EvidenceLine[] {
  const lines: EvidenceLine[] = [];
  const dev = row.avg90 ? row.price / row.avg90 - 1 : null;
  if (dev !== null) lines.push({ ok: dev >= 0.15, text: `ราคาสูงกว่าปกติ ${pct(dev)} (ปกติ ${Math.round(row.avg90!).toLocaleString("th-TH")})` });
  const max = row.max90;
  if (max && row.price >= max * 0.95) lines.push({ ok: true, text: "อยู่ใกล้ราคาสูงสุดใน 90 วัน" });
  if (row.stock === 0) lines.push({ ok: true, text: "ของหมดตลาด ตั้งขายแล้วน่าจะออกทันที" });
  else lines.push({ ok: null, text: `มีของค้างขาย ${row.stock.toLocaleString("th-TH")} ต้องต่อคิวขาย` });
  const hist = row.stockHist;
  if (hist.length >= 3 && streak(hist, "up") >= 2) lines.push({ ok: false, text: "ของค้างขายเริ่มพอกขึ้น คนอื่นก็กำลังปล่อย" });
  return lines;
}
