# QA Round 2 - Plan review B (secondary effects of the 25 riskiest fixes)

Read-only review. Code read in this worktree; live DB queried with SELECT only (project ydihurtbcnoflhormgzi, 2026-10-27, counts only, no raw SMS text).
Likelihood = chance the secondary problem happens if the plan is executed as written. Severity: S1 data loss/lockout/money wrong, S2 wrong behaviour, S3 cosmetic/ops.

## 0. Corrections to plan facts (verified live)

| Plan says | Live reality | Consequence |
|---|---|---|
| D1: "21 unlinked debt-payment expenses" | 6 expenses have is_debt_payment, 4 unlinked; 3 of the 4 have `linked_debt_id` NULL; **0 of 4 match any debt_payment by debt_id+date+amount+pm**. 2 debt_payments have no expense (legit CC/they_owe). | Migration 0197 as designed links **zero** rows. The matching key is wrong; the count is stale. Re-audit before writing it. |
| L1: "re-attach income events hidden by deleted sources" | 0 live events point to a missing/deleted source (167 events, 147 with template_id NULL). | 0197 L1 part is a no-op today; calc fix is the real work. Do not ship a repair that has nothing to repair. |
| W1: "audit historical gold conversions" | 1 XAU pocket, 1 transaction (a 1 g deposit), 0 transfers, 0 XAU income events, 0 gold debts, `debt_payments.currency <> debts.currency` = 0 rows. | Server-side W1/D2 repair is empty. Only device-local (unsynced) data could be wrong. |
| N2/LF3: "backfill into masked corpus before purge" | `sms_parse_log`: 863 rows, **863 have harvested_at set**, 682 older than 30 days, 0 unharvested older than 30 days. `sms_corpus` 518 rows, 455 have seen_count < 3. | `harvestLegacySms` selects `harvested_at IS NULL` and would process **0 rows**: the "backfill" is vacuous and the purge gate (`harvested_at IS NOT NULL`) is already open for every row. See item 21. |
| N18/N-series: sender strictness for credits | `sender` is empty on **863 of 863** rows (iOS sends none; Android rows also empty here). | "Must match a known sender or confirm" flips every credit. See item 24. |
| LF1: "69 of 78 regex failures contained bidi marks" | 0 of 863 stored raw bodies contain U+200E/F, U+202A-E, U+2066-9, U+FEFF; 0 of 53 templates contain bidi or Arabic-Indic digits; 27 of 53 contain Arabic letters. | Evidence source for the claim must be located before building; normaliser must not touch Arabic letters. |
| C1: "can lock every user out" | Only **1** of 45 users has 2FA on (email provider, 1 biometric binding, 0 trusted devices). | Blast radius of C1 is one account, which makes a per-user rollout flag cheap. That account is the biometric/skip-2FA case. |

---

## 1. W1 - XAU ounce vs gram (B1)

**Where it really lives.** `/api/rates` puts XAU into the cross-rate table per ounce (`USD_XAU` = ounces per USD). Nothing else reads `*_XAU`/`XAU_*` from that table (grep: only `currency.ts` generic bridging). 154 call sites use `convertCurrency`/`tryConvertCurrency`; several feed savings/income amounts that may carry `currency: 'XAU'`:
`calculations.ts:459,482` (`cashSavingsDepositsInBaseForMonth`, left-to-spend), `ReportsSavingsPanel.tsx:36`, `ActivityLedger.tsx:74,95`, `useFinanceStore.ts:438`, `balance.ts` (account legs), `withdrawFromSavings` (creates an income event with `currency: acc.currency` = XAU grams).

| # | Secondary risk | Likelihood | Detect | Guard / test to add |
|---|---|---|---|---|
| 1.1 | Making `tryConvertCurrency` return null for XAU turns today's 31x **overstatement** into a silent **understatement**: `convertCurrency` fails open (console.error + raw number), so 1 g becomes "1 EGP" in left-to-spend (`calculations.ts:482`), Reports, ActivityLedger and income KPIs, and logs an error per render. | High | Test: pocket XAU 10 g, allocate-mode deposit, assert left-to-spend uses `goldGramsToMoney`, not raw grams. Console-error spy in tests. | Fix the callers that sum savings/income amounts, not only the store actions: one helper `savingsAmountInBase(amount, currency, base, rates, goldPerGram, goldOk)` and replace the 6 sites above. Grep gate: no `convertCurrency(` with a `.currency` that can be XAU outside the helper. |
| 1.2 | Cached rates: persisted `exchangeRates` in the store keep the old ounce keys until the next fetch, so a guard that only changes the API leaves every installed client wrong for hours/days, and old native builds keep the old behaviour forever. | High | Unit test with a stale rates map containing `EGP_XAU`. | Guard inside `tryConvertCurrency` (refuse any endpoint equal to XAU) so cached/old maps are ignored; additionally strip XAU keys in the route. Do not rely on the route alone. |
| 1.3 | `withdrawFromSavings` from a gold pocket as "income" writes an income event in grams (`currency: 'XAU'`). After 1.1 that event is counted as grams-as-EGP everywhere. | Medium | Test: withdraw 2 g as income, income KPI = grams x gram price. | Convert to base at event creation (needs gold price: refuse when `!goldPriceAvailable`, same as debts). |
| 1.4 | `balance.ts` converts pocket-leg amounts through `input.convert`; a null result sets `approx=true` but **still applies the raw amount** (`v = amount`). With W2 giving gold-pocket moves an account leg, a gold deposit would debit grams from the account. | Medium | Test in W2 below. | Skip the leg (and flag approx) when convert returns null, or store the account-side amount on the leg (see 2.2). |
| 1.5 | Buddgy `inPocketCurrency` will start returning "No exchange rate from EGP to XAU" for a request users do today (deposit EGP into gold pocket via chat). The message must offer the supported path (give grams, or use the gold price). | Medium | Buddgy tool test for the refusal wording. | Include the gram alternative in the refusal; add the same to the Withdraw/Add sheets (sheet currency should default to the pocket currency: W3). |
| 1.6 | Fixing the store without touching `transferBetweenPockets` UI: the sheet validates `amountInPocket` in the chosen currency but sends the raw number (W3). Fixing W1 alone leaves a USD-pocket transfer wrong. | Medium | Existing W3 probe. | Land W3 in the same commit as W1 (same functions). |

