import { desc, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { getDb, resetDbCache } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { clear, THROTTLE_LIMITS } from "./ratelimit";
import { assignableRoles, canManage } from "./roles";
import {
  adminResetPassword,
  assertCanAssign,
  assertCanManage,
  changeOwnPassword,
  changeOwnProfile,
  countUsers,
  createSession,
  createUser,
  deleteUser,
  deleteUserSessions,
  getUserBySessionToken,
  isRememberedSession,
  listUsers,
  REMEMBER_SESSION_TTL_MS,
  setUserActive,
  setUserRole,
  SHORT_SESSION_TTL_MS,
  transferOwnership,
  verifyCredentials,
} from "./service";

// NODE_ENV=test -> getDb() uses an in-memory PGlite instance
beforeAll(() => {
  delete process.env.DATABASE_URL;
  resetDbCache();
});

describe("auth service", () => {
  it("starts empty and creates the owner", async () => {
    expect(await countUsers()).toBe(0);
    const owner = await createUser({ username: "Boss", password: "secret123", role: "owner", mustChangePassword: false });
    expect(owner.username).toBe("boss"); // normalised
    expect(owner.role).toBe("owner");
    expect(await countUsers()).toBe(1);
  });

  it("rejects bad usernames, short passwords and duplicates", async () => {
    await expect(createUser({ username: "a", password: "secret123" })).rejects.toThrow();
    await expect(createUser({ username: "okname", password: "short" })).rejects.toThrow();
    await expect(createUser({ username: "boss", password: "secret123" })).rejects.toThrow(/มีอยู่แล้ว/);
  });

  it("verifies credentials", async () => {
    expect((await verifyCredentials("BOSS", "secret123")).ok).toBe(true);
    expect(await verifyCredentials("boss", "wrong")).toEqual({ ok: false, reason: "invalid" });
    expect(await verifyCredentials("nobody", "secret123")).toEqual({ ok: false, reason: "invalid" });
  });

  it("resolves sessions and revokes them when a user is disabled", async () => {
    const member = await createUser({ username: "member1", password: "temp-pass-1" });
    const token = await createSession(member.id, "vitest");
    expect((await getUserBySessionToken(token))?.username).toBe("member1");
    expect(await getUserBySessionToken("bogus")).toBeNull();

    await setUserActive(member.id, false);
    expect(await getUserBySessionToken(token)).toBeNull();
    expect(await verifyCredentials("member1", "temp-pass-1")).toEqual({ ok: false, reason: "disabled" });

    await setUserActive(member.id, true);
    expect(await getUserBySessionToken(token)).toBeNull(); // old session stays revoked
    expect((await verifyCredentials("member1", "temp-pass-1")).ok).toBe(true);
  });

  it("keeps at least one active แอดมินใหญ่", async () => {
    const [owner] = (await listUsers()).filter((u) => u.role === "owner");
    await expect(setUserActive(owner.id, false)).rejects.toThrow(/แอดมินใหญ่/);
    await expect(setUserRole(owner.id, "admin")).rejects.toThrow(/แอดมินใหญ่/);
    await expect(deleteUser(owner.id)).rejects.toThrow(/แอดมินใหญ่/);
    // a second owner makes the first one demotable again
    const second = await createUser({ username: "boss2", password: "secret123", role: "owner" });
    await setUserRole(owner.id, "admin");
    expect((await listUsers()).find((u) => u.id === owner.id)?.role).toBe("admin");
    await setUserRole(owner.id, "owner");
    await deleteUser(second.id);
  });

  it("แอดมินเล็ก manages members only, แอดมินใหญ่ manages everyone", async () => {
    const small = await createUser({ username: "small-admin", password: "secret123", role: "admin" });
    const member = await createUser({ username: "member0", password: "secret123" });
    await expect(assertCanManage("admin", member.id)).resolves.toMatchObject({ username: "member0" });
    await expect(assertCanManage("admin", small.id)).rejects.toThrow(/สมาชิก/);
    await expect(assertCanManage("owner", small.id)).resolves.toMatchObject({ role: "admin" });
    await expect(assertCanManage("owner", 999_999)).rejects.toThrow(/ไม่พบ/);
    expect(() => assertCanAssign("admin", "admin")).toThrow();
    expect(() => assertCanAssign("owner", "owner")).not.toThrow();
    expect(assignableRoles("admin")).toEqual(["member"]);
    expect(canManage("member", "member")).toBe(false);
    await deleteUser(small.id);
    await deleteUser(member.id);
  });

  it("changes and resets passwords, revoking every session", async () => {
    const u = await createUser({ username: "member2", password: "temp-pass-2" });
    const current = await createSession(u.id);
    const other = await createSession(u.id);
    expect((await getUserBySessionToken(current))?.mustChangePassword).toBe(true);
    await expect(changeOwnPassword(u.id, "wrong-pass", "new-pass-123")).rejects.toThrow(/ปัจจุบัน/);
    await expect(changeOwnPassword(u.id, "temp-pass-2", "temp-pass-2")).rejects.toThrow(/ไม่ซ้ำ/);
    await changeOwnPassword(u.id, "temp-pass-2", "new-pass-123");
    // rotated: the session that made the change is gone too; the action signs in again with a fresh one
    expect(await getUserBySessionToken(current)).toBeNull();
    expect(await getUserBySessionToken(other)).toBeNull();
    const fresh = await createSession(u.id);
    expect((await getUserBySessionToken(fresh))?.mustChangePassword).toBe(false);
    expect((await verifyCredentials("member2", "new-pass-123")).ok).toBe(true);
    expect((await verifyCredentials("member2", "temp-pass-2")).ok).toBe(false);

    await adminResetPassword(u.id, "reset-pass-9");
    expect(await getUserBySessionToken(fresh)).toBeNull();
    const r = await verifyCredentials("member2", "reset-pass-9");
    expect(r.ok && r.user.mustChangePassword).toBe(true);
  });

  it("throttles current-password re-checks per account, before bcrypt", async () => {
    const u = await createUser({ username: "guessme", password: "real-pass-1" });
    for (let i = 0; i < THROTTLE_LIMITS.reauth; i++) {
      await expect(changeOwnPassword(u.id, `guess-${i}-xx`, "new-pass-123")).rejects.toThrow(/ปัจจุบัน/);
    }
    // over the limit: refused even with the right password, and the profile form shares the counter
    await expect(changeOwnPassword(u.id, "real-pass-1", "new-pass-123")).rejects.toThrow(/รอ 15 นาที/);
    await expect(changeOwnProfile(u.id, { username: "guessme", displayName: "G", currentPassword: "real-pass-1" })).rejects.toThrow(/รอ/);
    // other accounts are unaffected
    const v = await createUser({ username: "bystander", password: "real-pass-2" });
    await changeOwnPassword(v.id, "real-pass-2", "new-pass-456");
    // a correct password resets the count
    await clear(`reauth:${u.id}`);
    for (let i = 0; i < THROTTLE_LIMITS.reauth - 1; i++) {
      await expect(changeOwnPassword(u.id, `guess-${i}-yy`, "new-pass-123")).rejects.toThrow(/ปัจจุบัน/);
    }
    await changeOwnPassword(u.id, "real-pass-1", "new-pass-123");
    await expect(changeOwnPassword(u.id, "wrong-again", "new-pass-789")).rejects.toThrow(/ปัจจุบัน/);
    await deleteUser(u.id);
    await deleteUser(v.id);
  });

  it("keeps sessions short unless the user asks to be remembered", async () => {
    const u = await createUser({ username: "sessions1", password: "secret123" });
    const db = await getDb();
    const lifetime = async (token: string) => {
      const [row] = await db
        .select({ createdAt: sessions.createdAt, expiresAt: sessions.expiresAt })
        .from(sessions)
        .where(eq(sessions.userId, u.id))
        .orderBy(desc(sessions.createdAt))
        .limit(1);
      expect(await getUserBySessionToken(token)).not.toBeNull();
      return row.expiresAt.getTime() - row.createdAt.getTime();
    };
    const short = await createSession(u.id, "vitest");
    expect(Math.abs((await lifetime(short)) - SHORT_SESSION_TTL_MS)).toBeLessThan(60_000);
    expect(await isRememberedSession(short)).toBe(false);
    await deleteUserSessions(u.id);
    const long = await createSession(u.id, "vitest", { remember: true });
    expect(Math.abs((await lifetime(long)) - REMEMBER_SESSION_TTL_MS)).toBeLessThan(60_000);
    expect(await isRememberedSession(long)).toBe(true);
    expect(await isRememberedSession("bogus")).toBe(false);
    // signing out everywhere ends them all
    await createSession(u.id);
    await deleteUserSessions(u.id);
    expect(await getUserBySessionToken(long)).toBeNull();
    await deleteUser(u.id);
  });

  it("limits display names to 40 characters after trimming", async () => {
    const forty = "ก".repeat(40);
    await expect(createUser({ username: "longname", displayName: forty + "x", password: "secret123" })).rejects.toThrow(/40/);
    const u = await createUser({ username: "longname", displayName: `  ${forty}  `, password: "secret123" });
    expect(u.displayName).toBe(forty);
    await expect(changeOwnProfile(u.id, { username: "longname", displayName: forty + "x", currentPassword: "secret123" })).rejects.toThrow(/40/);
    const same = await changeOwnProfile(u.id, { username: "longname", displayName: ` ${forty} `, currentPassword: "secret123" });
    expect(same.displayName).toBe(forty);
    await deleteUser(u.id);
  });

  it("transfers แอดมินใหญ่ to another account and steps down", async () => {
    const [owner] = (await listUsers()).filter((u) => u.role === "owner");
    const heir = await createUser({ username: "heir", password: "secret123" });
    await expect(transferOwnership(heir.id, owner.id)).rejects.toThrow(/แอดมินใหญ่/);
    await transferOwnership(owner.id, heir.id);
    const after = await listUsers();
    expect(after.find((u) => u.id === heir.id)?.role).toBe("owner");
    expect(after.find((u) => u.id === owner.id)?.role).toBe("admin");
    await transferOwnership(heir.id, owner.id); // hand it back for the remaining tests
    await deleteUser(heir.id);
  });

  it("lets a user rename themselves once they prove the password", async () => {
    const u = await createUser({ username: "oldname", displayName: "Old", password: "secret123" });
    await expect(changeOwnProfile(u.id, { username: "newname", displayName: "New", currentPassword: "wrong" })).rejects.toThrow(/ปัจจุบัน/);
    await expect(changeOwnProfile(u.id, { username: "boss", displayName: "New", currentPassword: "secret123" })).rejects.toThrow(/มีอยู่แล้ว/);
    await expect(changeOwnProfile(u.id, { username: "x", displayName: "New", currentPassword: "secret123" })).rejects.toThrow();
    const renamed = await changeOwnProfile(u.id, { username: "NewName", displayName: "  ", currentPassword: "secret123" });
    expect(renamed.username).toBe("newname");
    expect(renamed.displayName).toBe("newname"); // blank display name falls back to the login name
    expect((await verifyCredentials("newname", "secret123")).ok).toBe(true);
    await deleteUser(u.id);
  });

  it("deletes a member", async () => {
    const u = await createUser({ username: "member3", password: "temp-pass-3" });
    await deleteUser(u.id);
    expect((await listUsers()).some((x) => x.id === u.id)).toBe(false);
  });
});
