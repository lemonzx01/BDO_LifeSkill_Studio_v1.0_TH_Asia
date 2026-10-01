import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/session";
import { manualRefresh } from "@/lib/market/snapshot";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/market/refresh -> forces a whole-market snapshot refresh (any signed-in member),
 * at most once every two minutes across all members and server instances, counted from the last
 * snapshot or the last manual start (even a failed one): sooner gets 429 with the seconds to wait.
 */
export async function POST() {
  if (!(await getApiUser())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const out = await manualRefresh();
    if (!out.ok) {
      const wait = out.retryAfterSec;
      return NextResponse.json(
        { error: `เพิ่งอัปเดตไปเมื่อสักครู่ ลองใหม่ในอีก ${wait} วินาที`, retryAfterSec: wait },
        { status: 429, headers: { "Retry-After": String(wait) } },
      );
    }
    return NextResponse.json(out.result);
  } catch (e) {
    console.error("manual market refresh failed:", e);
    return NextResponse.json({ error: "อัปเดตตลาดไม่สำเร็จ ลองใหม่ภายหลัง" }, { status: 502 });
  }
}
