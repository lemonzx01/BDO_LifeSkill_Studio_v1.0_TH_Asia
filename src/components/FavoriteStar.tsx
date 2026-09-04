"use client";

import type { ItemId } from "@/lib/engine/types";
import { useUserData } from "./UserDataProvider";

/** Star toggle for "ของที่ฉันเฝ้า"; safe inside clickable rows (stops the click from opening the row). */
export function FavoriteStar({ id, size = "text-base" }: { id: ItemId; size?: string }) {
  const { favorites, toggleFavorite } = useUserData();
  const on = favorites.includes(id);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        toggleFavorite(id);
      }}
      className={`shrink-0 leading-none ${size} ${on ? "text-accent" : "text-muted/50 hover:text-accent"}`}
      title={on ? "เอาออกจากของที่เฝ้า" : "ปักดาวไว้ดูบนหน้าแรก"}
      aria-pressed={on}
      aria-label={on ? "เอาออกจากของที่เฝ้า" : "ปักดาว"}
    >
      {on ? "★" : "☆"}
    </button>
  );
}
