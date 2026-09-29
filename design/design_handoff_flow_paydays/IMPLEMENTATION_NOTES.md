# Implementation notes — Flow + Paydays (F1c)

Inventory written before any code change (CLAUDE_CODE_PROMPT.md → "Components first").
Updated as each phase lands; the "Could not match" section at the bottom lists every deliberate difference and why.

## Inventory: design element → file

### Edited in place
| Design element | File | Change |
|---|---|---|
| `--flow-band-*` tokens | `src/app/globals.css` | 5 tokens in `:root` and `.dark` |
| `rental` income type | `src/lib/store/types.ts`, `src/lib/constants/incomeSourceTypes.ts`, `src/lib/constants/categoryGrid.ts`, `src/lib/i18n/incomeSourceLabels.ts`, `src/lib/supabase/remote/mappers/income{Source,Event}Mapper.ts` | DB enum already has `rental`; the mappers collapsed it to `other` — now round-trips |
| Strings | `src/lib/i18n/dictionaries/{en,ar}.ts`, `src/lib/i18n/types.ts` | STRINGS.md keys |
| Bottom nav | `src/components/layout/BottomNav.tsx`, `src/lib/navigation/bottomNavConfig.ts` | Home · Flow · (+) · Debts · More; Flow glyph |
| Flow route | `src/app/flow/page.tsx` (new route), `src/app/expenses/page.tsx` + `src/app/income/page.tsx` (alias to Flow), `AppViewRouter.tsx`, `shellRoutes.ts` | Expenses + Income collapse into Flow |
| Mobile header on Flow/Paydays | `DesktopHeaderBar.tsx`, `AppShell.tsx` | Page owns its header on Flow/Paydays (screenshots show no wordmark bar) |
| Avatar + menu | `AuthNavButtons.tsx` (`ProfileAvatarWithMenu` exported) | reused in the Flow header |
| Profile menu | `src/components/layout/ProfileDropdown.tsx` | + Paydays (CalendarClock, badge New) |
| Prompt stack | `src/components/features/dashboard/BannerStack.tsx` | becomes the store-driven overlay stack (one card + 2 peeks, snooze, swipe) |
| Prompt card | `src/components/ui/PromptBanner.tsx` | + `variant="overlay"` |
| SMS review | `SmsReviewChip.tsx` | registers prompt `sms-review` instead of rendering a card |
| Account detection | `SmsAccountDetectionBanner.tsx`, `usePaymentMethodDetector.ts` (+`count`) | registers `pm:<last4>`; Add card/account/wallet + Link existing |
| Subscription detection | `SmsSubscriptionDetectionBanner.tsx` | registers `sub:<brandKey>` |
| Plan-change prompt | `SubscriptionPlanChangeBanner.tsx` | registers into the same stack (it lived in the old BannerStack) |
| Review sheet | `SmsReviewSheet.tsx`, `useSmsConfirmations.ts` (+`raw_body`) | screen 09 visuals |
| Snooze | `src/lib/store/useSettingsStore.ts` | `snoozedBanners` beside `dismissedBanners` |
| Offline notice | `src/components/ui/OfflineBanner.tsx` | renders `StatusPill` |
| Sync-failure notice | `src/components/layout/SyncFailureBanner.tsx` | renders `StatusPill` |
| Money in / payday sheet | `src/components/modals/IncomeSheetForm.tsx`, `AddIncomeSheet.tsx` | `mode: 'oneTime' | 'payday'` |
| Type slider | `src/components/features/income/IncomeTypeChipSlider.tsx` | border clipping + fade colour prop |
| Link to a payday | `src/components/modals/AssignIncomeSheet.tsx` | screen 13 + §8.0 (never overwrite `receivedDate`) |
| Income detail | `src/components/modals/EditIncomeEventSheet.tsx` | detail view (11, 12) + existing form behind the pencil |
| + menu | `src/components/modals/QuickAddFAB.tsx` | 2-col row tiles, tokens, plain-text voice tip |
| Filters | `src/components/expenses/ExpenseFilters.tsx`, `src/lib/store/useExpenseFilterStore.ts` | restyle; single-select `selectCat`, `incomeTypes` for In |
| Ledger rows | `src/components/transactions/TransactionRow.tsx` | no API change |
| Timeline | `src/components/features/income/PaydayTimeline.tsx` | unchanged, used on the teal band |
| Income type colours | `src/components/features/income/IncomeTypeIcon.tsx` | accepts `var(--token)` accents |
| Grabber | `src/components/modals/ModalShell.tsx` | 36×4 `--color-brand-border-strong` (README: border-strong = grabbers) |
| Income sort order | `src/lib/store/types.ts` (`sortOrder`), income source mapper, migration `0109_income_sources_sort_order.sql`, `database.types.ts` | Paydays reorder persists |

