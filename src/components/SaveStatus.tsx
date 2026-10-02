"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { saveQueue, type SaveState } from "@/lib/save-queue";
import { useSaveState } from "./UserDataProvider";
import { btn } from "./ui/button";

/** what a screen reader hears when the state changes */
const SPOKEN: Record<SaveState, string> = {
  idle: "",
  saving: "กำลังบันทึก",
  saved: "บันทึกแล้ว",
  error: "บันทึกไม่สำเร็จ กดลองใหม่",
  authExpired: "หมดเวลาเข้าสู่ระบบ ล็อกอินใหม่เพื่อบันทึก",
};

const SHOW_SAVED_MS = 2000;
const FADE_MS = 500;

// Where the header has room for the words (md to lg: the brand is an icon; xl and up), and where
// only a dot / ✓ fits without pushing the brand name and the links aside (phones; lg to xl).
const ROOMY = "max-md:hidden lg:max-xl:hidden";
const TIGHT = "md:max-lg:hidden xl:hidden";

/**
 * The save indicator in the header (TopNav), on every page: the save queue outlives the page a
 * change was made on, so a save that fails after moving to /help, /account or /admin still shows
 * here. กำลังบันทึก…
 * while changes are on their way, บันทึกแล้ว ✓ for two seconds, a red button to try again when a
 * save failed, and a link to sign in again when the session has ended.
 *
 * The header has little room below xl, and the indicator must not push the brand and the links
 * aside on every save: on phones and between lg and xl, saving and saved are a dot and a ✓, and
 * below xl the two buttons say only what to press (ลองบันทึกใหม่ / ล็อกอินใหม่). The full
 * sentence is in the polite live region, which is announced once and takes no room in the header.
 */
export function SaveStatus() {
  const { state, savedSeq } = useSaveState();
  // which "saved" note has started fading / is gone (savedSeq goes up once per save)
  const [faded, setFaded] = useState({ seq: -1, gone: false });

  useEffect(() => {
    if (state !== "saved") return;
    const fade = setTimeout(() => setFaded({ seq: savedSeq, gone: false }), SHOW_SAVED_MS);
    const gone = setTimeout(() => setFaded({ seq: savedSeq, gone: true }), SHOW_SAVED_MS + FADE_MS);
    return () => {
      clearTimeout(fade);
      clearTimeout(gone);
    };
  }, [state, savedSeq]);

  const fading = state === "saved" && faded.seq === savedSeq;
  const hidden = state === "idle" || (fading && faded.gone);

  return (
    <>
      <span role="status" aria-live="polite" className="sr-only">
        {SPOKEN[state]}
      </span>
      {!hidden && state === "saving" && (
        <span aria-hidden title="กำลังบันทึก…" className="whitespace-nowrap text-xs text-muted">
          <span className={ROOMY}>กำลังบันทึก…</span>
          <span className={`${TIGHT} inline-block h-2 w-2 animate-pulse rounded-full bg-muted`} />
        </span>
      )}
      {!hidden && state === "saved" && (
        <span aria-hidden title="บันทึกแล้ว" className={`whitespace-nowrap text-xs text-good transition-opacity duration-500 ${fading ? "opacity-0" : ""}`}>
          <span className={ROOMY}>บันทึกแล้ว ✓</span>
          <span className={TIGHT}>✓</span>
        </span>
      )}
      {/* the accessible name is the text that is showing (the other span is display:none) */}
      {state === "error" && (
        <button type="button" onClick={saveQueue.retry} className={btn("danger", "sm")}>
          <span className="max-xl:hidden">บันทึกไม่สำเร็จ · ลองใหม่</span>
          <span className="xl:hidden">ลองบันทึกใหม่</span>
        </button>
      )}
      {state === "authExpired" && (
        // a client-side link on purpose: the unsaved changes stay in this tab's save queue, and
        // the first page after signing back in (same account) sends them
        <Link href="/login" className={btn("danger", "sm")}>
          <span className="max-xl:hidden">หมดเวลาเข้าสู่ระบบ · ล็อกอินใหม่</span>
          <span className="xl:hidden">ล็อกอินใหม่</span>
        </Link>
      )}
    </>
  );
}
