import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// session.ts is server-only and reads the cookie through next/headers: both are stood in for here,
// and redirect() throws like Next's does, so a test can see where it would have sent the visitor
const h = vi.hoisted(() => {
  class Redirected extends Error {
    constructor(readonly url: string) {
      super(`redirect ${url}`);
    }
  }
  return { token: null as string | null, Redirected };
});
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "bls_session" && h.token ? { name, value: h.token } : undefined),
    set: () => {},
    delete: () => {},
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new h.Redirected(url);
  },
}));

import { resetDbCache } from "@/lib/db";
import { createSession, createUser, deleteSession } from "./service";
import { getOptionalUser, getVisitor, requireUser, safeNextPath } from "./session";

/** Where the call redirected to, or null when it returned normally. */
async function redirectOf(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e) {
    if (e instanceof h.Redirected) return e.url;
    throw e;
  }
}

// NODE_ENV=test -> getDb() uses an in-memory PGlite instance
beforeAll(() => {
  delete process.env.DATABASE_URL;
  resetDbCache();
});

beforeEach(() => {
  h.token = null;
});

describe("getOptionalUser", () => {
  it("is null for a visitor without a session cookie", async () => {
    expect(await getOptionalUser()).toBeNull();
  });

  it("is null for a cookie that matches no session", async () => {
    h.token = "not-a-real-session-token";
    expect(await getOptionalUser()).toBeNull();
  });

  it("returns the signed-in member", async () => {
    const u = await createUser({ username: "publicpage", password: "secret123", mustChangePassword: false });
    h.token = await createSession(u.id, "test");
    const me = await getOptionalUser();
    expect(me?.id).toBe(u.id);
    expect(me?.username).toBe("publicpage");
  });

  it("sends an account still on its temporary password to the password change", async () => {
    const u = await createUser({ username: "pendingpw", password: "secret123", mustChangePassword: true });
    h.token = await createSession(u.id, "test");
    expect(await redirectOf(getOptionalUser())).toBe("/account?first=1");
    // the members-only check does the same, and only the account page may let it through
    expect(await redirectOf(requireUser())).toBe("/account?first=1");
    expect(await redirectOf(requireUser({ allowPendingPassword: true }))).toBeNull();
  });

  it("leaves requireUser sending visitors to /login", async () => {
    expect(await redirectOf(requireUser())).toBe("/login");
  });
});

describe("getVisitor", () => {
  it("says nothing ended for a visitor who never signed in", async () => {
    expect(await getVisitor()).toEqual({ user: null, sessionEnded: null });
  });

  it("tells a session that ran out apart from no session at all", async () => {
    const u = await createUser({ username: "signedout", password: "secret123", mustChangePassword: false });
    const token = await createSession(u.id, "test");
    await deleteSession(token);
    h.token = token;
    expect(await getVisitor()).toEqual({ user: null, sessionEnded: "expired" });
    h.token = "never-was-a-session";
    expect((await getVisitor()).sessionEnded).toBe("expired");
  });

  it("gives a signed-in member with nothing ended", async () => {
    const u = await createUser({ username: "stillin", password: "secret123", mustChangePassword: false });
    h.token = await createSession(u.id, "test");
    const v = await getVisitor();
    expect(v.user?.id).toBe(u.id);
    expect(v.sessionEnded).toBeNull();
  });
});

describe("safeNextPath", () => {
  it("keeps paths on this site, with their query and hash", () => {
    expect(safeNextPath("/")).toBe("/");
    expect(safeNextPath("/recipes")).toBe("/recipes");
    expect(safeNextPath("/recipes?tab=alchemy&open=12")).toBe("/recipes?tab=alchemy&open=12");
    expect(safeNextPath("/market?q=%E0%B8%99%E0%B9%89%E0%B8%B3")).toBe("/market?q=%E0%B8%99%E0%B9%89%E0%B8%B3");
    expect(safeNextPath("/help#top")).toBe("/help#top");
    // an encoded slash is part of a path, not a host
    expect(safeNextPath("/%2F%2Fevil.example")).toBe("/%2F%2Fevil.example");
  });

  it("refuses anything that is not a string path", () => {
    for (const v of [undefined, null, 42, {}, ["/recipes"], ""]) expect(safeNextPath(v)).toBe("/");
    expect(safeNextPath("recipes")).toBe("/");
    expect(safeNextPath(" /recipes")).toBe("/");
  });

  it("refuses other sites, schemes and protocol-relative tricks", () => {
    const bad = [
      "https://evil.example",
      "http://evil.example/recipes",
      "javascript:alert(1)",
      "data:text/html,hi",
      "//evil.example",
      "//evil.example/recipes",
      "/\\evil.example",
      "\\\\evil.example",
      "/recipes\\..\\..",
      // browsers drop tabs and newlines inside URLs, which would leave "//evil.example"
      "/\t/evil.example",
      "/\n/evil.example",
      "/\r/evil.example",
      "/\u0000/evil.example",
      // the parser removes dot segments: these would come out as "//evil.example"
      "/.//evil.example",
      "/..//evil.example",
      "/%2e//evil.example",
    ];
    for (const v of bad) expect(safeNextPath(v), JSON.stringify(v)).toBe("/");
  });

  it("does not return to the sign-in or setup page, and refuses overlong input", () => {
    expect(safeNextPath("/login")).toBe("/");
    expect(safeNextPath("/login?next=%2Frecipes")).toBe("/");
    expect(safeNextPath("/setup")).toBe("/");
    expect(safeNextPath(`/${"a".repeat(600)}`)).toBe("/");
  });
});
