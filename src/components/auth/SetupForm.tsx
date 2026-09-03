"use client";

import { useActionState } from "react";
import { setupAdminAction, type ActionState } from "@/lib/auth/actions";
import { errorCls, inputCls, labelCls, primaryBtn } from "./ui";

export function SetupForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(setupAdminAction, {});
  return (
    <form action={formAction} className="space-y-3">
      <label className={labelCls}>
        ชื่อผู้ใช้ (a-z 0-9 _ . -)
        <input name="username" autoComplete="username" required autoFocus className={inputCls} />
      </label>
      <label className={labelCls}>
        ชื่อที่แสดง (เช่น ชื่อในเกม)
        <input name="displayName" className={inputCls} />
      </label>
      <label className={labelCls}>
        รหัสผ่าน (อย่างน้อย 8 ตัว)
        <input name="password" type="password" autoComplete="new-password" required minLength={8} className={inputCls} />
      </label>
      <label className={labelCls}>
        ยืนยันรหัสผ่าน
        <input name="confirm" type="password" autoComplete="new-password" required minLength={8} className={inputCls} />
      </label>
      {state.error && <div className={errorCls}>{state.error}</div>}
      <button type="submit" disabled={pending} className={`${primaryBtn} w-full`}>
        {pending ? "กำลังสร้าง…" : "สร้างบัญชีแอดมิน"}
      </button>
    </form>
  );
}
