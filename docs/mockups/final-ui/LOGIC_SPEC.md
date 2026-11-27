# buddget money model: logic spec (v2, 2026-11-27)

This is the one definition engineers build.

- **Sources, in priority order:** owner rules (end of `COUNCIL_DECISIONS.md`), then the session-lead decisions on the v1 council attack (`spec_review.md`), then the Deep logic check, then the Final revision, then the Consolidated model, then earlier rounds.
- **Code read:** `origin/main` at `c3b9790a`; the latest migration is 0354.
- **Live counts** quoted here are the council's, from 2026-11-27. **Re-run every count before applying a migration.**
- **v2 changes:**
  - Old native builds are handled by a required update (UpdateGate) instead of compatibility machinery.
  - `savings_accounts.goal_id` replaces the polymorphic `item_id`.
  - Pockets keep one home.
  - The split is stored in `profiles.savings_split`.
  - Month-end extends `savings_month_summary`.
  - Release is not counted in `savedNet`.
  - Undo of a month-end reverts the goal completion it caused.

## 0. Which rule wins (conflicts in the sources, settled)

| Topic | Rule that wins | Rule it replaces |
|---|---|---|
| Achieved goal | Completed for good. It never returns to active, and has no "below target" or "no longer set aside" copy. **The only exception:** Undo of the month-end that completed it reverts that completion in the same transaction. | Deep fix 9, Final rev 5 |
| Card hold-back | Everything owed on the card except unbilled plan principal (Deep fix 2). | Final rev 2 |
| Shortfall trigger | Any drop of the bank-aligned balance, after SMS pairing, with no timer. | Round 4: 24h grace |
| Shortfall choices | It's in another account / I spent it / Keep for now. Applied repeatedly to whatever is still short. | Round 4: Move / I spent it / Ignore |
| Month-end scope | Every live account, each in its own currency. | Round 4 and Audit: base currency only |
| Fill order | Goal and Monthly savings parts: existing parts first, then the account with the most remaining free money. A pocket fills only its one home; its overflow goes to Monthly savings. | Round 5: proportional spread |
| Closed months | Never reopened. A late row counts in the month it arrives. `carryAdjust.ts`, drift and `priorAdjustment` are deleted. | `carryAdjust.ts`, `closedCycleDrift` |
| Allocator | One split, `profiles.savings_split` (% per goal or pocket, at most 100% in total, the rest goes to Monthly savings). To edit a proposal, change the split and re-propose. | Goal share/fixed engine, default carry pocket, top-goal routing |
| Release / "I spent it" | Labels only. They never move a balance. Release is not counted in `savedNet`. | Today's withdrawal path (rule 8) |
| Free money | Can be negative. It is never clamped at 0. | `balance.ts:110` |
| Withdraw | For gold and other outside holdings only. Money set aside in a bank or in Cash uses Release. | Round 3 |
| Money in a closed account | Counts zero. | `netWorthBasis.ts:484` |
| Parts in an untracked account | Counted standalone, listed for repair ("What's the balance of X?"). No new ones: `canHoldParts` refuses untracked accounts. | Implicit third outside kind |
| Card plan | Owed once, inside the card. Full price is spending at purchase. Instalments written after the cutover are settlements. Past rows are left as they were. | Separate debt plus `Debt`-category instalments |
| Old native builds | P2 ships with a required update (UpdateGate min-version bump). No compatibility triggers. | v1 §3.4 machinery |
| Cut for now | "+X from rate changes" (show the note "includes rate changes" instead), multi-home editor, "Is this money in the new bank?", new emergency fund or Zakat work, editing a month-end proposal line by line. | Round 5, v1 |

## 1. Glossary

| User word EN | AR | Data word | Meaning |
|---|---|---|---|
| Free to spend | متاح للإنفاق | `free(A)`, `freeTotal` | Balance − set aside − card hold-back. Can be < 0 ("Free to spend −X"). |
| in your accounts | في حساباتك | `Σ balance(A)` | Sum of live account balances. |
| Set aside | مُخصَّص | `held(A)` | Sum of the parts held in A, in A's currency. |
| Pocket | جيب | part with `goal_id NULL`, `is_monthly_savings=false` | A reserve with one home. |
| Goal | هدف | `goals` row + parts with `goal_id` | A target (amount, date, its own unit). It can have parts in several accounts. |
| Monthly savings | المدخرات الشهرية | parts with `is_monthly_savings=true` | Undeletable. One part per account. Hides when empty. |
| Where your monthly savings go | وين تروح مدخراتك الشهرية | `profiles.savings_split` | `[{target_id, pct}]`, Σ ≤ 100. The rest goes to Monthly savings. |
| Month-end card | بطاقة نهاية الشهر | `savings_month_summary` row, `status='proposed'` | Confirm, or let it apply after 3 days. Undo is available. |
| Short X | ناقص X | `short(A)` | Set aside − balance, when positive. Card money never counts. |
| Release | رجّعه للمتاح | label `release` | Sheet copy: "Stays in CIB, back to Free to spend. It won't be set aside again automatically." |
| I spent it | صرفته | label `spent` | Only in the shortfall flow and when closing an account. The money already left. |
| It's in another account | في حساب تاني | labels `move_out` / `move_in` | The money now sits in another live account. |
| Keep for now | خليه دلوقتي | dismiss | The row keeps "Short X". Progress counts only the covered part. |
| Withdraw | اسحب | real withdrawal | Only for gold and other outside holdings. Money goes into an account (a leg). |
| Outside holding | خارج الحسابات | part with `held_in IS NULL` | Gold or another asset no SMS sees. |
| Saved and invested | المدخر والمستثمر | Savings-page sum | Not net worth (one-line explainer). |
| Net worth | صافي الثروة | `netWorth` | Shown on Accounts only. |
| Achieved | مُنجَز | `goals.status='achieved'` | Final (see §0). |
| Salary / Income | راتب / دخل | copy only | "Salary" only for salary sources. |

**Data words:**
- **Part:** one `savings_accounts` row with one home and one currency.
- **Home:** `held_in_payment_method_id` (a live account) or NULL (outside).
- **Label:** a `savings_transactions` row that changes a part and never an account.
- **Leg:** an effect on an account balance (`walkLegs`).
- **Live account:** see I-11.

## 2. Invariants

- **I-1 Bank truth.** `balance(A,t)` = latest anchor ≤ t (opening balance, or an `account_adjustments` row with `anchor_balance`) + the legs after it, up to t. A row dated before the latest anchor is inside it.
- **I-2 Set aside.** `held(A) = Σ part.current_balance` over the live parts with `held_in = A`. Every such part is in A's currency.
- **I-3 Free and short.**
  - `free(A) = balance(A) − held(A) − cardHold(A)`. It is unclamped.
  - `short(A) = max(0, held(A) − balance(A))`. `cardHold` never counts toward `short`.
