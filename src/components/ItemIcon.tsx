"use client";

import { useState } from "react";
import { Icon } from "./ui/Icon";

/**
 * The game's item grade as a thin ring inside the frame (white items get none). These are the
 * game's own colours, not theme tokens; full literal strings, as Tailwind cannot see class names
 * built at runtime.
 */
const GRADE_RING: Record<number, string> = {
  0: "",
  1: "after:ring-emerald-400/70",
  2: "after:ring-sky-400/70",
  3: "after:ring-amber-300/75",
  4: "after:ring-orange-400/75",
  5: "after:ring-rose-400/75",
};

/**
 * A game item's picture in a small panel frame (rounded, a hairline ring), with the item grade as
 * a second, coloured ring just inside it. Decorative unless `alt` is given: the item name is
 * written next to it.
 */
export function ItemIcon({ id, grade = 0, size = 32, alt = "" }: { id: number; grade?: number; size?: number; alt?: string }) {
  // one retry with a cache-busting query before giving up: a flaky connection while
  // hundreds of icons lazy-load should not leave a permanent empty frame
  const [attempt, setAttempt] = useState(0);
  const failed = attempt >= 2;
  const ring = GRADE_RING[grade] ?? "";
  return (
    <span
      // the grade ring is drawn over the picture (::after), so a transparent icon edge cannot hide it
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-panel-2 ring-1 ring-border ${
        ring ? `after:pointer-events-none after:absolute after:inset-0 after:rounded-md after:ring-1 after:ring-inset ${ring}` : ""
      }`}
      style={{ width: size, height: size }}
    >
      {failed ? (
        // the picture would not load: an empty-box outline instead of a broken image
        <span role={alt ? "img" : undefined} aria-label={alt || undefined} className="flex h-full w-full items-center justify-center text-faint">
          <Icon name="package" className="h-[55%] w-[55%]" />
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={attempt}
          src={attempt === 0 ? `/icons/items/${id}.webp` : `/icons/items/${id}.webp?retry=${attempt}`}
          alt={alt}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          // icons must never compete with scripts and data for a slow connection
          fetchPriority="low"
          onError={() => setAttempt((a) => a + 1)}
          className="h-full w-full object-contain"
        />
      )}
    </span>
  );
}
