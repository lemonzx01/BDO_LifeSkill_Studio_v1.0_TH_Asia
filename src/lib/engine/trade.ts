import { netRate } from "./cost";
import { DEFAULT_SETTINGS, type Settings } from "./types";

export interface TradeInput {
  qty: number;
  buyPrice: number;
  sellPrice: number;
  valuePack: boolean;
  merchantRing: boolean;
  familyFame: number;
}

export interface TradeResult {
  /** fraction of the listed price you receive (0.845 with Value Pack) */
  rate: number;
  taxRate: number;
  gross: number;
  tax: number;
  received: number;
  cost: number;
  profit: number;
  profitPerUnit: number;
  roi: number | null;
  /** lowest sell price that returns exactly the buy price after tax */
  breakEvenSell: number;
}

/** Central-market tax math for "buy at X, sell at Y" — the same formula the recipe engine uses. */
export function tradeMath(input: TradeInput): TradeResult {
  const settings: Settings = { ...DEFAULT_SETTINGS, valuePack: input.valuePack, merchantRing: input.merchantRing, familyFame: input.familyFame };
  const rate = netRate(settings);
  const qty = Math.max(0, input.qty);
  const gross = input.sellPrice * qty;
  const received = gross * rate;
  const cost = input.buyPrice * qty;
  const profit = received - cost;
  return {
    rate,
    taxRate: 1 - rate,
    gross,
    tax: gross - received,
    received,
    cost,
    profit,
    profitPerUnit: qty > 0 ? profit / qty : 0,
    roi: cost > 0 ? profit / cost : null,
    breakEvenSell: input.buyPrice > 0 ? input.buyPrice / rate : 0,
  };
}
