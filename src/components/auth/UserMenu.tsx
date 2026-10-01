"use client";

import Link from "next/link";
import { useState } from "react";
import { logoutAction } from "@/lib/auth/actions";
import { isAdmin, ROLE_TH } from "@/lib/auth/roles";
import type { Role } from "@/lib/db/schema";
import { RoleBadge } from "../ui/Badge";
import { ghostBtn } from "./ui";

export interface SessionUser {
  username: string;
  displayName: string;
  role: Role;
}

/** Full menu on desktop; a single avatar button that opens a small menu on phones. */
export function UserMenu({ user, compact = false }: { user: SessionUser; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  // the phone dropdown is a list: full-width rows with left-aligned labels, not centred buttons
  const item = compact ? "flex min-h-10 w-full items-center rounded px-3 text-sm text-foreground hover:bg-panel-2" : ghostBtn;
  const links = (
    <>
      {isAdmin(user.role) && (
        <Link href="/admin" className={item}>
          สมาชิก
        </Link>
      )}
      <Link href="/account" className={item}>
        รหัสผ่าน
      </Link>
      <form action={logoutAction} className={compact ? "w-full" : undefined}>
        <button type="submit" className={item}>
          ออกจากระบบ
        </button>
      </form>
    </>
  );

  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-panel text-sm font-semibold"
          aria-label="เมนูผู้ใช้"
        >
          {user.displayName.slice(0, 1).toUpperCase()}
        </button>
        {open && (
          <div className="absolute right-0 z-20 mt-1 flex w-44 flex-col gap-1 rounded border border-border bg-panel p-2 shadow-lg">
            <span className="px-1 pb-1 text-xs text-muted">
              {user.displayName}
              {isAdmin(user.role) ? ` · ${ROLE_TH[user.role]}` : ""}
            </span>
            {links}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted">
        <span className="font-medium text-foreground">{user.displayName}</span>
        {isAdmin(user.role) && <RoleBadge role={user.role} className="ml-1" />}
      </span>
      {links}
    </div>
  );
}
