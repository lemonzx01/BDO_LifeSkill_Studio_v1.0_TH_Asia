import { boolean, index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export type Role = "admin" | "member";

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

export type User = typeof users.$inferSelect;
export type PublicUser = Omit<User, "passwordHash">;
export type Session = typeof sessions.$inferSelect;
