"use client";

import { useActionState } from "react";
import { loginAction, type ActionState } from "@/lib/auth/actions";
import { Notice } from "../ui/Notice";
import { inputCls, labelCls, primaryBtn } from "./ui";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(loginAction, {});
  return (
    <form action={formAction} className="space-y-3">
      <label className={labelCls}>
        ชื่อผู้ใช้
        <input name="username" autoComplete="username" required autoFocus maxLength={64} className={inputCls} />
      </label>
      <label className={labelCls}>
        รหัสผ่าน
        <input name="password" type="password" autoComplete="current-password" required className={inputCls} />
      </label>
      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" name="remember" value="1" className="h-4 w-4 accent-accent" />
        จดจำฉันไว้ในเครื่องนี้ (30 วัน)
      </label>
      {state.error && <Notice tone="bad">{state.error}</Notice>}
      <button type="submit" disabled={pending} className={`${primaryBtn} w-full`}>
        {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
      </button>
      <p className="text-xs text-muted">ยังไม่มีบัญชี? ขอให้แอดมินของกิลสร้างให้</p>
    </form>
  );
}
