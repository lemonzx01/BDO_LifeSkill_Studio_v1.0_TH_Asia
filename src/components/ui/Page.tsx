import type { ReactNode } from "react";
import type { SessionUser } from "../auth/UserMenu";
import { GuestImportNotice } from "../GuestImportNotice";
import { SessionEndedNotice } from "../SessionEndedNotice";
import { TopNav } from "../TopNav";
import { Badge } from "./Badge";
import { ToastHost } from "./Toast";

export type PageWidth = "wide" | "narrow";

// full literal strings: Tailwind cannot see class names built at runtime
const WIDTH: Record<PageWidth, string> = { wide: "max-w-7xl", narrow: "max-w-5xl" };

/**
 * The shell of every app page: the header, then the page content in <main id="main"> (the skip
 * link's target).
 *
 * The header always sits in the same max-w-7xl column, whatever the content width, so it does not
 * shift sideways when you switch pages. On phones the content leaves room at the bottom for the
 * fixed tab bar and the home indicator.
 *
 * `user` null is a visitor who is not signed in (the header offers เข้าสู่ระบบ). `loading` marks the
 * loading skeleton (PageSkeleton), which does not know yet who is visiting.
 */
export function Page({ user, loading = false, width = "wide", children }: { user: SessionUser | null; loading?: boolean; width?: PageWidth; children: ReactNode }) {
  return (
    <>
      <div className="mx-auto w-full max-w-7xl px-3 md:px-6">
        <TopNav user={user} loading={loading} />
      </div>
      <main
        id="main"
        tabIndex={-1}
        className={`mx-auto w-full ${WIDTH[width]} px-3 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-2 outline-hidden md:px-6 md:pb-6 md:pt-4`}
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
 * The top of a page: its title (the page's only h1), a short grey line on what the page is for, a
 * row of small neutral chips for status (price age, source, counts) and the page's own buttons on
 * the right. Falsy chips are skipped, so a chip can be written as `cond && "…"`.
 */
export function PageHeader({
  title,
  description,
  meta,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode[];
  actions?: ReactNode;
}) {
  const chips = (meta ?? []).filter((m) => m !== null && m !== undefined && m !== false && m !== "");
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold md:text-xl">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        {chips.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
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
  );
}
