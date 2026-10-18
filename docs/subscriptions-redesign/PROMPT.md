# Prompt for Claude Design — Subscriptions redesign (Buddget)

Attach with this prompt: `docs/DESIGN_SYSTEM.md`, `AUDIT.md` (current UI inventory, every sheet/field/copy, behaviour spec, bugs), `catalog.json` + `catalog.md` + the `logos/` folder (Egypt catalog, prices, aliases, logo files; `CHANGES.md` lists what changed in the live price check), and screenshots of the live Flow, Wealth, Debts and Budget pages (the pattern to match).

---

## 1. Your job

Redesign the **Subscriptions** feature of Buddget from scratch so it feels like the rest of the app after its minimalist refactor (Flow, Wealth, Debts, Budget): calm, one idea per surface, one primary action, almost no chrome. It must be easy for a first-time Egyptian user, powerful enough for someone with 25 subscriptions, and honest about money (what is actually charged, when, and how it affects the budget).

Deliver: mobile (390 px) and desktop (1440 px) frames, light and dark, English and Arabic (RTL text, numerals stay LTR), for every screen and state in section 6, built only from the existing components and tokens. Add nothing new to the design system unless you list it explicitly as a proposal.

## 2. Product and users

Buddget is an offline-first personal-finance app (iOS, Android, web) for Egypt. Base currency EGP. Users pay for streaming, music, gaming (PS Plus, Game Pass, shared accounts), telecom and home internet (Vodafone, Orange, e&, WE), software and AI tools (often billed in **USD on a card**), gyms, delivery memberships (talabat Pro, Noon One, Uber One, Careem Plus), cloud storage, news, school and club fees. Payments arrive by card, carrier billing, Vodafone Cash, Fawry, InstaPay or cash. The app reads bank/wallet **SMS** to create expenses automatically and links a charge to its subscription when the merchant and amount match.

## 3. Design system (non-negotiable)

- Read `DESIGN_SYSTEM.md`. Tokens only (`--color-brand-*`), never hex. Teal is the brand and every primary action; **red only for destructive actions and over-budget**; amber for due soon/late; green for received/paid; `primary-bright` never carries text.
- DM Sans for UI, JetBrains Mono (`font-mono-numbers`) for every amount and date. Arabic uses IBM Plex Sans Arabic; layout stays LTR, numerals LTR-isolated.
- Radius: controls 12, cards 16, sheet tops 24, chips full. Inputs 48 px, every tap target 44 px+. Cards are solid with `shadow-sm` (no glass by default). Lucide outline icons, 1.75 stroke. Never a pig icon, no bell on native.
- Components to use: `Button` (variants by intent), `IconButton`, `OptionChip`, `SegmentedControl`, `SelectableCard`, `AccentTile`, `FieldButton`, `Input size=brand`, `Card`, `Switch`, `ModalShell` sheets (pinned footer CTA), `CardActionMenu`, `EmptyState`, `StatTile`, `ProgressRing`, `AmountField`/`CurrencyField`. Selection is never colour alone.
- Light theme is the default; dark must be complete.

## 4. The pattern to match (from the live app)

- **Hero band** on every top-level money page, fixed height (191 px: 22 label row, 34.5 number row, 38.75 progress/scale block, 66 stat strip with three cells). Same band in every state (loading, empty, data) so nothing jumps. Content capped to the page container; on desktop the band is full-bleed and its content aligns with the body.
- **Body**: month/period row, a segmented control, a chip row (category chips with a tiny % bar, "?" when not budgeted), then a ledger of rows in a rounded card. Rows are icon tile + title + secondary line + amount.
- **Desktop (lg+)**: one wide container, primary column plus a 22 rem rail, a 1 px hairline between hero and body and between columns, no extra boxes. Phone order is the DOM order. Tablet is a centred phone column.
- Floating **+** FAB opens a quick-add sheet; bottom nav is Flow · Budget · FAB · Wealth · Debts; Subscriptions is reached from the Budget "Committed" card, the sidebar "More" group and the FAB. Prompts (SMS detection, plan change) arrive through the existing dropdown prompt stack.
- Tone: short labels, sentence case, numbers first, no marketing copy.

