import { IMPERIAL_TYPES, PROCESSING_TYPES } from "@/lib/engine/mastery";
import type { RecipeType } from "@/lib/engine/types";
import type { IconName } from "./ui/Icon";

/**
 * The icon of the life skill a recipe belongs to, shown beside its Thai name (RECIPE_TYPE_TH): a
 * crown for imperial boxes, a hammer for every processing method, a pot for cooking and a flask for
 * alchemy. One map, so every list shows a skill with the same icon.
 */
export function recipeTypeIcon(type: RecipeType): IconName {
  if (IMPERIAL_TYPES.includes(type)) return "crown";
  if (PROCESSING_TYPES.includes(type)) return "hammer";
  return type === "cooking" ? "cooking-pot" : "flask";
}
