# Handoff: Buddget Flow + Paydays (direction F1c)

## Overview
Buddget is collapsing Expenses and Income into one tab, **Flow** (Arabic label: **المعاملات**), which becomes the app's main page. Income *setup* moves to a new page, **Paydays** (أيام القبض). This package specifies every screen and state of both, plus the related pieces that change with them: the drop-down prompt stack (SMS review, detected accounts and subscriptions, income matches, late paydays), the + menu, the one-time "Money in" sheet, the New payday sheet, the filters sheet and the profile dropdown.

Bottom nav becomes **Home · Flow · (+) · Debts · More**.

## About the design files
The files in `design/` are **design references built in HTML**. They are prototypes that show the intended look and behaviour, not production code. Recreate them in the Buddget codebase (Next.js + React + Tailwind v4 + the existing `src/components/ui` library and Zustand stores), following its established patterns. Do not copy the HTML. The HTML uses inline styles only because of how the prototype tool works; in the app, use Tailwind utilities with `var(--token)` arbitrary values, as the rest of the codebase does.

## Fidelity
**High fidelity.** Colours, type, spacing, radii, copy and interactions are final. Build pixel-for-pixel against `screenshots/` (390 × 844 phone, 2× PNGs, light and dark). Where a measurement in this README and a screenshot disagree, the README wins.

**Zero deviation rule.** Do not "improve" layouts, copy or spacing. Three areas are explicitly frozen and must be built exactly as shown: the empty states (screens 18, 22, 23), the income detail sheets (11, 12, 13) and the Paydays screens (14–18). If something cannot be built as shown, stop and ask; do not substitute.

## What's in this folder
| File | What it is |
|---|---|
| `README.md` | This file: overview, tokens, global layout, screen index |
| `CLAUDE_CODE_PROMPT.md` | Paste-ready prompt for Claude Code, with a phased build plan and definition of done |
| `COMPONENTS.md` | Component architecture: which existing components change (and how), which are new, their props, and where each is used |
| `SCREENS.md` | Per-screen spec: layout, measurements, components, exact copy, states |
| `BEHAVIOR.md` | Interactions, motion, state machines (prompts/snooze, paydays), calculations, data-model fixes |
| `STRINGS.md` | New and changed i18n keys, EN + AR |
| `screenshots/light/*.png`, `screenshots/dark/*.png` | Full, uncropped 2× captures of every screen: 780 × 1688 (390px), H1 860 × 1688 (430px) |
| `design/Flow F1c Screens.dc.html` | The live prototype (open it inside the design project to see all screens side by side with notes) |
| `assets/flow-tab-icon.svg` | The Flow tab glyph (24px, 1.75 stroke, Lucide idiom) |

## Screen index
| # | Screen | Screenshot |
|---|---|---|
| H1 | Header at ≥ 414px (e.g. 430): Paydays icon + label | `H1-header-430.png` |
| H2 | Header at ≤ 413px (390 shown): Paydays icon only | `H2-header-390.png` |
| P1 | Prompt arrives (stack of 3) | `P1-prompt-arrives.png` |
| P2 | Swipe up to snooze | `P2-swipe-to-snooze.png` |
| P3 | Detected account prompt | `P3-detected-account.png` |
| P4 | Status pill (offline), swipe to hide | `P4-status-pill-swipe.png` |
| 01 | Flow · All · top | `01-flow-all-top.png` |
| 02 | Flow · All · scrolled (sticky strip) | `02-flow-all-scrolled.png` |
| 03 | Flow · In · something to resolve | `03-flow-in-to-resolve.png` |
| 04 | Flow · In · calm (zero payday UI) | `04-flow-in-calm.png` |
| 05 | Flow · Out · two filters | `05-flow-out-filtered.png` |
| 05a | Tap a category chip → ledger filters to it | `05a-tap-category-chip.png` |
| 06 | One day: late salary + refund + decline | `06-one-day-edge-cases.png` |
| 07 | No budget set | `07-no-budget.png` |
| 08 | SMS prompts over Flow | `08-sms-prompts.png` |
| 09 | Review transactions sheet | `09-sms-review-sheet.png` |
| 10 | Offline with captured SMS | `10-offline-captures.png` |
| 11 | Recurring income detail (linked, 3 days late) | `11-recurring-income-detail.png` |
| 12 | One-time income detail | `12-one-time-income-detail.png` |
| 13 | Link to a payday | `13-link-to-payday.png` |
| 14 | Paydays · list | `14-paydays-list.png` |
| 15 | Payday detail · timeline + actions | `15-payday-detail-timeline.png` |
| 16 | New payday sheet | `16-new-payday-sheet.png` |
| 17 | Paydays · reorder | `17-paydays-reorder.png` |
| 18 | Paydays · first run (frozen) | `18-paydays-first-run.png` |
| 19 | + menu | `19-plus-menu.png` |
| 19b | Log money in (one-time) sheet | `19b-money-in-sheet.png` |
| 20 | Profile dropdown (+ Paydays) | `20-profile-menu.png` |
| 21 | Filters sheet · top (date + amount range) | `21-filters-sheet.png` |
| 21b | Filters sheet · scrolled (payment methods + categories) | `21b-filters-scrolled.png` |
| 22 | Empty month (frozen) | `22-empty-month.png` |
| 23 | Nothing matches filters (frozen) | `23-nothing-matches.png` |
| 24 | Loading | `24-loading.png` |

