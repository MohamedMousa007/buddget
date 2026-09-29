# Prompt for Claude Code

Paste everything below the line into Claude Code, opened at the root of the `buddget` repo, with this folder copied to `design/design_handoff_flow_paydays/`.

---

You are implementing the **Flow + Paydays** redesign for Buddget. The full spec is in `design/design_handoff_flow_paydays/`. Read these first, in this order, and keep them open while you work:

1. `README.md`: overview, tokens, screen index, zero-deviation rule
2. `COMPONENTS.md`: what to modify vs create, props, paths
3. `SCREENS.md`: per-screen measurements and exact copy
4. `BEHAVIOR.md`: motion, prompt/snooze logic, payday state machine, data fixes
5. `STRINGS.md`: i18n keys (EN + AR)
6. `screenshots/light/*.png` and `screenshots/dark/*.png`: the visual source of truth (2×, 390 × 844)

## Rules
- **Zero deviation.** Match the screenshots and SCREENS.md exactly: layout, spacing, sizes, copy, colours, states. Do not redesign, rename, reorder or “tidy” anything that isn't specified. Screens 11–18, 22 and 23 are frozen. If something can't be built as specified, stop and ask me before substituting.
- **Components first — this is the most important rule.** Before building anything, inventory what exists: run a search over `src/components`, `src/lib` and `src/hooks` for every component named in COMPONENTS.md and for anything similar (rows, chips, sheets, banners, filters, date pickers, sliders). Write the inventory to `design/design_handoff_flow_paydays/IMPLEMENTATION_NOTES.md` before changing code: for each design element, the existing file you will edit, or “new: path” with the reason nothing existing fits. Then:
  - **Edit existing components in place** (add a prop, variant or token) so the new design applies everywhere they're used. Do not fork or duplicate them (no `ExpenseFilters2`, no copied sheet).
  - **Build new pieces as reusable components** in the folders given in COMPONENTS.md, with typed props, and use them everywhere the pattern appears, not just on the screen where it first shows up.
  - Keep one source of truth for state (e.g. the budget chips and the filter sheet both use `useExpenseFilterStore`).
  - Keep file and folder naming consistent with the repo, so each feature is easy to find and edit.
- **Reuse components.** Before writing any UI, search `src/components` for an existing component. If one exists, extend it (new prop or variant) so every screen that uses it picks up the design; don't fork it. Create a new component only when COMPONENTS.md says so, put it in the folder listed there, and make it generic. No one-off styled `<button>` (the `noStyledRawButtons` test must stay green).
- **Tokens only.** No hex literals. Use `var(--color-brand-*)`, `--color-cat-*`, `--shadow-*` and the new `--flow-band-*` tokens (add those first). Teal is the brand; red is only destructive and over-budget; outflow amounts are plain text.
- **Type.** DM Sans; every amount, date and percentage uses `font-mono-numbers`.
- **Sizes.** Inputs/triggers 48px; tap targets ≥ 44px; ledger hairline inset 82px.
- **RTL.** Logical properties only (`ms-/me-/ps-/pe-`, `start/end`). `dir` stays LTR.
- **Both themes.** Check every screen in light and `.dark`.
- **Data fixes in BEHAVIOR.md §“Data-model fixes” are mandatory**, especially §8.0 (never overwrite `receivedDate` when linking).

## Build plan (one PR per phase; run typecheck, lint and tests after each)
1. **Foundations**: `--flow-band-*` tokens; `rental` income type; new i18n keys (STRINGS.md); Flow tab icon (`assets/flow-tab-icon.svg`) and BottomNav labels (Flow / المعاملات).
2. **Flow page**: route; unchanged header with `PaydaysButton` (adaptive); `FlowSummaryBand` (all variants); `FlowStickyStrip`; `SegmentedControl`; chip row with `BudgetChip`; `FlowLedger` over `TransactionRow`. Screens 01–07, 22–24, H1–H2.
3. **Prompt stack**: extend `BannerStack` and `PromptBanner variant="overlay"`; move SMS review, account/subscription detection, income match and late payday into it; snooze store (`snoozedBanners`); swipe gestures; `StatusPill` for offline/sync. Screens P1–P4, 03, 08, 10.
4. **Income sheets**: `EditIncomeEventSheet` → income detail (`FactsTable`, pencil, Unlink before the date); `AssignIncomeSheet` → Link to a payday with the §8.0 fix; `SmsReviewSheet` visuals. Screens 09, 11–13.
5. **Paydays**: `PaydaysPage`, `PaydayCard`, reorder, detail with `PaydayTimeline` on the band and `PaydayActionsCard` (state machine), first-run empty state. Screens 14–18.
6. **Adding** (+ menu tile names/icons/hints and plain-text voice tip per SCREENS 19): `IncomeSheetForm` `mode` prop (oneTime / payday; remove the switch, subtitle and Payday accuracy; keep writing `paydayDriftDays = 7`); `QuickAddFAB` layout and tokens; `IncomeTypeChipSlider` clipping fix. Screens 16, 19, 19b.
7. **Filters + menu**: restyle the existing `ExpenseFilters` (date range + amount range first, then payment methods 2-up with type icons, categories last; sticky Show results); budget chips toggle the category filter; `ProfileDropdown` + Paydays. Screens 05a, 20, 21, 21b.

## Definition of done
- Every screen in the index matches its light and dark screenshot at 390px. Also check 320px, 360px and 430px: nothing overflows, the + menu never scrolls, and the header shows Paydays icon-only whenever the label would squeeze the month (390 and below in EN), icon + label at 430.
- IMPLEMENTATION_NOTES.md lists every component you edited and every one you created, with its path.
- The acceptance answers hold: net worth + in/out on All; one tap to Out; late salary shows only past the grace window as a prompt; zero payday pixels when calm; stray credit linkable without the word “assign”; a linked-late credit still says “Arrived N days late”; “Keep separate” never re-asks for that pair; refund and late salary render correctly in one day group.
- No hex literals, no raw styled buttons, no `ml-/pl-/text-left`, no new icon library, no pig icon, no bell in the mobile header.
- Record anything you couldn't match, with the reason, in `design/design_handoff_flow_paydays/IMPLEMENTATION_NOTES.md`.
