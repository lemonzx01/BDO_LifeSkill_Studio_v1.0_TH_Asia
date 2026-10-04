"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { logoutAction } from "@/lib/auth/actions";
import { isAdmin } from "@/lib/auth/roles";
import type { Role } from "@/lib/db/schema";
import { SETTINGS_TITLE } from "@/lib/settings-labels";
import { SettingsDrawer } from "../SettingsDrawer";
import { useOptionalUserData } from "../UserDataProvider";
import { Avatar } from "../ui/Avatar";
import { RoleBadge } from "../ui/Badge";
import { btn } from "../ui/button";
import { Icon, type IconName } from "../ui/Icon";
import { useSignOutSubmit } from "./use-sign-out";

export interface SessionUser {
  username: string;
  displayName: string;
  role: Role;
}

// 40px rows at every width, with room for an icon before the label
const ITEM = `${btn("ghost", "md", "start")} w-full gap-2.5 px-3 md:min-h-10`;

/** a menu row's label with its icon in front (decorative: the words name the item) */
function ItemLabel({ icon, children }: { icon: IconName; children: string }) {
  return (
    <>
      <Icon name={icon} className="h-[18px] w-[18px]" />
      {children}
    </>
  );
}

/**
 * The account menu, the same on every screen size: an avatar disc with the first letter (a gold
 * ring for admins), plus the display name from lg up, opens one small menu. It follows the menu-button pattern: arrow keys, Home and
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
  const admin = isAdmin(user.role);

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
        // a fixed size at every width (the loading skeleton's placeholder in TopNav matches it), so
        // the bar does not shift when the page arrives: a disc, and from lg a pill with the name
        // (a long name is cut with …)
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors duration-150 md:h-9 md:w-9 lg:w-40 lg:justify-start lg:gap-2 lg:border lg:border-border-strong lg:bg-panel-2 lg:pl-0.5 lg:pr-2.5 lg:hover:bg-panel-3 ${
          shown ? "lg:border-accent/60" : ""
        }`}
      >
        <Avatar name={user.displayName} admin={admin} className="md:h-8 md:w-8" />
        <span aria-hidden className="hidden min-w-0 flex-1 truncate text-left text-sm font-medium lg:block">
          {user.displayName}
        </span>
        <Icon name="chevron-down" className={`hidden h-4 w-4 text-muted transition-transform duration-150 lg:block ${shown ? "rotate-180" : ""}`} />
      </button>

      {shown && (
        // z-40, below the search dialog (z-50): the menu never paints over it
        <div className="absolute right-0 z-40 mt-2 w-60 animate-rise-in rounded-xl border border-border-strong bg-panel p-1.5 shadow-pop">
          {/* not focusable, and a press on it keeps focus in the menu (so Escape still works) */}
          <div className="flex items-center gap-2.5 px-2.5 pb-2.5 pt-1.5" onMouseDown={(e) => e.preventDefault()}>
            <Avatar name={user.displayName} admin={admin} />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-foreground">{user.displayName}</div>
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <span className="truncate">@{user.username}</span>
                {admin && <RoleBadge role={user.role} />}
              </div>
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
                <ItemLabel icon="settings">{SETTINGS_TITLE}</ItemLabel>
              </button>
            )}
            <Link href="/account" role="menuitem" tabIndex={-1} onClick={() => setOpen(false)} className={ITEM}>
              <ItemLabel icon="user">บัญชีของฉัน</ItemLabel>
            </Link>
            {admin && (
              <>
                <Link href="/admin" role="menuitem" tabIndex={-1} onClick={() => setOpen(false)} className={ITEM}>
                  <ItemLabel icon="shield">สมาชิก</ItemLabel>
                </Link>
                <Link href="/admin/stats" role="menuitem" tabIndex={-1} onClick={() => setOpen(false)} className={ITEM}>
                  <ItemLabel icon="chart-bar">สถิติการใช้งาน</ItemLabel>
                </Link>
              </>
            )}
            <Link href="/help" role="menuitem" tabIndex={-1} onClick={() => setOpen(false)} className={ITEM}>
              <ItemLabel icon="help-circle">วิธีใช้</ItemLabel>
            </Link>
            <div role="separator" className="my-1 h-px bg-border" />
            <form action={logoutAction} onSubmit={onSignOut} role="none" className="w-full">
              <button type="submit" role="menuitem" tabIndex={-1} disabled={leaving} className={ITEM}>
                <ItemLabel icon="log-out">{leaving ? "กำลังบันทึก…" : "ออกจากระบบ"}</ItemLabel>
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
