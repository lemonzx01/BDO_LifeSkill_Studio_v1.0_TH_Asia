import type { OwnedCostMode, SkillGroup } from "./engine/types";

/**
 * The words for each character setting, in one place, so a setting reads the same on every page
 * (SettingsPanel, OnboardingCard, TradeCalc).
 */

/** The settings drawer, and every button and menu item that opens it. */
export const SETTINGS_TITLE = "ตั้งค่าตัวละคร";

/** An on/off market bonus: `checkbox` labels a checkbox, `on` / `off` are the two options of a select. */
export interface BonusLabels {
  name: string;
  checkbox: string;
  on: string;
  off: string;
}

export const VALUE_PACK: BonusLabels = { name: "Value Pack", checkbox: "Value Pack (+30%)", on: "มี (+30%)", off: "ไม่มี" };
export const MERCHANT_RING: BonusLabels = {
  name: "แหวนพ่อค้าผู้มั่งคั่ง",
  checkbox: "แหวนพ่อค้าผู้มั่งคั่ง (+5%)",
  on: "มี (+5%)",
  off: "ไม่มี",
};

export const FAMILY_FAME = "Family Fame";
export const FAMILY_FAME_OPTIONS: readonly { value: number; label: string }[] = [
  { value: 0, label: "ไม่มี" },
  { value: 0.005, label: "+0.5% (1,000–3,999)" },
  { value: 0.01, label: "+1% (4,000–6,999)" },
  { value: 0.015, label: "+1.5% (7,000+)" },
];

/** What a sale pays after the market tax, everywhere it is shown (calculator, recipes, market, plan). */
export const NET = "ได้รับจริง";
export const NET_RATE_LABEL = `${NET}หลังภาษี`;

export const OWNED_COST = "ของที่มีอยู่แล้ว คิดต้นทุน";
export const OWNED_COST_OPTIONS: readonly { value: OwnedCostMode; label: string; hint: string }[] = [
  { value: "market", label: "ราคาตลาดตอนนี้", hint: "ใช้ของในคลังก็เหมือนเสียโอกาสขายในราคาตลาด" },
  {
    value: "avg",
    label: "ราคาที่จ่ายจริง (ที่บันทึกในคลัง)",
    hint: "ใช้ต้นทุนที่กรอกไว้ในหน้าคลังของ ของที่ไม่ได้กรอกใช้ราคาตลาดแทน",
  },
  { value: "zero", label: "0 (ได้มาฟรี/เก็บเอง)", hint: "ของในคลังไม่มีต้นทุน เหมาะกับของที่เก็บเอง" },
];
export const OWNED_COST_LABEL: Record<OwnedCostMode, string> = {
  market: OWNED_COST_OPTIONS[0].label,
  avg: OWNED_COST_OPTIONS[1].label,
  zero: OWNED_COST_OPTIONS[2].label,
};

/** The inventory page's sort options, also listed on the help page. */
export const INVENTORY_SORT_LABEL = { name: "ชื่อ", recent: "เพิ่ม/แก้ล่าสุด", value: "มูลค่า" } as const;

export const SKILLS: readonly { key: SkillGroup; label: string }[] = [
  { key: "alchemy", label: "แปรธาตุ" },
  { key: "cooking", label: "ทำอาหาร" },
  { key: "processing", label: "แปรรูป" },
];

/** skill tiers in game order (index 0 = beginner .. 6 = guru), as stored in settings.skillTier */
export const SKILL_TIERS: readonly string[] = ["มือใหม่", "ฝึกฝน", "คล่องแคล่ว", "เชี่ยวชาญ", "ช่าง", "ลือชื่อ", "เซียน"];
