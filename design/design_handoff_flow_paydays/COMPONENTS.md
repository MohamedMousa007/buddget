# Component architecture

Principle: **reuse first.** Before writing any UI, search the codebase (`src/components/**`, `src/lib/**`) for an existing component, hook, store or constant that does the job. If it exists, **edit it in place** (new prop, variant or token) so every screen that uses it picks up the design; never copy it into a new file. Only when nothing fits, create a new component in the folder named below, give it a typed props interface, and use it everywhere the pattern appears. Every new component below is listed with the screens that use it; if you find another place where the same pattern appears, use the component there too.
 If a component already exists, change it (add a prop or variant) so the new design applies everywhere it's used. Create a new component only when nothing fits, and then make it generic enough to reuse. Keep the existing folder structure (`src/components/ui` for primitives, `src/components/features/<area>` for domain components, `src/components/modals` for sheets).

The build test `noStyledRawButtons.test.ts` fails on raw styled `<button>`s. Every control below maps to a library component.

## 1. Tokens (do first)
Add to the token stylesheet, `:root` and `.dark`, next to the brand tokens:
```css
--flow-band-a; --flow-band-b; --flow-band-fg; --flow-band-mix; --flow-band-line;
```
Values are in README → Design tokens. Promote the dark values (the brand teal mixed 34% / 50% into the page colour) to named tokens so no component computes them inline.

## 2. Existing components to modify

