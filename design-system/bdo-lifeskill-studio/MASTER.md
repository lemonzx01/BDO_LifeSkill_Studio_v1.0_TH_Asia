# BDO LifeSkill Studio — Design System (MASTER)

Direction: **"Adventurer's Ledger" (สมุดนักผจญภัย)**. A warm, dark, candle-lit ledger for
life-skillers: antique gold on near-black brown, a Thai serif for titles, a clean Thai sans for
everything you read and type. It should feel like Black Desert's world (Calpheon ledgers, guild
books), not like a generic SaaS dashboard, and it must stay **simple to use** (the owner's top
request: ใช้งานง่าย ไม่ซับซ้อน).

Sources: built with the third-party ui-ux-pro-max skill. Its style DB has no fantasy/RPG style, so
the palette is derived from its closest profiles (Theater/Cinema "dramatic dark + gold", Luxury
"premium dark + gold", Financial Dashboard "dark + green positives") and its Quick Reference rules
(§1–§9). Every text colour below was checked for WCAG contrast (numbers in brackets = ratio on
`--panel`). The skill is installed locally with its CLI; its bundles (`/.claude/skills/`,
`/.agents/`) are gitignored and eslint-ignored, so nothing in the app depends on it.

This file describes what is built. Pages read it first. A page file in `pages/` (none exist yet)
would override it for that page only. §12 maps every rule to the file that implements it.

---

## 1. Principles

1. **One job per screen, answered at the top.** The first thing on each page answers what the
   member came for (home: what to craft now; recipe: is it worth it; market: what moved).
2. **Numbers are the hero.** Profit, cost and price are large, tabular, right-aligned and coloured
   by meaning (good / bad), never decoration.
3. **Gold means "act here" or "you are here".** Primary button, active nav item, focus ring, the
   one highlight card per page. Not for borders everywhere, not for every title.
4. **Quiet chrome, rich content.** Surfaces are flat warm panels with a soft shadow. Ornament (the
   gold divider, the emblem) is used sparingly: the page header, the brand and the one break between
   the parts of the home page (§5).
5. **Same features, same flows.** This is a visual remodel. Every control, route, label meaning,
   aria attribute and data flow stays; layout and hierarchy may change.

## 2. Colour tokens (dark only, `color-scheme: dark`)

Defined on `:root` in `src/app/globals.css` and exposed to Tailwind in `@theme inline` as
`--color-<name>`, so every `bg-panel`, `text-muted`, `border-border` … uses them. NEW = added by
this redesign.

| Token (CSS var → Tailwind) | Hex | Use |
|---|---|---|
| `--background` → `bg-background` | `#12100D` | page canvas |
| `--panel` → `bg-panel` | `#1C1813` | cards, bars, dialogs |
| `--panel-2` → `bg-panel-2` | `#262019` | fields, row hover, nested blocks, neutral pills |
| `--panel-3` → `bg-panel-3` NEW | `#30281F` | hover on panel-2, pressed, the chosen segment, avatar disc |
| `--border` → `border-border` | `#3A3024` | hairlines, card borders, dividers |
| `--border-strong` → `border-border-strong` NEW | `#57493A` | emphasized divider, hovered card, menus/dialogs |
| `--border-field` → `border-border-field` NEW | `#806E55` | resting border of inputs/selects (3.6:1 on panel, ≥3:1 rule for controls) |
| `--foreground` → `text-foreground` | `#EFE7D8` | body text [14.4] |
| `--muted` → `text-muted` | `#B3A791` | secondary text, labels [7.4] |
| `--faint` → `text-faint` NEW | `#9A8E78` | placeholders, captions, metadata only [5.5; 5.0 on panel-2] |
| `--accent` → `accent` | `#D9A845` | antique gold [8.1] |
| `--accent-hover` → `accent-hover` | `#E6BC62` | hover of gold fills |
| `--on-accent` → `text-on-accent` NEW | `#1E1608` | text on a gold fill [8.2] |
| `--copper` → `copper` NEW | `#D08250` | secondary warm accent: categories, the emblem's rim; a chart's 2nd series if one is ever added (none uses it yet) [5.9] |
| `--good` → `good` | `#9CCB8F` | profit, ok, in stock [9.5] |
| `--bad` → `bad` | `#E58A78` | loss, error, missing [6.9] |
| `--warn` → `warn` | `#EDA25B` | caution, sold out [8.3] |
| `--info` → `info` | `#8FB8D8` | info, buy signal, source [8.4] |
| `--special` → `special` | `#C4A6E0` | user overrides only [8.3] |
| `--accent-glow` (CSS only) | `rgb(217 168 69 / 0.08)` | the page glow behind the header; an explicit rgb, not `color-mix()`, which would fall back to full-strength gold where unsupported |

Layout token (not a colour): `--header-h: calc(3.5rem + env(safe-area-inset-top))`, the height of
the sticky top bar. Anything else that sticks to the top sits under it with `sticky top-(--header-h)`.

