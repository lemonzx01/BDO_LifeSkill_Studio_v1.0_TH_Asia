"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Role } from "@/lib/db/schema";
import { clearFailures, isThrottled, recordFailure } from "./ratelimit";
import {
  adminResetPassword,
  AuthError,
  changeOwnPassword,
  countUsers,
  createSession,
  createUser,
  deleteSession,
  deleteUser,
  setUserActive,
  setUserRole,
  verifyCredentials,
} from "./service";
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

export async function loginAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const username = str(fd, "username").trim().toLowerCase();
  const password = str(fd, "password");
  if (!username || !password) return { error: "กรอกชื่อผู้ใช้และรหัสผ่าน" };
  if (isThrottled(username)) return { error: "ล็อกอินผิดหลายครั้ง กรุณารอ 15 นาทีแล้วลองใหม่" };

  let result;
  try {
    result = await verifyCredentials(username, password);
  } catch (e) {
    return fail(e);
  }
  if (!result.ok) {
    recordFailure(username);
    return { error: result.reason === "disabled" ? "บัญชีนี้ถูกปิดการใช้งาน ติดต่อแอดมินของกิล" : "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
  }
  clearFailures(username);
  const ua = (await headers()).get("user-agent");
  const token = await createSession(result.user.id, ua);
  await setSessionCookie(token);
  redirect(result.user.mustChangePassword ? "/account?first=1" : "/");
}

export async function logoutAction() {
  const token = await getSessionToken();
  if (token) await deleteSession(token).catch(() => {});
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
      role: "admin",
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
  await requireAdmin();
  try {
    const role: Role = str(fd, "role") === "admin" ? "admin" : "member";
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
    await setUserActive(id, active);
  } catch (e) {
    console.error(e);
  }
  revalidatePath("/admin");
}

export async function adminSetRoleAction(fd: FormData): Promise<void> {
  const me = await requireAdmin();
  const id = num(fd, "id");
  const role: Role = str(fd, "role") === "admin" ? "admin" : "member";
  if (id === me.id) return;
  try {
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
    await deleteUser(id);
  } catch (e) {
    console.error(e);
  }
  revalidatePath("/admin");
}

export async function adminResetPasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    await adminResetPassword(num(fd, "id"), str(fd, "password"));
    revalidatePath("/admin");
    return { ok: true, message: "ตั้งรหัสผ่านชั่วคราวแล้ว ผู้ใช้ต้องล็อกอินใหม่และตั้งรหัสเอง" };
  } catch (e) {
    return fail(e);
  }
}

export async function changePasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser();
  const next = str(fd, "password");
  if (next !== str(fd, "confirm")) return { error: "รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน" };
  try {
    await changeOwnPassword(me.id, str(fd, "current"), next, (await getSessionToken()) ?? undefined);
  } catch (e) {
    return fail(e);
  }
  // a temporary password from the admin has just been replaced: continue into the app (redirect throws, so it stays outside the try)
  if (me.mustChangePassword) redirect("/");
  return { ok: true, message: "เปลี่ยนรหัสผ่านแล้ว" };
}
