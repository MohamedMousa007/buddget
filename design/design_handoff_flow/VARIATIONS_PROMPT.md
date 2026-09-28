# Design Brief — Flow + Paydays: three directions to choose between

> Companion to `DESIGN_PROMPT.md` in this folder. **Read that first** — it holds the decided
> constraints (the Flow/Paydays split, naming, the payday rule, the unmatched-income banner, the
> defects to fix). This brief asks for something different: **three structurally distinct answers**
> to the same problem, so the underlying information architecture can be chosen by comparison
> rather than assumed.
>
> Everything in `DESIGN_PROMPT.md` §7 (must-keep), §8 (defects to fix), §9 (design system) and §11
> (do-not) is binding on **all three** directions. This brief only varies structure.

**Build with the Buddget design system** — project `3e84a07a-da79-472d-b487-07c93afa5f48`,
teal identity, 51 components. Several were built specifically for this screen; use them.

---

## 1. The problem, restated

Buddget is merging its Expenses and Income tabs into one tab, **Flow** (`المعاملات`). Income setup
moves to a second surface, **Paydays** (`أيام القبض`).

The hard part is that **income and expenses are not symmetric**. A user has hundreds of expense rows
a month and one or two income rows. Income is *expected* on a schedule and then *reconciled*;
spending simply happens. Any design that treats them as two halves of the same thing will feel
wrong — most obviously as a near-empty "In" view.

Each direction below is a different answer to: *what is the organising idea of this screen?*

---

## 2. The three directions

Design all three properly. Do not pick a favourite and sketch the others.

### Direction A — **Ledger-led**
*The organising idea: this screen is a list. Everything else serves the list.*

- Flow opens on the merged day-grouped ledger, with the summary compressed to a single slim bar.
- The All/In/Out segment is the primary control and sits close to the list.
- Maximum rows visible; the hero earns very little space and collapses to almost nothing on scroll.
- Payday signals and the unmatched-income prompt appear **inline in the stream**, at the right date,
  rather than as a header banner.
- Closest to what power users of Lunch Money or Copilot expect.

### Direction B — **Summary-led**
*The organising idea: this screen answers "how am I doing?" before "what happened?".*

- Flow opens on a strong hero: net flow for the period, with in and out as the supporting pair, plus
  a small trend. The ledger begins below the fold.
- The segment re-scopes the hero as much as the list — switching to "In" changes the headline
  number, not just the filter.
- Stat tiles carry the secondary figures.
- Closest to Monarch or Copilot's Cash Flow altitude.

### Direction C — **Time-led**
*The organising idea: money has a rhythm — paydays, bills, the month boundary — and the screen
should show where you are in it.*

- Flow leads with the period itself: where today sits between the last payday and the next, what has
  landed, what is still expected.
- The ledger is grouped by that rhythm rather than by plain calendar days.
- The payday timeline is not hidden on a detail screen — it is the spine of the view.
- Riskiest and most differentiated. Buddget already has the data model for it (`paydayDays[]`,
  `occurrence_date`, drift detection); no competitor in the review does this well. It may be the
  product's real advantage or it may be too clever — that is exactly what these variations exist to
  find out.

**For each direction, say in two lines what it optimises for and what it gives up.** A direction
with no downside has not been thought through.

---

## 3. Deliver per direction

Dark and light, 390×844.

1. **Flow / All** — the default view, resting state
2. **Flow / All** — scrolled, showing how the summary behaves
3. **Flow / In** — including the overdue-payday signal and the unmatched-income prompt
4. **Flow / In** — the calm state: nothing late, nothing unmatched (prove the machinery costs nothing)
5. **Flow / Out** — two filters applied
6. **Paydays** — the stream list
7. **Paydays** — one stream's detail with its payday timeline, one payday selected showing actions

Plus, once, across the set: the empty state, empty-after-filter, loading, and one day group holding
a declined expense + a refunded expense + a late income row together.

---

## 4. What must be identical in all three

These are decided. Varying them makes the comparison meaningless.

- **Flow is the ledger; Paydays is the setup.** Recurring income is a stream in Paydays; one-time
  income is just a row in Flow with no setup surface.
- **A payday is surfaced only when it would change the number.** Buddget's income total assumes a
  payday arrived unless told otherwise, so a genuinely late salary means the figure on screen is
  lying. On-time salary costs zero pixels.
- **The unmatched-income prompt names its specific candidate** ("is this your Al Rajhi salary?"), is
  present only when there is something to resolve, and both of its answers are terminal.
- **No allocation/budget-envelope concept.** Not being built.
- **Payment methods stay where they are.** Not a peer of Flow.
- Direction is never carried by colour alone.
- The five defects in `DESIGN_PROMPT.md` §8 are fixed, not inherited — especially §8.0, where
  linking a credit currently destroys the real arrival date.

---

## 5. Use the real components

These exist, are synced, and have real prop contracts. Composing them is the point — designs that
hand-roll equivalents cannot be implemented cheaply.

| Need | Component |
|---|---|
| Ledger row | `TransactionRow` |
| Day-group surface | `Card variant="list" padding="none" divide` |
| All / In / Out | `SegmentedControl` |
| In / out / net figures | `StatTile` (`tone="positive"` for in, `default` for out — outflows are not red) |
| Unmatched income, overdue payday, SMS review | `PromptBanner` |
| Any card surface | `Card` (polymorphic — `render={<ul />}`, `render={<button />}`) |
| Status chips | `Badge` (`positive`/`warning`/`negative`/`brand`/`muted`, `size="xs"`) |
| Buttons | `Button` (`size="touch"` 44px, `"cta"` 48px, `"cta-block"` full width) |
| Month control | `MonthYearPicker` |
| Filters | `ExpenseFilters` |
| Payday timeline | `PaydayTimeline` · stream card `RecurringIncomeCard` |
| Income type glyph | `IncomeTypeIcon` · destination `AccountChip` |
| Swipe actions | `SwipeToDelete` |
| AI / assistant presence | `BuddgyIcon` |

**If a direction needs something that does not exist, design it as a reusable component** — name it,
give it props and states, and say where else in the app it would be used. Do not invent a one-off.

---

## 6. How to present the comparison

1. The three directions **side by side** at the same screen (Flow / All) so they can be judged against
   each other, not in sequence.
2. Then each direction in full.
3. A short comparison table: what each optimises for, what it sacrifices, who it suits.
4. **Your recommendation, with reasoning.** Do not hedge — say which one you would ship and why. Name
   the strongest argument against your own pick.

---

## 7. Acceptance test — answer for each direction

1. Where do I see net flow, and how many taps to only outflows?
2. My salary is 3 days late — what do I see, and where?
3. Nothing is late and nothing is unmatched — how many pixels does the payday machinery cost?
4. A stray credit arrived that is probably my salary — how do I link it without knowing the word "assign"?
5. How does this look with 40 transactions, 1 income row, and no budget set?
6. How does it look in the first week, with 2 transactions and no streams declared?
