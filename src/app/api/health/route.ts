import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { isAdmin } from "@/lib/auth/roles";
import { getApiUser } from "@/lib/auth/session";
import { getDb, isUsingEmbeddedDb } from "@/lib/db";
import { describeError, driverName, publicErrorCode, sanitize, type ErrorLink } from "@/lib/health";
import { getMarketStatus } from "@/lib/market/snapshot";

export const dynamic = "force-dynamic";

/**
 * GET /api/health
 * Anyone: { ok, db: "ok" | "error", commit, code? } — code is the bare database error code
 * (e.g. "28P01"), never a message. A signed-in admin also gets the driver, environment,
 * deployment, latency, market status and the sanitized error chain.
 */
export async function GET() {
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null;
  let latencyMs: number | null = null;
  let chain: ErrorLink[] | null = null;
  try {
    const db = await getDb();
    const started = Date.now();
    await db.execute(sql`select 1`);
    latencyMs = Date.now() - started;
  } catch (e) {
    chain = describeError(e);
  }
  const ok = chain === null;
  const status = ok ? 200 : 503;
  const headers = { "Cache-Control": "no-store" };
  const pub = ok ? { ok, db: "ok" as const, commit } : { ok, db: "error" as const, commit, code: publicErrorCode(chain ?? []) };

  const me = await getApiUser();
  if (!me || !isAdmin(me.role)) return NextResponse.json(pub, { status, headers });

  const details = {
    driver: driverName(process.env),
    envSet: !isUsingEmbeddedDb(),
    vercel: Boolean(process.env.VERCEL),
    // which build is answering — tells apart "env edited but not redeployed" from "still wrong"
    deployment: process.env.VERCEL_DEPLOYMENT_ID ?? null,
  };
  if (!ok) {
    const c = chain ?? [];
    return NextResponse.json({ ...pub, ...details, error: c[c.length - 1], chain: c }, { status, headers });
  }
  const market = await getMarketStatus().catch((e) => ({ error: sanitize(String((e as Error).message)) }));
  return NextResponse.json({ ...pub, ...details, latencyMs, market }, { status, headers });
}
