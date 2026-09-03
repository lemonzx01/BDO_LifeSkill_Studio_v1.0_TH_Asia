import { NextResponse } from "next/server";
import { refreshMarket } from "@/lib/market/snapshot";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/market — scheduled by vercel.json. Vercel sends
 * "Authorization: Bearer <CRON_SECRET>"; when CRON_SECRET is set we require it.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await refreshMarket({ force: true, backfill: 150 });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
