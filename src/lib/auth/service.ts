import { and, asc, count, eq, gt, ne } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";
import { sessions, users, type PublicUser, type Role, type User } from "@/lib/db/schema";
import { DUMMY_HASH, hashPassword, normalizeUsername, validateDisplayName, validatePassword, validateUsername, verifyPassword } from "./password";
import { clearReauth, gateReauth, waitMinutes } from "./ratelimit";
import { assignableRoles, canManage } from "./roles";

/** "remember me" sessions last 30 days (and the cookie persists as long) */
export const REMEMBER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** otherwise 12 hours on the server, with a cookie that ends when the browser closes */
export const SHORT_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function toPublic(u: User): PublicUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...rest } = u;
  return rest;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export class AuthError extends Error {}

export async function countUsers(): Promise<number> {
  const db = await getDb();
  const [row] = await db.select({ n: count() }).from(users);
  return Number(row?.n ?? 0);
}

export async function listUsers(): Promise<PublicUser[]> {
  const db = await getDb();
  const rows = await db.select().from(users).orderBy(asc(users.createdAt), asc(users.id));
  return rows.map(toPublic);
}

export async function getUserById(id: number): Promise<PublicUser | null> {
  const db = await getDb();
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ? toPublic(row) : null;
}

export async function createUser(input: {
  username: string;
  displayName?: string;
  password: string;
  role?: Role;
  mustChangePassword?: boolean;
}): Promise<PublicUser> {
  const username = normalizeUsername(input.username);
  const uErr = validateUsername(username);
  if (uErr) throw new AuthError(uErr);
  const pErr = validatePassword(input.password);
  if (pErr) throw new AuthError(pErr);
  const displayName = (input.displayName ?? "").trim();
  const dErr = validateDisplayName(displayName);
  if (dErr) throw new AuthError(dErr);
  const db = await getDb();
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
  if (exists) throw new AuthError("ชื่อผู้ใช้นี้มีอยู่แล้ว");
  const [row] = await db
    .insert(users)
    .values({
      username,
      displayName: displayName || username,
      passwordHash: await hashPassword(input.password),
      role: input.role ?? "member",
      mustChangePassword: input.mustChangePassword ?? true,
    })
    .returning();
  return toPublic(row);
}

export type LoginResult = { ok: true; user: PublicUser } | { ok: false; reason: "invalid" | "disabled" };

export async function verifyCredentials(usernameRaw: string, password: string): Promise<LoginResult> {
  const username = normalizeUsername(usernameRaw);
  const db = await getDb();
  const [row] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (!row) {
    await verifyPassword(password, DUMMY_HASH);
    return { ok: false, reason: "invalid" };
  }
  const good = await verifyPassword(password, row.passwordHash);
  if (!good) return { ok: false, reason: "invalid" };
  if (!row.isActive) return { ok: false, reason: "disabled" };
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, row.id));
  return { ok: true, user: toPublic({ ...row, lastLoginAt: new Date() }) };
}

/** Creates a session row and returns the raw token for the cookie (30 days with `remember`, else 12 hours). */
export async function createSession(userId: number, userAgent?: string | null, opts: { remember?: boolean } = {}): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const db = await getDb();
  await db.insert(sessions).values({
    id: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + (opts.remember ? REMEMBER_SESSION_TTL_MS : SHORT_SESSION_TTL_MS)),
    userAgent: userAgent?.slice(0, 200) ?? null,
  });
  return token;
}

/** Whether the session behind this token was created with "remember me" (it outlives a short session). */
export async function isRememberedSession(token: string): Promise<boolean> {
  if (!token) return false;
  const db = await getDb();
  const [row] = await db
    .select({ createdAt: sessions.createdAt, expiresAt: sessions.expiresAt })
    .from(sessions)
    .where(eq(sessions.id, hashToken(token)))
    .limit(1);
  return !!row && row.expiresAt.getTime() - row.createdAt.getTime() > SHORT_SESSION_TTL_MS + 60 * 60 * 1000;
}

