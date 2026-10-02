"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { saveQueue } from "@/lib/save-queue";
import { useConfirm } from "../ui/ConfirmDialog";

/** how long signing out waits for the saves still on their way */
const SIGN_OUT_WAIT_MS = 2000;

/**
 * The submit handler of a sign-out form (ออกจากระบบ, ออกจากระบบทุกเครื่อง). First it sends the
 * changes still waiting to be saved and lets the ones on their way finish (2 seconds at most), so
 * they reach the server while the session still exists. If some changes failed to save, it asks
 * before throwing them away (another account signing in on this tab, or closing it, would drop
 * them); "ลองบันทึกใหม่" stays signed in and sends them again. Then it submits the form for real.
 *
 * Render `confirmDialog` once, outside the form (it holds a form of its own). `onStay` runs when the
 * member chose to stay.
 */
export function useSignOutSubmit(onStay?: () => void): { onSubmit: (e: FormEvent<HTMLFormElement>) => void; leaving: boolean; confirmDialog: ReactNode } {
  const [confirm, confirmDialog] = useConfirm();
  const [leaving, setLeaving] = useState(false);
  // lets the second submit (below) through
  const leavingRef = useRef(false);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (leavingRef.current) return;
    e.preventDefault();
    const form = e.currentTarget;
    leavingRef.current = true;
    setLeaving(true);
    saveQueue.flush(false);
    void saveQueue.whenSettled(SIGN_OUT_WAIT_MS).then(async () => {
      if (saveQueue.hasFailed()) {
        const failed = saveQueue.getSnapshot().failed;
        const go = await confirm({
          title: "ยังบันทึกไม่ครบ",
          body: `ยังบันทึกไม่สำเร็จ ${failed} รายการ ออกจากระบบตอนนี้จะทิ้งการเปลี่ยนแปลงนี้`,
          confirmLabel: "ออกเลย",
          cancelLabel: "ลองบันทึกใหม่",
          tone: "danger",
        });
        if (!go) {
          leavingRef.current = false;
          setLeaving(false);
          saveQueue.retry();
          onStay?.();
          return;
        }
      }
      if (form.isConnected) form.requestSubmit();
    });
  };

  return { onSubmit, leaving, confirmDialog };
}
