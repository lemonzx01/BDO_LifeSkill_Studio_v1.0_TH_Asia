import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/**
 * Panels: flat warm surfaces with a soft shadow. Gold is kept for the one card per page that asks
 * the member to act (tone "highlight": a gold border, a thin gold light along the top edge and a
 * gold title); every other card has a plain border and a plain title.
 */
export type CardTone = "default" | "highlight";

// full literal strings: Tailwind cannot see class names built at runtime. min-w-0: a card in a grid
// or flex row may shrink to its track, so a truncated name inside it cannot widen the page
const CARD: Record<CardTone, string> = {
  default: "min-w-0 rounded-xl border border-border bg-panel shadow-card",
  highlight:
    "relative min-w-0 rounded-xl border border-accent/45 bg-panel shadow-card before:pointer-events-none before:absolute before:inset-x-3 before:-top-px before:h-px before:bg-linear-to-r before:from-transparent before:via-accent/70 before:to-transparent",
};
const TITLE: Record<CardTone, string> = {
  default: "font-display text-title font-semibold text-balance text-foreground",
  highlight: "font-display text-title font-semibold text-balance text-accent",
};

/** The card look as a class string, for an element that must stay itself (e.g. a <form>, a <Link>). */
export function cardCls(tone: CardTone = "default"): string {
  return CARD[tone];
}

/**
 * Add to a card or a row that is itself a link or a button: the border and the fill brighten on
 * hover (colour only, so nothing shifts). `${cardCls()} ${cardHoverCls} block p-4`
 */
export const cardHoverCls = "transition-colors duration-150 ease-out hover:border-border-strong hover:bg-panel-2";

export function Card({
  tone = "default",
  as: Tag = "section",
  id,
  className = "",
  children,
  ...aria
}: {
  tone?: CardTone;
  as?: "section" | "aside" | "div" | "article";
  /** an anchor for a #link to this card (e.g. the index on /help) */
  id?: string;
  /** spacing and padding, e.g. "mt-4 p-4" */
  className?: string;
  children: ReactNode;
  /** names a <section> or <aside> that has no CardHeader (a landmark needs a name) */
  "aria-label"?: string;
  "aria-labelledby"?: string;
}) {
  return (
    <Tag id={id} className={`${CARD[tone]} ${className}`} {...aria}>
      {children}
    </Tag>
  );
}

/**
 * Title bar of a card: a Taviraj title, an optional grey hint under it and an optional action on
 * the right (a btn("ghost", "sm") link such as "ดูทั้งหมด" with a chevron-right Icon). Pass the
 * card's tone so only a highlight card gets a gold title. `icon` puts a small icon before the
 * title (muted, gold on a highlight card).
 */
export function CardHeader({
  title,
  hint,
  action,
  icon,
  tone = "default",
  as: Heading = "h2",
  id,
}: {
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  icon?: IconName;
  tone?: CardTone;
  as?: "h2" | "h3" | "h4";
  /** the heading's id, for aria-labelledby on the card */
  id?: string;
}) {
  return (
    <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && <Icon name={icon} className={`mt-0.5 h-5 w-5 ${tone === "highlight" ? "text-accent" : "text-muted"}`} />}
        <div className="min-w-0">
          <Heading id={id} className={TITLE[tone]}>
            {title}
          </Heading>
          {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
        </div>
      </div>
      {action && <div className="-my-1 flex shrink-0 items-center gap-1">{action}</div>}
    </header>
  );
}

/**
 * A small grey label over a group inside a card: Anuphan 12px medium (no serif at this size). No
 * uppercase or wide tracking: neither does anything for Thai, and wide tracking pulls Thai
 * letters apart.
 */
export function SectionLabel({ as: Tag = "h3", className = "", children }: { as?: "h2" | "h3" | "h4" | "div"; className?: string; children: ReactNode }) {
  return <Tag className={`text-xs font-medium text-muted ${className}`}>{children}</Tag>;
}
