"use client";

import Link from "next/link";
import { useActionState, useId, useRef, useState, type ChangeEvent, type MouseEvent, type ReactNode } from "react";
import {
  adminCreateUserAction,
  adminDeleteUserAction,
  adminResetPasswordAction,
  adminSetActiveAction,
  adminSetRoleAction,
  adminTransferOwnerAction,
  type ActionState,
} from "@/lib/auth/actions";
import { assignableRoles, canManage, parseRole, ROLE_TH } from "@/lib/auth/roles";
import type { Role } from "@/lib/db/schema";
import { generateTempPassword, tempLoginText } from "@/lib/temp-password";
import { Avatar } from "../ui/Avatar";
import { Badge, RoleBadge } from "../ui/Badge";
import { btn, btnShape, toggleCls } from "../ui/button";
import { Card, CardHeader, cardCls } from "../ui/Card";
import { useConfirm, type ConfirmOptions } from "../ui/ConfirmDialog";
import { fieldCls, labelCls, selectCls } from "../ui/field";
import { Icon } from "../ui/Icon";
import { Notice } from "../ui/Notice";
import { headCls, headStickyCls, stackedListLgCls, tableCls, tdCls, tdEndCls, thCls, thEndCls } from "../ui/table";
import { toast } from "../ui/Toast";

// row controls: one height, never wrapping, quieter than the page-level buttons. Disable and
// delete stay grey until hovered (the ConfirmDialog asks first), so a long list is not a wall of red
const rowBtn = btn("secondary", "sm");
const rowDanger = btn("dangerGhost", "sm");
const rowSelect = selectCls("sm");

type Confirm = (opts: ConfirmOptions) => Promise<boolean>;

/** What one level may do, for the role-change question. */
const ROLE_EFFECT: Record<Role, string> = {
  owner: "จัดการได้ทุกบัญชี รวมถึงบัญชีของคุณ",
  admin: "สร้าง ปิด ลบ และรีเซ็ตรหัสของสมาชิกได้",
  member: "ใช้เครื่องมือได้ แต่เข้าหน้าจัดการสมาชิกไม่ได้",
};

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

/**
 * A temporary password the admin just set, with who it is for and where to sign in. It lives only
 * in this page's memory: the server never sends a password back, so the form keeps what was typed
 * when it was sent. `seq` tells one hand-out from the next.
 */
interface TempLogin {
  seq: number;
  username: string;
  password: string;
  origin: string;
}

/** The create and reset forms' state: the server's answer plus, on success, the hand-out. */
type ShareState = ActionState & { share?: TempLogin; role?: Role };

let shareSeq = 0;

/**
 * The members page below its header: the create form (the page's one gold button), then every
 * account in one card (a table from lg, stacked rows below it) with what each level may do.
 */
export function AdminUsers({ users, meId, meRole }: { users: AdminUserRow[]; meId: number; meRole: Role }) {
  // one dialog for every row (rows render twice: table and stacked rows)
  const [confirm, confirmDialog] = useConfirm();
  const listTitleId = useId();
  const inactive = users.filter((u) => !u.isActive).length;
  const waiting = users.filter((u) => u.mustChangePassword).length;
  const counts = [
    `${users.length} บัญชี`,
    `ใช้งานได้ ${users.length - inactive}`,
    inactive > 0 && `ปิดใช้งาน ${inactive}`,
    waiting > 0 && `รอตั้งรหัสใหม่ ${waiting}`,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="space-y-4 md:space-y-6">
      {confirmDialog}
      <CreateUserForm meRole={meRole} />
      <Card aria-labelledby={listTitleId}>
        <CardHeader id={listTitleId} icon="users" title="สมาชิกทั้งหมด" hint={<span className="num">{counts}</span>} />
        {/* lg and up: a table. Not from md: this page is narrow (max-w-5xl), and between md and lg the
            row of buttons would not fit, taking ปิดใช้งาน / ลบ off screen. One <tbody> per member,
            so a row's answer and its reset form stay grouped under it */}
        <table className={`${tableCls} hidden lg:table`}>
          <thead className={`${headCls} ${headStickyCls}`}>
            <tr>
              <th className={thCls}>ผู้ใช้</th>
              <th className={`${thCls} w-px`}>ล็อกอินล่าสุด</th>
              <th className={`${thEndCls} w-px`}>จัดการ</th>
            </tr>
          </thead>
          {users.map((u) => (
            <UserRow key={u.id} u={u} isMe={u.id === meId} meRole={meRole} confirm={confirm} />
          ))}
        </table>
        {/* phones and tablets: one stacked row per member, so every action is on screen without scrolling sideways */}
        <ul className={stackedListLgCls}>
          {users.map((u) => (
            <UserCard key={u.id} u={u} isMe={u.id === meId} meRole={meRole} confirm={confirm} />
          ))}
        </ul>
        <RoleKey />
      </Card>
    </div>
  );
}