- **I-4 Labels.** Set aside, opening, release, spent, move, month-end, month-end undo and close change `part.current_balance` only. They never change any `balance(A)`.
- **I-5 Net worth.** `NW = Σ_{A live, !excluded} balance(A)→base + Σ outside parts→base + Σ parts in untracked open accounts→base + investments − debts`.
  - Held parts count 0 extra times.
  - Parts in closed or deleted accounts count 0.
  - A card plan is owed once.
- **I-6 Goal progress.** `progress(G) = Σ covered(p)→G unit` over G's parts, at live rates. A missing price uses the last price, with a warning.
- **I-7 Month-end cap.**
  - `placed(A) ≤ cap(A) = max(0, min(free(A, cycleEnd), free(A, now)))`. This holds at propose **and** at apply.
  - `placed ≤ min(leftover, Σ cap)`.
  - `leftover = income − spending − savedNet − unexplainedOut`.
- **I-8 Not income, not spending.** Own transfers, card bills, card-plan and BNPL instalments (rows written after the cutover), opening balances, outside-money entry, labels.
- **I-9 Once.** One `savings_month_summary` row per `(user, month_key)`, applied at most once. Enforced by CAS on `version` inside one SQL transaction.
- **I-10 Booked rate.** A cross-currency row **written after P2** stores `account_amount` / `to_account_amount`. Reads use it; a null falls back to the live conversion.
- **I-11 Live account.**
  - `isLiveAccount = isTracked && !closedAt && !deleted`.
  - `canHoldParts = isLiveAccount && !excluded`.
  - One rule for client, server, net worth and month-end.
- **I-12 Achieved is final,** except the month-end Undo revert (§0). A DB trigger enforces it.
- **I-13 One part per home.** At most one live part per (goal, account) and one Monthly savings part per (user, account). A pocket is one row with one home.
- **I-14 Closing and deleting.** An account with `held(A) > 0` cannot close or be deleted until "Where did this money go?" is answered. One guard in `removePaymentMethod`. Afterwards `held(A) = 0`.

## 3. Data model

### 3.1 Per table

| Table | Added | Changed | Retired (dropped in 0364, after P6) |
|---|---|---|---|
| `savings_accounts` | `goal_id uuid references goals(id) on delete set null` (+ index), `is_monthly_savings boolean not null default false` | `held_in_payment_method_id` stays set-once | `linked_payment_method_id`, `target_amount` |
| `savings_transactions` | `idempotency_key uuid`, `pair_id uuid`, `account_amount numeric` | label `source` values (3.3) | none |
| `goals` | none | `status` guarded (I-12) | `linked_savings_account_ids`, `funding_mode`, `share_pct`, `monthly_contribution` |
| `payment_methods` | `pays_from_payment_method_id uuid references payment_methods(id) on delete set null` (+ index), `is_savings boolean not null default false` | none | none |
| `account_adjustments` | `anchor_balance numeric` | `delta` still written (= anchor − ledger at write) for display and audit | none |
| `expenses` | `account_amount numeric`, `to_account_amount numeric` | new card-plan and BNPL instalment rows: category `Installment` | none |
| `income_events` | `account_amount numeric` | none | none |
| `profiles` | `savings_split jsonb not null default '[]'` | none | `default_carry_pocket_id` |
| `savings_month_summary` | `status text`, `version int`, `cycle_start date`, `cycle_end date`, `rates jsonb`, `rates_apply jsonb`, `figures jsonb`, `lines jsonb`, `applied_lines jsonb`, `capped jsonb`, `held_snapshot jsonb`, `auto_apply_at timestamptz`, `applied_at`, `applied_by text`, `undone_at`, `achieved_by_proposal uuid[]` | legacy rows get `status='legacy'` | the `carry`, `carry_adjustment`, `carry_settled_at`, `pocket_id` writers |
| `goal_allocation_runs` | none | read-only history | dropped in 0364 |

**Write rules:**
- Backfill and derived writes bump `updated_at` only, never `edited_at`. `reject_stale_write` (0241:18-35) would otherwise drop users' pending offline edits.
- Nothing in the design raises inside a sync upsert.
- New columns on synced tables come through `sync_pull_v2` / `sync_table_delta` (whole-row jsonb, 0233:17-20) and `sync_changed_since` (0301:23). Check that each function still selects whole rows.
- There are no new synced tables, so the `a0_stamp_insert` / `a0_reject_stale_write` lists (0241:41-44) are unchanged.
- `savings_month_summary` stays server-written: `authenticated` has select only (0316).

### 3.2 Migrations (in phase order; every one: pre-count `SELECT`, RLS `(select auth.uid())`, grants per 0315/0316, FK indexes, `EXPLAIN` without ANALYZE of each new query on live)

**P2 (ships with the required update)**

- **0355_savings_parts.sql**
  - Pre-counts:
    - goals with ≥2 linked pockets (expect 0);
    - pockets linked to ≥2 goals (expect 0);
    - pockets with `target_amount` and no goal (expect about 0);
    - duplicate (goal, holder) after backfill (expect 0);
    - live system vaults per user.
  - Add `goal_id` and `is_monthly_savings`.
  - Backfill `goal_id` from `goals.linked_savings_account_ids`. Set `is_monthly_savings = true` where `id = systemVaultId(user_id)`.
  - Targeted pockets with no goal: create a goal (category `quality_of_life`) and set `goal_id`. Leave `target_amount` in place until 0364.
  - Unique partial indexes:
    - `(goal_id, held_in_payment_method_id) WHERE goal_id IS NOT NULL AND held_in_payment_method_id IS NOT NULL AND deleted_at IS NULL`;
    - `(user_id, held_in_payment_method_id) WHERE is_monthly_savings AND deleted_at IS NULL`.
  - `updated_at = now()` only.
