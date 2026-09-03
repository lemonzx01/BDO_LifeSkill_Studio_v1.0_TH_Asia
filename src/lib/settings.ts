import { DEFAULT_SETTINGS, type Settings } from "@/lib/engine/types";

/** Fills in defaults for settings saved by older versions (or partial input). */
export function normalizeSettings(input: unknown): Settings {
  const parsed = (input && typeof input === "object" ? input : {}) as Partial<Settings>;
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  const group = (v: unknown, d: Settings["mastery"]) => ({ ...d, ...((v && typeof v === "object" ? v : {}) as Settings["mastery"]) });
  return {
    valuePack: typeof parsed.valuePack === "boolean" ? parsed.valuePack : DEFAULT_SETTINGS.valuePack,
    familyFame: num(parsed.familyFame, DEFAULT_SETTINGS.familyFame),
    merchantRing: typeof parsed.merchantRing === "boolean" ? parsed.merchantRing : DEFAULT_SETTINGS.merchantRing,
    extraBonus: num(parsed.extraBonus, DEFAULT_SETTINGS.extraBonus),
    mastery: group(parsed.mastery, DEFAULT_SETTINGS.mastery),
    yieldMultiplier: group(parsed.yieldMultiplier, DEFAULT_SETTINGS.yieldMultiplier),
    craftsPerHour: group(parsed.craftsPerHour, DEFAULT_SETTINGS.craftsPerHour),
    skillTier: group(parsed.skillTier, DEFAULT_SETTINGS.skillTier),
    ownedCostMode: parsed.ownedCostMode === "zero" || parsed.ownedCostMode === "avg" ? parsed.ownedCostMode : "market",
  };
}

/** Settings saved by the pre-account version in this browser, if any (used once for migration). */
export const LEGACY_SETTINGS_KEY = "bdo-lifeskill-studio:settings:v1";
export const LEGACY_INVENTORY_KEY = "bdo-lifeskill-studio:inventory:v1";
