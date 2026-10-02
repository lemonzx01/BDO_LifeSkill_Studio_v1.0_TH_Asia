import type { TradeResult } from "./engine/trade";
import { pct, readsAsZero, silver, silverShort } from "./format";

const positive = (n: number) => Number.isFinite(n) && n > 0;

function mean(xs: number[]): number | null {
  return xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null;
}

/**
 * The normal price of an item: the average of the official 90-day daily prices, else of our own
 * daily snapshot rows. null when neither has a price.
 */
export function normalPrice(history: readonly number[] | undefined, daily: readonly { price: number }[] | undefined): number | null {
  return mean((history ?? []).filter(positive)) ?? mean((daily ?? []).map((d) => d.price).filter(positive));
}

export type VerdictTone = "good" | "bad" | "neutral";

export interface TradeVerdict {
  tone: VerdictTone;
  /** one line: "คุ้ม · กำไร 1.20M (ROI 8%)", "ไม่คุ้ม · ขาดทุน 300K" or what to fill in */
  text: string;
  /** "ต้องขายอย่างน้อย X ถึงเท่าทุน", once there is a buy price */
  breakEven: string | null;
}

/** The trade calculator's verdict, from tradeMath's result and the three numbers typed in. */
export function tradeVerdict(r: TradeResult, input: { qty: number; buy: number; sell: number }): TradeVerdict {
  const breakEven = input.buy > 0 ? `ต้องขายอย่างน้อย ${silver(Math.ceil(r.breakEvenSell))} ถึงเท่าทุน` : null;
  if (input.qty <= 0) return { tone: "neutral", text: "ใส่จำนวนเพื่อดูกำไร", breakEven };
  if (input.buy <= 0) return { tone: "neutral", text: "ใส่ราคาซื้อเพื่อดูกำไร", breakEven };
  if (input.sell <= 0) return { tone: "neutral", text: "ใส่ราคาขายเพื่อดูกำไร", breakEven };
  const amount = silverShort(Math.abs(r.profit));
  if (readsAsZero(amount)) return { tone: "neutral", text: "เท่าทุนพอดี", breakEven };
  if (r.profit < 0) return { tone: "bad", text: `ไม่คุ้ม · ขาดทุน ${amount}`, breakEven };
  let roi = "";
  if (r.roi !== null) {
    const whole = pct(r.roi, 0);
    roi = ` (ROI ${readsAsZero(whole) ? pct(r.roi, 1) : whole})`;
  }
  return { tone: "good", text: `คุ้ม · กำไร ${amount}${roi}`, breakEven };
}
