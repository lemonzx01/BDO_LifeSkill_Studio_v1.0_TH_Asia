import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { recordTiming } from "@/lib/market/snapshot";

export const dynamic = "force-dynamic";

const NUMBER_FIELDS = [
  "rows",
  "ttfbMs",
  "responseMs",
  "domReadyMs",
  "transferBytes",
  "decodedBytes",
  "mountedMs",
  "scriptBytes",
  "scriptCount",
  "scriptsDoneMs",
  "imageBytes",
  "imageCount",
] as const;

/** POST { page, ...timings } from PerfBeacon; the latest report per page is shown by /api/health. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const page = String(body.page ?? "").replace(/[^a-z]/g, "").slice(0, 20);
  if (!page) return NextResponse.json({ error: "bad page" }, { status: 400 });
  const data: Record<string, unknown> = { at: new Date().toISOString(), user: user.username, fullLoad: Boolean(body.fullLoad), mobile: Boolean(body.mobile) };
  for (const k of NUMBER_FIELDS) {
    const v = Number(body[k]);
    data[k] = Number.isFinite(v) ? Math.round(v) : null;
  }
  data.connection = typeof body.connection === "string" ? body.connection.slice(0, 10) : null;
  await recordTiming(`timing_${page}_client`, data).catch(() => {});
  return NextResponse.json({ ok: true });
}
