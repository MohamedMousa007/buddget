# Savings Contribution Model — structure proposal

> Status: **proposal. Nothing implemented.** Supersedes the inflow section of
> [SAVINGS_REDESIGN_PLAN.md](docs/SAVINGS_REDESIGN_PLAN.md) (Models A/B/C are withdrawn).
> Written against the corrected premise: savings is a **pocket**, not an account balance,
> and the app tracks **intent and planning**, not certified money movement.

---

## 0. The premise, restated

- A savings pocket holds **what the user put there** plus **what the budget left over**.
  It never mirrors a bank account and never reconciles against one. The word *balance*
  leaves the domain.
- The app cannot guarantee money physically moved. So no mechanism may *assume* it did.
  Reserving money is a **nudge**, never a lock — and the number that finally posts is
  always the amount that **actually remained**, not the amount that was intended.
- No "move money now" buttons in Income or Expenses. The only place money enters a pocket
  is from the savings surface itself, or automatically at month end.

---

## 1. Exactly three events. There are no others.

| # | Event | Trigger | Left-to-spend | Net worth | Underlying flag |
|---|---|---|---|---|---|
| **1** | **Declare** — "I already have this / it came from outside my budget" (initial savings, a gift, sold something) | User, from the savings surface | **unchanged** | **+X** — we were under-counting before | `isCashFlow: false` |
| **2** | **Allocate** — "Move it from this month's budget" (your transfer-expense) | User, from the savings surface | **−X** | **unchanged** — it moved, it didn't vanish | `isCashFlow: true` |
| **3** | **Carry** — whatever actually remained when the month closed | System, once per cycle | n/a (month is closed) | unchanged | `isCashFlow: true`, dated to the closed month's last day |

**Events 2 and 3 are the same transaction type.** One is triggered by the user mid-month,
the other by the system at close. That is the whole anti-duplication guarantee: there is
only *one* kind of "budget money → pocket" event, and the Carry amount is **computed as
what remained after every Allocate**. It is structurally incapable of double-counting.

This maps onto primitives that already exist (`isCashFlow`), so the ledger doesn't need a
new concept — what's new is the **question we ask the user** and how event 2 is *surfaced*.

---

## 2. Three numbers, never conflated

1. **Target** — planned monthly savings, set while budget-planning. An **intention**.
   Never posts. Never enters a pocket. Never appears in net worth.
2. **Allocated** — real, user-triggered, this month. Already reduced left-to-spend.
3. **Carry** — what actually remained at close. Computed once, posted once.

> **Actually saved this month = Allocated + Carry.**
> The headline stat is **Target vs Actually saved** — which is precisely the comparison
> you asked for, and it only works because Target never posts.

---

## 3. Left-to-spend — the formula that makes it consistent

```
left-to-spend = income − spend − allocated − max(0, target − allocated)
                                             └─────── unfunded reserve ───────┘
```

The last term is the **unfunded reserve**: the part of the target not yet moved, withheld
so the user doesn't casually spend it. As the user Allocates, the reserve shrinks by
exactly what they allocated — so **the target is withheld exactly once**, whether it's
sitting as a reserve or has become a real contribution.

| Target | Allocated | Reserve | Total withheld |
|---|---|---|---|
| 2000 | 0 | 2000 | 2000 |
| 2000 | 800 | 1200 | 2000 |
| 2000 | 2000 | 0 | 2000 |
| 2000 | 2500 | 0 | 2500 ← honest: they moved more than planned |
| 0 | 500 | 0 | 500 ← no target set, still works |

**The reserve is soft.** It lowers the displayed number; it does not block spending. If the
user spends through it, nothing breaks and nothing is silently "unsaved" — the Carry at
month end is simply smaller, and the stat honestly reads *Target 2000 / Saved 600*. This
is the direct answer to "moving it doesn't ensure the user won't spend it": we never
pretend it moved.

**Carry** is the same expression without the reserve term, floored at zero:

```
carry = max(0, income − spend − allocated)
```

