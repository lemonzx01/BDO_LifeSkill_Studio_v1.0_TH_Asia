"use client";

import { useActionState, useState } from "react";
import {
  adminCreateUserAction,
  adminDeleteUserAction,
  adminResetPasswordAction,
  adminSetActiveAction,
  adminSetRoleAction,
  adminTransferOwnerAction,
  type ActionState,
} from "@/lib/auth/actions";
import { assignableRoles, canManage, ROLE_TH } from "@/lib/auth/roles";
import type { Role } from "@/lib/db/schema";
import { errorCls, ghostBtn, inputCls, labelCls, okCls, primaryBtn } from "./ui";

// row controls: one height, never wrapping, quieter than the page-level buttons
const rowBtn = "h-8 whitespace-nowrap rounded border border-border bg-panel px-2.5 text-xs hover:bg-panel-2 disabled:opacity-50";
const rowDanger = "h-8 whitespace-nowrap rounded border border-bad/40 bg-bad/10 px-2.5 text-xs text-bad hover:bg-bad/20 disabled:opacity-50";
const rowSelect = "h-8 rounded border border-border bg-panel px-2 text-xs outline-none focus:border-accent";
const badge = "inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-xs";

export interface AdminUserRow {
  id: number;
  username: string;
  displayName: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export function AdminUsers({ users, meId, meRole }: { users: AdminUserRow[]; meId: number; meRole: Role }) {
  return (
    <div className="space-y-6">
      <CreateUserForm meRole={meRole} />
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-panel-2 text-xs text-muted">
            <tr>
              <th className="w-[24%] px-3 py-2 text-left font-medium">ผู้ใช้</th>
              <th className="w-px whitespace-nowrap px-3 py-2 text-left font-medium">สิทธิ์</th>
              <th className="w-px whitespace-nowrap px-3 py-2 text-left font-medium">สถานะ</th>
              <th className="w-px whitespace-nowrap px-3 py-2 text-left font-medium">ล็อกอินล่าสุด</th>
              <th className="px-3 py-2 text-left font-medium">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <UserRow key={u.id} u={u} isMe={u.id === meId} meRole={meRole} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        แอดมินใหญ่ จัดการได้ทุกบัญชี ตั้งระดับให้ใครก็ได้ และโอนตำแหน่งให้คนอื่นได้ · แอดมินเล็ก สร้าง/ปิด/ลบ/รีเซ็ตรหัสได้เฉพาะสมาชิก · ต้องมีแอดมินใหญ่ที่เปิดใช้งานอย่างน้อย 1 คนเสมอ
      </p>
    </div>
  );
}

function CreateUserForm({ meRole }: { meRole: Role }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(adminCreateUserAction, {});
  const roles = assignableRoles(meRole);
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
          <select name="role" className={inputCls} defaultValue="member" disabled={roles.length <= 1}>
            {roles.map((r) => (
              <option key={r} value={r}>
                {ROLE_TH[r]}
              </option>
            ))}
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

function RoleBadge({ role }: { role: Role }) {
  if (role === "owner") return <span className={`${badge} bg-accent/15 text-accent`}>{ROLE_TH.owner}</span>;
  if (role === "admin") return <span className={`${badge} bg-sky-500/15 text-sky-300`}>{ROLE_TH.admin}</span>;
  return <span className={`${badge} text-muted`}>{ROLE_TH.member}</span>;
}

function UserRow({ u, isMe, meRole }: { u: AdminUserRow; isMe: boolean; meRole: Role }) {
  const [showReset, setShowReset] = useState(false);
  const manageable = !isMe && canManage(meRole, u.role);
  const roles = assignableRoles(meRole);
  return (
    <>
      <tr className="border-t border-border">
        <td className="px-3 py-2">
          <div className="font-medium">
            {u.displayName} {isMe && <span className="text-xs text-muted">(คุณ)</span>}
          </div>
          <div className="text-xs text-muted">@{u.username}</div>
        </td>
        <td className="whitespace-nowrap px-3 py-2">
          <RoleBadge role={u.role} />
        </td>
        <td className="whitespace-nowrap px-3 py-2">
          <div className="flex flex-col items-start gap-1">
            {u.isActive ? <span className={`${badge} bg-good/15 text-good`}>ใช้งานได้</span> : <span className={`${badge} bg-bad/15 text-bad`}>ปิดใช้งาน</span>}
            {u.mustChangePassword && <span className={`${badge} bg-warn/15 text-warn`}>รอตั้งรหัสใหม่</span>}
          </div>
        </td>
        <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">
          {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }) : "ยังไม่เคย"}
        </td>
        <td className="px-3 py-2">
          {isMe ? (
            <span className="whitespace-nowrap text-xs text-muted">แก้ไขตัวเองที่หน้า &ldquo;รหัสผ่าน&rdquo;</span>
          ) : !manageable ? (
            <span className="whitespace-nowrap text-xs text-muted">แอดมินใหญ่เท่านั้นที่จัดการบัญชีนี้ได้</span>
          ) : (
            <div className="flex flex-nowrap items-center gap-1.5">
              {roles.length > 1 && (
                <form action={adminSetRoleAction}>
                  <input type="hidden" name="id" value={u.id} />
                  <select
                    name="role"
                    defaultValue={u.role}
                    onChange={(e) => e.currentTarget.form?.requestSubmit()}
                    className={rowSelect}
                    title="เปลี่ยนระดับสิทธิ์"
                  >
                    {roles.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_TH[r]}
                      </option>
                    ))}
                  </select>
                </form>
              )}
              {meRole === "owner" && u.role !== "owner" && u.isActive && (
                <form
                  action={adminTransferOwnerAction}
                  onSubmit={(e) => {
                    if (!confirm(`โอนสิทธิ์แอดมินใหญ่ให้ @${u.username}? คุณจะกลายเป็นแอดมินเล็ก`)) e.preventDefault();
                  }}
                >
                  <input type="hidden" name="id" value={u.id} />
                  <button type="submit" className={rowBtn} title="ยกตำแหน่งแอดมินใหญ่ให้บัญชีนี้ แล้วคุณเป็นแอดมินเล็ก">
                    โอนสิทธิ์แอดมินใหญ่
                  </button>
                </form>
              )}
              <button type="button" onClick={() => setShowReset((s) => !s)} className={rowBtn}>
                รีเซ็ตรหัส
              </button>
              <span className="mx-1 h-5 w-px bg-border" aria-hidden />
              <form action={adminSetActiveAction}>
                <input type="hidden" name="id" value={u.id} />
                <input type="hidden" name="active" value={u.isActive ? "0" : "1"} />
                <button type="submit" className={u.isActive ? rowDanger : rowBtn}>
                  {u.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                </button>
              </form>
              <form
                action={adminDeleteUserAction}
                onSubmit={(e) => {
                  if (!confirm(`ลบบัญชี ${u.username} ถาวร?`)) e.preventDefault();
                }}
              >
                <input type="hidden" name="id" value={u.id} />
                <button type="submit" className={rowDanger}>
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
