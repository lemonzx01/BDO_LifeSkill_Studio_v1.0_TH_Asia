"use client";

import Link from "next/link";
import { useActionState, useState, type MouseEvent } from "react";
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
import { Badge, RoleBadge } from "../ui/Badge";
import { btn } from "../ui/button";
import { CardHeader, cardCls } from "../ui/Card";
import { useConfirm, type ConfirmOptions } from "../ui/ConfirmDialog";
import { selectCls } from "../ui/field";
import { Notice } from "../ui/Notice";
import { ghostBtn, inputCls, labelCls, primaryBtn } from "./ui";

// row controls: one height, never wrapping, quieter than the page-level buttons
const rowBtn = btn("secondary", "sm");
const rowDanger = btn("danger", "sm");
const rowSelect = selectCls("sm");

type Confirm = (opts: ConfirmOptions) => Promise<boolean>;

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
  // one dialog for every row (rows render twice: table and cards)
  const [confirm, confirmDialog] = useConfirm();
  return (
    <div className="space-y-6">
      {confirmDialog}
      <CreateUserForm meRole={meRole} />
      {/* lg and up: a table. Not from md: this page is narrow (max-w-5xl), and between md and lg the
          760px table would scroll sideways inside its box, taking ปิดใช้งาน / ลบ off screen */}
      <div className="hidden overflow-x-auto rounded-lg border border-border lg:block">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-panel-2 text-xs text-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium">ผู้ใช้</th>
              <th className="w-px whitespace-nowrap px-3 py-2 text-left font-medium">ล็อกอินล่าสุด</th>
              <th className="w-px whitespace-nowrap px-3 py-2 text-left font-medium">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <UserRow key={u.id} u={u} isMe={u.id === meId} meRole={meRole} confirm={confirm} />
            ))}
          </tbody>
        </table>
      </div>
      {/* phones and tablets: one card per member, so every action is on screen without scrolling sideways */}
      <ul className="space-y-3 lg:hidden">
        {users.map((u) => (
          <UserCard key={u.id} u={u} isMe={u.id === meId} meRole={meRole} confirm={confirm} />
        ))}
      </ul>
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
    <form action={formAction} className={cardCls()}>
      <CardHeader title="สร้างบัญชีให้สมาชิก" />
      <div className="p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <label className={labelCls}>
            ชื่อผู้ใช้
            <input name="username" required className={inputCls} placeholder="เช่น somchai" />
          </label>
          <label className={labelCls}>
            ชื่อที่แสดง
            <input name="displayName" maxLength={40} className={inputCls} placeholder="ชื่อในเกม" />
          </label>
          <label className={labelCls}>
            รหัสผ่านชั่วคราว (≥ 8 ตัว)
            <input name="password" type="text" required minLength={8} className={inputCls} autoComplete="off" />
          </label>
          <label className={labelCls}>
            สิทธิ์
            <select name="role" className={`${selectCls()} w-full`} defaultValue="member" disabled={roles.length <= 1}>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_TH[r]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {state.error && (
          <Notice tone="bad" className="mt-3">
            {state.error}
          </Notice>
        )}
        {state.ok && (
          <Notice tone="good" className="mt-3">
            {state.message}
          </Notice>
        )}
        <button type="submit" disabled={pending} className={`${primaryBtn} mt-3`}>
          {pending ? "กำลังสร้าง…" : "สร้างบัญชี"}
        </button>
      </div>
    </form>
  );
}

function lastLogin(u: AdminUserRow): string {
  return u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }) : "ยังไม่เคย";
}

/** Name, @username and the status pills: the same in the table and on a phone card. */
function UserIdentity({ u, isMe }: { u: AdminUserRow; isMe: boolean }) {
  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-medium">{u.displayName}</span>
        <span className="text-xs text-muted">@{u.username}</span>
        {isMe && <span className="text-xs text-muted">(คุณ)</span>}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        <RoleBadge role={u.role} />
        {u.isActive ? <Badge tone="good">ใช้งานได้</Badge> : <Badge tone="bad">ปิดใช้งาน</Badge>}
        {u.mustChangePassword && <Badge tone="warn">รอตั้งรหัสใหม่</Badge>}
      </div>
    </>
  );
}

/** Shown in place of the buttons on an account this admin may not manage. */
function NotManageable({ isMe }: { isMe: boolean }) {
  return isMe ? (
    <span className="text-xs text-muted">
      แก้ไขตัวเองที่หน้า{" "}
      <Link href="/account" className="underline hover:text-foreground">
        บัญชีของฉัน
      </Link>
    </span>
  ) : (
    <span className="text-xs text-muted">แอดมินใหญ่เท่านั้นที่จัดการบัญชีนี้ได้</span>
  );
}

/**
 * The click handler for a button that posts its form to a server action only after the member says
 * yes in the ConfirmDialog: the button is type="button", and its form is submitted by hand
 * (requestSubmit) once confirmed.
 */
function confirmThenSubmit(confirm: Confirm, opts: ConfirmOptions) {
  return async (e: MouseEvent<HTMLButtonElement>) => {
    const form = e.currentTarget.form;
    if (await confirm(opts)) form?.requestSubmit();
  };
}

