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
  isRememberedSession,
  setUserActive,
  setUserRole,
  transferOwnership,
  verifyCredentials,
} from "./service";
import { parseRole } from "./roles";
import { clearSessionCookie, getSessionToken, requireAdmin, requireUser, setSessionCookie } from "./session";

export interface ActionState {
  error?: string;
  ok?: boolean;
  message?: string;
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

export async function loginAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const rawUsername = str(fd, "username");
  if (rawUsername.length > LOGIN_USERNAME_MAX) return { error: "ชื่อผู้ใช้ยาวเกินไป" };
  const username = rawUsername.trim().toLowerCase();
  const password = str(fd, "password");
  if (!username || !password) return { error: "กรอกชื่อผู้ใช้และรหัสผ่าน" };
  const remember = str(fd, "remember") === "1";
  const h = await headers();
  const ip = clientIp(h);

  let result;
  let counted: string[] = [];
  try {
    // counted before the password is checked: the increment is the gate
    const gate = await gateLogin(username, ip);
    if (gate.wait !== null) return { error: `ล็อกอินผิดหลายครั้ง กรุณารอ ${waitMinutes(gate.wait)} นาทีแล้วลองใหม่` };
    counted = gate.counted;
    result = await verifyCredentials(username, password);
  } catch (e) {
    return fail(e);
  }
  if (!result.ok) {
    return { error: result.reason === "disabled" ? "บัญชีนี้ถูกปิดการใช้งาน ติดต่อแอดมินของกิล" : "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
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
  try {
    if ((await countUsers()) > 0) return { error: "ระบบถูกตั้งค่าแล้ว" };
    const password = str(fd, "password");
    if (password !== str(fd, "confirm")) return { error: "รหัสผ่านทั้งสองช่องไม่ตรงกัน" };
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
    return fail(e);
  }
  redirect("/");
}

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
    return { ok: true, message: `สร้างบัญชี ${user.username} แล้ว แจ้งชื่อผู้ใช้และรหัสผ่านชั่วคราวให้สมาชิก (ระบบจะให้ตั้งรหัสใหม่ตอนล็อกอินครั้งแรก)` };
  } catch (e) {
    return fail(e);
  }
}

export async function adminSetActiveAction(fd: FormData): Promise<void> {
  const me = await requireAdmin();
  const id = num(fd, "id");
  const active = str(fd, "active") === "1";
  if (id === me.id && !active) return;
  try {
    await assertCanManage(me.role, id);
    await setUserActive(id, active);
  } catch (e) {
    console.error(e);
  }
  revalidatePath("/admin");
}

export async function adminSetRoleAction(fd: FormData): Promise<void> {
  const me = await requireAdmin();
  const id = num(fd, "id");
  const role: Role = parseRole(str(fd, "role"));
  if (id === me.id) return;
  try {
    await assertCanManage(me.role, id);
    assertCanAssign(me.role, role);
    await setUserRole(id, role);
  } catch (e) {
    console.error(e);
  }
  revalidatePath("/admin");
}

export async function adminDeleteUserAction(fd: FormData): Promise<void> {
  const me = await requireAdmin();
  const id = num(fd, "id");
  if (id === me.id) return;
  try {
    await assertCanManage(me.role, id);
    await deleteUser(id);
  } catch (e) {
    console.error(e);
  }
  revalidatePath("/admin");
}

/** แอดมินใหญ่ hands the top role to someone else and steps down to แอดมินเล็ก. */
export async function adminTransferOwnerAction(fd: FormData): Promise<void> {
  const me = await requireAdmin();
  const id = num(fd, "id");
  if (me.role !== "owner" || id === me.id) return;
  try {
    await transferOwnership(me.id, id);
  } catch (e) {
    console.error(e);
  }
  revalidatePath("/admin");
}

export async function adminResetPasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  try {
    await assertCanManage(me.role, num(fd, "id"));
    await adminResetPassword(num(fd, "id"), str(fd, "password"));
    revalidatePath("/admin");
    return { ok: true, message: "ตั้งรหัสผ่านชั่วคราวแล้ว ผู้ใช้ต้องล็อกอินใหม่และตั้งรหัสเอง" };
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
