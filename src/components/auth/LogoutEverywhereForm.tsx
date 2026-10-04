"use client";

import { logoutEverywhereAction } from "@/lib/auth/actions";
import { btn } from "../ui/button";
import { Icon } from "../ui/Icon";
import { useSignOutSubmit } from "./use-sign-out";

/** ออกจากระบบทุกเครื่อง: like the menu's ออกจากระบบ, the changes still on their way are sent first. */
export function LogoutEverywhereForm() {
  const { onSubmit, leaving, confirmDialog } = useSignOutSubmit();
  return (
    <>
      {/* shrink-0: beside its hint on /account the button keeps its one line; full width on phones */}
      <form action={logoutEverywhereAction} onSubmit={onSubmit} className="shrink-0">
        <button type="submit" disabled={leaving} className={`${btn("secondary")} w-full sm:w-auto`}>
          {leaving ? <Icon name="loader" className="h-4 w-4 animate-spin" /> : <Icon name="log-out" className="h-4 w-4" />}
          {leaving ? "กำลังบันทึก…" : "ออกจากระบบทุกเครื่อง"}
        </button>
      </form>
      {/* outside the form: the dialog has a form of its own */}
      {confirmDialog}
    </>
  );
}
