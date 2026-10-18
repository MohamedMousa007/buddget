# Prompt for Claude Code

You are implementing the redesigned **Subscriptions** feature in Buddget (offline-first personal finance, iOS/Android/web, Egypt, base currency EGP). The design is final and approved. Match it exactly.

## Inputs (all in this folder)
- `screens/*.png`: pixel reference, 2x. Treat as the source of truth for layout and copy.
- `SPEC.md`: measurements, tokens, components, states, data model, copy (EN + AR), behaviours, acceptance checklist.
- `html/Subscriptions-prototype-standalone.html`: open in a browser to feel the flow (add, mark paid, pause, cancel, SMS detection).
- `source/SubScreen.dc.html`: exact inline styles for every frame. Read it for spacing and colour tokens.
- `source/uploads/catalog.json`, `catalog.md`, `CHANGES.md`, `AUDIT.md` and the logo files: Egypt catalog and current-UI audit.
- `docs/DESIGN_SYSTEM.md` in the repo: non-negotiable rules.

## Task
1. Read `docs/DESIGN_SYSTEM.md`, `AUDIT.md`, then the current Subscriptions code. List what will be replaced, what is reused, and any data-model change before writing code.
2. Replace the Subscriptions UI with the new design:
   - Home with the 191 px hero band (same band in loading, empty and data states), segmented control Upcoming · All · Ended, timeline groups (Overdue, This week, This month, Later, Yearly), collapsed Paused and Cancelled.
   - Desktop (lg+): one container, primary column plus 22 rem rail (30-day dot strip, max two insight cards), 1 px hairlines, add and detail as centred dialogs (max 28 rem).
   - First-run empty: six brand tiles with prefilled prices, primary **Add subscription**, secondary **Scan my SMS**.
   - SMS detection prompt and sheet (confidence meter, dates seen, SMS excerpt, link-to-existing line, Not a subscription / Add, pinned **Add N subscriptions**).
   - Add flow step 1 (search, category chips with Lucide icons, no recents, region-aware brand grid, Custom tile) and step 2 (plan cards, amount + currency + EGP estimate, first charge date, cycle, payment method, tracking mode, reminder switch, collapsed More, impact line above one pinned CTA).
   - Detail sheet and the eight lifecycle states, edit (same configure sheet, prefilled), cancel confirm.
   - Budget links: Committed card shows **left to pay this month** from real due dates plus a separate **Set aside for yearly plans** line; Subscriptions entry row and plan row; Quick add tile; Flow ledger Subscription chip with link icon.
   - Notifications copy (digest, trial ending, price rise, SMS push) and two settings switches.
3. Use only existing Buddget components and tokens (`Button`, `OptionChip`, `SegmentedControl`, `Switch`, `ModalShell`/`Sheet`, `Card`, `EmptyState`, `OfflineBanner`, `PromptBanner`, `TransactionRow` patterns). Proposals (SubscriptionRow, StatusChip, BrandTile) must compose existing parts and add no tokens.
4. Icon: Lucide `rotate-cw-clock` is the Subscriptions glyph everywhere (stroke 1.75). Never a bell on native, never a pig.
5. Implement behaviour in SPEC.md section 7: tracking modes, lifecycle, price-change detection (>5%), FX estimate, shared plans, two-ledger rule, reminders digest, at-most-one nudge.
6. RTL: layout mirrors in the design frames; follow the app's existing Arabic convention (logical properties `ms-/me-/ps-/pe-/text-start/text-end`), numerals LTR-isolated with `font-mono-numbers`. IBM Plex Sans Arabic.
7. Offline-first: every row, sheet and action works offline; nothing blocks on network.

## Rules
- Tokens only (`--color-brand-*`). No hex, no gradients except the existing hero band, no illustrations, no confetti.
- Teal = brand and every primary action. Red only for the destructive cancel/delete button and the over-plan bar in Budget. Amber for due soon, late, failed, price changed. `primary-bright` never carries text.
- Inputs and buttons 48 px, every tap target 44 px or more, radius 12 / 16 / sheet top 24 / chips full.
- Amounts and dates in `font-mono-numbers`.
- One primary action per surface. Defaults are minimal: row shows logo, name (+plan), next date, tracking icon, status chip, amount. Category split, cost per use, calendar, sharing and FX details stay hidden until asked.
- Do not invent copy. Use SPEC.md section 9 strings (EN and AR).
- Prices from the catalog: show as typical only when confidence is high; otherwise show `≈` and keep editable.

## Deliverables
- Implementation behind the existing Subscriptions routes, with unit tests for: next-charge calculation (month-end clamping, weekly/quarterly/semiannual/yearly), left-to-pay-this-month, yearly set-aside, price-change detection, tracking-mode matching, FX estimate refinement.
- Storybook or screenshot tests for light/dark, EN/AR, mobile (390) and desktop (1440) of: home, empty, SMS sheet, add step 1, configure, detail, each lifecycle state.
- A short migration note for any data-model change, and a list of any deviation from the screenshots with the reason.

Before finishing, walk the acceptance checklist in SPEC.md section 11 and report each item as pass or fail.
