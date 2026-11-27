# buddget money model: logic spec (v1, 2026-11-27)

The one definition engineers build. Sources, in priority order: owner rules (end of `COUNCIL_DECISIONS.md`) > Deep logic check > Final revision > Consolidated model > earlier rounds. Code read: `origin/main` at `c3b9790a`; the latest migration is 0354. Live counts quoted below are "per council, 2026-11-27". **Re-run every count before applying a migration.**

## 0. Which rule wins (conflicts in the sources, settled)

| Topic | Rule that wins | Rule it replaces |
|---|---|---|
| Achieved goal | Completed for good. It never returns to active, and has no "now X below target" or "X no longer set aside" copy. | Deep fix 9, Final rev 5 |
| Card hold-back | Everything owed on the card except unbilled plan principal (Deep fix 2). | Final rev 2: "statement + this month's instalment" |
| Shortfall trigger | Any drop of the bank-aligned balance, after SMS pairing, with no timer. | Round 4: 24h grace |
| Shortfall choices | It's in another account / I spent it / Keep for now. | Round 4: Move / I spent it / Ignore (renamed) |
| Month-end scope | Every live account, each in its own currency. | Round 4 and Audit: base currency only |
| Fill order | Each item's existing parts first, then the account with the most remaining free money. | Round 5: proportional spread |
| Closed months | Never reopened. A late row counts in the month it arrives. `carryAdjust.ts`, drift and `priorAdjustment` are retired. | `carryAdjust.ts`, `closedCycleDrift` |
| Allocator | One allocator, "Where your monthly savings go" (% lines, at most 100% in total, rest goes to Monthly savings). | Goal share/fixed engine (`allocateMonth.ts`), default carry pocket, top-priority-goal routing |
| Release / "I spent it" | Labels only. They never move a balance. | Today's withdrawal path (rule 8 moves the holder) |
| Free money | Can be negative. It is never clamped at 0. | `balance.ts:110` `Math.max(0, …)` |
| Outside money | Gold or other assets only. Cash goes to the Cash account. An untracked bank is added as an account. | Round 3: cash/untracked bank as outside items |
| Money in a closed account | Counts zero. It is never counted as outside money. | `netWorthBasis.ts:484` (counts it standalone) |
| Card plan | Owed once, inside the card. The full price is spending at purchase. Instalments are settlements. | A separate installment debt plus `Debt`-category instalment spend |
| Cut for now | The "+X from rate changes" label (show the note "includes rate changes"), a multi-home editor, the "Is this money in the new bank?" prompt, and new emergency fund or Zakat work. | Round 5 |

## 1. Glossary

| User word EN | AR | Data word | Meaning |
|---|---|---|---|
| Free to spend | متاح للإنفاق | `free(A)`, `freeTotal` | Balance − set aside − card hold-back. Can be < 0 ("Free to spend −X"). |
| in your accounts | في حساباتك | `Σ balance(A)` | Sum of live account balances. |
| Set aside | مُخصَّص | `held(A)` | Sum of the parts held in A, in A's currency. |
| Pocket | جيب | item with no target | A reserve. It can have parts in several accounts. |
| Goal | هدف | `goals` row with a target, plus its parts | A target (amount, date, its own unit). It owns its parts. |
| Monthly savings | المدخرات الشهرية | system item, `item_id = systemVaultId(user)` | An undeletable item that holds the rest of month-end. One part per account. Hides when empty. |
| Where your monthly savings go | وين تروح مدخراتك الشهرية | `savings_split_lines` | % lines per item (Σ ≤ 100). The rest goes to Monthly savings. |
| Month-end card | بطاقة نهاية الشهر | `month_end_proposals` row | The proposal: confirm, edit, or let it apply itself after 3 days. Undo is available. |
| Short X | ناقص X | `short(A)` | Set aside − balance, when positive. Card money never counts. |
| Release | رجّعه للمتاح | label `release` | "Stays in CIB, back to Free to spend". |
| I spent it | صرفته | label `spent` | The money already left (it was counted as spending). The part shrinks. |
| It's in another account | في حساب تاني | label pair `move` | The part's money now sits in another live account. |
| Keep for now | خليه دلوقتي | dismiss | The notice is dismissed. The row keeps "Short X" and progress counts only the covered part. |
| Withdraw | اسحب | real withdrawal | Only for gold, cash-like or other outside holdings. Money moves into an account. |
| Outside holding | خارج الحسابات | part with `held_in IS NULL` | Gold or another asset no SMS sees. |
| Saved and invested | المدخر والمستثمر | Savings-page sum | Parts + investments. It is not net worth (one-line explainer). |
| Net worth | صافي الثروة | `netWorth` | Shown on Accounts only. |
| Achieved | مُنجَز | `goals.status='achieved'` | Final. |
| Salary / Income | راتب / دخل | copy only | "Salary" only for salary sources. |

Data words: **item** = goal, pocket or Monthly savings (`savings_accounts.item_id`). **Part** = one `savings_accounts` row: one item, one home, one currency. **Home** = `held_in_payment_method_id` (a live account) or NULL (outside). **Label** = a `savings_transactions` row that changes a part and never an account. **Leg** = a ledger effect on an account balance (`walkLegs`). **Live account** = see I-11.

## 2. Invariants (every screen, job and test keeps these)

- **I-1. Bank truth.** For a live account A, `balance(A, t)` = the latest anchor at or before t (opening balance or SMS/user-reported balance) + the legs after that anchor, up to t. A reported balance becomes an anchor. A row dated before the anchor is inside it and is never counted twice.
- **I-2. Set aside.** `held(A) = Σ part.balance` over the parts with `held_in = A` and `deleted_at IS NULL`. Every part held in A is in A's currency (enforced at write).
- **I-3. Free.**
  - `free(A) = balance(A) − held(A) − cardHold(A)`. It is a real number and may be negative.
  - `short(A) = max(0, held(A) − balance(A))`. `cardHold` is never part of `short`.
- **I-4. Labels.**
  - Set aside, release, spent, move, month-end, month-end undo and close are labels.
  - They change `part.balance` only. They never change any `balance(A)`.
- **I-5. Net worth.** `NW = Σ_{A live, not excluded} balance(A)→base + Σ outside parts→base + investments − debts`.
  - Held parts count 0 extra times.
  - Parts whose holder is closed or deleted count 0.
  - A card plan is owed once, inside the card.
- **I-6. Goal progress.** `progress(G) = Σ covered(p)→goal unit` over G's parts, at live rates. Missing price: use the last price, with a warning and its date.
- **I-7. Month-end cap.**
  - `placed ≤ min(leftover, Σ cap(A))` and `placed(A) ≤ cap(A)`.
  - `cap(A) = max(0, min(free(A, cycleEnd), free(A, applyTime)))`.
  - `leftover = income − spending − savedNet − unexplainedOut`.
