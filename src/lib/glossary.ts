import type { SkillGroup } from "./engine/types";
import { silver } from "./format";
import { SKILLS } from "./settings-labels";

/**
 * One short line per number on the recipe pages, shown by the ⓘ next to its label
 * (components/ui/InfoTip). Keep each to one plain line: it explains the number, not the game.
 */
export const GLOSSARY = {
  profitPerUnit: "ขายได้หลังภาษี − ต้นทุน ต่อ 1 ชิ้น",
  profitPerCraft: "กำไรต่อการกดทำ 1 ครั้ง",
  roi: "กำไร ÷ ต้นทุน",
  imperial: "ราชวัง: ขาย NPC ไม่หักภาษี มีโควตา",
  imperialPerHour: "กล่องราชวังมีโควตาต่อวัน จึงไม่คิดกำไร/ชม.",
} as const;

/**
 * กำไร/ชม.: how many crafts an hour it assumes (the speed set in ตั้งค่า). With a group, that
 * group's number; without one (the ทั้งหมด tab), every group's.
 */
export function perHourTip(craftsPerHour: Partial<Record<SkillGroup, number>>, group?: SkillGroup): string {
  if (group) return `คิดจาก ${silver(craftsPerHour[group] ?? 0)} รอบ/ชม. ที่ตั้งไว้`;
  const parts = SKILLS.map((s) => `${s.label} ${silver(craftsPerHour[s.key] ?? 0)}`);
  return `คิดจากรอบ/ชม. ที่ตั้งไว้: ${parts.join(" · ")}`;
}
