"use client";

import type { GuestSummary } from "@/lib/guest/storage";
import { SETTINGS_TITLE } from "@/lib/settings-labels";
import { useOptionalUserData } from "./UserDataProvider";
import { useConfirm } from "./ui/ConfirmDialog";
import { Notice } from "./ui/Notice";
import { toast } from "./ui/Toast";

/** "คลัง 12 รายการ · ของที่เฝ้า 3 รายการ · ตั้งค่าตัวละคร": what would be copied. */
function describe(s: GuestSummary): string {
  return [s.items > 0 && `คลัง ${s.items} รายการ`, s.favorites > 0 && `ของที่เฝ้า ${s.favorites} รายการ`, s.settings && SETTINGS_TITLE].filter(Boolean).join(" · ");
}

/**
 * Shown at the top of a page (by <Page>) when a member has just signed in on a browser that kept
 * data from before signing in, and the account is still empty: copy it in, after a confirm. Never
 * done without asking. × hides the offer for this tab; the browser's copy stays where it is. After
 * copying, the browser's copy is removed only once the account has confirmed every save.
 */
export function GuestImportNotice() {
  const data = useOptionalUserData();
  const [confirm, confirmDialog] = useConfirm();
  const offer = data?.guestImport ?? null;
  if (!data) return null;

  const run = async (s: GuestSummary) => {
    const what = describe(s);
    const ok = await confirm({
      title: "นำข้อมูลในเครื่องนี้เข้าบัญชี?",
      body: `${what} จะถูกบันทึกเข้าบัญชีนี้ บันทึกครบแล้วจึงลบออกจากเครื่องนี้`,
      confirmLabel: "นำเข้าบัญชี",
    });
    if (!ok) return;
    data.importGuestData();
    // the saves are on their way: the save status in the header says when they are done (or failed)
    toast({ text: "กำลังนำข้อมูลเข้าบัญชี…" });
  };

  return (
    <>
      {offer && (
        <Notice tone="info" className="mb-4" action={{ label: "นำข้อมูลในเครื่องนี้เข้าบัญชี", onClick: () => void run(offer) }} onClose={data.dismissGuestImport}>
          เครื่องนี้มีข้อมูลที่ใช้ตอนยังไม่ได้ล็อกอิน: {describe(offer)}
        </Notice>
      )}
      {confirmDialog}
    </>
  );
}
