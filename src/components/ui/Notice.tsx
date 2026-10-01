import Link from "next/link";
import type { ReactNode } from "react";
import { btn } from "./button";

export type NoticeTone = "bad" | "warn" | "good" | "info";

const TONE: Record<NoticeTone, string> = {
  bad: "border-bad/40 bg-bad/10 text-bad",
  warn: "border-warn/40 bg-warn/10 text-warn",
  good: "border-good/40 bg-good/10 text-good",
  info: "border-info/40 bg-info/10 text-info",
};
// a glyph and a spoken word as well as the colour, so the meaning never rests on colour alone
// (︎ keeps ⚠ and ℹ as text glyphs instead of colour emoji)
const GLYPH: Record<NoticeTone, string> = { bad: "⊘", warn: "⚠︎", good: "✓", info: "ℹ︎" };
const WORD: Record<NoticeTone, string> = { bad: "ผิดพลาด", warn: "คำเตือน", good: "สำเร็จ", info: "หมายเหตุ" };

/**
 * A button, or a link (`href`). A link is a plain <a> by default, not <Link>, because most point at
 * downloads and API routes (e.g. the admin backup) that must not be prefetched or opened as a
 * client route. `route: true` marks a page of the app (e.g. /login): it opens client-side, which
 * keeps this tab's unsaved changes (lib/save-queue) alive.
 */
export type NoticeAction =
  | { label: string; onClick: () => void; disabled?: boolean }
  | { label: string; href: string; title?: string; route?: boolean };

/**
 * An error, warning or success message. Errors are announced at once (role="alert"), the other
 * tones politely (role="status"). Optional: one action button on the right and a × to close.
 */
export function Notice({
  tone,
  action,
  onClose,
  className = "",
  children,
}: {
  tone: NoticeTone;
  action?: NoticeAction;
  onClose?: () => void;
  /** spacing only, e.g. "mb-3" */
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role={tone === "bad" ? "alert" : "status"} className={`flex items-start gap-2 rounded border px-3 py-2 text-sm ${TONE[tone]} ${className}`}>
      <span aria-hidden className="w-4 shrink-0 text-center">
        {GLYPH[tone]}
      </span>
      <div className="min-w-0 flex-1">
        <span className="sr-only">{WORD[tone]}: </span>
        {children}
      </div>
      {action &&
        ("href" in action ? (
          action.route ? (
            <Link href={action.href} title={action.title} className={`${btn("secondary", "sm")} -my-1 shrink-0`}>
              {action.label}
            </Link>
          ) : (
            <a href={action.href} title={action.title} className={`${btn("secondary", "sm")} -my-1 shrink-0`}>
              {action.label}
            </a>
          )
        ) : (
          <button type="button" onClick={action.onClick} disabled={action.disabled} className={`${btn("secondary", "sm")} -my-1 shrink-0`}>
            {action.label}
          </button>
        ))}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิด"
          title="ปิด"
          className="-my-1 -mr-1.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded text-lg leading-none opacity-80 hover:bg-panel-2 hover:opacity-100 md:h-8 md:w-8"
        >
          ×
        </button>
      )}
    </div>
  );
}