- **0356_savings_labels.sql**
  - Pre-counts: `source='carry'` rows (6 live; out/in legs share a group); rows per `(user_id, account_id, transfer_group_id)` > 1 (expect 0).
  - Add `idempotency_key`, `pair_id`, `account_amount`.
  - Unique `(user_id, account_id, idempotency_key) WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL`. Index on `pair_id`.
  - Backfill carry rows: `idempotency_key = transfer_group_id`, `transfer_group_id = NULL`.
  - RPC `label_part(p_user, p_part, p_amount > 0, p_kind, p_source, p_key, p_pair, p_date, p_note)`, SECURITY DEFINER, `service_role` only:
    - copy `adjust_pocket_balance`'s delta-ON branch (0227:238-248);
    - lock the part FOR UPDATE and compute `balance_after`;
    - **insert the ledger row only**: `trg_savings_tx_delta` (0227:113-150) moves `current_balance`;
    - on an existing `p_key`, return the stored `balance_after`.
  - Soft guard: a BEFORE INSERT trigger on `savings_transactions` for `kind='withdrawal'` with a label source clamps `amount` to the part's balance and appends " (clamped)" to `notes`. It never raises, so a client sync batch is never blocked.
- **0357_goals_achieved_final.sql**
  - Pre-count: achieved goals.
  - BEFORE UPDATE trigger: if `old.status='achieved' and new.status<>'achieved' and new.deleted_at is null and current_setting('buddget.month_end_undo', true) is distinct from '1'`, then keep the old status and `achieved_at`. It never raises.
- **0358_balance_anchors.sql**
  - Pre-count: adjustments by reason.
  - Add `anchor_balance`.
  - Index `(payment_method_id, occurred_at) WHERE anchor_balance IS NOT NULL AND deleted_at IS NULL`.
- **0359_booked_amounts.sql**
  - Columns only, no backfill.
  - Pre-count old cross-currency rows (expense vs resolved account currency, transfers, income events). If there are fewer than about 20, fix them by hand from the SMS text. Otherwise leave them on the live-rate fallback.

**P3**

- **0360_cards_and_savings_accounts.sql**
  - Pre-count credit cards with `parent_id IS NULL`.
  - Add `pays_from_payment_method_id` (ON DELETE SET NULL) and `is_savings`.
- **0361_card_plans.sql**
  - Pre-counts:
    - plans with `installment_provider='credit_card'`;
    - those with no `linked_credit_card_debt_id`, and those where the user has exactly one card debt;
    - card plans with no purchase charge on the card (no expense with `linked_debt_id = plan.id`, and none of the same amount ±3 days on the card).
  - Link single-card cases.
  - For plans with no purchase charge: insert one card charge of the **remaining principal** (category from the plan, `spend_exclusion='manual'`, dated today). The debt is then owed once.
  - Historical instalment rows are not recategorised.

**P6**

- **0362_month_end.sql**
  - Add `profiles.savings_split` and the `savings_month_summary` columns. Set `status='legacy'` on existing rows.
  - Partial index `(auto_apply_at) WHERE status='proposed'`.
  - Index `user_settings (month_start_day, user_id)`.
  - RPCs, all `service_role` only:
    - `apply_month_end(p_user, p_id, p_version, p_lines jsonb, p_held jsonb, p_rates jsonb)`;
    - `undo_month_end(p_user, p_id)`;
    - `month_end_ledger(p_user)`: one round trip returning per-account held aggregates (`sum(current_balance) group by held_in`) plus the ledger rows after each account's latest anchor, all on `user_id` indexes;
    - `month_end_due_users(p_after uuid, p_limit int)`: keyset on `user_id`, anti-join on the summary unique index `(user_id, month_key)`, LIMIT. `EXPLAIN` must show index scans on `user_settings_pkey` / `savings_month_summary_user_month_key`, with no seq scan on summaries.
- **0363_split_backfill.sql**
  - Pre-counts:
    - users with `default_carry_pocket_id` ≠ systemVaultId;
    - share goals and Σ pct per user;
    - share lines that would round to 0 (dropped).
  - Write `savings_split`:
    - share goals at `share_pct`, scaled when Σ > 100 and rounded down to 0.01;
    - lines that round to 0 are dropped;
    - the default pocket gets `100 − Σ` (only if > 0);
    - fixed goals get no line.
- **0364_retire_columns.sql** (after P6 is live)
  - Pre-count non-null values in each column.
  - Drop:
    - `savings_accounts.linked_payment_method_id`, `target_amount`;
    - `profiles.default_carry_pocket_id` (FK first);
    - `goals.linked_savings_account_ids`, `funding_mode`, `share_pct`, `monthly_contribution`;
    - `goal_allocation_runs`.

### 3.3 Label encoding (every label: `payment_method_id NULL`, `transfer_group_id NULL`, `is_cash_flow=false`, `idempotency_key` set)

| source | kind | Written by |
|---|---|---|
| `set_aside` | deposit | Add money (client store) |
| `opening` | deposit | outside-money entry, new goal "already saved" (not counted in `savedNet`) |
| `move_in` / `move_out` | deposit / withdrawal | It's in another account, closing (`pair_id`) |
| `month_end` / `month_end_undo` | deposit / withdrawal | `apply_month_end` / `undo_month_end` |
| `release` | withdrawal | Release, deleting a goal or pocket |
| `spent` | withdrawal | I spent it (shortfall, closing) |
| `close` | withdrawal | outside part written off |

The client writes labels through the sync upsert. The soft guard in 0356 covers a negative result. The server writes them through `label_part`.

### 3.4 Old builds

- P2 raises the min version in the admin portal (UpdateGate, `src/components/ui/UpdateGate.tsx`, plus a 426 from the API). A build below it shows only the update screen, so it never reads or writes the new model.
- Between the P2 deploy and the gate bump, an old build sees each extra Monthly savings or goal part as a separate pocket. Label rows have no leg, no `transfer_group_id` and `is_cash_flow=false`, so old `walkLegs` skips them (rules 4 and 6).
- **Ship order:** native build → TestFlight/APK → gate bump → P2 migrations. This needs the owner's OK for a native build (OQ-1).

## 4. Algorithms

### 4.1 Balance, free, card hold-back

```
balance(A, t):
  base = latest of {opening(A)} ∪ {adj(A): anchor_balance != null, occurred_at ≤ t}
  return base.value + Σ amount(leg) for legs of A with base.at < leg.at ≤ t   // legacy delta adjustments stay legs
  amount(row) = row.account_amount ?? row.to_account_amount (dest side) ?? convertLive(row)     // I-10
gap(anchor k) = anchor_k − balance(A, just before anchor_k)        // derived at read time; stored delta never read
walkLegs (savings_transactions): rule 0 = t.source ∈ LABEL_SOURCES → skip; rules 1–8 unchanged for every other row
  (legacy 'transfer' pairs → rule 3; 'carry' → rule 5; declare → rule 4; legless withdrawal → rule 8)
cardHold(A) = Σ_{credit cards c, paysFrom(c)=A} max(0, owed(c) − unbilledPlan(c)) → A.currency (live rate; none → cap(A)=0)
  paysFrom(c) = c.parent_id ?? c.pays_from_payment_method_id ?? lastPayer(c) ?? primary(c.currency) ?? primary()
  owed(c) = start + charges − payments to the card − payments to its plans          // plan purchase = one full-price charge
  unbilledPlan(c) = Σ_P min(scheduleUnbilled(P), P.total − Σ payments to P)
     scheduleUnbilled(P) = P.amount × max(0, P.count − #(bill dates ≤ c's next statement close))
free(A) = balance(A) − held(A) − cardHold(A)          // unclamped
```

