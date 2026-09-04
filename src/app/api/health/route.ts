import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb, isUsingEmbeddedDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Anything that looks like credentials inside a connection string is masked before it leaves the server. */
function sanitize(message: string): string {
  return message
    .replace(/\/\/[^@\s]*@/g, "//***@")
    .replace(/^Failed query: [\s\S]*$/, "Failed query (see cause)")
    .slice(0, 300);
}

/** The error plus its `cause` chain, innermost last — Drizzle wraps driver errors, and the driver error is the useful one. */
function describe(e: unknown): { code: string | null; message: string }[] {
  const chain: { code: string | null; message: string }[] = [];
  let cur: unknown = e;
  for (let depth = 0; cur && depth < 4; depth++) {
    const err = cur as { code?: unknown; message?: unknown; cause?: unknown };
    chain.push({ code: typeof err.code === "string" ? err.code : null, message: sanitize(String(err.message ?? cur)) });
    cur = err.cause;
  }
  return chain;
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
  const base = {
    driver: driverName(),
    envSet,
    vercel: Boolean(process.env.VERCEL),
    // which build is answering — tells apart "env edited but not redeployed" from "still wrong"
    deployment: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
  };
  try {
    const db = await getDb();
    const started = Date.now();
    await db.execute(sql`select 1`);
    return NextResponse.json({ ok: true, db: "ok", latencyMs: Date.now() - started, ...base }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const chain = describe(e);
    return NextResponse.json(
      { ok: false, db: "error", ...base, error: chain[chain.length - 1], chain },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
