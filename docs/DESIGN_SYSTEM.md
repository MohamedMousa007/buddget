# Buddget Design System

Single source of truth for all UI/UX work. Read this before writing or modifying any component.

---

## Theme default

**Light is the product default.** A user with no stored preference — including one whose browser
blocks storage — gets light. Dark is opt-in via Settings. Both themes are complete and equally
supported; `.dark` on `<html>` is the switch, set before first paint by the inline theme script.

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
| **Primary (fill)** | `--color-brand-primary` | `#0D8578` | `#1FC3B2` | Buttons, FAB, active nav — the fill that text sits on |
| **Primary bright** | `--color-brand-primary-bright` | `#12B0A0` | `#1FC3B2` | The kit's identity teal. Chart marks, icon glyphs, decorative fills — **never** under text |
| Primary hover | `--color-brand-primary-hover` | `#0B7568` | `#35D4C3` | Hover on a teal fill |
| **Primary ink** | `--color-brand-primary-ink` | `#0B7568` | `#7FE6DA` | Teal **text** and links — see the contrast warning below |
| Primary soft | `--color-brand-primary-soft` | `#E3F6F3` | `#0F2723` | Teal tint backgrounds, icon chips |
| **On primary** | `--color-brand-on-primary` | `#FFFFFF` | `#04201C` | Anything sitting **on** a teal fill |
| Red (destructive) | `--color-brand-red` | `#C2353B` | `#F2646A` | Delete, destructive confirm, over budget |
| Red hover | `--color-brand-red-hover` | `#A82A31` | `#F87C81` | Hover on destructive |
| Red soft | `--color-brand-red-soft` | `#FBE7E7` | `#3A1B1D` | Destructive badge background |
| Green | `--color-brand-green` | `#107E38` | `#37C368` | Income, received, success |
| Green soft | `--color-brand-green-soft` | `#E3F5EA` | `#123021` | Positive badge background |
| Amber | `--color-brand-amber` | `#93630B` | `#EDB24A` | Warning, due soon, late |
| Amber soft | `--color-brand-amber-soft` | `#FBF0DA` | `#33280F` | Warning badge background |
| Gold | `--color-brand-gold` | `#977019` | `#EDC463` | Investment, gold holdings |
| Focus ring | `--color-brand-focus` | `#12B0A0` | `#1FC3B2` | Focus rings (now brand teal) |

> ⚠️ **`--color-brand-primary-bright` (`#12B0A0`) is the kit's identity teal but cannot carry
> text** — white on it is only 2.71:1. That is why the light-mode button FILL is teal-700
> (`#0B7568`, white text at 5.59:1) while the bright teal stays for chart marks, icon glyphs and
> decorative fills. Dark mode keeps the kit's own pairing (`#04201C` on `#1FC3B2`, 7.74:1).
>
> Light-mode values are the **minimum darkening from the kit that clears WCAG AA** — computed,
> not eyeballed, so they stay as close to the source mockup as accessibility allows. The kit's own
> light values failed AA in six places. Do not "restore" them from the mockup.

### Category Ramp

For charts and category chips. Six steps, fixed order.

Light values keep the kit's exact colour wherever it already clears 3:1 as an icon glyph on
white — only cat-1, cat-2 and cat-5 needed nudging.

| Token | Light | Dark | vs kit (light) |
|---|---|---|---|
| `--color-cat-1` | `#11A596` | `#1FC3B2` | 6% darker (2.71 → 3.07) |
| `--color-cat-2` | `#B68E30` | `#EDC463` | 20% darker (1.96 → 3.04) |
| `--color-cat-3` | `#E5684D` | `#F27E66` | **kit value, unchanged** (3.27) |
| `--color-cat-4` | `#6E7BF2` | `#8A94F5` | **kit value, unchanged** (3.63) |
| `--color-cat-5` | `#389BD9` | `#57B2ED` | 3% darker (2.88 → 3.06) |
| `--color-cat-6` | `#8B5CF6` | `#A17DF9` | **kit value, unchanged** (4.23) |

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
| Muted | `--color-brand-text-muted` | `#687371` | `#748380` | Placeholders, timestamps, hints |

### Chart Palette (in order)

Mirrors the category ramp — `--chart-1…5` and `--color-cat-1…5` hold the same values, so a
chart series and its category chip always agree.

