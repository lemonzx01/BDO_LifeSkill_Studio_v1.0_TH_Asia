import { clientIp } from "@/lib/auth/ratelimit";
import { getCurrentUser } from "@/lib/auth/session";
import { readJsonBody } from "@/lib/http";
import { allowTrack, recordVisit } from "@/lib/usage/record";
import { bangkokDay, isBotUserAgent, isSameOrigin, parseTrackBody, TRACK_MAX_BODY_CHARS } from "@/lib/usage/track";

export const dynamic = "force-dynamic";

const answer = (status: number) => new Response(null, { status, headers: { "Cache-Control": "no-store" } });

/**
 * POST { vid, path } from UsageBeacon, for guests and members alike. Answers 204 once counted
 * (bots are answered 204 too, and not counted). 403 when another site's page sent it, 413 / 400
 * for an oversized or malformed body, 429 when the address sends more than TRACK_LIMIT reports
 * per TRACK_WINDOW_MS. See src/lib/usage for what is stored and how inflation is kept down.
 */
export async function POST(req: Request) {
  const h = req.headers;
  if (!isSameOrigin(h.get("origin"), [h.get("host"), h.get("x-forwarded-host")])) return answer(403);
  if (isBotUserAgent(h.get("user-agent"))) return answer(204);

  const parsed = await readJsonBody(req, TRACK_MAX_BODY_CHARS);
  if (!parsed.ok) return answer(parsed.status);
  const report = parseTrackBody(parsed.body);
  if (!report) return answer(400);

  try {
    const ip = clientIp(h);
    if (!(await allowTrack(ip))) return answer(429);
    // a valid session cookie, temporary password or not, makes this a member's visit
    const member = (await getCurrentUser()) !== null;
    await recordVisit({ ...report, member, ip, day: bangkokDay(new Date()) });
  } catch (e) {
    // counting is never worth an error in the visitor's console
    console.error("usage tracking failed:", (e as Error).message);
  }
  return answer(204);
}
