import { NextResponse } from "next/server";
import { cleanupAttempts } from "@/lib/auth/ratelimit";
import { checkCronAuth } from "@/lib/cron-auth";
import { refreshMarket } from "@/lib/market/snapshot";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/market — scheduled by vercel.json. Vercel sends "Authorization: Bearer <CRON_SECRET>".
 * Fails closed: on Vercel or any production server without CRON_SECRET nobody may call it; only a development run skips the check.
 */
export async function GET(req: Request) {
  const auth = checkCronAuth(req.headers.get("authorization"), process.env);
  if (auth === "unconfigured") return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (auth === "unauthorized") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // once a day: drop throttle counters (sign-in and the public API limits) whose window ended over a day ago
  await cleanupAttempts().catch((e) => console.error("throttle cleanup failed:", (e as Error).message));
  try {
    const result = await refreshMarket({ force: true, backfill: 150 });
    return NextResponse.json(result);
  } catch (e) {
    console.error("cron market refresh failed:", e);
    return NextResponse.json({ error: "refresh failed" }, { status: 502 });
  }
}
