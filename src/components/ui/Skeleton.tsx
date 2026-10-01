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

const WIDTH = { "7xl": "max-w-7xl", "5xl": "max-w-5xl" } as const;

/** A whole page: title, a row of controls and a table. Used while a route or a page's client part loads. */
export function PageSkeleton({ width = "7xl", rows = 8, label = "กำลังโหลดหน้า…" }: { width?: keyof typeof WIDTH; rows?: number; label?: string }) {
  return (
    <main className={`mx-auto w-full ${WIDTH[width]} px-3 py-4 md:px-6`}>
      <div aria-hidden className="animate-pulse">
        <div className="mb-4 flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-6 w-56 rounded bg-panel-2" />
            <div className="h-3 w-80 max-w-full rounded bg-panel-2/70" />
          </div>
          <div className="hidden gap-2 md:flex">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="h-8 w-20 rounded bg-panel-2" />
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
    </main>
  );
}
