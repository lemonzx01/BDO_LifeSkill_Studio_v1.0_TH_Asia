"use client";

import type { ItemId } from "@/lib/engine/types";
import { Icon } from "./ui/Icon";
import { useUserData } from "./UserDataProvider";

/**
 * Star toggle for "ของที่ฉันเฝ้า"; safe inside clickable rows (stops the click from opening the row).
 * A 40px tap target on phones (32px from md up). Pass `name` so a screen reader hears which item
 * the star is for ("ปักดาว ยาอายุวัฒนะ…"), not just "ปักดาว" once per row. `name` and `grade` are
 * also kept with a guest's star, so the home page can show an item the recipe data does not have.
 *
 * `size` is a text-size class: the star is drawn a little larger than that text (text-lg: 20px).
 */
export function FavoriteStar({ id, name, grade, size = "text-lg" }: { id: ItemId; name?: string; grade?: number; size?: string }) {
  const { favorites, toggleFavorite } = useUserData();
  const on = favorites.includes(id);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        toggleFavorite(id, { th: name, grade });
      }}
      // off: text-muted, not a fainter grey (a control needs 3:1 against the panel)
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 hover:bg-panel-2 md:h-8 md:w-8 ${size} ${
        on ? "text-accent" : "text-muted hover:text-accent"
      }`}
      title={on ? "เอาออกจากของที่เฝ้า" : "ปักดาวไว้ดูบนหน้าแรก"}
      // one fixed name; aria-pressed says whether it is on
      aria-pressed={on}
      aria-label={name ? `ปักดาว ${name}` : "ปักดาว"}
    >
      {/* filled when on, an outline when off: the shape says it as well as the colour */}
      <Icon name={on ? "star-filled" : "star"} className="h-[1.1em] w-[1.1em]" />
    </button>
  );
}
