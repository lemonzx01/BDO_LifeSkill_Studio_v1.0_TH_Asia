/** Thai labels for bdolytics market category slugs (fallback: prettified slug). */
export const MAIN_CATEGORY_TH: Record<string, string> = {
  material: "วัตถุดิบ",
  consumables: "ของใช้ / อาหาร / ยา",
  enhancement: "ตีบวก / อัปเกรด",
  "magic-crystal": "คริสตัล",
  "alchemy-stone": "หินแปรธาตุ",
  lightstone: "หินแสง",
  "life-tools": "อุปกรณ์ Life Skill",
  mainhand: "อาวุธหลัก",
  offhand: "อาวุธรอง",
  awakening: "อาวุธตื่นรู้",
  armor: "ชุดเกราะ",
  accessories: "เครื่องประดับ",
  "pearl-item": "ไอเท็มเพิร์ล",
  dye: "สีย้อม",
  mount: "สัตว์พาหนะ",
  ship: "เรือ",
  wagon: "เกวียน",
  furniture: "เฟอร์นิเจอร์",
};

export const SUB_CATEGORY_TH: Record<string, string> = {
  blood: "เลือด",
  fruits: "ผลไม้",
  grains: "ธัญพืช",
  leather: "หนัง",
  meat: "เนื้อ",
  misc: "อื่น ๆ",
  "ore-gem": "แร่ / อัญมณี",
  plants: "พืช",
  seafood: "อาหารทะเล",
  seeds: "เมล็ด",
  vegetables: "ผัก",
  "offensive-elixir": "ยาโจมตี",
  "defensive-elixir": "ยาป้องกัน",
  "functional-elixir": "ยาเสริม",
  food: "อาหาร",
  "special-dishes": "อาหารพิเศษ",
  potion: "โพชั่น",
  "other-consumables": "ของใช้อื่น ๆ",
  "item-parts": "ชิ้นส่วน",
  "siege-items": "ของสงคราม",
  "black-stone": "หินดำ",
  upgrade: "อัปเกรด",
  reforge: "รีฟอร์จ",
  "alchemy-cooking": "อุปกรณ์แปรธาตุ/ทำอาหาร",
  "fishing-tools": "ตกปลา",
  "lumbering-axe": "ขวาน",
  "butcher-knife": "มีดชำแหละ",
  "fluid-collector": "ที่เก็บของเหลว",
  hoe: "จอบ",
  matchlock: "ปืน",
  pickaxe: "อีเต้อ",
  "tanning-knife": "มีดถลกหนัง",
  "other-tools": "เครื่องมืออื่น ๆ",
  feed: "อาหารสัตว์",
};

export function mainCategoryLabel(slug: string | null): string {
  if (!slug) return "-";
  return MAIN_CATEGORY_TH[slug] ?? slug.replace(/-/g, " ");
}

export function subCategoryLabel(slug: string | null): string {
  if (!slug) return "";
  return SUB_CATEGORY_TH[slug] ?? slug.replace(/-/g, " ");
}