Commit split: W1 (currency guard + callers + Buddgy) as its own commit; no migration. Existing data: nothing to repair server-side (see section 0).

## 2. W2 + "From account" row (B1 + B2)

| # | Secondary risk | Likelihood | Detect | Guard / test |
|---|---|---|---|---|
| 2.1 | **Double credit on withdrawal.** `balance.ts` credits an account from a savings tx that has `paymentMethodId` (+amount on withdrawal) **and** from an income event with `paymentMethodId`. Withdraw-as-income creates both a tx and an income event. Stamping the account on both inflates the account 2x; stamping neither leaves W2. | High | Probe: account 1000, withdraw 300 as income, expect 1300 (not 1600). | Stamp exactly one; test `computeAccountBalances` for deposit, withdraw-income, withdraw-to-debt, transfer. |
| 2.2 | **FX drift and wrong-currency legs.** The tx stores only the pocket-currency amount; the account leg is recomputed at today's rate (`apply(..., t.currency)` -> `convert`). A USD-pocket deposit funded from an EGP account changes the account balance every time rates refresh, and deleting the deposit later reverses a different EGP amount. | High for cross-currency (3 users have both pockets and tracked accounts today, so low volume now) | Test: deposit 2 USD from EGP account at 50, change rate to 55, account balance must not move. | Persist the account-side amount+currency on the leg (new column on `savings_transactions`) or restrict the row to same-currency accounts in v1 and say so. |
| 2.3 | **Non-cash deposits must get no leg.** 18 of 23 live savings txs are `is_cash_flow=false` (declare/opening/transfer/correct-balance). Defaulting every deposit to the primary account would debit accounts for money that never came from them. | High if the default is applied in the store action | Test: declare-mode deposit, `transferBetweenPockets`, `correctSavingsBalance`, goal "add money" from outside: account unchanged. | Default only for `mode: 'allocate'` cash-flow deposits and income-purpose withdrawals. |
| 2.4 | **Two definitions of "primary account".** Server `primaryTrackedAccountId` = oldest `bank_account` then wallet with `opening_balance` not null (`pocketLedger.ts`). A new client default using "first tracked" or the account selector order would disagree with month-carry/goal funding, so one user gets legs on two accounts. | High | Test: same fixture through both functions. | Extract one shared function (client + server) with the same ordering, tested against a fixture. |
| 2.5 | **Delete/undo.** Account balances are derived from rows, so deleting the tx reverses the leg automatically (good). But `deleteSavingsTransaction` clamps the pocket at 0 (W6) while the account restores fully: ledger and balance diverge further. Buddgy `ledgerUndo` clamps the same way. | Medium | Existing W6 probe plus account balance assert. | Fix W6 in the same commit as W2; add pocket+account symmetric undo test. |
| 2.6 | **Recurring deposits on several devices.** The scheduler ticks every 60 s from mount (not gated on `dataReady`), uses device-local `format(new Date())`, posts one deposit per tick with a random tx id, and collapses missed months. Two devices both post; with W2 each also debits the account. | High with two devices | Test: two store instances, same recurring row, same due date -> one tx. | Deterministic tx id = uuid-v5(recurringId + dueDate) so the second upsert hits the same primary key; gate on `dataReady` and first successful pull; decide explicitly whether missed months post N deposits or one. No recurring deposits exist live (0), so test only. |
| 2.7 | **UI hidden when no tracked accounts** is right, but "primary" can change after a deposit (account closed/renamed); a leg pointing to a closed account keeps affecting its history. | Low | n/a | Leg keeps its id; closed accounts still compute balances. Test closed account. |
| 2.8 | Net worth: `accountsBasis` replaces the flow term, and pockets "held in" an account are skipped (`heldInPocketIds`). Pockets held in the **same** account used as the source are skipped in `balance.ts` (`heldInPaymentMethodId === target`), so the "From account" row must not offer the holding account for that pocket or the leg is ignored. | Medium | Test: pocket held in account A, deposit from A: expect no double count. | Disable A in the picker for that pocket. |

Commit split: W2 store+balance, "From account" UI row (B2), recurring/Buddgy defaults. Feature flag not needed, but ship W2 only with 2.1-2.4 tests.

## 3. D1 / D2 (B1)