Rules
- Never raw hex in components; use the tokens. Tints are `bg-good/12`, `bg-accent/10`, etc.
  Deliberate exceptions: `themeColor` in `layout.tsx` and the manifest (both `#12100D`), the
  `bg-black/60` dialog/sheet backdrops, the game's own item-grade rings in `ItemIcon` (§7), and in
  globals.css the black/white `rgb()` of shadows, vignette and skeleton light plus the `--muted` hex
  written into the select chevron's SVG.
- Meaning never by colour alone: a sign (+/−), a word or an icon goes with good/bad/warn.
- Copper never touches gold as the two parts of one bar or stack: the pair is too close to tell
  apart for colour-blind viewers (CIEDE2000 ΔE ≈ 17.5 with normal colour vision, but only ≈ 9–12
  under simulated deuteranopia, protanopia and tritanopia, under the floor of 15). A two-part split
  is gold + `info` (as in the /admin/stats splits); copper is for separate marks (a
  category pill, a second line with its own markers).
- Focus ring: `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px }` in
  `@layer base` (global). Fields swap it for `focus-visible:border-accent focus-visible:ring-2
  focus-visible:ring-accent/30` plus `outline-hidden` (not `outline-none`, so Windows high-contrast
  mode still draws an outline). Controls inside a scrolling track draw it inside
  (`focus-visible:-outline-offset-2`) so the track cannot clip it.
- `themeColor` (viewport) and `public/manifest.webmanifest` (`theme_color`, `background_color`) use
  `#12100D`.

## 3. Typography

| Role | Font | Size / weight / line-height |
|---|---|---|
| Display: page h1 | **Taviraj** (`font-display`) | `text-display` 26px → `md:text-display-lg` 30px, 600, 1.35 |
| Section/card title (h2/h3) | Taviraj | `text-title` 17px, 600, 1.4 (the top-bar wordmark is `text-lg`, 18px) |
| Big number (stat tile, hero profit) | **Anuphan** + `num` | 600; Stat tiles size by their own width (16–24px, §7); home pick tiles `text-2xl` |
| Body / UI | **Anuphan** (`font-sans`, default) | 14–16px, 400; labels 500 |
| Small / meta | Anuphan | 12–13px (never < 12px), `text-xs` / `text-sm` line heights raised to 1.125rem / 1.375rem |

- Loaded with `next/font/google` in `src/app/layout.tsx`: Taviraj weights 500/600/700 →
  `--font-display`; Anuphan (variable, no weight list) → `--font-body`. Subsets `thai`, `latin`.
  Both variables go on `<html>` (with `antialiased`). Tailwind (`@theme inline`):
  `--font-sans: var(--font-body), system-ui, sans-serif` and
  `--font-display: var(--font-display), var(--font-body), serif`. `body` also sets
  `font-family: var(--font-body), system-ui, sans-serif`.
- Size utilities added in `@theme`: `text-title` (1.0625rem / 1.4), `text-display` (1.625rem /
  1.35), `text-display-lg` (1.875rem / 1.35).
- **Taviraj only at 16px and up** (its loops get muddy smaller). Never for numbers in tables,
  never for body text, buttons, fields or pills.
- Thai rules: no `uppercase`, no wide `tracking-*`, no `leading-tight`/`leading-none` on text that
  can wrap (stacked vowels/tone marks clip). Headings use `text-balance`; titles that can hold a
  long name add `wrap-anywhere`.
- Numbers: every number column/value gets `num` (a plain class in globals.css:
  `font-variant-numeric: tabular-nums`) and right alignment in tables.
- Phones (≤ 767px): inputs, selects and textareas are forced to 16px by a rule outside any layer,
  so iOS never zooms into a field.

## 4. Shape, depth, spacing

- Radius: controls `rounded-lg` (8px); cards, dialogs, menus, notices, toasts `rounded-xl` (12px);
  pills `rounded-full` (a wrapping pill `rounded-xl`); the chosen segment `rounded-md`.
- Card: `min-w-0 rounded-xl border border-border bg-panel shadow-card`. In `@theme`:
  `--shadow-card: inset 0 1px 0 rgb(255 255 255 / 0.035), 0 1px 2px rgb(0 0 0 / 0.35), 0 10px 24px -14px rgb(0 0 0 / 0.6)`
  and `--shadow-pop: 0 16px 40px -12px rgb(0 0 0 / 0.7), 0 2px 6px rgb(0 0 0 / 0.4)` (menus,
  dialogs, toasts, popovers), used as `shadow-card` / `shadow-pop`.
- Highlight card (the one "act here" card per page, `tone="highlight"` / `cardCls("highlight")`):
  `border-accent/45` plus a 1px gold hairline along the top (`before:inset-x-3 before:-top-px
  before:h-px` gradient transparent → `accent/70` → transparent), title in accent.
