"use client";

import { useEffect, useId, useRef } from "react";
import { GUEST_STORAGE_NOTE } from "@/lib/guest/storage";
import { SETTINGS_TITLE } from "@/lib/settings-labels";
import { SettingsPanel } from "./SettingsPanel";
import { useUserData } from "./UserDataProvider";
import { btn, iconBtn } from "./ui/button";
import { Icon } from "./ui/Icon";

/**
 * "ตั้งค่าตัวละคร": the one place to change the character settings, opened from the home page,
 * the recipes page and the user menu. A native <dialog> (showModal: focus stays inside, the page
 * behind is inert, Escape closes it): a sheet from the bottom on phones, from the right on md and
 * up. Changes save as they are made, so closing is all there is to do.
 *
 * `onClose` runs after it has closed (Escape, ×, ปิด or a press on the backdrop); focus goes back
 * to whatever had it before it opened, when that is still on the page.
 */
export function SettingsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, setSettings, guest } = useUserData();
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      d.showModal();
      closeRef.current?.focus();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);

  const close = () => ref.current?.close();

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={() => {
        const back = returnTo.current;
        returnTo.current = null;
        if (back?.isConnected) back.focus();
        onClose();
      }}
      // a press on the dimmed backdrop (outside the sheet) closes it
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      // a sheet that slides up on phones, a panel that slides in from the right on md and up; the
      // body is the page colour so the setting cards inside stand out as cards
      className="mb-0 mt-auto w-full max-w-none animate-sheet-in overflow-hidden rounded-t-xl border border-border-strong bg-background p-0 text-foreground shadow-pop backdrop:bg-black/60 backdrop:backdrop-blur-[2px] md:my-0 md:ml-auto md:mr-0 md:h-dvh md:max-h-dvh md:w-[36rem] md:animate-drawer-in md:rounded-none md:rounded-l-xl"
    >
      {open && (
        <div className="flex max-h-[85dvh] flex-col md:h-full md:max-h-none">
          {/* phones: a small grab bar says this is a sheet (decoration; close with x, ปิด or the backdrop) */}
          <div aria-hidden className="flex justify-center bg-panel pt-2 md:hidden">
            <span className="h-1 w-10 rounded-full bg-border-strong" />
          </div>
          <header className="flex items-start justify-between gap-3 border-b border-border bg-panel px-4 py-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <Icon name="settings" className="mt-0.5 h-5 w-5 text-accent" />
              <div className="min-w-0">
                <h2 id={titleId} className="font-display text-title font-semibold">
                  {SETTINGS_TITLE}
                </h2>
                <p className="text-xs text-muted">เปลี่ยนแล้วบันทึกให้เอง ใช้กับทุกหน้า</p>
                {guest && <p className="text-xs text-muted">{GUEST_STORAGE_NOTE}</p>}
              </div>
            </div>
            <button ref={closeRef} type="button" onClick={close} aria-label="ปิด" title="ปิด" className={`${iconBtn("ghost")} -mr-1.5`}>
              <Icon name="x" />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
            <SettingsPanel settings={settings} onChange={setSettings} />
          </div>
          <footer className="flex justify-end border-t border-border bg-panel px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-3">
            <button type="button" onClick={close} className={btn("secondary")}>
              ปิด
            </button>
          </footer>
        </div>
      )}
    </dialog>
  );
}