- **I-8. Not income, not spending.** Own transfers, card bill payments, card-plan and BNPL instalments, opening balances, outside-money entry and labels.
- **I-9. Once.** Each `(user, month_key)` has at most one proposal row, and at most one application of it, enforced by compare-and-set (CAS) on `version` inside one SQL transaction.
- **I-10. Booked rate.** A cross-currency row stores the amount it moved in the account's currency (`account_amount` / `to_account_amount`), or its booked rate. Reads never re-convert it at today's rate.
- **I-11. One live-account rule.** `isLiveAccount(pm) = isTracked(pm) && !pm.closedAt && !deleted`. The same rule is used by the client, the server, net worth and month-end. `canHoldParts(pm) = isLiveAccount(pm) && !pm.excluded`.
- **I-12. Achieved is final.** `status` never leaves `'achieved'`. This is enforced by a DB trigger and by every writer.
- **I-13. One part per (item, account).** Enforced by a unique partial index.
- **I-14. Closing.** An account with `held(A) > 0` cannot close until "Where did this money go?" is answered. After the answer, `held(A) = 0`.

## 3. Data model

### 3.1 Per table

| Table | Added | Changed | Retired (kept for old builds until P7) |
|---|---|---|---|
| `savings_accounts` (= parts) | `item_id uuid` (goal id / systemVaultId(user) / own id) | `held_in_payment_method_id` stays set-once (never updated; Move = new part) | `linked_payment_method_id` (nulled in 0353), `target_amount` (moved to goals), `is_emergency_cover` (kept, read-only) |
| `savings_transactions` | `idempotency_key uuid`, `pair_id uuid`, `account_amount numeric` | `source` gains label values: `set_aside, opening, release, spent, move_out, move_in, month_end, month_end_undo, close`; every label row: `is_cash_flow=false`, `payment_method_id NULL`, `transfer_group_id NULL` | `transfer_group_id` on carry rows (moved to `idempotency_key`) |
| `goals` | nothing | `status` guarded by a trigger (I-12) | `linked_savings_account_ids` (trigger-maintained mirror of parts), `funding_mode`, `share_pct`, `monthly_contribution`, `manual_current_amount` (pocketless goals only) |
| `payment_methods` | `pays_from_payment_method_id uuid` (credit cards with no `parent_id`), `is_savings boolean default false` | none | none |
| `account_adjustments` | `anchor_balance numeric` (set = anchor: balance at `occurred_at` equals it) | `delta` is still written (= anchor − ledger at write) for old builds | none |
| `expenses` | `account_amount numeric` (source side in account currency), `to_account_amount numeric` (destination side) | card-plan instalment rows: category `Installment` (non-spend) | none |
| `income_events` | `account_amount numeric` | none | none |
| `month_end_proposals` (new) | see 3.3 | none | none |
| `savings_split_lines` (new) | `id, user_id, item_id, pct numeric(5,2) check (pct>0 and pct<=100), sort int, edited_at, updated_at, deleted_at` | none | none |
| `savings_month_summary` | none | read-only history | written by nothing after P6 |
| `goal_allocation_runs` | none | read-only history | written by nothing after P6 |
| `profiles` | none | none | `default_carry_pocket_id` (becomes a 100% split line) |
| `debts` | none | card plan = `debt_type='installment'` with `linked_credit_card_debt_id` set: a schedule inside the card, not counted in `debtRemaining` | none |

### 3.2 Migrations (each with its pre-count; all follow 0315/0316 grants and RLS `(select auth.uid()) = user_id`; every FK gets an index)

**0355_savings_items.sql**
- Pre-counts:
  - parts linked to two or more goals (expect 0);
  - goals with two or more pockets (expect 0);
  - pockets with `target_amount IS NOT NULL` and no goal;
  - duplicate `(item, holder)` pairs after the backfill (expect 0).
- Changes:
  - Add `item_id uuid`.
  - Backfill: `item_id = goal.id` for linked parts; for the system vault `item_id = id` (systemVaultId); otherwise `item_id = id`.
  - Pockets with a `target_amount` and no goal: create a `goals` row (category `quality_of_life`, since `GoalCategory` has no `other`; target, currency, priority = max+1) with `id = gen_random_uuid()`, and set `item_id` to it.
  - Set `item_id NOT NULL`, with a BEFORE INSERT trigger `item_id := coalesce(item_id, id)` (old builds send none).
  - Index `(user_id, item_id)`.
  - Unique partial index `(item_id, held_in_payment_method_id) WHERE deleted_at IS NULL AND held_in_payment_method_id IS NOT NULL`.
  - Trigger `sync_goal_parts`: after INSERT/UPDATE/DELETE of `item_id` or `deleted_at` on parts, recompute `goals.linked_savings_account_ids` for the old and new item. Guard with `pg_trigger_depth() < 2`.
  - Trigger on `goals.linked_savings_account_ids` UPDATE (old build): newly listed ids whose `item_id = id` get `item_id = goal.id`. Removed ids are ignored.
  - `edited_at = now()` on every changed row.

**0356_savings_labels.sql**
- Pre-counts:
  - `source='carry'` rows (expect 6 for 3 users, 0 with a leg);
  - rows with `transfer_group_id` used as an idempotency key (`source in ('carry')`).
- Changes:
  - Add `idempotency_key uuid`, `pair_id uuid`, `account_amount numeric`.
  - Unique `(user_id, idempotency_key) WHERE idempotency_key IS NOT NULL`. Index `pair_id`.
  - Backfill carry rows: `idempotency_key = transfer_group_id`, `transfer_group_id = NULL`, `is_cash_flow = false`.
  - New RPC `label_part(p_user, p_part, p_delta, p_source, p_key, p_pair, p_date, p_note) returns numeric`:
    - locks the part;
    - refuses a negative result;
    - inserts the label row and updates `current_balance`;
    - is idempotent on `p_key`.
  - `EXECUTE` for `service_role` only.
  - `adjust_pocket_balance` stays for outside holdings.

**0357_goals_achieved_final.sql**
- Pre-count: goals with `status='achieved'` and goals that were reopened. The reopen count is not knowable; report the current achieved count only.
- BEFORE UPDATE trigger: `if old.status='achieved' and new.status <> 'achieved' and new.deleted_at is null then new.status := 'achieved'; new.achieved_at := old.achieved_at; end if`.
- It is silent, so an old build's write-back does not break sync.

**0358_cards_and_savings_accounts.sql**
- Pre-counts: credit cards with `parent_id IS NULL`, and cards whose `parent_id` is not a bank or wallet.
- Add `payment_methods.pays_from_payment_method_id uuid references payment_methods(id)` with an index.
- Add a CHECK through a trigger: the target is `bank_account` or `wallet` of the same user.
- Add `is_savings boolean not null default false`.

**0359_balance_anchors.sql**
- Pre-count: `account_adjustments` by reason.
- Add `anchor_balance numeric`. Index `(payment_method_id, occurred_at)` where `anchor_balance IS NOT NULL`. Check it is not a duplicate of an existing index.
- No backfill: legacy rows stay deltas.