| Slot | Light | Dark |
|---|---|---|
| chart-1 | `#11A596` | `#1FC3B2` |
| chart-2 | `#B68E30` | `#EDC463` |
| chart-3 | `#E5684D` | `#F27E66` |
| chart-4 | `#6E7BF2` | `#8A94F5` |
| chart-5 | `#389BD9` | `#57B2ED` |

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
- Icon-only buttons use `<IconButton>`, which keeps a 44px hit area at every size —
  including `size="sm"`, whose glyph is 32px but whose target is not. Do not hand-roll
  `h-11 w-11`; the guard in `noStyledRawButtons.test.ts` will fail it.
- `IconButton size="sm"`'s hit area reaches ~6px past the glyph. Space adjacent ones
  `gap-1`+, and prefer `size="md"` for anything destructive, so it cannot swallow a tap
  meant for the row it sits in.
- Use `touch-none` on draggable elements (e.g. sliders, drag-to-cancel) to prevent scroll interference.
- Use `.no-tap-highlight` or `select-none` on non-text interactive surfaces to remove the default blue flash on Android.

---

## Component Blueprints

**Do not hand-roll a button.** Every shape below already exists as a component, and
`src/components/ui/noStyledRawButtons.test.ts` fails the build if a raw `<button>`
re-declares a fill, a border, a radius or its own size. That guard exists because
this section used to show class strings instead of components, and 359 hand-rolled
buttons in 271 distinct styles grew out of copying them.

| You need | Use | Notes |
|---|---|---|
| A text action | `<Button>` | `size="touch"` 44px, `size="cta"` 48px, `size="cta-block"` full width. `xs`/`sm` are desktop density — admin only. |
| An icon-only action | `<IconButton>` | Requires `aria-label` in its type. 44px hit area at every size. |
| One choice among several, inline | `<OptionChip>` | `selected` drives the teal tint and `aria-pressed`. `size="segment"` for an equal-width row. |
| A fixed set of 2–4 exclusive choices | `<SegmentedControl>` | Owns the radiogroup and arrow keys. Prefer over chips when the set is fixed. |
| A card-shaped choice | `<SelectableCard>` | `as="radio" \| "checkbox" \| "action"` picks the ARIA. |
| A category / type tile | `<AccentTile>` | The one control tinted by the item's own colour, not the brand. |
| A trigger that must look like an input | `<FieldButton>` | Height tracks `Input size="brand"`, so it lines up in a form column. |
| A tap-to-dismiss backdrop | `<Scrim>` | A real button, so it is keyboard reachable. |
| An on/off switch | `<Switch size="touch">` | 44×24. The smaller sizes are desktop density. |

### The two surfaces

`OptionChip` and `SelectableCard` default to **`surface="elevated"`** because
`ModalShell` panels are `--color-brand-card`: a card-filled chip inside a sheet is
white on white in light mode, readable only by its border. Pass `surface="card"`
only for a control resting on the page background.

### Selection is never colour alone

A selected chip or card changes its **fill and its border**, and announces itself
through `aria-pressed` (a toggle) or `aria-checked` (a radio or checkbox). A
`radio`/`checkbox` role needs a wrapping `role="radiogroup"` / `role="group"` with
an `aria-label`.

### Text Input

```tsx
<Input size="brand" />   // 48px, matching FieldButton
```

### Card

```tsx
<Card>…</Card>                          // the standard surface
<Card variant="elevated">…</Card>       // a card on a card
<Card render={<ul />} padding="none" divide>…</Card>
```

### Section Label (small caps)

```tsx
<p className="text-[10px] uppercase tracking-wider font-medium text-[var(--color-brand-text-muted)]">
```

### Currency Amount

```tsx
<span className="font-mono-numbers font-semibold text-[var(--color-brand-text-primary)]">
```

### When a raw `<button>` is still right

Two cases, and the guard allows both:

1. The classes are **layout only** — `flex-1 text-start min-w-0` on a region that is
   tappable as a whole. Wrapping that in a component is ceremony.
2. The control genuinely has no shared shape — a keypad key, a calendar cell, a
   carousel dot, a swipe-action panel, the centre FAB. Mark it:

```tsx
<button data-raw-button-ok="a day-number cell in a month grid" …>
```

The value is the reason. When it stops being true, the control belongs on a primitive.

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
