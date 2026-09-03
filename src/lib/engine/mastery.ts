import type { RecipeType } from "./types";

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

const TABLES: Partial<Record<RecipeType, Point[]>> = {
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

/** Chance (0..1) to receive the maximum quantity of the main product per craft. */
export function maxQuantityChance(type: RecipeType, mastery: number): number {
  const table = TABLES[type];
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
