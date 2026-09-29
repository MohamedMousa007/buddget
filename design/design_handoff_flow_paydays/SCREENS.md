# Screens

All measurements are CSS px at a 390 × 844 viewport. Screenshots are 2× (divide by 2). Sample data: September 2026, today = Sep 28; budget 6,500 SAR; paydays: Al Rajhi salary (Monthly · 22, 14,500 → Al Rajhi •• 0912), Olaya flat rent (Monthly · 1, 4,200 → SNB •• 2231), Malqa studio rent (Monthly · 20, 1,250 → SNB •• 2231), Aramco dividend (Monthly · 27, 386.40, destination not set).

## Shared Flow chrome (01–13, 19–24)
Note: at 390px the Paydays control is icon-only (see H1/H2); every Flow screenshot shows that.
**Header** (unchanged from today): row `padding: 4px 12px 0 18px; min-height: 56px; gap: 2px`.
- Left stack: “FLOW” 10/700 uppercase .08em muted; “September” 24/700 −0.02em + “2026” mono 13 muted, baseline-aligned, gap 6.
- Previous / Next month: `IconButton ghost sm`, 18px chevrons, Next disabled in the current month.
- `PaydaysButton` (H1: icon 16 + “Paydays”; H2: 44px icon-only).
- Avatar `IconButton tinted sm round` (36px), opens ProfileDropdown.

**Summary band** (`FlowSummaryBand`): `margin-top: 6px`, full-bleed, band gradient, `border-block: 1px solid var(--flow-band-line)`, text `--flow-band-fg`.
- Inner padding `14px 18px 12px`.
- Row 1: label (11/700 caps .08em) · status chip (22px tall, padding 0 8, radius full, bg `--flow-band-mix`, 11.5/700, 13px icon: check / clock / alert-circle).
- Row 2 (margin-top 6, space-between, align end): big number mono 32/600 −0.03em lh 1 + “of 6,500” 13; right: mono 15 bold over 11.5 sub, lh 1.3, text-end.
- Bar: margin-top 12, 6px, radius full, track `--flow-band-mix`, fill `--flow-band-fg`; pace tick 3px wide, 4px overhang top/bottom, `box-shadow: 0 0 0 1.5px var(--flow-band-b)`.
- Scale row: margin-top 5, mono 10.5/600, three items space-between.
- Stats: 3 equal columns, `border-top: 1px solid var(--flow-band-mix)`; cells padding `10px 10px 11px 18px`, dividers `border-inline-start`; label 11/600 (“↓ Money in”, “↑ Money out”, “Net worth”), value mono 15/700 nowrap.

**Segment**: margin `10px 16px 0`, `SegmentedControl` (All / In / Out), 44px.
**Chip row**: margin-top 8, padding-inline 16, gap 8, horizontal scroll, no scrollbar. First chip “Filters” (sliders icon); then `BudgetChip`s (Groceries 123% red, Bills 95%, Health 71%, Food, Transport) or income types on In.
**Ledger** (`FlowLedger`): day header padding `12px 16px 6px`: “Today” 13/700 + “Sep 28” mono 12 muted; net mono 12.5/600 secondary. Rows on a `--color-brand-card` surface with `border-block` hairlines; row separators inset 82px; income rows get a 3px green edge marker (inset-block 10px, end radius 3).
**Buddgy** button: `inset-inline-end: 16px; bottom: 114px`, 48px outlined round on a card-coloured disc with shadow-md.
**Bottom nav**: 98px incl. 34 inset, 5 columns; FAB 54 × 54 radius 18, `margin-top: -26px`, ring `0 0 0 4px var(--color-brand-card)` + shadow-md; tabs icon 24 / label 10.5; active = primary-ink text, primary stroke, 700.

## H1 / H2 · Adaptive Paydays
The header is unchanged. Only the Paydays control changes form: icon + label when the full row fits without shrinking the month, year or arrows (≥ 414px in EN, H1 at 430px); otherwise icon only (H2, 390px). Measured with a ResizeObserver, not a fixed breakpoint, so Arabic and large text switch earlier.