Dated to the **last day of the closed month**, so the closed month's flow drops by the
carried amount and the new month doesn't show an outflow that never happened.

---

## 4. What this fixes that is broken today

**The live duplication bug.** [calculations.ts:540-555](src/lib/utils/calculations.ts:540)
subtracts `Savings`-category expenses **and** savings deposits from left-to-spend as two
independent terms, and `useMonthlyStats.savingsTotal` sums pocket amounts **plus** legacy
`savingsHoldings` **plus** `Savings`-category expenses. A user who logs a "Savings" expense
and also deposits the same money is double-counted in both places, today.

**Resolution: retire the `'Savings'` expense category entirely.** One canonical event = a
savings-pocket contribution row. Existing `Savings` expenses migrate into Allocate
contributions. `savingsHoldings` retires (or is repurposed as the market-position model in
the later live-prices phase). After this there is exactly **one** path into a pocket.

**Month-end surplus no longer evaporates.** Net worth's flow term is month-scoped
(`useNetWorth` → `useMonthlyStats(monthFilter)`). Today, when the month rolls over, last
month's surplus silently drops out of net worth unless the user happened to deposit it
manually. The Carry banks it into the pocket, so net worth accumulates month over month
instead of resetting. This is a genuine correctness gain, not just a feature.

---

## 5. The user-facing flow

Adding to a pocket asks **one question**, and that question is the entire model:

> **Where is this money coming from?**
> ○ **From this month's budget** — reduces what you have left to spend
> ○ **Money I already had** — outside your budget; doesn't affect this month

That's it. No jargon, no "transfer type", no accounting words. Everything else — the
reserve, the carry, the net-worth neutrality — happens behind that one choice.

At month close, the Carry posts and the user sees a single summary:
*"October: you planned 2,000 and saved 2,350."*

---

## 6. What changes in the existing code (audit)

| Today | Becomes |
|---|---|
| `depositToSavings(...)` | `contributeToPocket(..., mode: 'declare' \| 'allocate')` — the mode sets `isCashFlow` |
| `correctSavingsBalance(...)` | Split: *revaluation* for market/manually-valued investments; for savings pockets it's "adjust the tracked amount" (open question §7.7) |
| `withdrawFromSavings(...)` | Stays; gains the purpose selector already agreed (income / another pocket / debt / spend) |
| `Savings` expense category | **Retired + migrated** |
| `savingsHoldings` | Retired now, or held for the live-prices phase |
| `SavingsAccount.currentBalance` | Domain rename to a pocket word (§7.6); DB column rename optional |
| `left-to-spend` (2 subtraction terms) | Single formula in §3 |
| `savingsThisMonth` (computed, never posted) | Becomes the Carry, posted once per cycle |
| — | New: `month_carries(user_id, month_key, amount, ...)` unique on `(user_id, month_key)` for idempotency |

---

## 6b. Decisions taken (answers to §7.1–7.4)

### Carry amount — bank everything

Carry banks the **entire** remainder, not just up to target. Exceeding the target is a good
outcome and the excess goes to savings like the rest. Left-to-spend therefore lands at zero
at every cycle close.

### Target is per-month and non-cumulative

An unmet target does **not** roll forward. Each cycle starts fresh. But every cycle's
outcome is **retained as history** for analytics and the month-switcher:

```
savings_month_summary(user_id, month_key, target, allocated, carry, saved, currency, closed_at)
UNIQUE (user_id, month_key)
```

`saved = allocated + carry`. Target is **snapshotted at close**, so later edits to the
budget plan don't rewrite history. This table doubles as the carry's idempotency guard —
one row per user per cycle means the carry cannot post twice.

### Allocate visibility

Rendered as a synthetic, visually distinct **"Moved to <pocket>"** row in the expenses
list, sourced from the savings ledger. Never stored as an expense. Excluded from every
category and spending statistic; participates only in left-to-spend.

### Carry destination — resolution chain

1. **Payment-method match.** The income this month arrived on a payment method; if a
   savings pocket is linked to that payment method, the carry goes there.
   → **Requires a new nullable `savings_accounts.payment_method_id`.** No such link exists
   today; `income_events.payment_method_id` already does.