### 4.2 Shortfall

```
uncoverOrder(A): Monthly savings part → pockets (newest first) → goal parts by priority, lowest first → achieved goals last
covered(p): s = short(A); for p in uncoverOrder(A): u = min(s, p.balance); s −= u; covered(p) = p.balance − u
episode: opens when short(A) goes 0 → >0 after SMS pairing ran for that change (prompt_state key A + opened_at);
  closes when short(A) = 0; one notice per episode; FX cannot trigger (parts are in A's currency)
choices apply to the remaining short R, and loop until R = 0 or the user stops (episode stays open with R):
  It's in another account (pre-filled: own transfer out of A in the last 7 days) → B:
     for p in uncoverOrder(A) while R > 0:
       goal/MS part: amt = min(p.balance, R, free(B) in A ccy) → moveAmount(p, B, amt)
       pocket: whole pocket only, if free(B) ≥ p.balance → movePocket(p, B); else skip (offer I spent it)
       R = short(A) recomputed
  I spent it: spent() on the Monthly savings part first, then the parts the user picks, total ≤ R
  Keep for now: dismiss; "Short X" stays
```

### 4.3 Leftover for cycle C

```
countsIn(row, C): P = summary of cycle(row.date); if P exists and row.created_at > P.created_at
  then cycle = cycleContaining(row.created_at) else cycle(row.date); return cycle == C
income(C)   = Σ received income counted in C (account_amount where present) at C.rates
spending(C) = Σ spend expenses counted in C; excludes non-spend, refunded part, card bills, instalments written after cutover;
              a refund of an expense from a closed month counts as −spending in its arrival month
savedNet(C) = Σ set_aside labels in C + Σ account legs into outside parts in C (gold bought: account_amount, never grams)
              − Σ spent labels in C − Σ pocket-funded spend withdrawals in C
              (release, opening, move_*, month_end*, close NOT counted; legacy pre-P2 rows: today's isCountedDeposit +
               Savings-category expenses)
unexplainedOut(C) = max(0, −Σ gap(k)) over anchors k counted in C   // net per month: an earlier-dated anchor that a later
              anchor overrides nets to its effect on the latest-anchor balance; a rise only raises free, never leftover
leftover(C) = income − spending − savedNet − unexplainedOut
```

### 4.4 Month-end

```
nextCycle(prev): [prev.cycle_end, first boundary of the current month_start_day strictly after prev.cycle_end)
caps(A) = max(0, min(free(A, C.end), free(A, now))) for A with canHoldParts        // same formula at propose and apply
propose(user, C):  (POST /api/month-end {op:'propose'} on the first app open after C ends; or the cron)
  if a row exists for C: return it (status proposed → re-propose below, others unchanged)
  rates = live (none → no row, retry next run); L = leftover(C)
  L ≤ 0 → insert status 'empty', copy "You spent and set aside |L| more than you received"; nothing set aside or released
  placeable = min(L, Σ caps→base); lines = split(placeable); not_placed = L − placeable + unplaced
  insert status 'proposed', version 1, held_snapshot = held per account, auto_apply_at = now + 72h
re-propose: on any savings_split change, or when an account holding a line closes: recompute lines for status 'proposed'
  rows (version += 1); auto_apply_at unchanged
split(amount): for each {target_id, pct} whose target is live and (pocket, or goal active): want = cents(amount × pct/100)
  goal: want = min(want, target − progress); excess → rest. Achieved/paused/deleted targets: pct → rest
  rest = amount − Σ want → Monthly savings
fill(target, want):
  pocket: its home only, ≤ cap(home); the overflow → Monthly savings
  goal or Monthly savings: existing parts by remaining cap desc, then other accounts by remaining cap desc (base at the
    rates in use); part = existing (goal_id or MS, held_in) else new with id = partId(owner, account)
  what fits nowhere → not_placed
apply(user, id, version, by):   user confirm, or cron when status='proposed' and auto_apply_at ≤ now
  rates_apply = live; re-convert each line from amount_base (amount_base wins)
  caps recomputed (formula above); refuse lines in non-live accounts (they become cuts)
  pass 1: every line keeps what fits its account's cap, in order; pass 2: cuts re-filled via fill(); record capped[]
  SQL apply_month_end (one transaction):
    SELECT … FOR UPDATE on the summary row and every part in the lines
    if status ≠ 'proposed' or version ≠ p_version → 'conflict'
    if held per account ≠ p_held (a label landed since) → 'stale' (TS recomputes once and retries)
    upsert new parts: INSERT … ON CONFLICT on the (goal_id, held_in) / MS (user_id, held_in) index DO UPDATE SET deleted_at=NULL
    insert month_end labels, key = md5(id || ':' || part_id)::uuid
    goals reaching target → status 'achieved', achieved_at = now, id appended to achieved_by_proposal
    status 'applied', version += 1, applied_lines, rates_apply, applied_at, applied_by
undo(user, id): allowed only while status='applied' AND no later spent/move_out label exists on any applied part
  (else Undo is disabled: "a shortfall answer used this money")
  in one transaction: set buddget.month_end_undo='1'; each applied line: label month_end_undo of min(amount, part balance),
  key md5(id||':'||part_id||':undo')::uuid; goals in achieved_by_proposal → status 'active', achieved_at NULL;
  status 'undone' (terminal); report "X not undone (already released)" per line
cron /api/cron/month-end (replaces month-carry; MONTH_CARRY_WRITES stays off from P2 until this ships, then the old route
  and flag are deleted): (a) due proposals ORDER BY auto_apply_at LIMIT 25; (b) month_end_due_users keyset LIMIT 25;
  one month_end_ledger call per user; 50 s budget; cursor in response; writes behind MONTH_END_WRITES=on
```

### 4.5 Goal progress and completion

- `progress(G) = Σ value(covered(p))` → G's currency. Gold uses the karat price. A missing price uses the last price, with "price from <date>".
- **Achieve:**
  - The client reconcile or `apply_month_end` sets `status='achieved'` when progress ≥ target − ε.
  - The manual "Mark achieved" stays.
