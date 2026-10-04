import Link from "next/link";
import type { ReactNode } from "react";
import { APP_NAME, APP_SHORT } from "@/lib/brand";
import { cardCls } from "../ui/Card";
import { BRAND_LINE, Emblem } from "../ui/Emblem";

/**
 * A single centred card with no app navigation, for /login, /setup and the forced password change
 * on /account (every other page sends a member there until it is done). Signed-in pages use
 * <Page> from components/ui instead.
 *
 * Above the card, the brand as a crest (the framed moon over the wordmark), which links home. In the
 * card: an optional gold eyebrow (e.g. "ตั้งค่าครั้งแรก"), the Taviraj title (the page's only h1), a
 * grey line on what to do, then the form, whose one gold button is the card's action.
 */
export function AuthCard({ eyebrow, title, subtitle, children }: { eyebrow?: string; title: string; subtitle?: string; children: ReactNode }) {
  return (
    // the column centres itself in the space left under the status bar; a long form just grows it
    <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10 md:py-16">
      <Link href="/" aria-label={APP_NAME} className="mx-auto mb-6 flex flex-col items-center gap-2.5 rounded-lg text-center">
        <Emblem size={36} framed />
        <span className="flex flex-col">
          <span className="font-display text-lg font-semibold text-foreground">{APP_SHORT}</span>
          <span className="text-xs text-muted">{BRAND_LINE}</span>
        </span>
      </Link>
      <div className={`${cardCls()} w-full p-5 sm:p-6`}>
        <div className="text-center">
          {eyebrow && <p className="mb-1 text-xs font-medium text-accent/90">{eyebrow}</p>}
          {/* wrap-anywhere: a long display name in the title (บัญชีของ …) breaks instead of widening the card */}
          <h1 className="font-display text-display font-semibold text-balance wrap-anywhere text-foreground">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-balance text-muted">{subtitle}</p>}
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}
