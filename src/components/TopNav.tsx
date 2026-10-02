"use client";

import { APP_NAME } from "@/lib/brand";
import { loginHref } from "@/lib/fetch-error";
import { SETTINGS_TITLE } from "@/lib/settings-labels";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { UserMenu, type SessionUser } from "./auth/UserMenu";
import { QuickSearch } from "./QuickSearch";
import { SaveStatus } from "./SaveStatus";
import { SettingsDrawer } from "./SettingsDrawer";
import { useOptionalUserData } from "./UserDataProvider";
import { btn } from "./ui/button";

/**
 * Desktop links, in order. วิธีใช้ is also in the user menu, which is where phones reach it (a
 * visitor who is not signed in gets a ? button for it instead).
 */
const LINKS = [
  { href: "/", label: "หน้าแรก" },
  { href: "/recipes", label: "คำนวณสูตร" },
  { href: "/market", label: "สแกนตลาด" },
  { href: "/inventory", label: "คลังของ" },
  { href: "/calc", label: "คิดภาษี" },
  { href: "/help", label: "วิธีใช้" },
];

/** The phone tab bar: five pages, short labels. */
const TABS: { href: string; label: string; icon: ReactNode }[] = [
  {
    href: "/",
    label: "หน้าแรก",
    icon: (
      <>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5.5 9v11.5h4.5v-6h4v6h4.5V9" />
      </>
    ),
  },
  {
    href: "/recipes",
    label: "สูตร",
    icon: (
      <>
        <path d="M9 3h6" />
        <path d="M10 3v6.5l-5.6 9.7A1.2 1.2 0 0 0 5.4 21h13.2a1.2 1.2 0 0 0 1-1.8L14 9.5V3" />
        <path d="M7.2 15h9.6" />
      </>
    ),
  },
  {
    href: "/market",
    label: "ตลาด",
    icon: (
      <>
        <path d="M3.5 3.5v17h17" />
        <path d="m7.5 15 4-4 3 3 5.5-5.5" />
        <path d="M15.5 8.5H20V13" />
      </>
    ),
  },
  {
    href: "/inventory",
    label: "คลัง",
    icon: (
      <>
        <path d="M3.5 7.5 12 3.5l8.5 4v9L12 20.5l-8.5-4z" />
        <path d="M3.5 7.5 12 11.5l8.5-4" />
        <path d="M12 11.5v9" />
      </>
    ),
  },
  {
    href: "/calc",
    label: "ภาษี",
    icon: (
      <>
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M8.5 7h7" />
        <path d="M8.5 11.5h1M11.5 11.5h1M14.5 11.5h1M8.5 15h1M11.5 15h1M14.5 15h1M8.5 18h1M11.5 18h1M14.5 18h1" />
      </>
    ),
  },
];

/**
 * The header of every app page (rendered by <Page>): a skip link, the brand (a link home), the page
 * links on md and up, then search and the user menu. Below md the page links move to a tab bar
 * fixed at the bottom of the screen.
 *
 * SaveStatus sits left of search; it shows on every member page (the save queue outlives a page) and
 * grows to the left, so search and the user menu never move. A visitor who is not signed in
 * (`user` null) gets a เข้าสู่ระบบ button that comes back to this page, a ตั้งค่าตัวละคร button on
 * pages with a UserDataProvider (members have it in the user menu), and no SaveStatus (their data
 * never goes to the server). In the loading skeleton (`loading`) the menu shows as a grey
 * placeholder exactly as wide as the real button, so nothing jumps when the page arrives.
 */
export function TopNav({ user, loading = false }: { user: SessionUser | null; loading?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // a guest's way to the character settings on every page with a provider (members use UserMenu)
  const data = useOptionalUserData();
  const [settingsOpen, setSettingsOpen] = useState(false);
  // the loading skeleton also shows on the way to the pages that have no app navigation: login,
  // first-time setup and the forced password change (/account?first=1)
  if (loading && (pathname === "/login" || pathname === "/setup" || (pathname === "/account" && searchParams.get("first") === "1"))) {
    return null;
  }
  const guest = !loading && user === null;
  const query = searchParams.toString();
  const signInHref = loginHref(query ? `${pathname}?${query}` : pathname);
  return (
    <>
      <header className="flex h-14 items-center gap-3 lg:gap-6">
        <a
          href="#main"
          // the padding is a focus: variant too: focus:not-sr-only sets padding 0 at the same weight as focus:px-3
          className="sr-only rounded bg-accent text-black focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:px-3 focus:py-2"
        >
          ข้ามไปเนื้อหา
        </a>
        <Link href="/" className="flex min-w-0 shrink items-center gap-2 rounded">
          {/* eslint-disable-next-line @next/next/no-img-element -- a 28px app icon: next/image adds nothing here */}
          <img src="/icons/app-192.png" alt="" width={28} height={28} className="h-7 w-7 shrink-0 rounded" />
          {/* icon only between md and lg, where the six links need the room */}
          <span className="truncate text-base font-bold text-accent md:max-lg:sr-only">{APP_NAME}</span>
        </Link>

        <nav aria-label="เมนูหลัก" className="hidden md:block">
          <ul className="flex items-center">
            {LINKS.map((l) => {
              const active = pathname === l.href;
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={`relative block whitespace-nowrap rounded px-2 py-1.5 text-sm after:absolute after:inset-x-2 after:-bottom-1 after:h-0.5 ${
                      active ? "text-foreground after:bg-accent" : "text-muted hover:text-foreground"
                    }`}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {!guest && <SaveStatus />}
          <QuickSearch compact />
          {user ? (
            <UserMenu user={user} />
          ) : guest ? (
            <>
              {data && (
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  aria-haspopup="dialog"
                  aria-label={SETTINGS_TITLE}
                  title={SETTINGS_TITLE}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-panel text-muted hover:text-foreground md:h-8 md:w-8"
                >
                  <svg aria-hidden viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </button>
              )}
              <Link
                href="/help"
                aria-label="วิธีใช้"
                title="วิธีใช้"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-panel text-lg text-muted hover:text-foreground md:hidden"
              >
                <span aria-hidden>?</span>
              </Link>
              <Link href={signInHref} className={btn("secondary", "md")}>
                เข้าสู่ระบบ
              </Link>
              {data && <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />}
            </>
          ) : (
            // the same size as UserMenu's button (md:w-28, lg:w-40)
            <span aria-hidden className="block h-10 w-10 animate-pulse rounded-full bg-panel-2 md:h-8 md:w-28 md:rounded lg:w-40" />
          )}
        </div>
      </header>

      <nav
        aria-label="เมนูหลัก"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-panel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs ${active ? "text-accent" : "text-muted hover:text-foreground"}`}
            >
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                width={20}
                height={20}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {t.icon}
              </svg>
              {t.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