### New (nothing existing fits)
| Component | Path | Why new |
|---|---|---|
| `PaydaysButton` | `src/components/features/income/PaydaysButton.tsx` | adaptive label/icon via ResizeObserver |
| `FlowSummaryBand` | `src/components/features/flow/FlowSummaryBand.tsx` | full-bleed teal band, no existing hero matches |
| `FlowStickyStrip` | `src/components/features/flow/FlowStickyStrip.tsx` | collapsed band |
| `BudgetChip` | `src/components/features/flow/BudgetChip.tsx` | OptionChip + progress ring |
| `FlowLedger` / `DayGroup` | `src/components/features/flow/FlowLedger.tsx` | day groups over TransactionRow with 82px hairline + income marker; replaces ExpenseDayList and the income page ledger |
| Flow data | `src/components/features/flow/useFlowData.ts` | one selector for rows, band figures, prompts |
| Income prompts | `src/components/features/flow/IncomePrompts.tsx` | late payday + income match → stack |
| `StatusPill` | `src/components/ui/StatusPill.tsx` | amber state pill |
| `FactsTable` | `src/components/ui/FactsTable.tsx` | detail-sheet facts |
| Prompt store | `src/lib/store/usePromptStore.ts` | registry the stack renders from |
| Snooze rule | `src/lib/prompts/snooze.ts` (+ test) | 3 h, 09:00–21:00 window |
| `PaydaysPage` | `src/app/paydays/page.tsx` + `src/components/features/income/PaydaysPage.tsx` | new page |
| `PaydayCard` | `src/components/features/income/PaydayCard.tsx` | list/reorder card |
| `PaydayDetail` | `src/components/features/income/PaydayDetail.tsx` | screen 15 |
| `PaydayActionsCard` | `src/components/features/income/PaydayActionsCard.tsx` | action state machine |
| Flow tab glyph | `src/components/icons/FlowTabIcon.tsx` | from `assets/flow-tab-icon.svg` |

Also added: `src/components/features/flow/{FlowHeader,FlowChipRow,useFlowBand}.tsx`, `src/components/modals/ModalTitle.tsx`, `src/components/layout/StatusBarCover.tsx`, `src/hooks/useHiddenStatus.ts`, `src/lib/income/{paydaySummary,cadence}.ts`, `src/lib/navigation/ownsHeader.ts`, `src/lib/ui/{fillSlots,monoDigits}.tsx`, `src/lib/utils/shortDate.ts`, `formatFixed2/formatFlex/formatSigned` in `formatters.ts`.

Retired: `PendingSmsCards` (captures render as Pending rows in Flow's Today group, screen 10). `ExpenseDayList` stays — the debts Charges sheet still uses it. The old Expenses and Income page bodies are gone; both routes render Flow.

## Verified
Seeded the Sep 2026 sample in the dev build (390 px, light + dark): screens 01, 03, 05a, 11, 13, 14, 15, 16, 19, 19b, 21 match layout, copy and tokens. Sub-header at 390 shows the full month + labelled Paydays, at 360/320 "Sep" + labelled Paydays; nothing overflows at 320 and the + menu does not scroll. lint 0 errors, 1060 tests pass, production build passes. Migration `0109` applied to Supabase.

## Could not match / decisions (with reason)
1. **Header (revised with product).** Flow keeps the Buddget logo bar ("buddget | Flow" + avatar). Below it, `FlowSubHeader` holds the month and year, Paydays and the month arrows. It is measured, not breakpointed: when all three don't fit, the month drops to its 3-letter form first, then Paydays to icon-only. The sticky strip slides out from under the logo bar. Paydays keeps its own back-button header.
2. **Filter count.** Counts the dimensions that narrow the list (category, payment method, amount; income type on In). The date range is the period, like the month, so it is not counted — this is what makes screens 05 and 23 read "Filters · 2" with a custom range set. An active amount range gets its own removable chip.
3. **One filter sheet (confirmed with product).** The separate period/category/method/amount sheets are gone; everything, including the date range, lives in the one Filters sheet.
4. **Late vs missed.** An unanswered payday past its grace shows as "late" (prompt, badge, timeline) until the user says Received or Missed; "missed" on the timeline means it was marked. The engine's display-only auto-missed is mapped to late on Payday detail.
5. **Link sheet copy (13).** "…from AL RAJHI…" reads the sender from the SMS the credit was parsed from (`sms_parse_log.merchant`, else bank, else sender ID); non-SMS income drops "from …".
6. **Review sheet (09).** Each card shows the SMS category and the payment method matching its last4, or "card •• 5521 is new" when no method owns it. A credit that plausibly fills an open payday (same matcher as Flow's prompts) gets "Matched to the Sep 22 payday · arrived 3 days late" and a green "Confirm and link"; confirming links the income it creates, keeping its received date.
7. **Subscription prompt description.** "56.99 SAR on the 18th, 3 months running." — months counted from the distinct months the charge appeared in.
8. **Wealth tile (+ menu).** Opens the Wealth page (the old Create saving opened the goal sheet); the tile is a destination ahead of the Wealth redesign.
9. **Pending rows (10).** An offline capture's category is guessed offline the way the server will: this user's last expense at that merchant, then the subscription catalog. Unknown merchants show a message glyph.
10. **Payday prompts only on In.** Late/match prompts register only while Flow's In segment is showing (per the prototype intro); SMS, account, subscription and plan-change prompts show on every shell page.
11. **Sheets.** Real `ModalShell` scrim (the prototype drew its own inline); grabber strip keeps its 44px touch target, bar is now 36×4 border-strong. Existing form controls (AmountField, currency, PaymentMethodPicker) keep their DS styling in the income sheets.
12. **Buddgy button.** The existing draggable Buddgy orb (AIChatBubble) is kept as is.
13. **Budget chips.** Only categories with a budget cap get a chip (none when there is no budget; screen 07 shows chips from sample data).
14. **Income type chips on In** use the app's type labels (e.g. "Investment", "Rent") rather than sample captions ("Dividend").
15. **Sticky strip on 07.** The capture shows the strip while unscrolled (prototype state leak); it follows the >150 px rule.
16. **`expenses.selectMulti`** now reads "Select multiple" to match the sheet copy; **`addIncome.assignedToSource`** reads "Linked to …" (no "assign" in UI copy).
17. **Money in on All** sums the ledger's income rows for the range; Money out is the same spend the band paces.
