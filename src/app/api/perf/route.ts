import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/session";
import { readJsonBody } from "@/lib/http";
import { recordTiming } from "@/lib/market/snapshot";
import { buildPerfRecord } from "@/lib/perf";

export const dynamic = "force-dynamic";

/** a real report is a few hundred characters */
const MAX_BODY_CHARS = 4000;

/**
 * POST { page, ...timings } from PerfBeacon; the latest report per page is shown to admins by /api/health.
 * Only allow-listed pages are kept, numbers are clamped and no account name is stored.
 */
export async function POST(req: Request) {
  if (!(await getApiUser())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = await readJsonBody(req, MAX_BODY_CHARS);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const record = buildPerfRecord(parsed.body, new Date());
  if (!record) return NextResponse.json({ error: "bad page" }, { status: 400 });
  await recordTiming(record.key, record.data).catch(() => {});
  return NextResponse.json({ ok: true });
}
