"use client";

import { useActionState } from "react";
import { setupAdminAction, type ActionState } from "@/lib/auth/actions";
import { Notice } from "../ui/Notice";
import { inputCls, labelCls, primaryBtn } from "./ui";

/** After an error the two names stay (handed back by the action); the passwords are typed again. */
export function SetupForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(setupAdminAction, {});
  return (
    <form action={formAction} className="space-y-3">
      <label className={labelCls}>
        ชื่อผู้ใช้ (a-z 0-9 _ . -)
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
        ชื่อที่แสดง (เช่น ชื่อในเกม)
        <input name="displayName" maxLength={40} defaultValue={state.displayName ?? ""} className={inputCls} />
      </label>
      <label className={labelCls}>
        รหัสผ่าน (อย่างน้อย 8 ตัว)
        <input name="password" type="password" autoComplete="new-password" required minLength={8} className={inputCls} />
      </label>
      <label className={labelCls}>
        ยืนยันรหัสผ่าน
        <input name="confirm" type="password" autoComplete="new-password" required minLength={8} className={inputCls} />
      </label>
      {state.error && <Notice tone="bad">{state.error}</Notice>}
      <button type="submit" disabled={pending} className={`${primaryBtn} w-full`}>
        {pending ? "กำลังสร้าง…" : "สร้างบัญชีแอดมิน"}
      </button>
    </form>
  );
}