- **After achieved:**
  - The goal is out of the split.
  - Add money is hidden.
  - Release, I spent it and Withdraw (outside parts) still work.
  - The goal stays in trophies.
- **Paused:**
  - Out of the split.
  - Resume writers (`goals/page.tsx:95`, `GoalDetailSheet.tsx:156`) must check `status==='paused'`.

### 4.6 Release and "I spent it"

```
release(p, amt): 0 < amt ≤ p.balance; label release; free(A) += amt; not in savedNet (won't be swept next month)
spent(p, amt):   label spent; counted −savedNet (the debit was spending, or the drop was unexplainedOut)
Withdraw (outside parts only): real withdrawal with a destination leg (rule 1), source 'withdraw'
```

### 4.7 Moving money between accounts or currencies

```
moveAmount(p in A, B, amt):  goal / MS parts.  held_in is never updated.
  amtB = cents(amt → B.ccy at the booked rate of the transfer that left A if one exists, else live); require amtB ≤ free(B)
  q = the owner's part in B, else new (partId); pair = uuid; label move_out(p, amt), move_in(q, amtB)
  p at 0 stays, hidden (a later fill reuses it; never soft-deleted by a move)
movePocket(p in A, B): whole pocket. New row in B copying name/icon/color/notes; move_out(p, all), move_in(new, all→B);
  old row soft-deleted (pocketCloseAdjustments only if it has leg-bearing rows); split entries re-pointed to the new id
partId(owner, account) = uuid from a sync SHA-256 of `part|<goal_id or 'ms:'+user_id>|<account_id>` (src/lib/savings/partId.ts)
```

### 4.8 Closing or deleting an account (one guard)

- `removePaymentMethod(A, mode)` returns `needs_answer` while `held(A) > 0`. This applies to `close` and to `auto` (delete).
- "Where did this money go?" goes part by part (pre-filled from the last own transfer out of A):
  - **In B:** `moveAmount` or `movePocket`.
  - **Spent:** `spent`.
  - **Cash at home:** move to the Cash account.
- A pending month-end proposal with lines in A is re-proposed.
- Legacy parts in closed or deleted accounts count 0 and are listed for repair.

### 4.9 Outside money entry ("Where is this money?")

| Answer | What is written |
|---|---|
| An account I haven't added | Create it with its real balance (opening anchor), then an `opening` label into the goal or pocket (≤ free). |
| Cash at home | Cash untracked: set its opening balance. Cash tracked: anchor = current + amount (reason `opening_correction`). Then an `opening` label. |
| Gold or other | Outside part (`held_in NULL`, XAU/other, karat); first row label `opening`. |

Never income. Never counted in `savedNet`.

### 4.10 Card instalments as settlements

- **Purchase:** one full-price expense on the card. The plan row is a schedule linked by `linked_credit_card_debt_id`.
- **Instalment:** moves no money by itself. The card bill (CC Payoff, non-spend) pays it.
- **Instalment rows written after cutover:** category `Installment`, through `isSettlementPlan = isBnplPlan || isCardPlan` in `recurringDebtDueHandlers`. Past rows are left as they were.
- **Pay early:** a payment to the plan, which `owed(c)` counts. `unbilledPlan` shrinks with it.
- **Net worth:** `debtRemaining` excludes plans linked to a card.

### 4.11 Net worth

```
NW = Σ_{A live, !excluded} balance(A)→base + Σ outside parts→base (gold at karat price; no price → left out, incomplete)
   + Σ parts in untracked open accounts→base (listed for repair) + investments − (debtRemaining − card plans)
parts in closed/deleted accounts: 0
```

## 5. Phases (each ships alone; tests → §6)

**P1: Ledger correctness (no schema, no visible change beyond fixing wrong numbers)**

| File | Change |
|---|---|
| `src/lib/accounts/kinds.ts` | `isLiveAccount`, `canHoldParts`. |
| `src/lib/accounts/balance.ts` | Rule 0 `LABEL_SOURCES` (no such rows exist yet). |
| `src/lib/accounts/netWorthBasis.ts` | Closed/deleted holder → 0. Untracked holder → standalone + `needsRepair` list. |
| `src/lib/savings/netWorth.ts` | Card plans once (`debtRemaining` minus plans linked to a card). |
| `src/lib/debt/bnpl.ts` | `isCardPlan`, `isSettlementPlan`. |
| `src/lib/debts/recurringDebtDueHandlers.ts` | Use `isSettlementPlan` (new rows only). |
| `pocketHome.ts`, `pocketHolder.ts`, `goalPocket.ts#goalHomeAccounts` | `canHoldParts`. |
| No change | `resolve.ts`, `bnplSplit.ts`, `netWorthSnapshot.ts`, `netWorthTrend.ts`. |

Tests: T0 (pre-P1 ledger snapshot of 3 QA users → identical balances, held and NW), T2, T3, T19, T20, T25.

**P2: Parts, labels, anchors, booked amounts (0355–0359), with the required update**

| File | Change |
|---|---|
| `types.ts`, `database.types.ts`, mappers | `goalId`, `isMonthlySavings`, `idempotencyKey`, `pairId`, `accountAmount`, `anchorBalance`, `toAccountAmount`. Remove `targetAmount`. |
| `balance.ts` | Anchors and booked amounts in `computeBalances` / `balancesOverTime`. |
| `actions.ts#updateBalance`, `gapSurplus.ts`, SMS balance ingestion | Write anchors. |
| New `src/lib/savings/labels.ts` | `setAside`, `release`, `spent`, `moveAmount`, `movePocket`, `covered`, `uncoverOrder`. |
| New `src/lib/savings/partId.ts` | — |
| `useFinanceStore.ts` | `setAsideInPart`, `releasePart`, `markSpent`, `movePart`. `depositToSavings` → `setAsideInPart` for held parts. `withdrawFromSavings` → outside parts only. `deleteSavingsAccount` → release first. |
| `goalPocket.ts` | Parts via `goalId`. `relinkGoalPocket` retired. |
| `exclusivePockets.ts` | Retired. |
| `canDeletePocket.ts` | Monthly savings → `reason:'system'`. |
| Release sheet copy | "won't be set aside again automatically". |
| Admin portal | min version bump. |
| `MONTH_CARRY_WRITES` | Stays off (release note). |

Tests: T4, T5, T6, T21, T22, T48, N7.

**P3: Card hold-back and unclamped free (0360, 0361)**

