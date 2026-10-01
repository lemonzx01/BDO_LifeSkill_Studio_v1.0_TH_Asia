import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/session";
import { readJsonBody } from "@/lib/http";
import { getUserFavoriteDetails, setUserFavorite } from "@/lib/user-data";
import { parseId } from "@/lib/validate";

export const dynamic = "force-dynamic";

const MAX_BODY_CHARS = 2000;

/** GET -> { ids } : the member's starred items */
export async function GET() {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const items = await getUserFavoriteDetails(user.id);
  return NextResponse.json({ ids: items.map((i) => i.id), items }, { headers: { "Cache-Control": "no-store" } });
}

/** PUT { id, on } : star (on: true) or unstar (on: false) one item */
export async function PUT(req: Request) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = await readJsonBody(req, MAX_BODY_CHARS);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = (parsed.body && typeof parsed.body === "object" ? parsed.body : {}) as { id?: unknown; on?: unknown };
  const id = parseId(body.id);
  if (id === null) return NextResponse.json({ error: "bad id" }, { status: 400 });
  if (typeof body.on !== "boolean") return NextResponse.json({ error: "bad on" }, { status: 400 });
  await setUserFavorite(user.id, id, body.on);
  return NextResponse.json({ ok: true });
}
