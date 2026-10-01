import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { APP_TABLES, getDb, resetDbCache, SCHEMA_SQL } from "./index";

// NODE_ENV=test -> getDb() uses an in-memory PGlite instance
beforeAll(() => {
  delete process.env.DATABASE_URL;
  resetDbCache();
});

function rowsOf<T>(res: unknown): T[] {
  return (res as { rows?: T[] }).rows ?? (res as T[]);
}

describe("database schema", () => {
  it("switches on row level security for every app table", async () => {
    const db = await getDb();
    const rows = rowsOf<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      await db.execute(sql`
        SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
      `),
    );
    const byName = new Map(rows.map((r) => [r.relname, r]));
    for (const t of APP_TABLES) {
      expect(byName.get(t), t).toMatchObject({ relrowsecurity: true, relforcerowsecurity: false });
    }
    // and no table was left out of APP_TABLES
    expect(rows.map((r) => r.relname).sort()).toEqual([...APP_TABLES].sort());
  });

  it("the owner connection still reads and writes with RLS on", async () => {
    const db = await getDb();
    await db.execute(sql`INSERT INTO market_meta (key, value) VALUES ('rls-check', 'ok')`);
    const rows = rowsOf<{ value: string }>(await db.execute(sql`SELECT value FROM market_meta WHERE key = 'rls-check'`));
    expect(rows[0]?.value).toBe("ok");
  });

  it("runs as one multi-statement script (the postgres.js path), twice, and locks Supabase's API roles out", async () => {
    const pg = new PGlite();
    try {
      // what a Supabase project starts with: API roles that get every privilege on new public tables
      await pg.exec(`
        CREATE ROLE anon NOLOGIN;
        CREATE ROLE authenticated NOLOGIN;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
      `);
      const script = SCHEMA_SQL.join(";\n");
      await pg.exec(script);
      await pg.exec(script); // idempotent: a cached connection re-applies it

      const priv = await pg.query<{ tables: boolean; seq: boolean; defaults: number }>(`
        SELECT
          has_table_privilege('anon', 'users', 'SELECT') OR has_table_privilege('authenticated', 'sessions', 'INSERT') AS tables,
          has_sequence_privilege('anon', 'users_id_seq', 'USAGE') AS seq,
          (SELECT COUNT(*)::int FROM pg_default_acl d, aclexplode(d.defaclacl) a
            WHERE a.grantee IN (SELECT oid FROM pg_roles WHERE rolname IN ('anon', 'authenticated'))) AS defaults
      `);
      expect(priv.rows[0]).toEqual({ tables: false, seq: false, defaults: 0 });

      // even if a grant comes back later, RLS with no policies still hides every row from the API roles
      await pg.exec(`
        INSERT INTO users (username, display_name, password_hash) VALUES ('someone', 'Someone', 'x');
        GRANT SELECT ON users TO anon;
      `);
      await pg.exec("SET ROLE anon");
      const seen = await pg.query<{ n: number }>("SELECT COUNT(*)::int AS n FROM users");
      await pg.exec("RESET ROLE");
      expect(seen.rows[0]?.n).toBe(0);
    } finally {
      await pg.close();
    }
  });
});
