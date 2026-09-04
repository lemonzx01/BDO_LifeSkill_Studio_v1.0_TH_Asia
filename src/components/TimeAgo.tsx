"use client";

import { useEffect, useState } from "react";
import { timeAgo } from "@/lib/format";

/**
 * Relative time that only renders on the client (the server would print a
 * different number of seconds and trigger a hydration mismatch) and re-renders
 * every 30 seconds so "2 นาทีที่แล้ว" stays honest.
 */
export function TimeAgo({ at, placeholder = "…" }: { at: number | string | null | undefined; placeholder?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // first tick is deferred so the effect body itself does not set state
    const first = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);
  if (!at || now === null) return <>{placeholder}</>;
  const ts = typeof at === "string" ? new Date(at).getTime() : at;
  return <>{timeAgo(ts)}</>;
}
