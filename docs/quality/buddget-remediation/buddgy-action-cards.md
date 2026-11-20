# Buddgy action cards: every scenario that needs the user (plan, 2026-11-20)

Owner ask: everything in the app can be done through Buddgy, so every input and confirmation needs a designed, modern card, built as components and reusing what the app already has. This plan covers the 45 write tools in `src/lib/buddgy/tools/specs/` (expenses, income, debts, payments, savings, goals, subscriptions, budget, settings, profile, memory, navigation).

## One shell, eight bodies

Every proposal renders in one shell, `BuddgyActionCard`. This is today's `ProposalCard`, split up rather than reshaped:

- **Head:** a tint by tone (add = `primary-soft`, change = `elevated`, danger = `red-soft`), the icon and the title.
- **Body:** one of the eight patterns below.
- **Actions:** one primary button plus Edit or Not now. The primary label always names the result ("Add 3 expenses", "Move EGP 2,000").
- **After:** a single-line state with Undo. These states exist today: Done, Undone, Skipped, Out of date, Couldn't apply.

| # | Pattern | Tools | Body | Primary CTA |
|---|---|---|---|---|
| 1 | Quick record | `add_expense`, `add_income`, `mark_payday_received`, `add_to_goal`, `record_debt_payment`, `deposit_to_savings`, `mark_subscription_paid` | Amount hero (`AmountField` look, read-only), then one line each for From/To, Category and Date. A missing field shows inline as a picker. | "Add", "Record payment", "Add to goal" |
| 2 | Batch | several of pattern 1 in one message | Rows: `CategoryIcon`, name, sub-line (category · method · date), amount, and a trailing **trash button** (44px), not a checkbox. Tap a row to edit it. A row with a missing field expands its picker in place. The total sits in the head. | "Add 3 expenses", which counts down as rows are removed |
| 3 | Create a thing | `add_payment_method`, `add_credit_card`, `add_savings_account`, `add_debt`, `add_installment_plan`, `add_subscription`, `add_goal`, `add_income` (source), `add_investment_holding` | A preview of the thing as the app will show it: `CardFaceChip` for a card or wallet, `BrandMark` and `AccountRow` for an account, the goal tile for a goal. Under it, `FactsTable` with its key facts. Fields still missing appear as question cards (the same seven controls the plan builder uses). | "Add card", "Add account", "Add goal" |
| 4 | Change | every `update_*`, `adjust_budget`, `adopt_subscription_price`, `change_setting`, `update_profile`, `correct_savings_balance`, `activate_budget_plan` | Before → after rows, the old value struck through, plus one amber effect line ("Moves EGP 400 from Wants") | "Apply change" |
| 5 | Move money | `transfer_between_pockets`, `withdraw_from_savings` (and a deposit from an account) | Two `AccountRow` minis joined by an arrow, the amount between them, and the balances after | "Move EGP 2,000" |
| 6 | Remove | every `delete_*`, `cancel_subscription`, `clear_debt`, `forget_memory` | Danger head, the item as a row, and one line on what else goes with it | "Yes, delete" (solid red). Undo stays for 10 seconds where the store supports it. |
| 7 | One-tap status | `pause_subscription`, `resume_subscription`, `achieve_goal`, `activate_budget_plan` | One line plus a `StatusPill` showing the new state | "Pause", "Resume", "Mark achieved" |
| 8 | Go there | `open_screen`, `open_setting`, `open_sheet`, `start_budget_setup` | A link chip ("Open Savings"). No confirmation, unless it follows a read, in which case it asks first as it does today. | none, the chip is the action |

## The pickers, all reused

- **Paid with / From / To:** a horizontal strip of mini `CardFaceChip` faces (brand colour, last four digits) plus Cash. The best guess is pre-selected and ringed, and "Other" opens the existing payment method picker sheet. This replaces plain text chips.
- **Account:** `AccountRow` minis with `BrandMark`. "Add a new one" opens `ProviderPickerSheet`.
- **Category:** a row of `CategoryIcon` chips (the top 5 for this user, then "More").
- **Date:** chips for Today, Yesterday and Pick a date. Pick a date opens `UnifiedDatePicker` / `DatePickerField`.
- **Amount:** `AmountField` with `CurrencyMark`. `NumberPad` comes up when it is edited.
- **Choice questions:** `OptionChip` (one), `OptionChip` multi with check marks, `SegmentedControl` (yes/no), `Switch`, slider, stepper. These are the same seven controls as the budget builder.

## Rules

- A card never writes on its own except `risk: 'auto'` proposals, as today. A confirmed batch writes as one store transaction and undoes as one.
- When a field is missing, Buddgy asks for it inside the card rather than guessing silently. A guessed field is marked "guessed" in the sub-line.
- After the app is closed, a waiting card becomes Out of date (BDG-013). Apply re-checks against the store, so it never writes twice.
- Every control is at least 44px. A batch row's trash button carries `aria-label` "Remove <name>".

## Build notes

- New component files under `src/components/features/ai-chat/cards/`: `BuddgyActionCard.tsx` (the shell), one file per body, and `pickers/`. The existing `ProposalCard` becomes the shell plus a body chosen by `preview.domain` and kind.
- `ProposalPreview` gains a `pattern` field (1 to 8) and, for batch, `items[]`. This is a contract change across the tools' `propose()`, so it gets unit tests per pattern.
- **UI-only parts** (look of each body): mockup first, then owner approval, then build.
- **Logic** (batch transaction, undo, missing-field questions, stale state): tests are mandatory.