## P1 · Prompt arrives
`BannerStack` over the header at `top: 50px; inset-inline: 10px`. Card: radius 20, card bg, 1px border, shadow-lg, padding `12px 6px 10px 14px`.
- Row: 36px icon chip (radius 12, tone soft bg + tone fg, 18px icon) · title 14/700 lh 1.3 + description 12.5 secondary · ✕ `IconButton ghost sm` (aria “Snooze”).
- CTA row: margin-top 10, grid of equal columns, gap 8; `Button size="touch"` full width.
- Pager: dots 5px tall (active 14px primary, others 5px border-strong) + “1 of 3” mono 11 muted; grabber 36 × 4 border-strong, margin 6 auto 0.
- Peek layers behind: height 40, radius 18, card, border, shadow-md.
Copy (SMS): title “3 transactions need your review” (`smsReview.chip(3)`), description “Spotted in your bank SMS — confirm or dismiss each one.”, CTA “Review”.

## P2 · Swipe up to snooze
Front card mid-gesture: `translateY(-34px)`, opacity .5. Toast below: “Snoozed · back at 12:41” (card pill, shadow-md, up-arrow icon).

## P3 · Detected account
Title “Mada ••5521 — new account detected”, description “Seen in 2 bank SMS this week.”, CTAs “Add card” (default) · “Link existing” (secondary). “1 of 2”.

## P4 · Status pill swipe
Pill “Offline · 2 messages waiting to sync” mid-swipe (`translateY(-30px)`, opacity .45); hint “Hidden · returns if still offline in 10 min”.

## 01 · All · top
Band variant budget: “5,131.19 of 6,500”, “456/day until Sep 30”, bar 79%, tick 93%, stats +21,436 / −5,131 / 186,420. Today group: Half Million −48.00; Jarir Bookstore −289.00 struck through, badge Refunded, “↩ Returned Sep 28” green; STC Postpaid −175.00 struck, badge Declined, “✕ Blocked by bank · not counted”.

## 02 · All · scrolled
Sticky strip visible: “1,368.81 left of 6,500” · “+21,436  −5,131”; status bar shares the gradient.

## 03 · In · something to resolve
Band received variant: chip “2 to resolve”, stats Expected 20,336 · To come 15,750 · One-time +1,100. Prompt stack: front “Looks like “Al Rajhi salary” — link it?”, “14,380 SAR arrived Sep 25. Its payday was Sep 22.”, CTAs Link it · Keep separate; behind it the late prompt “Malqa studio rent · 8 days late” (Received · Missed). Row “Transfer · AL RAJHI” badge “Not linked”, subtitle “From SMS · Link to a payday” (ink link).

## 04 · In · calm
Chip “All in”, 100% received, To come 0. No prompts. Rows: Aramco dividend badge Recurring, “From SMS · Set account”; Al Rajhi salary badge “Arrived 3 days late”, “Payday Sep 22 · arrived Sep 25”; Sold camera · Haraj badge One-time, caption “One-time”.

## 05 · Out · two filters
Chips: Filters · 2 (selected) · Groceries ✕ · Mada •• 1180 ✕ (selected = fill + border + ✕). Count line “3 results · −735.45 SAR” + “Clear filters” link. Band filtered: “735.45 Groceries · Mada •• 1180”, chip “Over by 135”, stats Spent 735 · Budget 600 · Over by 135.

## 05a · Tap a category chip
Tapping “Groceries 123%” selects it (fill, border, ✕, aria-pressed) and filters the ledger to Groceries. Band: “GROCERIES · SEPTEMBER 735.45 of 600 budget”, chip “Over by 135”, right “3 transactions”, bar full with pace tick, stats Spent 735 · Budget 600 · Over by 135. Filters chip “Filters · 1”. Count line “3 results · −735.45” + Clear filters. Only one chip can be selected from the row; multi-select lives in the sheet.

## 06 · One day, three edge cases
Today: salary +14,500 “Arrived 3 days late” (payday Sep 25, arrived Sep 28), refunded Jarir, declined STC. Day total excludes refunded/declined.

## 07 · No budget
Band: “Spent · September 5,131.19 SAR”, “183/day average so far”, line “No budget yet, so there is nothing to pace against.” + `Button secondary touch` “Set a budget”.

