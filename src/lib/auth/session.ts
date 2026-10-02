import "server-only";
import { isAdmin } from "./roles";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { PublicUser } from "@/lib/db/schema";
import { getUserBySessionToken, REMEMBER_SESSION_TTL_MS } from "./service";

export const SESSION_COOKIE = "bls_session";

export async function getSessionToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value ?? null;
}

/**
 * Why a request that came with a session cookie has no user:
 * - "expired": the session is over (timed out, signed out elsewhere, account closed) though the browser still sends the cookie
 * - "unchecked": the session could not be looked up (database unreachable); it may still be good
 */
export type SessionEnded = "expired" | "unchecked";

/** This request's session: the user, or null with why a cookie it carries did not give one. Deduplicated per request. */
const getSession = cache(async (): Promise<{ user: PublicUser | null; ended: SessionEnded | null }> => {
  const token = await getSessionToken();
  if (!token) return { user: null, ended: null };
  try {
    const user = await getUserBySessionToken(token);
    return { user, ended: user ? null : "expired" };
  } catch (e) {
    console.error("session lookup failed:", (e as Error).message);
    return { user: null, ended: "unchecked" };
  }
});

/** Current user for this request (deduplicated per request), or null. */
export const getCurrentUser = cache(async (): Promise<PublicUser | null> => (await getSession()).user);

/**
 * Signed-in user, or a redirect to /login. While the account still has the temporary password
 * an admin gave it, everything except the password change sends the user to /account first;
 * only the account page and the password change itself pass `allowPendingPassword`.
 */
export async function requireUser(opts: { allowPendingPassword?: boolean } = {}): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword && !opts.allowPendingPassword) redirect("/account?first=1");
  return user;
}

/** Admin (either tier) with their own password set, or a redirect. */
export async function requireAdmin(): Promise<PublicUser> {
  const user = await requireUser();
  if (!isAdmin(user.role)) redirect("/");
  return user;
}

/**
 * For the pages anyone may open (home, recipes, market, inventory, calc, help): the signed-in user,
 * or null for a visitor who is not signed in. An account still on its temporary password is sent to
 * /account?first=1 here as well, so the public pages are no way around changing it.
 */
export async function getOptionalUser(): Promise<PublicUser | null> {
  return (await getVisitor()).user;
}

/**
 * getOptionalUser, plus `sessionEnded` for a visitor who is not signed in although the browser sent
 * a session cookie: a member whose session ran out sees the page as a guest, and the page says so
 * (SessionEndedNotice) instead of quietly showing an empty guest inventory.
 */
export async function getVisitor(): Promise<{ user: PublicUser | null; sessionEnded: SessionEnded | null }> {
  const { user, ended } = await getSession();
  if (user?.mustChangePassword) redirect("/account?first=1");
  return { user, sessionEnded: user ? null : ended };
}

/** Longest ?next= kept; real paths in this app are far shorter. */
const NEXT_PATH_MAX = 512;
/** Pages that make no sense to return to after signing in. */
const NO_RETURN = new Set(["/login", "/setup"]);

/**
 * Where to go after signing in: `raw` (from ?next=) when it is a path on this site, else "/". A
 * path starts with one "/" and has no backslash, control character or scheme; it is also checked
 * after the URL parser has tidied it (so "/./" or "%2e" tricks cannot turn it into "//host").
 */
export function safeNextPath(raw: unknown): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > NEXT_PATH_MAX) return "/";
  // control characters: browsers drop tabs and newlines inside a URL, which could leave "//host"
  if (!raw.startsWith("/") || raw.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(raw)) return "/";
  let url: URL;
  try {
    url = new URL(raw, "http://same.invalid");
  } catch {
    return "/";
  }
  if (url.origin !== "http://same.invalid") return "/";
  const path = `${url.pathname}${url.search}${url.hash}`;
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return "/";
  if (NO_RETURN.has(url.pathname)) return "/";
  return path;
}

/** For route handlers: the signed-in user, or null when signed out or still on a temporary password. */
export async function getApiUser(): Promise<PublicUser | null> {
  const user = await getCurrentUser();
  return user && !user.mustChangePassword ? user : null;
}

/** With `remember` the cookie lasts 30 days; without, it is a browser-session cookie (the server side ends after 12 hours). */
export async function setSessionCookie(token: string, opts: { remember?: boolean } = {}) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(opts.remember ? { maxAge: Math.floor(REMEMBER_SESSION_TTL_MS / 1000) } : {}),
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
