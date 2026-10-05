import { APP_NAME } from "@/lib/brand";

/**
 * The small line that goes with the wordmark (APP_SHORT) in the top bar and over the sign-in card:
 * the site name without "by <short name> …" ("BDO Life"). Kept here, next to the mark, so both
 * places show the same words.
 */
export const BRAND_LINE = APP_NAME.split(" by ")[0];

/**
 * The site's mark ("BDO Life by BloodMoon TH"): a gold crescent moon with a thin copper rim on its
 * inner edge (the blood-moon hint) and a small four-point star in its curve.
 *
 * Only three places: next to the wordmark in the top bar, on the sign-in card, and on the loading
 * screen (a plain 18px mark in the skeleton's top bar). Decorative by default (the brand name is
 * written next to it); pass `label` where it stands alone. `framed` sets it in a round panel disc
 * with a faint gold ring, for the sign-in card.
 */
export function Emblem({
  size = 24,
  framed = false,
  label,
  className = "",
}: {
  /** the moon's width and height in px (the frame adds about 60% around it) */
  size?: number;
  framed?: boolean;
  label?: string;
  /** spacing only */
  className?: string;
}) {
  const mark = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={framed ? "shrink-0" : `shrink-0 ${className}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {label && <title>{label}</title>}
      {/* the crescent: a circle of r 9 with a bite of r ~6.4 taken out of its upper right */}
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" className="fill-accent" />
      {/* the bite's edge, drawn again in copper */}
      <path d="M12 3a6 6 0 0 0 9 9" fill="none" className="stroke-copper" strokeWidth={1.25} strokeLinecap="round" />
      {/* the star, inside the curve */}
      <path d="M16.5 4.6 17.3 6.7 19.4 7.5 17.3 8.3 16.5 10.4 15.7 8.3 13.6 7.5 15.7 6.7Z" className="fill-accent" />
    </svg>
  );
  if (!framed) return mark;
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-panel-2 shadow-card ring-1 ring-accent/30 ${className}`}
      style={{ width: Math.round(size * 1.6), height: Math.round(size * 1.6) }}
    >
      {mark}
    </span>
  );
}