/** Under the list: what each admin level may do, with the same pills as the rows. */
function RoleKey() {
  return (
    <ul className="space-y-1.5 border-t border-border px-4 py-3 text-xs text-muted">
      {/* inline, not flex: a long line wraps on under the pill instead of dropping below it whole */}
      <li>
        <RoleBadge role="owner" className="mr-2 align-middle" />
        จัดการได้ทุกบัญชี ตั้งระดับให้ใครก็ได้ และโอนตำแหน่งให้คนอื่นได้
      </li>
      <li>
        <RoleBadge role="admin" className="mr-2 align-middle" />
        สร้าง/ปิด/ลบ/รีเซ็ตรหัสได้เฉพาะสมาชิก
      </li>
      <li className="flex items-start gap-2">
        <Icon name="info" className="mt-px h-4 w-4 text-faint" />
        ต้องมีแอดมินใหญ่ที่เปิดใช้งานอย่างน้อย 1 คนเสมอ
      </li>
    </ul>
  );
}

/**
 * The temporary-password box: editable, with สุ่มรหัส to fill in a random one (12 characters, none
 * that look alike, from the browser's crypto.getRandomValues).
 */
function TempPasswordInput({ label, className = "" }: { label: string; className?: string }) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const fill = () => {
    const el = ref.current;
    if (!el) return;
    el.value = generateTempPassword((buf) => crypto.getRandomValues(buf));
  };
  return (
    <div className={`${labelCls} ${className}`}>
      <label htmlFor={id}>{label}</label>
      <div className="flex gap-2">
        <input
          ref={ref}
          id={id}
          name="password"
          type="text"
          required
          minLength={8}
          maxLength={128}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={`${fieldCls()} min-w-0 flex-1`}
        />
        <button type="button" onClick={fill} className={`${btn("secondary")} shrink-0`} title="สุ่มรหัส 12 ตัว ไม่มีตัวที่หน้าตาคล้ายกัน">
          <Icon name="refresh" className="h-4 w-4" />
          สุ่มรหัส
        </button>
      </div>
    </div>
  );
}

/**
 * What to send the member: name, temporary password (hidden until แสดงรหัส) and the sign-in page,
 * with คัดลอก for the whole line. Shown once: it is gone when closed or when the page reloads.
 */
function TempLoginShare({ login }: { login: TempLogin }) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tempLoginText(login.username, login.password, login.origin));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // no clipboard (e.g. not https): show the line so it can be selected and copied by hand
      setShown(true);
      toast({ text: "คัดลอกไม่ได้ เลือกข้อความแล้วคัดลอกเอง", tone: "bad" });
    }
  };
  return (
    <div className="rounded-lg border border-border bg-panel-2/60 p-3 text-sm">
      <p className="rounded-md bg-background/60 px-3 py-2 break-words text-foreground select-all">
        {tempLoginText(login.username, shown ? login.password : "••••", login.origin)}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={copy} className={btn("secondary", "sm")}>
          {copied ? (
            <>
              <Icon name="check" className="h-4 w-4 text-good" />
              คัดลอกแล้ว
            </>
          ) : (
            <>
              <Icon name="copy" className="h-4 w-4" />
              คัดลอก
            </>
          )}
        </button>
        {/* the label says what pressing does, so no aria-pressed (that would read "ซ่อนรหัส, pressed") */}
        <button type="button" onClick={() => setShown((s) => !s)} className={btn("ghost", "sm")}>
          <Icon name={shown ? "eye-off" : "eye"} className="h-4 w-4" />
          {shown ? "ซ่อนรหัส" : "แสดงรหัส"}
        </button>
        <span className="text-xs text-muted">แสดงครั้งเดียว ปิดแล้วดูอีกไม่ได้</span>
      </div>
      <span className="sr-only" aria-live="polite">
        {copied ? "คัดลอกแล้ว" : ""}
      </span>
    </div>
  );
}

