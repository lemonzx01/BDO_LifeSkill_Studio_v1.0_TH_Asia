"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { logoutAction } from "@/lib/auth/actions";
import { isAdmin } from "@/lib/auth/roles";
import type { Role } from "@/lib/db/schema";
import { SETTINGS_TITLE } from "@/lib/settings-labels";
import { SettingsDrawer } from "../SettingsDrawer";
import { useOptionalUserData } from "../UserDataProvider";
import { RoleBadge } from "../ui/Badge";
import { btn } from "../ui/button";
import { useSignOutSubmit } from "./use-sign-out";

export interface SessionUser {
  username: string;
  displayName: string;
  role: Role;
}

const ITEM = `${btn("ghost", "md", "start")} w-full`;

/** The avatar letter: skip a leading Thai vowel (เ แ โ ใ ไ), so "เจ้าพ่อ" shows จ, not เ. */
function initial(name: string): string {
  const chars = Array.from(name.trim().replace(/^[เ-ไ]+/, ""));
  return (chars[0] ?? Array.from(name.trim())[0] ?? "?").toUpperCase();
}

/**
 * The account menu, the same on every screen size: the avatar letter on phones and the display
 * name on md and up open one small menu. It follows the menu-button pattern: arrow keys, Home and
 * End move between items, Escape closes it and puts focus back on the button, and Tab, any pointer
 * press outside it or focus moving anywhere else (e.g. Ctrl+K opening search) closes it.
 *
 * On pages with a UserDataProvider it also has ตั้งค่าตัวละคร, which opens SettingsDrawer.
 */
export function UserMenu({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const data = useOptionalUserData();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  // signing out waits for the last saves, and asks before dropping changes that failed to save;
  // the menu stays on screen meanwhile, so the form is still there. Staying: back to the menu button.
  const { onSubmit: onSignOut, leaving, confirmDialog } = useSignOutSubmit(() => buttonRef.current?.focus());

  const items = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  // while open: focus the first item; close on a press outside, on Escape, and when focus leaves
  useEffect(() => {
    if (!open) return;
    const root = rootRef.current;
    const t = setTimeout(() => menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus(), 0);
    // a press inside can blur the item without focusing anything (Safari does not focus a pressed
    // button): that is not focus leaving the menu
    let pressInside = false;
    const onPointerDown = (e: PointerEvent) => {
      pressInside = !!root?.contains(e.target as Node);
      if (!pressInside) setOpen(false);
    };
    const onPointerUp = () => {
      pressInside = false;
    };
    // here and not only on the menu: Escape must work wherever focus is while the menu shows
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onFocusOut = (e: FocusEvent) => {
      if (!pressInside && !root?.contains(e.relatedTarget as Node | null)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
    document.addEventListener("keydown", onKeyDown);
    root?.addEventListener("focusout", onFocusOut);
    return () => {
      clearTimeout(t);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);
      document.removeEventListener("keydown", onKeyDown);
      root?.removeEventListener("focusout", onFocusOut);
    };
  }, [open]);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  const onMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const list = items();
    const i = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Tab") {
      // back to the button first, so Tab carries on from there (Shift+Tab goes before it)
      close(true);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      list[(i + 1) % list.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      list[i <= 0 ? list.length - 1 : i - 1]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      list[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      list[list.length - 1]?.focus();
    }
  };

  const onButtonKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
    }
  };

  const shown = open || leaving;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onButtonKeyDown}
        aria-haspopup="menu"
        aria-expanded={shown}
        aria-controls={shown ? menuId : undefined}
        aria-label={`เมนูของ ${user.displayName}`}
        // a fixed width from md up (the loading skeleton's placeholder in TopNav matches it), so the
        // header does not shift when the page arrives; a long name is cut with …. Narrower below lg,
        // where the six links leave little room for SaveStatus.
        className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-panel text-sm font-semibold hover:bg-panel-2 md:h-8 md:w-28 md:justify-between md:gap-1.5 md:rounded md:px-2.5 md:font-medium lg:w-40"
      >
        <span aria-hidden className="md:hidden">
          {initial(user.displayName)}
        </span>
        <span aria-hidden className="hidden truncate md:inline">
          {user.displayName}
        </span>
        <svg aria-hidden viewBox="0 0 16 16" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={1.75} className="hidden shrink-0 text-muted md:block">
          <path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {shown && (
        // z-40, below the search dialog (z-50): the menu never paints over it
        <div className="absolute right-0 z-40 mt-1 w-56 rounded-lg border border-border bg-panel p-1.5 shadow-lg">
          {/* not focusable, and a press on it keeps focus in the menu (so Escape still works) */}
          <div className="px-3 pb-2 pt-1" onMouseDown={(e) => e.preventDefault()}>
            <div className="truncate text-sm font-medium text-foreground">{user.displayName}</div>
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <span className="truncate">@{user.username}</span>
              {isAdmin(user.role) && <RoleBadge role={user.role} />}
            </div>
          </div>
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label="เมนูผู้ใช้"
            onKeyDown={onMenuKeyDown}
            className="flex flex-col gap-0.5 border-t border-border pt-1.5"
          >
            {data && (
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                aria-haspopup="dialog"
                onClick={() => {
                  setOpen(false);
                  setSettingsOpen(true);
                }}
                className={ITEM}
              >
                {SETTINGS_TITLE}
              </button>
            )}
            <Link href="/account" role="menuitem" tabIndex={-1} onClick={() => setOpen(false)} className={ITEM}>
              บัญชีของฉัน
            </Link>
            {isAdmin(user.role) && (
              <>
                <Link href="/admin" role="menuitem" tabIndex={-1} onClick={() => setOpen(false)} className={ITEM}>
                  สมาชิก
                </Link>
                <Link href="/admin/stats" role="menuitem" tabIndex={-1} onClick={() => setOpen(false)} className={ITEM}>
                  สถิติการใช้งาน
                </Link>
              </>
            )}
            <Link href="/help" role="menuitem" tabIndex={-1} onClick={() => setOpen(false)} className={ITEM}>
              วิธีใช้
            </Link>
            <div role="separator" className="my-0.5 h-px bg-border" />
            <form action={logoutAction} onSubmit={onSignOut} role="none" className="w-full">
              <button type="submit" role="menuitem" tabIndex={-1} disabled={leaving} className={ITEM}>
                {leaving ? "กำลังบันทึก…" : "ออกจากระบบ"}
              </button>
            </form>
          </div>
        </div>
      )}

      {confirmDialog}

      {data && (
        <SettingsDrawer
          open={settingsOpen}
          onClose={() => {
            setSettingsOpen(false);
            // the menu item that opened it is gone: back to the menu button
            buttonRef.current?.focus();
          }}
        />
      )}
    </div>
  );
}
