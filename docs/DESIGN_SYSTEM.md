# Buddget Design System

Single source of truth for all UI/UX work. Read this before writing or modifying any component.

---

## Colors

All colors are CSS custom properties set in `src/app/globals.css`. Always use the variable name in Tailwind (`var(--color-brand-*)`) — never hardcode hex values.

### Brand Palette

**Teal is the brand and every primary action. Red does exactly one job: destructive
actions and over-budget alerts.** It is never a CTA colour. (Revamp Kit v1, 2026-09-28 —
this replaced a red-primary system; if you find red on a Save/Add/Confirm button, it is a
leftover, not a decision.)

| Token | CSS Variable | Light | Dark | Usage |
|---|---|---|---|---|
| **Primary (brand)** | `--color-brand-primary` | `#12B0A0` | `#1FC3B2` | Brand, all primary CTAs, active nav, FAB |
| Primary hover | `--color-brand-primary-hover` | `#0E9384` | `#35D4C3` | Hover on a teal fill |
| **Primary ink** | `--color-brand-primary-ink` | `#0B7568` | `#7FE6DA` | Teal **text** and links — see the contrast warning below |
| Primary soft | `--color-brand-primary-soft` | `#E3F6F3` | `#0F2723` | Teal tint backgrounds, icon chips |
| **On primary** | `--color-brand-on-primary` | `#04201C` | `#04201C` | Anything sitting **on** a teal fill |
| Red (destructive) | `--color-brand-red` | `#C0323A` | `#F2646A` | Delete, destructive confirm, over budget |
| Red hover | `--color-brand-red-hover` | `#A82A31` | `#F87C81` | Hover on destructive |
| Red soft | `--color-brand-red-soft` | `#FBE7E7` | `#3A1B1D` | Destructive badge background |
| Green | `--color-brand-green` | `#0F7A36` | `#37C368` | Income, received, success |
| Green soft | `--color-brand-green-soft` | `#E3F5EA` | `#123021` | Positive badge background |
| Amber | `--color-brand-amber` | `#8A5B0A` | `#EDB24A` | Warning, due soon, late |
| Amber soft | `--color-brand-amber-soft` | `#FBF0DA` | `#33280F` | Warning badge background |
| Gold | `--color-brand-gold` | `#96701A` | `#EDC463` | Investment, gold holdings |
| Focus ring | `--color-brand-focus` | `#12B0A0` | `#1FC3B2` | Focus rings (now brand teal) |

> ⚠️ **`--color-brand-primary` fails contrast as text** — 2.71:1 on white. Use it for fills,
> borders and icon glyphs only. For teal **text** use `--color-brand-primary-ink` (5.59:1);
> on a teal **fill** use `--color-brand-on-primary` (6.30:1).
>
> Every light-mode value above was adjusted from the source mockup to clear WCAG AA. The
> mockup's own values failed in six places. Do not "restore" them from the mockup.

### Category Ramp

For charts and category chips. Six steps, fixed order.

| Token | Light | Dark |
|---|---|---|
| `--color-cat-1` | `#0E9384` | `#1FC3B2` |
| `--color-cat-2` | `#96701A` | `#EDC463` |
| `--color-cat-3` | `#C4472D` | `#F27E66` |
| `--color-cat-4` | `#4952C8` | `#8A94F5` |
| `--color-cat-5` | `#1E73A8` | `#57B2ED` |
| `--color-cat-6` | `#6D3FC4` | `#A17DF9` |

### Surface Palette

Green-tinted neutrals, not grey — they sit under a teal brand.

| Token | CSS Variable | Light | Dark | Usage |
|---|---|---|---|---|
| Background | `--color-brand-bg` | `#F4F7F6` | `#0A100F` | Page background |
| Card | `--color-brand-card` | `#FFFFFF` | `#111917` | Card surfaces |
| Elevated | `--color-brand-elevated` | `#ECF1F0` | `#18211F` | Inputs, chips, secondary surfaces |
| Sunken | `--color-brand-sunken` | `#E2E9E8` | `#212C2A` | Track backgrounds, wells |
| Border | `--color-brand-border` | `#DDE6E4` | `#25302E` | Dividers, card borders |
| Border strong | `--color-brand-border-strong` | `#CBD6D3` | `#33403D` | Emphasised dividers, grab handles |

### Elevation

The kit replaced the old glass-blur card identity with a three-step shadow scale.
`--shadow-sm` (resting cards) · `--shadow-md` (raised) · `--shadow-lg` (modals, phones).
The `.glass-card` utility still exists for overlays but is no longer the default card look.

### Text Palette

| Token | CSS Variable | Light | Dark | Usage |
|---|---|---|---|---|
| Primary | `--color-brand-text-primary` | `#0D1A18` | `#EAF2F0` | Headings, primary labels |
| Secondary | `--color-brand-text-secondary` | `#566B68` | `#9BABA8` | Supporting text, subtitles |
| Muted | `--color-brand-text-muted` | `#63726F` | `#7A8A87` | Placeholders, timestamps, hints |