## 5. Behaviour the design must express (decide these visibly)

1. **A subscription is a forecast until a charge lands.** When the matching SMS/expense arrives (or the user taps "Mark paid"), that cycle shows **Paid** and the forecast is not counted again. Today nothing auto-posts; show a **tracking mode** per subscription with three plain choices: *Match from SMS* (default), *Ask me on the due date* (one-tap Paid / Not yet), *Log automatically* (creates the expense on the due date; SMS adopts it instead of duplicating). Make the current mode visible on the detail sheet and as a small icon on rows.
2. **Lifecycle**: Active · Trial (end date, alerts 2 days before and on the day, excluded from committed totals until it converts) · Paused (no charges, no reminders, one-tap resume) · Cancelled (keeps access until an **ends on** date, then archives; "Resubscribe") · Pending plan change · Price changed (>5%, one-tap adopt, keeps price history) · Overdue/"expected, not seen" (grace, then ask) · Failed payment.
3. **Cycles**: weekly, monthly, quarterly, semiannual, yearly; first/next charge date picker; month-end clamping; yearly shown with monthly equivalent and an optional "set aside per month" line.
4. **Money**: a USD plan shows the dollar price with an EGP estimate (refined by the last real EGP charge) and flags FX drift; shared plans show "my share"; card/BNPL-funded subscriptions follow the app's two-ledger rule (spend counts in the month it's charged).
5. **Budget links** (design these surfaces): Budget "Committed" card shows **left to pay this month** (real due dates, not a /12 average) plus a separate "set aside for yearly plans". Flow ledger shows linked charges with the Subscription chip and a link icon. Budget plan row "Subscriptions" shows actual vs plan. Over-budget uses red only there.
6. **Reminders**: one daily digest, default 3 days before and on the day; 7 days and 1 day for yearly plans and trials; nothing for paused/cancelled. Settings are two switches, not a settings page.
7. **Nudges, at most one at a time**: price rise, trial ending, "Still using X?" (once a month), plan moved up. Dismissible, never red.
8. **Defaults are minimal.** List rows show only logo, name (+plan), next charge date, amount, a status chip. Hide until asked: category split, cost per use, income share, calendar, sharing, FX details.

## 6. Screens and states to design