**0360_booked_amounts.sql**
- Pre-counts:
  - expenses whose currency ≠ the resolved account currency;
  - transfers whose `to_payment_method_id` currency ≠ the row currency;
  - income events whose currency ≠ the account currency.
- Add the columns.
- Backfill is not done in SQL (no rates table). A one-off server script freezes `account_amount` at the rates the client uses today. It does a dry run first that reports the count and total drift per account, and it suppresses notices.

**0361_month_end.sql**
- Tables `month_end_proposals` and `savings_split_lines`.
  - RLS: select own rows for both. Insert/update/delete own rows for split lines. Proposals are written by the server only (no insert/update for `authenticated`).
  - `anon` gets nothing.
- Trigger: Σ live `pct` per user ≤ 100. Raise `split_over_100`.
- RPCs `apply_month_end(p_user, p_id, p_version, p_lines jsonb)` and `undo_month_end(p_user, p_id)`: `service_role` only.
- Partial index `month_end_proposals (auto_apply_at) WHERE status='proposed'`.
- Unique `(user_id, month_key)`.

**0362_split_backfill.sql**
- Pre-counts:
  - profiles with `default_carry_pocket_id` ≠ systemVaultId;
  - goals with `funding_mode='share'` (Σ pct per user);
  - goals with `funding_mode='fixed'`.
- Changes:
  - Default carry pocket → one line at 100% for its item.
  - Share goals → `pct = share_pct`, scaled proportionally when Σ > 100, rounded down to 0.01.
  - Fixed goals → no line (OQ-2).
  - A user with both a default pocket and share lines: share lines first, and the default pocket gets `100 − Σ`.

**0363_card_plans.sql**
- Pre-counts:
  - plan debts with `installment_provider='credit_card'`;
  - those with `linked_credit_card_debt_id IS NULL`;
  - of those, users with exactly one card debt;
  - expenses with `linked_debt_id` = a card-plan id (instalment rows) by category;
  - card plans with no purchase expense on the card (`expenses.linked_debt_id = plan.id`, or the same amount and date ±3 days on `plan.linked_payment_method_id`).
- Changes:
  - Link the unlinked plans where the user has exactly one card. Leave the rest and list them.
  - Instalment expenses on card plans: `category = 'Installment'`, `edited_at = now()`.
  - Plans with no purchase on the card: OQ-3.

**0364_retire_columns.sql** (P7, only when no build ≤ the last pre-P2 native build is in use)
- Drop:
  - `savings_accounts.linked_payment_method_id` and `target_amount`;
  - `profiles.default_carry_pocket_id` (FK first);
  - `goals.share_pct`, `funding_mode`, `monthly_contribution`;
  - the `goals.linked_savings_account_ids` sync triggers and the column.
- Pre-count non-null values for each column, which must be 0 or migrated.

### 3.3 `month_end_proposals`

| Column | Notes |
|---|---|
| `id uuid pk`, `user_id`, `month_key text` | unique (user_id, month_key) |
| `cycle_start date`, `cycle_end date` (exclusive) | frozen; next cycle starts at this `cycle_end` |
| `status text` | `proposed` → `applied` → `undone` (terminal); `proposed` → `empty` (nothing placeable; terminal) |
| `version int default 1` | CAS key |
| `base_currency`, `rates jsonb` | frozen at create; apply uses `rates_apply jsonb` (written at apply) |
| `income, spending, saved_net, unexplained_out, leftover, placeable, not_placed numeric` | base currency |
| `lines jsonb` | `[{item_id, part_id|null, account_id, currency, amount, amount_base}]`, proposed (and user-edited) |
| `applied_lines jsonb`, `capped jsonb` | what was written; per-account cap reductions at apply |
| `auto_apply_at timestamptz` | created_at + 72 h |
| `applied_at`, `applied_by ('user'|'auto')`, `undone_at`, `created_at`, `updated_at` | |

### 3.4 What stays for old native builds (≤ the build before P2)

- Old `walkLegs` order is rule 1 (leg) → carry skip (only builds after 7d01085a) → rule 3 (`transfer_group_id`) → rule 4 (`is_cash_flow=false`) → rule 6 (deposit) → rule 8 (withdrawal moves the holder).
- Label rows carry no leg, no `transfer_group_id` and `is_cash_flow=false`. Every old build therefore skips them: deposits at rule 6 and withdrawals at rule 4. 0356 moves the carry keys off `transfer_group_id`, which removes the 1,000→1,300 orphan-move bug on old builds too.
- Old builds see each extra Monthly savings part as another "Monthly Savings" pocket, and a goal's extra parts as pockets linked through `linked_savings_account_ids` (the mirror).
- Old builds may write `status='active'` on an achieved goal. The trigger keeps it achieved.
- Old builds ignore `anchor_balance` and read `delta`. That is correct at write time, and only the late-SMS double count stays on them.
- Old builds clamp free at 0 and do not know card hold-back. That is display only.
- Old builds still write `linked_payment_method_id` (ignored; a BEFORE INSERT/UPDATE trigger in 0355 sets it to NULL) and `target_amount` (ignored after 0355).

## 4. Algorithms

Notation: `→X` = convert at live rate (display) unless a booked amount exists; `cents()` rounds half-up to the currency's minor unit (`minorUnit`).

### 4.1 Balance and free(A) incl. card hold-back

```
balance(A, t):
  base = latest anchor in {opening(A)} ∪ {adj ∈ adjustments(A) : adj.anchor_balance != null, adj.occurred_at ≤ t}
  legs = walkLegs rows for A with base.at < row.at ≤ t        // legacy delta adjustments stay legs
  amount(row) = row.account_amount ?? row.to_account_amount (dest side) ?? convertLive(row)   // I-10
  return base.value + Σ amount(legs)

walkLegs rule order (savings_transactions): ONE new rule in front, rules 1–8 exactly as today for every other row
  0  t.source ∈ LABEL_SOURCES {set_aside, opening, release, spent, move_out, move_in, month_end, month_end_undo, close} → skip
     (only rows written by the new writers carry these sources; legacy rows keep today's meaning:
      'transfer' + transfer_group_id + is_cash_flow=false = pocket↔pocket move → rule 3; 'carry' → rule 5; declare → rule 4;
      legless withdrawal with no income event → rule 8 = money left the holder)
  1–8 unchanged (balance.ts:174-198); P1 regression test: the same pre-P1 ledger gives identical balances before and after.
anchors: the gap shown and counted is derived at read time = anchor_balance − ledger(just before anchor, current rows);
  the stored `delta` is never read by new code (old builds only).

cardHold(A):
  Σ over credit cards c with paysFrom(c) = A:
     owed(c) − unbilledPlanPrincipal(c), converted c.currency→A.currency at the live rate (no rate → A.approx, hold = owed 1:1 refused: A gets cap 0)
  paysFrom(c) = c.parent_id ?? c.pays_from_payment_method_id ?? lastPayer(c) ?? primary(c.currency) ?? primary(any)
     lastPayer(c) = resolve(paymentMethodId) of the newest debt payment to c's debt that resolves to a live account
  owed(c) = computeCreditCardOutstanding(cardDebt)          // full plan price is a charge at purchase
  unbilledPlanPrincipal(c) = Σ over plans P on c: P.amount × max(0, P.count − billedOrCurrent(P))
     billedOrCurrent(P) = number of P's instalment bill dates ≤ the card's next statement close (paymentDueDay)

free(A) = balance(A) − held(A) − cardHold(A)                    // no clamp
freeTotal = Σ_A free(A)→base ;  "of Σ balance(A)→base in your accounts"
```

