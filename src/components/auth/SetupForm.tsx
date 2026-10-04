"use client";

import { useActionState } from "react";
import { setupAdminAction, type ActionState } from "@/lib/auth/actions";
import { Icon } from "../ui/Icon";
import { Notice } from "../ui/Notice";
import { inputCls, labelCls, labelHintCls, submitBtn } from "./ui";

/**
 * After an error the two names stay (handed back by the action); the passwords are typed again.
 * The names and the passwords are two groups under a hairline, so the form reads as two short steps.
 */
export function SetupForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(setupAdminAction, {});
  return (
    <form action={formAction} className="space-y-4">
      <label className={labelCls}>
        <span>
          ชื่อผู้ใช้ <span className={labelHintCls}>(a-z 0-9 _ . -)</span>
        </span>
        <input
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          autoFocus
          defaultValue={state.username ?? ""}
          className={inputCls}
        />
      </label>
      <label className={labelCls}>
        <span>
          ชื่อที่แสดง <span className={labelHintCls}>(เช่น ชื่อในเกม)</span>
        </span>
        <input name="displayName" maxLength={40} defaultValue={state.displayName ?? ""} className={inputCls} />
      </label>
      <div className="space-y-4 border-t border-border pt-4">
        <label className={labelCls}>
          <span>
            รหัสผ่าน <span className={labelHintCls}>(อย่างน้อย 8 ตัว)</span>
          </span>
          <input name="password" type="password" autoComplete="new-password" required minLength={8} className={inputCls} />
        </label>
        <label className={labelCls}>
          ยืนยันรหัสผ่าน
          <input name="confirm" type="password" autoComplete="new-password" required minLength={8} className={inputCls} />
        </label>
      </div>
      {state.error && <Notice tone="bad">{state.error}</Notice>}
      <button type="submit" disabled={pending} className={submitBtn}>
        {pending ? <Icon name="loader" className="h-4 w-4 animate-spin" /> : <Icon name="shield" className="h-4 w-4" />}
        {pending ? "กำลังสร้าง…" : "สร้างบัญชีแอดมิน"}
      </button>
    </form>
  );
}
