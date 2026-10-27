# W7 design spike: who owns `savings_accounts.current_balance`

Status: proposal only. No sync-core change is made. Owner sign-off required before any implementation.

## Current behaviour (code-read, QA round 2 + PLAN_REVIEW_B section 4)
- Client: every store action (`depositToSavings`, `withdrawFromSavings`, `transferBetweenPockets`, `correctSavingsBalance`, `deleteSavingsTransaction`) updates `currentBalance` locally and appends/removes ledger rows. `sync.ts` (`emitList('savings_accounts')` + `savingsAccountToRow`) upserts the ABSOLUTE `current_balance` on any change to the pocket row (rename, colour, deposit). `opening_balance` is always written as 0.
- Server: month-carry and goal funding call `adjust_pocket_balance` (delta + ledger row, idempotent by `transfer_group_id`, but check-then-act with no unique index: W9). `deposit_to_savings` / `withdraw_from_savings` / `correct_savings_balance` RPCs exist but the client never calls them (`rpc.ts` has no UI callers). No trigger derives the balance from `savings_transactions`.
- Pull: `sync_pull` lets the server pocket row win (no `updatedAt` on `SavingsAccount`); window is `updated_at > cursor - 2 min`.
- Failure: device A is stale (balance 100) while cron adds 300 (server 400). A renames the pocket and pushes `current_balance = 100`: the cron deposit row survives in the ledger but the balance loses it. A deposit made offline on A is overwritten by the next pull if the client stops writing the balance.

## Constraints
1. Offline-first is a pillar: deposits/withdrawals must work with no network and survive reconnect.
2. The client never calls the savings RPCs today; switching callers before the RPCs are hardened (Q6: they trust `p_currency`, no idempotency on `deposit_to_savings`, no overdraft check) would double-post on retry.
3. One bad row fails a whole table batch (4.8); mixed key sets in one PostgREST bulk upsert fill missing columns with defaults (4.2).
4. 18 of 23 live ledger rows are non-cash (declare, opening, transfer, correct) and must keep working.

## Options
**A. Server-derived balance via trigger (ledger is truth).** Trigger on `savings_transactions` insert / soft-delete applies `+/- amount` to `current_balance` idempotently by tx id; client upserts stop sending `current_balance` (omitted from ALL rows in the batch); client keeps an optimistic local balance and replaces it on pull. RPCs stop adjusting separately (otherwise double count). Pros: removes lost updates structurally, offline works (rows queue, trigger applies on arrival), cron and client share one path. Cons: biggest change; backfill/reconcile of the 1 pocket already mismatched; optimistic balance can flicker on pull; needs `balance_after` semantics and a repair of historic drift; tx edits (amount change) must be modelled as delete+insert.

**B. Delta ledger merge (client-side compare-and-set).** Client sends `current_balance` only with the expected previous value (`UPDATE ... WHERE current_balance = expected`, or a `p_expected` RPC) and on mismatch re-reads and re-applies its unsynced ledger rows. Pros: no trigger; works offline. Cons: needs per-pocket "unsynced rows" bookkeeping in the sync queue, conflict UX, still two writers.

**C. Narrow first step: stop writing `current_balance` unless the ledger changed (last-writer with guard).** Pocket-only edits (rename, colour, type, target) omit `current_balance` (separate upsert without the column); ledger-touching edits still send it. Pros: tiny, removes the rename-overwrites-cron case, no offline regression. Cons: a stale device that DEPOSITS still overwrites a cron deposit.

## Recommendation
Ship **C now** (own commit, behind a flag, tests below), then **A** as a separate, flagged, owner-approved change after Q6 (RPC hardening) and W9 (unique index) land. Skip B (two writers remain). Order: Q6 -> W9 -> W7(C) -> W7(A), each its own migration with a revert note.

## Plan
- C: in `sync.ts`/`savingsAccountToRow` split the payload: rows whose only diff is non-balance fields use a `current_balance`-less upsert (whole batch, never mixed). Tests: rename after a simulated server delta keeps the delta; deposit still pushes balance; mixed batch regression with a fake PostgREST.
- A: migration adds `apply_savings_tx_delta()` trigger (insert + `deleted_at` transitions, idempotent by tx id, ignores `kind='correct'` if corrections carry absolute value), a one-off reconcile report (`opening_balance + sum(ledger) vs current_balance`) shown to the owner BEFORE any write, then client omits `current_balance`. Tests: offline deposit then reconnect and pull keeps the balance; cron + client same-day deposits both counted; delete reverses once; pg tests for trigger idempotency (run in CI, Z2). Rollback: drop trigger, client flag back on.
- Open owner questions: allow negative pocket balances server-side? Which RPC set survives (D8/D22)? Keep `correct` as absolute set or as delta?
