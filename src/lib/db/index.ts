import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

/**
 * One Postgres dialect, two drivers:
 *  - DATABASE_URL set  -> Neon serverless (HTTP) for Vercel / any Postgres-over-Neon
 *  - DATABASE_URL unset -> PGlite, an embedded Postgres stored under .data/pglite
 *                          (in-memory when NODE_ENV=test)
 * The schema is created idempotently on first use so no migration step is
 * needed for a fresh deployment.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    user_agent TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id)`,
  `CREATE TABLE IF NOT EXISTS market_items (
    id INTEGER PRIMARY KEY,
    name_th TEXT NOT NULL,
    name_en TEXT,
    icon TEXT,
    grade INTEGER NOT NULL DEFAULT 0,
    cat TEXT,
    sub TEXT,
    price BIGINT NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    total_trades BIGINT NOT NULL DEFAULT 0,
    volume_14d INTEGER,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    history_fetched_at TIMESTAMPTZ
  )`,
  `CREATE TABLE IF NOT EXISTS market_daily (
    item_id INTEGER NOT NULL,
    day DATE NOT NULL,
    price BIGINT NOT NULL,
    stock INTEGER,
    total_trades BIGINT,
    PRIMARY KEY (item_id, day)
  )`,
  `CREATE INDEX IF NOT EXISTS market_daily_day_idx ON market_daily(day)`,
  `CREATE TABLE IF NOT EXISTS market_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS user_settings (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS user_inventory (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL,
    qty INTEGER NOT NULL,
    avg_cost BIGINT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, item_id)
  )`,
];

declare global {
  // cached across hot reloads in dev and across requests in one serverless instance
  var __blsDb: Promise<Db> | undefined;
  var __blsSchemaVersion: string | undefined;
}

// changes whenever SCHEMA_SQL changes, so a cached connection re-applies new tables
const SCHEMA_VERSION = String(SCHEMA_SQL.join("\n").length) + ":" + SCHEMA_SQL.length;

async function ensureSchema(db: Db) {
  for (const stmt of SCHEMA_SQL) await db.execute(sql.raw(stmt));
  globalThis.__blsSchemaVersion = SCHEMA_VERSION;
}

async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  let db: Db;
  if (url) {
    const { neon } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-http");
    db = drizzle({ client: neon(url), schema }) as unknown as Db;
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const dataDir = process.env.NODE_ENV === "test" ? undefined : (process.env.PGLITE_DATA_DIR ?? ".data/pglite");
    if (dataDir) {
      const { mkdirSync } = await import("node:fs");
      mkdirSync(dataDir, { recursive: true }); // PGlite only creates the leaf directory
    }
    const client = dataDir ? new PGlite(dataDir) : new PGlite();
    db = drizzle({ client, schema }) as unknown as Db;
  }
  await ensureSchema(db);
  return db;
}

export async function getDb(): Promise<Db> {
  if (!globalThis.__blsDb) {
    globalThis.__blsDb = connect().catch((e) => {
      globalThis.__blsDb = undefined; // let the next call retry
      throw e;
    });
  }
  const db = await globalThis.__blsDb;
  if (globalThis.__blsSchemaVersion !== SCHEMA_VERSION) await ensureSchema(db);
  return db;
}

export function isUsingEmbeddedDb(): boolean {
  return !process.env.DATABASE_URL;
}

/** Test helper: drop the cached connection so the next getDb() starts fresh. */
export function resetDbCache() {
  globalThis.__blsDb = undefined;
  globalThis.__blsSchemaVersion = undefined;
}