- Interactive card/row hover (`cardHoverCls`): `hover:border-border-strong hover:bg-panel-2`
  (colour only, no layout shift, `transition-colors duration-150 ease-out`). List rows use
  `hover:bg-panel-2/60`; the open/selected row `bg-accent/6`, with a 3px gold inset bar on its
  left edge where it expands in place.
- Spacing: 4/8 rhythm. Page gutter `px-4 md:px-6`, top `pt-4 md:pt-6`; card header `px-4 py-3`,
  card body `p-4` (dense lists `px-4 py-3`); gap between page sections `space-y-4 md:space-y-6`.
- Max widths: the top bar's column is always `max-w-7xl`; page content `max-w-7xl` (`width="wide"`)
  or `max-w-5xl` (`width="narrow"`); auth cards `max-w-md`; reading text `max-w-prose`.
- Scrolling: `html` has `scrollbar-gutter: stable` (the centred bar does not shift between short
  and long pages) and `scroll-padding-top: var(--header-h)` (anchors, `scrollIntoView()` and the
  skip link stop below the sticky bar). Phones: `<main>` keeps `5.5rem` + the safe-area inset free
  at the bottom for the tab bar.

## 5. Ornament and brand

- **Emblem** (`ui/Emblem.tsx`): the site is "BDO Life by BloodMoon TH", so the mark is a gold
  **crescent moon** (filled, 24×24 viewBox) whose inner (bite) edge carries a thin `copper` stroke
  (the "blood moon" hint), with a small four-point gold star inside the curve. Decorative by
  default; `label` makes it an image. `framed` sets it in a round `bg-panel-2` disc with
  `shadow-card ring-1 ring-accent/30` (1.6× the size). Three places only: the top bar (28px, plain),
  the crest over the auth card (36px, framed) and the route loading screen (18px, plain, beside
  "กำลังโหลดหน้า…" in place of the eyebrow).
- **Wordmark**: `APP_SHORT` ("BloodMoon") from `@/lib/brand` in Taviraj 600 `text-lg` foreground,
  with `BRAND_LINE` ("BDO Life", exported from `ui/Emblem.tsx` as `APP_NAME` before " by ") under
  it in `text-xs text-muted`. In the top bar the line shows from lg; between md and lg the whole
  wordmark is screen-reader only (room is tight); a guest's wordmark hides below sm. The auth crest
  always shows both. Never hard-code the names.
- **Ledger divider** (`<Divider />` in `ui/Divider.tsx`): a 1px line fading from transparent to
  `accent/50` and back, with a 6px rotated square (`bg-accent/80`) in the middle; `aria-hidden`.
  Under the page header (`PageHeader` renders it with `mt-4`; `divider={false}` drops it) and
  between the major parts of a long page (home). Not inside cards: use `border-t border-border`.
- **Page glow**: `body` background = `radial-gradient(1200px 380px at 50% -160px,
  var(--accent-glow), transparent) no-repeat` over `--background` (no-repeat, or it would band a
  long page). The vignette is a fixed `body::before` layer (`z-index: -1`,
  `radial-gradient(130% 100% at 50% 0%, transparent 55%, rgb(0 0 0 / 0.35))`), so it stays put
  while the page scrolls (iOS ignores `background-attachment: fixed`). No images, no noise.

## 6. Icons

- One in-house set: `src/components/ui/Icon.tsx`, `<Icon name="…" className="h-5 w-5" />`.
  Lucide-style 24×24 grid, `fill="none" stroke="currentColor" strokeWidth={1.75}` (a
  `strokeWidth` prop exists, e.g. 2 in pills), round caps/joins. Path data follows Lucide (ISC
  licence, noted in the file header). No icon library dependency.
- Default size 20px (width/height attributes); classes override it. Decorative by default
  (`aria-hidden`); `label` or `title` makes it a named image. Icon-only button: `aria-label` (and a
  `title`) on the button.
- Sizes: 14px in pills; 16px (`h-4 w-4`) inside text buttons and inline text; 18px in nav links,
  menu items and the search trigger; 20px (the default) for icon-only buttons, card titles and
  notices; 22px in the phone tab bar; 24px max decorative.
- **No emoji or text glyphs as icons** (⚠︎ ℹ︎ ✓ ⊘ ★ ☆ → ← used as icons became Icon); a plain arrow
  in link copy ("ดูทั้งหมด") is the `chevron-right` Icon. Kept as text on purpose: the "→" inside the
  inventory CSV import preview lines ("30 → 50", "ใหม่ → 5", built as strings by `changeText()` in
  `InventoryManager.tsx`), the ↑ ↓ key names in QuickSearch's `<kbd>` hint row, and "×" / "≥" as
  maths in quantities, formulas and labels (market filters, the temporary-password field).
