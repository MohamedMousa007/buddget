# Behaviour, motion and logic

## Flow band (summary) by segment
| Segment | Label | Big number | Right side | Bar | Stats (3) |
|---|---|---|---|---|---|
| All | LEFT TO SPEND · SEPTEMBER, status chip (On track / Close / Over) | budget − spent, 2 dp | `{left ÷ daysLeft}/day` + “until Sep 30” | spent ÷ budget; pace tick at dayOfMonth ÷ daysInMonth; scale “Sep 1 · spent X · Sep 30” | ↓ Money in · ↑ Money out · Net worth |
| In | RECEIVED · SEPTEMBER, chip “All in” or “N to resolve” | received from paydays, 2 dp, “of {expected} expected” | `%` + “received” | received ÷ expected, no tick; scale “all N paydays in” / “N paydays open” | Expected · To come · One-time (+) |
| Out | SPENT · SEPTEMBER | spent, “of 6,500 budget” | `{spent ÷ dayOfMonth}/day` + “average” | spent ÷ budget + pace tick | Spent · Per day · Left |
| Out + filters | SPENT · 2 FILTERS, chip “Over by X” if over | filtered spend, filter names | count + “transactions” | vs that category budget | Spent · Budget · Over by |
| No budget | SPENT · SEPTEMBER | spent | avg/day | none; “Set a budget” (Button secondary touch) | as All |
| Loading | label only | skeleton blocks on `--flow-band-mix` | — | — | “—” |
One-time income counts in Money in but **never** in Expected / % received.

## Sticky strip
- Show when the scroll container's `scrollTop > 150` (about when the band's stat row leaves the viewport).
- Strip: top = safe-area-top (47), height 52, same band gradient; left: big number (mono 16/600) + short sub; right: two mono 12/600 figures.
- Motion: `transform: translateY(-110%) → 0` 220 ms `cubic-bezier(.2,.8,.2,1)`; opacity 160 ms ease-out. The status-bar background switches to the band gradient at the same moment (200 ms ease-out), so the teal reads as one strip.

## Segment change
Re-scopes band, chips and ledger. Cross-fade band content 160 ms; ledger fades 120 ms. The chip row swaps to income types on In (Salary, Rent, Dividend, One-time).

## Prompt stack (BannerStack)
Sources (in priority order): late payday (warning) → income match → SMS to review → detected account → detected subscription.
- One card visible at `top: safe-area-top + 3px`, inset 10px, above page content, below sheets. Only the card and pill take pointer events; the page underneath stays fully usable and **never shifts**.
- Up to two peek layers behind (inset 10 / 20px, offset −6 / −12px, opacity .7 / .4).
- Enter: `translateY(-120%) → 0`, 320 ms `cubic-bezier(.2,.8,.2,1)`. Next card slides in the same way after the front one resolves.
- Swipe left/right cycles cards (dots + “1 of N” update).
- **✕ and swipe-up both = snooze.** Swipe threshold: 40px or velocity > 0.5 px/ms; the card follows the finger with opacity falling to .5, then exits upward 200 ms. A small toast “Snoozed · back at {time}” shows for 2 s.
- **Snooze rule:** returns after 3 hours, only between 09:00 and 21:00 local. A return time after 21:00 moves to 09:00 next day. It keeps returning until one of its CTAs is used. Store: `snoozedBanners: Record<key, ISOString>` beside `dismissedBanners`.
- **Terminal answers** (Link it, Keep separate, Received, Missed, Add card/account/wallet, Link existing → Link, Add subscription, Review → last item handled) resolve the prompt; “Keep separate” and “Missed” also write `dismissedBanners` so that pairing never asks again.
- CTA row is always one line: equal-width grid, max two buttons. Primary = `default` (or `success` for Received); secondary = `secondary` (filled neutral). Labels ≤ 16 characters.

## Status pill
- For states, not questions: offline, sync failed.
- Position: centred, `top: safe-area-top + 7px`, height 36, radius full. Amber tint: bg `color-mix(in oklab, var(--color-brand-amber) 18%, var(--color-brand-card))`, border 1px `color-mix(… amber 50%, transparent)`, text-primary 12.5/600, amber 16px icon, shadow-md.
- Swipe up hides it (same gesture as prompts). It returns only if the state is still true 10 minutes later, and disappears by itself when the state clears.
- Offline copy: “Offline · N messages waiting to sync” (`common.offlineBanner` + `sms.pendingSync(count)`).

## Payday rules (from the brief, binding)
- Show payday UI in Flow **only when it would change the number.** Everything on time → zero pixels (screen 04).
- Late = unfilled payday older than `paydayDriftDays ?? 5` days → a warning prompt “{name} · N days late”, CTAs Received / Missed.
- Unmatched income = unlinked credit that plausibly matches an unfilled payday (existing `matchSalary.ts`, ±15%) → prompt “Looks like “{name}” — link it?”, CTAs Link it / Keep separate. One at a time, most recent first. When a match prompt exists for a payday, it replaces that payday's late prompt.

### Payday action state machine (PaydayActionsCard, screen 15)
| State | Actions | Notes |
|---|---|---|
| Untouched (due or late) | Received (success) · Missed (outline) | Received opens the amount, pre-filled with expected. Link: “It arrived in another transaction: link it”. |
| Received | Edit · Delete | Delete confirms; undo toast 5 s |
| Marked missed, recent | Awaiting · Received | Reversible until the next payday passes |
| Marked missed, long past | Received only | |
| Not yet actionable | none | Note “Settle the earlier payday first” (`income.earlierPaydayFirst`) |

## Data-model fixes (brief §8 — must ship)
1. **§8.0** Linking a credit sets `occurrenceDate` (which payday) and keeps `receivedDate` (when it arrived). Late linked income reads “Arrived 3 days late” forever (screens 06, 11).
2. Any “all income” list must not show both legacy one-time representations (IncomeEvent without templateId and IncomeSource `isRecurring: false`); de-dupe by id.
3. No new allocation verb; “assign” is not used in UI copy.
4. SMS income with no payment method shows “From SMS · Set account” (link), never “Main account”.
5. `linkedSavingsAccountId` / `linkedDebtId` are sources, not destinations; never shown as “Paid into”.
6. Linking has a visible route (prompt + row “Link to a payday” + detail sheet); swipe-right stays as a shortcut.

## Adaptive header
`PaydaysButton` measures the header row with a ResizeObserver. If the label would overflow (or would force the month/arrows to shrink), render icon-only. Re-measure on locale and text-size change. In EN the label shows from about 414px (430 shown in H1); at 390px and below it is icon only.

## Filters
- One store: `useExpenseFilterStore` (cats, methods, amtMin/amtMax, range). The chip row, the budget chips and the sheet all read and write it, so they can never disagree.
- Budget chip tap = `toggleCat` as single-select (replaces any other chip-selected category). Clear filters / ✕ clears it. Transition: ledger cross-fade 120 ms, band content 160 ms.
- Date presets from `RANGE_PRESETS` (today, yesterday, week, month, custom). Editing From/To sets Custom; To is clamped to ≥ From (existing logic).
- Amount: slider step 50, 0 → `AMOUNT_MAX`; boxes and slider stay in sync; readout updates live.
- Footer “Show {count} results” updates live; Reset all = `reset()`.
- Direction is not a filter in the sheet; it comes from the page segment. On In, income types replace Category.

## Entry points for adding
- **+ → Money in**: `IncomeSheetForm mode="oneTime"`.
- **Paydays → Add**, **Make this recurring** (prefilled), **edit**: `IncomeSheetForm mode="payday"`.
- Hold + (600 ms) → voice capture (unchanged).
