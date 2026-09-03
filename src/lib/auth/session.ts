import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { PublicUser } from "@/lib/db/schema";
import { getUserBySessionToken, SESSION_TTL_MS } from "./service";

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

export async function requireUser(): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<PublicUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