- The set as built (`IconName`, `ICON_NAMES`), grouped as in the file:
  - pages: home, book, calculator, chart, chart-bar, scale, package, user, users, settings,
    shield, lock, key, log-in, log-out
  - actions: search, x, check, plus, minus, trash, edit, copy, refresh, download, upload, filter,
    sliders, eye, eye-off, menu, more, list
  - favourites: star, star-filled (fill = currentColor)
  - status: info, help-circle, alert-triangle, alert-circle, check-circle, ban, clock, history,
    loader (spins with `animate-spin`)
  - direction: chevron-down/up/left/right, arrow-right/left/up/down, arrow-up-down,
    arrow-up-right, external-link, trending-up, trending-down
  - the trade: coins, tag, percent, crown, layers, flask, cooking-pot, hammer, sparkles
- Life-skill icons come from one map, `recipeTypeIcon()` in `src/components/recipe-type-icon.ts`:
  crown (imperial boxes), hammer (every processing method), cooking-pot (cooking), flask (alchemy).

## 7. Components (shared primitives in `src/components/ui/`)

Every export name and prop of the earlier primitives was kept; they were restyled and extended.

- **Buttons** (`button.ts`, class strings for `<button>`, `<Link>`, `<a>` and a file-input
  `<label>`): `inline-flex gap-1.5 rounded-lg font-medium transition-colors duration-150 ease-out`.
  Heights: `sm` 40px phone / 32px md+ (`text-xs`, rows/cards/lists), `md` 40 / 36px (`text-sm`, page
  actions), `lg` 44 / 40px (the one big form action). Variants: primary =
  `bg-accent text-on-accent shadow-sm hover:bg-accent-hover`; secondary =
  `border border-border-strong bg-panel-2 text-foreground hover:bg-panel-3`; ghost =
  `text-muted hover:bg-panel-2 hover:text-foreground`; danger = `border border-bad/45 bg-bad/12
  text-bad hover:bg-bad/20`; dangerGhost = `text-muted hover:bg-bad/12 hover:text-bad`. One
  primary per view. `iconBtn()` is the square version (same heights). `toggleCls(on)`: on =
  `border border-accent/60 bg-accent/12 text-accent`, off = the secondary look; pair it with
  `btnShape()` and `aria-pressed`.
- **Fields** (`field.ts`): `rounded-lg border border-border-field bg-panel-2 font-normal
  placeholder:text-faint hover:border-muted/70` + the field focus ring (§2). `md` 40 / 36px
  (`w-full`); `sm` 40 / 32px, `num text-right`, for a number cell in a table. `selectCls(size, on)`
  adds the `select-chevron` utility (one muted chevron SVG) and, when `on` (a filter narrowing the
  list), an accent border/tint/text. `selectTightCls()` for a select in a narrow cell
  (`select-chevron-tight`). `labelCls`: a 12px medium muted label over its field. `checkboxCls`:
  18px, `accent-accent`.
- **Card / CardHeader / SectionLabel** (`Card.tsx`): card per §4. CardHeader = `border-b
  border-border px-4 py-3`, Taviraj `text-title` 600 title (gold only on a highlight card), optional
  `icon` before it (muted, gold on highlight), `hint` in `text-xs text-muted`, `action` on the right
  (usually `btn("ghost", "sm")` + a chevron-right Icon). SectionLabel: Anuphan 12px 500 `text-muted`
  (no serif at that size).
