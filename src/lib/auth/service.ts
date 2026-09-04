import { and, asc, count, eq, gt, ne } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";
import { sessions, users, type PublicUser, type Role, type User } from "@/lib/db/schema";
import { DUMMY_HASH, hashPassword, normalizeUsername, validatePassword, validateUsername, verifyPassword } from "./password";
import { assignableRoles, canManage } from "./roles";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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
  const db = await getDb();
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
  if (exists) throw new AuthError("ชื่อผู้ใช้นี้มีอยู่แล้ว");
  const [row] = await db
    .insert(users)
    .values({
      username,
      displayName: (input.displayName ?? "").trim() || username,
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

/** Creates a session row and returns the raw token for the cookie. */
export async function createSession(userId: number, userAgent?: string | null): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const db = await getDb();
  await db.insert(sessions).values({
    id: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    userAgent: userAgent?.slice(0, 200) ?? null,
  });
  return token;
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

/** User changes their own password; other sessions are revoked, the current one is kept. */
export async function changeOwnPassword(userId: number, currentPassword: string, newPassword: string, keepToken?: string) {
  const pErr = validatePassword(newPassword);
  if (pErr) throw new AuthError(pErr);
  const db = await getDb();
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!row) throw new AuthError("ไม่พบผู้ใช้");
  if (!(await verifyPassword(currentPassword, row.passwordHash))) throw new AuthError("รหัสผ่านปัจจุบันไม่ถูกต้อง");
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(newPassword), mustChangePassword: false })
    .where(eq(users.id, userId));
  if (keepToken) {
    await db.delete(sessions).where(and(eq(sessions.userId, userId), ne(sessions.id, hashToken(keepToken))));
  } else {
    await deleteUserSessions(userId);
  }
}
