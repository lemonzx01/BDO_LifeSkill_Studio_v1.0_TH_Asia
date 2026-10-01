"use client";

import Link from "next/link";
import { useActionState } from "react";
import { changePasswordAction, type ActionState } from "@/lib/auth/actions";
import { Notice } from "../ui/Notice";
import { inputCls, labelCls, primaryBtn } from "./ui";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(changePasswordAction, {});
  return (
    <form action={formAction} className="space-y-3">
      <label className={labelCls}>
        รหัสผ่านปัจจุบัน
        <input name="current" type="password" autoComplete="current-password" required className={inputCls} />
      </label>
      <label className={labelCls}>
        รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)
        <input name="password" type="password" autoComplete="new-password" required minLength={8} className={inputCls} />
      </label>
      <label className={labelCls}>
        ยืนยันรหัสผ่านใหม่
        <input name="confirm" type="password" autoComplete="new-password" required minLength={8} className={inputCls} />
      </label>
      {state.error && <Notice tone="bad">{state.error}</Notice>}
      {state.ok && (
        <Notice tone="good">
          {state.message} ·{" "}
          <Link href="/" className="underline">
            ไปหน้าแรก
          </Link>
        </Notice>
      )}
      <button type="submit" disabled={pending} className={primaryBtn}>
        {pending ? "กำลังบันทึก…" : "เปลี่ยนรหัสผ่าน"}
      </button>
    </form>
  );
}
