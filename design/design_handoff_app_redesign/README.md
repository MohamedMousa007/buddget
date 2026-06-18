# Handoff: Buddget Mobile Redesign (dark + light)

## Overview
A redesign of Buddget's global chrome and several core screens (header, bottom nav, + menu, Buddgy AI,
Expenses, Profile menu, Settings entry, Income) plus an icon migration. This bundle is the spec + a
viewable reference for implementing it in the live app with **zero deviation**.

## About the design files
The files in this bundle are **design references created in HTML** — prototypes that show the intended
look and behavior, **not production code to copy line-for-line**. Your task is to **recreate these designs
inside the live Buddget codebase** (Next.js 16 / React 19 / Tailwind v4 / Base UI / lucide-react / Framer
Motion / Zustand) using its established patterns and tokens. Translate the prototype's inline styles to the
app's existing `var(--color-brand-*)` tokens and components — match the *values*, not the technique.

- **`Buddget Mobile Redesign (reference).html`** — open in any browser to see the finished dark-mode design
  and click through every screen/sheet. (It may log a few harmless `[bundle] error` lines for inline-icon
  prefetches; ignore them — the design renders fully.)
- **`Buddget Mobile Redesign.dc.html`** — the source markup. When a measurement is ambiguous, open this and
  read the literal inline style. **This file is the source of truth.**

## Fidelity
**High-fidelity (hifi).** Colors, typography, spacing, radii, and interactions are final. Recreate the UI
pixel-perfectly using the codebase's libraries. The detailed spec below carries every value.

---

# Buddget — Mobile Redesign Handoff (Dark + Light)

**Audience:** Claude Code (or any engineer) implementing this redesign into the live app
(`MohamedMousa007/buddget` — Next.js 16 · React 19 · Tailwind v4 · Base UI · Lucide · Framer Motion · Zustand).

**Single source of truth:** `Buddget Mobile Redesign.dc.html` in this project. It is the **dark-mode**
reference and is pixel-accurate. When this document and the file ever disagree, **the file wins** —
open it, inspect the exact inline styles, and copy the literal values. Do not eyeball; read the markup.

> **Golden rule — zero deviation.** Every number in the reference (px, weight, radius, opacity, gap,
> color) is intentional. Reproduce them exactly. Do not "round to the nearest Tailwind step," do not
> substitute a similar shade, do not add shadows/gradients/animations that aren't in the reference.

---

## 1. Scope

Implement **only** these areas. Everything else in the app is out of scope for this pass.

| # | Area | Notes |
|---|------|-------|
| 1 | **App header + bottom nav (footer)** | Global chrome, every screen |
| 2 | **More menu** | Bottom-sheet launcher |
| 3 | **+ menu (Quick add)** | FAB bottom-sheet |
| 4 | **Buddgy floating button + AI chat sheet** | Draggable orb + popup |
| 5 | **Expenses screen** (all of it) | Header, stats card, filters, list, all filter dropdowns |
| 6 | **Profile menu** | Header avatar dropdown |
| 7 | **Settings** | Entry point moved (see §7) |
| 8 | **Income screen** (all of it) | Recurring/one-time/history + month switch |
| 9 | **Icons** | Migrate to Lucide (see §11) |

**Explicitly OUT of scope — do not touch:** Dashboard/Home, Savings, Reports, Subscriptions, Budget setup.
(The reference still contains them so the nav works; ignore them.)

**Both themes ship: dark and light only.** The reference shows dark. Light values are in §3.

---

## 2. Stack mapping

- Build with the **existing primitives**: Base UI `Dialog`/`Sheet`/`Popover` for the bottom-sheets and
  dropdowns, `lucide-react` for icons, Framer Motion for the sheet/orb motion, Zustand for filter/avatar state.
- The reference uses inline styles for streaming reasons. **In the app, translate them to the existing
  Tailwind tokens / CSS variables** (`var(--color-brand-*)`) — never hard-code hex in components. The
  token values are already defined in `src/app/globals.css`; they match §3 exactly.
- All fixed chrome must respect `.safe-area-top` / `.safe-area-bottom` (the reference omits the device
  safe-area inset — add it back with the existing utilities).

---

## 3. Design tokens (exact)

These are already in the bound design system (`tokens/colors.css`) and match the live `globals.css`.
Two themes, same keys; `.dark` overrides `:root`.