| # | Secondary risk | Likelihood | Detect | Guard / test |
|---|---|---|---|---|
| 3.1 | Repair finds nothing (section 0). More important: **old app builds keep creating unlinked pairs** after the client fix ships (expense and payment get separate ids; link only exists in new builds). The double debit returns for every user who has not updated. | High | `SELECT count(*) FROM expenses WHERE is_debt_payment AND linked_debt_payment_id IS NULL AND created_at > <fix deploy>` weekly. | Re-run the audit after rollout; consider a server trigger that links an unlinked pair on insert (debt_id + same user + same day + amount) instead of a one-time migration; raise `min_app_version` once the fix ships. |
| 3.2 | A stale device that edits an old unlinked expense pushes `linked_debt_payment_id: null` over the server repair (mapper writes null when undefined; local `updatedAt` is newer than the server row so `mergeList` keeps the local copy). | Low-Medium | Re-audit after a week. | Mapper: omit the column when undefined for expenses, or make the repair server-authoritative. |
| 3.3 | **FK order.** Expense (level3) links to debt payment (level2): fine. Deleting a payment: `expenses.linked_debt_payment_id` is `ON DELETE SET NULL` only on hard delete; sync uses soft delete, so the expense keeps a dangling link and `balance.ts` `settledByExpense` still suppresses the payment leg. | Medium | Test: delete payment, expect paired expense also deleted (D4) and no dangling leg. | D4 delete-pair must be one store action producing both tombstones in one flush. |
| 3.4 | **D2 column strategy.** If `amount/currency` semantics change (e.g. to original paid amount), **old builds read them as debt units** and misprice every payment. Today `amount` = debt units labelled with the paying currency; 0 live rows differ, so there is no ambiguity to backfill. | High if semantics change; none if additive | Cross-version test fixture: old-shape row read by new mapper and new-shape row read by old mapper. | Keep `amount` and `currency` as they are (debt units); add `original_amount`, `original_currency`, `amount_in_base`, `rate_at_entry` nullable; new mapper falls back to legacy meaning when NULL. Never repurpose existing columns. |
| 3.5 | Old build pushes a payment without the new columns: PostgREST upsert leaves missing columns untouched on update, NULL on insert -> new clients must treat NULL as legacy. Mixed-key batches (some rows with the new key, some without) get NULL for the rows without it. | Medium | Mapper test for NULL columns. | Always send the same key set from the new mapper (explicit nulls). |
| 3.6 | `sync_pull` returns `to_jsonb(row)`, so new columns arrive automatically; but a **migration that rewrites rows is only picked up by delta pulls** if `updated_at` moves (trigger sets it, `suppress_redundant_updates` skips no-ops) and the transaction commits within the 2-minute pull slack. | Low (tiny tables) | n/a | Keep backfills under 2 minutes; otherwise force a full pull. |
| 3.7 | Gold (D3): `computed.amountInBase` becomes the expense amount; the expense then has base currency but the note carries grams. Account legs use `p.paymentCurrency` (XAU) for payments with no expense -> same 1.4 problem. | Medium | D3 probe + balance test. | Same helper as 1.1. |

Commit split: client fix (ids up front) and the D2 migration/mapper in separate commits; repair migration separate and **audit-only** first.

## 4. W5-W9 + client absolute balance (sync core, B1)

Facts: the client never calls any savings RPC (grep: only `pocketLedger.ts` on the server uses `adjust_pocket_balance`). No trigger derives `current_balance`. `savingsAccountToRow` writes `current_balance` on any change; `opening_balance` is always written as 0. `sync_pull` lets the server row win for pockets (no `updatedAt` on SavingsAccount).

