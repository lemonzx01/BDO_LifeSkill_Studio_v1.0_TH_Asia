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

/** Current user for this request (deduplicated per request), or null. */
export const getCurrentUser = cache(async (): Promise<PublicUser | null> => {
  const token = await getSessionToken();
  if (!token) return null;
  try {
    return await getUserBySessionToken(token);
  } catch (e) {
    console.error("session lookup failed:", (e as Error).message);
    return null;
  }
});

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