- **Page / PageHeader** (`Page.tsx`): Page = TopNav, then `<main id="main" tabIndex={-1}>` (the
  skip link's target) holding the guest-import / session-ended notices and the page, then the one
  `<ToastHost />`. PageHeader: optional eyebrow (`text-xs font-medium text-accent/90`) above the
  Taviraj h1 (the page's only h1), description `text-sm text-muted max-w-prose`, meta chips as
  neutral wrapping Badges (falsy chips skipped), actions on the right; then `<Divider />` (`mt-4`).
- **Badge** (`Badge.tsx`): `rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset`, tones
  with `/14` tints and `ring-<tone>/25`; neutral = `bg-panel-2 text-muted ring-border`; `wrap`
  allows two lines (`rounded-xl`); `icon` adds a 14px Icon (the words still carry the meaning).
  The meaning-to-tone map is in the file header; `copper` = a category, not a status (the life
  skill of a recipe). `RoleBadge`: owner accent, admin info, member neutral.
- **Notice** (`Notice.tsx`): `rounded-xl border px-3 py-2.5` with `border-<tone>/45 bg-<tone>/10`,
  a leading 20px Icon (alert-circle / alert-triangle / check-circle / info) and an sr-only spoken
  word; role `alert` for bad, `status` otherwise; one optional secondary-sm action (button or link;
  `route: true` for an in-app page) and an optional x to close.
- **Stat** (`Stat.tsx`): tile `@container min-w-0 rounded-xl border bg-panel-2/60 p-3`; label
  `text-xs text-muted`; value Anuphan 600 `num`, **sized by a container query on the tile's own
  width**: `text-base`, `@[12rem]:text-lg`, `@[16rem]:text-xl` (emphasis: `text-base`,
  `@[12rem]:text-xl`, `@[16rem]:text-2xl`), so the same tile fits a phone grid, a 4-across row and
  the recipe side pane; an over-long figure breaks between digits (`wrap-anywhere`). `emphasis` =
  gold value (unless a tone or a `<Money>` colours it) + `border-accent/40`. `hint` is muted, not
  faint (it can carry a real figure).
- **Money** (`Money.tsx`): unchanged logic; `tone="profit"` adds the sign and good/bad colour (grey
  when it reads as 0); `compact` (1.23M) for phone cards and grey secondary lines only;
  `unknown` = a grey "?". Helpers `profitTone`, `pctTone`, `pctCls`.
- **Tables / dense lists** (`table.ts`, class strings): `<thead>` `bg-panel-2 text-xs font-medium
  text-muted` (opaque, so rows never show through), `headStickyCls` = `sticky top-(--header-h)
  z-10` where nothing between it and the page scrolls sideways; rows `border-b border-border/70
  hover:bg-panel-2/60`, `rowSelectedCls` `bg-accent/6`; numbers `tdNumCls` (`num text-right
  whitespace-nowrap`); the first cell = ItemIcon + name (`itemCellCls`, `itemNameCls`, `fillCellCls`
  so a long name truncates instead of widening the card). No zebra stripes. Below the switch
  point: stacked rows (`stackedRowCls` / `stackedMainCls` / `stackedNumCls` / `stackedMetaCls`) —
  name and main number on the first line, grey facts below, no sideways page scroll.
  `stackedListCls` switches at md, but every page table today (market, inventory, admin members)
  needs more room and switches at lg (`stackedListLgCls` + `hidden lg:table`); the production
  plan's table inside the recipe detail switches by its own width (`@2xl`).
  `toolbarCls` = a row of controls framed as a card.
- **Segmented** (`Segmented.tsx`): track `rounded-lg border border-border bg-panel-2 p-1`,
  scrolling sideways inside itself on a narrow phone; active segment `rounded-md bg-panel-3
  font-medium text-accent shadow-sm` (gold text, no underline); others `text-muted
  hover:bg-panel-3/50`; `aria-pressed`. Sizes `md` / `sm`, 40px tall on phones.
- **FilterControls** (`FilterControls.tsx`): `FocusChip` ("กำลังดู: X", an on-toggle with an x
  that returns to the saved filters), `FilterToggle` (the phone-only "ตัวกรอง n" button, n as a gold
  count) and `filterPanelCls(open)` (the second filter row, a card on phones, inline from md).
  Shared by /recipes and /market.
- **SearchInput** (`SearchInput.tsx`): the field look, `type="search"`, search Icon at left
  (`text-faint`), a 40px-wide clear (x) button at right once there is text (`aria-label="ล้างคำค้น"`).
- **EmptyState** (`EmptyState.tsx`): centred; Icon in a 40px `rounded-full bg-panel-2 text-accent
  ring-1 ring-border` disc; Taviraj `text-title` title; muted hint; optional secondary-sm action
  (link or button); `compact` for small cards. Inside a card it has no frame; standing alone, give
  it `cardCls()`. Copy is an invitation, not an apology.
- **Skeleton** (`Skeleton.tsx`): the `skeleton` utility (globals.css) = `bg-panel-2` with a soft
  light sweeping across every 1.8s, resting under reduced motion. Each skeleton has `role="status"`
  and an sr-only label.
- **Toast** (`Toast.tsx`): `rounded-xl border border-border-strong bg-panel shadow-pop`, tone Icon
  left (check-circle / info / alert-circle), optional action (e.g. เลิกทำ) and an x. Enters with
  `animate-rise-in` (200ms, 6px); leaves at once (no exit animation). One `ToastHost` per page
  (`role="status" aria-live="polite"`), above the phone tab bar, bottom right from md. At most 3;
  each stays 6s, paused while the pointer or focus is on them.
- **ConfirmDialog** (`useConfirm()`, native `<dialog>` + `showModal()`): `max-w-md rounded-xl
  border border-border-strong bg-panel shadow-pop animate-rise-in`, backdrop `bg-black/60
  backdrop-blur-[2px] animate-fade-in`; Taviraj `text-title` title, muted body, optional scrolling
  details list; focus starts on cancel; a danger question gets a red alert-triangle disc and a
  danger confirm button. Escape or a press on the backdrop cancels; closes at once.
- **InfoTip / WithTip** (`InfoTip.tsx`): a `help-circle` trigger 24px to look at, widened to 40px on
  touch screens (`pointer-coarse:before:-inset-2`); bubble 224px, `fixed z-50 animate-fade-in
  rounded-lg border border-border-strong bg-panel-3 px-3 py-2 text-xs shadow-pop`, kept inside the
  screen and opening upwards near the bottom.
- **Sparkline** (`Sparkline.tsx`): tone `accent` (default), `muted` (a series whose direction is
  neither good nor bad, such as listed stock) or `trend` (good/bad by last vs first point); 1.5px
  non-scaling stroke, a 10% fill under the line and a dashed `stroke-faint/60` average line
  (`avg={false}` drops it). Screen readers get low / average / high.
- **Avatar** (`Avatar.tsx`): `initial(name)` (skips a leading Thai vowel เ แ โ ใ ไ) in a 36px
  `rounded-full bg-panel-3 text-sm font-semibold` disc; `ring-1 ring-border-strong`, `admin` =
  `ring-2 ring-accent/70`, `dim` = 50% (a disabled account). Decorative. Used by UserMenu and the
  admin members list.
- **ItemIcon** (`src/components/ItemIcon.tsx`, not in `ui/`): the game picture in a `rounded-md
  bg-panel-2 ring-1 ring-border` frame; the item grade as a second 1px inset ring drawn over it in
  the game's own colours (Tailwind emerald/sky/amber/orange/rose, the only coloured Tailwind palette
  classes in the app); a `package` outline when the picture will not load.

## 8. App shell and navigation

- **Top bar** (`TopNav.tsx`, all widths): `sticky top-0 z-40 border-b border-border
  bg-background/85 backdrop-blur` (blur is purposeful: content scrolls under it); a 56px row
  (`h-14`) in a `max-w-7xl` column; it pulls itself up over the body's status-bar padding and pads
  itself instead, so `--header-h` = 56px + the top inset. Left: skip link ("ข้ามไปเนื้อหา", first
  focusable), then emblem + wordmark → `/` (`aria-label` = `APP_NAME`). md+: main nav (หน้าแรก,
  คำนวณสูตร, สแกนตลาด, คลังของ, คิดภาษี, วิธีใช้); active = `text-foreground` + a 2px gold bar on the
  bar's bottom border (and, from xl, a gold icon); inactive `text-muted hover:text-foreground`. Right:
  SaveStatus (members only), QuickSearch trigger, then UserMenu for members, or for guests a gear
  icon button (ตั้งค่าตัวละคร, on pages with a `UserDataProvider`), a help icon (below md only) and a
  secondary "เข้าสู่ระบบ" button that comes back to this page. The loading skeleton shows a grey
  placeholder the size of the menu button.
  - What comes back as the bar widens: md = emblem + link labels; lg = wordmark, BRAND_LINE and
    the search label; xl = link icons and the Ctrl K hint.
- **QuickSearch** (`QuickSearch.tsx`): opens with **Ctrl+K (⌘K)** on every page that has the top
  bar, i.e. not on the sign-in, setup or forced password-change cards (it waits while another
  modal dialog is open). Trigger: a 40×40 search-icon button below md; from md a field-like
  button (`border-border-strong bg-panel-2`), "ค้นหา…" from lg, a `<kbd>` "Ctrl K" hint from xl.
  The dialog is a native `<dialog>`: full screen on phones (`animate-fade-in`), a centred `max-w-xl`
  card from md (`animate-rise-in`, 12vh from the top), backdrop `bg-black/60 backdrop-blur-[2px]`;
  a key-hint row (↑ ↓ / Enter / Shift+Enter / Esc) from md.
- **Phone tab bar** (< md, in TopNav): `fixed bottom-0 z-40 grid grid-cols-5 border-t border-border
  bg-panel/95 backdrop-blur`, padded by `env(safe-area-inset-bottom)`. Five tabs: หน้าแรก, สูตร,
  ตลาด, คลัง, ภาษี. Each 56px tall (`min-h-14`), a 22px Icon over a `text-xs` label; active =
  `font-medium text-accent` + a 2px × 32px gold bar on the top edge. วิธีใช้ is reached from the user
  menu (members) or the top-bar help icon (guests).
- **UserMenu** (`auth/UserMenu.tsx`): the button is an Avatar disc (a 40px target on phones, 36px
  from md), from lg a `w-40` pill with the display name and a chevron; admins get the gold ring. The menu: `absolute
  right-0 z-40 mt-2 w-60 animate-rise-in rounded-xl border border-border-strong bg-panel p-1.5
  shadow-pop`; a header with Avatar, name, @username and RoleBadge (admins); 40px items with 18px
  icons: ตั้งค่าตัวละคร (pages with a `UserDataProvider`), บัญชีของฉัน, สมาชิก and สถิติการใช้งาน
  (admins), วิธีใช้, a separator, ออกจากระบบ. Menu-button keyboard pattern (arrows, Home/End, Escape
  returns focus, Tab or focus leaving closes).
- **SettingsDrawer** (`SettingsDrawer.tsx`, native `<dialog>`): a bottom sheet on phones
  (`animate-sheet-in`, `rounded-t-xl`, a grab handle) and a right-hand drawer 36rem wide from md
  (`md:animate-drawer-in`, `rounded-l-xl`), `bg-background` body with `bg-panel` header/footer.
- Menus and dropdowns (UserMenu, inventory's add-item suggestions, the calculator's price ladder
  from md): `rounded-xl bg-panel border border-border-strong shadow-pop`, items at least 40px tall.
  InfoTip bubbles are the exception (§7).
- **404** (`src/app/not-found.tsx`): the full page shell (top bar, tab bar), a PageHeader with
  eyebrow "404" and an EmptyState card leading back home. **Route loading**
  (`src/app/loading.tsx`): `PageSkeleton emblem` — the real shell plus a shimmering page outline.

## 9. Motion

- Default `transition-colors duration-150 ease-out` on interactive elements.
- Overlays animate **in only**, from `@theme` tokens in globals.css: `animate-fade-in` (180ms
  opacity), `animate-rise-in` (200ms, opacity + 6px up), `animate-sheet-in` (220ms, 24px up, phone
  sheets) and `animate-drawer-in` (220ms, 24px from the right). They close at once — no exit
  animation — since React unmounts them or the native dialog closes immediately.
- Loops: only the skeleton shimmer and spinners (`loader` Icon + `animate-spin`). Small extras:
  SaveStatus's "บันทึกแล้ว" fades out over 500ms; disclosure chevrons turn (150ms) as their part
  opens (the user menu, recipe and market rows, cost-tree rows, inventory's นำเข้า / ส่งออก). No
  scroll-reveal, no parallax.
- `prefers-reduced-motion: reduce`: a global rule cuts every animation and transition to 0.01ms
  (with a separate rule for `::backdrop`), and the skeleton rests.

## 10. Accessibility checklist (must pass)

- Text ≥ 4.5:1 (all tokens above pass on background/panel/panel-2; `faint` only for metadata).
- Control boundaries ≥ 3:1 (`border-field`), focus ring always visible, never removed.
- Touch targets ≥ 40px on phones (44 preferred), ≥ 8px apart; desktop ≥ 24px.
- Every icon-only control has an accessible name; decorative icons `aria-hidden`.
- Headings in order (one h1 per page = PageHeader or the AuthCard title); labels visible on every
  field.
- No horizontal page scroll at 375px; wide tables scroll inside their own card only if a stacked
  layout is impossible.
- Fields are 16px on phones (no iOS zoom).

## 11. Page remodel notes (as built)

- **Home (`/`, Dashboard)**: PageHeader "สวัสดี …" with market chips; then the highlight card
  "ทำอะไรดีตอนนี้" (`HOME_PICKS_TITLE`): the top 3 market recipes across lines, imperial boxes left
  to their own card, as tiles (ItemIcon 40px,
  name, copper life-skill pill, profit as the big `text-2xl` number, one secondary action), a
  กำไร/ชิ้น · กำไร/ชม. Segmented, and a foot naming the settings used with a ตั้งค่าตัวละคร button.
  Below: the first-visit setup card, then "ทำอะไรได้จากของในคลัง" and "ของที่ฉันเฝ้า" (when
  something is starred), a Divider, then five quieter line cards (alchemy, cooking, processing,
  imperial, market shortages).
- **Recipes (`/recipes`, Studio)**: a toolbar card (phones: tabs + search stick under the top bar,
  the rest folds behind ตัวกรอง). From lg two panes: the ranked list ("อันดับสูตร", 26rem, 30rem
  at xl) on the left and a sticky detail pane on the right that scrolls by itself (empty: "เลือกสูตร
  เพื่อดูว่าคุ้มไหม"). Below lg the detail opens under its row. The detail: the other recipes for
  the same item as toggles (when there are several), the verdict Stat tiles (กำไร/ชิ้น emphasis,
  ต้นทุน/ชิ้น, ROI, ได้รับจริง/ชิ้น with the sell price as hint) and a quieter facts row, then the cost
  tree ("วัตถุดิบต่อ 1 รอบ"), the production plan (แผนผลิต) and the market panel.
- **Calculator (`/calc`, TradeCalc)**: the form card and the answer (a highlight card with the
  verdict in words, then the sum as a ledger) side by side from lg, the answer sticky; stacked
  below lg, with a sticky summary bar (above the phone tab bar) that jumps to the answer. The market price
  ladder is a bottom sheet on phones and a dropdown from md.
- **Market (`/market`)**: the highlight card "แนะนำวันนี้" first (three lists side by side from lg,
  one at a time behind Segmented tabs below lg), then the filter toolbar, then the scanner: a table
  from lg (sticky head, a muted stock sparkline in the row, neutral trend pills), stacked cards
  below lg. An opened row shows Stat tiles, the evidence card, a primary "คิดกำไรเทรดของนี้" and
  the market panel.
- **Inventory (`/inventory`)**: two Stat tiles once it holds anything (market value as the
  emphasis, total cost), a toolbar (add-item
  search, นำเข้า / ส่งออก toggle), then the list card (search in inventory, sort Segmented, a table
  from lg, stacked below). The "ทำอะไรได้จากของในคลัง" panel is a side card from xl and follows the
  list below xl.
- **Account / Login / Setup / Help**: auth pages (`AuthCard`) = the framed emblem + wordmark crest
  above a centred `max-w-md` card with an optional gold eyebrow, the Taviraj title, fields and one
  primary button. Account = cards for password, username/display name and "sign out everywhere".
  Help = a narrow page: an index (chips on top below lg, a sticky list on the right from lg) beside
  a `max-w-prose` column of cards whose lines are bordered rows.
- **Admin (`/admin`, `/admin/stats`)**: members as a table from lg (sticky head) and cards below
  lg, each with Avatar + name, role pill and row actions. Stats = Stat tiles, a chart of unique visitors per day as gold
  columns (one series, tooltip per day, CSV export) and a top-pages list.

## 12. Implementation map

`src/app/`
- `globals.css` — tokens (§2), `@theme` sizes/shadows/animations, focus ring, `select-chevron`,
  `select-chevron-tight` and `skeleton` utilities, `num`, page glow/vignette, scroll padding,
  reduced motion, 16px phone fields.
- `layout.tsx` — Taviraj/Anuphan via `next/font`, `themeColor`, `viewportFit: "cover"`, renders
  `UsageBeacon`.
- `not-found.tsx` — styled 404. `loading.tsx` — `PageSkeleton emblem`.

`src/components/ui/`
- `button.ts` — `btn`, `btnShape`, `iconBtn`, `toggleCls`; types `ButtonVariant`, `ButtonSize`,
  `ButtonAlign`.
- `field.ts` — `fieldCls`, `selectCls`, `selectTightCls`, `labelCls`, `checkboxCls`; type
  `FieldSize`.
- `table.ts` — `tableCls`, `headCls`, `headStickyCls`, `thCls`, `thNumCls`, `thEndCls`, `rowCls`,
  `rowButtonCls`, `rowSelectedCls`, `tdCls`, `tdNumCls`, `tdEndCls`, `fillCellCls`, `itemCellCls`,
  `itemNameCls`, `stackedListCls`, `stackedListLgCls`, `stackedRowCls`, `stackedMainCls`,
  `stackedNumCls`, `stackedMetaCls`, `toolbarCls`.
- `Card.tsx` — `Card`, `CardHeader`, `SectionLabel`, `cardCls`, `cardHoverCls`; type `CardTone`.
- `Page.tsx` — `Page`, `PageHeader`; type `PageWidth`.
- `Badge.tsx` — `Badge`, `RoleBadge`, `badgeCls`; type `BadgeTone`.
- `Notice.tsx` — `Notice`; types `NoticeTone`, `NoticeAction`.
- `Stat.tsx` — `Stat`; type `StatTone`.
- `Money.tsx` — `Money`, `profitTone`, `pctTone`, `pctCls`; type `ProfitTone`.
- `Segmented.tsx` — `Segmented`; type `SegmentedOption`.
- `FilterControls.tsx` — `FocusChip`, `FilterToggle`, `filterPanelCls`.
- `SearchInput.tsx` — `SearchInput`.
- `EmptyState.tsx` — `EmptyState`; type `EmptyAction`.
- `Skeleton.tsx` — `SkeletonRows`, `SkeletonList`, `SkeletonListPane`, `SkeletonCards`,
  `PageSkeleton`.
- `Toast.tsx` — `toast`, `dismissToast`, `dismissActionToasts`, `ToastHost`; types `ToastTone`,
  `ToastInput`.
- `ConfirmDialog.tsx` — `useConfirm`; type `ConfirmOptions`.
- `InfoTip.tsx` — `InfoTip`, `WithTip`.
- `Sparkline.tsx` — `Sparkline`; type `SparklineTone`.
- `Icon.tsx` — `Icon`, `ICON_NAMES`; type `IconName`.
- `Emblem.tsx` — `Emblem`, `BRAND_LINE`.
- `Divider.tsx` — `Divider`.
- `Avatar.tsx` — `Avatar`, `initial`.

`src/components/` (shell and shared helpers)
- `TopNav.tsx` — top bar and phone tab bar. `QuickSearch.tsx` — Ctrl+K search dialog.
  `auth/UserMenu.tsx` — `UserMenu`, type `SessionUser`. `SettingsDrawer.tsx` — settings sheet /
  drawer. `SaveStatus.tsx` — save indicator. `auth/AuthCard.tsx` — auth page card and crest.
- `ItemIcon.tsx` — framed item picture with grade ring. `recipe-type-icon.ts` — `recipeTypeIcon`.