## 08 · SMS prompts
As P1 over the full Flow page.

## 09 · Review transactions sheet
Sheet (radius 24 top, padding `8px 16px 34px`, grabber). Title “Review transactions” 18/700 + subtitle; Buddgy glyph. Cards on elevated fill, radius 16, padding 12: raw SMS mono 11 muted; title 14.5/700 + sub; amount mono 15/600; two buttons in one row: primary (“Confirm and link” success for the salary; “Confirm” default otherwise) + “Dismiss” outline.

## 10 · Offline with captures
Status pill at top. Today has two Pending rows (Barns −22.00, Careem −38.00): badge Pending, “Captured offline · syncs later”, muted amount, not counted.

## 11 · Recurring income detail (frozen)
Header: 44px green-soft icon chip, “Al Rajhi salary” 17/700, “Salary · Monthly · 22”, badge warning “3 days late”. Amount “+14,500.00” mono 32/600 green + “SAR”.
“DETAILS” label + pencil `IconButton ghost sm` (aria “Edit income”) directly above the table.
`FactsTable` (radius 16, border, rows min 44, padding 11 14, label 13 secondary, value 13.5/600): Payday — [Unlink link-button, before the value] Sep 22 · Arrived — Sep 25 / “3 days after the payday” amber · Paid into — Al Rajhi •• 0912 · Recorded from — Bank SMS · confirmed.
Action row (grid 1fr 1fr, gap 8, `size="cta"`): Open in Paydays (outline) · Delete (destructive).

## 12 · One-time income detail (frozen)
“Sold camera · Haraj”, “One-time income”, badge One-time, +1,100.00. Facts: Received — Sep 14 · Paid into — Not recorded / “Set account” ink · Counted in — Money in · not in expected. Note “Happens every month? Make it a payday and Buddget will expect it and flag it when it’s late.” Actions grid 2fr 1fr: Make this recurring (default) · Delete (destructive).

## 13 · Link to a payday (frozen)
“Which payday is this?” + “14,380.00 SAR from AL RAJHI arrived on Sep 25. Linking keeps that date, so a late payday still shows as late.” `SelectableCard as="radio" surface="elevated"`: Al Rajhi salary (selected, badge Best match) “Sep 22 payday · expected 14,500 · 1% off”; Malqa studio rent “Sep 20 payday · expected 1,250”; “None: keep it as one-time income”. Buttons: “Link to Sep 22 salary” (default, block) · Cancel (outline, block).

## 14 · Paydays list (frozen)
Header: back `IconButton ghost md`, “Paydays” 24/700, reorder `IconButton`, “Add” `Button default touch` with plus. Progress: “September · 19,086 of 20,336 SAR received” + 6px green bar. Cards (`PaydayCard`, gap 10): 40px green-soft icon chip, name 15/700, cadence 12.5, destination 12.5 (ink/600 when “not set · Set”), amount mono 14.5/600, status badge (Arrived 3d late / Received / 8 days late). Footer note “One-time income doesn’t live here. It’s a row in Flow, added with +.”

## 15 · Payday detail (frozen)
Header: back, “PAYDAY” caps + “Malqa studio rent” 20/700, pencil. Band: “Rent · Monthly · 20” · “→ SNB •• 2231”; “1,250.00 SAR expected each month”; “LAST 6 PAYDAYS” + `PaydayTimeline` (Apr received, May +2 days, Jun partial 800, Jul missed, Aug received, Sep late, Sep selected). `PaydayActionsCard`: “Sep 20 payday” + badge “8 days late”; copy “Expected 1,250.00 SAR. Nothing has been linked to it yet, so Buddget is still counting it as income.”; Received (success) · Missed (outline) `size="cta"`; link “It arrived in another transaction: link it”. HISTORY ledger.

## 16 · New payday sheet
`IncomeSheetForm mode="payday"`: title “New payday” (no subtitle) + ✕; Amount (`FieldButton`/AmountField, mono xl) + Currency (120px); Name; Income type `IncomeTypeChipSlider`; How often `SegmentedControl` Monthly / Bi-weekly / Weekly; Payday `IncomePaydayGrid`; Received into; “Add a note” link; “Add payday” `cta-block`. Labels 11/700 caps .06em muted, gap 6; sections gap 16.

