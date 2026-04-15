# Plan: Frontend sync-layer rewrite (full rebuild — writes + reads + atomic RPCs)

> **Status:** awaiting execution in a fresh session. The DB migration is already shipped (commit `c7a75bc` on `main`, migration log at `supabase/migrations/MIGRATION-LOG-20260416.md`). This plan covers only the frontend cutover.

## Context

The DB migration landed 11 migrations: 20 new normalized tables with RLS + policies + indexes + triggers; all 12 users' JSONB payloads backfilled (232 items, 100% reconciled). `user_finance.payload` remains as a pristine rollback safety net — the app still reads and writes it on every action.

The frontend currently persists via `src/components/sync/SupabaseFinanceSync.ts` — a single `flush()` debounces at 1600ms, builds one JSONB payload of all 20 Zustand slices, and upserts `user_finance(user_id, payload)`. Load hydrates the opposite direction via `importData(JSON.stringify(payload))`. Nothing touches Supabase outside that file.

**Problems this causes:**
- **Wasteful writes.** Adding one expense ships the full 1.27 MB payload for one of the real users. At 1600ms debounce × N mutations, bandwidth is burned on data that didn't change.
- **Slow loads.** `/expenses`, `/debts`, `/subscriptions` each pull the entire blob on mount even when the page only renders a small slice.
- **No RLS isolation per domain.** One `user_finance` policy governs everything; a bug exposing one slice would expose all.
- **No atomicity guarantees** for cross-domain actions (`addSubscription` creates both a subscription AND a recurring_expense; today that's two client mutations in the same `set()`, but once we write separately to Supabase they'd race).

**Outcome we want:**
- Writes go to specific tables with per-domain diffing (only the rows that changed).
- Reads per page load only the tables that page needs (dashboard still loads most; `/expenses` only loads expenses + payment methods).
- Cross-domain actions go through Supabase RPC so both writes commit atomically.
- Guest mode still works; signing in merges local edits with server state (no data loss).
- Zustand store shape unchanged. Existing 41 hooks and 100+ components keep working without modification.

---

## Shipping strategy

**Five phases in one session.** Each phase passes `tsc --noEmit` + `npm run build`, commits directly to `dev`, and auto-merges to `main`.

- **Phase 1** — Remote mapper library (`src/lib/supabase/remote/*`) — pure mapping + diff primitives, zero behaviour change.
- **Phase 2** — Atomic RPC functions (8 Supabase migrations) + TS bindings.
- **Phase 3** — Rewrite sync-layer `flush()` to diff + emit per-table writes; `pull()` still loads full payload from normalized tables.
- **Phase 4** — Per-page selective load hooks; replace mount-time blob fetch with page-scoped queries.
- **Phase 5** — Guest merge on sign-in + drop old `user_finance` reads/writes.

After a 2–7 day stability window: separate cleanup session drops `user_finance` + `backups_20260416`.

---

## Phase 1 — Remote mapper library

**Why:** single place that knows every `Zustand shape ↔ DB row` mapping and can produce diffs. Other phases import from here. No behaviour change yet.

### New files

```
src/lib/supabase/remote/
  index.ts                     -- re-exports
  types.ts                     -- DB row type aliases from Database["public"]["Tables"]
  mappers/
    profileMapper.ts           -- UserProfile ↔ profiles Row
    settingsMapper.ts          -- AppSettings ↔ user_settings Row
    onboardingMapper.ts        -- OnboardingState ↔ onboarding_state Row
    paymentMethodMapper.ts     -- PaymentMethod ↔ payment_methods Row
    incomeSourceMapper.ts      -- IncomeSource ↔ income_sources Row
    expenseMapper.ts           -- Expense ↔ expenses Row
    recurringExpenseMapper.ts  -- RecurringExpense ↔ recurring_expenses Row
    subscriptionMapper.ts      -- Subscription ↔ subscriptions Row
    debtMapper.ts              -- Debt ↔ debts Row
    debtPaymentMapper.ts       -- DebtPayment ↔ debt_payments Row
    recurringDebtPaymentMapper.ts
    savingsAccountMapper.ts    -- SavingsAccount ↔ savings_accounts Row
    savingsHoldingMapper.ts    -- SavingsHolding ↔ savings_holdings Row
    savingsTransactionMapper.ts -- SavingsTransaction ↔ savings_transactions Row
    recurringSavingsDepositMapper.ts
    goalMapper.ts              -- Goal ↔ goals Row
    budgetPlanMapper.ts        -- BudgetPlan ↔ budget_plans Row (plus subcategories handled here)
  diff.ts                      -- `diffLists(current, previous, idKey)` returns {inserts, updates, deletes}
  snapshot.ts                  -- snapshot(state) captures the 20 slices as plain arrays/objects
  sync.ts                      -- pullAll(userId) and flushDiff(userId, prev, next) orchestrator
```

