/** Spinner block used while recipes/prices are still being fetched. */
export function Loading({ text = "กำลังโหลด…", className = "" }: { text?: string; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-panel px-4 py-14 text-sm text-muted ${className}`} role="status" aria-live="polite">
      <span className="h-9 w-9 animate-spin rounded-full border-4 border-border border-t-accent" aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}
