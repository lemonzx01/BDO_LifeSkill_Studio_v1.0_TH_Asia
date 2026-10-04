import { Divider } from "./Divider";
import { Emblem } from "./Emblem";
import { Page, type PageWidth } from "./Page";

/**
 * Outlines of what is about to appear: panel-2 blocks (the `skeleton` utility in globals.css) with
 * a slow light sweeping across, which rests under reduced motion. Each one tells screen readers
 * what is loading. For a one-off block: <div aria-hidden className="skeleton h-4 w-32 rounded-md" />.
 */

/** A table: a header bar and `n` rows. */
export function SkeletonRows({ n = 8, label = "กำลังโหลด…", className = "" }: { n?: number; label?: string; className?: string }) {
  return (
    <div role="status" className={`overflow-hidden rounded-xl border border-border bg-panel shadow-card ${className}`}>
      <div aria-hidden className="h-9 bg-panel-2/70" />
      {Array.from({ length: n }, (_, i) => (
        <div key={i} aria-hidden className="flex items-center gap-3 border-t border-border/70 px-4 py-3">
          <div className="skeleton h-8 w-8 shrink-0 rounded-md" />
          <div className="skeleton h-3 flex-1 rounded-full" />
          <div className="skeleton h-3 w-16 rounded-full" />
          <div className="skeleton h-3 w-16 rounded-full" />
          <div className="skeleton hidden h-3 w-16 rounded-full md:block" />
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** `n` list rows with no frame of their own: inside a card, under its CardHeader. */
export function SkeletonList({ n = 4, label = "กำลังโหลด…" }: { n?: number; label?: string }) {
  return (
    <div role="status" className="divide-y divide-border">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} aria-hidden className="flex items-center gap-3 px-4 py-3">
          <div className="skeleton h-8 w-8 shrink-0 rounded-md" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 w-3/4 rounded-full" />
            <div className="skeleton h-2.5 w-1/2 rounded-full opacity-70" />
          </div>
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

/**
 * A list that has a detail pane beside it on lg (the recipes page): the table outline in the list
 * column and the outline of the empty pane on the right, on the same tracks as Studio's two-pane
 * grid, so nothing jumps sideways when the list arrives. Below lg it is just the table outline.
 */
export function SkeletonListPane({ n = 8, label = "กำลังโหลด…" }: { n?: number; label?: string }) {
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-6 xl:grid-cols-[minmax(0,30rem)_minmax(0,1fr)]">
      <SkeletonRows n={n} label={label} />
      <div aria-hidden className="hidden flex-col items-center gap-3 rounded-xl border border-border bg-panel px-4 py-10 shadow-card lg:flex">
        <div className="skeleton h-10 w-10 rounded-full" />
        <div className="skeleton h-4 w-48 max-w-full rounded-full" />
        <div className="skeleton h-3 w-72 max-w-full rounded-full opacity-70" />
      </div>
    </div>
  );
}

/** `n` cards with a title bar and a few list rows; `className` sets the grid they sit in. */
export function SkeletonCards({ n = 6, label = "กำลังโหลด…", className = "" }: { n?: number; label?: string; className?: string }) {
  return (
    <div role="status" className={className}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} aria-hidden className="rounded-xl border border-border bg-panel shadow-card">
          <div className="border-b border-border px-4 py-3.5">
            <div className="skeleton h-4 w-40 max-w-full rounded-full" />
          </div>
          {Array.from({ length: 4 }, (_, j) => (
            <div key={j} className="flex items-center gap-3 px-4 py-3">
              <div className="skeleton h-8 w-8 shrink-0 rounded-md" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3 w-3/4 rounded-full" />
                <div className="skeleton h-2.5 w-1/2 rounded-full opacity-70" />
              </div>
              <div className="skeleton h-3 w-12 rounded-full" />
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
 * top bar and, on phones, the tab bar stay put, with the user menu as a grey placeholder), then the
 * outline of a PageHeader (title, description, chips, buttons, the gold divider), a row of controls
 * and a table.
 *
 * `emblem` (the route loader, app/loading.tsx) shows the moon and the label in place of the
 * eyebrow line, so a slow page says in words that it is on its way.
 *
 * `pane` (the recipes page) draws the table as SkeletonListPane: on lg the list on the left and the
 * outline of the empty detail pane on the right, as Studio lays them out.
 */
export function PageSkeleton({
  width = "wide",
  rows = 8,
  label = "กำลังโหลดหน้า…",
  emblem = false,
  pane = false,
}: {
  width?: PageWidth;
  rows?: number;
  label?: string;
  emblem?: boolean;
  pane?: boolean;
}) {
  return (
    <Page user={null} loading width={width}>
      <div aria-hidden className="mb-4 md:mb-6">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="space-y-2.5">
            {emblem ? (
              <div className="flex items-center gap-2 text-xs text-faint">
                <Emblem size={18} />
                {label}
              </div>
            ) : (
              <div className="skeleton h-3 w-24 rounded-full opacity-70" />
            )}
            <div className="skeleton h-8 w-56 max-w-full rounded-lg" />
            <div className="skeleton h-3.5 w-80 max-w-full rounded-full opacity-70" />
            <div className="flex gap-1.5 pt-1">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="skeleton h-5 w-20 rounded-full opacity-70" />
              ))}
            </div>
          </div>
          <div className="hidden gap-2 md:flex">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="skeleton h-9 w-24 rounded-lg" />
            ))}
          </div>
        </div>
        <Divider className="mt-4 opacity-60" />
      </div>
      <div aria-hidden className="mb-3 flex flex-wrap gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="skeleton h-10 w-32 rounded-lg md:h-9" />
        ))}
      </div>
      {pane ? <SkeletonListPane n={rows} label={label} /> : <SkeletonRows n={rows} label={label} />}
    </Page>
  );
}