2. **Active savings goal.** Otherwise, the pocket linked to an active (not achieved /
   paused / cancelled) savings goal.
3. **Auto-create.** Otherwise, create a pocket named **"Monthly Savings"** and use it.

### Carry delivery

Fully automatic. **Push notification only** — no in-app notification, no undo, no
confirmation card.

---

## 6c. What §7.3 and §7.4 cost — flagging before you commit

**Push forces the carry to be computed server-side.** Today `savingsThisMonth` is computed
client-side in `useMonthlyStats`, and a client can't drive a push for a user who hasn't
opened the app. So the carry needs a scheduled server job.

The good news is this is cheap here, because the infrastructure already exists and **no
logic gets duplicated**:

- `vercel.json` already runs a daily cron (`/api/cron/notifications`, 06:00). Add
  `/api/cron/month-carry` alongside it.
- It's a Next API route on Vercel, so it can **import `@/lib/utils/calculations` directly** —
  the same functions the client uses. No SQL reimplementation of the money math, no drift.
- Push fan-out via `push_tokens` + `firebase-admin` is already built.
- `monthStartDay` is **per user**, so the job runs daily and selects the users whose cycle
  closed that day — not a single monthly run.

This is the one genuinely new piece of backend in the whole plan. It is not optional if you
want a push notification.

---

## 7. Open questions — I need your answers before planning the build

*(7.1–7.4 answered — see §6b.)*

**New, raised by those answers:**

1. **Two payment methods, one leftover.** Salary lands on Bank A, freelance on Bank B, and
   1,500 remains. Money is fungible and spending crossed both, so attributing the leftover
   to one method is *already* an approximation. My recommendation: **the payment method
   that received the most income that cycle** — one rule, one carry row, predictable.
   The alternative is a proportional split across pockets, which produces several carry
   rows per month and manufactures precision that isn't real. Which?
2. **Two active savings goals** at chain step 2 — take the **highest `priority`** goal
   (the field exists)? And if that goal has no linked pocket, fall through to step 3?
3. **The auto-created "Monthly Savings" pocket** — what `type` does it get? `bank` is the
   most likely home for leftover money; `cash` and `other` are the alternatives.
4. **A late expense on a closed month.** The user logs a forgotten 300 purchase into a
   month whose carry already posted — the carry is now 300 too generous. My
   recommendation: **leave it immutable.** The carry is a snapshot of what was true at
   close; silently rewriting savings history is worse than a small stale figure, and
   recomputation would have to cascade through every later month. Agree?

**Still unanswered from the original list:**

5. **Retiring the `Savings` expense category** and migrating existing rows into Allocate
   contributions — confirm. This is a data migration on live user data.
6. **The word.** "balance" is out. Pick: **Saved** ("Saved: 12,400") / **Pocket** /
   **Amount** / something of yours.
7. **Manual amount adjustment on a savings pocket** — keep it (user can correct a
   mistyped pocket) or remove it from savings and keep revaluation for investments only?
   Keeping it is a small duplication risk; removing it means mistakes are fixed by
   editing the original contribution.

---

## 9. Recommended answers to §7

### The meta-solution: one setting makes Q1–Q3 low-stakes

Add **Settings → Carry destination: `Auto ▾` | a specific pocket**. Once a manual override
exists, the auto-rule never has to be perfect — it only has to be *reasonable and
explainable*. That reframing is what lets every answer below stay simple instead of clever.

### 9.1 Two payment methods → **largest income receiver**

I considered attributing the leftover per-method (`income_m − spend_m`), which is more
truthful and the data exists (`expenses.paymentMethodId`). I rejected it: with credit
cards the residual is nonsense (you spend on a CC and settle later), so the "more accurate"
rule is actually less accurate for the most common payment method in the app. Proportional
splitting is worse still — several carry rows a month, manufacturing precision that money's
fungibility doesn't support.

**Rule: the payment method that received the most income that cycle.** One row, one
sentence to explain, plus the override above.

