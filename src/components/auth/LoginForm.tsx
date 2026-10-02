"use client";

import { useActionState, useEffect, useRef } from "react";
import { loginAction, type ActionState } from "@/lib/auth/actions";
import { Notice } from "../ui/Notice";
import { inputCls, labelCls, primaryBtn } from "./ui";

/**
 * After a failed sign-in the username and the remember box stay (the action hands them back;
 * React's form reset restores the defaultValue / defaultChecked) and the password is cleared; focus
 * goes to the password, ready to retype.
 */
export function LoginForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(loginAction, {});
  const userRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!state.error) return;
    (state.username ? passwordRef : userRef).current?.focus();
  }, [state]);

  return (
    <form action={formAction} className="space-y-3">
      <label className={labelCls}>
        ชื่อผู้ใช้
        <input
          ref={userRef}
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          autoFocus
          maxLength={64}
          defaultValue={state.username ?? ""}
          className={inputCls}
        />
      </label>
      <label className={labelCls}>
        รหัสผ่าน
        <input
          ref={passwordRef}
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputCls}
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" name="remember" value="1" defaultChecked={state.remember ?? false} className="h-4 w-4 accent-accent" />
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