/** Resolves a cookie token to an active user, or null (expired, revoked, or user disabled). */
export async function getUserBySessionToken(token: string): Promise<PublicUser | null> {
  if (!token) return null;
  const db = await getDb();
  const [row] = await db
    .select({ user: users, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!row) return null;
  if (!row.user.isActive) {
    await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
    return null;
  }
  return toPublic(row.user);
}

export async function deleteSession(token: string) {
  const db = await getDb();
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

export async function deleteUserSessions(userId: number) {
  const db = await getDb();
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

async function assertNotLastOwner(db: Awaited<ReturnType<typeof getDb>>, userId: number) {
  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target || target.role !== "owner" || !target.isActive) return;
  const [others] = await db
    .select({ n: count() })
    .from(users)
    .where(and(eq(users.role, "owner"), eq(users.isActive, true), ne(users.id, userId)));
  if (Number(others?.n ?? 0) === 0) throw new AuthError("ต้องเหลือแอดมินใหญ่ที่เปิดใช้งานอย่างน้อย 1 คน");
}

/** Throws unless someone with `actorRole` may manage the account `targetId`; returns that account. */
export async function assertCanManage(actorRole: Role, targetId: number): Promise<PublicUser> {
  const target = await getUserById(targetId);
  if (!target) throw new AuthError("ไม่พบผู้ใช้");
  if (!canManage(actorRole, target.role)) throw new AuthError("แอดมินเล็กจัดการได้เฉพาะบัญชีสมาชิก");
  return target;
}

/** Throws unless someone with `actorRole` may hand out `role`. */
export function assertCanAssign(actorRole: Role, role: Role) {
  if (!assignableRoles(actorRole).includes(role)) throw new AuthError("ไม่มีสิทธิ์ตั้งระดับนี้");
}

/** Disabling also revokes every session so the user is locked out immediately. */
export async function setUserActive(userId: number, active: boolean) {
  const db = await getDb();
  if (!active) await assertNotLastOwner(db, userId);
  await db.update(users).set({ isActive: active }).where(eq(users.id, userId));
  if (!active) await deleteUserSessions(userId);
}

export async function setUserRole(userId: number, role: Role) {
  const db = await getDb();
  if (role !== "owner") await assertNotLastOwner(db, userId);
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

/** Hands แอดมินใหญ่ to another active account; the giver becomes แอดมินเล็ก. */
export async function transferOwnership(fromId: number, toId: number) {
  if (fromId === toId) throw new AuthError("โอนให้ตัวเองไม่ได้");
  const db = await getDb();
  const [from] = await db.select().from(users).where(eq(users.id, fromId)).limit(1);
  const [to] = await db.select().from(users).where(eq(users.id, toId)).limit(1);
  if (!from || from.role !== "owner") throw new AuthError("เฉพาะแอดมินใหญ่เท่านั้นที่โอนสิทธิ์ได้");
  if (!to) throw new AuthError("ไม่พบผู้ใช้");
  if (!to.isActive) throw new AuthError("บัญชีปลายทางถูกปิดใช้งานอยู่");
  await db.update(users).set({ role: "owner" }).where(eq(users.id, toId));
  await db.update(users).set({ role: "admin" }).where(eq(users.id, fromId));
}

export async function deleteUser(userId: number) {
  const db = await getDb();
  await assertNotLastOwner(db, userId);
  await db.delete(users).where(eq(users.id, userId)); // sessions cascade
}

/** Admin sets a temporary password; the user must change it and all their sessions are revoked. */
export async function adminResetPassword(userId: number, newPassword: string) {
  const pErr = validatePassword(newPassword);
  if (pErr) throw new AuthError(pErr);
  const db = await getDb();
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(newPassword), mustChangePassword: true })
    .where(eq(users.id, userId));
  await deleteUserSessions(userId);
}

/**
 * Confirms the current password of a signed-in user. Throttled per account before bcrypt runs
 * (10 tries per 15 minutes); a correct password resets the count.
 */
async function confirmCurrentPassword(row: User, currentPassword: string) {
  const wait = await gateReauth(row.id);
  if (wait !== null) throw new AuthError(`ใส่รหัสผ่านผิดหลายครั้ง กรุณารอ ${waitMinutes(wait)} นาทีแล้วลองใหม่`);
  if (!(await verifyPassword(currentPassword, row.passwordHash))) throw new AuthError("รหัสผ่านปัจจุบันไม่ถูกต้อง");
  await clearReauth(row.id);
}

/** User changes their own login name and display name; the current password confirms it is really them. */
export async function changeOwnProfile(userId: number, input: { username: string; displayName: string; currentPassword: string }): Promise<PublicUser> {
  const username = normalizeUsername(input.username);
  const uErr = validateUsername(username);
  if (uErr) throw new AuthError(uErr);
  const displayName = input.displayName.trim();
  const dErr = validateDisplayName(displayName);
  if (dErr) throw new AuthError(dErr);
  const db = await getDb();
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!row) throw new AuthError("ไม่พบผู้ใช้");
  await confirmCurrentPassword(row, input.currentPassword);
  if (username !== row.username) {
    const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
    if (exists) throw new AuthError("ชื่อผู้ใช้นี้มีอยู่แล้ว");
  }
  const [updated] = await db
    .update(users)
    .set({ username, displayName: displayName || username })
    .where(eq(users.id, userId))
    .returning();
  return toPublic(updated);
}

/**
 * User changes their own password. Every session of the account is revoked, the current one
 * included: the caller signs the user back in with a fresh session.
 */
export async function changeOwnPassword(userId: number, currentPassword: string, newPassword: string) {
  const pErr = validatePassword(newPassword);
  if (pErr) throw new AuthError(pErr);
  if (newPassword === currentPassword) throw new AuthError("รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม");
  const db = await getDb();
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!row) throw new AuthError("ไม่พบผู้ใช้");
  await confirmCurrentPassword(row, currentPassword);
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(newPassword), mustChangePassword: false })
    .where(eq(users.id, userId));
  await deleteUserSessions(userId);
}