### 4.2 Shortfall

```
uncoverOrder(A) = parts held in A sorted by:
  Monthly savings part, then pockets (newest first), then goal parts by goal.priority desc (lowest priority first), achieved goals last (OQ-1)
covered(p): walk uncoverOrder(A) with s = short(A); u = min(s, p.balance); s -= u; covered = p.balance − u
trigger: after any change of balance(A) (ledger row or anchor) and after SMS pairing ran for it
  if short(A) > 0 and (no open episode for A): notify once ("X of what you set aside isn't in CIB anymore")
  pure FX moves never trigger: parts are in A's currency, so FX cannot change short(A)
  episode closes automatically when short(A) = 0; a new drop after close opens a new episode
  episode key = (A, first time short > 0), stored client-side in prompt_state (no table)
choices:
  It's in another account (pre-filled with the destination of an own transfer out of A in the last 7 days):
     for p in uncoverOrder(A) until s = 0: amt = min(p.balance, s); moveAmount(p, B, amt)  // 4.7, capped at free(B)
  I spent it: release `spent` from Monthly savings part first, then the parts the user picks; total = short(A)
  Keep for now: dismiss the episode; "Short X" stays; progress uses covered()
```

### 4.3 Leftover for a cycle C

```
countsIn(row, C):
  P = proposal for cycle(row.date)
  if P exists and row.created_at > P.created_at: cycle = cycleContaining(row.created_at)   // late SMS / refund
  else cycle = cycle(row.date)
  return cycle == C
income(C)        = Σ received income events counted in C, at frozen C.rates (account_amount where present)
spending(C)      = Σ spend expenses counted in C (non-spend, refunded parts, card bills, card-plan and BNPL instalments excluded;
                   card purchases count at purchase; a refund of a closed month's expense counts as −spending in C)
savedNet(C)      = Σ labels in C with source ∈ {set_aside} + legs out of accounts into outside parts in C (gold bought: the
                   account_amount, never grams)  −  Σ labels {release, spent} in C − Σ pocket-funded spend withdrawals in C
                   (month_end, month_end_undo, opening, move_*, close excluded)
                   legacy rows (written before P2, no label source): counted exactly as today's isCountedDeposit
                   (deposit, is_cash_flow ≠ false, source ≠ 'carry') plus Savings-category expenses; legacy withdrawals not subtracted
unexplainedOut(C)= Σ max(0, −(anchor − ledger just before anchor)) for anchors counted in C   // positive gaps ignored (OQ-4)
leftover(C)      = income − spending − savedNet − unexplainedOut
```

### 4.4 Month-end proposal, apply, undo

```
cycles: first cycle for a user = last closed cycle by cycleRange(month_start_day); next = [prev.cycle_end, first boundary of the
  current month_start_day strictly after prev.cycle_end). A start-day change therefore makes one short or long cycle, never a gap or overlap.
propose(user, C)  — called by POST /api/month-end {op:'propose'} on first app open after C ends, or by the cron (day 1, 06:00 user tz):
  if proposal exists → return it
  rates = live rates now (fail closed: no rates → no row, retry next run)
  L = leftover(C); if L ≤ 0 → insert status 'empty' with figures ("You spent −L more than you received"); return
  caps(A) for A live, canHoldParts:  max(0, min(free(A, C.end), free(A, now)))  (free(A,t) uses balance(A,t), held at t, cardHold now)
  placeable = min(L, Σ caps→base) ; not_placed = L − placeable
  lines = split(placeable)
  insert status 'proposed', version 1, auto_apply_at = now + 72h
split(amount):
  items = live split lines in sort order (skip items whose goal is achieved or deleted; their pct joins the rest)
  for line: want = cents(amount × pct / 100)
     if item is a goal: want = min(want, max(0, target − progress(goal)) at rates)     // overflow joins the rest
  rest = amount − Σ want → Monthly savings
  for each (item, want) then (MS, rest): fill(item, want)
fill(item, want):
  order = item's existing live parts sorted by remaining cap desc, then other accounts sorted by remaining cap desc
          (caps compared in base at the proposal's rates when proposing, at `rates_apply` when applying; Deep fix 8)
  take = min(want, cap); line(item, part|new, A, cents(take→A.currency), take); cap(A) -= take; want -= take
  any want left (all caps 0) → added to not_placed
edit (client, status proposed): PATCH lines; server re-runs the caps, rejects a line over its cap → 'over_cap'; version += 1
apply(user, id, version, by):   (user confirm, or cron when status='proposed' and auto_apply_at ≤ now)
  recompute caps against free NOW; walk lines in order, cut each to its account's remaining cap, and re-fill the cut for the
  same item through fill() (existing parts first, then most remaining cap); what still fits nowhere → not_placed;
  record capped[] ("CIB had only 6,000 free; 27,000 set aside in Deel instead")
  SQL apply_month_end (one transaction):
     UPDATE proposals SET status='applied', version=version+1, applied_* WHERE id AND status='proposed' AND version=p_version
     if 0 rows → return 'conflict' (the other caller won; the client re-reads)
     for line: upsert the part (id = partId(item_id, account_id), on conflict revive; name/icon/color copied from the item)
               label_part(part, +amount, 'month_end', key = hash(proposal.id, part.id))
  notify (dedupe `month-end:<month_key>`)
undo(user, id):  status must be 'applied'; for each applied line: label_part(part, −min(amount, part.balance),
  'month_end_undo', key = hash(id, part.id, 'undo')); status 'undone' (terminal); the shortfall from an already spent part is reported, not forced
cron /api/cron/month-carry → /api/cron/month-end: (a) apply due proposals: SELECT … WHERE status='proposed' AND auto_apply_at ≤ now()
  ORDER BY auto_apply_at LIMIT 200 (partial index); (b) propose for users whose next cycle has ended and who have no row:
  RPC month_end_due_users(p_after uuid, p_limit int) (keyset on user_id, LIMIT); time budget 50 s, cursor in the response.
  Writes stay behind MONTH_END_WRITES=on (the old MONTH_CARRY_WRITES path is deleted).
```

Rules:
- Each placed amount is converted at the frozen `rates_apply`, and the part stores it in its own currency (I-10).
- A goal reaching its target through month-end is stamped achieved by the same apply (4.5).

### 4.5 Goal progress and completion

