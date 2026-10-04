import type { ReactNode } from "react";
import { ROLE_TH } from "@/lib/auth/roles";
import type { Role } from "@/lib/db/schema";
import { Icon, type IconName } from "./Icon";

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
 * - copper  a category, not a status (the life skill a recipe belongs to: แปรธาตุ, ทำอาหาร …)
 * - special user overrides only (กำหนดเอง, บังคับซื้อ / บังคับทำเอง)
 */
export type BadgeTone = "good" | "bad" | "warn" | "info" | "accent" | "neutral" | "copper" | "special";

// full literal strings: Tailwind cannot see class names built at runtime
const TONE: Record<BadgeTone, string> = {
  good: "bg-good/14 text-good ring-good/25",
  bad: "bg-bad/14 text-bad ring-bad/25",
  warn: "bg-warn/14 text-warn ring-warn/25",
  info: "bg-info/14 text-info ring-info/25",
  accent: "bg-accent/14 text-accent ring-accent/25",
  neutral: "bg-panel-2 text-muted ring-border",
  copper: "bg-copper/14 text-copper ring-copper/25",
  special: "bg-special/14 text-special ring-special/25",
};

// the text-xs line height from globals.css (no leading-tight): marks above and below a Thai line
// stay inside the pill
const SHAPE = "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset";
/**
 * The same pill, allowed to wrap: for a long label on a narrow phone card. A wrapped pill is
 * rounded-xl, not rounded-full, or its second line would run into the curve.
 */
const SHAPE_WRAP = "inline-flex max-w-full items-center gap-1 rounded-xl px-2 py-0.5 text-xs font-medium ring-1 ring-inset";

/** Class string for a pill, for an element that is not a plain <span> (e.g. a pill-shaped button). */
export function badgeCls(tone: BadgeTone): string {
  return `${SHAPE} ${TONE[tone]}`;
}

/**
 * A small status pill. `icon` puts a 14px icon before the text (e.g. trending-up on a trend pill);
 * the words still carry the meaning, the icon only helps the eye.
 */
export function Badge({
  tone = "neutral",
  wrap = false,
  title,
  icon,
  className = "",
  children,
}: {
  tone?: BadgeTone;
  wrap?: boolean;
  title?: string;
  icon?: IconName;
  /** spacing only, e.g. "ml-1" */
  className?: string;
  children: ReactNode;
}) {
  return (
    <span title={title} className={`${wrap ? SHAPE_WRAP : SHAPE} ${TONE[tone]} ${className}`}>
      {icon && <Icon name={icon} className="h-3.5 w-3.5" strokeWidth={2} />}
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
