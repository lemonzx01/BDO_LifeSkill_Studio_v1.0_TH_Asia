"use client";

import { useActionState, useState } from "react";
import {
  adminCreateUserAction,
  adminDeleteUserAction,
  adminResetPasswordAction,
  adminSetActiveAction,
  adminSetRoleAction,
  type ActionState,
} from "@/lib/auth/actions";
import { dangerBtn, errorCls, ghostBtn, inputCls, labelCls, okCls, primaryBtn } from "./ui";

export interface AdminUserRow {
  id: number;
  username: string;
  displayName: string;
  role: "admin" | "member";
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export function AdminUsers({ users, meId }: { users: AdminUserRow[]; meId: number }) {
  return (
    <div className="space-y-6">
      <CreateUserForm />
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-panel-2 text-xs text-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium">ผู้ใช้</th>
              <th className="px-3 py-2 text-left font-medium">สิทธิ์</th>
              <th className="px-3 py-2 text-left font-medium">สถานะ</th>
              <th className="px-3 py-2 text-left font-medium">ล็อกอินล่าสุด</th>
              <th className="px-3 py-2 text-left font-medium">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <UserRow key={u.id} u={u} isMe={u.id === meId} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreateUserForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(adminCreateUserAction, {});
  return (
    <form action={formAction} className="rounded-lg border border-border bg-panel p-4">
      <h2 className="mb-3 text-sm font-semibold text-accent">สร้างบัญชีให้สมาชิก</h2>
      <div className="grid gap-3 md:grid-cols-4">
        <label className={labelCls}>
          ชื่อผู้ใช้
          <input name="username" required className={inputCls} placeholder="เช่น somchai" />
        </label>
        <label className={labelCls}>
          ชื่อที่แสดง
          <input name="displayName" className={inputCls} placeholder="ชื่อในเกม" />
        </label>
        <label className={labelCls}>
          รหัสผ่านชั่วคราว (≥ 8 ตัว)
          <input name="password" type="text" required minLength={8} className={inputCls} autoComplete="off" />
        </label>
        <label className={labelCls}>
          สิทธิ์
          <select name="role" className={inputCls} defaultValue="member">
            <option value="member">สมาชิก</option>
            <option value="admin">แอดมิน</option>
          </select>
        </label>
      </div>
      {state.error && <div className={`${errorCls} mt-3`}>{state.error}</div>}
      {state.ok && <div className={`${okCls} mt-3`}>{state.message}</div>}
      <button type="submit" disabled={pending} className={`${primaryBtn} mt-3`}>
        {pending ? "กำลังสร้าง…" : "สร้างบัญชี"}
      </button>
    </form>
  );
}

function UserRow({ u, isMe }: { u: AdminUserRow; isMe: boolean }) {
  const [showReset, setShowReset] = useState(false);
  return (
    <>
      <tr className="border-t border-border">
        <td className="px-3 py-2">
          <div className="font-medium">
            {u.displayName} {isMe && <span className="text-xs text-muted">(คุณ)</span>}
          </div>
          <div className="text-xs text-muted">@{u.username}</div>
        </td>
        <td className="px-3 py-2">
          {u.role === "admin" ? <span className="rounded bg-accent/15 px-1.5 py-0.5 text-xs text-accent">แอดมิน</span> : <span className="text-muted">สมาชิก</span>}
        </td>
        <td className="px-3 py-2">
          {u.isActive ? (
            <span className="rounded bg-good/15 px-1.5 py-0.5 text-xs text-good">ใช้งานได้</span>
          ) : (
            <span className="rounded bg-bad/15 px-1.5 py-0.5 text-xs text-bad">ปิดใช้งาน</span>
          )}
          {u.mustChangePassword && <span className="ml-1 rounded bg-warn/15 px-1.5 py-0.5 text-xs text-warn">รอตั้งรหัสใหม่</span>}
        </td>
        <td className="px-3 py-2 text-xs text-muted">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("th-TH") : "ยังไม่เคย"}</td>
        <td className="px-3 py-2">
          {isMe ? (
            <span className="text-xs text-muted">แก้ไขตัวเองที่หน้า &ldquo;รหัสผ่าน&rdquo;</span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              <form action={adminSetActiveAction}>
                <input type="hidden" name="id" value={u.id} />
                <input type="hidden" name="active" value={u.isActive ? "0" : "1"} />
                <button type="submit" className={u.isActive ? dangerBtn : ghostBtn}>
                  {u.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                </button>
              </form>
              <form action={adminSetRoleAction}>
                <input type="hidden" name="id" value={u.id} />
                <input type="hidden" name="role" value={u.role === "admin" ? "member" : "admin"} />
                <button type="submit" className={ghostBtn}>
                  {u.role === "admin" ? "ถอดแอดมิน" : "ตั้งเป็นแอดมิน"}
                </button>
              </form>
              <button type="button" onClick={() => setShowReset((s) => !s)} className={ghostBtn}>
                รีเซ็ตรหัส
              </button>
              <form
                action={adminDeleteUserAction}
                onSubmit={(e) => {
                  if (!confirm(`ลบบัญชี ${u.username} ถาวร?`)) e.preventDefault();
                }}
              >
                <input type="hidden" name="id" value={u.id} />
                <button type="submit" className={dangerBtn}>
                  ลบ
                </button>
              </form>
            </div>
          )}
        </td>
      </tr>
      {showReset && !isMe && (
        <tr className="border-t border-border/60 bg-background/40">
          <td colSpan={5} className="px-3 py-2">
            <ResetPasswordForm id={u.id} username={u.username} onDone={() => setShowReset(false)} />
          </td>
        </tr>
      )}
    </>
  );
}

function ResetPasswordForm({ id, username, onDone }: { id: number; username: string; onDone: () => void }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(adminResetPasswordAction, {});
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <label className={labelCls}>
        รหัสผ่านชั่วคราวใหม่ของ @{username}
        <input name="password" type="text" required minLength={8} className={inputCls} autoComplete="off" />
      </label>
      <button type="submit" disabled={pending} className={primaryBtn}>
        {pending ? "กำลังบันทึก…" : "บันทึก"}
      </button>
      <button type="button" onClick={onDone} className={ghostBtn}>
        ปิด
      </button>
      {state.error && <div className={errorCls}>{state.error}</div>}
      {state.ok && <div className={okCls}>{state.message}</div>}
    </form>
  );
}