**Screenshot note.** The captures are rendered by a DOM-to-image tool whose font metrics differ slightly from the browser, so a few row titles (e.g. “Half Milli…”, “Aramco divi…”) show an ellipsis that does not happen live. Titles must only truncate when they genuinely overflow. Everything else in the screenshots is exact.

## Design tokens (values from the DS stylesheet)
Use the CSS variables, never the hex. Dark mode is class-based (`.dark`); dark is the primary theme in practice.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-brand-primary` | #0D8578 | #1FC3B2 | Fills: CTAs, FAB, active nav stroke, bars |
| `--color-brand-primary-hover` | #0B7568 | #35D4C3 | Band gradient start (light) |
| `--color-brand-primary-ink` | #0B7568 | #7FE6DA | Teal **text** and links |
| `--color-brand-primary-soft` | #E3F6F3 | #0F2723 | Teal tint backgrounds, icon chips, voice tip |
| `--color-brand-on-primary` | #FFFFFF | #04201C | Content on a teal fill |
| `--color-brand-primary-bright` | #12B0A0 | #1FC3B2 | Decorative only, never text |
| `--color-brand-green` / `-soft` | #107E38 / #E3F5EA | #37C368 / #123021 | Income, received |
| `--color-brand-amber` / `-soft` | #93630B / #FBF0DA | #EDB24A / #33280F | Late, warning, status pill |
| `--color-brand-red` / `-soft` | #C2353B / #FBE7E7 | #F2646A / #3A1B1D | Destructive + over budget **only** |
| `--color-brand-gold` | #977019 | #EDC463 | Savings / investment |
| `--color-brand-bg` | #F4F7F6 | #0A100F | Page |
| `--color-brand-card` | #FFFFFF | #111917 | Cards, sheets, nav |
| `--color-brand-elevated` | #ECF1F0 | #18211F | Chips/tiles inside sheets, bar tracks |
| `--color-brand-sunken` | #E2E9E8 | #212C2A | — |
| `--color-brand-border` | #DDE6E4 | #25302E | Hairlines |
| `--color-brand-border-strong` | #CBD6D3 | #33403D | Grabbers, inactive dots |
| `--color-brand-text-primary` | #0D1A18 | #EAF2F0 | |
| `--color-brand-text-secondary` | #566B68 | #9BABA8 | |
| `--color-brand-text-muted` | #687371 | #748380 | |
| `--color-cat-1…6` | #11A596 #B68E30 #E5684D #6E7BF2 #389BD9 #8B5CF6 | #1FC3B2 #EDC463 #F27E66 #8A94F5 #57B2ED #A17DF9 | Category ramp |
| `--shadow-sm/md/lg` | see DS | see DS | Elevation (no glass) |

**Derived colours used by the Flow band (add these as tokens, see COMPONENTS.md → tokens):**
- `--flow-band-a`: light `var(--color-brand-primary-hover)`; dark `color-mix(in oklab, var(--color-brand-primary) 34%, var(--color-brand-bg))`
- `--flow-band-b`: light `var(--color-brand-primary)`; dark `color-mix(in oklab, var(--color-brand-primary) 50%, var(--color-brand-bg))`
- `--flow-band-fg`: light `var(--color-brand-on-primary)`; dark `var(--color-brand-text-primary)`
- `--flow-band-mix`: `color-mix(in oklab, var(--flow-band-fg) 22%, transparent)` (tracks, chip fills, dividers)
- `--flow-band-line`: `color-mix(in oklab, var(--flow-band-fg) 18%, var(--flow-band-b))` (top/bottom hairline)
- Band background: `linear-gradient(120deg, var(--flow-band-a) 0%, var(--flow-band-b) 100%)`

**Type.** DM Sans for UI. **Every amount, date and percentage** uses `font-mono-numbers` (JetBrains Mono, tabular-nums). Scale used: 10 / 10.5 / 11 / 11.5 / 12 / 12.5 / 13 / 13.5 / 14 / 15 / 17 / 18 / 20 / 24 / 32 px. Section labels: 11px, 700, uppercase, letter-spacing .08em.

**Radius.** Buttons/inputs 12 · cards 16 · prompt cards 20 · sheet tops 24 · chips/pills full · phone-level tiles 10–12 for icon chips.

**Sizes.** Inputs, selects and field triggers are 48px. No tap target under 44 × 44. Ledger hairline inset 82px.

**Icons.** Lucide, outline, 1.75 stroke (2 for small chevrons/checks). Never filled. No pig anywhere (savings = `Coins`). No notification bell in the mobile header.

**RTL.** `dir` stays LTR for Arabic; use logical properties only (`ms-/me-/ps-/pe-`, `start/end`, `border-inline-start`). Labels may wrap to two lines; the header's Paydays label switches to icon-only by measurement, which covers the longer أيام القبض.

## Global layout (all Flow screens)
- Phone reference 390 × 844. Status bar 47px (safe-area-top). Bottom nav 64px + 34px inset = 98px. Scroll content padding-bottom 120px so the last row clears nav + Buddgy button.
- Mobile-first; on wide screens centre at `max-w-screen-sm`.

See `SCREENS.md` for per-screen detail and `BEHAVIOR.md` for motion and logic.
