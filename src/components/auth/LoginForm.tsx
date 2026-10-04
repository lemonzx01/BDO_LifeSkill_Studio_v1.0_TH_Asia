"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { loginAction, type ActionState } from "@/lib/auth/actions";
import { btn } from "../ui/button";
import { checkboxCls } from "../ui/field";
import { Icon } from "../ui/Icon";
import { Notice } from "../ui/Notice";
import { inputCls, labelCls, submitBtn } from "./ui";

/**
 * After a failed sign-in the username and the remember box stay (the action hands them back;
 * React's form reset restores the defaultValue / defaultChecked) and the password is cleared; focus
 * goes to the password, ready to retype.
 *
 * `next`: the page to go back to after signing in (already checked by the login page, and checked
 * again by the action); also where "ใช้ต่อโดยไม่ล็อกอิน" goes. That way out sits under a hairline,
 * a quiet full-width button: the site works without an account, so it must be easy to find.
 */
export function LoginForm({ next = "/" }: { next?: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(loginAction, {});
  const userRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!state.error) return;
    (state.username ? passwordRef : userRef).current?.focus();
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
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
      {/* min-h-10: the whole line is the tap target, not just the 18px box */}
      <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm text-foreground">
        <input type="checkbox" name="remember" value="1" defaultChecked={state.remember ?? false} className={checkboxCls} />
        จดจำฉันไว้ในเครื่องนี้ (30 วัน)
      </label>
      {state.error && <Notice tone="bad">{state.error}</Notice>}
      <button type="submit" disabled={pending} className={submitBtn}>
        {pending ? <Icon name="loader" className="h-4 w-4 animate-spin" /> : <Icon name="log-in" className="h-4 w-4" />}
        {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
      </button>
      <p className="text-center text-xs text-muted">ยังไม่มีบัญชี? ขอให้แอดมินของกิลสร้างให้</p>
      <div className="border-t border-border pt-4">
        <Link href={next} className={`${btn("ghost", "lg")} w-full`}>
          ใช้ต่อโดยไม่ล็อกอิน
          <Icon name="arrow-right" className="h-4 w-4" />
        </Link>
      </div>
    </form>
  );
}
