# Buddget Design System

Personal finance management app — expense tracking, budgeting, debt management, savings, subscriptions, and AI-powered SMS/receipt parsing. Ships as an iOS native shell, Android native shell (both via Capacitor), and a web PWA.

**Live app:** https://buddget.app  
**GitHub source:** https://github.com/MohamedMousa007/buddget (Next.js 16, React 19, Tailwind CSS v4, Base UI, Zustand, Supabase)

---

## Sources used

| Asset | Location |
|---|---|
| GitHub codebase | `MohamedMousa007/buddget` (main branch) |
| Global CSS tokens | `src/app/globals.css` (uploaded) |
| Tailwind config | `tailwind.config.ts` (uploaded) |
| App icons | `public/icons/` (uploaded: 16, 32, 192, 512 png + svg) |

> If you have access to the repo, explore `src/components/` for full component implementations and `src/app/` for page-level layouts.

---

## Stack

- **Framework:** Next.js 16, App Router, React 19, TypeScript
- **Styling:** Tailwind CSS v4 (`@import "tailwindcss"` + `@config`) + CSS custom properties
- **Primitives:** Base UI (`@base-ui/react/*`) — Button, Input, Switch, Progress, Tabs, Dialog, Sheet, Tooltip, Popover
- **Icons:** [Lucide React](https://lucide.dev) — outline style, 1.75–2px stroke, 20–24px in nav
- **Motion:** Framer Motion — spring transitions, `whileHover y: -2`, `whileTap scale: 0.92`
- **State:** Zustand + localStorage persistence
- **Fonts:** DM Sans (body + headings), JetBrains Mono (numbers), IBM Plex Sans Arabic

---

## Content Fundamentals

**Tone:** Direct, friendly, no finance jargon. Treats the user as capable — gives the number, gives context, gets out of the way.

**Voice:** Second person ("your budget", "you've spent"). Short sentences. No filler.

**Casing:** Sentence case everywhere. Uppercase is reserved for micro-labels (10px stat captions: "LEFT TO SPEND", "IN", "OUT", "SAVED").

**Numbers:** Always formatted with `Intl.NumberFormat` — locale-aware, tabular figures, 2 decimal places. Compact notation for large values (`1.7k`, `12.4k`).

**Currency:** Displayed inline with the ISO code or symbol adjacent to the figure. Multi-currency: primary large + secondary small muted underneath.

**Emoji:** Used selectively in category lists (🏠 Rent, 🍕 Food, 💳 Debt) and celebration states (debt cleared). Not used in headings or UI chrome.

**Error copy:** Factual, non-blaming. "This amount exceeds your budget" — not "Invalid amount".

---

## Visual Foundations

### Colors
Dark-first product. Near-black canvas (`#0A0A0F`), raised card (`#111118`), elevated surface (`#1A1A24`). A single bold accent — **brand red `#E50914`** — is used for the primary action, FAB, active nav, focus rings, and all primary CTAs. Gold (`#F5C842`) = savings. Green (`#1DB954`) = income. Amber (`#FF9F0A`) = warnings.

### Typography
- **DM Sans** for all body, UI, and headings — a geometric grotesque with good optical sizing at small sizes on dark.
- **JetBrains Mono** for every currency figure, percentage, and numeric stat — `font-variant-numeric: tabular-nums` keeps columns aligned.
- Micro-labels are 10px, all-caps, wider tracking (0.06em), `--color-brand-text-secondary`.

### Backgrounds
Flat near-black canvas. No full-bleed imagery. The dashboard hero uses a fixed navy gradient (`#0F172A → #1E293B`) — this is the only non-canvas background in the product. Radial glow blobs appear behind glass cards in some contexts.

### Glassmorphism
The primary surface is `.glass-card`: `backdrop-filter: blur(12px)`, semi-transparent fill, hairline border. Rounded `--radius-2xl`. Used for all dashboard widgets, transaction lists, and debt cards. Glass only reads on a textured background (use over canvas, not flat blocks).

### Radii
Base `0.75rem`. Cards `2xl` (1.35rem). Hero `3xl` (1.65rem). Buttons `lg` (0.75rem). Badges `4xl` full-pill.

### Shadows
Low-spread, dark-tinted: `0 10px 30px -12px rgba(0,0,0,0.55)`. FAB has a red-tinted glow `shadow-red-900/30`.

### Animations
Spring-based via Framer Motion. Cards: `whileHover { y: -2 }`, 200ms ease. FAB: `whileTap { scale: 0.92 }`, spring `stiffness: 400, damping: 22`. Progress/rings: 1s ease-out width/dashoffset animation. Avoid decorative infinite loops.

### Hover / press states
Hover: `background → --color-brand-elevated`. Active press: `transform: translateY(1px)`. Icon button: opacity or elevated bg. Red elements: `--color-brand-red-hover` (slightly brighter in dark, slightly darker in light).

### Borders
Single-pixel `--color-brand-border` (`#2A2A38` dark / `#D4D4DC` light). Glass cards use a rgba hair border. No thick borders used as decorative accents.

### Cards
`glass-card rounded-2xl p-4 sm:p-6`. No outer shadow in default state; `shadow-lg` on hover-interactive cards. Debt and goal cards use `p-6` for more breathing room.

### Iconography — Lucide
All icons are from [Lucide](https://lucide.dev) (`lucide-react`). Stroke-based, 1.75–2px, never filled. Nav icons ~22px; inline icons ~18–20px; micro-indicators ~14–16px. Category icons map to specific glyphs (see `CategoryIcon.tsx` in the repo). Fallback: `<Wallet>`. Load from CDN: `https://unpkg.com/lucide@0.460.0/dist/umd/lucide.min.js`.

### Safe areas & mobile
PWA runs `viewport-fit=cover`. All fixed chrome uses `.safe-area-top` / `.safe-area-bottom` utilities. Bottom nav: `h-16`, fixed, glass blur. iOS status bar uses `black-translucent`. No tap highlight (`-webkit-tap-highlight-color: transparent`).

---

## Category Palette

| Category | bg | text |
|---|---|---|
| Rent / Housing | `#FCEBEB` | `#9B1C1C` |
| Groceries / Food | `#FAEEDA` | `#B8710A` |
| Transport | `#E6F1FB` | `#1E5A9E` |
| Entertainment | `#EEEDFE` | `#5240A8` |
| Shopping | `#FEE6F1` | `#A3165D` |
| Health | `#E1F5EE` | `#0F6B4C` |
| Savings | `#E1F5EE` | `#0F6B4C` |
| Debt | `#FCE7E7` | `#9B1C1C` |

---

## File Index

```
styles.css                     ← Global entry point (@imports only)
tokens/
  fonts.css                    ← Google Font @imports (DM Sans, JetBrains Mono, IBM Plex Arabic)
  colors.css                   ← All color tokens, light + .dark
  typography.css               ← Font families, weights, scale, tracking
  radius.css                   ← Radius + spacing scale
  effects.css                  ← Glass card, shadows, utilities, safe-area helpers
assets/
  logo-app-icon.svg/png        ← Primary app icon (192×192)
  icon-512.png, icon-192.png   ← PWA icons
  icon-32.png, icon-16.png     ← Favicon sizes
components/
  core/     Button · Badge · Card
  forms/    Input · Switch
  feedback/ Progress · BudgetRing
  finance/  MoneyDisplay · KPICard · ExpenseRow
guidelines/
  colors-brand.card.html       ← Brand accent swatches
  colors-surfaces.card.html    ← Dark surface stack
  colors-text.card.html        ← Text hierarchy
  colors-charts.card.html      ← Chart series
  colors-money.card.html       ← In / Out / Saved semantics
  colors-light.card.html       ← Light mode surfaces
  type-families.card.html      ← DM Sans + JetBrains Mono
  type-scale.card.html         ← 10–32px type ramp
  type-numbers.card.html       ← Tabular mono numerals
  spacing-radius.card.html     ← Radius scale
  spacing-scale.card.html      ← 4px spacing ramp
  spacing-glass.card.html      ← Glass card surface demo
  spacing-elevation.card.html  ← Shadow levels
  brand-logo.card.html         ← App icon at multiple sizes
  brand-icons.card.html        ← Lucide icon set
```

---

## Components

All components live under `components/` and are built with React + CSS custom properties (no CSS-in-JS libraries). They are self-contained — each injects its stylesheet once and references only `var(--…)` tokens.

| Component | Group | Purpose |
|---|---|---|
| `Button` | Core | 6 variants · 6 sizes · red primary CTA |
| `Badge` | Core | Full-pill status label with semantic tints |
| `Card` | Core | Glass or solid surface container |
| `Input` | Forms | 32px text field, red focus ring |
| `Switch` | Forms | Red-track toggle, controlled or uncontrolled |
| `Progress` | Feedback | Linear bar — budget usage, debt payoff |
| `BudgetRing` | Feedback | Circular usage gauge — dashboard hero ring |
| `MoneyDisplay` | Finance | Tabular mono currency figure with optional secondary |
| `KPICard` | Finance | Glass stat tile with label, value, trend |
| `ExpenseRow` | Finance | Transaction list row with icon chip, amount, method |

Load via the compiled bundle:
```html
<script src="/_ds_bundle.js"></script>
<script>
  const { Button, Card, KPICard } = window.BuddgetDesignSystem_3e84a0;
</script>
```
