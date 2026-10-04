import { btnShape, toggleCls } from "./button";
import { Icon } from "./Icon";

/**
 * "กำลังดู: X (x)": the list shows one item (or a few) whatever the filters say, e.g. after a link
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
        <Icon name="x" className="h-3.5 w-3.5" strokeWidth={2} />
        <span className="sr-only"> กลับไปใช้ตัวกรองที่ตั้งไว้</span>
      </button>
      <span aria-hidden className="inline-flex items-center gap-1 text-xs text-faint">
        กด <Icon name="x" className="h-3 w-3" strokeWidth={2} /> เพื่อกลับไปใช้ตัวกรองที่ตั้งไว้
      </span>
    </div>
  );
}

/**
 * The phone-only "ตัวกรอง n" button that folds the second filter row away; n = filters changed from
 * the defaults, shown as a small gold count.
 */
export function FilterToggle({ open, count, controls, onClick }: { open: boolean; count: number; controls: string; onClick: () => void }) {
  return (
    <button type="button" aria-expanded={open} aria-controls={controls} onClick={onClick} className={`${btnShape()} ${toggleCls(open)} shrink-0 md:hidden`}>
      <Icon name="sliders" className="h-4 w-4" />
      ตัวกรอง
      {count > 0 && (
        <span className="num inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-semibold text-on-accent">
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
    ? "flex flex-wrap items-center gap-2 rounded-xl border border-border bg-panel p-3 shadow-card md:mt-2 md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none"
    : "hidden flex-wrap items-center gap-2 md:mt-2 md:flex";
}