| File | Change |
|---|---|
| New `src/lib/accounts/cardHold.ts` | — |
| `balance.ts` | `cardHold`. `free` unclamped. |
| `computeCreditCardBalance.ts` | Plan payments count toward the card. Schedule helpers. |
| Non-negative-cap consumers | Use `Math.max(0, free)`: `pocketHome.ts` (availableIn, exceedsAvailable, transferRefusal, explainDepositRefusal), `assetPurchase.ts`, `useAccounts.ts`, `AccountPicker.tsx`, `AccountRow.tsx` (shows −X), `AccountDetailSheet.tsx`, `MoveMoneySheet.tsx`, `PocketFormSheet.tsx`, `NewGoalFlow.tsx`, `useNewGoalForm.ts`, `sms/matchSalary.ts`, `api/buddgy/turn/route.ts`. |
| Budget `.free` hits | Unrelated: `FlowStrip`, `FreeCapsule`, `studioEntities`, `insights`, `ledger`, `reviewState`, `bufferAbsorb`. |
| Add card | Asks "pays this card from" when Linked account is None. |

Tests: T1, T7, T8, T9, N6, N8.

**P4: Shortfall and closing**

| File | Change |
|---|---|
| New `src/lib/savings/shortfall.ts` | Episodes, looped choices. |
| `removePaymentMethod.ts` | `needs_answer` for close and delete. |
| `actions.ts#closeAccount` | Opens the sheet. |

Tests: T10–T16, N4.

**P5: Goals on parts**

| File | Change |
|---|---|
| `computeGoalProgress.ts` | Σ `covered()` over parts by `goalId`, karat price, last-price fallback. |
| `reconcileAchievedGoals.ts` | One-way. |
| Resume writers | Guarded. |
| `savingsConversions.ts` | Karat per part. |

Tests: T17, T18, T24, T41–T45.

**P6: Month-end (0362–0364)**

| File | Change |
|---|---|
| New `src/lib/monthEnd/leftover.ts` | Replaces `cycleCarryFigures.ts`. |
| New `src/lib/monthEnd/proposal.ts` | caps / split / fill / applyPasses (pure, shared). |
| New `src/lib/server/monthEndLedger.ts` | Calls `month_end_ledger`. Moves `fetchRates`, `allRows`, `must` here. |
| `carryDateLogic.ts#nextCycle` | — |
| New `src/app/api/month-end/route.ts` | Ops `propose` / `apply` / `undo`. |
| `src/app/api/cron/month-carry/route.ts` | Deleted. Replaced by `/api/cron/month-end` (vercel.json). |
| Deleted | `carryAdjust.ts`, `carryCycle.ts`, `allocateGoalFunding.ts`, `goals/allocateMonth.ts`, `savings/monthCarry.ts`, `cycleCarryFigures.ts`. `pocketLedger.ts` keeps `groupIdFor` only. |
| Split screen | Writes `profiles.savings_split` (Σ ≤ 100 validated in the writer; a stored Σ > 100 is clamped proportionally on read and shown "over 100%"). |

Tests: T23, T26–T40, T46, T47, N1–N3, N5, N9, N10.

## 6. Test matrix

**Fixture F.** Base EGP, `month_start_day = 1`, timezone Africa/Cairo.

Rates: USD→EGP 50. 24k gold 4,000 EGP/g, so 21k = 3,500 EGP/g.

| Account | Opening on Nov 1 | Movements in November | Balance on Nov 30 |
|---|---|---|---|
| CIB Current (EGP bank) | 60,000 | salary +60,000 (Nov 25), debit spend −20,000 | 100,000 |
| Deel (USD wallet) | $700 | freelance +$300 | $1,000 |
| Cash (EGP, tracked) | 3,000 | −1,000 | 2,000 |
| NBE (EGP bank) | 0 | none | 0 |

CIB Card (credit card, `parent_id` = CIB, statement close 10th):
- previous statement paid;
- purchases 4,000 (Nov 15–25);
- TV plan on the card Nov 12: 12,000 = 6 × 2,000, first bill Dec 10.
- Card owed = 16,000.

Parts:

| Owner | Type | Parts |
|---|---|---|
| Car | goal, target 150,000, priority 1 | CIB 20,000; Deel $200 |
| Travel | pocket, home CIB | 5,000; 5,000 of it set aside in November |
| Monthly savings | system | CIB 3,000 |
| Wedding | goal, target 50,000, priority 3 | outside part: 10 g of 21k gold |

Split: Car 50%, Travel 20%.

November figures: income 75,000. Spending 37,000. savedNet 5,000. Leftover 33,000.

Derived values in F:

| Value | Result |
|---|---|
| held(CIB) | 28,000 |
| cardHold | 16,000 − 10,000 = 6,000 |
| free | CIB 66,000; Deel $800 (40,000); Cash 2,000; NBE 0 |
| freeTotal | 108,000 |
| **Σ balances** | **152,000** |
| Car progress | 30,000 (20%) |
| Wedding progress | 35,000 |
| NW | 152,000 + 35,000 − 16,000 = **171,000** |

**Fixture F27.** F with Travel 61,000 (56,000 set aside before November). held(CIB) = 84,000 and free(CIB) = 10,000; everything else is as F.

All numbers in this table were rechecked with a script (`scratchpad/me2.py`, `led.py`).

