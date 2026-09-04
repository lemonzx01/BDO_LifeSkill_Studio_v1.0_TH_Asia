"use client";

import { useActionState } from "react";
import { changeProfileAction, type ActionState } from "@/lib/auth/actions";
import { errorCls, inputCls, labelCls, okCls, primaryBtn } from "./ui";

/** Change the login name (ไอดี) and the display name; the current password confirms it. */
export function ChangeProfileForm({ username, displayName }: { username: string; displayName: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(changeProfileAction, {});
  return (
    <form action={formAction} className="space-y-3">
      <label className={labelCls}>
        ชื่อผู้ใช้สำหรับล็อกอิน (a-z, 0-9, _ . -)
        <input name="username" defaultValue={username} required minLength={3} maxLength={32} autoComplete="username" className={inputCls} />
      </label>
      <label className={labelCls}>
        ชื่อที่แสดง
        <input name="displayName" defaultValue={displayName} maxLength={40} className={inputCls} placeholder="ชื่อในเกม" />
      </label>
      <label className={labelCls}>
        รหัสผ่านปัจจุบัน (เพื่อยืนยัน)
        <input name="current" type="password" autoComplete="current-password" required className={inputCls} />
      </label>
      {state.error && <div className={errorCls}>{state.error}</div>}
      {state.ok && <div className={okCls}>{state.message}</div>}
      <button type="submit" disabled={pending} className={primaryBtn}>
        {pending ? "กำลังบันทึก…" : "บันทึกชื่อ"}
      </button>
    </form>
  );
}
