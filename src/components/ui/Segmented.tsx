"use client";

import type { ReactNode } from "react";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  title?: string;
}

const ITEM_SIZE = {
  md: "min-h-9 md:min-h-8 px-3 text-sm",
  sm: "min-h-9 md:min-h-7 px-2.5 text-xs",
} as const;

/**
 * Pick one of a few in-page filters (recipe tabs, market modes, inventory sort). Scrolls sideways
 * inside itself on a narrow phone instead of pushing the page wider.
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  size = "md",
}: {
  /** what the group chooses, read out by screen readers */
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: keyof typeof ITEM_SIZE;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex max-w-full overflow-x-auto rounded border border-border bg-panel p-0.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            title={o.title}
            onClick={() => onChange(o.value)}
            // the focus ring sits inside the button: the scrolling group would clip one drawn outside
            className={`shrink-0 whitespace-nowrap rounded focus-visible:-outline-offset-2 focus-visible:outline-foreground ${ITEM_SIZE[size]} ${on ? "bg-accent font-medium text-black" : "text-muted hover:text-foreground"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