```
progress(G) = Σ_p∈parts(G) value(covered(p)) → G.currency      // gold: grams × karat price; missing price → last price + warning
achieve(G): when status='active' and progress(G) ≥ target − ε → status='achieved', achieved_at=now (client reconcile + server apply)
manual "Mark achieved" stays.
after achieved: never reverts (I-12); removed from split (4.4); Add money hidden; Release / I spent it / Withdraw still allowed;
  card shows the trophy and its achieved figure (achieved_at); no "below target" copy
paused goals: kept in split? no: paused goals' lines are skipped like achieved ones (their pct joins the rest)
Resume (paused → active) stays; the writers at goals/page.tsx:95 and GoalDetailSheet.tsx:156 must guard status==='paused'
```

### 4.6 Release and "I spent it" (labels)

```
release(p, amt):  require 0 < amt ≤ p.balance; label_part(p, −amt, 'release'); balance(A) unchanged; free(A) += amt
spent(p, amt):    same with 'spent' (the debit already counted as spending, or the drop counted in unexplainedOut)
Withdraw (outside parts only): real withdrawal; with a destination account → leg +amount there (rule 1), source 'withdraw'
```

### 4.7 Moving a part (across accounts or currencies)

```
moveAmount(p in A, B, amt):           // never updates held_in (set-once invariant)
  require canHoldParts(B); amtB = cents(amt → B.currency at the booked rate of the transfer row if one exists, else live)
  require amtB ≤ free(B)  ('over_available' otherwise; offer the max)
  q = part(item(p), B) or upsert (id = partId(item, B), revive if deleted)
  pair = uuid; label_part(p, −amt, 'move_out', pair); label_part(q, +amtB, 'move_in', pair)
  an emptied part is never soft-deleted by a move: it stays at 0 and is hidden (a later fill reuses the same row, so the
  derived id never collides with a deleted row). Only item deletion soft-deletes parts; insert paths upsert with
  `on conflict (id) do update set deleted_at = null` (revive), as the old vault code had to.
  partId(item, account) = uuid from a sync SHA-256 of `part|<item_id>|<account_id>` in a shared module
  (`src/lib/savings/partId.ts`, pure JS hash usable on client and server; server `groupIdFor` keeps node:crypto)
```

### 4.8 Closing or deleting an account

```
closeAccount(A):
  if held(A) > 0: open "Where did this money go?" per part (pre-filled: an own transfer out of A → that account):
     • In <B> → moveAmount(p, B, p.balance)   • Spent → spent(p, p.balance)   • Cash at home → moveAmount(p, Cash, …)
  then removePaymentMethod(A,'close'); refuse while held(A) > 0 → 'needs_answer'
  parts still pointing at a closed/deleted holder (legacy) count 0 in NW and progress, and are listed for repair
deleting a goal/pocket: held parts → release(p, p.balance), then soft-delete (pocketCloseAdjustments only for leg-bearing rows);
  outside parts → ask: keep (item_id := own id; becomes a pocket) or remove (Withdraw to an account, or write off with a 'close' label)
Monthly savings: not deletable (canDeletePocket → 'system')
```

### 4.9 Outside money entry ("Where is this money?")

```
• An account I haven't added → create the account with its real balance (opening anchor), then set_aside into the item (≤ free)
• Cash at home → Cash account: untracked → set opening balance; tracked → adjustment anchor = current + amount
  (reason 'opening_correction'); then set_aside into the item
• Gold or other → outside part (held_in NULL, currency XAU/other, karat), first row label 'opening'
None of these are income (I-8); none count in savedNet (the 'opening' label is excluded; the account opening is an anchor).
```

### 4.10 Card instalments as settlements

```
purchase on a plan: one expense on the card, full price, spend; plan row = schedule (linked_credit_card_debt_id = card debt)
instalment: no money moves by itself; the card bill payment (CC Payoff, non-spend) pays billed instalments + purchases
legacy instalment payment rows on card plans: category 'Installment' (non-spend); amount counts as a payment to the card debt
debtRemaining excludes plans with linked_credit_card_debt_id (owed once inside owed(c))
BNPL/valU: unchanged installment debts (isBnplPlan); instalments are settlements; recurringDebtDueHandlers uses
  isSettlementPlan(debt) = isBnplPlan(debt) || isCardPlan(debt)
```

### 4.11 Net worth

```
NW = Σ_{A live, !excluded} balance(A)→base
   + Σ parts with held_in IS NULL → base (gold at karat price; unpriced → excluded + incomplete flag)
   + Σ parts whose holder exists, is untracked, open and not deleted → base (counted standalone until the account is tracked)
   + investments (holdings + investment-category outside parts)
   − (debtRemaining − card-plan principal already inside owed(c))
parts whose holder is closed or deleted: 0
```

## 5. File-by-file change list, by phase (each phase ships alone; tests named → section 6)

**P1: Ledger correctness (no schema, no UI).** It ships first, because it fixes wrong numbers that are on screen today.

| File | Change |
|---|---|
| `src/lib/accounts/balance.ts` | Add `freeSigned` (unclamped; `free` stays clamped until P3). Add rule 0 (`LABEL_SOURCES` only). Export `LABEL_SOURCES`. |
| `src/lib/accounts/kinds.ts` | Add `isLiveAccount` and `canHoldParts` (I-11). |
| `src/lib/accounts/netWorthBasis.ts` | Parts with a closed or deleted holder → excluded (0), not standalone. Use `isLiveAccount`. |
| `src/lib/savings/netWorth.ts` | Pass through. Subtract card-plan principal once (helper `cardPlanPrincipalInside`). |
| `src/lib/debt/bnpl.ts` | Add `isCardPlan`, `isSettlementPlan`. |
| `src/lib/debts/recurringDebtDueHandlers.ts` | Use `isSettlementPlan` for the category. |
| `src/lib/savings/pocketHome.ts`, `pocketHolder.ts`, `goals/goalPocket.ts#goalHomeAccounts` | Use `canHoldParts`. |

P1 tests: T0 (a recorded pre-P1 ledger snapshot of 3 QA users gives identical balances, held and NW before and after P1), T2, T3, T19, T20, T25.

**P2: Schema for parts and labels (0355–0357, 0359, 0360).**

