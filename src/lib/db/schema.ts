import { bigint, boolean, date, index, integer, pgTable, primaryKey, serial, text, timestamp } from "drizzle-orm/pg-core";

/** owner = แอดมินใหญ่ (manages everyone, at least one must stay active), admin = แอดมินเล็ก (manages members only) */
export type Role = "owner" | "admin" | "member";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  /** lower-case login name */
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").$type<Role>().notNull().default("member"),
  isActive: boolean("is_active").notNull().default(true),
  /** admin-created accounts must pick their own password on first login */
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

export const sessions = pgTable(
  "sessions",
  {
    /** sha256 of the cookie token; the raw token is never stored */
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

/** Latest central-market state for every item (one row per item id, enhancement level 0). */
export const marketItems = pgTable("market_items", {
  id: integer("id").primaryKey(),
  nameTh: text("name_th").notNull(),
  nameEn: text("name_en"),
  icon: text("icon"),
  grade: integer("grade").notNull().default(0),
  cat: text("cat"),
  sub: text("sub"),
  price: bigint("price", { mode: "number" }).notNull().default(0),
  stock: integer("stock").notNull().default(0),
  totalTrades: bigint("total_trades", { mode: "number" }).notNull().default(0),
  /** units traded in the last 14 days (bdolytics), null when unknown */
  volume14d: integer("volume_14d"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  /** when the official 90-day history was last merged into market_daily */
  historyFetchedAt: timestamp("history_fetched_at", { withTimezone: true }),
});

/** One row per item per day: our own price history built from snapshots + official backfill. */
export const marketDaily = pgTable(
  "market_daily",
  {
    itemId: integer("item_id").notNull(),
    day: date("day").notNull(),
    price: bigint("price", { mode: "number" }).notNull(),
    stock: integer("stock"),
    totalTrades: bigint("total_trades", { mode: "number" }),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.day] }), index("market_daily_day_idx").on(t.day)],
);

export const marketMeta = pgTable("market_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Per-account calculator settings (JSON) */
export const userSettings = pgTable("user_settings", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  data: text("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Per-account inventory: what the member already owns */
export const userInventory = pgTable(
  "user_inventory",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemId: integer("item_id").notNull(),
    qty: integer("qty").notNull(),
    avgCost: bigint("avg_cost", { mode: "number" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.itemId] })],
);

export type MarketItem = typeof marketItems.$inferSelect;
export type MarketDailyRow = typeof marketDaily.$inferSelect;

export type User = typeof users.$inferSelect;
export type PublicUser = Omit<User, "passwordHash">;
export type Session = typeof sessions.$inferSelect;
