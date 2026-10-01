import Link from "next/link";
import type { ReactNode } from "react";
import { btn } from "./button";

export type EmptyAction = { label: string; href: string } | { label: string; onClick: () => void };

/** "Nothing here": what is missing, an optional hint and an optional next step. */
export function EmptyState({ title, hint, action, className = "" }: { title: ReactNode; hint?: ReactNode; action?: EmptyAction; className?: string }) {
  return (
    <div className={`px-4 py-8 text-center text-sm text-muted ${className}`}>
      <p>{title}</p>
      {hint && <p className="mt-1 text-xs">{hint}</p>}
      {action && (
        <div className="mt-3">
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
