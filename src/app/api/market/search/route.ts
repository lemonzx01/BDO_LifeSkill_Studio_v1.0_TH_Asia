import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { searchMarketItems } from "@/lib/market/snapshot";

export const dynamic = "force-dynamic";

/** GET /api/market/search?q=... -> up to 12 market items matching the name */
export async function GET(req: Request) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q") ?? "";
  try {
    return NextResponse.json({ items: await searchMarketItems(q) });
  } catch (e) {
    return NextResponse.json({ items: [], error: (e as Error).message });
  }
}
