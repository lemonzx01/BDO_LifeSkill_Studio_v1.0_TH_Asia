import { btnShape, toggleCls } from "./button";

/**
 * "กำลังดู: X ✕": the list shows one item (or a few) whatever the filters say, e.g. after a link
 * from the home page or quick search. Pressing it goes back to the filters, which were never changed.
 * The same look and words on /recipes and /market.
 */
export function FocusChip({ name, count, onClose, className = "" }: { name: string; count?: number; onClose: () => void; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${className}`}>
      <button type="button" onClick={onClose} className={`${btnShape("sm")} ${toggleCls(true)} max-w-full`}>
        <span className="min-w-0 truncate">
          กำลังดู: {name}
          {count !== undefined && count > 1 ? ` (${count} รายการ)` : ""}
        </span>
        <span aria-hidden>✕</span>
        <span className="sr-only"> กลับไปใช้ตัวกรองที่ตั้งไว้</span>
      </button>
      <span aria-hidden className="text-xs text-muted">
        กด ✕ เพื่อกลับไปใช้ตัวกรองที่ตั้งไว้
      </span>
    </div>
  );
}

/** The phone-only "ตัวกรอง • n" button that folds the second filter row away; n = filters changed from the defaults. */
export function FilterToggle({ open, count, controls, onClick }: { open: boolean; count: number; controls: string; onClick: () => void }) {
  return (
    <button type="button" aria-expanded={open} aria-controls={controls} onClick={onClick} className={`${btnShape()} ${toggleCls(open)} shrink-0 md:hidden`}>
      ตัวกรอง
      {count > 0 && (
        <span className="num">
          <span aria-hidden>• </span>
          {count}
          <span className="sr-only"> ที่เปลี่ยนไว้</span>
        </span>
      )}
    </button>
  );
}

/** The second filter row: folded away on phones until ตัวกรอง opens it as a card, always shown from md up. */
export function filterPanelCls(open: boolean): string {
  return open
    ? "flex flex-wrap items-center gap-2 rounded-lg border border-border bg-panel p-3 md:mt-2 md:rounded-none md:border-0 md:bg-transparent md:p-0"
    : "hidden flex-wrap items-center gap-2 md:mt-2 md:flex";
}
