import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserFavoriteDetails, setUserFavorite } from "@/lib/user-data";

export const dynamic = "force-dynamic";

/** GET -> { ids } : the member's starred items */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const items = await getUserFavoriteDetails(user.id);
  return NextResponse.json({ ids: items.map((i) => i.id), items }, { headers: { "Cache-Control": "no-store" } });
}

/** PUT { id, on } : star or unstar one item */
export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: { id?: unknown; on?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "bad id" }, { status: 400 });
  await setUserFavorite(user.id, id, Boolean(body.on));
  return NextResponse.json({ ok: true });
}
