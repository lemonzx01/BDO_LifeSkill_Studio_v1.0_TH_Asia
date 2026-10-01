"use client";

import type { ItemId } from "@/lib/engine/types";
import { useUserData } from "./UserDataProvider";

/**
 * Star toggle for "ของที่ฉันเฝ้า"; safe inside clickable rows (stops the click from opening the row).
 * A 40px tap target on phones (32px from md up). Pass `name` so a screen reader hears which item
 * the star is for ("ปักดาว ยาอายุวัฒนะ…"), not just "ปักดาว" once per row.
 */
export function FavoriteStar({ id, name, size = "text-lg" }: { id: ItemId; name?: string; size?: string }) {
  const { favorites, toggleFavorite } = useUserData();
  const on = favorites.includes(id);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        toggleFavorite(id);
      }}
      // off: text-muted, not text-muted/50 (about 2.7:1 on the panel, under the 3:1 a control needs)
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded leading-none hover:bg-panel-2 md:h-8 md:w-8 ${size} ${on ? "text-accent" : "text-muted hover:text-accent"}`}
      title={on ? "เอาออกจากของที่เฝ้า" : "ปักดาวไว้ดูบนหน้าแรก"}
      // one fixed name; aria-pressed says whether it is on
      aria-pressed={on}
      aria-label={name ? `ปักดาว ${name}` : "ปักดาว"}
    >
      <span aria-hidden>{on ? "★" : "☆"}</span>
    </button>
  );
}
