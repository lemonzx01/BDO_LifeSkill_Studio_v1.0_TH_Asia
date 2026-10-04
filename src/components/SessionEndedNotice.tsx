"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { forgetEndedSessionAction } from "@/lib/auth/actions";
import { loginHref } from "@/lib/fetch-error";
import { useOptionalUserData } from "./UserDataProvider";
import { Notice } from "./ui/Notice";

/**
 * Shown at the top of a page (by <Page>) when the browser still sent a session cookie but nobody is
 * signed in: a member whose session ran out would otherwise just see the guest page (empty
 * inventory and stars) and think the data is gone.
 * - session over: sign in again (back to this page), or × to carry on without signing in, which
 *   drops the dead cookie so the message does not come back
 * - session could not be checked (database unreachable): try again; × only hides it here
 */
export function SessionEndedNotice() {
  const data = useOptionalUserData();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  const ended = data?.sessionEnded ?? null;
  if (!ended || hidden) return null;

  if (ended === "unchecked") {
    return (
      <Notice tone="warn" className="mb-4" action={{ label: "ลองใหม่", onClick: () => router.refresh() }} onClose={() => setHidden(true)}>
        ตรวจสอบการล็อกอินไม่สำเร็จ ตอนนี้ใช้แบบไม่ล็อกอินไปก่อน สิ่งที่แก้จะเก็บไว้ในเครื่องนี้
      </Notice>
    );
  }

  const query = searchParams.toString();
  return (
    <Notice
      tone="warn"
      className="mb-4"
      action={{ label: "ล็อกอินอีกครั้ง", href: loginHref(query ? `${pathname}?${query}` : pathname), route: true }}
      onClose={() => {
        setHidden(true);
        forgetEndedSessionAction().catch(() => {});
      }}
    >
      หมดเวลาเข้าสู่ระบบ ข้อมูลในบัญชียังอยู่ครบ · ตอนนี้ใช้แบบไม่ล็อกอิน สิ่งที่แก้จะเก็บไว้ในเครื่องนี้
    </Notice>
  );
}
