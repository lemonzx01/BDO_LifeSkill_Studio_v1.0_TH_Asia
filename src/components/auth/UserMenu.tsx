"use client";

import Link from "next/link";
import { logoutAction } from "@/lib/auth/actions";
import { ghostBtn } from "./ui";

export interface SessionUser {
  username: string;
  displayName: string;
  role: "admin" | "member";
}

export function UserMenu({ user }: { user: SessionUser }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted">
        <span className="font-medium text-foreground">{user.displayName}</span>
        {user.role === "admin" && <span className="ml-1 rounded bg-accent/15 px-1.5 py-0.5 text-[11px] text-accent">แอดมิน</span>}
      </span>
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
    </div>
  );
}