| File | Change |
|---|---|
| `src/lib/store/types.ts` | `SavingsAccount.itemId`; `SavingsTransaction.idempotencyKey/pairId/accountAmount`; `AccountAdjustment.anchorBalance`; `Expense.accountAmount/toAccountAmount`; `IncomeEvent.accountAmount`. Remove `targetAmount`. |
| `src/lib/supabase/database.types.ts`, mappers | Regenerate. Map the new columns. |
| `src/lib/accounts/balance.ts` | Anchors in `computeBalances` and `balancesOverTime`. Use booked amounts. |
| `src/lib/accounts/actions.ts#updateBalance`, `gapSurplus.ts`, SMS balance ingestion | Write anchors (`anchor_balance` + `delta`). |
| New `src/lib/savings/labels.ts` | `setAside`, `release`, `spent`, `moveAmount`, `uncoverOrder`, `covered`. These are the only label writers (store actions call them). |
| `src/lib/store/useFinanceStore.ts` | New actions `setAsideInPart`, `releasePart(reason)`, `movePart`. `withdrawFromSavings` is limited to outside parts. `depositToSavings` routes held parts to `setAsideInPart`. `deleteSavingsAccount` releases first. |
| `src/lib/goals/exclusivePockets.ts` | Retired (parts belong to one item by schema). |
| `src/lib/accounts/resolve.ts`, `src/lib/debts/bnplSplit.ts`, `netWorthSnapshot.ts`, `netWorthTrend.ts` | No change (snapshots keep `netWorthBasisOf`; a basis change shows as a new series point, as today). |
| `src/lib/goals/goalPocket.ts` | `createGoalPocket` and `depositIntoGoal` create parts with `itemId = goal.id`. `relinkGoalPocket` retired. |
| `src/lib/savings/canDeletePocket.ts` | Monthly savings → `{ok:false, reason:'system'}`. The `default` reason is retired with `defaultCarryPocketId`. |

P2 tests: T4, T5, T6, T21, T22, T48.

**P3: Card hold-back (0358).**

| File | Change |
|---|---|
| New `src/lib/accounts/cardHold.ts` | `paysFrom`, `unbilledPlanPrincipal`, `cardHold(A)`. |
| `src/lib/accounts/balance.ts` | `AccountBalance.cardHold`; `free` becomes `balance − held − cardHold`, unclamped (`freeSigned` removed). Consumers that need a non-negative cap use `Math.max(0, free)` explicitly: `savings/pocketHome.ts` (availableIn, exceedsAvailable, transferRefusal, explainDepositRefusal), `savings/assetPurchase.ts`, `accounts/useAccounts.ts`, `AccountPicker.tsx`, `AccountRow.tsx` (shows −X), `AccountDetailSheet.tsx`, `MoveMoneySheet.tsx`, `PocketFormSheet.tsx`, `NewGoalFlow.tsx`, `useNewGoalForm.ts`, `sms/matchSalary.ts`, `api/buddgy/turn/route.ts`. Audit the other `.free` hits (budget `FlowStrip`, `FreeCapsule`, `studioEntities`, …): they are budget free, not account free; no change. |
| `src/lib/debt/computeCreditCardBalance.ts` | Plan payments count toward the card. Export plan-schedule helpers. |
| Add card form | Asks "pays this card from" when Linked account is None. |

P3 tests: T1, T7, T8, T9.

**P4: Shortfall and closing.**

| File | Change |
|---|---|
| New `src/lib/savings/shortfall.ts` | `short`, episodes, choices, using `labels.ts`. |
| `src/lib/accounts/removePaymentMethod.ts` | `needs_answer` while `held > 0`. |
| `src/lib/accounts/actions.ts#closeAccount` | Opens the sheet. |
| `pocketCloseAdjustments.ts` | Used only for leg-bearing parts. |

P4 tests: T10, T11, T12, T13, T14, T15, T16.

**P5: Goals on parts.**

| File | Change |
|---|---|
| `src/lib/goals/computeGoalProgress.ts` | Sum `covered()` over `parts(goal)` (by `itemId`), at karat price, with a last-price fallback and warning. Pocketless goals unchanged. |
| `src/lib/goals/reconcileAchievedGoals.ts` | One-way. Skip non-active goals (already done). |
| Resume writers (`goals/page.tsx:95`, `GoalDetailSheet.tsx:156`) | Guard on `status==='paused'`. |
| `src/lib/savings/savingsConversions.ts` | Part value uses its karat. |

P5 tests: T17, T18, T24, T41, T42, T43, T44, T45.

**P6: Month-end (0361, 0362).**

| File | Change |
|---|---|
| New `src/lib/monthEnd/leftover.ts` | `countsIn`, `leftover`. Replaces `cycleCarryFigures.ts`. |
| New `src/lib/monthEnd/proposal.ts` | `caps`, `split`, `fill`, `capAtApply`. Pure, shared by the client card and the server. |
| `src/lib/savings/carryDateLogic.ts` | `nextCycle(prev, startDay)`. |
| New `src/app/api/month-end/route.ts` | Ops `propose`, `edit`, `apply`, `undo`. Server ledger load by `user_id`, `computeBalances`. |
| `src/app/api/cron/month-carry/route.ts` | Rewritten as month-end (due proposals plus `month_end_due_users`). |
| New `src/lib/server/monthEndLedger.ts` | Loads one user's ledger with bounded queries. |
| Retired | `src/lib/server/carryAdjust.ts`, `carryCycle.ts#closedCycleDrift/rowsChangedSince`, `allocateGoalFunding.ts`, `goals/allocateMonth.ts`, `savings/monthCarry.ts` (`computeMonthCarry`, `carryDrift`, `resolveCarryDestination`, `findUnlinkedGoalPocket`, `isCarrySetAside`), `cycleCarryFigures.ts`. `pocketLedger.ts` keeps `groupIdFor` only. `carryCycle.ts` keeps `fetchRates`, `allRows`, `must` (moved to `server/monthEndLedger.ts`); `loadCycle`, `carryPostDate`, `CycleDriftItem` retired. |
| Split screen | "Where your monthly savings go" (lines + rest row). |

P6 tests: T23, T26–T40, T46, T47.

**P7: Cleanup (0364)** after old builds age out.

## 6. Test matrix

**Fixture F** (all tests start here unless stated). Base EGP, `month_start_day = 1`, user timezone Africa/Cairo.

Rates: USD→EGP 50. 24k gold 4,000 EGP/g, so 21k = 3,500 EGP/g.

| Account | Opening on Nov 1 | Movements in November | Balance on Nov 30 |
|---|---|---|---|
| CIB Current (EGP bank) | 60,000 | salary +60,000 (Nov 25), debit spend −20,000 | 100,000 |
| Deel (USD wallet) | $700 | freelance +$300 | $1,000 |
| Cash (EGP, tracked) | 3,000 | −1,000 | 2,000 |
| NBE (EGP bank) | 0 | none | 0 |

CIB Card (credit card, `parent_id` = CIB, `paymentDueDay` 10):
- previous statement fully paid;
- purchases 4,000 (Nov 15–25);
- TV plan bought Nov 12 on the card: 12,000 = 6 × 2,000, first instalment billed Dec 10.
- Card owed = 16,000.

Items:

| Item | Type | Parts |
|---|---|---|
| Car | goal, target 150,000 EGP, priority 1 | CIB 20,000; Deel $200 |
| Travel | pocket | CIB 5,000; 5,000 of it was set aside in November |
| Monthly savings | system | CIB 3,000 |
| Wedding | goal, target 50,000, priority 3 | outside part: 10 g of 21k gold |

Split lines: Car 50%, Travel 20% (the rest goes to Monthly savings).

November figures: income 60,000 + 15,000 = 75,000. Spending 4,000 + 12,000 + 20,000 + 1,000 = 37,000. savedNet 5,000. Leftover 33,000.

Derived values in F:

| Value | Result |
|---|---|
| held(CIB) | 28,000 |
| cardHold(CIB) | 16,000 − 10,000 = 6,000 |
| free(CIB) | 66,000 |
| free(Deel) | $800 |
| free(Cash) | 2,000 |
| freeTotal | 108,000 |
| Σ balances | 252,000 |
| Car progress | 20,000 + $200×50 = 30,000 (20%) |
| Wedding progress | 35,000 |
| NW | 100,000 + 50,000 + 2,000 + 0 + 35,000 − 16,000 = 171,000 |

| # | Scenario (from F) | Input | Expected |
|---|---|---|---|
| T1 | Free not clamped | CIB debit −80,000 (Dec 1) | balance(CIB) 20,000; held 28,000; short 8,000; free(CIB) −14,000; hero "Free to spend −14,000 + 40,000 + 2,000 = 28,000" total; NW 91,000 |
| T2 | Legacy carry label, 1,000 vs 1,300 | account X balance 1,000; part in X 300 from a `source='carry'` row with `transfer_group_id` (pre-0356) and, separately, the same row after 0356 (`idempotency_key`, no group) | balance(X) 1,000 in both; held 300; free 700 |
| T3 | Card plan owed once | F, legacy plan row also present as a separate debt 12,000 | NW 171,000 (not 159,000); debts shown: card 16,000 with "TV 1 of 6 · 2,000/mo" inside |
| T4 | Labels never move balances | release(Travel, 2,000); then spent(MS, 3,000); then setAside(Travel, 1,000) | balance(CIB) 100,000 throughout; held 28,000 → 26,000 → 23,000 → 24,000; free 66,000 → 68,000 → 71,000 → 70,000; NW 171,000 throughout |
| T5 | SMS anchor, no double count | Dec 2 SMS "CIB balance 97,000" (ledger 100,000) → anchor; then a late SMS debit −500 dated Dec 1 10:00 arrives | balance(CIB) 97,000 after both (the −500 is inside the anchor); derived gap 2,500; spending(Dec) +500; unexplainedOut(Dec) 2,500 (total outflow 3,000, counted once); old delta model would give 96,500 |
| T6 | Booked rate | own transfer Deel → CIB $1,000 at 50 (`to_account_amount` 50,000); rate moves to 45 | balance(CIB) 150,000 at both rates; balance(Deel) $0; NW at 45: 150,000+0+2,000+35,000−16,000 = 171,000; Deel now short $200 (shortfall flow, see T15) |
| T7 | Hold-back excludes unbilled plan | F | cardHold(CIB) 6,000 (4,000 purchases + 2,000 Dec-10 instalment); free 66,000 |
| T8 | Bill payment | Dec 15: pay the Dec-10 statement 6,000 from CIB (CC Payoff) | balance(CIB) 94,000; owed 10,000; unbilled 8,000; hold 2,000; free(CIB) 94,000 − 28,000 − 2,000 = 64,000; spending(Dec) += 0; NW 171,000 |
| T9 | Card with no linked account | card `parent_id` NULL, no `pays_from`, last payment from NBE | hold 6,000 lands on NBE: free(NBE) −6,000; free(CIB) 72,000; Add card asks "pays this card from" once |
| T10 | Shortfall, uncover order | T1 state | MS 3,000 uncovered, Travel 5,000 uncovered, Car covered 20,000; Car progress 30,000; notice once "8,000 of what you set aside isn't in CIB anymore" |
| T11 | Deeper shortfall | CIB debit −82,000 instead | short 10,000: MS 0, Travel 0, Car CIB covered 18,000; Car progress 28,000 (18.7%) |
| T12 | "It's in another account" | own transfer CIB → NBE 80,000; choose NBE (pre-filled) | labels: MS CIB −3,000 / MS NBE +3,000, Travel CIB −5,000 / Travel NBE +5,000; held CIB 20,000, NBE 8,000; short 0; free(CIB) 20,000−20,000−6,000 = −6,000 ("Free to spend −6,000", no shortfall); free(NBE) 72,000; NW 171,000 |
| T13 | "I spent it" | T1 state, I spent it | MS −3,000 (spent), picker: Travel −5,000; held 20,000; short 0; balance(CIB) 20,000 unchanged by labels; free −6,000; Dec savedNet −8,000 |
| T14 | FX-only move | rate USD 45 | no shortfall on Deel (held $200 ≤ $1,000); Car progress 20,000 + 9,000 = 29,000 "includes rate changes"; NW 166,000 |
| T15 | Close account with goal money | Deel balance $1,000 holds Car $200; transfer Deel → CIB $1,000 (50,000 booked); close Deel; answer "In CIB" | Car CIB part 20,000 + 10,000 = 30,000; Deel part 0 (soft-deleted); held(CIB) 38,000; balance(CIB) 150,000; free(CIB) 106,000; close allowed; NW 150,000 + 0 (Deel closed) + 2,000 + 35,000 − 16,000 = 171,000 |
| T16 | Close refused | close Deel with Car $200 unanswered | `needs_answer`; account stays open |
| T17 | Achieved is permanent | goal Phone target 10,000, part CIB 10,000 → achieved; then spent(Phone, 10,000) | status achieved; progress 0; trophy list; no "below target" copy; old build writes `status='active'` → row still achieved (trigger) |
| T18 | Achieved under FX | goal Laptop target $200, part Deel $200 → achieved; rate drops | stays achieved; split skips Laptop |
| T19 | Money in a closed account | legacy part 5,000 whose holder was closed without the flow | NW counts it 0 (not +5,000); listed for repair |
| T20 | Untracked holder | part 4,000 held in an account with no opening balance | counted standalone: NW +4,000; when the account is tracked with balance 4,000, NW +4,000 once (account), the part is then held |
| T21 | Outside money: cash at home | "Cash at home" 5,000 into new pocket Home | Cash anchor 7,000; Home part 5,000 held in Cash; NW 176,000; leftover(Nov) unchanged 33,000 (opening, not income, not savedNet) |
| T22 | Outside money: gold | add 2 g 21k to Wedding as "Gold or other" | Wedding outside part 12 g → 42,000; NW 178,000; not income |
| T23 | Gold bought from an account in the month | Nov 20: buy 2 g 21k from CIB for 7,000 into Wedding | balance(CIB) 93,000; Wedding 42,000; savedNet(Nov) 12,000; leftover 26,000 (month not "empty", no gold price needed server-side) |
| T24 | Covered progress with outside part | T11 state | Wedding 35,000 unaffected (outside); Car 28,000 |
| T25 | Instalment not spending | legacy BNPL/valU instalment 1,500 and card-plan instalment row 2,000 in Dec | spending(Dec) += 0 for both; categories `Installment` |
| T26 | Month-end base | F; propose Dec 1, apply | caps CIB 66,000, Deel 40,000, Cash 2,000 (Σ 108,000); placeable 33,000; Car 16,500 → CIB; Travel 6,600 → CIB; MS 9,900 → CIB; held(CIB) 61,000; free(CIB) 33,000; NW 171,000; Car progress 46,500 |
| T27 | Caps change fill | F but cap(CIB) 10,000 (free 10,000) | Car 16,500 → Deel $330 (existing part with most cap); Travel 6,600 → CIB; MS 3,400 → CIB + 6,500 → Deel $130; not_placed 0 |
| T28 | Not enough free | caps CIB 10,000, Deel $100, Cash 2,000 | placeable 17,000, not_placed 16,000 ("16,000 saved but not set aside: no account had it free"); Car 8,500 → CIB; Travel 1,500 → CIB + 1,900 → Deel $38 (new part); MS 3,100 → Deel $62 + 2,000 → Cash (new part) |
| T29 | Goal near target | Car target 40,000 (progress 30,000) | Car 10,000 → CIB, overflow 6,500 to MS; MS 16,400 → CIB; Travel 6,600; Car achieved by the apply |
| T30 | Negative month | Nov spending 80,000 | leftover −10,000; status `empty`; card "You spent 10,000 more than you received"; nothing set aside or released |
| T31 | New salary in days 1–3 | F with free(CIB, Nov 30) 10,000 (other caps unchanged); salary +60,000 lands Dec 2; auto-apply Dec 4 | cap(CIB) = min(10,000, 70,000) = 10,000; placement identical to T27 |
| T32 | Spending in days 1–3 | after propose (T26), CIB debit −60,000 Dec 2, then confirm | free(CIB) now 6,000 → cap 6,000; applied: Car 6,000 → CIB + 10,500 → Deel $210; Travel 6,600 → Deel $132 (new part); MS 9,900 → Deel $198 (new part); capped[] reports CIB −27,000 refilled; not_placed 0 |
| T33 | Confirm races auto-apply | user confirm (v1) and cron apply (v1) at once | exactly one `applied`; the other gets `conflict`; one set of `month_end` labels (idempotency keys) |
| T34 | Undo | after T26, user spent 5,000 of MS CIB part (label `spent`), then Undo | Car −16,500, Travel −6,600, MS −min(9,900, 7,900) = −7,900; status `undone`; Undo button gone; re-propose impossible |
| T35 | Start-day change | Nov proposal cycle Nov 1–Dec 1; on Dec 10 start day → 15 | next cycle Dec 1–Dec 15 (one short cycle), then Dec 15–Jan 15; no day counted twice or skipped |
| T36 | Late refund | refund 1,000 on a Nov expense arrives Dec 5 (Nov already proposed) | Nov figures unchanged; spending(Dec) −1,000 |
| T37 | Unexplained drop | Nov 28 SMS anchor CIB 97,000 vs ledger 100,000 | unexplainedOut(Nov) 3,000; leftover 30,000; cap(CIB) 63,000 |
| T38 | Split ≤ 100 | add a line 40% with Car 50% + Travel 20% | refused `split_over_100` |
| T39 | Server cap | client sends a line 70,000 to CIB (cap 66,000) | `over_cap`; nothing written |
| T40 | Achieved / paused goal in split | Car achieved before month-end | Car's 50% joins the rest: MS 26,400 → CIB; Travel 6,600 |
| T41 | Delete a goal with held parts | delete Car | release CIB 20,000 and Deel $200; held(CIB) 8,000; free(CIB) 86,000; free(Deel) $1,000; Car line removed (its 50% joins the rest); NW 171,000 |
| T42 | Delete a goal with an outside part | delete Wedding → Keep / Remove | Keep: part becomes pocket "Wedding" (item_id = own id), NW 171,000. Remove → Withdraw into CIB for 35,000: CIB 135,000, NW 171,000. Remove → write off (`close` label): NW 136,000 |
| T43 | Delete a pocket | delete Travel | release 5,000; held(CIB) 23,000; free(CIB) 71,000; Travel line removed; NW 171,000 |
| T44 | Missing gold price | gold price unavailable (last price 3,500 on Nov 29) | Wedding progress 35,000 with "price from Nov 29"; NW 136,000 flagged incomplete (gold left out, never 1:1) |
| T45 | Monthly savings undeletable | delete MS | `canDeletePocket` → `{ok:false, reason:'system'}`; rename allowed; hidden when every MS part is 0 |
| T46 | Late expense, closed month | Nov proposed Dec 1; Dec 2 an SMS for a −1,000 CIB debit dated Nov 29 arrives | Nov figures unchanged (leftover 33,000); spending(Dec) +1,000; balance(CIB) 99,000 now; cap(CIB) at apply 65,000; T26 placement unchanged |
| T47 | Rate change after close | Nov applied at 50; rate later 45 | Nov row keeps income 75,000, rates {USD:50}; Deel parts keep their USD amounts; nothing re-priced |
| T48 | Outside money: account not added | "An account I haven't added": QNB EGP, real balance 12,000; set aside 12,000 into Wedding | QNB anchor 12,000; Wedding part in QNB 12,000; Wedding progress 47,000; NW 183,000; leftover(Nov) unchanged |