### Brand
| Token | Light | Dark |
|---|---|---|
| `--color-brand-red` | `#E50914` | `#E50914` |
| `--color-brand-red-hover` | `#C5070F` | `#F40612` |
| `--color-brand-gold` | `#D4A017` | `#F5C842` |
| `--color-brand-green` | `#18A349` | `#1DB954` |
| `--color-brand-green-hover` | `#12843B` | `#25D067` |
| `--color-brand-amber` | `#E08800` | `#FF9F0A` |

### Surfaces / text
| Token | Light | Dark |
|---|---|---|
| `--color-brand-bg` | `#F5F5F7` | `#0A0A0F` |
| `--color-brand-card` | `#FFFFFF` | `#111118` |
| `--color-brand-elevated` | `#F0F0F4` | `#1A1A24` |
| `--color-brand-border` | `#D4D4DC` | `#2A2A38` |
| `--color-brand-text-primary` | `#1A1A24` | `#FFFFFF` |
| `--color-brand-text-secondary` | `#5A5A72` | `#CFCFE0` |
| `--color-brand-text-muted` | `#8A8AA0` | `#9898B0` |

### Fixed accents used inline in the reference (same in both modes)
- Debt red tint text: `#FF5C5C`; tints written as `rgba(...)` (e.g. `rgba(229,9,20,.12)` red, `rgba(29,185,84,.13)` green, `rgba(245,200,66,.13)` gold, `rgba(255,159,10,.12)` amber, `rgba(77,163,255,.13)` blue `#4DA3FF`, `rgba(124,92,255,*)` violet `#7C5CFF`, teal `#14B8A6`).
- Scan-receipt blue (Quick add): icon `#4DA3FF` on `rgba(77,163,255,.16)`.
- **In light mode** keep these category/semantic tints but verify contrast; the reference's translucent
  tints sit on `--color-brand-elevated`, which flips to `#F0F0F4` — they remain legible. Text on tints
  always uses the solid accent (`--color-brand-red` etc.), never white.

### Type
- **DM Sans** — all UI text and headings (400/500/600/700/800).
- **JetBrains Mono** (`.font-mono-numbers`, `font-variant-numeric: tabular-nums`) — **every** currency
  figure, percentage, count, and the manual amount inputs.
- Micro-labels: 10px, `font-weight:700`, `letter-spacing:.06em`, `text-transform:uppercase`, muted.

### Radii (match `tokens/radius.css`)
base `0.75rem` · cards `1.35rem` (`2xl`) · hero `1.65rem` (`3xl`) · buttons `0.75rem` (`lg`) · badges/pills full (`999px`).
The reference uses literal px that map to these (e.g. cards `16–20px`, pills `999px`, sheets `26px 26px 0 0`).

### Shadows
Low-spread, dark-tinted: `0 10px 30px -12px rgba(0,0,0,.55)`. Sheets: `0 -20px 50px -20px rgba(0,0,0,.7)`.
FAB/orb carry a red-tinted glow. In light mode soften shadow alpha (~`.12–.18`).

### Motion (Framer Motion)
Sheets slide up `translateY(110%)→0`, `.26s cubic-bezier(.22,1,.36,1)`. Backdrop fade `.18s`.
Cards `whileHover {y:-2}`; buttons `whileTap {scale:.92}`, spring `stiffness:400, damping:22`. No infinite loops.

---

## 4. App header + bottom nav (footer)

**Header** (`top:50px` below status bar, height `52px`, `padding:0 18px`, bottom hairline border,
bg `--color-brand-bg`):
- Left: wordmark `Bud<span red>d</span>get` (19px / 800 / `-.4px`), a 1px×16px divider, then the current
  section title (14px / 600 / secondary, truncates).
- Right: **profile avatar button** — 36px circle, opens the Profile menu. Avatar art = §6.

**Bottom nav** (fixed, glass blur, `h-16`, `.safe-area-bottom`): five slots —
`Home` (LayoutDashboard) · `Expenses` (Receipt) · **center FAB** (Plus, 56px red circle, `margin-top:-20px`,
4px card-colored ring, opens **+ menu**) · `Debts` (Landmark) · `More` (Menu, opens **More menu**).
Active item tint = `--color-brand-red`; inactive = `--color-brand-text-muted`. Labels 10.5px / 600.
"More" is active whenever the screen is income/savings/subscriptions/settings/budget.