| # | Scenario | Input | Expected |
|---|---|---|---|
| T1 | Free not clamped | F; CIB debit −80,000 Dec 1 | balance(CIB) 20,000; held 28,000; short 8,000; free(CIB) −14,000; freeTotal 28,000; Σ balances 72,000; NW 91,000 |
| T2 | Legacy carry label | account X 1,000; part 300 from a `carry` row before and after 0356 | balance(X) 1,000 both; held 300; free 700 |
| T3 | Card plan owed once | F + legacy separate plan debt 12,000 | NW 171,000 (not 159,000); card 16,000 shows "TV 0 of 6 · next Dec 10" |
| T4 | Labels never move balances | F; release Travel 2,000; spent MS 3,000; set_aside Travel 1,000 | balance(CIB) 100,000 throughout; held 28,000→26,000→23,000→24,000; free 66,000→68,000→71,000→70,000; NW 171,000; savedNet(Dec) +1,000 − 3,000 = −2,000 (release not counted) |
| T5 | Anchor, late SMS | Dec 2 anchor 97,000 (ledger 100,000); late debit −500 dated Dec 1 arrives after | balance 97,000; gap 2,500; spending(Dec) +500; unexplainedOut(Dec) 2,500 |
| T6 | Booked rate | Deel→CIB $1,000, `to_account_amount` 50,000; rate → 45 | CIB 150,000 at both rates; Deel $0 (Deel short $200 → T15); NW 171,000 |
| T7 | Hold-back | F | cardHold 6,000; free(CIB) 66,000 |
| T8 | Bill paid | Dec 15: 6,000 from CIB (CC Payoff) | CIB 94,000; owed 10,000; unbilled 8,000; hold 2,000; free(CIB) 64,000; spending(Dec) +0; NW 171,000 |
| T9 | No linked account | card `parent_id` NULL, no `pays_from`, last paid from NBE | free(NBE) −6,000; free(CIB) 72,000; Add card asks once |
| T10 | Uncover order | T1 state | MS 3,000 and Travel 5,000 uncovered; Car covered 20,000; Car 30,000; one notice "8,000 of what you set aside isn't in CIB anymore" |
| T11 | Deeper short | CIB debit −82,000 | short 10,000; Car CIB covered 18,000; Car 28,000 (18.7%) |
| T12 | It's in another account | own transfer CIB→NBE 80,000; choose NBE | MS: move_out CIB 3,000 / move_in NBE 3,000; Travel: new pocket row in NBE 5,000, old row soft-deleted; held CIB 20,000, NBE 8,000; short 0; free(CIB) −6,000 (no shortfall); free(NBE) 72,000; NW 171,000 |
| T13 | I spent it | T1 state | spent MS 3,000 + Travel 5,000; held 20,000; balance 20,000; free −6,000; savedNet(Dec) −8,000 |
| T14 | FX-only | rate 45 | no shortfall; Car 29,000 "includes rate changes"; free Deel 36,000 EGP; NW 166,000 |
| T15 | Close with goal money | T6 then close Deel, answer "In CIB" | Car CIB 30,000; Car Deel part **0, hidden**; held(CIB) 38,000; free(CIB) 106,000; NW 150,000 + 2,000 + 35,000 − 16,000 = 171,000 |
| T16 | Guard | close Deel unanswered; **delete** Deel unanswered | both `needs_answer`; account unchanged |
| T17 | Achieved permanent | goal Phone target 10,000, part CIB 10,000 → achieved; release 10,000 | stays achieved; progress 0; no below-target copy; an old-build write of `active` is ignored by the trigger |
| T18 | Achieved under FX | Laptop $200 target, Deel $200 → achieved; rate drops | stays achieved; out of split |
| T19 | Closed holder | legacy part 5,000 in a closed account | NW +0; listed for repair |
| T20 | Untracked holder | part 4,000 in an open untracked account | NW +4,000, "set this account's balance" repair; new set-aside into it refused (`canHoldParts`); once tracked at 4,000: NW +4,000 once |
| T21 | Cash at home | 5,000 into new pocket Home | Cash anchor 7,000; Home 5,000 (`opening`); NW 176,000; leftover(Nov) 33,000 |
| T22 | Gold outside | +2 g 21k to Wedding | Wedding 42,000; NW 178,000; not income |
| T23 | Gold bought from account | Nov 20 buy 2 g from CIB for 7,000 | CIB 93,000; free(CIB) 59,000; Wedding 42,000; savedNet(Nov) 12,000; leftover 26,000; NW 171,000 |
| T24 | Outside part unaffected | T11 state | Wedding 35,000; Car 28,000 |
| T25 | Instalments | new BNPL instalment 1,500 + card-plan instalment 2,000 written in Dec | spending(Dec) +0; category `Installment`; pre-cutover rows unchanged |
| T26 | Month-end base | F; propose Dec 1, confirm | caps 66,000 / 40,000 / 2,000; placeable 33,000; Car 16,500→CIB, Travel 6,600→CIB, MS 9,900→CIB; held(CIB) 61,000; free(CIB) 33,000; Car 46,500; NW 171,000 |
| T27 | Fill by cap | F27 | Car 16,500→Deel $330; Travel 6,600→CIB; MS 3,400→CIB + 6,500→Deel $130; not_placed 0 |
| T28 | Not enough free | F27 with Car's Deel part $900 (free Deel $100) | placeable 17,000; not_placed 16,000 ("16,000 saved but not set aside: no account had it free"); Car 8,500→CIB; Travel 1,500→CIB, overflow 1,900→MS; MS 5,000→Deel $100 + 2,000→Cash |
| T29 | Goal near target | F, Car target 40,000 | Car 10,000→CIB (achieved by apply, in `achieved_by_proposal`); MS 16,400→CIB; Travel 6,600 |
| T30 | Negative month | Nov spending 80,000 | leftover −10,000; status `empty`; "You spent and set aside 10,000 more than you received"; nothing set aside or released |
| T31 | Salary in days 1–3 | F27; salary +60,000 Dec 2; auto-apply Dec 4 | cap(CIB) = min(10,000, 70,000) = 10,000 at propose and apply; T27 placement |
| T32 | Spend in days 1–3 | T26 proposed; CIB debit −60,000 Dec 2; confirm | cap(CIB) 6,000; pass 1 Car 6,000→CIB, Travel 0, MS 0; pass 2 Car 10,500→Deel $210, Travel 6,600 overflow→MS, MS 16,500→Deel $330; Deel 27,000 of 40,000; **Cash never reached** |
| T33 | Confirm vs auto | both send version 1 | one `applied`, one `conflict`; one set of labels |
| T34 | Undo after a release | T26 applied; release MS 5,000 (not shortfall); Undo | Car −16,500 → 30,000; Travel −6,600 → 5,000; MS −7,900 → 0, "2,000 not undone (already released)"; status `undone` (terminal) |
| T35 | Start-day change | Nov cycle Nov 1–Dec 1; Dec 10 start day → 15 | next cycles Dec 1–Dec 15, Dec 15–Jan 15 |
| T36 | Late refund | 1,000 refund on a Nov expense arrives Dec 5 | Nov unchanged; spending(Dec) −1,000 |
| T37 | Unexplained drop | Nov 28 anchor CIB 97,000 | unexplainedOut(Nov) 3,000; leftover 30,000; cap(CIB) 63,000 |
| T38 | Split > 100 | add 40% to Car 50 + Travel 20 | writer refuses ("over 100%"); a stored 110% reads as 45.45 / 18.18 / 36.36 |
| T39 | Line in a closed account | proposal line in an account closed before apply | line cut and re-filled; no label into a non-live account |
| T40 | Achieved target in split | F, Car achieved before month-end | Travel 6,600→CIB; MS 26,400→CIB |
| T41 | Delete goal, held parts | delete Car | release CIB 20,000 and Deel $200; held(CIB) 8,000; free(CIB) 86,000; free(Deel) $1,000; split entry removed; NW 171,000 |
| T42 | Delete goal, outside part | delete Wedding | Keep → pocket (goal_id NULL), NW 171,000; Withdraw into CIB 35,000 → CIB 135,000, NW 171,000; write off (`close`) → NW 136,000 |
| T43 | Delete pocket | delete Travel | release 5,000; held(CIB) 23,000; free(CIB) 71,000; NW 171,000 |
| T44 | Missing gold price | no price (last 3,500, Nov 29) | Wedding 35,000 "price from Nov 29"; NW 136,000 marked incomplete |
| T45 | MS undeletable | delete MS | `{ok:false, reason:'system'}`; rename OK; hidden when all parts are 0 |
| T46 | Late expense | Nov proposed Dec 1; Dec 2 SMS for a −1,000 debit dated Nov 29 | Nov unchanged; spending(Dec) +1,000; CIB 99,000; cap(CIB) 65,000; T26 placement unchanged |
| T47 | Rate change after close | Nov applied at 50; rate → 45 | Nov row keeps income 75,000 and rates {USD:50}; nothing re-priced |
| T48 | Account not added | QNB EGP 12,000; `opening` 12,000 into Wedding | QNB anchor 12,000; Wedding 47,000; NW 183,000; leftover(Nov) 33,000 |
| N1 | Rate move before apply | F27 proposed at 50; rate 55 at apply | amount_base wins: Car 16,500→Deel **$300**; MS Deel 6,500→**$118.18**; CIB lines unchanged; `rates_apply` {USD:55}; card re-rendered |
| N2 | Refund after apply | T26 applied; Dec 5 refund 1,000 on a Nov CIB debit | CIB 101,000; free(CIB) 33,000 → 34,000; spending(Dec) −1,000; NW 172,000 |
| N3 | Undo after a shortfall label | T26 applied; CIB debit −80,000 Dec 3 (short 41,000); I spent it on MS 12,900 | short 28,100 (episode open); Undo **disabled** |
| N4 | Two pockets, partial move | account X EGP 10,000; pockets A 4,000 (older), B 4,000; debit −8,000 → short 6,000; It's in another account → NBE (free 5,000) | B moved whole → NBE (NBE free 1,000); short 2,000 remains, A can't fit → episode open "2,000 still short"; then I spent it 2,000 from A: A 2,000, X held 2,000 = balance 2,000, free 0, short 0 |
| N5 | Completed by month-end, undone | T29 applied (Car achieved) then Undo | Car 30,000, status `active`, `achieved_at` NULL (via `achieved_by_proposal`); MS and Travel reversed; status `undone` |
| N6 | Bill paid from another account | Dec 15: statement 6,000 paid from Deel $120 (booked 6,000) | Deel $880; owed 10,000; hold 2,000 (still on CIB); free(CIB) 70,000; free(Deel) $680; NW 171,000; at rate 45 owed stays 10,000 |
| N7 | Earlier-dated anchor | Dec 2 10:00 anchor 100,000 (= ledger); then a late report dated Dec 1 09:00 = 99,000 (ledger there 100,500; a −500 debit at Dec 1 12:00 already booked) | balance(CIB) 100,000; gaps −1,500 and +1,500 net 0; unexplainedOut(Dec) **0** |
| N8 | Plan paid off early | F; Dec 1 pay the TV plan 12,000 early from CIB | CIB 88,000; owed 4,000; unbilled min(10,000, 0) = 0; hold 4,000; free(CIB) **56,000**; NW 171,000 |
| N9 | Close with a pending proposal | F27 proposed; Dec 2 Deel→CIB $1,000 (50,000); close Deel, Car $200 "In CIB" (Car CIB 30,000) | re-proposed v2: caps CIB min(10,000, 50,000) = 10,000, Cash 2,000; placeable 12,000; not_placed 21,000; Car 6,000→CIB; Travel 2,400→CIB; MS 1,600→CIB + 2,000→Cash; auto_apply_at unchanged |
| N10 | Split changed before auto-apply | T26 proposed; Dec 2 Car 50%→30% | re-proposed v2 (auto_apply_at still Dec 4): Car 9,900, Travel 6,600, MS 16,500, all CIB |

