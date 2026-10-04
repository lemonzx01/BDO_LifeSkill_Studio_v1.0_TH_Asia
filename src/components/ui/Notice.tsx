import Link from "next/link";
import type { ReactNode } from "react";
import { btn, iconBtn } from "./button";
import { Icon, type IconName } from "./Icon";

export type NoticeTone = "bad" | "warn" | "good" | "info";

// full literal strings: Tailwind cannot see class names built at runtime
const TONE: Record<NoticeTone, string> = {
  bad: "border-bad/45 bg-bad/10",
  warn: "border-warn/45 bg-warn/10",
  good: "border-good/45 bg-good/10",
  info: "border-info/45 bg-info/10",
};
const ICON_TONE: Record<NoticeTone, string> = { bad: "text-bad", warn: "text-warn", good: "text-good", info: "text-info" };
// an icon and a spoken word as well as the colour, so the meaning never rests on colour alone
const ICON: Record<NoticeTone, IconName> = { bad: "alert-circle", warn: "alert-triangle", good: "check-circle", info: "info" };
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
 * An error, warning or success message: a tinted box with the tone's icon, the text in the normal
 * text colour. Errors are announced at once (role="alert"), the other tones politely
 * (role="status"). Optional: one action button on the right and an x to close.
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
    <div role={tone === "bad" ? "alert" : "status"} className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm text-foreground ${TONE[tone]} ${className}`}>
      <Icon name={ICON[tone]} className={`mt-px h-5 w-5 ${ICON_TONE[tone]}`} />
      {/* the action sits right of the text, or drops under it when a phone has no room for both */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1 basis-56">
          <span className="sr-only">{WORD[tone]}: </span>
          {children}
        </div>
        {action && (
          <div className="-my-1 shrink-0">
            {"href" in action ? (
              action.route ? (
                <Link href={action.href} title={action.title} className={btn("secondary", "sm")}>
                  {action.label}
                </Link>
              ) : (
                <a href={action.href} title={action.title} className={btn("secondary", "sm")}>
                  {action.label}
                </a>
              )
            ) : (
              <button type="button" onClick={action.onClick} disabled={action.disabled} className={btn("secondary", "sm")}>
                {action.label}
              </button>
            )}
          </div>
        )}
      </div>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="ปิด" title="ปิด" className={`${iconBtn("ghost", "sm")} -my-1.5 -mr-1.5`}>
          <Icon name="x" className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