---

## 5. + menu (Quick add) and Buddgy

### + menu
Bottom-sheet from the center FAB. The reference exposes a `menuStyle` prop with three layouts —
**ship `grid`** (the others, `focused`/`list`, are exploration only; keep `grid`):

- A centered **red glowing tip pill**: mic icon + "Hold the + button to log by voice"
  (`rgba(229,9,20,.12)` bg, `1px rgba(229,9,20,.35)` border, `box-shadow:0 0 18px -2px rgba(229,9,20,.45)`, red text/icon).
- A **3-column grid** (3 + 2 = two rows), 5 tiles. Each tile: 46px rounded-14 icon chip (24px icon),
  two-word label (12px / 600). Exact items & colors:
  1. **Scan receipt** — Camera, blue `#4DA3FF` on `rgba(77,163,255,.16)`
  2. **Track expense** — Receipt, red on `rgba(229,9,20,.14)`
  3. **Add income** — DollarSign, green on `rgba(29,185,84,.14)`
  4. **Pay off debt** — CreditCard, `#FF5C5C` on `rgba(255,92,92,.14)`
  5. **Create saving** — Coins, gold on `rgba(245,200,66,.14)`
- Hold-to-record (long-press the FAB) triggers voice capture. There is **no** "Ask AI" item here.
- Closes via tap-outside or drag-down. No close X.

### Buddgy (AI assistant)
**Buddgy has a mascot identity** — a friendly red-and-white robot with a dark visor showing a glowing **B**
(antennae, headphones, blue shoulder accent). It is the single visual identity for the AI everywhere.
Asset variations live in `assets/`:
- `assets/buddgy-square.png` — the brand red **square** icon (maroon margin trimmed); use this clipped to a
  circle (orb) or rounded-square (chat chip / app-store icon). The master art is `uploads/2.jpeg` (768²).
- `assets/buddgy-cutout.png` — **transparent-background** robot (best-effort flood-fill); use on non-red surfaces.
  > This cutout is auto-generated; if design has a true alpha master, swap it in. Keep the same usages.

- **Floating orb**, present on every screen, `z-index:50`. 44px circle = `buddgy-square.png` `object-fit:cover`,
  `overflow:hidden`, `1.5px solid rgba(229,9,20,.5)` ring, `opacity:.95` (→1 on hover), red-tinted soft shadow.
- **Draggable** vertically and **snaps to the left or right edge** (`left:12px`/`right:12px`); a tap (no
  drag) opens the chat. Persist `{side, top}` in Zustand. Default rest `top≈620` so it never covers the
  Expenses toolbar.
- **Chat sheet** (bottom-sheet): header chip = `buddgy-square.png` in a 42px rounded-13 `overflow:hidden`
  box with a `rgba(229,9,20,.45)` border; title "Buddget AI" + subtitle; close X; four suggestion rows
  (red `rgba(229,9,20,.13)` icon chips); input with a red send button. **All red — no gold anywhere.**

---

## 6. Profile menu + avatars

Anchored dropdown under the header avatar (`top:96px; right:14px; width:256px`, rounded-20, popover bg, pop animation):
1. Header row: selected avatar (44px) + name + email.
2. Divider → **Edit profile** (User) → **Settings** (Settings icon) → divider → **Sign out** (LogOut, red).
   **"Switch account" is removed.** **Settings now lives here** (it was removed from the More menu).
   The **avatar is chosen in Profile Settings (Edit profile)** — there is **no avatar picker in this menu**;
   the menu only displays the currently-selected avatar.

### Avatars — placeholder system (action required)
The reference ships **generated gradient avatars** because no real avatar assets were available in the
project, the design system, or the repo. Each is a circle with a 2-stop diagonal gradient plus two blurred
blobs (a light highlight top-left, a dark blob bottom-right) for depth. The six gradients:

| # | Gradient | highlight / shadow blob |
|---|---|---|
| 1 | `linear-gradient(140deg,#E50914,#7a060c)` | `rgba(255,255,255,.30)` / `rgba(0,0,0,.28)` |
| 2 | `linear-gradient(140deg,#1DB954,#0a6b32)` | `.32` / `.26` |
| 3 | `linear-gradient(140deg,#2A6FDB,#13407e)` | `.30` / `.26` |
| 4 | `linear-gradient(140deg,#7C5CFF,#3a2a8a)` | `.32` / `.26` |
| 5 | `linear-gradient(140deg,#F5C842,#b07d06)` | `.40` / `.22` |
| 6 | `linear-gradient(140deg,#14B8A6,#0a6b5e)` | `.34` / `.24` |

