import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/session";
import { readJsonBody } from "@/lib/http";
import { normalizeSettings } from "@/lib/settings";
import { getUserSettings, saveUserSettings } from "@/lib/user-data";

export const dynamic = "force-dynamic";

/** real settings are well under 2,000 characters; this only stops someone storing junk */
const MAX_BODY_CHARS = 20_000;

export async function GET() {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ settings: await getUserSettings(user.id) });
}

export async function PUT(req: Request) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = await readJsonBody(req, MAX_BODY_CHARS);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const settings = normalizeSettings(parsed.body);
  await saveUserSettings(user.id, settings);
  return NextResponse.json({ ok: true, settings });
}
