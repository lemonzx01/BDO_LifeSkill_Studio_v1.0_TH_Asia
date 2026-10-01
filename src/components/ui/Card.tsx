import type { ReactNode } from "react";

/**
 * Panels. Gold is kept for the one card per page that asks the member to act (tone "highlight");
 * every other card has a plain border and a plain title.
 */
export type CardTone = "default" | "highlight";

const CARD: Record<CardTone, string> = {
  default: "rounded-lg border border-border bg-panel",
  highlight: "rounded-lg border border-accent/40 bg-panel",
};
const TITLE: Record<CardTone, string> = {
  default: "text-sm font-semibold text-foreground",
  highlight: "text-sm font-semibold text-accent",
};

/** The card look as a class string, for an element that must stay itself (e.g. a <form>). */
export function cardCls(tone: CardTone = "default"): string {
  return CARD[tone];
}

export function Card({
  tone = "default",
  as: Tag = "section",
  className = "",
  children,
}: {
  tone?: CardTone;
  as?: "section" | "aside" | "div";
  /** spacing and padding, e.g. "mt-4 p-3" */
  className?: string;
  children: ReactNode;
}) {
  return <Tag className={`${CARD[tone]} ${className}`}>{children}</Tag>;
}

/**
 * Title bar of a card: a title, an optional grey hint under it and an optional action on the
 * right (a btn("ghost", "sm") link such as "ดูทั้งหมด →"). Pass the card's tone so only a
 * highlight card gets a gold title.
 */
export function CardHeader({
  title,
  hint,
  action,
  tone = "default",
  as: Heading = "h2",
}: {
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  tone?: CardTone;
  as?: "h2" | "h3" | "h4";
}) {
  return (
    <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
      <div className="min-w-0">
        <Heading className={TITLE[tone]}>{title}</Heading>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      {action && <div className="-my-1.5 shrink-0">{action}</div>}
    </header>
  );
}

/**
 * A small grey label over a group inside a card. No uppercase or wide tracking: neither does
 * anything for Thai, and wide tracking pulls Thai letters apart.
 */
export function SectionLabel({ as: Tag = "h3", className = "", children }: { as?: "h2" | "h3" | "h4" | "div"; className?: string; children: ReactNode }) {
  return <Tag className={`text-xs font-semibold text-muted ${className}`}>{children}</Tag>;
}