### Chart Palette (in order)

Mirrors the category ramp — `--chart-1…5` and `--color-cat-1…5` hold the same values, so a
chart series and its category chip always agree.

| Slot | Light | Dark |
|---|---|---|
| chart-1 | `#0E9384` | `#1FC3B2` |
| chart-2 | `#96701A` | `#EDC463` |
| chart-3 | `#C4472D` | `#F27E66` |
| chart-4 | `#4952C8` | `#8A94F5` |
| chart-5 | `#1E73A8` | `#57B2ED` |

### Glass Modifier

`.glass-card` still exists for translucent overlays, but glass is **no longer the default card
look** — cards are solid surfaces with `--shadow-sm`. Reach for glass deliberately, not by habit.
- Light: `rgba(255,255,255,0.7)` + `backdrop-filter: blur(12px)`
- Dark: `rgba(26,26,36,0.8)` + `backdrop-filter: blur(12px)`

---

## Typography

Fonts are loaded via `next/font/google` in `src/app/layout.tsx`.

| Role | Font | Weights | CSS Variable | Tailwind class |
|---|---|---|---|---|
| Body / UI | DM Sans | 300, 400, 500, 600, 700 | `--font-sans` | `font-sans` (default on `<body>`) |
| Headings | DM Sans | 600, 700, 800 | `--font-heading` | `font-heading` |
| Monospace / Numbers | JetBrains Mono | 400, 500, 600 | `--font-mono` | `font-mono-numbers` |
| Arabic body | IBM Plex Sans Arabic | 300, 400, 500, 600, 700 | `--font-sans-ar` | applied via `html[data-locale='ar']` |

### Scale guidance

| Element | Size | Weight | Class pattern |
|---|---|---|---|
| Page title | `text-2xl` / `text-3xl` | 700 | `font-heading font-bold` |
| Section header | `text-base` / `text-lg` | 600 | `font-semibold` |
| Body text | `text-sm` | 400 | (default) |
| Supporting / label | `text-xs` | 400–500 | `text-[var(--color-brand-text-secondary)]` |
| Muted hint | `text-xs` | 400 | `text-[var(--color-brand-text-muted)]` |
| Currency / numbers | any | 500–600 | `font-mono-numbers` |
| Small caps label | `text-[10px]` uppercase | 500 | `uppercase tracking-wider` |

### Arabic locale rules

- Body font switches to IBM Plex Sans Arabic automatically via `html[data-locale='ar']`.
- Numeric values (amounts, dates) keep `direction: ltr` via `font-mono-numbers` (`unicode-bidi: isolate`).
- Prose blocks that should align to the end use `.prose-rtl` (`text-align: end`).
- UI layout stays LTR throughout; `dir` on `<html>` is always `ltr`.

---

## Spacing & Layout

### Base unit

Tailwind's default 4px base unit. Use the standard scale (`p-2` = 8px, `p-4` = 16px, `p-6` = 24px).

### Page wrapper

```
px-4 (16px horizontal padding) — standard page gutters
max-w-screen-sm mx-auto — center on wide screens
```

### Card padding

```
p-4   — compact card (list items, chips)
p-5   — standard card
p-6   — generous card (dashboard summary blocks)
```

### Stack gaps

```
gap-2  (8px)  — between tight items in a row
gap-3  (12px) — between form fields, list rows
gap-4  (16px) — between sections within a card
gap-6  (24px) — between cards / major page sections
```

### Input height

**All form inputs, selects, and trigger buttons must be `h-12` (48px).** This exceeds the 44px minimum and ensures comfortable tapping on mobile. Do not use `h-10` or `h-8` for tappable inputs.

---

## Border Radius

Base radius: `--radius: 0.75rem` (12px). The steps are re-derived so existing utility classes
land on the Revamp Kit geometry without touching any component.

| Context | Tailwind class | px | Use for |
|---|---|---|---|
| Buttons, inputs | `rounded-xl` | **12** | All controls — this is the kit's control radius |
| Cards, tiles | `rounded-2xl` | **16** | Top-level containers |
| Sheets (top corners) | `rounded-3xl` | **24** | Bottom-sheet tops |
| Chips, badges, pills | `rounded-full` | 9999 | Status badges, category chips |
| Small controls | `rounded-lg` | 12 | Toggles, small icon buttons |
| FAB | — | **18** | 54×54px rounded square, 4px ring in the nav surface |

---

## Iconography

Icons are **Lucide**, outline only, 1.75–2px stroke, never filled.

**Two product rules, both absolute:**

- 🚫 **Never a pig.** `PiggyBank` is banned product-wide for savings or any other concept.
  The canonical savings glyph is **`Coins`** — what the bottom nav uses. It is deliberately
  absent from `OTHER_SAVINGS_ICON_KEYS`; a legacy alias in `SavingsAccountIcon` maps any
  imported `'PiggyBank'` value onto `Coins` so old backups still render.