### 9.2 Two active goals → **highest `priority`**, and create-and-link on miss

Tie-break: `priority` → soonest `targetDate` → oldest `createdAt`. No splitting by
`monthlyContribution` weights, same fake-precision argument as 9.1.

**Refinement worth taking:** if the winning goal has *no* linked pocket, don't fall through
to a generic pocket — **create a pocket named after the goal and link it to that goal.**
The goal gets a home, the link is established for every future carry, and the user sees
their own words instead of a system name. Strictly better than step 3 for that branch.

### 9.3 Auto-created pocket → **`bank`**, named "Monthly Savings"

`cash` implies physical notes (wrong), `other` is honest but lands the user on a generic
icon they'll want to change anyway. Leftover salary overwhelmingly sits in a bank, so
`bank` is the type most users will keep as-is.

**Small addition:** have the **first-ever** carry's push deep-link into the savings tab.
Not a confirmation — you ruled those out — just a way for the user to rename or re-type the
pocket the one time it gets auto-created.

### 9.4 Late expense on a closed month → **bounded auto-recompute, then freeze**

Immutable is the lazy answer, and its ceiling is real: the pocket permanently overstates by
every late entry, and someone who logs receipts a few days late accumulates that drift all
year.

Full recompute is the other extreme and cascades through every subsequent month.

**Take the middle, which is still fully automatic:** recompute the carry **only while the
month is the most recently closed one** — i.e. until the next cycle's carry runs. Then it
freezes permanently. This catches essentially every real late entry (people log receipts
within days, not months), and it structurally cannot cascade, because only ever one month
is recomputable. Implementation is cheap: the `savings_month_summary` row is unique per
cycle, so recompute = replace that row and its carry transaction.

### 9.5 `Savings` expense category → **migrate, do not just delete**

The important detail: a user who *only* ever used `Savings`-category expenses and never
deposited has **no duplication today** — their total is correct. If we simply stop counting
that category, **their savings total collapses to zero.** That's data loss from their point
of view.

So: convert each `Savings` expense into a real **Allocate** contribution at its original
date, in a pocket named "Savings", then remove the category from the picker. Net effect on
savings totals: zero. Net effect on historical left-to-spend: zero — an Allocate reduces it
exactly as the expense did. And the double-count disappears because the expense side stops
being summed.

Per the repo's own rule, run a `SELECT` count of affected rows before touching live data.

### 9.6 The word → **"Pocket"** as the container, and *two* number labels

Container: **Pocket**, everywhere. It's your word, it's warm, and it carries no banking
implication.

For the number, one word doesn't fit both tabs — and that's not sloppiness, it's a real
semantic difference:

- Savings pocket → **"Saved"**. The number is *what you put in*.
- Investment → **"Value"**. The number is *what the market says it's worth*.

Using one word for both would flatten exactly the distinction the two tabs exist to make.

Domain field: `currentBalance` → **`amount`** (neutral, serves both). Leave the DB column
`current_balance` alone — the mappers already translate names, and a column rename is pure
churn with zero user-visible benefit.

### 9.7 Manual amount adjustment → **remove it from savings pockets**

Walk the reasons a pocket's number could be wrong, and every one has a better-fitting
action already:

| Cause | Correct action |
|---|---|
| Typo'd a contribution | **Edit that contribution** in the ledger — fixes the cause, keeps history honest |
| Bank paid interest | **Declare** — genuinely new money from outside the budget |
| Investment moved in value | **Revaluation** — automatic for market-tracked, manual for real estate |

A free-form "set the amount to X" adds nothing those three don't cover, and it's an
invisible way to launder untracked money into net worth. Removing it deletes code, closes a
duplication vector, and loses no capability.

**Keep revaluation for investments only.**

---

## 8. Not in this document

Emergency fund, savings rate, allocation donut, fail-closed valuation, transfers,
filterable ledger, freshness stamps, zakat, live prices, and the Savings/Investment
sub-tab split are all agreed and unaffected by the questions above. They sit on top of
this model once it's settled.
