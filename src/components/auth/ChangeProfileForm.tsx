"use client";

import { useActionState } from "react";
import { changeProfileAction, type ActionState } from "@/lib/auth/actions";
import { Icon } from "../ui/Icon";
import { Notice } from "../ui/Notice";
import { inputCls, labelCls, labelHintCls, saveBtn } from "./ui";

/**
 * Change the login name (ไอดี) and the display name; the current password confirms it, so it sits
 * apart under a hairline, next to the save button.
 */
export function ChangeProfileForm({ username, displayName }: { username: string; displayName: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(changeProfileAction, {});
  return (
    <form action={formAction} className="space-y-4">
      <label className={labelCls}>
        <span>
          ชื่อผู้ใช้สำหรับล็อกอิน <span className={labelHintCls}>(a-z, 0-9, _ . -)</span>
        </span>
        <input name="username" defaultValue={username} required minLength={3} maxLength={32} autoComplete="username" className={inputCls} />
      </label>
      <label className={labelCls}>
        ชื่อที่แสดง
        <input name="displayName" defaultValue={displayName} maxLength={40} className={inputCls} placeholder="ชื่อในเกม" />
      </label>
      <div className="space-y-4 border-t border-border pt-4">
        <label className={labelCls}>
          <span>
            รหัสผ่านปัจจุบัน <span className={labelHintCls}>(เพื่อยืนยัน)</span>
          </span>
          <input name="current" type="password" autoComplete="current-password" required className={inputCls} />
        </label>
        {state.error && <Notice tone="bad">{state.error}</Notice>}
        {state.ok && <Notice tone="good">{state.message}</Notice>}
        <button type="submit" disabled={pending} className={saveBtn}>
          {pending && <Icon name="loader" className="h-4 w-4 animate-spin" />}
          {pending ? "กำลังบันทึก…" : "บันทึกชื่อ"}
        </button>
      </div>
    </form>
  );
}
