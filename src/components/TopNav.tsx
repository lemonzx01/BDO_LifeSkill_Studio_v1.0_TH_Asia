"use client";

import { APP_NAME } from "@/lib/brand";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { UserMenu, type SessionUser } from "./auth/UserMenu";

const LINKS = [
  { href: "/", label: "หน้าแรก" },
  { href: "/recipes", label: "คำนวณสูตร" },
  { href: "/market", label: "สแกนตลาด" },
  { href: "/inventory", label: "คลังของ" },
  { href: "/calc", label: "คิดภาษี" },
  { href: "/help", label: "วิธีใช้" },
];

export function TopNav({ user, subtitle }: { user: SessionUser; subtitle?: ReactNode }) {
  const pathname = usePathname();
  return (
    <header className="mb-4 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
      <div className="flex items-start justify-between gap-3 md:items-center md:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-accent md:text-2xl">{APP_NAME}</h1>
          {subtitle && <p className="text-xs text-muted md:text-sm">{subtitle}</p>}
        </div>
        <div className="md:hidden">
          <UserMenu user={user} compact />
        </div>
      </div>
      {/* scrolls sideways on phones instead of wrapping into three lines */}
      <nav className="-mx-3 flex overflow-x-auto px-3 md:mx-0 md:px-0">
        <div className="flex rounded border border-border bg-panel p-0.5">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`whitespace-nowrap rounded px-3 py-1.5 text-sm ${active ? "bg-accent text-black" : "text-muted hover:text-foreground"}`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>
      </nav>
      <div className="hidden md:block">
        <UserMenu user={user} />
      </div>
    </header>
  );
}
