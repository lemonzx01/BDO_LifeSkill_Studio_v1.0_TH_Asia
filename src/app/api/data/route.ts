import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { items, meta, recipes } from "@/lib/data";

/**
 * GET /api/data -> { recipes, items, meta } — the static recipe/item database.
 * Served with an ETag so browsers re-download only after a new import.
 */
export async function GET(req: Request) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const etag = `"${meta.importedAt}-${meta.recipeCount}-${meta.itemCount}"`;
  if (req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag } });
  }
  return NextResponse.json(
    { recipes, items, meta },
    // no-cache = always revalidate with the ETag (304 when unchanged), never serve a stale recipe DB
    { headers: { ETag: etag, "Cache-Control": "private, no-cache" } },
  );
}