## 17 · Reorder (frozen)
Grip handles at card start; dragged card `translateY(-4px) scale(1.02)` + shadow-lg; header button “Done”.

## 18 · Paydays first run (frozen — build exactly)
`EmptyState`: “Tell Buddget when you get paid” / “Add your salary, rent or dividends. Buddget will expect each payday, flag late ones and match bank SMS to them for you.” / “Add a payday”. “START WITH ONE” + three `SelectableCard`s: Salary “Monthly or twice a month”, Rental income “From a tenant, usually monthly”, Dividends “Quarterly or yearly payouts”.

## 19 · + menu
Sheet content (never scrolls): “Add” 18/700; 2-column grid, gap 8; tiles ≈ 64px (see COMPONENTS → QuickAddFAB for icons and colours). Tiles: Money in “Gift, refund, sale” · Expense “Cash or card” · Receipt scan “Snap, we fill it” · Debt payment “Log a payment” · Wealth “Save or invest” · Pay method “Card, bank, wallet”.
Tip: plain centred text (no background, border or pill), margin-top 2: 15px mic in primary-ink + “Tip:” 700 primary-ink + “hold the + in the bottom bar to add by voice” 12.5 secondary.
Responsive: 2 columns at every width ≥ 320px; titles and hints truncate with ellipsis; the panel is content-height (no max-height scroll) and clears the home-indicator inset.

## 19b · Log money in
`IncomeSheetForm mode="oneTime"`: “Log money in” / “A one-off amount you received”, `DatePickerField` pill in the header (opens `UnifiedDatePicker`), ✕; Amount + Currency; Name; Income type; link card “Is this one of your paydays?” / “Link it so it counts toward that payday, not twice.” + outline “Link”; Received into; Add a note; “Save”.

## 20 · Profile dropdown
Existing menu + “Paydays” (badge New) under Payment methods.

## 21 · Filters sheet · top / 21b · scrolled
The existing ExpenseFilters “all filters” sheet restyled (COMPONENTS → ExpenseFilters). The sheet scrolls (max-height 90%); the grabber and the footer stay pinned (the grabber sits on a sticky card-coloured strip so rows pass under it).
- Header: “Filters” 18/700 · “Reset all” link.
- DATE RANGE (CalendarClock icon): wrapping chips Today · Yesterday · This week · This month · Custom (selected); From “Sat, 5 Sep” / To “Mon, 28 Sep” DatePickerFields (label 12 muted above each).
- AMOUNT RANGE ($ icon) + readout “50 – 1,500 SAR” primary-ink mono; helper “Only show transactions between these two amounts.”; two-thumb slider; MINIMUM 50 SAR / MAXIMUM 1,500 SAR boxes.
- PAYMENT METHOD (card icon) + “Select multiple”: 2-column cards with type icons — Mada •• 1180 (selected), Visa •• 4417, Apple Pay, Al Rajhi •• 0912 (bank), STC Pay (wallet), Cash.
- CATEGORY (grid icon) + “Select multiple”: 2-column cards with tinted category icons — Groceries (selected), Food, Coffee, Transport, Bills, Shopping, Health, Entertainment, Education, Travel.
- Sticky footer: “Show 3 results” cta-block on the card surface with a top hairline.
Sections gap 20 with 1px dividers; section label rows gap 10.

## 22 · Empty month (frozen — build exactly)
Band shows the untouched budget (6,500.00 of 6,500; stats 0 / 0 / 186,420). `EmptyState`: “No transactions in September yet” / “Add one with +, or turn on SMS capture and Buddget will log them for you.” / “Turn on SMS capture”.

## 23 · Nothing matches (frozen — build exactly)
Filters Health + Apple Pay, count “0 results”. `EmptyState`: “Nothing matches these filters” / “No Health spending paid with Apple Pay between Sep 5 and 28.” / “Clear filters”.

## 24 · Loading
Band keeps its shape with skeleton bars on `--flow-band-mix`; stats show “—”; ledger `SkeletonList rows={7}`.
