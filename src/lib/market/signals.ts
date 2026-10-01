/**
 * The market page's three signals, one name each. The mode buttons, the pick cards, the row badges
 * (components/market/MarketScanner.tsx) and the help page all read them from here, so the names
 * cannot drift apart. Plain data: safe to import from a server page.
 */
export type SignalKey = "trade" | "buy" | "sell";

export const SIGNAL_KEYS: SignalKey[] = ["trade", "buy", "sell"];

export const SIGNAL_NAME: Record<SignalKey, { name: string; short: string }> = {
  trade: { name: "เทรดได้กำไร", short: "เทรด" },
  buy: { name: "ของถูก น่าซื้อเก็บ", short: "ของถูก" },
  sell: { name: "น่าขายตอนนี้", short: "น่าขาย" },
};