/** The answer of a create or reset form, with the hand-out box after a success and an x to close both. */
function ShareResult({ state, className = "" }: { state: ShareState; className?: string }) {
  const [closed, setClosed] = useState<ShareState | null>(null);
  if (state === closed || !(state.error || state.ok)) return null;
  const close = () => setClosed(state);
  return state.error ? (
    <Notice tone="bad" onClose={close} className={className}>
      {state.error}
    </Notice>
  ) : (
    <div className={`space-y-2 ${className}`}>
      <Notice tone="good" onClose={close}>
        {state.message}
      </Notice>
      {state.share && <TempLoginShare key={state.share.seq} login={state.share} />}
    </div>
  );
}

/**
 * Wraps the create or reset action: keeps the typed password on this page (the server never sends
 * it back) and, on success, hands it to the result box with the name the server settled on.
 */
function withShare(run: (prev: ActionState, fd: FormData) => Promise<ActionState>) {
  return async (_prev: ShareState, fd: FormData): Promise<ShareState> => {
    const password = String(fd.get("password") ?? "");
    const role = parseRole(String(fd.get("role") ?? ""));
    // the previous answer (and its password) stays here: the server gets an empty one
    const r = await run({}, fd);
    if (!r.ok || !r.username) return { ...r, role };
    return { ...r, share: { seq: ++shareSeq, username: r.username, password, origin: window.location.origin } };
  };
}

const createAndShare = withShare(adminCreateUserAction);
const resetAndShare = withShare(adminResetPasswordAction);

function CreateUserForm({ meRole }: { meRole: Role }) {
  const [state, formAction, pending] = useActionState<ShareState, FormData>(createAndShare, {});
  const roles = assignableRoles(meRole);
  // React empties the form after each send; after an error the names come back as defaults
  const keep = !state.ok;
  const role = keep ? (state.role ?? "member") : "member";
  return (
    <form action={formAction} className={cardCls()}>
      <CardHeader icon="user" title="สร้างบัญชีให้สมาชิก" hint="ส่งชื่อผู้ใช้กับรหัสชั่วคราวให้สมาชิก ล็อกอินครั้งแรกระบบจะให้ตั้งรหัสใหม่" />
      <div className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className={labelCls}>
            ชื่อผู้ใช้
            <input
              name="username"
              required
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              defaultValue={keep ? (state.username ?? "") : ""}
              className={fieldCls()}
              placeholder="เช่น somchai"
            />
          </label>
          <label className={labelCls}>
            ชื่อที่แสดง
            <input name="displayName" maxLength={40} defaultValue={keep ? (state.displayName ?? "") : ""} className={fieldCls()} placeholder="ชื่อในเกม" />
          </label>
          <TempPasswordInput label="รหัสผ่านชั่วคราว (≥ 8 ตัว)" />
          <label className={labelCls}>
            สิทธิ์
            {/* keyed by the default: a <select> only takes a new defaultValue when it is mounted again */}
            <select key={role} name="role" className={`${selectCls()} w-full`} defaultValue={role} disabled={roles.length <= 1}>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_TH[r]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button type="submit" disabled={pending} className={`${btn("primary")} mt-4`}>
          <Icon name={pending ? "loader" : "plus"} className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
          {pending ? "กำลังสร้าง…" : "สร้างบัญชี"}
        </button>
        {/* under the button that made it: the answer, and after a success what to send the member */}
        <ShareResult state={state} className="mt-4" />
      </div>
    </form>
  );
}