- 🚫 **No notification bell on native.** The mobile header is avatar + greeting only. A bell
  belongs only where a web surface genuinely needs it.

---

## Safe Area Insets (Mobile / Capacitor)

All wrappers that touch screen edges must apply safe area padding. These classes map to `env(safe-area-inset-*)` with a `0px` fallback for non-notched devices.

| Class | Property | Use when |
|---|---|---|
| `.safe-area-top` | `padding-top` | Fixed headers, status-bar-adjacent elements |
| `.safe-area-bottom` | `padding-bottom` | Fixed bottom navs, FABs |
| `.safe-area-start` | `padding-inline-start` | Left-edge elements (LTR) |
| `.safe-area-end` | `padding-inline-end` | Right-edge elements (LTR) |
| `.safe-area-x` | Both inline | Full-width edge-to-edge containers |

### Platform-specific auto-rules (already in globals.css)

- **iOS** (`body.platform-ios`): `main` gets `padding-top: max(env(safe-area-inset-top), 0px)`. Fixed `.top-0` headers also get `padding-top` safe-area. Bottom nav gets `padding-bottom: max(env(safe-area-inset-bottom), 0.25rem)`.
- **Android** (`body.platform-android`): Bottom nav gets `padding-bottom: max(env(safe-area-inset-bottom), 0.25rem)` for gesture navigation pill clearance.

Do not add manual `pt-*` values to compensate for the status bar — the platform class handles it.

---

## Touch Targets

**Minimum interactive area: 44×44px on all platforms.**

Rules:
- All `<button>`, `<a>`, `[role="button"]` elements must be at least `min-h-[44px] min-w-[44px]`.
- Form inputs use `h-12` (48px height) — satisfies the minimum automatically.
- Icon-only buttons must have explicit size: `h-11 w-11` minimum, or pad with `p-2.5` around a smaller icon.
- Use `touch-none` on draggable elements (e.g. sliders, drag-to-cancel) to prevent scroll interference.
- Use `.no-tap-highlight` or `select-none` on non-text interactive surfaces to remove the default blue flash on Android.

---

## Component Blueprints

### Primary Button

```tsx
<button className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-brand-red)] px-4 py-2.5 text-sm font-semibold text-white min-h-[44px] hover:bg-[var(--color-brand-red-hover)] transition-colors disabled:opacity-50">
```

### Secondary / Ghost Button

```tsx
<button className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-brand-border)] px-4 py-2.5 text-sm text-[var(--color-brand-text-secondary)] min-h-[44px] hover:bg-[var(--color-brand-elevated)] transition-colors">
```

### Text Input

```tsx
<input className="h-12 w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 text-sm text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-focus)]/55" />
```

### Card

```tsx
<div className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-5">
```

### Elevated / Inner Card

```tsx
<div className="rounded-xl bg-[var(--color-brand-elevated)] p-4">
```

### Badge / Chip

```tsx
<span className="inline-flex items-center rounded-full bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-brand-text-secondary)]">
```

### Section Label (small caps)

```tsx
<p className="text-[10px] uppercase tracking-wider font-medium text-[var(--color-brand-text-muted)]">
```

### Currency Amount

```tsx
<span className="font-mono-numbers font-semibold text-[var(--color-brand-text-primary)]">
```

### Icon Button (touch-safe)

```tsx
<button className="flex h-11 w-11 items-center justify-center rounded-xl text-[var(--color-brand-text-muted)] hover:bg-[var(--color-brand-elevated)] hover:text-[var(--color-brand-text-primary)] transition-colors">
  <Icon className="h-5 w-5" />
</button>
```

---

## Scrollable Containers

```tsx
// Hide scrollbar but keep scroll function
<div className="overflow-y-auto hide-scrollbar native-scroll">

// native-scroll = -webkit-overflow-scrolling: touch + overscroll-behavior-y: contain
```

---

## Native Shell Behavior (`body.platform-native`)

When running inside Capacitor:
- Tap highlight: disabled (`-webkit-tap-highlight-color: transparent`)
- Long-press callout: disabled
- User selection: disabled on all elements except `input`, `textarea`, `[contenteditable]`
- Overscroll bounce: disabled on body

Do not fight these rules by adding `select-text` or `webkit-user-select: text` outside of editable fields.

---

## Enforcement Checklist

Before shipping any UI component, verify:

- [ ] Only `var(--color-brand-*)` tokens used — no hardcoded hex colors
- [ ] All interactive elements are `min-h-[44px] min-w-[44px]`
- [ ] Inputs use `h-12` height
- [ ] Cards use `rounded-2xl`, inputs/buttons use `rounded-xl`
- [ ] Edge-adjacent fixed elements use `.safe-area-top` / `.safe-area-bottom`
- [ ] Numeric/currency values use `font-mono-numbers`
- [ ] Dark mode visually verified (class toggled, or browser DevTools forced dark)
- [ ] Arabic locale visually verified if text is user-facing
