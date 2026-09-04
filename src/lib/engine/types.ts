export type ItemId = number;

export type RecipeType =
  | "alchemy"
  | "cooking"
  | "heating"
  | "grinding"
  | "drying"
  | "shaking"
  | "filtering"
  | "chopping"
  | "simple-alchemy"
  | "simple-cooking"
  | "imperial-cooking"
  | "imperial-alchemy";

/** Settings (mastery, speed, skill tier) are kept per skill group, not per recipe type. */
export type SkillGroup = "alchemy" | "cooking" | "processing";

export interface Item {
  id: ItemId;
  th: string;
  en: string;
  cat: string | null;
  sub: string | null;
  grade: number;
  icon: string | null;
  /** true if the item is listed on the central market */
  market: boolean;
  /** NPC vendor buy price (what you pay), if the item is sold by NPCs */
  npcBuy?: number | null;
  npcSell?: number | null;
  weight?: number | null;
  /** silver paid by the Imperial Delivery NPC for one box (before mastery bonus) */
  imperialPrice?: number | null;
}

export interface GroupMember {
  id: ItemId;
  /** how many base units one of this item counts as (bdocodex "value") */
  value: number;
}

export interface RecipeMaterial {
  id: ItemId;
  qty: number;
  /** "basic ingredient, cannot be substituted" */
  fixed: boolean;
  /** substitute group (includes the item itself with value 1) */
  group?: GroupMember[];
}

export interface RecipeProduct {
  id: ItemId;
  min: number;
  max: number;
  kind: "main" | "extra";
}

export interface RecipeSkill {
  display: string;
  tier: number;
  tierName: string;
  level: number;
  sort: number;
}

export interface Recipe {
  id: number;
  type: RecipeType;
  name: string;
  skill: RecipeSkill;
  exp: number;
  weight: number;
  materials: RecipeMaterial[];
  products: RecipeProduct[];
}

/** Live market data for one item (already normalised from whichever API served it). */
export interface MarketPrice {
  id: ItemId;
  /** current listed price (basePrice from the market API) */
  price: number;
  stock: number;
  totalTrades: number;
  lastSoldPrice?: number;
  lastSoldTime?: number;
  /** 14-day traded volume, when known */
  volume14d?: number;
  updatedAt?: number;
}

export type PriceBook = Record<ItemId, MarketPrice | undefined>;

/** How owned stock is valued when it is used as an ingredient. */
export type OwnedCostMode = "market" | "zero" | "avg";

export interface Settings {
  valuePack: boolean;
  /** family fame bonus as a fraction: 0, 0.005, 0.01 or 0.015 */
  familyFame: number;
  merchantRing: boolean;
  /** any other additive bonus as a fraction */
  extraBonus: number;
  /** your life skill mastery per skill group */
  mastery: Partial<Record<SkillGroup, number>>;
  /** extra multiplier on top of the mastery-based yield (advanced; 1 = none) */
  yieldMultiplier: Partial<Record<SkillGroup, number>>;
  /** crafts per hour, per skill group (for profit/hour) */
  craftsPerHour: Partial<Record<SkillGroup, number>>;
  /** skill tier you have reached per skill group (0 = beginner .. 6 = guru); recipes above are flagged */
  skillTier: Partial<Record<SkillGroup, number>>;
  /** how items already in your inventory are valued when used as ingredients */
  ownedCostMode: OwnedCostMode;
}

export const DEFAULT_SETTINGS: Settings = {
  valuePack: true,
  familyFame: 0,
  merchantRing: false,
  extraBonus: 0,
  mastery: { alchemy: 0, cooking: 0, processing: 0 },
  yieldMultiplier: { alchemy: 1, cooking: 1, processing: 1 },
  craftsPerHour: { alchemy: 900, cooking: 900, processing: 3000 },
  skillTier: { alchemy: 6, cooking: 6, processing: 6 },
  ownedCostMode: "market",
};

export interface InventoryEntry {
  qty: number;
  /** average cost paid per unit (silver) */
  avgCost?: number;
}
export type Inventory = Record<ItemId, InventoryEntry | undefined>;

/** Per-item user overrides: force buy, force craft, or a custom unit price. */
export type ItemOverride = { mode: "buy" } | { mode: "craft" } | { mode: "price"; price: number };
export type Overrides = Record<ItemId, ItemOverride | undefined>;

export interface CostContext {
  items: Record<ItemId, Item | undefined>;
  recipes: Recipe[];
  prices: PriceBook;
  settings: Settings;
  inventory?: Inventory;
  ownedCostMode?: OwnedCostMode;
  overrides?: Overrides;
}

export type CostSource = "market" | "npc" | "craft" | "owned" | "override" | "unknown";

export interface CostNode {
  id: ItemId;
  /** cost per single unit of this item */
  unitCost: number;
  source: CostSource;
  /** the recipe used when source === "craft" */
  recipeId?: number;
  /** chosen substitute, when this node fulfils a group slot */
  substituteFor?: ItemId;
  /** true if the item could not be priced at all (cost treated as 0 and flagged) */
  unknown: boolean;
  /** true if any descendant is unknown */
  hasUnknown: boolean;
  /** true if the market shows zero stock for a market-sourced item */
  soldOut: boolean;
  /** true if any descendant is sold out */
  hasSoldOut: boolean;
  children?: CostChild[];
}

export interface CostChild {
  /** the slot as written in the recipe */
  slotId: ItemId;
  qty: number;
  node: CostNode;
  /** units of the chosen item actually consumed (qty / value for substitutes) */
  units: number;
  lineCost: number;
}

export interface RecipeEvaluation {
  recipe: Recipe;
  productId: ItemId;
  /** expected units of the main product per craft (after yield multiplier) */
  expectedYield: number;
  materialCostPerCraft: number;
  unitCost: number;
  /** current market price of the main product (0 if unknown) */
  sellPrice: number;
  netRate: number;
  /** silver received per unit after tax/bonuses */
  netPerUnit: number;
  profitPerUnit: number;
  profitPerCraft: number;
  profitPerHour: number;
  roi: number;
  /** cost tree for one craft */
  tree: CostNode;
  /** where the product is sold: central market (taxed) or the imperial delivery NPC (tax-free, daily quota) */
  saleChannel: "market" | "imperial";
  flags: {
    unknownCost: boolean;
    materialSoldOut: boolean;
    productNoPrice: boolean;
    productNotMarketable: boolean;
    aboveSkill: boolean;
  };
}