/** Role, owner transfer and password reset: everyday actions. */
function MainActions({
  u,
  meRole,
  resetOpen,
  onToggleReset,
  confirm,
}: {
  u: AdminUserRow;
  meRole: Role;
  resetOpen: boolean;
  onToggleReset: () => void;
  confirm: Confirm;
}) {
  const roles = assignableRoles(meRole);
  const askTransfer = confirmThenSubmit(confirm, {
    title: "โอนสิทธิ์แอดมินใหญ่?",
    body: `@${u.username} จะเป็นแอดมินใหญ่ และคุณจะกลายเป็นแอดมินเล็ก`,
    confirmLabel: `โอนให้ @${u.username}`,
    tone: "danger",
  });
  return (
    <>
      {roles.length > 1 && (
        <form action={adminSetRoleAction}>
          <input type="hidden" name="id" value={u.id} />
          <select
            name="role"
            defaultValue={u.role}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className={rowSelect}
            title="เปลี่ยนระดับสิทธิ์"
            aria-label={`ระดับของ @${u.username}`}
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
        <form action={adminTransferOwnerAction}>
          <input type="hidden" name="id" value={u.id} />
          <button
            type="button"
            onClick={askTransfer}
            aria-haspopup="dialog"
            className={rowBtn}
            title="ยกตำแหน่งแอดมินใหญ่ให้บัญชีนี้ แล้วคุณเป็นแอดมินเล็ก"
          >
            โอนสิทธิ์แอดมินใหญ่
          </button>
        </form>
      )}
      <button type="button" onClick={onToggleReset} aria-expanded={resetOpen} className={rowBtn}>
        รีเซ็ตรหัส
      </button>
    </>
  );
}

/** Disable / enable and delete, kept apart from the everyday actions. */
function DangerActions({ u, confirm }: { u: AdminUserRow; confirm: Confirm }) {
  const askDelete = confirmThenSubmit(confirm, {
    title: `ลบบัญชี @${u.username}?`,
    body: "ลบถาวร กู้คืนไม่ได้ ถ้าแค่ไม่ให้เข้าระบบชั่วคราว ให้ใช้ปิดใช้งานแทน",
    confirmLabel: `ลบ @${u.username}`,
    tone: "danger",
  });
  return (
    <>
      <form action={adminSetActiveAction}>
        <input type="hidden" name="id" value={u.id} />
        <input type="hidden" name="active" value={u.isActive ? "0" : "1"} />
        <button type="submit" className={u.isActive ? rowDanger : rowBtn}>
          {u.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
        </button>
      </form>
      <form action={adminDeleteUserAction}>
        <input type="hidden" name="id" value={u.id} />
        <button type="button" onClick={askDelete} aria-haspopup="dialog" className={rowDanger}>
          ลบ
        </button>
      </form>
    </>
  );
}

function UserRow({ u, isMe, meRole, confirm }: { u: AdminUserRow; isMe: boolean; meRole: Role; confirm: Confirm }) {
  const [showReset, setShowReset] = useState(false);
  const manageable = !isMe && canManage(meRole, u.role);
  return (
    <>
      <tr className="border-t border-border">
        <td className="px-3 py-2.5">
          <UserIdentity u={u} isMe={isMe} />
        </td>
        <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">{lastLogin(u)}</td>
        <td className="whitespace-nowrap px-3 py-2">
          {!manageable ? (
            <NotManageable isMe={isMe} />
          ) : (
            <div className="flex flex-nowrap items-center gap-1.5">
              <MainActions u={u} meRole={meRole} resetOpen={showReset} onToggleReset={() => setShowReset((s) => !s)} confirm={confirm} />
              <span className="mx-1 h-5 w-px bg-border" aria-hidden />
              <DangerActions u={u} confirm={confirm} />
            </div>
          )}
        </td>
      </tr>
      {showReset && !isMe && (
        <tr className="border-t border-border/60 bg-background/40">
          <td colSpan={3} className="px-3 py-2">
            <ResetPasswordForm id={u.id} username={u.username} onDone={() => setShowReset(false)} />
          </td>
        </tr>
      )}
    </>
  );
}

/** The phone and tablet layout of one member: who, last login, everyday actions, then disable and delete below a line. */
function UserCard({ u, isMe, meRole, confirm }: { u: AdminUserRow; isMe: boolean; meRole: Role; confirm: Confirm }) {
  const [showReset, setShowReset] = useState(false);
  const manageable = !isMe && canManage(meRole, u.role);
  return (
    <li className={`${cardCls()} p-3 text-sm`}>
      <UserIdentity u={u} isMe={isMe} />
      <p className="mt-2 text-xs text-muted">ล็อกอินล่าสุด {lastLogin(u)}</p>
      {!manageable ? (
        <p className="mt-2">
          <NotManageable isMe={isMe} />
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            <MainActions u={u} meRole={meRole} resetOpen={showReset} onToggleReset={() => setShowReset((s) => !s)} confirm={confirm} />
          </div>
          {showReset && (
            <div className="mt-3 rounded border border-border/60 bg-background/40 p-2">
              <ResetPasswordForm id={u.id} username={u.username} onDone={() => setShowReset(false)} />
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
            <DangerActions u={u} confirm={confirm} />
          </div>
        </>
      )}
    </li>
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
      {state.error && <Notice tone="bad">{state.error}</Notice>}
      {state.ok && <Notice tone="good">{state.message}</Notice>}
    </form>
  );
}
