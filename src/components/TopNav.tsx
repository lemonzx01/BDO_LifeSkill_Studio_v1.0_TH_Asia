"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserMenu, type SessionUser } from "./auth/UserMenu";

const LINKS = [
  { href: "/", label: "คำนวณสูตร" },
  { href: "/market", label: "สแกนตลาด" },
  { href: "/inventory", label: "คลังของ" },
];

export function TopNav({ user, subtitle }: { user: SessionUser; subtitle?: string }) {
  const pathname = usePathname();
  return (
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-accent md:text-2xl">BDO LifeSkill Studio</h1>
          {subtitle && <p className="text-xs text-muted md:text-sm">{subtitle}</p>}
        </div>
        <nav className="flex rounded border border-border bg-panel p-0.5">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link key={l.href} href={l.href} className={`rounded px-3 py-1 text-sm ${active ? "bg-accent text-black" : "text-muted hover:text-foreground"}`}>
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <UserMenu user={user} />
    </header>
  );
}
