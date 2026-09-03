import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { normalizeSettings } from "@/lib/settings";
import { getUserSettings, saveUserSettings } from "@/lib/user-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ settings: await getUserSettings(user.id) });
}

export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const settings = normalizeSettings(body);
  await saveUserSettings(user.id, settings);
  return NextResponse.json({ ok: true, settings });
}
