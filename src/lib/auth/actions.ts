"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Role } from "@/lib/db/schema";
import { cleanupAttempts, clientIp, gateLogin, recordLoginSuccess, waitMinutes } from "./ratelimit";
import {
  AuthError,
  adminResetPassword,
  assertCanAssign,
  assertCanManage,
  changeOwnPassword,
  changeOwnProfile,
  countUsers,
  createSession,
  createUser,
  deleteSession,
  deleteUser,
  deleteUserSessions,
  getUserById,
  isRememberedSession,
  setUserActive,
  setUserRole,
  transferOwnership,
  verifyCredentials,
} from "./service";
import { parseRole, ROLE_TH } from "./roles";
import { clearSessionCookie, getSessionToken, requireAdmin, requireUser, setSessionCookie } from "./session";

export interface ActionState {
  error?: string;
  ok?: boolean;
  message?: string;
  /**
   * What was typed, handed back so the form can keep it (as defaultValue): the login name after a
   * failed sign-in, the new account's names after a failed create. Never a password.
   */
  username?: string;
  displayName?: string;
  /** the login form's "remember me" box after a failed sign-in, so a retry keeps the choice (not a secret) */
  remember?: boolean;
}

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "");
const num = (fd: FormData, key: string) => Number(fd.get(key));

function fail(e: unknown): ActionState {
  if (e instanceof AuthError) return { error: e.message };
  console.error(e);
  return { error: "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง" };
}

/** longer than any valid username (3–32): refused before any database work */
const LOGIN_USERNAME_MAX = 64;

/** The names a create form sent, cut to a sane length, to hand back after an error. */
function typedNames(fd: FormData): Pick<ActionState, "username" | "displayName"> {
  return { username: str(fd, "username").slice(0, LOGIN_USERNAME_MAX), displayName: str(fd, "displayName").slice(0, 2 * LOGIN_USERNAME_MAX) };
}

export async function loginAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const rawUsername = str(fd, "username");
  const remember = str(fd, "remember") === "1";
  if (rawUsername.length > LOGIN_USERNAME_MAX) return { error: "ชื่อผู้ใช้ยาวเกินไป", remember };
  const username = rawUsername.trim().toLowerCase();
  // every failure below hands back the name as typed and the remember choice (never the password),
  // whether or not the account exists, so the form keeps them and nothing tells real names apart
  const typed = rawUsername.trim();
  const password = str(fd, "password");
  if (!username || !password) return { error: "กรอกชื่อผู้ใช้และรหัสผ่าน", username: typed, remember };
  const h = await headers();
  const ip = clientIp(h);

  let result;
  let counted: string[] = [];
  try {
    // counted before the password is checked: the increment is the gate
    const gate = await gateLogin(username, ip);
    if (gate.wait !== null) return { error: `ล็อกอินผิดหลายครั้ง กรุณารอ ${waitMinutes(gate.wait)} นาทีแล้วลองใหม่`, username: typed, remember };
    counted = gate.counted;
    result = await verifyCredentials(username, password);
  } catch (e) {
    return { ...fail(e), username: typed, remember };
  }
  if (!result.ok) {
    return {
      error: result.reason === "disabled" ? "บัญชีนี้ถูกปิดการใช้งาน ติดต่อแอดมินของกิล" : "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
      username: typed,
      remember,
    };
  }
  try {
    // a correct password does not use up the counters, and this address now skips the account's overall cap
    await recordLoginSuccess(username, ip, counted);
    await cleanupAttempts();
  } catch (e) {
    console.error("login throttle cleanup failed:", (e as Error).message);
  }
  const token = await createSession(result.user.id, h.get("user-agent"), { remember });
  await setSessionCookie(token, { remember });
  redirect(result.user.mustChangePassword ? "/account?first=1" : "/");
}

export async function logoutAction() {
  const token = await getSessionToken();
  if (token) await deleteSession(token).catch(() => {});
  await clearSessionCookie();
  redirect("/login");
}

/** Ends every session of the signed-in account, on every device, this one included. */
export async function logoutEverywhereAction() {
  const me = await requireUser({ allowPendingPassword: true });
  await deleteUserSessions(me.id);
  await clearSessionCookie();
  redirect("/login");
}

/** First-run only: creates the first admin while the user table is empty. */
export async function setupAdminAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  // on an error the names come back so the form keeps them (the passwords are typed again)
  const typed = typedNames(fd);
  try {
    if ((await countUsers()) > 0) return { error: "ระบบถูกตั้งค่าแล้ว" };
    const password = str(fd, "password");
    if (password !== str(fd, "confirm")) return { error: "รหัสผ่านทั้งสองช่องไม่ตรงกัน", ...typed };
    const user = await createUser({
      username: str(fd, "username"),
      displayName: str(fd, "displayName"),
      password,
      role: "owner", // the first account is แอดมินใหญ่
      mustChangePassword: false,
    });
    const token = await createSession(user.id, (await headers()).get("user-agent"));
    await setSessionCookie(token);
  } catch (e) {
    return { ...fail(e), ...typed };
  }
  redirect("/");
}

/**
 * The temporary password is never sent back: the admin's page keeps what was typed and shows it
 * once. On an error the name and display name come back, so the form keeps them.
 */
