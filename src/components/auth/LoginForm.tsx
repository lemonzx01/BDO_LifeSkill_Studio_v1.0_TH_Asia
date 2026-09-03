"use client";

import { useActionState } from "react";
import { loginAction, type ActionState } from "@/lib/auth/actions";
import { errorCls, inputCls, labelCls, primaryBtn } from "./ui";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(loginAction, {});
  return (
    <form action={formAction} className="space-y-3">
      <label className={labelCls}>
        ชื่อผู้ใช้
        <input name="username" autoComplete="username" required autoFocus className={inputCls} />
      </label>
      <label className={labelCls}>
        รหัสผ่าน
        <input name="password" type="password" autoComplete="current-password" required className={inputCls} />
      </label>
      {state.error && <div className={errorCls}>{state.error}</div>}
      <button type="submit" disabled={pending} className={`${primaryBtn} w-full`}>
        {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
      </button>
      <p className="text-xs text-muted">ยังไม่มีบัญชี? ขอให้แอดมินของกิลสร้างให้</p>
    </form>
  );
}
