"use client";

import { useActionState } from "react";
import { changePasswordAction, type ActionState } from "@/lib/auth/actions";
import { Icon } from "../ui/Icon";
import { Notice } from "../ui/Notice";
import { inputCls, labelCls, labelHintCls, saveBtn, submitBtn } from "./ui";

/**
 * The current password, then the new one twice (a group of its own under a hairline).
 *
 * `wide`: on the sign-in style card (AuthCard, the forced change of the admin's temporary password)
 * the button is the card's one big full-width action; in a settings card on /account it is a normal
 * save button.
 */
export function ChangePasswordForm({ wide = false }: { wide?: boolean }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(changePasswordAction, {});
  return (
    <form action={formAction} className="space-y-4">
      <label className={labelCls}>
        รหัสผ่านปัจจุบัน
        <input name="current" type="password" autoComplete="current-password" required className={inputCls} />
      </label>
      <div className="space-y-4 border-t border-border pt-4">
        <label className={labelCls}>
          <span>
            รหัสผ่านใหม่ <span className={labelHintCls}>(อย่างน้อย 8 ตัว)</span>
          </span>
          <input name="password" type="password" autoComplete="new-password" required minLength={8} className={inputCls} />
        </label>
        <label className={labelCls}>
          ยืนยันรหัสผ่านใหม่
          <input name="confirm" type="password" autoComplete="new-password" required minLength={8} className={inputCls} />
        </label>
      </div>
      {state.error && <Notice tone="bad">{state.error}</Notice>}
      {/* the way on after the change (e.g. out of the forced change): a client route, like the old inline link */}
      {state.ok && (
        <Notice tone="good" action={{ label: "ไปหน้าแรก", href: "/", route: true }}>
          {state.message}
        </Notice>
      )}
      <button type="submit" disabled={pending} className={wide ? submitBtn : saveBtn}>
        {pending && <Icon name="loader" className="h-4 w-4 animate-spin" />}
        {pending ? "กำลังบันทึก…" : "เปลี่ยนรหัสผ่าน"}
      </button>
    </form>
  );
}