### Mapper contract

Each mapper exports three pure functions:
```ts
export function toRow(x: DomainT, userId: string): TableRow
export function fromRow(r: TableRow): DomainT
export const ID_KEY: 'id' | 'user_id' = 'id'
```

### Diff primitive

```ts
// src/lib/supabase/remote/diff.ts
export function diffLists<T extends { id: string }>(next: T[], prev: T[]) {
  const prevMap = new Map(prev.map(x => [x.id, x]))
  const inserts: T[] = []
  const updates: T[] = []
  const nextIds = new Set<string>()
  for (const item of next) {
    nextIds.add(item.id)
    const before = prevMap.get(item.id)
    if (!before) inserts.push(item)
    else if (!deepEqual(before, item)) updates.push(item)
  }
  const deletes = prev.filter(x => !nextIds.has(x.id)).map(x => x.id)
  return { inserts, updates, deletes }
}
```

For singleton slices (`profile`, `settings`, `onboardingState`): a single `upsertOrNoop(next, prev, userId)` helper.

### Snapshot + orchestrator

```ts
// src/lib/supabase/remote/snapshot.ts
export function snapshot(state: FinanceState): Snapshot { … }

// src/lib/supabase/remote/sync.ts
export async function pullAll(client, userId): Promise<FinanceState | null>
export async function flushDiff(client, userId, prev: Snapshot, next: Snapshot): Promise<DiffResult>
```

`flushDiff` runs in parallel `.from('<table>').upsert(inserts)`, `.upsert(updates)`, `.delete().in('id', deletes)` per domain. Batches are capped at 500 rows per request.

### Existing utilities to reuse

- `src/lib/supabase/client.ts` — already exports `createClient()`.
- `src/lib/supabase/database.types.ts` (committed in the DB migration PR) — typed `Database` import for every row shape.
- `src/components/sync/SupabaseFinanceSync.ts` (will be rewritten in Phase 3 — read it as the behavioural reference).

### Verification (Phase 1)

Pure unit test file `src/lib/supabase/remote/__tests__/mappers.test.ts` — round-trip every mapper: `fromRow(toRow(x, 'uid'))` should equal `x` for representative fixtures. No DB touching, just data integrity.

---

## Phase 2 — Atomic RPC functions

**Why:** these 8 Zustand actions mutate multiple domains in one `set()`. Without an RPC each one becomes N client mutations that can race or half-fail.

### RPCs to create

| RPC | Replaces Zustand action | What it does |
|-----|-------------------------|--------------|
| `add_income_with_debt(p_income, p_debt)` | `addIncomeWithDebt` | Inserts both in one tx. |
| `add_subscription_with_recurring_expense(p_sub, p_re)` | `addSubscription` | Insert subscription + recurring_expense, link via `linked_recurring_expense_id`. |
| `update_subscription_and_re(p_sub_id, p_sub_updates, p_re_updates)` | `updateSubscription` | Keeps the two in sync. |
| `cancel_subscription(p_sub_id)` | `cancelSubscription` | Marks sub cancelled + deactivates linked recurring_expense. |
| `reactivate_subscription(p_sub_id)` | `reactivateSubscription` | Reverse of cancel. |
| `add_debt_payment_with_expense(p_payment, p_expense)` | `addDebtPaymentWithExpense` | Both + linking ids in one tx. |
| `deposit_to_savings(p_account_id, p_amount, p_currency, p_notes)` | `depositToSavings` | Insert savings_transaction + update savings_accounts.current_balance atomically. |
| `withdraw_from_savings(p_account_id, p_amount, p_currency, p_notes)` | `withdrawFromSavings` | Same, decrement balance. |
| `correct_savings_balance(p_account_id, p_new_balance, p_notes)` | `correctSavingsBalance` | Insert savings_transaction (kind='correct') + set balance explicitly. |