Blob A: `62%×62%`, `left:-12% top:-12%`, `blur(4px)`. Blob B: `66%×66%`, `right:-14% bottom:-16%`, `blur(5px)`.
**If the team has the real signup avatar set, drop those images in and keep this exact picker UX** (random
default at signup, user-pickable in **Profile Settings → Edit profile**, not in the dropdown menu).
Persist `avatar` index in Zustand.

---

## 7. Settings

Settings is reached **from the Profile menu** (§6), not the More menu. The Settings screens themselves are
unchanged in layout from the current app — only the entry point moved. Keep the existing grouped settings
content; ensure the route still works from the profile dropdown.

---

## 8. Expenses screen (full spec)

Vertical order inside `padding:14px 16px 130px`:

1. **Header row** (`gap:8px`, `mb:13px`): month switcher pill (chevrons + "June 2026", min-width 68) ·
   **Add expense** red filled button (`flex:1`, 40px, Plus icon, opens + menu) · 40px **export** icon button
   (Download, outline). Month switch and export are both required — keep them.
2. **Stats card** (`linear-gradient(150deg,#15151d,#101017)` dark; flips to card surface in light, rounded-20,
   `padding:16px 18px`): left = "SPENT THIS MONTH" label + big mono total (27px / 700) + optional USD line
   (gated by the Dual-currency toggle); right = "ENTRIES" label + count.
3. **Filter toolbar** (`gap:8px`, `mb:12px`): horizontally-scrolling **parent filter chips** (`flex:1`,
   no scrollbar) + a 42px **filter icon** button (SlidersHorizontal) on the right that opens the full
   All-filters sheet (with a red count badge when filters are active).
   - Chips are **filter dimensions**, not categories: **Category**, **Payment**, **Amount**. Each chip shows
     its active value (e.g. "Categories (2)", "Visa ••4821", "500–2,000") and turns red-tinted when active;
     a small ArrowUpDown glyph hints it opens a control. Tapping a chip opens that dimension's **dedicated
     dropdown** (§9). There is **no sort** anywhere (removed by design — the list is always newest-first).
4. **Dense transaction list** — grouped by day. Group header: uppercase day (e.g. "TODAY · JUN 17") + day
   total (mono, muted). Card (rounded-14) with hairline-separated rows: 34px rounded-10 category icon chip ·
   description (13.5px / 600, truncates) + optional SMS/manual badge · payment method (11px muted) ·
   right-aligned mono amount (14px / 700) + optional USD (9.5px). Rows are intentionally compact to fit many.
   **No grid/compact toggle** (removed) and **no "swipe to edit" helper line**.

Category icon→color mapping (from `CategoryIcon`): Rent `#FF6B6B`, Food/Groceries amber, Transport `#4DA3FF`,
Enjoyment violet, Debt `#FF5C5C`, Other neutral — each on its matching `rgba(...,.13)` chip. Use the live
`CategoryIcon.tsx` mapping; keep the redesign's chip sizes.

---

## 9. Filters (dropdowns + sheet)

State (Zustand): `cats: string[]`, `methods: string[]` (empty array = "all"), `amtMin`, `amtMax` (0–10000).
Active-filter count = number of non-empty dimensions.

- **Category dropdown** — bottom-sheet, **multi-select**. One selectable row per category: 32px icon chip +
  label + a 22px rounded-7 checkbox that fills red with a white Check when selected. "Done" (red) closes.
- **Payment dropdown** — same pattern, multi-select; rows show a colored dot + method name + checkbox.
- **Amount dropdown** — **one** slider line (a single track with **two thumbs**: min + max). Track =
  `--color-brand-elevated`; the selected span between thumbs is filled red. Below it, **two manual number
  inputs** (Minimum / Maximum, mono font, EGP suffix) that are fully editable and stay in sync with the
  thumbs. **There are no quick-range preset chips** (removed). The "0 – 10,000 EGP" readout is red and live.
  - Implementation note: the dual-thumb is two stacked `<input type=range>` with the inputs
    `pointer-events:none` and only the **thumbs** `pointer-events:auto`; set `accent-color:transparent` so
    the native fill doesn't draw a second line (this was a real bug — there must be exactly **one** visible
    track line). Prefer a single Base UI `Slider` with two thumbs if available; match the visual exactly.