1. **Subscriptions home**: hero band — label "Due in the next 30 days", big EGP amount, progress bar of paid vs remaining this month, strip of three cells (Monthly equivalent · Per year · Next charge name+date). Segmented control **Upcoming · All · Ended**. Timeline groups: Overdue, This week, This month, Later, Yearly; collapsed Paused and Cancelled. Desktop rail: 30-day mini calendar strip with dots, then at most two insight cards (price changes, trials ending).
2. **First-run empty**: no illustration; a grid of Egyptian brand chips with prefilled EGP prices (tap to add), and a single "Scan my SMS" action that opens the detection card.
3. **SMS detection card** (prompt + full sheet): "Found 3 possible subscriptions", each with logo, merchant, amount, day, confidence, Add / Not a subscription; batch-add; absorbs into an existing manual subscription instead of duplicating.
4. **Add flow, step 1**: search first; category chips (Streaming, Music, Gaming, Telecom & internet, AI & software, Cloud, Fitness, Shopping & delivery, Learning, News, Other); region-aware brand grid with high-res logos; "Custom" tile. Recents on top.
5. **Add flow, step 2 (configure)**: plan picker (cards with price and cycle), amount + currency with EGP estimate line, first charge date, cycle, payment method (card, carrier billing, Vodafone Cash, Fawry, InstaPay, cash, wallet), tracking mode, reminder toggle; a collapsed "More" with trial end, shared with / my share, category, notes. One sticky CTA. Show the new monthly impact ("+EGP 110 / month, Committed becomes …") above the CTA.
6. **Subscription detail sheet**: logo, name, plan, status chip; next three charges; price history sparkline-free list; matched charges list (unlink); tracking mode; actions — Edit, Pause/Resume, Cancel (with the service's cancel hint/link and an "ends on" date), Delete. Cancel confirm is destructive-styled, no dark patterns.
7. **Trial**, **Paused**, **Cancelled (ends on)**, **Price changed**, **Plan changed**, **Overdue/expected-not-seen**, **Failed payment**, **Shared** — each as a row state and a detail state.
8. **Edit** (same configure sheet, prefilled) and **bulk**: multi-select to pause or cancel is out of scope; do not design it.
9. **Desktop**: wide grid with rail; add/detail as centred dialogs (max ~28 rem), same content.
10. **Notifications** copy (digest, trial ending, price rise) and the **SMS push** line.
11. **Arabic/RTL** and **dark** for screens 1, 4, 5, 6.
12. **Loading skeleton** and **offline** (rows work offline; nothing blocks).

## 7. Egypt catalog (attached)

The attached catalog lists 110 services and 214 plans (136 verified live on 2026-10-17, the rest flagged medium/low or unverified) with Arabic and English statement aliases, billing currency, accepted Egyptian payment methods, cancel hints and logo files. **Prices carry a confidence flag and a checked date; only show a price as "typical" when it is high-confidence, otherwise show it as "≈ estimate" with the EGP conversion note and let the user edit.** Design a quiet way to show "estimated" without clutter. Group and order brands by Egyptian usage: Netflix, Shahid, Spotify, Anghami, YouTube Premium, Watch iT, Amazon Prime, PlayStation Plus, Xbox Game Pass, ChatGPT, Microsoft 365, iCloud+, Google One, Vodafone/Orange/e&/WE, gyms, talabat Pro, Noon One, Uber One, Careem Plus first.

## 8. Logos (policy-gated)

Brand logos are trademarks. A legal-risk review (`logo-legal/`, research not legal advice) sorted every service into: **logo allowed** (shown unmodified, only to identify the user's own subscription) or **initials only** (Apple, Google, Microsoft, Amazon, YouTube, Xbox, Uber, Adobe and others whose guidelines forbid third-party logo use, plus brands with no usable policy). Design for BOTH states everywhere a brand appears: the logo tile (40 px rounded tile on `--color-brand-elevated`, 56 px on the add grid, never recoloured) and the **initials tile** (first two letters on a tinted tile, plain-text brand name always beside it). The initials tile must look intentional and consistent, not like a missing image; show a mixed list (some logos, some initials) and make sure it still reads as one system. Services with no logo file get initials too. The set of allowed brands will change over time (remote kill switch per brand), so never rely on a logo for meaning: the name is always text. Add a quiet "Logos are trademarks of their owners, shown only to identify your services" line in the add sheet's footer area or Settings > Legal, not in the main flow.

## 9. Data you may assume (handoff)

Subscription: name, brand key, plan id, amount, currency, cycle (unit + every), first charge date, billing day, status, trial end, ends on, payment method, tracking mode, reminder on/off, shared-with and my share, price history, pending plan change, notes. Derived: next charge, paid-this-cycle, monthly equivalent, EGP estimate.

## 10. Output and rules

- Frames for every item in section 6, light + dark, EN + AR, plus a component inventory (existing vs proposed), a states matrix, spacing/height notes, and any copy changes in a table.
- Keep it **minimal**: if a field or card does not help the user decide, pay or cancel, it is hidden by default. No more than one primary action per surface. No new colours, no gradients except the existing hero band, no illustrations, no confetti.
- Annotate anything that needs a new data field or a behaviour change so engineering can follow.
