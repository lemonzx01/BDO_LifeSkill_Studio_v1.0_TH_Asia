import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/session";
import { searchMarketItems } from "@/lib/market/snapshot";

export const dynamic = "force-dynamic";

/** Longest search text we look up; item names are far shorter. */
const MAX_QUERY = 64;

/** GET /api/market/search?q=... -> up to 12 market items matching the name */
export async function GET(req: Request) {
  if (!(await getApiUser())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY);
  try {
    return NextResponse.json({ items: await searchMarketItems(q) });
  } catch (e) {
    console.error("market search failed:", e);
    return NextResponse.json({ items: [], error: "search failed" });
  }
}
