import type { ReactNode } from "react";
import type { SessionUser } from "../auth/UserMenu";
import { GuestImportNotice } from "../GuestImportNotice";
import { SessionEndedNotice } from "../SessionEndedNotice";
import { TopNav } from "../TopNav";
import { Badge } from "./Badge";
import { Divider } from "./Divider";
import { ToastHost } from "./Toast";

export type PageWidth = "wide" | "narrow";

// full literal strings: Tailwind cannot see class names built at runtime
const WIDTH: Record<PageWidth, string> = { wide: "max-w-7xl", narrow: "max-w-5xl" };

/**
 * The shell of every app page: the sticky top bar (TopNav), then the page content in
 * <main id="main"> (the skip link's target).
 *
 * The bar's own column is always max-w-7xl, whatever the content width, so it does not shift
 * sideways when you switch pages. On phones the content leaves room at the bottom for the fixed
 * tab bar and the home indicator. Space between the parts of a page: `space-y-4 md:space-y-6`.
 *
 * `user` null is a visitor who is not signed in (the bar offers เข้าสู่ระบบ). `loading` marks the
 * loading skeleton (PageSkeleton), which does not know yet who is visiting.
 */
export function Page({ user, loading = false, width = "wide", children }: { user: SessionUser | null; loading?: boolean; width?: PageWidth; children: ReactNode }) {
  return (
    <>
      <TopNav user={user} loading={loading} />
      <main
        id="main"
        tabIndex={-1}
        className={`mx-auto w-full ${WIDTH[width]} px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4 outline-hidden md:px-6 md:pb-10 md:pt-6`}
      >
        {/* a member who just signed in on a browser holding guest data: offer to copy it in */}
        {!loading && user && <GuestImportNotice />}
        {/* a visitor whose browser still has a session cookie that no longer works: say so */}
        {!loading && !user && <SessionEndedNotice />}
        {children}
      </main>
      {/* the one place toast() messages show, on every page */}
      <ToastHost />
    </>
  );
}

/**
 * The top of a page: a small gold eyebrow (optional, e.g. the section a page belongs to), its
 * Taviraj title (the page's only h1), a short grey line on what the page is for, a row of small
 * neutral chips for status (price age, source, counts) and the page's own buttons on the right.
 * Under it all, the ledger Divider. Falsy chips are skipped, so a chip can be written as
 * `cond && "…"`.
 */
export function PageHeader({
  title,
  description,
  meta,
  actions,
  eyebrow,
  divider = true,
}: {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode[];
  actions?: ReactNode;
  /** a short line above the title, e.g. "สมุดบัญชีนักผจญภัย" or the section name */
  eyebrow?: ReactNode;
  /** false leaves out the ledger divider under the header */
  divider?: boolean;
}) {
  const chips = (meta ?? []).filter((m) => m !== null && m !== undefined && m !== false && m !== "");
  return (
    <div className="mb-4 md:mb-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          {eyebrow && <p className="mb-1 text-xs font-medium text-accent/90">{eyebrow}</p>}
          {/* wrap-anywhere: a long name in the title (สวัสดี …) breaks instead of widening the page */}
          <h1 className="font-display text-display font-semibold text-balance wrap-anywhere text-foreground md:text-display-lg">{title}</h1>
          {description && <p className="mt-1 max-w-prose text-sm text-muted">{description}</p>}
          {chips.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {chips.map((c, i) => (
                <li key={i} className="max-w-full">
                  <Badge wrap>{c}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {divider && <Divider className="mt-4" />}
    </div>
  );
}
