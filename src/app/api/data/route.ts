import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/session";
import { items, meta, recipes } from "@/lib/data";
import { limitGuest } from "@/lib/public-rate-limit";

/**
 * Browsers always check back (max-age=0) and get a 304 while the ETag matches. The CDN may keep the
 * answer for as long as it likes: the data only changes with a deploy, and Vercel starts every
 * deploy with an empty CDN cache, so most requests never reach this function at all.
 */
const CACHE = "public, max-age=0, must-revalidate, s-maxage=31536000";

/**
 * GET /api/data -> { recipes, items, meta } — the static recipe/item database, the same for everyone.
 * Open to everyone. "Still the same?" checks (If-None-Match) are answered 304 straight away and never
 * counted; a full download by a visitor who is not signed in is rate limited per address.
 */
export async function GET(req: Request) {
  const etag = `"${meta.importedAt}-${meta.recipeCount}-${meta.itemCount}"`;
  if (req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag, "Cache-Control": CACHE } });
  }
  if (!(await getApiUser())) {
    const limited = await limitGuest("data", req.headers);
    if (limited) return limited;
  }
  return NextResponse.json({ recipes, items, meta }, { headers: { ETag: etag, "Cache-Control": CACHE } });
}
