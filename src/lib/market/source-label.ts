/** Where the prices on a page came from, in the words a member reads (recipes and market headers). */
export const PRICE_SOURCE_LABEL: Record<string, string> = {
  snapshot: "ฐานข้อมูลตลาด (อัปเดตทุก 5 นาที)",
  official: "Pearl Abyss",
  arsha: "arsha.io",
  bdolytics: "bdolytics",
};

export function priceSourceLabel(source: string): string {
  return PRICE_SOURCE_LABEL[source] ?? source;
}
