import { beforeAll, describe, expect, it } from "vitest";
import { resetDbCache } from "@/lib/db";
import {
  adminResetPassword,
  changeOwnPassword,
  countUsers,
  createSession,
  createUser,
  deleteUser,
  getUserBySessionToken,
  listUsers,
  setUserActive,
  setUserRole,
  verifyCredentials,
} from "./service";

// NODE_ENV=test -> getDb() uses an in-memory PGlite instance
beforeAll(() => {
  delete process.env.DATABASE_URL;
  resetDbCache();
});

describe("auth service", () => {
  it("starts empty and creates an admin", async () => {
    expect(await countUsers()).toBe(0);
    const admin = await createUser({ username: "Boss", password: "secret123", role: "admin", mustChangePassword: false });
    expect(admin.username).toBe("boss"); // normalised
    expect(admin.role).toBe("admin");
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

  it("keeps at least one active admin", async () => {
    const [admin] = (await listUsers()).filter((u) => u.role === "admin");
    await expect(setUserActive(admin.id, false)).rejects.toThrow(/แอดมิน/);
    await expect(setUserRole(admin.id, "member")).rejects.toThrow(/แอดมิน/);
    await expect(deleteUser(admin.id)).rejects.toThrow(/แอดมิน/);
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

  it("deletes a member", async () => {
    const u = await createUser({ username: "member3", password: "temp-pass-3" });
    await deleteUser(u.id);
    expect((await listUsers()).some((x) => x.id === u.id)).toBe(false);
  });
});