| Component | Path | Change |
|---|---|---|
| `QuickAddFAB` | `src/components/modals/QuickAddFAB.tsx` | Title “Add”; `grid-cols-2 gap-2` of `SelectableCard as="action" layout="row" surface="elevated"`, each tile = 36px icon chip (radius 10) + title (14/700, truncate) + one-line hint (11.5, secondary, truncate). Tiles in order, all read as “Add …”: **Money in** (`BanknoteArrowDown`, green) “Gift, refund, sale” · **Expense** (`BanknoteArrowUp`, primary) “Cash or card” · **Receipt scan** (`ScanLine`, cat-4) “Snap, we fill it” · **Debt payment** (`CreditCard`, cat-5) “Log a payment” · **Wealth** (`Coins`, gold; replaces Create saving ahead of the Wealth redesign) “Save or invest” · **Pay method** (`Wallet`, cat-2) “Card, bank, wallet”. Replace the hard-coded hex tile colours with tokens (fg = token, bg = `color-mix(in oklab, <token> 15%, transparent)`; Expense bg `--color-brand-primary-soft`, Money in bg `--color-brand-green-soft`). Voice tip under the grid: **plain centred text, not a button or pill** — 15px `Mic` in primary-ink, “**Tip:** hold the main + button to add by voice” (12.5, secondary; “Tip:” 700 primary-ink). The panel is content-height and never scrolls at 320–430px. |
| `BannerStack` | `src/components/features/dashboard/BannerStack.tsx` | Becomes the prompt stack: renders **one** `PromptCard` (front) plus up to two peek layers; owns snooze, swipe and ordering. See `PromptStack` API below. Keep the component name and file; extend it. |
| `PromptBanner` | `src/components/ui/PromptBanner` (DS) | Add `variant="overlay"`: card bg, 20px radius, shadow-lg, 36px tone icon chip, ✕ `IconButton` (aria “Snooze”), CTA row as an equal-column grid (max 2), pager dots + “1 of N”, 36 × 4 grabber. Existing inline variant stays for any other use. |
| `SmsReviewChip` | `src/components/features/dashboard/SmsReviewChip.tsx` | No longer renders a `SelectableCard` in the page. Registers a prompt with the stack instead (key `sms-review`), CTA “Review” opens `SmsReviewSheet`. |
| `SmsAccountDetectionBanner` | same folder | Registers prompt `pm:<last4>`. Title uses `settings.accountDetected`. CTAs: primary label **by detected type**: card → “Add card”, bank account → “Add account”, wallet → “Add wallet”; secondary “Link existing” (opens the existing SelectField flow in a sheet). |
| `SmsSubscriptionDetectionBanner` | same folder | Registers prompt `sub:<brandKey>`. One CTA “Add subscription”. |
| `SmsReviewSheet` | same folder | Visual update only (screen 09): card per item on elevated fill, raw SMS text in mono 11 muted, parsed title/sub, amount right; two buttons in one row: primary (default, or success when it's income matched to a payday: “Confirm and link”) + outline “Dismiss”. Title/subtitle keep `smsReview.title` / `smsReview.subtitle`. |
| `OfflineBanner` | DS | Render as the **status pill** (see `StatusPill`) instead of an inline strip. |
| `IncomeSheetForm` | `src/components/modals/IncomeSheetForm.tsx` | Add prop `mode: 'oneTime' | 'payday'` (replaces the internal switch). `oneTime` (from + → Money in): title “Log money in”, subtitle `addIncome.addSubtitleOneTime`, date pill = `DatePickerField` in the header, no frequency/payday grid, link card renamed (see STRINGS), CTA “Save”. `payday` (from Paydays → Add, from “Make this recurring”, and edit): title “New payday” (edit keeps “Edit Income”), **no subtitle**, **no Recurring/One-time switch**, remove the Payday accuracy block (`DRIFT_PRESETS`) but keep writing `paydayDriftDays: DEFAULT_DRIFT_PRESET` on create, CTA “Add payday”. `FREQS` stays monthly / bi-weekly / weekly. |
| `IncomeTypeChipSlider` | `src/components/features/income` | Fix the visual bug: the selected chip's border is clipped by the overflow-x row (`pb-0.5` only → use `py-1 -my-1`), and the end fade is hard-coded to `--color-brand-card` so it covers the last chip on elevated surfaces (take the fade colour from a prop or `currentColor` surface var). |
| `AssignIncomeSheet` | `src/components/modals/AssignIncomeSheet.tsx` | Becomes **Link to a payday** (screen 13). Rename user-facing copy (no “assign”). **Fix §8.0:** write `occurrenceDate` = the payday, and keep `receivedDate` = the real arrival date. Never overwrite `receivedDate`. |
| `EditIncomeEventSheet` | `src/components/modals/EditIncomeEventSheet.tsx` | Becomes the **income detail sheet** (screens 11, 12): header, big amount, “Details” label + pencil `IconButton` (opens edit), facts table, Unlink link-button in the Payday row, one action row. Date edits use `DatePickerField` → `UnifiedDatePicker`. |
| `ExpenseFilters` | `src/components/expenses/ExpenseFilters.tsx` | **Keep the component, its store (`useExpenseFilterStore`), `AmountRangeControl`, `PeriodControl`, `FilterSheet` and `CheckBox`; restyle only.** The “all filters” sheet (screens 21, 21b) gets, in this order: (1) **Date range**: the `PeriodControl` presets (Today, Yesterday, This week, This month, Custom from `RANGE_PRESETS`) as a wrapping `OptionChip` radiogroup (`surface="elevated" size="sm"`) + From/To `DatePickerField`s side by side (always visible; editing them switches the preset to Custom). This folds the separate period sheet into the all-filters sheet. (2) **Amount range**: header with the live readout (mono 13/700 primary-ink, e.g. “50 – 1,500 SAR”), helper line “Only show transactions between these two amounts.”, the existing two-thumb slider (track `--color-brand-elevated` 6px, fill `--color-brand-primary`, 24px thumbs card fill + 2px primary border + shadow-sm), then the Minimum / Maximum `AmountField` boxes (48px, radius 12, elevated, mono 16/700, currency suffix from the user's currency, not hard-coded EGP). (3) **Payment method**: 2-column grid of `SelectableCard as="checkbox" surface="elevated"`; each = 32px icon chip (card fill) showing the **method-type icon** (card → `CreditCard`, Apple/Google Pay → `Apple`/`Smartphone`, bank → `Landmark`, wallet → `Wallet`, cash → `Banknote`) + label 13/600 truncate. Replace the colour dot. (4) **Category** last: same 2-column grid, `CategoryIcon` in a chip tinted with the category colour (`color-mix(... 15%)`). Selection on both grids = SelectableCard selected fill + border + a 16px primary check badge on the icon chip's top-end corner (replaces the trailing `CheckBox`, so labels have room). Section dividers 1px border; section labels 11/700 caps with a 14px icon. Header “Filters” + “Reset all” link. Footer “Show {count} results” (`cta-block`) sticky at the bottom of the sheet. The individual chip-triggered sheets (period, category, method, amount) stay, restyled with the same parts. Direction is not in this sheet; on In, income types replace Category. |
| `TransactionRow` | DS | **No API change.** Late / refunded / declined / pending / one-time / not-linked are expressed through `titleBadge`, `subtitle`, `amountColor`, `dimmed`. Add only the 3px income edge marker as a wrapper in `FlowLedger`. |
| `PaydayTimeline` | `src/components/features/income` | Colours are hard-coded for dark surfaces (`rgba(255,255,255,…)`, fixed hexes). Keep it on the teal band (screen 15), where it reads in both themes. Longer term: move `STATUS_STYLE` to tokens. |
| `IncomeTypeIcon` / `MANUAL_INCOME_SOURCE_TYPES` | `src/lib/constants/incomeSourceTypes.ts` | Add a `rental` type (icon `Building2`, label Rent / إيجار). Rent currently falls back to `other`. |
| `ProfileDropdown` | `src/components/layout/ProfileDropdown.tsx` | Add one item **Paydays** (icon `CalendarClock`) between Payment methods and Settings; navigates to the Paydays page. Nothing else changes. |
| `BottomNav` | `src/components/layout/BottomNav.tsx` | Tabs Home · Flow · (+) · Debts · More. Flow uses `assets/flow-tab-icon.svg` (fallback `BanknoteArrowUp`). FAB stays 54 × 54, radius 18, 4px ring in the nav surface colour. |
| Flow header (existing page header) | wherever the mobile page header lives | **Unchanged**, except Paydays becomes `PaydaysButton` (adaptive). |

## 3. New components

| Component | Path | Props | Used by |
|---|---|---|---|
| `PaydaysButton` | `features/income/PaydaysButton.tsx` | `onClick` | Flow header. Renders `Button variant="outline" size="touch"` with `CalendarClock` + “Paydays”; a `ResizeObserver` on the header row switches to `IconButton variant="outlined" size="md"` (icon only, `aria-label="Paydays"`) when the label would overflow. |
| `FlowSummaryBand` | `features/flow/FlowSummaryBand.tsx` | `variant: 'budget' \| 'received' \| 'spent' \| 'filtered' \| 'noBudget' \| 'loading'`, figures (pre-formatted strings), `status {label, tone, icon}`, `stats: {label, value}[3]` | Flow. Full-bleed teal band (tokens above). |
| `FlowStickyStrip` | `features/flow/FlowStickyStrip.tsx` | `visible`, `primary`, `secondary`, `right: string[]` | Flow. Appears when scrollTop > 150. |
| `BudgetChip` | `features/flow/BudgetChip.tsx` | `label, pct, over, selected, onToggle` | Flow chip row (OptionChip as="trigger" + 14px progress ring + %). **Tapping it toggles the category filter** (`useExpenseFilterStore.toggleCat`, single-select from the chip row): the chip shows selected fill + border + ✕ with `aria-pressed`, the ledger filters to that category, the band switches to the category-budget variant, the Filters chip shows “Filters · 1”, and the count line appears with Clear filters. Tap again or ✕ to clear. (Screen 05a) |
| `FlowLedger` / `DayGroup` | `features/flow/FlowLedger.tsx` | `groups: {label, date, net, rows}[]` | Flow, Paydays history. Day header + card surface + 82px hairline + income edge marker around `TransactionRow`. |
| `PromptCard` | = `PromptBanner variant="overlay"` | `icon, tone, title, description, actions: {label, variant, onPress}[] (≤2), onSnooze, index, count` | `BannerStack` |
| `PromptStack` | = `BannerStack` | `prompts: Prompt[]` from a store selector | App shell (renders above page content, below sheets) |
| `StatusPill` | `ui/StatusPill.tsx` | `icon, label, tone='amber', onHide` | App shell (offline, sync failed) |
| `PaydayCard` | `features/income/PaydayCard.tsx` | stream fields + `reorder?: boolean` | Paydays list/reorder (SelectableCard as="action") |
| `PaydayActionsCard` | `features/income/PaydayActionsCard.tsx` | `occurrence`, callbacks | Payday detail. Implements the action state machine (BEHAVIOR.md). |
| `FactsTable` | `ui/FactsTable.tsx` | `rows: {label, value, sub?, subTone?, trailing?}[]`, `onEdit?` | Income detail sheets; reusable for any detail sheet. The Unlink button is passed as `trailing` and renders **before** the value. |
| `PaydaysPage` | route + `features/income/PaydaysPage.tsx` | — | Nav from Flow header and profile menu |

## 4. Control → library map (Flow)
| Control | Component |
|---|---|
| Month arrows | `IconButton variant="ghost" size="sm"` |
| Paydays | `PaydaysButton` → `Button outline touch` / `IconButton outlined md` |
| Avatar | `IconButton variant="tinted" size="sm" shape="round"` |
| All / In / Out | `SegmentedControl` |
| Filters, budget chips, income-type chips | `OptionChip as="trigger" surface="card" size="sm"` |
| Selected filter chips | `OptionChip selected` + ✕ glyph |
| Clear filters | `Button variant="link" size="touch"` |
| Ledger rows | `TransactionRow` |
| Prompts | `PromptBanner variant="overlay"` inside `BannerStack` |
| Status | `StatusPill` |
| Loading | `SkeletonList rows={7}` + band skeleton |
| Empty | `EmptyState` (frozen copy) |
| Buddgy | `IconButton variant="outlined" shape="round" size="lg"` + `BuddgyIcon` |
| Sheets | `Sheet` / `ModalShell` + `Scrim` |

No control requires a primitive that doesn't exist, apart from the new `StatusPill` and `FactsTable` listed above.
