import { beforeAll, describe, expect, it } from "vitest";
import { resetDbCache } from "@/lib/db";
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
  getUserBySessionToken,
  listUsers,
  setUserActive,
  setUserRole,
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

  it("changes and resets passwords, keeping only the current session", async () => {
    const u = await createUser({ username: "member2", password: "temp-pass-2" });
    const keep = await createSession(u.id);
    const other = await createSession(u.id);
    await expect(changeOwnPassword(u.id, "wrong", "new-pass-123", keep)).rejects.toThrow(/ปัจจุบัน/);
    await changeOwnPassword(u.id, "temp-pass-2", "new-pass-123", keep);
    expect((await getUserBySessionToken(keep))?.mustChangePassword).toBe(false);
    expect(await getUserBySessionToken(other)).toBeNull();
    expect((await verifyCredentials("member2", "new-pass-123")).ok).toBe(true);

    await adminResetPassword(u.id, "reset-pass-9");
    expect(await getUserBySessionToken(keep)).toBeNull();
    const r = await verifyCredentials("member2", "reset-pass-9");
    expect(r.ok && r.user.mustChangePassword).toBe(true);
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
