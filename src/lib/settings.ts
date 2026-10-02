import { DEFAULT_SETTINGS, type Settings, type SkillGroup } from "@/lib/engine/types";

type Group = Settings["mastery"];

/**
 * One per-skill group (mastery, yield, crafts per hour, skill tier): the default for every skill,
 * with each value the input gives as a finite number laid over it. Other keys and other kinds of
 * value are dropped, so stored junk (a browser's own copy, an old row) never reaches the engine.
 */
function group(input: unknown, d: Group): Group {
  const src = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const out: Group = { ...d };
  for (const key of Object.keys(d) as SkillGroup[]) {
    const v = src[key];
    if (typeof v === "number" && Number.isFinite(v)) out[key] = v;
  }
  return out;
}

/** Fills in defaults for settings saved by older versions (or partial input). */
export function normalizeSettings(input: unknown): Settings {
  const parsed = (input && typeof input === "object" ? input : {}) as Partial<Settings>;
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
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
