/**
 * The ledger divider: a hairline that fades in from nothing to gold and out again, with a small
 * gold diamond in the middle. Ornament, so it is hidden from screen readers.
 *
 * Use it under the page header (PageHeader draws one) and between the two or three major parts of
 * a long page. Not inside cards: there a plain `border-t border-border` is enough.
 */
export function Divider({ className = "" }: { /** spacing only, e.g. "my-6" */ className?: string }) {
  return (
    <div aria-hidden className={`flex items-center ${className}`}>
      <span className="h-px flex-1 bg-linear-to-r from-transparent to-accent/50" />
      <span className="mx-2.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-accent/80" />
      <span className="h-px flex-1 bg-linear-to-l from-transparent to-accent/50" />
    </div>
  );
}
