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
  const [failed, setFailed] = useState(false);
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
      src={`/icons/items/${id}.webp`}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`rounded bg-panel-2 ring-1 ${ring}`}
      style={{ width: size, height: size }}
    />
  );
}
