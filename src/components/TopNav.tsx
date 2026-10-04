"use client";

import { APP_NAME, APP_SHORT } from "@/lib/brand";
import { loginHref } from "@/lib/fetch-error";
import { SETTINGS_TITLE } from "@/lib/settings-labels";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { UserMenu, type SessionUser } from "./auth/UserMenu";
import { QuickSearch } from "./QuickSearch";
import { SaveStatus } from "./SaveStatus";
import { SettingsDrawer } from "./SettingsDrawer";
import { useOptionalUserData } from "./UserDataProvider";
import { btn, iconBtn } from "./ui/button";
import { BRAND_LINE, Emblem } from "./ui/Emblem";
import { Icon, type IconName } from "./ui/Icon";

/**
 * Desktop links, in order. วิธีใช้ is also in the user menu, which is where phones reach it (a
 * visitor who is not signed in gets a help button for it instead).
 */
const LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "หน้าแรก", icon: "home" },
  { href: "/recipes", label: "คำนวณสูตร", icon: "book" },
  { href: "/market", label: "สแกนตลาด", icon: "chart" },
  { href: "/inventory", label: "คลังของ", icon: "package" },
  { href: "/calc", label: "คิดภาษี", icon: "calculator" },
  { href: "/help", label: "วิธีใช้", icon: "help-circle" },
];

/** The phone tab bar: five pages, short labels. */
const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "หน้าแรก", icon: "home" },
  { href: "/recipes", label: "สูตร", icon: "book" },
  { href: "/market", label: "ตลาด", icon: "chart" },
  { href: "/inventory", label: "คลัง", icon: "package" },
  { href: "/calc", label: "ภาษี", icon: "calculator" },
];

/**
 * The top bar of every app page (rendered by <Page>): sticky, full width, with the content in the
 * same max-w-7xl column on every page. A skip link, the brand (emblem and wordmark, a link home),
 * the page links on md and up, then search and the user menu. Below md the page links move to a
 * tab bar fixed at the bottom of the screen.
 *
 * Room is tight between md and xl, so things come back as the screen widens: md shows the emblem
 * and the link labels; lg adds the wordmark and the search label; xl adds the link icons and the
 * Ctrl K hint. On phones a visitor's bar holds three buttons, so their wordmark hides below sm.
 *
 * SaveStatus sits left of search; it shows on every member page (the save queue outlives a page) and
 * grows to the left, so search and the user menu never move. A visitor who is not signed in
 * (`user` null) gets a เข้าสู่ระบบ button that comes back to this page, a ตั้งค่าตัวละคร button on
 * pages with a UserDataProvider (members have it in the user menu), and no SaveStatus (their data
 * never goes to the server). In the loading skeleton (`loading`) the menu shows as a grey
 * placeholder exactly as big as the real button, so nothing jumps when the page arrives.
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
      {/* -mt / pt: the bar reaches up over the body's status-bar padding (globals.css), so once the
          page scrolls it still covers the status bar of the installed app */}
      <header className="sticky top-0 z-40 -mt-[env(safe-area-inset-top)] border-b border-border bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 md:gap-4 md:px-6 xl:gap-6">
          <a
            href="#main"
            // the padding is a focus: variant too: focus:not-sr-only sets padding 0 at the same weight as focus:px-3
            className="sr-only rounded-lg bg-accent font-medium text-on-accent focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:px-3 focus:py-2"
          >
            ข้ามไปเนื้อหา
          </a>
          {/* min-h-10: the emblem and one line of wordmark are only 28px, too small a target on a phone */}
          <Link href="/" aria-label={APP_NAME} className="flex min-h-10 min-w-0 shrink items-center gap-2.5 rounded-lg">
            <Emblem size={28} />
            <span className={`min-w-0 flex-col md:max-lg:sr-only ${guest ? "hidden sm:flex" : "flex"}`}>
              <span className="truncate font-display text-lg font-semibold text-foreground">{APP_SHORT}</span>
              <span className="-mt-1 hidden truncate text-xs text-muted lg:block">{BRAND_LINE}</span>
            </span>
          </Link>

          <nav aria-label="เมนูหลัก" className="hidden self-stretch md:block">
            <ul className="flex h-full items-stretch">
              {LINKS.map((l) => {
                const active = pathname === l.href;
                return (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      aria-current={active ? "page" : undefined}
                      // the gold bar sits on the bar's bottom border; colour only, so nothing shifts
                      className={`relative flex h-full items-center gap-2 whitespace-nowrap px-2.5 text-sm transition-colors duration-150 after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full focus-visible:-outline-offset-2 ${
                        active ? "text-foreground after:bg-accent" : "text-muted hover:text-foreground"
                      }`}
                    >
                      <Icon name={l.icon} className={`hidden h-[18px] w-[18px] xl:block ${active ? "text-accent" : ""}`} />
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
                    className={iconBtn("ghost")}
                  >
                    <Icon name="settings" />
                  </button>
                )}
                <Link href="/help" aria-label="วิธีใช้" title="วิธีใช้" className={`${iconBtn("ghost")} md:hidden`}>
                  <Icon name="help-circle" />
                </Link>
                <Link href={signInHref} className={btn("secondary", "md")}>
                  <Icon name="log-in" className="hidden h-4 w-4 sm:block" />
                  เข้าสู่ระบบ
                </Link>
                {data && <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />}
              </>
            ) : (
              // the same size as UserMenu's button (a disc, a pill with the name from lg)
              <span aria-hidden className="skeleton block h-10 w-10 rounded-full md:h-9 md:w-9 lg:w-40" />
            )}
          </div>
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
              className={`relative flex min-h-14 flex-col items-center justify-center gap-1 pt-1 text-xs transition-colors duration-150 focus-visible:-outline-offset-2 ${
                active ? "font-medium text-accent" : "text-muted hover:text-foreground"
              }`}
            >
              {/* a short gold bar along the top edge marks the page you are on */}
              {active && <span aria-hidden className="absolute top-0 h-0.5 w-8 rounded-full bg-accent" />}
              <Icon name={t.icon} className="h-[22px] w-[22px]" />
              {t.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
