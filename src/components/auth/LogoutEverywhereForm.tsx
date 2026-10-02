"use client";

import { logoutEverywhereAction } from "@/lib/auth/actions";
import { btn } from "../ui/button";
import { useSignOutSubmit } from "./use-sign-out";

/** ออกจากระบบทุกเครื่อง: like the menu's ออกจากระบบ, the changes still on their way are sent first. */
export function LogoutEverywhereForm() {
  const { onSubmit, leaving, confirmDialog } = useSignOutSubmit();
  return (
    <>
      <form action={logoutEverywhereAction} onSubmit={onSubmit}>
        <button type="submit" disabled={leaving} className={btn("secondary")}>
          {leaving ? "กำลังบันทึก…" : "ออกจากระบบทุกเครื่อง"}
        </button>
      </form>
      {/* outside the form: the dialog has a form of its own */}
      {confirmDialog}
    </>
  );
}