| # | Secondary risk | Likelihood | Detect | Guard / test |
|---|---|---|---|---|
| 4.1 | **"Client stops writing current_balance; route via RPCs" breaks offline-first.** Deposits/withdrawals made offline (offline architecture is a design pillar) would never reach the server balance; the next pull overwrites the local balance with the stale server value, so the user's deposit "disappears" from the pocket while the ledger row remains. | High if implemented as written | Offline test: airplane mode, deposit, reconnect, pull: balance must include it. | Choose one of: (a) DB trigger on `savings_transactions` insert/soft-delete applies the delta idempotently by tx id, RPCs stop adjusting separately (avoid double count); (b) client keeps writing but via compare-and-set (`WHERE current_balance = expected`); (c) first step only: omit `current_balance` from updates that did not touch the ledger (rename/colour). Recommend (c) now, (a) later, behind a flag and its own commit. |
| 4.2 | **Mixed key sets in one upsert batch.** If new pockets send `current_balance` and updates omit it, PostgREST bulk upsert takes the union of keys and fills missing ones with NULL/default (verify with `Prefer: missing=default` behaviour), zeroing or violating NOT NULL for the updates. | Medium | Integration test against local Postgres with a mixed batch. | Omit the column from **all** rows in the batch, or split into two upserts. |
| 4.3 | W9 unique partial index on `(account_id, transfer_group_id)`: 0 duplicate groups live, and client transfers use one group id across two **different** accounts, so the pair is fine. But `deleteSavingsTransaction` deletes **all** rows sharing a group id: a server deposit uses `groupIdFor(key)` and is single-row (ok), yet a user deleting a server deposit and the cron re-running the same key returns early (`FOUND` on a live row only) and re-creates it after the soft delete (index excludes deleted rows). Idempotency across tombstones is lost. | Low-Medium | Test: month-carry run, user deletes the deposit, run again. | Decide whether a deleted server move may be re-posted; if not, keep a tombstone-aware key. Use `ON CONFLICT DO NOTHING` + advisory lock, include `deleted_at` rows in the key if the owner wants "stay deleted". |
| 4.4 | Q6 hardening (trust of ids/currency in the RPCs): no client path calls them, so hardening is low risk, but the plan couples W7 to "use the existing RPCs", which have **no idempotency on `deposit_to_savings`** (it accepts `p_transaction_id`, but the insert has no ON CONFLICT) and trust `p_currency`. Switching the client to them before hardening would double-post on retry. | Medium | Retry test (call twice with same id). | Harden first (Q6), then migrate callers, separate commits. |
| 4.5 | W5: deleting a withdrawal must delete its income event, but the only link is `linked_savings_account_id` + date + amount (no tx id). Fuzzy matching can delete a different same-day same-amount event. | Medium | Test: two identical withdrawals same day, delete one. | Store the pairing explicitly (new nullable `linked_savings_transaction_id` on `income_events`, or deterministic event id derived from the tx id) for new rows; legacy pairs stay unmatched (offer no automatic repair). |
| 4.6 | W6: removing the `Math.max(0, ...)` clamp lets balances go negative in a UI that assumes >= 0 (progress rings, "balance <= 0" empty states, goal reconcile). | Medium | Visual/logic test with negative pocket. | Block the delete when it would take the balance negative and say why (smaller blast radius) rather than going negative. |
| 4.7 | L3 (duplicate payday 23505): the unique index is `(template_id, occurrence_date) WHERE deleted_at IS NULL`. "Adopt the server row" replaces the local event id; anything keyed to the old id (SMS confirm linkage, payday timeline, assigned goal funding) dangles. And `OpRunner.drain` runs all ops with `Promise.all`, so "tombstones before upserts" needs ordering that does not exist today (every table's upsert and tombstone race). | Medium | Test two devices creating the same payday event. | Order tombstones before upserts **only for income_events** (separate tier) and remap local references when adopting. Do not change global drain order in the same commit. |
| 4.8 | Whole-batch failure: one bad row fails the whole table's upsert, and the store retries the same batch forever (this is what L3, D6, Q8 exploit). | High (any constraint) | `useSyncFailures` count in QA. | Per-row fallback: on a batch error, retry rows individually and quarantine the bad row with a visible failure. Land before any new constraint (Q8/Q9). |

Commit split: Q6 hardening -> W9 index -> W7 (c) -> W7 (a). Each its own migration, with a revert note.

## 5. L1 / R3 - events surviving a deleted income source (B1)

- No FK links `income_events.template_id` to `income_sources` (Q9 will add one). Sources are **soft-deleted** (sync tombstone) so an FK `ON DELETE SET NULL` never fires; the event keeps a dangling `template_id`, which is the bug.
- Re-attaching by nulling `template_id` flips events from "recurring occurrence" to "one-time" and changes `paydayResolution.ts:136` (it matches only `!e.templateId`), the occurrence dedupe index (NULL template is exempt), and expected-vs-received income. Likelihood of side effects: medium; affected rows live: 0.
- Guard: treat events whose source is missing as one-time **in calc only** (no data rewrite); test that a deleted source's received events still count in its months and in the payday timeline; keep 0197 L1 as an audit SELECT.
- Q9 follow-up: adding `income_events.template_id` / `linked_*` FKs requires **tier reordering in `sync.ts`**: `income_sources`, `income_events`, `savings_accounts`, `debts` are all `level1` and run in parallel; an event referencing a source created in the same flush fails with 23503. Same for `profiles.default_carry_pocket_id -> savings_accounts` (profiles are in `roots`, pockets in `level1`) and `profiles.active_budget_plan_id -> budget_plans` (both in `roots`). Move events to level2 and profile after plans/pockets, or make the FK `DEFERRABLE INITIALLY DEFERRED` (does not help across separate HTTP requests). Add a sync test that creates source+event and pocket+profile default in one flush.

## 6. C1 - 2FA server gate (B3)

Facts: `private.app_client_gate()` is the PostgREST pre-request function; it returns void, reads headers, and **swallows every exception** (`EXCEPTION WHEN others THEN RETURN`). `/api/*` routes do not pass through it. 2FA is enforced only in `useAuthModal` after a full password session exists. Live: 1 user with 2FA.

| # | Who gets locked out / what breaks | Likelihood | Guard |
|---|---|---|---|
| 6.1 | Native Google/Apple sign-in, magic link, password reset, biometric sign-in create sessions that never ran `/device/check`. With a gate keyed on "2FA satisfied for this session", every 2FA user using these paths is locked out (the one live 2FA user also has a biometric binding). | High for 2FA users | Define per-method rules before coding: biometric = device-bound secret counts as 2FA; OAuth counts only if the IdP asserted MFA; magic-link/password reset must still satisfy 2FA or be refused. |
| 6.2 | The OTP step itself calls PostgREST/`/api` with a password session; the gate must allow the 2FA-verify endpoints and `sync_pull` bootstrap or the user can never complete 2FA (chicken and egg). | High | Allow-list: `/api/auth/*`, `auth` endpoints, and the table/RPC that stores the 2FA mark. |
| 6.3 | Session identity: JWT `session_id` changes on refresh? (it does not change per refresh but a new login creates a new session). A mark keyed on user id would let a password-only attacker session ride a legit mark; keyed on session id would require re-2FA after every sign-in on every device (intended) and after "remember me off" restarts. | Medium | Key on `session_id`; test two sessions for one user. |
| 6.4 | Old app builds: they send no extra header and do not know a new 2FA response; a gate that returns 401/403 shows "session expired" loops or silent empty data. Use a distinct PGRST error (like `update_required`) and map it in the client; old builds will show a generic failure. | Medium | Staged rollout flag per user (`platform_settings`/`user_settings.two_factor_server_enforced`), start with the single 2FA user, owner-tested, then widen. |
| 6.5 | The gate is `STABLE` and swallows errors by design (fail-open for version checks). Putting the 2FA check inside the same `BEGIN ... EXCEPTION` block makes the 2FA gate **fail open** on any error, which is exactly C1's complaint. | High | Put 2FA in a separate block that fails closed, or a separate function. |
| 6.6 | F10 later rewrites this function; the 2FA block must have a test fixture (see item 17). | - | Add a SQL test now. |

Separate commit and migration (0208), behind the flag; do not enable for all users in the same release.

## 7. C5 - password change revokes sessions (B3)

- `reset-password/confirm` already ends with `signOut({scope:'local'})` and a full navigation to `/`, i.e. the user logs in again today. "This device re-trusted" is impossible without a session; re-trust must happen after the next login, or the page must stay signed in.
- Revoking from the server: use admin `signOut(jwt,'others')`/delete sessions rows **after** deleting `biometric_devices` and `trusted_devices` in one route, in that order; revoking sessions first lets a biometric device mint a new session via `/api/biometric/signin` (it uses `generateLink` and does not check password-change time).
- Native: other devices lose their refresh token; the SDK emits SIGNED_OUT (`session_not_found`), so no re-login loop **as long as nothing calls `refreshSession()`** manually (per the known rule). The biometric screen on those devices still shows an enabled state (`ENABLED_KEY`, secret in Preferences); `biometricSignIn` returns false on 404 and leaves local state, so the user gets a repeated failing prompt. **Guard:** treat 404 as "binding revoked": clear local enabled/secret and fall back to password.
- Re-auth for the change itself: if implemented with `signInWithPassword` for the current password, that call creates a new session and fires SIGNED_IN listeners (NativeBootstrap keyed on user id re-runs); use a server verify route or supabase `reauthenticate` instead. Likelihood medium; test the native listener count.
- Detect: auth log `refresh_token_not_found` spikes after release; support reports of "asked to sign in again" are expected but should happen once.
- Commit split: C5 separate from C1; do C5 only after 6.1 rules exist.

## 8. Q8 / Q9 constraints (B3)

- Live rows that violate the planned checks: expenses dated > today+366: **2** (2028, 2030), < 2015: **1**; `debts.amount <= 0`: **2** (credit cards at 0); `budget_categories.amount = 0`: **4** (so `amount > 0` there is wrong; use `>= 0`). expenses/income_events/debt_payments/savings_transactions amount <= 0: **0**.
- **NOT VALID does not protect old rows from UPDATE.** Postgres checks the new row version on every UPDATE; editing or tombstoning one of the 3 out-of-window expenses (or either zero credit card) will fail with 23514 and the sync batch fails forever (undeletable row). This is the biggest hole in the Q8 mitigation text.
- Client writes that would be rejected: zero-amount credit card creation, budget lines at 0, expenses dated far ahead (long installment schedules, BNPL 36-month plans create future-dated rows? verify `recurring` materialisation windows), refunds as negative amounts (none live; verify the refund path stores `refundedAt`, not negative).
- Guard: (1) fix the 3 expenses and 2 debts first (owner approval, backup), (2) constraints only for rows the client actually writes: `amount > 0` on the four ledger tables, `>= 0` elsewhere, date window `-20 years .. +5 years` (not +366 days), (3) per-row fallback in sync (4.8) shipped first, (4) add a test that every client `*ToRow` mapper output for default/zero fixtures satisfies the constraint list.
- Own migration per constraint group so a bad one reverts alone.

## 9. F6 - persist partialize / throttle (B8)

Facts: store name `buddget-storage`, version 21, **web `localStorage`** via `createSafeLocalStorage` (not Capacitor Preferences; memory fallback is lost on restart), no `partialize` today, `merge` re-derives `dataReady` from `profile.id`.

| # | Risk | Likelihood | Guard |
|---|---|---|---|
| 9.1 | Debounced/throttled writes lose the last change on process kill (iOS swipe-kill, Android low-memory). Unsynced offline edits live only in this store. | High at 1-2 s windows | Flush on `visibilitychange`, `pagehide`, Capacitor `appStateChange` (background), and after any user-initiated write batch; cap max delay (e.g. 500 ms) and test with a simulated kill. |
| 9.2 | Dropping lists from `partialize` makes cache-first boot show an empty app with `dataReady=true` (empty states, onboarding prompts, "no income declared" nags) until the pull finishes. | High if lists dropped | Never drop lists that pages read at first paint; only drop derived/transient fields (rates cache is fine to keep). |
| 9.3 | Persisted-shape version: other fields (`exchangeRates`, `goldPricePerGram`, `lastRatesFetch`) dropped -> gold shows "unavailable" and net worth incomplete on every boot. | Medium | Keep them or reload before first paint. |
| 9.4 | Rollback/old builds: a lower code version reading a higher stored version returns the state as-is (migrate guard `fromVersion >= PERSIST_VERSION`); missing keys are filled by `merge`, but any key whose absence changes meaning (e.g. `incomeEvents` missing) would be treated as empty and then **pushed as deletes** by the diff? (the sync baseline is the pulled snapshot, so only if the baseline is the persisted store). | Low-Medium | Read where `prev` snapshot is set; test a persisted state missing `expenses` does not tombstone server rows. |
| 9.5 | Quota overflow: `safeLocalStorage` swallows the error and keeps data in memory only; user loses data on next launch without warning (V13). | Medium | Surface the quota failure (V13 banner) in the same release as any size change. |

Own commit; ship V13 banner first.

## 10. F10 - `app_client_gate` rewrite (B8)

- The function is the only place for `min_app_version`, and swallows errors (fail open on purpose). A rewrite for speed (e.g. cache the setting, skip when no platform header) must keep: header-less browser requests pass, empty `need` passes, and **native requests with an `origin` of `https://localhost`/`capacitor://localhost` but no `x-app-platform` header are treated as version 0.0.0** (old builds): a "skip when no header" optimisation would silently disable the force-update gate for exactly the old builds.
- O8 typo risk: a malformed `min_app_version` value makes `app_version_below` raise inside the exception block -> returns (fail open, safe) but also hides the typo. Add a validation trigger on `platform_settings` rather than relying on the gate.
- Tests: SQL cases (browser, native with header, native without header at 0.0.0, below/at/above min, malformed setting, 2FA block from item 6). Separate migration 0216, revert = previous function body saved in the migration comment.

## 11. F3 - CSP nonce / dynamic rendering (B8)

- `middleware.ts` issues a per-request nonce and `script-src 'self' 'nonce-X' 'strict-dynamic'`; `layout.tsx` reads `x-nonce` through `headers()`, which is what forces every page dynamic. Next.js injects the nonce into its own bootstrap and RSC `<script>` tags **only when rendering dynamically**. A statically generated page has script tags without a nonce; with `strict-dynamic` and no `unsafe-inline`, those are **blocked: blank page, no hydration**, and no unit test or `next dev` run shows it.
- "Restrict nonce to legal/offline route group" means the rest of the web app needs a different CSP (hashes or `unsafe-inline`), i.e. a weaker policy for most pages. The inline `THEME_INIT_SCRIPT` needs a fixed hash; Next's inline flight scripts differ per page.
- Capacitor builds (`CAPACITOR=true`, static export) have no middleware, so native is unaffected; the web is.
- Likelihood of a production regression if done as described: high. Guard: build + `next start`, load 10 routes in a real browser with console CSP-violation assertion (Playwright), compare headers before/after; keep it behind a deploy-time flag with instant revert. Alternative with the same win: keep nonce only on the HTML shell and make pages static via PPR, or accept the dynamic cost. Recommend deferring F3 out of B8 unless a CSP browser test exists.

## 12. V4 - iOS 16.4 target (B6)

- `IPHONEOS_DEPLOYMENT_TARGET` appears 4 times in `project.pbxproj` (260, 317 project level; 338, 365 target level). `CapApp-SPM/Package.swift` is headed "DO NOT MODIFY - managed by Capacitor CLI" and has `platforms: [.iOS(.v16)]`; `npm run cap:build` re-syncs it, so a manual edit is reverted. It is not needed: the app target (16.4) may exceed the package platform (16.0). Do not edit Package.swift.
- Effects: users on iOS 16.0-16.3 can no longer install updates (they stay on the last build that supported them; today they get a broken web layer anyway). App Store listing minimum OS changes on the next upload.
- `Info.plist` has a literal `CFBundleVersion` = `6` while `native-release.sh` bumps only `CURRENT_PROJECT_VERSION` in the pbxproj (now 129). Switching to `$(CURRENT_PROJECT_VERSION)` is correct, but until the owner confirms the last TestFlight build the first upload after the change could be rejected for a duplicate/lower build number. Keep it a separate commit after the owner check (already an owner step).
- Regex rewrite (lookbehind) in `quickAddDate/lexicon/text/parseQuickAdd` is independent: do it first, with tests that run the patterns in a Node version without lookbehind semantics changes (assert same matches on a corpus of 50 phrases in en+ar).
- No native build is to be started without an explicit request (rule), so verify only by `xcodebuild -showBuildSettings`.

## 13. O9 - notifications via pg_cron + pg_net (B6)

Facts: extensions installed: `pg_cron`, `supabase_vault`, `pg_trgm`, `pgcrypto`...; **`pg_net` is not installed**. 10 cron jobs exist, all SQL-only; `cron.job_run_details` has 4 failures in 2632 runs. `user_settings.timezone` is set for **1 of 45** users. The route is resumable via `platform_settings.notification_cron_cursor`, dedupes by unique `(user_id, dedupe_key)`, and pushes only when the insert is newly created. Vercel cron for it is `0 6 * * *` (hourly is not possible on the Hobby plan, which is why pg_cron is proposed).

| # | Risk | Likelihood | Guard |
|---|---|---|---|
| 13.1 | **Secret storage.** Putting `CRON_SECRET` literally in `cron.schedule(...)` stores it in `cron.job.command` in plaintext, readable by anyone with DB read (including this MCP) and committed to git if written in a migration file. | High if inlined | Store it in `supabase_vault` (inserted out-of-band, not in a migration) and read `vault.decrypted_secrets` inside a SECURITY DEFINER function that calls `net.http_get`; migration contains no secret. Rotate the existing secret if it was ever pasted. |
| 13.2 | **Redirects/host.** Middleware redirects non-canonical hosts with 307 (`decideHostRoute`); pg_net does not follow redirects, so a wrong base URL fails silently as a 307 in `net._http_response`. Preview/prod URL drift. | Medium | Store the base URL in `platform_settings`; first run verifies a 200. |
| 13.3 | **Silent failure.** pg_net is fire-and-forget; responses live in `net._http_response` (short retention). Default timeout is 5 s while the route runs up to 48 s: the response is recorded as a timeout although the work completes, giving false alarms, and a real 500 is unobserved. | High | Set `timeout_milliseconds` >= 55000; add an hourly watcher that records the last 2xx time to `platform_settings` and alerts after N missed hours (this also fixes O14). |
| 13.4 | **Double send with the Vercel 06:00 UTC run.** Unique dedupe keys protect identical alerts, but (a) the overdue escalation (day 1/3/7 then weekly, max 6) must put the **step** in the key, not the run date, or each run of the day differs; (b) the 06:00 UTC Vercel run notifies everyone at 06:00 regardless of timezone unless it applies the same "local hour >= 9, not yet sent today" rule; (c) two overlapping runs (Vercel + pg_net in the same hour) read/write the same `notification_cron_cursor` and one run can skip users another already covered (harmless for dedupe, but users can be starved if a run stops early and the other resets the cursor to ''). | Medium | Use `>= 9` (catch-up) not `== 9`; cursor per caller (`notification_cron_cursor:pg` vs `:vercel`) or drop the Vercel entry once pg_cron has run clean for 7 days; test two parallel invocations. |
| 13.5 | **Timezone fallback.** 44 of 45 users have NULL timezone (the 0192 client has not reported yet), so "09:00 local" falls back to the default (UTC or Cairo?): code uses `DEFAULT_USER_TIME_ZONE`; confirm it is Africa/Cairo, not UTC, or Egyptian users get alerts at noon. | High | Test with NULL timezone. |
| 13.6 | Hourly cost: with 45 users trivial, but the route does a per-user sequence of queries; at 10k users hourly x all users is heavy; the candidate RPC limits it. | Low now | Keep the candidate filter; add the local-hour pre-filter in SQL, not JS. |
| 13.7 | pg_net extension creation requires a project setting change (dashboard "Database > Extensions" or `create extension pg_net`); it is not reversible without dropping queued requests. | Low | Own migration 0213 so revert = drop extension and unschedule job. |

## 14. SMS retention lifecycle (B4: N2, N3, N13, N19, LF3, LF6, PR1)

**What reads `sms_parse_log.raw_body` (grep, src + supabase):**

| Reader | What it does with the text | Effect once NULL |
|---|---|---|
| `api/sms/parse/route.ts` (insert at :605, pass-through at :865/:920) | writes it; Gemini prompt uses a 300-char slice for merchant category | write side; NOT NULL change affects nothing |
| `lib/sms/dispatch.ts` (:190,233,241,302,452,474,495) | direction guard, own top-up, stored-value naming, IPN reference, decline/reverse detection, category, notification body | runs on the in-flight row, not stored text; safe |
| `api/sms/confirm/route.ts` (:36,89,147) | reloads the row to confirm: uses raw_body for sender key, category and the dispatch input | confirm after 30 days (or after a class purge) books with `rawBody ''`: wrong category, no IPN pairing, sender key falls back |
| `hooks/useSmsConfirmations.ts`, `SmsReviewSheet.tsx` | shows the original SMS to the user in the review sheet | shows nothing; `item.raw_body ? ... : null` is handled |
| `hooks/usePaymentMethodDetector.ts` (:56,74,102) | `paymentTypeFromSms(r.raw_body, ...)` over historical rows to suggest card/wallet types | suggestions degrade silently after purge; check null-handling of `paymentTypeFromSms` |
| `lib/sms/runAdjudication.ts` (:82-91, :183-192) | needs the body to re-judge a correction; if null: `markVerdict('unclear')` | corrections older than the purge are permanently "unclear": no template signal; check the adjudication delay vs the 7-day class |
| `lib/sms/matchSalary.ts:210` | counterparty name for salary evidence | older salary evidence loses the name |
| `lib/sms/harvest.ts` (:16-32) | selects `raw_body` for legacy harvest and `not('raw_body','is',null)` | rows already purged can never be harvested |
| `api/admin/sms/logs/route.ts` (:7,60,98-102) | admin list hides body; "reveal" returns raw (with reason) | reveal returns null after purge; UI must show "purged" |
| SQL `sms_try_pair` (0094): `s.raw_body ILIKE '%'||p_reference||'%'` | IPN pairing by shared reference | pairing against a purged sibling fails; matters when legs arrive >30 days apart (rare) or if the class purge is 7 days for "rejected" only (fine) |
| SQL 0097 template re-test (`log_row.raw_body ~ tpl.regex_pattern`), 0100 zero-variance oracle (`count(distinct raw_body)`) | re-test templates over history; detect zero-variance templates | both silently weaker after purge: oracle counts 0 distinct bodies and never flags; replay (LF5) must use masked shapes |
| `sms_retention()` | the purge itself | see below |

Gaps to add to the plan: a regression test listing each reader with a NULL body; `paymentTypeFromSms(null)` check; admin UI "purged" state; confirm route refusing (or degrading explicitly) when `raw_body` is NULL.

**Ordering hazard (high likelihood).**
1. `raw_body` is `NOT NULL`. `sms_retention()` currently fails at its first `UPDATE ... SET raw_body = NULL`; because it is one function, the later `DELETE FROM sms_corpus WHERE seen_count < 3 AND last_seen < now() - 30 days` also never ran. The moment 0209 drops the NOT NULL, the nightly job **succeeds**: it NULLs up to 5000 rows/night (all 682 old rows on night one) and deletes 455 corpus shapes (88% of the corpus) at the 30-day threshold, **before** LF3/LF6 exist. The plan numbers N2 (0209) before LF3 (0211) while saying the job "keeps failing harmlessly until then": that is only true if `DROP NOT NULL` ships last.
2. Guard: ship `DROP NOT NULL` and the new purge function in the **final** B4 migration, with the cron job unscheduled until a `platform_settings.sms_purge_enabled` flag is true; change the corpus threshold to 180 days in the same migration; add the leak scanner (LF6) as a precondition check inside the function.
3. `harvested_at` is already set on all 863 rows (set at ingest by `parse/route.ts`, via the weak `smsSkeleton` mask). Use a new column (`masked_version int`) so LF3 re-harvests with the improved masker; otherwise `harvestLegacySms` selects nothing and the "backfill complete" gate is vacuous. Detect: `SELECT count(*) WHERE masked_version < current` must be 0 before enabling.
4. Un-reviewed hold (PR1): the 60-day cap purge must still run when nobody reviews; test that the hold does not block rejected/OTP 7-day deletion.

## 15. LF1 - LF3 normalisation (B4)

- `computeSmsHash` hashes the message as received (trim, collapse whitespace, lowercase) plus a 2-minute bucket; unique index `(user_id, sms_hash) WHERE is_duplicate = false`. If the normaliser (bidi strip, Arabic-Indic digits) runs **before** hashing, a client retry or a queued item from an old app build (delivered after the deploy) hashes differently from the already-stored row: duplicate booking inside the bucket window and neighbouring buckets (`computeNeighbourSmsHashes`), plus the `distinct sms_hash` logic in `detect_zero_variance_templates` shifts. Likelihood: medium (native queue replays, Android worker retries). Guard: hash the **raw** received string; normalise only for parsing/learning; test: same SMS with and without bidi marks gives one row when sent twice, and old-hash rows still dedupe.
- `smsSkeleton` key = sha256(senderKey | redacted body); changing the masker (LF6) changes every key, so `sms_corpus` seen_counts split and `seen_count < 3` pruning kills the re-keyed rows. Re-key in one migration (recompute keys, merge counts) or version the key. Detect: corpus row count before/after.
- Live templates: 0 contain bidi or Arabic-Indic digits, so normalising input cannot make an existing template miss because of those; but 27 of 53 contain **Arabic letters**: any NFKC/alef/tatweel normalisation would break them. Restrict the normaliser to the listed codepoints plus digits and separators. Test: replay all 53 templates against the 863 stored bodies before/after and assert identical match sets (this is also the LF5 harness; build it first).
- The claim that bidi marks poison 69 of 78 failures does not match stored data (0 of 863). Locate those rows before relying on it.
- LF2 (date formats): the 210 `gate_capture_unsound` failures are in `learn_status`; accepting year-less datetimes means the transaction date is inferred; wrong century/year wrap near New Year; guard with a "date within the plausible window" check (`smsPlausibilityIssue` already exists) and a test around 31 Dec / 1 Jan.

## 16. Sender strictness for credits (B4 / N18)

- `sms_parse_log.sender` is empty for **100% of rows** (863/863). Credit-type rows auto-booked live: instant_transfer_in 113 (7 users, 3 banks), income 33 (2 users), own_transfer 8 (4 users), refund 6 (2 users) = **160 rows, 9 distinct users appear across kinds**. If "no known sender" means "confirm", all of these would have required a tap; iOS can never supply a sender, and Android rows are empty too here.
- The decision text ("incoming credits must match the bank's known senders or go to confirm") and the ledger fix (N18: only when a non-empty sender is present) differ. Ask the owner which one; as written in N18, live impact is **0** rows.
- Also: salary "confirm decisions must actually post" (N1): 12 ghost rows listed for owner approval, no blind write.
- Guard: rule applies only when a sender is present (Android with sender); empty sender stays on current behaviour; unit test matrix {iOS no sender, Android known sender, Android unknown sender} x {credit, debit}; metric: `awaiting_confirmation` rate per day after release (today: 1 `income` notified, 1 `purchase` awaiting).

## 17. Sheet header phase 2 (B10b U4)

- Phase 1 "no visible change": `V3SheetHeader` hard-codes `aria-label="Close"` (English), while `ModalSheetHeader` uses `t.common.close`. Moving 18 sheets to the V3 look regresses Arabic accessible names unless the merged component takes the translated label. Likelihood high.
- V3 header has its own `px-5 pt-4` padding and a 22 px `h2`; `ModalSheetHeader` is `h3` 16 px semibold inside a padded sheet body with `mb-4`. Dropping V3 into the 18 sheets doubles horizontal padding or shifts content; heading level `h3 -> h2` changes the document outline and any `getByRole('heading', {level})` assertions (none found in tests today).
- `AdminSheet` and `SetupProgressChip` also use `ModalSheetHeader`; `useModalTitleId()` returns undefined outside `ModalShell`, so `id={undefined}` is fine, but the admin sheet gets no accessible name; keep its own labelling.
- Guard: Playwright screenshot diff per sheet (before/after, light/dark, ar), accessible-name test in en+ar for every migrated sheet, header height comparison in px. Phase 2 is already a separate commit; add "revert per sheet" granularity (one commit per sheet group).

## 18. EmptyState extension (B10b U9)

- Current component: `role="status"` always, `py-8 sm:py-12`, emoji `text-3xl` icon, `action` slot. Adding `illustration` and `cta` while keeping `action` creates two ways to render a button. Add one prop for the slot and pass the CTA through `action`.
- `role="status"` on every empty state is a live region; screens with 2-3 empty states mounted at once announce all on mount. Illustration + CTA variants should not repeat that.
- Per CLAUDE.md "Variant limit": adding illustration + cta on top of the default is the 2nd/3rd variant; propose a distinct `HeroEmptyState` rather than growing the default.
- Guard: render tests for the 11 existing call sites (DOM unchanged with default props: snapshot), plus the six migrated screens' screenshots. Not a data-risk item.

## 19. Other items touched by the above (watch list)

- **Q11 (grants):** the app tables are written by the client through PostgREST; revoking anon/authenticated privileges must be tested path by path. `Prefer: resolution=merge-duplicates` upserts need INSERT **and** UPDATE (and SELECT for RETURNING). Keep `authenticated` INSERT/UPDATE/SELECT/DELETE on user tables; the C2 revoke applies to `trusted_devices` only.
- **Q7 cleanup crons:** `cleanup_abandoned_anon_users` deletes users (8 anonymous users live); run the SELECT first and never as part of a deploy.
- **Mappers:** `savingsAccountToRow` writes `opening_balance: 0` always; any new "ledger vs balance" audit (live: 1 pocket already mismatches) must compare against `opening_balance + sum(ledger)`, noting that opening is not tracked client-side.
- **Delta sync window:** `sync_pull` pulls `updated_at > cursor - 2 minutes`; server-side backfills must finish inside that window or clients need a full pull.

---

## Summary of required plan changes (by priority)

1. Re-audit D1/L1 numbers; the repair as designed matches 0 rows (section 0, 3.1, 5).
2. Order retention: `DROP NOT NULL` last, behind a flag; new `masked_version` marker; corpus threshold 180 days in the same migration (item 14).
3. W7: do not route all balance changes through RPCs; step (c) first (item 4.1, 4.2).
4. Q8: fix the 5 legacy rows first; NOT VALID does not protect UPDATEs; use per-row sync fallback first (item 8, 4.8).
5. W1: fix all summing call sites and cached rates, not only the store actions (item 1).
6. W2: stamp exactly one side of a withdrawal; persist the account-side amount; one shared "primary account" function; no leg for non-cash deposits (item 2).
7. F3: defer unless a browser CSP test exists (item 11).
8. C1: per-method rules and per-user flag; fail-closed block separate from the version gate (item 6).
9. pg_net: vault secret, timeouts, watcher, catch-up hour rule, per-caller cursor (item 13).
10. Sender strictness: owner decision needed on empty sender (item 16).
