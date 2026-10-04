import Link from "next/link";
import type { ReactNode } from "react";
import { btn } from "./button";
import { Icon, type IconName } from "./Icon";

export type EmptyAction = { label: string; href: string } | { label: string; onClick: () => void };

/**
 * "Nothing here yet": an icon in a small gold-on-panel disc, what is missing (Taviraj), an optional
 * hint and an optional next step. Word it as an invitation ("เพิ่มของชิ้นแรก…"), not an apology.
 *
 * Inside a card it needs no frame of its own; standing alone, give it one with
 * className={cardCls()}. `compact` is for a small card or a table cell.
 */
export function EmptyState({
  title,
  hint,
  action,
  icon = "sparkles",
  compact = false,
  className = "",
}: {
  title: ReactNode;
  hint?: ReactNode;
  action?: EmptyAction;
  /** what the empty thing is about, e.g. "search" (no matches), "package" (empty inventory) */
  icon?: IconName;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center px-4 text-center ${compact ? "py-5" : "py-8"} ${className}`}>
      <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-full bg-panel-2 text-accent ring-1 ring-border">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <p className="mt-3 max-w-prose font-display text-title font-semibold text-balance text-foreground">{title}</p>
      {hint && <p className="mt-1 max-w-prose text-sm text-muted">{hint}</p>}
      {action && (
        <div className="mt-4">
          {"href" in action ? (
            <Link href={action.href} className={btn("secondary", "sm")}>
              {action.label}
            </Link>
          ) : (
            <button type="button" onClick={action.onClick} className={btn("secondary", "sm")}>
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
