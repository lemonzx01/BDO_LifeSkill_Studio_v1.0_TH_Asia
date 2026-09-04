"use client";

import Link from "next/link";
import { useState } from "react";
import { logoutAction } from "@/lib/auth/actions";
import { ghostBtn } from "./ui";

export interface SessionUser {
  username: string;
  displayName: string;
  role: "admin" | "member";
}

/** Full menu on desktop; a single avatar button that opens a small menu on phones. */
export function UserMenu({ user, compact = false }: { user: SessionUser; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const links = (
    <>
      {user.role === "admin" && (
        <Link href="/admin" className={ghostBtn}>
          สมาชิก
        </Link>
      )}
      <Link href="/account" className={ghostBtn}>
        รหัสผ่าน
      </Link>
      <form action={logoutAction}>
        <button type="submit" className={ghostBtn}>
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
              {user.role === "admin" ? " · แอดมิน" : ""}
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
        {user.role === "admin" && <span className="ml-1 rounded bg-accent/15 px-1.5 py-0.5 text-[11px] text-accent">แอดมิน</span>}
      </span>
      {links}
    </div>
  );
}
