# Buddget — Information Architecture Master Plan

**Status:** decided 2026-09-29. This is the record of *what goes where and why*.
Supersedes any earlier advice that assumed a Home tab or an open Flow page.

---

## The constraints that drove this

1. **Home is removed. Flow is the homepage.**
2. **Flow is closed.** It already carries the income + expense merge, the payday
   machinery and the SMS/AI automation. Nothing else may be folded into it.
3. **Four slots.** The bottom bar holds four destinations plus the FAB.
4. Six candidate destinations: Flow, Budget, Wealth, Debts, Analytics, and homes for
   Subscriptions and Goals.

Two of those must therefore live somewhere other than the bar.

---

## The decision

### Bottom bar

| Slot | Destination | The question it answers |
|---|---|---|
| 1 | **Flow** (home) | What moved? |
| 2 | **Budget** | What may I spend? |
| — | FAB | |
| 3 | **Wealth** | What do I have? |
| 4 | **Debts** | What do I owe? |

### Profile dropdown

**Analytics/Reports**, **Goals**, Payment methods, Settings.

**Paydays is not here.** Income streams are set up and managed from **Flow**, which is
where the paydays themselves are read. Income has no separate destination.

### Why Budget takes the slot and Analytics does not

Budget is a surface you **act on** — repeatedly, during the month, while deciding
whether to spend. Analytics is a surface you **review** — episodically, usually once a
month, after the fact. A bottom bar should hold the things you reach for often, not
the things you reach for deeply. This also matches your own stated ordering, where
reports came last.

The corollary: Analytics must be genuinely reachable from the dropdown, not buried.
It is a first-class page that happens to have a lower-frequency entry point.

---

## Where Subscriptions goes: **Budget**

Not Debts — and the data model is the reason, not taste.

- `Subscription` carries **`linkedRecurringExpenseId`** and `expenseCategory`: a
  subscription **auto-creates a `RecurringExpense`**. It is a recurring *expense* with
  brand and plan metadata on top.
- A debt has a **principal that amortises to zero** and a payoff date. A subscription
  has neither. File Netflix under Debts and "what do I owe?" returns a number that
  never goes down — the page stops being able to answer its own question.

Budget is where it belongs because **committed recurring costs are the first input to
a budget**. You cannot plan a month honestly without first subtracting what is already
promised. So Budget gains a **Committed** section above the planning rows:

> Committed — 2,430 EGP/mo across 7 subscriptions · next charge Thu

Tapping it opens the subscription list (the existing page, now a section rather than a
tab). The planning rows below then work against what is actually left.

This also fixes a real gap: today a user plans a budget with no view of the recurring
costs that will hit it.

---

## Where Goals goes: **everywhere it already points, plus one page**

Goals is **not** a child of Wealth, and the model is unambiguous:

- `Goal.linkedSavingsAccountIds[]` **and** `Goal.linkedDebtIds[]`
- `GoalCategory` includes `debt_freedom` and `spending_control`
- `monthlySpendingLimit` for goals that are not about accumulating at all

Put Goals inside Wealth and every debt-payoff and spending-control goal is orphaned.

**So Goals becomes a lens, not a location.** Each goal is surfaced in the domain it
points at:

| Goal kind | Surfaced on | As |
|---|---|---|
| linked to savings | **Wealth** | on the pocket: "feeds New car — 62%" |
| linked to debts | **Debts** | on the debt: "Debt-free by Mar 2027 — 40%" |
| `spending_control` | **Budget** | as the category's limit, where it already behaves like one |

And `/goals` stays a **full page in the profile dropdown** for the cross-cutting list —
create, reorder, prioritise, see everything at once.

> Worth knowing: Goals is currently reachable **only from Settings**. It is not badly
> placed today, it is effectively hidden. This plan makes it more visible, not less,
> by putting progress where the user already is.

**Open option, not assumed:** a single-line goal progress strip on Flow. It is a strip,
not a merge, but Flow is closed by your instruction, so it needs your explicit yes.

---

## Where Savings + Investment goes: **one page, Wealth**

See `design/design_handoff_wealth/DESIGN_PROMPT.md` for the design brief.

The short version: they were never two domains.

- `SavingsAccountCategory = 'savings' | 'investment'` — one entity, one discriminator
- `/investment` is a 37-line route whose own comment reads *"Renders the same
  InvestmentView the savings page shows"*
- `src/app/savings/page.tsx` already holds
  `useState<'savings' | 'investment'>` — the switch exists, it is just not a visible
  control, and there is a second route doing the same job

The real distinction to preserve is **not** savings-vs-investment. It is:

- **Balance** — a `SavingsAccount` you hold (bank, certificate, wallet, vault)
- **Position** — an `InvestmentHolding` worth `quantity × live price` (gold grams,
  BTC, shares, m²)

That is where live rates belong, and it is the one thing the merge must not flatten.

---

## The resulting map

```
Flow      (home)   income + expenses + paydays (incl. stream setup) + SMS/AI
Budget             planning + Committed (subscriptions) + spending_control goals
Wealth             pockets (balances) + holdings (positions, live-valued)
                   + emergency fund + zakat + savings goals
Debts              borrows + cards + installments/BNPL + debt_freedom goals
─────────
dropdown           Analytics · Goals (full list) · Payment methods · Settings
```

Every tab answers one question in its own title. Nothing needs a tutorial to find,
because nothing is filed under a word that does not describe it.

---

## What this plan deliberately does not do

- **Merge Subscriptions into Debts.** Rejected on the model, above.
- **Merge Goals into Wealth.** Rejected on the model, above.
- **Touch Flow.** Closed by instruction.
- **Invent a "Commitments" tab.** Subscriptions + installments + recurring debt
  payments do share a concept — money already promised to leave. It is a real idea and
  worth keeping in reserve if Budget's Committed section turns out to want siblings.
  It is not worth a fifth slot today.