T32: fill after the 6,000 CIB cap is exhausted uses Deel (cap 40,000) then Cash (2,000).
- Car 16,500 = 6,000 CIB + 10,500 Deel ($210).
- Travel 6,600 → Deel ($132).
- MS 9,900 → Deel 9,900 ($198).
- Deel total 27,000 ≤ 40,000.

## 7. Open questions (with recommended defaults)

| # | Question | Default |
|---|---|---|
| OQ-1 | Where do plain pockets and achieved goals sit in the uncover order? (The sources only name "Monthly savings, then the lowest-priority goal".) | Monthly savings → pockets (newest first) → goals by priority, lowest first → achieved goals last. |
| OQ-2 | Fixed-amount goals (`monthly_contribution`) in a %-only allocator. | No line is created. The goal card keeps "needs X/month" from `goalPlan`, and the split screen pre-fills `pct = fixed / last leftover`, shown to the user (not saved until they confirm). |
| OQ-3 | Legacy card plans with no purchase charge on the card (count in 0363). | Insert one card charge for the remaining principal, dated at the plan start, with `spend_exclusion='manual'` so it never counts as spending. Owner to confirm if the count is > 0. |
| OQ-4 | Does an unexplained SMS balance *rise* count as leftover? | No (conservative). It raises free money only, so a later month-end can place it once it is real leftover. |
| OQ-6 | Order of an item's existing parts in fill() (sources say only "existing parts first"). | Most remaining cap first (T27 sends all of Car to Deel). Alternative: the part in the account that received most of the month's income. |
| OQ-7 | Fixed-goal amounts for OQ-2 after 0364 drops `monthly_contribution`. | Run the OQ-2 pre-fill once in P6 and store it as a pending suggestion in `prompt_state`; then 0364 may drop the column. |
| OQ-8 | Category for goals created from targeted pockets (0355). | `quality_of_life`, name kept; the user can change it. |
| OQ-5 | Item name, icon and colour are copied onto each part. | Rename and recolour update every part of the item in one store action. Revisit if a pocket table is ever needed. |