(Deletes with `ON DELETE CASCADE` don't need RPCs — `delete_subscription`, `delete_debt`, `delete_savings_account` are already atomic via FK cascade.)

All RPCs are `SECURITY DEFINER`, `SET search_path = public`, and enforce `auth.uid() = user_id` at entry. Errors raise exceptions that surface via Supabase client.

### Migrations

One Supabase migration file per RPC (~20–40 lines each). Names like `0012_rpc_add_subscription_with_recurring_expense`.

### Client bindings

Thin TS wrappers in `src/lib/supabase/remote/rpc.ts`:
```ts
export async function addSubscriptionWithRecurringExpenseRpc(sub, re)
export async function addDebtPaymentWithExpenseRpc(payment, expense)
// …
```

Each wrapper: map domain → row, call `client.rpc(...)`, handle error.

### Verification (Phase 2)

- Execute each RPC once with a real user_id via the MCP `execute_sql` tool to confirm it commits.
- Check `backfill_issues` stays empty.
- Confirm `tsc --noEmit` regenerates clean after updating `database.types.ts`.

---

## Phase 3 — Sync-layer rewrite (writes)

**Why:** the actual cutover from "one blob upsert" to "per-table diffs".

### Files modified

- `src/components/sync/SupabaseFinanceSync.ts` — core rewrite
- `src/hooks/usePushProfileFieldsToSupabase.ts` (if it exists — Agent's note) — delete, folded into sync layer
- `src/lib/store/useFinanceStore.ts` — cross-domain actions swap to `*Rpc()` calls from Phase 2 (only affects the ~9 actions listed above)

### New `flush()` shape

```ts
// Inside SupabaseFinanceSync.tsx
const prevSnapshot = useRef<Snapshot | null>(null)

const flush = async () => {
  if (!hydrated.current || !userId) return
  const next = snapshot(useFinanceStore.getState())
  const prev = prevSnapshot.current ?? emptySnapshot()
  const result = await flushDiff(supabase, userId, prev, next)
  if (!result.anyError) prevSnapshot.current = next
}
```

The existing debounce (1600ms) and store-subscribe pattern stay. The change is purely: one upsert → per-table diffs.

### `pull()` change

Still does the initial hydrate, but from normalized tables now:

```ts
const pull = async () => {
  const state = await pullAll(supabase, userId)
  if (state) {
    useFinanceStore.getState().importData(JSON.stringify(state))
    prevSnapshot.current = snapshot(useFinanceStore.getState())
  }
  hydrated.current = true
}
```

`pullAll` fetches each domain in parallel with `Promise.all` (20 parallel queries, all RLS-scoped).

### Dual-write safety net (for the first day after cutover)

During the initial window, `flush()` also writes the full `user_finance.payload` alongside the per-table diffs. This way if a bug sends wrong-shaped data to a normalized table, we can compare against the blob to find the discrepancy. Remove in Phase 5.

### Verification (Phase 3)

- Log in as a test user who has ~20 expenses + 3 subscriptions. Add one expense; inspect network tab: should see one `POST expenses` (not `POST user_finance`).
- Edit a subscription: should see one `POST /rest/v1/rpc/update_subscription_and_re`.
- Delete a debt: should see one `DELETE debts` (FK cascades handle payments).
- Check `user_finance.payload` still gets updated during dual-write window — every row in prod DB should have matching tables.

---

## Phase 4 — Per-page selective reads

**Why:** dashboard's current 1.27 MB initial blob load is visible to the user; `/expenses` shouldn't pay for it.

### New hooks

```
src/hooks/remote/
  useHydrateCore.ts       -- profiles + user_settings + onboarding_state + payment_methods (always needed)
  useHydrateExpenses.ts   -- expenses + recurring_expenses
  useHydrateSubscriptions.ts -- subscriptions
  useHydrateDebts.ts      -- debts + debt_payments + recurring_debt_payments
  useHydrateSavings.ts    -- savings_accounts + savings_transactions + savings_holdings + recurring_savings_deposits
  useHydrateGoals.ts      -- goals
  useHydrateBudget.ts     -- budget_plans + budget_categories + budget_subcategories
  useHydrateIncome.ts     -- income_sources
```

Each hook:
1. Checks `useFinanceStore.getState().<slice>` — if already populated (cross-page nav) returns immediately.
2. Otherwise `supabase.from('<table>').select('*').eq('user_id', uid)`, maps via mapper, hydrates the relevant Zustand slice.
3. Emits a loading boolean.

### Page wiring

Each page gates its mount on the relevant hook(s):

| Page | Hooks |
|------|-------|
| `/` (dashboard) | `useHydrateCore`, `useHydrateExpenses`, `useHydrateIncome`, `useHydrateDebts`, `useHydrateSavings`, `useHydrateGoals`, `useHydrateBudget` *(basically everything — this is still the heaviest page)* |
| `/expenses` | `useHydrateCore`, `useHydrateExpenses` |
| `/income` | `useHydrateCore`, `useHydrateIncome`, `useHydrateDebts` *(income form can create debts)* |
| `/debts` | `useHydrateCore`, `useHydrateDebts`, `useHydrateGoals` |
| `/subscriptions` | `useHydrateCore`, `useHydrateSubscriptions`, `useHydrateExpenses` *(linked re)* |
| `/goals` | `useHydrateCore`, `useHydrateGoals`, `useHydrateSavings`, `useHydrateDebts` |
| `/savings` | `useHydrateCore`, `useHydrateSavings`, `useHydrateGoals` |
| `/budget-setup` | `useHydrateCore`, `useHydrateBudget`, `useHydrateIncome`, `useHydrateExpenses` |
| `/reports` | `useHydrateCore`, `useHydrateExpenses`, `useHydrateIncome`, `useHydrateDebts`, `useHydrateSavings` |
| `/profile`, `/settings` | `useHydrateCore` |
| `/onboarding` | `useHydrateCore` |

### The mount-time pull() goes away

`SupabaseFinanceSync.pull()` becomes a no-op once per-page hooks are in. The component still mounts for the `flush()` subscription, but reads are delegated.

### Verification (Phase 4)

- Open DevTools Network on `/expenses` — should see 2 Supabase requests (core + expenses), not 20.
- Cross-page nav (e.g. `/expenses` → `/subscriptions`) should NOT re-fetch expenses (Zustand cache hit).
- Hard refresh on `/subscriptions` should NOT load debts or budget_plans.
- Dashboard full-refresh should still render within ~1.5× the old blob-load time (we're doing N parallel fetches vs 1 big one, with fixed RTT overhead).

---

## Phase 5 — Guest→auth merge + retire `user_finance`

### Guest merge on sign-in

Currently `pull()` calls `importData(JSON.stringify(serverPayload))`, which overwrites everything local. New behaviour:

```ts
const pull = async () => {
  const serverState = await pullAll(supabase, userId)
  const localState = useFinanceStore.getState()
  const merged = mergeStates(localState, serverState)  // id-dedupe per array domain
  useFinanceStore.getState().importData(JSON.stringify(merged))
  // If merge produced changes not in server, flushDiff handles the upstream push.
}
```

Merge rules per domain:
- **Singletons** (`profile`, `settings`, `onboardingState`) — server wins if server has any data; otherwise local.
- **Lists** — union by `id`. If the same id exists in both with different `updated_at`, the newer one wins.
- Any "unique" client-only id (e.g. a guest added a payment method with a locally-generated UUID) becomes a new server row after first flush.

New file: `src/lib/supabase/remote/merge.ts`.

### Drop dual-write to `user_finance`

After 2–7 days of stable operation (user judgement), remove:
- `flush()`'s dual-write to `user_finance`
- `pull()`'s fallback read from `user_finance`
- Eventually in a separate session: `DROP TABLE public.user_finance`, `DROP TABLE public.user_profiles` (old, now redundant), `DROP SCHEMA backups_20260416 CASCADE`.

Those drops will NOT happen in this session — flagged for post-verification.

### Verification (Phase 5)

- Sign out. As guest: add an expense + a payment method. Sign in with a fresh account. The guest's expense + payment method should appear alongside the server data (if any).
- `user_finance.payload` should still be populated (dual-write). After removing dual-write: `user_finance.payload` becomes stale, but data integrity on the new tables continues.

---

## Critical files touched (index)

| Phase | File | Kind |
|-------|------|------|
| 1 | `src/lib/supabase/remote/**` (new) | ~20 files, ~1200 LOC |
| 1 | `src/lib/supabase/remote/__tests__/mappers.test.ts` (new) | ~300 LOC |
| 2 | `supabase/migrations/0012_* … 0020_*.sql` (new) | ~9 migrations |
| 2 | `src/lib/supabase/remote/rpc.ts` (new) | ~200 LOC |
| 3 | `src/components/sync/SupabaseFinanceSync.ts` | rewritten |
| 3 | `src/lib/store/useFinanceStore.ts` | 9 cross-domain actions rewired to RPC |
| 4 | `src/hooks/remote/**` (new) | 8 hook files |
| 4 | `src/app/**/page.tsx` | 10 pages gain `useHydrate*` calls |
| 4 | `src/components/auth/AuthProvider.tsx` | remove mount-time pull |
| 5 | `src/lib/supabase/remote/merge.ts` (new) | ~150 LOC |
| 5 | `src/components/sync/SupabaseFinanceSync.ts` | drop dual-write |

Total: ~40 files touched, ~3 000 LOC new code.

---

## Existing utilities to reuse (don't reinvent)

- **`src/lib/supabase/database.types.ts`** — typed `Database` import; use `Database["public"]["Tables"]["<name>"]["Row" | "Insert" | "Update"]` for every mapper.
- **`src/lib/supabase/client.ts`** — `createClient()`; no new clients needed.
- **`src/lib/store/financeImportSchema.ts`** — zod schema for `importData`; reuse for validating pulled data before hydrating.
- **`src/lib/store/types.ts`** — all domain types; mappers reference these.
- **Zustand `persist` middleware + `safeLocalStorage`** — offline/guest mode; unchanged.
- **`src/components/auth/AuthProvider.tsx`** — `useAuth()` exposes `user.id`; remote hooks consume this.

---

## Verification (end-to-end, after Phase 5)

1. **Write test — one domain.** Add an expense on the `/expenses` page. Observe network: one `POST expenses` request, no `user_finance` write. Refresh — expense is still there.
2. **Write test — cross-domain.** Add a subscription. Observe network: one `POST /rpc/add_subscription_with_recurring_expense`. Check `subscriptions` + `recurring_expenses` tables both have a new row with matching `linked_recurring_expense_id`.
3. **Read test — selective load.** Hard refresh on `/subscriptions`. Network tab: only `subscriptions`, `recurring_expenses`, `payment_methods`, `profiles`, `user_settings`, `onboarding_state` — no debts, no budget plans.
4. **Read test — cache hit.** Navigate `/subscriptions → /expenses`. Should see 1 new `expenses` fetch, nothing else (subscriptions still cached).
5. **Guest merge.** Sign out. Add a payment method as guest (Zustand persists to localStorage). Sign in as a user with existing payment methods — both sets should appear, deduped.
6. **RLS test.** Sign in as user A, manually hit `GET /rest/v1/expenses?user_id=eq.<user_B_id>` — should return empty.
7. **Rollback rehearsal** (internal only). Comment out all per-table writes and fall back to `user_finance.payload` read+write path. App should still work — confirms the safety net.
8. **`tsc --noEmit` + `npm run build`** after each phase.
9. **Supabase advisors** — `get_advisors(type=security)` should return only the pre-existing auth-config item.

---

## Rollback plan

| Scenario | Rollback |
|----------|----------|
| Phase 1 mappers buggy | `git revert` — pure helpers, no state change. |
| Phase 2 RPC buggy | `DROP FUNCTION public.<name>`; client code falls back to the pre-RPC cross-domain action (if we kept a feature flag). |
| Phase 3 write cutover breaks prod | `git revert` the sync-layer commit; `user_finance` is still in sync thanks to dual-write window. Users lose a few minutes of data at most. |
| Phase 4 reads break some page | `git revert` just that page's `useHydrate*` wiring. |
| Phase 5 guest merge corrupts state | `git revert` + restore from `backups_20260416.user_finance` if needed: `UPDATE public.user_finance SET payload = b.payload FROM backups_20260416.user_finance b WHERE user_finance.user_id = b.user_id`. |

---

## Scope estimate

| Phase | Files | LOC | Risk |
|-------|-------|-----|------|
| 1 — Mappers | 20 new | 1 200 | Low — pure functions, unit tests |
| 2 — RPCs | 9 migrations + 1 TS | 500 | Medium — server-side logic |
| 3 — Sync rewrite | 2 modified | 400 | **High** — cutover point |
| 4 — Per-page reads | 18 touched | 600 | Medium — page mount changes |
| 5 — Guest merge + dual-write cleanup | 2 modified + 1 new | 300 | Medium — user-visible sign-in flow |
| **Total** | **~40** | **~3 000** | |

Realistically 2–3 long work sessions. Phase 1 + 2 can ship in the first; Phase 3 should be its own commit with a careful verification window; Phase 4 + 5 can go together once 3 has bedded in for a day.

---

## What this plan is NOT

- Not regenerating `src/lib/supabase/database.types.ts` — already committed in the DB migration PR.
- Not writing per-page component rewrites — Zustand shape stays identical so components don't change.
- Not touching `/api/*` route handlers — they use service-role and keep working.
- Not dropping `user_finance` in this session — deferred to a later cleanup session after 2–7 days of stability.

---

## Handoff note for the next session

Start by reading:
1. `supabase/migrations/MIGRATION-LOG-20260416.md` — what the DB already looks like.
2. This plan file.
3. `src/components/sync/SupabaseFinanceSync.ts` — the file you'll rewrite in Phase 3.
4. `src/lib/store/useFinanceStore.ts` — the actions you'll rewire in Phase 3.
5. `src/lib/supabase/database.types.ts` — your source of truth for row shapes.

Then execute phase-by-phase. After each phase: `tsc --noEmit`, `npm run build`, commit to `dev`, merge `--no-ff` to `main`, `git push` both (per auto-merge workflow rule).
