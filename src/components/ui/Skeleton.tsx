import { Page, type PageWidth } from "./Page";

/**
 * Grey outlines of what is about to appear. They pulse (animate-pulse, which the reduced-motion
 * rule in globals.css stops) and tell screen readers what is loading.
 */

/** A table: a header bar and `n` rows. */
export function SkeletonRows({ n = 8, label = "กำลังโหลด…", className = "" }: { n?: number; label?: string; className?: string }) {
  return (
    <div role="status" className={`animate-pulse rounded-lg border border-border bg-panel ${className}`}>
      <div aria-hidden className="h-9 rounded-t-lg bg-panel-2/80" />
      {Array.from({ length: n }, (_, i) => (
        <div key={i} aria-hidden className="flex items-center gap-3 border-t border-border/60 px-3 py-2.5">
          <div className="h-7 w-7 rounded bg-panel-2" />
          <div className="h-3 flex-1 rounded bg-panel-2" />
          <div className="h-3 w-16 rounded bg-panel-2" />
          <div className="h-3 w-16 rounded bg-panel-2" />
          <div className="hidden h-3 w-16 rounded bg-panel-2 md:block" />
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** `n` cards with a title bar and a few list rows; `className` sets the grid they sit in. */
export function SkeletonCards({ n = 6, label = "กำลังโหลด…", className = "" }: { n?: number; label?: string; className?: string }) {
  return (
    <div role="status" className={`animate-pulse ${className}`}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} aria-hidden className="rounded-lg border border-border bg-panel">
          <div className="border-b border-border px-4 py-3">
            <div className="h-4 w-40 max-w-full rounded bg-panel-2" />
          </div>
          {Array.from({ length: 4 }, (_, j) => (
            <div key={j} className="flex items-center gap-3 px-4 py-2.5">
              <div className="h-8 w-8 shrink-0 rounded bg-panel-2" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-3/4 rounded bg-panel-2" />
                <div className="h-2.5 w-1/2 rounded bg-panel-2/70" />
              </div>
              <div className="h-3 w-12 rounded bg-panel-2" />
            </div>
          ))}
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

/**
 * A whole page, used while a route or a page's client part loads. It is the real page shell (the
 * header and, on phones, the tab bar stay put, with the user menu as a grey placeholder), then the
 * outline of a PageHeader (title, description, chips, buttons), a row of controls and a table.
 */
export function PageSkeleton({ width = "wide", rows = 8, label = "กำลังโหลดหน้า…" }: { width?: PageWidth; rows?: number; label?: string }) {
  return (
    <Page user={null} width={width}>
      <div aria-hidden className="animate-pulse">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="space-y-2">
            <div className="h-7 w-48 rounded bg-panel-2" />
            <div className="h-3.5 w-80 max-w-full rounded bg-panel-2/70" />
            <div className="flex gap-1.5">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="h-5 w-20 rounded bg-panel-2/70" />
              ))}
            </div>
          </div>
          <div className="hidden gap-2 md:flex">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="h-9 w-24 rounded bg-panel-2" />
            ))}
          </div>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-9 w-32 rounded bg-panel-2" />
          ))}
        </div>
      </div>
      <SkeletonRows n={rows} label={label} />
    </Page>
  );
}
