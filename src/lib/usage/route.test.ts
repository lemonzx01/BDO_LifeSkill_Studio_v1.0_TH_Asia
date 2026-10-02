import { sql } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/track/route";
import { getDb, resetDbCache } from "@/lib/db";
import { usagePageViews, usageVisitorDays } from "@/lib/db/schema";

// the real session helpers read next/headers cookies; here a test decides who is signed in
const session = vi.hoisted(() => ({ user: null as null | { id: number; mustChangePassword: boolean } }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: async () => session.user }));

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
const VID = "3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b";

function report(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://bdo.test/api/track", {
    method: "POST",
    headers: {
      host: "bdo.test",
      origin: "http://bdo.test",
      "user-agent": CHROME,
      "content-type": "application/json",
      "x-real-ip": "203.0.113.9",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function counted() {
  const db = await getDb();
  return {
    days: await db.select().from(usageVisitorDays).orderBy(usageVisitorDays.day),
    views: await db.select().from(usagePageViews).orderBy(usagePageViews.day, usagePageViews.path),
  };
}

beforeAll(() => {
  delete process.env.DATABASE_URL;
  resetDbCache();
});

beforeEach(async () => {
  session.user = null;
  const db = await getDb();
  await db.execute(sql`DELETE FROM usage_visitor_days`);
  await db.execute(sql`DELETE FROM usage_visitors`);
  await db.execute(sql`DELETE FROM usage_page_views`);
  await db.execute(sql`DELETE FROM login_attempts`);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/track", () => {
  it("counts a guest's report and answers 204 with no body", async () => {
    const res = await POST(report({ vid: VID, path: "/recipes?q=x" }));
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const c = await counted();
    expect(c.days).toHaveLength(1);
    expect(c.days[0].member).toBe(false);
    expect(c.views).toMatchObject([{ path: "/recipes", views: 1 }]);
  });

  it("marks the day as a member's when a valid session comes with it, temporary password or not", async () => {
    session.user = { id: 1, mustChangePassword: true };
    expect((await POST(report({ vid: VID, path: "/account" }))).status).toBe(204);
    expect((await counted()).days[0].member).toBe(true);
  });

  it("refuses another site's page with 403 and counts nothing", async () => {
    const res = await POST(report({ vid: VID, path: "/" }, { origin: "https://evil.example" }));
    expect(res.status).toBe(403);
    expect((await POST(report({ vid: VID, path: "/" }, { origin: "null" }))).status).toBe(403);
    expect(await counted()).toEqual({ days: [], views: [] });
  });

  it("accepts a report without an Origin header", async () => {
    const req = report({ vid: VID, path: "/" });
    req.headers.delete("origin");
    expect((await POST(req)).status).toBe(204);
    expect((await counted()).days).toHaveLength(1);
  });

  it("answers bots 204 without counting them", async () => {
    const res = await POST(report({ vid: VID, path: "/" }, { "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" }));
    expect(res.status).toBe(204);
    const noUa = report({ vid: VID, path: "/" });
    noUa.headers.delete("user-agent");
    expect((await POST(noUa)).status).toBe(204);
    expect(await counted()).toEqual({ days: [], views: [] });
  });

  it("refuses a body over 500 characters, bad JSON and a bad id", async () => {
    expect((await POST(report({ vid: VID, path: "/" + "a".repeat(500) }))).status).toBe(413);
    expect((await POST(report("{not json"))).status).toBe(400);
    expect((await POST(report({ vid: "1234", path: "/" }))).status).toBe(400);
    expect((await POST(report({ vid: VID }))).status).toBe(400);
    expect(await counted()).toEqual({ days: [], views: [] });
  });

  it("answers 429 once an address sends more than 120 reports in 15 minutes", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 122; i++) statuses.push((await POST(report({ vid: VID, path: "/" }))).status);
    expect(statuses.slice(0, 120).every((s) => s === 204)).toBe(true);
    expect(statuses.slice(120)).toEqual([429, 429]);
    expect((await counted()).views).toMatchObject([{ views: 120 }]);
    // another address is not held up
    expect((await POST(report({ vid: VID, path: "/" }, { "x-real-ip": "203.0.113.10" }))).status).toBe(204);
  });

  it("files reports by the calendar day in Bangkok, turning over at 17:00 UTC", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T16:59:30Z")); // 23:59:30 on 1 Oct in Bangkok
    await POST(report({ vid: VID, path: "/" }));
    vi.setSystemTime(new Date("2026-10-01T17:00:30Z")); // 00:00:30 on 2 Oct in Bangkok
    await POST(report({ vid: VID, path: "/" }));
    await POST(report({ vid: VID, path: "/market" }));
    const c = await counted();
    expect(c.days.map((d) => d.day)).toEqual(["2026-10-01", "2026-10-02"]);
    expect(c.views.map((v) => [v.day, v.path, v.views])).toEqual([
      ["2026-10-01", "/", 1],
      ["2026-10-02", "/", 1],
      ["2026-10-02", "/market", 1],
    ]);
  });
});
