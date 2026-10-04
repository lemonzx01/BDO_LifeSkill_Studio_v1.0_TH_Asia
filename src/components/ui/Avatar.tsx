/** The avatar letter: skip a leading Thai vowel (เ แ โ ใ ไ), so "เจ้าพ่อ" shows จ, not เ. */
export function initial(name: string): string {
  const chars = Array.from(name.trim().replace(/^[เ-ไ]+/, ""));
  return (chars[0] ?? Array.from(name.trim())[0] ?? "?").toUpperCase();
}

/**
 * A member's avatar: a round disc with the first letter of the display name, the same in the
 * account menu and the admin members list. Decorative (aria-hidden): the name is always written
 * next to it or on the button around it. `admin` gives it a gold ring; `dim` fades it (a disabled
 * account, whose pill says so in words). 36px; `className` may resize it, e.g. "md:h-8 md:w-8".
 */
export function Avatar({ name, admin = false, dim = false, className = "" }: { name: string; admin?: boolean; dim?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-panel-3 text-sm font-semibold text-foreground ${
        admin ? "ring-2 ring-accent/70" : "ring-1 ring-border-strong"
      } ${dim ? "opacity-50" : ""} ${className}`}
    >
      {initial(name)}
    </span>
  );
}