## 7. Open questions (still open)

| # | Question | Recommended default |
|---|---|---|
| OQ-1 | P2 needs a native build and a forced update for every tester. Owner OK? | Yes. Build and upload both apps (native-release.sh), then bump the min version, then run the P2 migrations. |
| OQ-2 | Fixed-amount goals (`monthly_contribution`) get no split line. | No automatic line. One-time note on the split screen: "Car used to get 2,000 a month; add it here as a %". |
| OQ-3 | Legacy card plans with no purchase charge (0361 count). | If > 0, insert the remaining-principal charge with `spend_exclusion='manual'` and leave history as it is. The owner confirms the count. |
| OQ-4 | Targeted pockets with no goal (0355 count). | Likely 0. If not: a goal in `quality_of_life`, name kept. |

## 8. Owner approval and council verdicts on §7 (2026-11-27)

Owner approved the mockup v9 and asked the council to decide OQ-1..OQ-4 (3/3 on each):

- **OQ-1 Release order (replaces "native build, then gate bump, then migrations", which cannot run: native-release.sh needs HEAD on origin/main, and updated apps would hit a schema without the new columns).** For every phase: apply its additive migrations first → push the phase's code (web deploys) → the next phase. Old native builds tolerate added columns (label rows skipped, extra parts look like pockets). After P6: bump `APP_CLIENT_VERSION` (src/lib/appVersion.ts, e.g. 1.1.0) and `PERSIST_VERSION` (its migrate drops the cached savings and goals slices so the app refetches) → push (web deploys) → `scripts/native-release.sh` (both apps) → wait until TestFlight shows the build ready and the APK link is live, set the portal update URLs → raise the min version in the admin portal → re-run the idempotent goal_id backfill → contract migrations (drop `target_amount` 0364, final unique indexes). One forced update for the whole rebuild, not one per phase.
- **OQ-2 Fixed monthly amounts:** no automatic line. Each fixed-amount goal shows a note on the split screen until the user adds a % for it or dismisses it. Once a % exists for that goal, `monthly_contribution` is no longer read (grep every reader so nothing counts both).
- **OQ-3 Card plans with no purchase charge:** no insert code. After the single-card linking step, 0361 counts plans linked to a card with no purchase charge and raises a notice if > 0 (live today: 0); any found are fixed by hand with an idempotent key.
- **OQ-4 Targeted pockets with no goal:** each becomes a goal (same name and target, category quality_of_life) with its `goal_id` set by id; never link by name; `target_amount` stays until the contract migration.
