# BDO LifeSkill Studio — Design System (MASTER)

Direction: **"Adventurer's Ledger" (สมุดนักผจญภัย)**. A warm, dark, candle-lit ledger for
life-skillers: antique gold on near-black brown, a Thai serif for titles, a clean Thai sans for
everything you read and type. It should feel like Black Desert's world (Calpheon ledgers, guild
books), not like a generic SaaS dashboard, and it must stay **simple to use** (the owner's top
request: ใช้งานง่าย ไม่ซับซ้อน).

Sources: built with the ui-ux-pro-max skill. Its style DB has no fantasy/RPG style, so the palette
is derived from its closest profiles (Theater/Cinema "dramatic dark + gold", Luxury "premium dark +
gold", Financial Dashboard "dark + green positives") and its Quick Reference rules (§1–§9). Every
text colour below was checked for WCAG contrast (numbers in brackets = ratio on `--panel`).

Pages read this file first. A page file in `pages/` (if any) overrides it for that page only.

---

## 1. Principles

1. **One job per screen, answered at the top.** The first thing on each page answers what the
   member came for (home: what to craft now; recipe: is it worth it; market: what moved).
2. **Numbers are the hero.** Profit, cost and price are large, tabular, right-aligned and coloured
   by meaning (good / bad), never decoration.
3. **Gold means "act here" or "you are here".** Primary button, active nav item, focus ring, the
   one highlight card per page. Not for borders everywhere, not for every title.
4. **Quiet chrome, rich content.** Surfaces are flat warm panels with a soft shadow. Ornament (the
   gold divider, the emblem) is used sparingly: page header and brand only.
5. **Same features, same flows.** This is a visual remodel. Every control, route, label meaning,
   aria attribute and data flow stays; layout and hierarchy may change.

## 2. Colour tokens (dark only, `color-scheme: dark`)

Existing token names are kept so every `bg-panel`, `text-muted`, `border-border` … in the code
picks up the new look. New tokens are marked NEW.

| Token (CSS var → Tailwind) | Hex | Use |
|---|---|---|
| `--background` → `bg-background` | `#12100D` | page canvas |
| `--panel` → `bg-panel` | `#1C1813` | cards, bars, dialogs |
| `--panel-2` → `bg-panel-2` | `#262019` | fields, row hover, nested blocks, neutral pills |
| `--panel-3` → `bg-panel-3` NEW | `#30281F` | hover on panel-2, pressed |
| `--border` → `border-border` | `#3A3024` | hairlines, card borders, dividers |
| `--border-strong` → `border-border-strong` NEW | `#57493A` | emphasized divider, hovered card |
| `--border-field` → `border-border-field` NEW | `#806E55` | resting border of inputs/selects/checkbox (3.6:1 on panel, ≥3:1 rule for controls) |
| `--foreground` → `text-foreground` | `#EFE7D8` | body text [14.4] |
| `--muted` → `text-muted` | `#B3A791` | secondary text, labels [7.4] |
| `--faint` → `text-faint` NEW | `#9A8E78` | placeholders, captions, metadata only [5.5; 5.0 on panel-2] |
| `--accent` → `accent` | `#D9A845` | antique gold [8.1] |
| `--accent-hover` → `accent-hover` | `#E6BC62` | hover of gold fills |
| `--on-accent` → `text-on-accent` NEW | `#1E1608` | text on a gold fill [8.2] |
| `--copper` → `copper` NEW | `#D08250` | secondary warm accent: categories, chart 2nd series [5.9] |
| `--good` → `good` | `#9CCB8F` | profit, ok, in stock [9.5] |
| `--bad` → `bad` | `#E58A78` | loss, error, missing [6.9] |
| `--warn` → `warn` | `#EDA25B` | caution, sold out [8.3] |
| `--info` → `info` | `#8FB8D8` | info, buy signal, source [8.4] |
| `--special` → `special` | `#C4A6E0` | user overrides only [8.3] |
| `--accent-glow` | `rgb(217 168 69 / 0.08)` | the page glow behind the header |

Rules
- Never raw hex in components; use the tokens. Tints are `bg-good/12`, `bg-accent/10`, etc.
- Meaning never by colour alone: a sign (+/−), a word or an icon goes with good/bad/warn.
- Copper never touches gold as the two parts of one bar or stack: the pair is too close to tell
  apart even with full colour vision (ΔE ≈ 10, under the floor of 15). A two-part split is gold +
  `info`; copper is for separate marks (a category pill, a second line with its own markers).
- Focus ring: `outline: 2px solid var(--accent); outline-offset: 2px` (global), fields use
  `focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30`.
- `themeColor` (viewport) and the web manifest use `#12100D`.

## 3. Typography

| Role | Font | Size / weight / line-height |
|---|---|---|
| Display: page h1 | **Taviraj** (`font-display`) | 26px → md 30px, 600, 1.35 |
| Section/card title (h2/h3) | Taviraj | 17–18px, 600, 1.4 |
| Big number (stat tile, hero profit) | **Anuphan** + `num` | 22–32px, 600 |
| Body / UI | **Anuphan** (`font-sans`, default) | 14–16px, 400; labels 500 |
| Small / meta | Anuphan | 12–13px (never < 12px), line-height from globals (1.125rem/1.375rem) |

- Load both with `next/font/google` in `src/app/layout.tsx`: Taviraj weights 500/600/700 →
  `--font-display`; Anuphan (variable wght) → `--font-body`. Subsets `thai`, `latin`.
  Tailwind: `--font-sans: var(--font-body), system-ui, sans-serif` and
  `--font-display: var(--font-display), var(--font-body), serif` in `@theme inline`.
- **Taviraj only at 16px and up** (its loops get muddy smaller). Never for numbers in tables,
  never for body text, buttons, fields or pills.
- Thai rules: no `uppercase`, no wide `tracking-*`, no `leading-tight`/`leading-none` on text that
  can wrap (stacked vowels/tone marks clip). Headings may use `text-balance`.
- Numbers: every number column/value gets `num` (tabular figures) and right alignment in tables.

## 4. Shape, depth, spacing

- Radius: controls `rounded-lg` (8px); cards, dialogs, menus `rounded-xl` (12px); pills `rounded-full`.
- Card: `rounded-xl border border-border bg-panel shadow-card`. Define in globals.css
  `--shadow-card: inset 0 1px 0 rgb(255 255 255 / 0.035), 0 1px 2px rgb(0 0 0 / 0.35), 0 10px 24px -14px rgb(0 0 0 / 0.6)`
  and `--shadow-pop: 0 16px 40px -12px rgb(0 0 0 / 0.7), 0 2px 6px rgb(0 0 0 / 0.4)` (menus, dialogs, toasts),
  exposed as Tailwind `shadow-card` / `shadow-pop` (`--shadow-card`, `--shadow-pop` in `@theme`).
- Highlight card (the one "act here" card per page): `border-accent/45`, plus a 1px gold hairline
  along the top (`before:` gradient from transparent → accent/70 → transparent), title in accent.
- Interactive card/row hover: `hover:border-border-strong hover:bg-panel-2` (colour only, no
  layout shift, `transition-colors duration-150`).
- Spacing: 4/8 rhythm. Page gutter `px-4 md:px-6`; card padding `p-4` (dense lists `px-4 py-3`);
  gap between page sections `space-y-4 md:space-y-6`.
- Max widths: wide pages `max-w-7xl`, reading/forms `max-w-5xl` (narrow), auth cards `max-w-md`.

## 5. Ornament and brand

- **Emblem** (`ui/Emblem.tsx`): the site is "BDO Life by BloodMoon TH", so the mark is a
  **crescent moon** (gold stroke/fill, 24×24 inline SVG) with a small diamond/star beside it; the
  inner edge of the crescent may carry a thin `copper` stroke (the "blood moon" hint). Used in the
  top bar next to the wordmark, on the auth card and on the loading screen. Nowhere else.
- **Wordmark**: `APP_SHORT` ("BloodMoon") from `@/lib/brand` in Taviraj 600 foreground, with a
  small `text-xs text-muted` "BDO Life" line under or beside it on md+. Never hard-code the names.
- **Ledger divider** (`<Divider />` in `ui/Divider.tsx`): a 1px line fading from transparent to
  `accent/50` and back, with a 6px rotated-square diamond in the middle. Used under the page header
  (`PageHeader` renders it) and between the 2–3 major parts of a long page. Not inside cards.
- **Page glow**: body background = a soft radial `--accent-glow` at the top over `--background`,
  plus a faint vignette at the bottom (`radial-gradient(… rgb(0 0 0 / 0.35))`). No images, no noise.

## 6. Icons

- One in-house set: `src/components/ui/Icon.tsx`, `<Icon name="…" className="h-5 w-5" />`.
  Lucide-style 24×24 grid, `fill="none" stroke="currentColor" strokeWidth={1.75}`, round caps/joins.
  (Path data may follow Lucide, ISC licence — note it in the file header.) No icon library dependency.
- Decorative next to text: `aria-hidden`. Icon-only button: `aria-label` on the button.
- Sizes: 16px inline in text/pills, 20px in buttons and nav, 24px max decorative.
- **No emoji or text glyphs as icons** (replace ⚠︎ ℹ︎ ✓ ⊘ ★ ☆ → ← etc. used as icons with Icon).
  A plain arrow inside link copy like "ดูทั้งหมด" should become the chevron/arrow Icon.
- Minimum set: home, book (recipes), calculator, scale/chart (market), package (inventory), user,
  settings, shield (admin), chart-bar (stats), search, x, check, plus, minus, trash, edit, star,
  star-filled (fill=currentColor variant), info, alert-triangle, alert-circle, check-circle,
  chevron-down/up/left/right, arrow-right, arrow-up-right, external-link, refresh, download,
  upload, log-out, filter, sliders, coins, clock, flask (alchemy), cooking-pot (cooking), hammer
  (processing), sparkles, eye, eye-off, copy, menu, help-circle, trending-up, trending-down.

## 7. Components (shared primitives in `src/components/ui/`)

Keep every export name and prop; restyle and extend.

- **Buttons** (`button.ts`): `rounded-lg font-medium transition-colors duration-150`,
  min height 40px phone / 36px md (`md`), 36/32px (`sm`). Variants:
  primary = `bg-accent text-on-accent hover:bg-accent-hover shadow-sm`; secondary =
  `border border-border-strong bg-panel-2 text-foreground hover:bg-panel-3`; ghost =
  `text-muted hover:bg-panel-2 hover:text-foreground`; danger = `border border-bad/45 bg-bad/12
  text-bad hover:bg-bad/20`; dangerGhost unchanged in spirit. One primary per view.
  `toggleCls(on)`: on = `border-accent/60 bg-accent/12 text-accent`, off = secondary look.
- **Fields** (`field.ts`): `rounded-lg border border-border-field bg-panel-2 placeholder:text-faint`,
  heights as now; checkbox `accent-accent` 18px.
- **Card / CardHeader / SectionLabel**: card per §4; CardHeader title Taviraj 17px 600, hint
  `text-xs text-muted`; header separated by `border-b border-border`. SectionLabel: Anuphan 12px
  500 `text-muted` (no serif at that size).
- **PageHeader**: optional small eyebrow line (`text-xs text-accent/90`, e.g. section name) above
  the Taviraj h1, description `text-sm text-muted max-w-prose`, meta chips, actions right; then
  `<Divider />` with `mt-4`. Keep the props; `eyebrow?: ReactNode` is NEW and optional.
- **Badge**: `rounded-full px-2 py-0.5 text-xs font-medium`, tones as now with `/14` tints and a
  matching `ring-1 ring-inset ring-<tone>/25`; neutral = `bg-panel-2 text-muted ring-border`;
  `copper` = a category, not a status (the life skill of a recipe).
- **Notice**: `rounded-xl border` + tone tint, leading Icon (alert-circle / alert-triangle /
  check-circle / info) instead of glyphs; keep the spoken word, roles and actions.
- **Stat**: tile `rounded-xl border border-border bg-panel-2/60 p-3`; label `text-xs text-muted`;
  value Anuphan 600 `text-xl md:text-2xl num`; `emphasis` = gold value + `border-accent/40`.
- **Money**: unchanged logic; positive values that mean profit render `text-good`, negative
  `text-bad`, with the sign.
- **Tables / dense lists**: header row `text-xs font-medium text-muted bg-panel-2/70` sticky where
  it scrolls; rows `border-b border-border/70 hover:bg-panel-2/60`; numbers `num text-right`;
  first column item = ItemIcon + name. Zebra striping off. On phones: rows become stacked cards
  (name + main number on the first line, secondary facts below) — no horizontal page scroll.
- **Segmented / tabs**: track `rounded-lg bg-panel-2 p-1 border border-border`; active segment
  `bg-panel-3 text-foreground shadow-sm` with a 2px gold underline or gold text; others `text-muted`.
- **SearchInput**: field look + search Icon at left, clear (x) button at right (aria-label).
- **EmptyState**: centred, Icon in a 40px `rounded-full bg-panel-2 text-accent` disc, Taviraj
  title 17px, hint muted, optional action. Copy is an invitation, not an apology.
- **Skeleton**: `bg-panel-2` blocks with a slow shimmer (disabled under reduced motion).
- **Toast**: `rounded-xl bg-panel border border-border-strong shadow-pop`, tone Icon left,
  enters 200ms fade + 4px rise, exits faster; `aria-live="polite"`.
- **ConfirmDialog** (native `<dialog>`): `rounded-xl bg-panel border-border-strong shadow-pop`,
  backdrop `bg-black/60 backdrop-blur-[2px]`, Taviraj title, danger action uses danger variant.
- **InfoTip**: small `help-circle` Icon trigger (≥24px hit area), bubble `bg-panel-3 shadow-pop`.
- **Sparkline**: stroke `accent` (or good/bad by trend, or `muted` for a series whose direction is
  neither good nor bad by itself, such as listed stock), 1.5px, no fill or a 10% fill.
- **ItemIcon**: game item images sit in a `rounded-md bg-panel-2 ring-1 ring-border` frame;
  grade colours (if present) as a 1px inner ring.

## 8. App shell and navigation

- **Top bar** (all widths): sticky, `bg-background/85 backdrop-blur border-b border-border`
  (blur here is purposeful: content scrolls under it). Left: emblem + wordmark → `/`. Centre/left
  (md+): main nav links with Icon + label; active = `text-foreground` + 2px gold underline;
  inactive `text-muted hover:text-foreground`. Right: QuickSearch trigger (field-like button with
  search Icon and a `/` hint on desktop), SaveStatus, UserMenu (avatar disc with initial, gold
  ring when admin) or "เข้าสู่ระบบ" secondary button for guests.
- **Phone tab bar** (< md): fixed bottom, `bg-panel/95 backdrop-blur border-t border-border`,
  ≤ 5 items, Icon 22px over a 12px label, active = gold icon + label + small gold dot/bar;
  respects `env(safe-area-inset-bottom)`; targets ≥ 48px tall.
- Skip link stays first focusable element; `<main id="main">` stays.
- Menus/popovers: `rounded-xl bg-panel border-border-strong shadow-pop`, items 40px tall.

## 9. Motion

- Default `transition-colors duration-150 ease-out` on interactive elements.
- Enter animations only for overlays (dialog, toast, menu, drawer): 180–220ms, opacity + 4–8px
  translate; exit ~65% of enter. No scroll-reveal, no parallax, no looping animation except the
  skeleton shimmer and spinners. Everything off under `prefers-reduced-motion` (global rule).

## 10. Accessibility checklist (must pass)

- Text ≥ 4.5:1 (all tokens above pass on background/panel/panel-2; `faint` only for metadata).
- Control boundaries ≥ 3:1 (`border-field`), focus ring always visible, never removed.
- Touch targets ≥ 40px on phones (44 preferred), ≥ 8px apart; desktop ≥ 24px.
- Every icon-only control has an accessible name; decorative icons `aria-hidden`.
- Headings in order (one h1 per page = PageHeader); labels visible on every field.
- No horizontal page scroll at 375px; wide tables scroll inside their own card only if a stacked
  layout is impossible.

## 11. Page remodel notes

- **Home (`/`, Dashboard)**: hero row = greeting/eyebrow + "ตอนนี้ทำอะไรดี" with the top picks as
  large cards (ItemIcon 40px, name, category pill, profit/hour as the big good-coloured number,
  one action). Below: favourites, inventory ideas, onboarding (guests) as quieter cards.
- **Recipes (`/recipes`, Studio)**: two-pane on lg (list left, detail right); the detail opens with
  a verdict strip (profit, cost, ROI, sell price as Stat tiles) before the cost tree and plan.
- **Calculator (`/calc`, TradeCalc)**: inputs in a left/top form card, the result as a highlight
  card with the verdict sentence and the big number; secondary breakdown below.
- **Market (`/market`)**: filter toolbar card, then the scanner table (sticky header, sparkline
  column, trend pills); phones get stacked rows.
- **Inventory (`/inventory`)**: toolbar (search, import, add) then the item table; ideas panel as
  a side card on lg.
- **Account / Login / Setup / Help**: auth pages = centred card with emblem, Taviraj title, fields,
  one primary button; account = settings sections as cards; help = readable prose column
  (`max-w-prose`), Taviraj section titles, FAQ items as bordered rows.
- **Admin (`/admin`, `/admin/stats`)**: members table with role pills and row actions; stats keep
  the tiles, chart (accent line, copper secondary) and top pages list.
