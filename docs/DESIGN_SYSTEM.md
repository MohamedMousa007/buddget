# Buddget Design System

Single source of truth for all UI/UX work. Read this before writing or modifying any component.

---

## Colors

All colors are CSS custom properties set in `src/app/globals.css`. Always use the variable name in Tailwind (`var(--color-brand-*)`) — never hardcode hex values.

### Brand Palette

| Token | CSS Variable | Light | Dark | Usage |
|---|---|---|---|---|
| Red (primary) | `--color-brand-red` | `#E50914` | `#E50914` | CTAs, destructive, accent |
| Red hover | `--color-brand-red-hover` | `#C5070F` | `#F40612` | Button hover state |
| Green | `--color-brand-green` | `#18A349` | `#1DB954` | Income, success, confirm |
| Green hover | `--color-brand-green-hover` | `#12843B` | `#25D067` | Green button hover |
| Gold | `--color-brand-gold` | `#D4A017` | `#F5C842` | Gold price, premium |
| Amber | `--color-brand-amber` | `#E08800` | `#FF9F0A` | Warnings, caution states |

### Surface Palette

| Token | CSS Variable | Light | Dark | Usage |
|---|---|---|---|---|
| Background | `--color-brand-bg` | `#F5F5F7` | `#0A0A0F` | Page background |
| Card | `--color-brand-card` | `#FFFFFF` | `#111118` | Card surfaces |
| Elevated | `--color-brand-elevated` | `#F0F0F4` | `#1A1A24` | Inputs, chips, secondary surfaces |
| Border | `--color-brand-border` | `#D4D4DC` | `#2A2A38` | Dividers, input borders, card borders |

### Text Palette

| Token | CSS Variable | Light | Dark | Usage |
|---|---|---|---|---|
| Primary | `--color-brand-text-primary` | `#1A1A24` | `#FFFFFF` | Headings, primary labels |
| Secondary | `--color-brand-text-secondary` | `#5A5A72` | `#CFCFE0` | Supporting text, subtitles |
| Muted | `--color-brand-text-muted` | `#8A8AA0` | `#9898B0` | Placeholders, timestamps, hints |

### Chart Palette (in order)

| Slot | Light | Dark |
|---|---|---|
| chart-1 | `#E50914` | `#E50914` |
| chart-2 | `#18A349` | `#1DB954` |
| chart-3 | `#D4A017` | `#F5C842` |
| chart-4 | `#E08800` | `#FF9F0A` |
| chart-5 | `#5A5A72` | `#A0A0B8` |

### Glass Modifier

Use `.glass-card` for translucent surfaces (e.g. modals, overlays):
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

Base radius: `--radius: 0.75rem` (12px). All `rounded-*` values derive from this.

| Context | Tailwind class | Approx px | Use for |
|---|---|---|---|
| Cards, sheets, modals | `rounded-2xl` | ~22px | Top-level containers |
| Inputs, inner elements | `rounded-xl` | ~17px | Text inputs, selects, inner cards |
| Buttons | `rounded-xl` | ~17px | Primary and secondary buttons |
| Chips, badges, tags | `rounded-full` | 9999px | Status badges, category chips |
| Small controls | `rounded-lg` | ~14px | Toggles, small icon buttons |
| Avatars | `rounded-full` | 9999px | Profile images |

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
