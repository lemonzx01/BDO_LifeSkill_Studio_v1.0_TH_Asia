"use client";

import { useState } from "react";

const GRADE_RING: Record<number, string> = {
  0: "ring-zinc-600",
  1: "ring-emerald-500",
  2: "ring-sky-500",
  3: "ring-amber-400",
  4: "ring-orange-500",
  5: "ring-rose-500",
};

export function ItemIcon({ id, grade = 0, size = 32, alt = "" }: { id: number; grade?: number; size?: number; alt?: string }) {
  // one retry with a cache-busting query before giving up: a flaky connection while
  // hundreds of icons lazy-load should not leave a permanent "?"
  const [attempt, setAttempt] = useState(0);
  const failed = attempt >= 2;
  const ring = GRADE_RING[grade] ?? GRADE_RING[0];
  if (failed) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded bg-panel-2 text-[10px] text-muted ring-1 ${ring}`}
        style={{ width: size, height: size }}
      >
        ?
      </span>
    );
  }
  return (
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
      className={`rounded bg-panel-2 ring-1 ${ring}`}
      style={{ width: size, height: size }}
    />
  );
}
