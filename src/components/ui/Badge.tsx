import type { ReactNode } from "react";
import { ROLE_TH } from "@/lib/auth/roles";
import type { Role } from "@/lib/db/schema";

/**
 * One meaning-to-colour map for every pill in the app. Pick the tone by what the pill means,
 * never by the colour you would like:
 *
 * - good    profit, พร้อม, ขาดตลาด (the product sells instantly), ใช้งานได้, high recovery chance,
 *           trade signal, ในคลัง
 * - bad     ต้นทุนไม่ครบ / ไม่ทราบราคา, ปิดใช้งาน, low recovery chance
 * - warn    a material is sold out (วัตถุดิบหมด / ของหมด), เกินระดับ, รอตั้งรหัสใหม่, ต้องหาเอง,
 *           medium recovery chance
 * - info    buy signal, source ตลาด, ตามตลาด, admin role
 * - accent  ราชวัง, sell signal, owner role, ทำเอง
 * - neutral ค้างขาย N, NPC, ขายตลาดไม่ได้, ไม่มีราคาขาย, member role, ไม่พอข้อมูล
 * - special user overrides only (กำหนดเอง, บังคับซื้อ / บังคับทำเอง)
 */
export type BadgeTone = "good" | "bad" | "warn" | "info" | "accent" | "neutral" | "special";

// full literal strings: Tailwind cannot see class names built at runtime
const TONE: Record<BadgeTone, string> = {
  good: "bg-good/15 text-good",
  bad: "bg-bad/15 text-bad",
  warn: "bg-warn/15 text-warn",
  info: "bg-info/15 text-info",
  accent: "bg-accent/15 text-accent",
  neutral: "bg-panel-2 text-muted",
  special: "bg-special/15 text-special",
};

const SHAPE = "inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-xs leading-tight";
/**
 * The same pill, allowed to wrap: for a long label on a narrow phone card. No leading-tight here:
 * wrapped Thai lines need the taller text-xs line height from globals.css, or marks below one line
 * (ู) and above the next (ื้) touch.
 */
const SHAPE_WRAP = "inline-flex max-w-full items-center rounded px-1.5 py-0.5 text-xs";

/** Class string for a pill, for an element that is not a plain <span> (e.g. a pill-shaped button). */
export function badgeCls(tone: BadgeTone): string {
  return `${SHAPE} ${TONE[tone]}`;
}

export function Badge({
  tone = "neutral",
  wrap = false,
  title,
  className = "",
  children,
}: {
  tone?: BadgeTone;
  wrap?: boolean;
  title?: string;
  /** spacing only, e.g. "ml-1" */
  className?: string;
  children: ReactNode;
}) {
  return (
    <span title={title} className={`${wrap ? SHAPE_WRAP : SHAPE} ${TONE[tone]} ${className}`}>
      {children}
    </span>
  );
}

const ROLE_TONE: Record<Role, BadgeTone> = { owner: "accent", admin: "info", member: "neutral" };

export function RoleBadge({ role, className }: { role: Role; className?: string }) {
  return (
    <Badge tone={ROLE_TONE[role]} className={className}>
      {ROLE_TH[role]}
    </Badge>
  );
}
