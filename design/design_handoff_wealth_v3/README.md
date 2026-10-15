# Handoff: Wealth (الثروة) — `/wealth`

## Overview
Wealth merges the old Savings and Investment pages into one scrolling destination. It shows what the user holds (pockets, gold, crypto, stocks, property), net worth, live Egyptian gold prices, emergency-fund status and zakat, and lets the user add or withdraw money and add holdings. Bilingual (EN / AR RTL), light (default) and dark.

## About the design files
Everything in `design/` is a **design reference built in HTML**. It shows the intended look and behaviour. It is not production code. Rebuild it in the Buddget codebase (Next.js 15 + React + Tailwind v4, Capacitor) using the existing library in `src/components/ui/` and the tokens in `src/app/globals.css`. Do not copy the HTML's inline styles.

## Fidelity
**High fidelity.** Final layout, copy, tokens, type and states. Match the screenshots pixel for pixel using library components. Where the HTML draws something the library doesn't have yet, `COMPONENTS.md` says which component to add or extend.

## Read in this order
1. `CLAUDE_CODE_PROMPT.md` — paste into Claude Code. It is the implementation brief.
2. `COMPONENTS.md` — the component decision ledger: reuse / edit / replace / new, with props.
3. `SCREENS.md` — every screen with its screenshot, layout, copy and behaviour.
4. `screenshots/` — 780 px wide (2×), full height, uncropped. Sheets are captured at full length.
   - `light/` and `dark/` — every phone screen (01–25).
   - `gold-strip/` — the strip in 5 states × light/dark × 390/375 × RTL.

## Page structure (top to bottom)
1. Header — context, unchanged (title + profile).
2. **Hero band** (teal gradient, as Flow): label + badges · total · split bar + legend · net worth with trend · savings rate. Same height for every user.
3. **Add money** (default, cta) · **Withdraw** (outline, cta). A brand-new user sees **Add a holding** · **Add money**.
4. **Gold price strip** — 24k / 21k / 18k per gram; expandable world row; status pill + age; refresh; hide.
5. **Where it is** — title, count, **+ Add pocket or asset** (the only add button), category chips, one list of balances and positions.
6. **Recent moves** — 3 rows, follows the category filter.
7. Bottom nav — context, unchanged.

Overlays: the Flow **status pill** (price feed down) and the Flow **drop-down prompt** (zakat basis, once).

## Interactions and state
- **Hero badges** (top right of the band; start side in RTL). Emergency fund: `secured` = green shield with a check, no text; `needsMoney` (set up, cover below target, including 0) = amber shield with “!” and `3.1/6 mo`; `unset` = red shield with “+” and `Set up`. Zakat: moon + `2,310 · 8 Feb`, shown only when zakat is due on the chosen basis (gold if none chosen). Tap → the Emergency fund details sheet or the Zakat sheet. Pills are `Button variant="secondary" size="sm"`, 28 px visible with a 44 px hit area.
- **Hero split bar**: pockets-only users see it by kind (Bank accounts · Vault · Cash); users with investments see Balances · Market-priced (+ return since first purchase, green pill) · You value. Net worth shows a 30-day sparkline pill: green ▲ when up, red ▼ when down. Right side: “Saves 14% of income”. Stale: total and net worth get ≈. Unavailable: “At least …”, trend hidden.
- **Freshness** is not in the hero. The strip’s status pill and each position’s time carry it. A price-feed failure also raises the Flow **status pill** (“Gold prices unavailable · 40 g not counted”), swipe up to hide.
- **Zakat basis prompt**: a BannerStack drop-down card, shown while the user has never chosen. SegmentedControl Silver | Gold: tapping one saves it and dismisses the card immediately. ✕ saves gold. Copy includes the hadith (Bukhari & Muslim) and the jurists’ principle; see `SCREENS.md`.
- **Category chips** under “Where it is”: only filled categories, each with its CategoryIcon glyph and count; hidden when fewer than two. Selecting one filters the list and Recent moves; All clears it.
- **Pocket row tap** → CardActionMenu: Add money, Withdraw, Edit, Delete. Monthly Savings vault: Delete disabled, hint “Can’t delete: month-end carry lands here.”
- **Add to Wealth** (from + Add pocket or asset): SegmentedControl Savings pocket | Investment. Pocket → linked payment methods (already-linked disabled) or a kind → PocketFormSheet. Investment → Gold / Crypto / Stocks / Property → AssetFormSheet; Gold prices on Wealth switch.
- **Add money / Withdraw**: pocket cards (radio), AmountField + CurrencyField, source (This month’s budget | Outside the budget) with a one-line tip. Withdraw adds five destinations.
- **Emergency fund**: Details (status, progress, essentials, target, covered, still to save; Edit · Add money) → Set up / Edit (months stepper, simple-month category chips, own figure, Estimate with AI, needed total). Cover = all savings pockets.
- **Sticky hero** past scrollTop 150: 52 px band with the total.

## Design tokens used (names from `globals.css`)
- Surfaces: `--color-brand-bg`, `--color-brand-card`, `--color-brand-elevated`, `--color-brand-border`, `--color-brand-border-strong`
- Text: `--color-brand-text-primary`, `-secondary`, `-muted`
- Brand: `--color-brand-primary` (fills), `--color-brand-on-primary`, `--color-brand-primary-hover`, `--color-brand-primary-ink` (teal text), `--color-brand-primary-soft`, `--color-brand-primary-bright` (vault glyph only)
- Semantic: `--color-brand-green` / `-soft` (rise, secured, Live), `--color-brand-amber` / `-soft` (stale, needs money, status pill), `--color-brand-red` (emergency fund not set up, net-worth fall, Delete), `--color-brand-gold` (gold labels, market segment, karat cards)
- Category ramp: `--color-cat-1` … `--color-cat-6`
- Radius: inputs/buttons 12 px, cards 16 px, sheet top 24 px, chips/badges full. AmountField glass is 14 px (component default).
- Shadows: `--shadow-sm` (strip), `--shadow-md` (status pill), `--shadow-lg` (menu, sheet, prompt)
- Type: DM Sans (UI), JetBrains Mono via `font-mono-numbers` on every amount, date and percentage.

## Assets
Icons are Lucide (stroke 1.75–2): Coins (tab), Landmark, Vault, Banknote, Gem, Bitcoin, TrendingUp, House, Wallet, FileText, CreditCard, Shield (+ check / ! / + marks), Moon, RefreshCw, ChevronDown/Up, X, Plus, Minus, Pencil, Trash2, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Undo2, ShoppingBag, UtensilsCrossed, Car, Plug, Sparkles, TriangleAlert. Category glyphs come from `CategoryIcon.tsx`. No images.

## Files
- `design/Wealth Design v3.dc.html` — the full design board (one part renders at a time; chips at the top switch parts; the Prototype part is clickable). Open it from the design project so `support.js` and the `_ds` bundle resolve.
- Earlier rounds, for history: `Wealth Design.dc.html` (v1), `Wealth Design v2.dc.html` in the design project.