function lastLogin(u: AdminUserRow): string {
  return u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }) : "ยังไม่เคย";
}

/**
 * The avatar disc, name, @username and the status pills: the same in the table and in a stacked
 * row. A disabled account's disc is dimmed (its ปิดใช้งาน pill says so in words).
 */
function UserIdentity({ u, isMe }: { u: AdminUserRow; isMe: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={u.displayName} dim={!u.isActive} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium break-words text-foreground">{u.displayName}</span>
          <span className="text-xs break-words text-muted">@{u.username}</span>
          {isMe && <span className="text-xs text-muted">(คุณ)</span>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <RoleBadge role={u.role} />
          {u.isActive ? <Badge tone="good">ใช้งานได้</Badge> : <Badge tone="bad">ปิดใช้งาน</Badge>}
          {u.mustChangePassword && <Badge tone="warn">รอตั้งรหัสใหม่</Badge>}
        </div>
      </div>
    </div>
  );
}

/** Shown in place of the buttons on an account this admin may not manage. */
function NotManageable({ isMe }: { isMe: boolean }) {
  return isMe ? (
    <span className="text-xs text-muted">
      แก้ไขตัวเองที่หน้า{" "}
      <Link href="/account" className="underline underline-offset-2 hover:text-foreground">
        บัญชีของฉัน
      </Link>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <Icon name="lock" className="h-4 w-4 text-faint" />
      แอดมินใหญ่เท่านั้นที่จัดการบัญชีนี้ได้
    </span>
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

/** Sends one row form to its server action; each form names its action in a hidden `op`. */
function sendRowForm(op: string, fd: FormData): Promise<ActionState> {
  // the previous answer is not passed on: the server gets an empty one
  switch (op) {
    case "active":
      return adminSetActiveAction({}, fd);
    case "role":
      return adminSetRoleAction({}, fd);
    case "delete":
      return adminDeleteUserAction({}, fd);
    case "transfer":
      return adminTransferOwnerAction({}, fd);
    default:
      return Promise.resolve({ error: "ไม่รู้จักคำสั่งนี้" });
  }
}

async function runRowAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const op = String(fd.get("op") ?? "");
  const r = await sendRowForm(op, fd);
  // a deleted account's row goes away with it, so that result shows as a toast instead
  if (op === "delete" && r.ok && r.message) toast({ text: r.message, tone: "good" });
  return r;
}

interface RowAction {
  action: (fd: FormData) => void;
  pending: boolean;
}

/**
 * One member's row actions and their latest answer, shown in that row ("ปิดใช้งาน @somchai แล้ว",
 * or the error), with an x to close it.
 */
function useRowAction(): [RowAction, ReactNode] {
  const [state, action, pending] = useActionState<ActionState, FormData>(runRowAction, {});
  const [closed, setClosed] = useState<ActionState | null>(null);
  const text = state.error ?? (state.ok ? state.message : undefined);
  const notice =
    text && state !== closed ? (
      <Notice tone={state.error ? "bad" : "good"} onClose={() => setClosed(state)}>
        {text}
      </Notice>
    ) : null;
  return [{ action, pending }, notice];
}

/** Role, owner transfer and password reset: everyday actions. */
function MainActions({
  u,
  meRole,
  resetOpen,
  onToggleReset,
  confirm,
  row,
}: {
  u: AdminUserRow;
  meRole: Role;
  resetOpen: boolean;
  onToggleReset: () => void;
  confirm: Confirm;
  row: RowAction;
}) {
  const roles = assignableRoles(meRole);
  const askTransfer = confirmThenSubmit(confirm, {
    title: "โอนสิทธิ์แอดมินใหญ่?",
    body: `@${u.username} จะเป็นแอดมินใหญ่ และคุณจะกลายเป็นแอดมินเล็ก`,
    confirmLabel: `โอนให้ @${u.username}`,
    tone: "danger",
  });
  // a new level is asked about first; "no" puts the old one back in the box
  const askRole = async (e: ChangeEvent<HTMLSelectElement>) => {
    const select = e.currentTarget;
    const next = parseRole(select.value);
    const ok = await confirm({
      title: `เปลี่ยนระดับของ @${u.username}?`,
      body: `จาก${ROLE_TH[u.role]} เป็น${ROLE_TH[next]}: ${ROLE_EFFECT[next]}`,
      confirmLabel: `ตั้งเป็น${ROLE_TH[next]}`,
      tone: next === "owner" ? "danger" : "default",
    });
    if (ok) select.form?.requestSubmit();
    else select.value = u.role;
  };
  return (
    <>
      {roles.length > 1 && (
        <form action={row.action}>
          <input type="hidden" name="op" value="role" />
          <input type="hidden" name="id" value={u.id} />
          {/* keyed by the role: a <select> only takes a new defaultValue when it is mounted again,
              and React's reset after the send goes back to that default */}
          <select
            key={u.role}
            name="role"
            defaultValue={u.role}
            onChange={askRole}
            disabled={row.pending}
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
        <form action={row.action}>
          <input type="hidden" name="op" value="transfer" />
          <input type="hidden" name="id" value={u.id} />
          <button
            type="button"
            onClick={askTransfer}
            disabled={row.pending}
            aria-haspopup="dialog"
            className={rowBtn}
            title="ยกตำแหน่งแอดมินใหญ่ให้บัญชีนี้ แล้วคุณเป็นแอดมินเล็ก"
          >
            <Icon name="crown" className="h-4 w-4" />
            โอนสิทธิ์แอดมินใหญ่
          </button>
        </form>
      )}
      {/* gold while its password form is open */}
      <button type="button" onClick={onToggleReset} aria-expanded={resetOpen} className={`${btnShape("sm")} ${toggleCls(resetOpen)}`}>
        <Icon name="key" className="h-4 w-4" />
        รีเซ็ตรหัส
      </button>
    </>
  );
}

/** Disable / enable and delete, kept apart from the everyday actions. */
function DangerActions({ u, confirm, row }: { u: AdminUserRow; confirm: Confirm; row: RowAction }) {
  const askDisable = confirmThenSubmit(confirm, {
    title: `ปิดใช้งาน @${u.username}?`,
    body: "หลุดจากระบบทุกเครื่องทันที และล็อกอินไม่ได้จนกว่าจะเปิดใช้งานอีกครั้ง ข้อมูลยังอยู่ครบ",
    confirmLabel: `ปิดใช้งาน @${u.username}`,
    tone: "danger",
  });
  const askDelete = confirmThenSubmit(confirm, {
    title: `ลบบัญชี @${u.username}?`,
    body: "ลบถาวร กู้คืนไม่ได้ ถ้าแค่ไม่ให้เข้าระบบชั่วคราว ให้ใช้ปิดใช้งานแทน",
    confirmLabel: `ลบ @${u.username}`,
    tone: "danger",
  });
  return (
    <>
      <form action={row.action}>
        <input type="hidden" name="op" value="active" />
        <input type="hidden" name="id" value={u.id} />
        <input type="hidden" name="active" value={u.isActive ? "0" : "1"} />
        {u.isActive ? (
          <button type="button" onClick={askDisable} disabled={row.pending} aria-haspopup="dialog" className={rowDanger}>
            <Icon name="ban" className="h-4 w-4" />
            ปิดใช้งาน
          </button>
        ) : (
          <button type="submit" disabled={row.pending} className={rowBtn}>
            <Icon name="check-circle" className="h-4 w-4" />
            เปิดใช้งาน
          </button>
        )}
      </form>
      <form action={row.action}>
        <input type="hidden" name="op" value="delete" />
        <input type="hidden" name="id" value={u.id} />
        <button type="button" onClick={askDelete} disabled={row.pending} aria-haspopup="dialog" className={rowDanger}>
          <Icon name="trash" className="h-4 w-4" />
          ลบ
        </button>
      </form>
    </>
  );
}

/** The lg layout of one member: a <tbody> of its row, then its latest answer and its reset form. */
function UserRow({ u, isMe, meRole, confirm }: { u: AdminUserRow; isMe: boolean; meRole: Role; confirm: Confirm }) {
  const [showReset, setShowReset] = useState(false);
  const [row, notice] = useRowAction();
  const manageable = !isMe && canManage(meRole, u.role);
  return (
    <tbody className="border-b border-border/70 last:border-b-0">
      <tr className="transition-colors duration-150 hover:bg-panel-2/60">
        <td className={tdCls}>
          <UserIdentity u={u} isMe={isMe} />
        </td>
        <td className={`${tdCls} num text-xs whitespace-nowrap text-muted`}>{lastLogin(u)}</td>
        <td className={`${tdEndCls} whitespace-nowrap`}>
          {!manageable ? (
            <NotManageable isMe={isMe} />
          ) : (
            <div className="flex flex-nowrap items-center justify-end gap-1.5">
              <MainActions u={u} meRole={meRole} resetOpen={showReset} onToggleReset={() => setShowReset((s) => !s)} confirm={confirm} row={row} />
              <span className="mx-1 h-5 w-px bg-border" aria-hidden />
              <DangerActions u={u} confirm={confirm} row={row} />
            </div>
          )}
        </td>
      </tr>
      {/* the latest action's answer stays even when the row is no longer this admin's to manage
          (e.g. right after handing over แอดมินใหญ่) */}
      {notice && (
        <tr>
          <td colSpan={3} className="px-4 pb-3">
            {notice}
          </td>
        </tr>
      )}
      {showReset && manageable && (
        <tr>
          <td colSpan={3} className="px-4 pb-3">
            <div className="rounded-lg border border-border bg-panel-2/60 p-3">
              <ResetPasswordForm id={u.id} username={u.username} onDone={() => setShowReset(false)} />
            </div>
          </td>
        </tr>
      )}
    </tbody>
  );
}

/**
 * The phone and tablet layout of one member: who and last login, everyday actions, then disable
 * and delete below a hairline.
 */
function UserCard({ u, isMe, meRole, confirm }: { u: AdminUserRow; isMe: boolean; meRole: Role; confirm: Confirm }) {
  const [showReset, setShowReset] = useState(false);
  const [row, notice] = useRowAction();
  const manageable = !isMe && canManage(meRole, u.role);
  return (
    <li className="px-4 py-3 text-sm">
      <UserIdentity u={u} isMe={isMe} />
      {/* pl-12 lines the grey line up with the name after the 36px disc */}
      <p className="num mt-1.5 pl-12 text-xs text-muted">ล็อกอินล่าสุด {lastLogin(u)}</p>
      {notice && <div className="mt-3">{notice}</div>}
      {!manageable ? (
        <p className="mt-2 pl-12">
          <NotManageable isMe={isMe} />
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            <MainActions u={u} meRole={meRole} resetOpen={showReset} onToggleReset={() => setShowReset((s) => !s)} confirm={confirm} row={row} />
          </div>
          {showReset && (
            <div className="mt-3 rounded-lg border border-border bg-panel-2/60 p-3">
              <ResetPasswordForm id={u.id} username={u.username} onDone={() => setShowReset(false)} />
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2 border-t border-border/70 pt-3">
            <DangerActions u={u} confirm={confirm} row={row} />
          </div>
        </>
      )}
    </li>
  );
}

function ResetPasswordForm({ id, username, onDone }: { id: number; username: string; onDone: () => void }) {
  const [state, formAction, pending] = useActionState<ShareState, FormData>(resetAndShare, {});
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap items-end gap-2">
        <TempPasswordInput label={`รหัสผ่านชั่วคราวใหม่ของ @${username}`} className="w-full sm:w-96" />
        {/* secondary, not gold: สร้างบัญชี above stays the page's one gold button */}
        <button type="submit" disabled={pending} className={btn("secondary")}>
          {pending && <Icon name="loader" className="h-4 w-4 animate-spin" />}
          {pending ? "กำลังบันทึก…" : "บันทึก"}
        </button>
        <button type="button" onClick={onDone} className={btn("ghost")}>
          ปิด
        </button>
      </div>
      <ShareResult state={state} />
    </form>
  );
}
