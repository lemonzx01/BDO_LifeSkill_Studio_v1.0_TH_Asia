/**
 * Shown the moment a link is clicked, while the server renders the next page.
 * A grey outline of a typical page (header, toolbar, table rows) reads as
 * "already loading" better than a spinner does.
 */
export default function RouteLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl animate-pulse px-3 py-4 md:px-6" role="status" aria-label="กำลังโหลดหน้า">
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
      <div className="rounded-lg border border-border bg-panel">
        <div className="h-9 rounded-t-lg bg-panel-2/80" />
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 border-t border-border/60 px-3 py-2.5">
            <div className="h-7 w-7 rounded bg-panel-2" />
            <div className="h-3 flex-1 rounded bg-panel-2" />
            <div className="h-3 w-16 rounded bg-panel-2" />
            <div className="h-3 w-16 rounded bg-panel-2" />
            <div className="hidden h-3 w-16 rounded bg-panel-2 md:block" />
          </div>
        ))}
      </div>
      <span className="sr-only">กำลังโหลด…</span>
    </main>
  );
}
