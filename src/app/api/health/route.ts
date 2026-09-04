import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb, isUsingEmbeddedDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Anything that looks like credentials inside a connection string is masked before it leaves the server. */
function sanitize(message: string): string {
  return message.replace(/\/\/[^@\s]*@/g, "//***@").slice(0, 300);
}

function driverName(): string {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || "";
  if (!url) return "pglite (embedded)";
  return /\.neon\.tech[/:]/.test(url) ? "neon-http" : "postgres.js";
}

/**
 * GET /api/health -> { ok, db, driver, envSet, error? }
 * Public on purpose: it is the first thing to check when a fresh deployment shows a server error,
 * and it never reveals the connection string.
 */
export async function GET() {
  const envSet = !isUsingEmbeddedDb();
  const base = { driver: driverName(), envSet, vercel: Boolean(process.env.VERCEL) };
  try {
    const db = await getDb();
    const started = Date.now();
    await db.execute(sql`select 1`);
    return NextResponse.json({ ok: true, db: "ok", latencyMs: Date.now() - started, ...base }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return NextResponse.json(
      { ok: false, db: "error", ...base, error: { code: err.code ?? null, message: sanitize(String(err.message ?? e)) } },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