- **All-filters sheet** (the 42px filter icon) — contains all three sections at once: Category as a 2-col
  grid of the same selectable rows, Payment as a column of rows, and the same single dual-thumb amount
  slider + manual inputs. Header "Filters" + "Reset all" (red). Footer "Show N results" (red).

---

## 10. Income screen (full spec)

Vertical order inside `padding:14px 16px 130px`:

1. **Header row**: month switcher pill (same component as Expenses — income is month-scoped) +
   **Add source** red filled button (`flex:1`, 40px, Plus). Add source is a real button, not a text link.
2. **Income card** (green-tinted gradient, rounded-20): "MONTHLY INCOME" + big **green** mono total
   (38,500 EGP) + optional USD; TrendingUp chip top-right; a divider; then two inline stats —
   **Recurring** (RefreshCw, count) and **One-time this month** (Plus, count).
3. **Recurring sources** (shown **first**) — list of source cards: 42px icon chip · name · "freq · → account" ·
   right `+amount` green mono with "EGP / mo".
4. **Added this month** — one-time income cards: same layout but subtitle "date · → account" and footer
   "EGP · one-time" (no "/mo").
5. **Income this month** — a transactions card listing **all** incoming money for the month (recurring
   received + one-time), each row: TrendingUp chip · name · "date · Recurring|One-time" · `+amount` green mono.

Data shape: `incomeRecurring[]`, `incomeOneTime[]`, `incomeTxns[]`, plus `recurringCount` / `oneTimeCount`.
Pull real values from the live income store; the reference uses representative sample data. Recurring sources
**must render before** one-time additions.

---

## 11. Icons — migrate to Lucide

The reference draws icons from an inline SVG sprite (`#i-*`). In the app use **`lucide-react`** (already a
dependency), 1.75–2px stroke, never filled. Mapping:

| sprite | Lucide | | sprite | Lucide |
|---|---|---|---|---|
| `i-home` | `LayoutDashboard` | | `i-receipt` | `Receipt` |
| `i-plus` | `Plus` | | `i-minus` | `Minus` |
| `i-landmark` | `Landmark` | | `i-menu` | `Menu` |
| `i-wallet` | `Wallet` | | `i-coins` | `Coins` |
| `i-bar` | `BarChart3` | | `i-settings` | `Settings` |
| `i-sliders` | `SlidersHorizontal` | | `i-x` | `X` |
| `i-cr` | `ChevronRight` | | `i-cl` | `ChevronLeft` |
| `i-mic` | `Mic` | | `i-camera` | `Camera` |
| `i-dollar` | `DollarSign` | | `i-card` | `CreditCard` |
| `i-spark` | `Sparkles` | | `i-file` | `FileText` |
| `i-user` | `User` | | `i-users` | `Users` |
| `i-logout` | `LogOut` | | `i-pencil` | `Pencil` |
| `i-trash` | `Trash2` | | `i-refresh` | `RefreshCw` |
| `i-download` | `Download` | | `i-trend` | `TrendingUp` |
| `i-check` | `Check` | | `i-clock` | `Clock` |
| `i-updown` | `ArrowUpDown` | | `i-list` | `List` |
| `i-grid` | `LayoutGrid` | | `i-pie` | `PieChart` |
| `i-utensils` | `UtensilsCrossed` | | `i-bus` | `Bus` |
| `i-gamepad` | `Gamepad2` | | `i-package` | `Package` |
| `i-briefcase` | `Briefcase` | | `i-laptop` | `Laptop` |
| `i-building` | `Building2` | | `i-gem` | `Gem` |
| `i-umbrella` | `Umbrella` | | `i-car` | `Car` |
| `i-shield` | `Shield` | | `i-target` | `Target` |

Icon sizes from the reference: nav 23px, card/list chips 17–20px, inline 14–16px, FAB/orb 19–26px. Keep them.

---

## 12. Debts screen (in scope via §1? — included refinements)

> Debts wasn't in the numbered share-list, but the requested debt changes are implemented in the reference;
> include them if you ship Debts. Summary: the overview card shows **total owed + a "{N} active debts" pill**;
> **Add debt** is a **red** filled button; per-card **Record payment** is **green** (paying down = positive);
> below "Payment history" there are **Pending** (amber clock) and **Completed** (green check, struck-through
> amount) debt-history sections.