export async function adminCreateUserAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  try {
    const role: Role = parseRole(str(fd, "role"));
    assertCanAssign(me.role, role);
    const user = await createUser({
      username: str(fd, "username"),
      displayName: str(fd, "displayName"),
      password: str(fd, "password"),
      role,
      mustChangePassword: true,
    });
    revalidatePath("/admin");
    return {
      ok: true,
      message: `สร้างบัญชี @${user.username} แล้ว ส่งข้อมูลด้านล่างให้สมาชิก (ล็อกอินครั้งแรกระบบจะให้ตั้งรหัสใหม่)`,
      username: user.username,
    };
  } catch (e) {
    return { ...fail(e), ...typedNames(fd) };
  }
}

// The row actions below (disable, role, delete, transfer) answer with what happened, shown in that
// member's row. Each checks the caller's rights itself: a button the page hides is not a check.

export async function adminSetActiveAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  const id = num(fd, "id");
  const active = str(fd, "active") === "1";
  if (id === me.id && !active) return { error: "ปิดใช้งานบัญชีตัวเองไม่ได้" };
  try {
    const target = await assertCanManage(me.role, id);
    await setUserActive(id, active);
    return { ok: true, message: `${active ? "เปิดใช้งาน" : "ปิดใช้งาน"} @${target.username} แล้ว` };
  } catch (e) {
    return fail(e);
  } finally {
    revalidatePath("/admin");
  }
}

export async function adminSetRoleAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  const id = num(fd, "id");
  const role: Role = parseRole(str(fd, "role"));
  if (id === me.id) return { error: "เปลี่ยนระดับของตัวเองไม่ได้" };
  try {
    const target = await assertCanManage(me.role, id);
    assertCanAssign(me.role, role);
    await setUserRole(id, role);
    return { ok: true, message: `ตั้ง @${target.username} เป็น${ROLE_TH[role]}แล้ว` };
  } catch (e) {
    return fail(e);
  } finally {
    revalidatePath("/admin");
  }
}

export async function adminDeleteUserAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  const id = num(fd, "id");
  if (id === me.id) return { error: "ลบบัญชีตัวเองไม่ได้" };
  try {
    const target = await assertCanManage(me.role, id);
    await deleteUser(id);
    return { ok: true, message: `ลบ @${target.username} แล้ว` };
  } catch (e) {
    return fail(e);
  } finally {
    revalidatePath("/admin");
  }
}

/** แอดมินใหญ่ hands the top role to someone else and steps down to แอดมินเล็ก. */
export async function adminTransferOwnerAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  const id = num(fd, "id");
  if (me.role !== "owner") return { error: "เฉพาะแอดมินใหญ่เท่านั้นที่โอนสิทธิ์ได้" };
  if (id === me.id) return { error: "โอนให้ตัวเองไม่ได้" };
  try {
    await transferOwnership(me.id, id);
    const target = await getUserById(id);
    return { ok: true, message: `โอนแอดมินใหญ่ให้ @${target?.username ?? id} แล้ว ตอนนี้คุณเป็นแอดมินเล็ก` };
  } catch (e) {
    return fail(e);
  } finally {
    revalidatePath("/admin");
  }
}

export async function adminResetPasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  try {
    const target = await assertCanManage(me.role, num(fd, "id"));
    await adminResetPassword(num(fd, "id"), str(fd, "password"));
    revalidatePath("/admin");
    // like a create, the password itself is not sent back
    return {
      ok: true,
      message: `ตั้งรหัสชั่วคราวให้ @${target.username} แล้ว เครื่องที่ล็อกอินไว้ถูกออกจากระบบ ส่งข้อมูลด้านล่างให้เขา (ล็อกอินครั้งถัดไประบบจะให้ตั้งรหัสใหม่)`,
      username: target.username,
    };
  } catch (e) {
    return fail(e);
  }
}

export async function changeProfileAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser();
  try {
    const user = await changeOwnProfile(me.id, { username: str(fd, "username"), displayName: str(fd, "displayName"), currentPassword: str(fd, "current") });
    revalidatePath("/", "layout");
    return { ok: true, message: `บันทึกแล้ว ชื่อผู้ใช้สำหรับล็อกอินคือ @${user.username}` };
  } catch (e) {
    return fail(e);
  }
}

export async function changePasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  // the one action open while the temporary password is still pending
  const me = await requireUser({ allowPendingPassword: true });
  const next = str(fd, "password");
  if (next !== str(fd, "confirm")) return { error: "รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน" };
  try {
    const oldToken = await getSessionToken();
    const remember = oldToken ? await isRememberedSession(oldToken) : false;
    // revokes every session of the account, this one included; sign back in with a fresh one
    await changeOwnPassword(me.id, str(fd, "current"), next);
    const token = await createSession(me.id, (await headers()).get("user-agent"), { remember });
    await setSessionCookie(token, { remember });
  } catch (e) {
    return fail(e);
  }
  // a temporary password from the admin has just been replaced: continue into the app (redirect throws, so it stays outside the try)
  if (me.mustChangePassword) redirect("/");
  return { ok: true, message: "เปลี่ยนรหัสผ่านแล้ว เครื่องอื่นที่ล็อกอินไว้จะต้องล็อกอินใหม่" };
}
