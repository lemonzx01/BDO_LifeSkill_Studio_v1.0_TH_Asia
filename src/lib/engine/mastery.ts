import type { RecipeType, SkillGroup } from "./types";

/** Which settings group (mastery, speed, tier) a recipe type belongs to. */
export function skillGroup(type: RecipeType): SkillGroup {
  if (type === "alchemy") return "alchemy";
  if (type === "cooking") return "cooking";
  return "processing";
}

export const RECIPE_TYPE_TH: Record<RecipeType, string> = {
  alchemy: "แปรธาตุ",
  cooking: "ทำอาหาร",
  heating: "หลอม",
  grinding: "บด",
  drying: "ตากแห้ง",
  shaking: "เขย่า",
  filtering: "กรอง",
  chopping: "ตัดฟืน",
  "simple-alchemy": "แปรธาตุอย่างง่าย",
  "simple-cooking": "ทำอาหารอย่างง่าย",
};

export const PROCESSING_TYPES: RecipeType[] = ["heating", "grinding", "drying", "shaking", "filtering", "chopping", "simple-alchemy", "simple-cooking"];

/** Processing mastery only raises how many batches one action handles (mass processing), not the yield per batch. */
const PROCESSING_MASS: [number, number][] = [
  [0, 10], [20, 11], [40, 12], [60, 13], [80, 14], [100, 15], [120, 16], [140, 17], [160, 18], [180, 19], [200, 20],
  [220, 21], [240, 22], [260, 23], [280, 24], [300, 25], [320, 26], [340, 27], [360, 28], [380, 29], [400, 30],
  [420, 31], [440, 32], [460, 33], [480, 34], [500, 35], [520, 36], [540, 37], [560, 38], [580, 39], [600, 40],
  [620, 41], [640, 42], [660, 43], [680, 45], [700, 47], [720, 49], [740, 51], [760, 53], [780, 57], [810, 60],
  [840, 64], [870, 68], [900, 72], [930, 76], [960, 80], [990, 85], [1020, 90], [1060, 96], [1100, 112], [1140, 118],
  [1180, 124], [1220, 130], [1260, 137], [1300, 144], [1350, 154], [1400, 162], [1450, 170], [1500, 178], [1550, 186],
  [1600, 194], [1650, 203], [1700, 212], [1800, 222], [1900, 235], [2000, 250], [2100, 260], [2200, 270], [2300, 280],
  [2400, 285], [2500, 290], [2600, 295], [2700, 300], [2800, 305], [2900, 310], [3000, 315],
];

/** Batches processed per mass-processing action at the given processing mastery. */
export function massProcessCount(mastery: number): number {
  const m = Math.max(0, Math.min(3000, mastery));
  let best = PROCESSING_MASS[0][1];
  for (const [x, y] of PROCESSING_MASS) if (m >= x) best = y;
  return best;
}

/**
 * Life Skill Mastery -> chance to obtain the maximum quantity per craft.
 * Points come from the in-game mastery tables (alchemy every 50 mastery from
 * incendar.com, cooking from the official table as published by community
 * guides); values in between are interpolated linearly.
 */
type Point = [mastery: number, maxQuantityChance: number];

const ALCHEMY_MAX_PROC: Point[] = [
  [0, 0],
  [50, 0.0576], [100, 0.0635], [150, 0.0697], [200, 0.0762], [250, 0.0829], [300, 0.09], [350, 0.0973],
  [400, 0.105], [450, 0.1129], [500, 0.1211], [550, 0.1296], [600, 0.1384], [650, 0.1475], [700, 0.1568],
  [750, 0.1665], [800, 0.1764], [850, 0.1866], [900, 0.1971], [950, 0.2079], [1000, 0.219], [1050, 0.2304],
  [1100, 0.2421], [1150, 0.254], [1200, 0.2663], [1250, 0.2788], [1300, 0.2916], [1350, 0.3047], [1400, 0.3181],
  [1450, 0.3318], [1500, 0.3457], [1550, 0.36], [1600, 0.3745], [1650, 0.3894], [1700, 0.4045], [1750, 0.4199],
  [1800, 0.4356], [1850, 0.4516], [1900, 0.4679], [1950, 0.4844], [2000, 0.5], [3000, 0.625],
];

const COOKING_MAX_DISHES: Point[] = [
  [0, 0],
  [50, 0.0064], [100, 0.0096], [150, 0.0135], [200, 0.018], [250, 0.0231], [300, 0.0289], [350, 0.0353],
  [400, 0.0424], [450, 0.0502], [500, 0.0586], [550, 0.0676], [600, 0.0773], [650, 0.0876], [700, 0.0986],
  [750, 0.1102], [800, 0.1225], [850, 0.1354], [900, 0.149], [950, 0.1632], [1000, 0.1781], [1050, 0.1936],
  [1100, 0.2098], [1150, 0.2266], [1200, 0.244], [1250, 0.2621], [1300, 0.2809], [1350, 0.3003], [1400, 0.3204],
  [1450, 0.3411], [1500, 0.3624], [1550, 0.3844], [1600, 0.407], [1650, 0.4303], [1700, 0.4543], [1750, 0.4789],
  [1800, 0.5041], [1850, 0.53], [1900, 0.5565], [1950, 0.5837], [2000, 0.6115], [2050, 0.6192], [2100, 0.6268],
  [2150, 0.6345], [2200, 0.6421], [2250, 0.6498], [2300, 0.6574], [2350, 0.6651], [2400, 0.6727], [2450, 0.6804],
  [2500, 0.688], [2550, 0.6957], [2600, 0.7033], [2650, 0.7109], [2700, 0.7186], [2750, 0.7262], [2800, 0.7339],
  [2850, 0.7415], [2900, 0.7492], [2950, 0.7568], [3000, 0.7645],
];

const TABLES: Partial<Record<SkillGroup, Point[]>> = {
  alchemy: ALCHEMY_MAX_PROC,
  cooking: COOKING_MAX_DISHES,
};

export const MASTERY_MAX = 3000;

function interpolate(points: Point[], x: number): number {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i];
    if (x <= x1) {
      const [x0, y0] = points[i - 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return points[points.length - 1][1];
}

/** Chance (0..1) to receive the maximum quantity of the main product per craft (0 for processing). */
export function maxQuantityChance(group: SkillGroup, mastery: number): number {
  const table = TABLES[group];
  if (!table) return 0;
  return interpolate(table, Math.max(0, Math.min(MASTERY_MAX, mastery)));
}

/**
 * Expected main-product units per craft for a recipe yielding min..max.
 * Without the proc the game rolls uniformly between min and max (average of the
 * two); with the proc you receive max. This reproduces the community "regular
 * procs" figures (e.g. alchemy 1~4 at 2000 mastery -> 3.25).
 */
export function expectedUnits(min: number, max: number, maxQuantityChance: number): number {
  if (max <= min) return min;
  const p = Math.max(0, Math.min(1, maxQuantityChance));
  const base = (min + max) / 2;
  return base * (1 - p) + max * p;
}