---

## 13. Zero-deviation checklist

Before calling any screen done, confirm against `Buddget Mobile Redesign.dc.html`:

- [ ] Colors come from `var(--color-brand-*)` tokens; both `.dark` and light render correctly (only these two themes).
- [ ] DM Sans everywhere; JetBrains Mono (`tabular-nums`) on **every** number/amount/percent/count and the amount inputs.
- [ ] Radii, paddings, gaps, font-sizes, weights match the reference literally.
- [ ] Buddgy uses the **robot mascot** (`assets/buddgy-square.png` clipped) on the orb and chat header — red, draggable, edge-snapping; chat sheet fully red.
- [ ] + menu = grid layout, 5 exact items/colors, red glowing voice tip, no Ask-AI item.
- [ ] Expenses: red **Add expense** button, month switch + export present, parent filter chips, dense list, no sort, no view toggle.
- [ ] Amount filter = **one** slider line (two thumbs) + editable Min/Max number inputs, **no preset chips**.
- [ ] Category & Payment filters are **multi-select** with red check boxes.
- [ ] Profile menu: avatar shown, **Settings present**, **Switch account removed** (avatar chosen in Profile Settings, not the menu).
- [ ] More menu: **Settings removed**.
- [ ] Income: month switch, card with monthly total + recurring/one-time counts, recurring-first ordering, one-time section, full income-transactions list, **Add source** button.
- [ ] All icons are Lucide per §11; stroke 1.75–2px, never filled.
- [ ] Sheets/orb use the specified Framer Motion easings; nothing loops.
- [ ] Safe-area insets restored on fixed chrome.

**Out of scope untouched:** Home/Dashboard, Savings, Reports, Subscriptions, Budget setup.


---

## Files in this bundle
- `README.md` — this document (the complete implementation spec + prompt).
- `Buddget Mobile Redesign (reference).html` — self-contained, viewable dark-mode reference.
- `Buddget Mobile Redesign.dc.html` — source markup (source of truth for exact values).
- `assets/buddgy-square.png` — Buddgy mascot, brand-red square (maroon trimmed). Clip to circle (orb) / rounded-square (chat chip, app icon).
- `assets/buddgy-cutout.png` — Buddgy mascot on transparent background (best-effort). Use on non-red surfaces. If a true alpha master exists, swap it in.
- `assets/buddgy-master.jpg` — original 768² master art.
- `screenshots/` — reference captures of every in-scope screen/state (dark mode), listed below.

## Screenshots (in `screenshots/`)
Each is a full-device capture at the design's native scale. Use them as the visual ground truth alongside the live reference.
- `expenses-main.png` — Expenses: header (month switch + export), stats card with **Add expense**, parent filter chips, dense day-grouped list.
- `expenses-filter-category.png` — Category dropdown (multi-select, red checkboxes).
- `expenses-filter-payment.png` — Payment-method dropdown (multi-select).
- `expenses-filter-amount.png` — Amount dropdown: **single** dual-thumb slider + editable Min/Max inputs, no presets.
- `expenses-all-filters.png` — All-filters sheet (Category grid + Payment rows + amount slider).
- `quick-add-menu.png` — + menu, **grid** layout (5 tiles + red voice tip). Grid is the shipped default.
- `more-menu.png` — More menu (Settings intentionally absent — it moved to the profile menu).
- `profile-menu.png` — Profile dropdown: avatar + Edit profile / Settings / Sign out (no avatar picker, no Switch account).
- `income.png` — Income: month switch, **Add source**, monthly total + Recurring/One-time counts, recurring sources, day-grouped income history with badges.
- `buddgy-chat.png` — Buddgy AI sheet (robot mascot header, red throughout). The floating red orb is visible on the income/expenses shots.

> The header + bottom nav (footer) appear in every screenshot; the home/dashboard, savings, reports,
> subscriptions, and budget screens are **out of scope** and are not captured.

## Assets origin
The Buddgy mascot derives from the user-provided master (`assets/buddgy-master.jpg`). The square and cutout
variants were generated from it. All other iconography is **Lucide** (see the icon table above) — no custom
SVG assets are required beyond the mascot. The user avatar swatches are generated gradients (placeholders);
replace with the real signup avatar set if available.
