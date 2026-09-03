import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { refreshMarket } from "@/lib/market/snapshot";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST /api/market/refresh -> forces a whole-market snapshot refresh (any logged-in member). */
export async function POST() {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const result = await refreshMarket({ force: true, backfill: 40 });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
