# Plan: Normalised Supabase schema + full end-to-end migration

**Status:** awaiting user `go` before any DB write.
**Target project:** `buddget` (`ydihurtbcnoflhormgzi`, ap-southeast-1, Postgres 17.6)
**Snapshot date:** 2026-04-16

---

## 1. Current state (read-only inventory complete)

### Real data
| Table | Rows | Status |
|-------|------|--------|
| `public.user_finance` | 12 | JSONB blob — **holds everything the app writes** |
| `public.user_profiles` | 11 | `display_name` + `onboarding_completed` only |
| `public.app_analytics_events` | 7 544 | Client analytics |
| `public.onboarding_survey_config` | 1 | Admin-managed survey schema |
| `public.live_market_data` | 3 | Price cache |
| `public.income_sources` | 1 | Stray test row |
| `public.transactions` | 1 | Stray test row |

### Empty scaffold tables (exist but unused by the app)
`debts`, `debt_payments`, `financial_goals`, `investments`, `liquid_savings`, `monthly_budgets`, `notifications_insights`, `payment_methods`, `profiles`, `settings`, `subscriptions` (+ the 2 stray rows above).

### Domain model actually in use (from `user_finance.payload`)

Unpacking all 12 payloads reveals the real top-level keys and item counts:

| JSONB key | Users with key | Items in arrays | Target table(s) |
|-----------|----------------|-----------------|------------------|
| `profile` | 12 | — | `public.profiles` |
| `settings` | 12 | — | `public.user_settings` |
| `onboardingState` | 12 | — | `public.onboarding_state` |
| `paymentMethods` | 12 | 18 | `public.payment_methods` |
| `incomeSources` | 12 | 20 | `public.income_sources` |
| `expenses` | 12 | 78 | `public.expenses` *(new)* |
| `recurringExpenses` | 12 | 1 | `public.recurring_expenses` *(new)* |
| `debts` | 12 | 9 | `public.debts` (expanded) |
| `debtPayments` | 12 | 6 | `public.debt_payments` (expanded) |
| `recurringDebtPayments` | 12 | 0 | `public.recurring_debt_payments` *(new)* |
| `subscriptions` | 6 | 1 | `public.subscriptions` (full rewrite) |
| `goals` | 6 | 1 | `public.goals` (renamed + expanded) |
| `budgetCategories` | 12 | 96 | `public.budget_categories` (replaces `monthly_budgets`) |
| `budgetPlans` | 8 | 10 | `public.budget_plans` *(new)* |
| `activeBudgetPlanId` | 8 | — | `profiles.active_budget_plan_id` |
| `activeSharedBudgetId` | 1 | — | `profiles.active_shared_budget_id` |
| `defaultSharedBudgetPlanId` | 1 | — | `profiles.default_shared_budget_plan_id` |
| `financialGoalsNotes` | 8 | — | `profiles.financial_goals_notes` |
| `savingsAccounts` | 7 | 11 | `public.savings_accounts` *(replaces `liquid_savings`)* |
| `savingsHoldings` | 12 | 2 | `public.savings_holdings` *(new; replaces `investments`)* |
| `savingsTransactions` | 7 | 25 | `public.savings_transactions` *(new)* |
| `recurringSavingsDeposits` | 6 | 0 | `public.recurring_savings_deposits` *(new)* |

### Problems found in the proposed schema (the one you sent)

1. **14 tables have RLS enabled but zero policies** — the client cannot read/write them at all (advisor flagged).
2. `subscriptions` uses `integer` `user_id` + `subscription_id` with no FK to `auth.users` — inconsistent with everything else. Must be UUID'd and linked.
3. `profiles` and `user_profiles` overlap; `settings.base_currency` duplicates `profiles.base_currency`.
4. `income_sources` has no primary key declared.
5. Duplicate FK constraints on `user_profiles` and `settings`.
6. No `ON DELETE CASCADE` on any FK to `auth.users` → orphan rows on account deletion.
7. `monthly_budgets` uses `budget_month` + `budget_year` ints — should be a `period date`.
8. Categorical columns are free-text instead of enums.
9. Missing indexes on `user_id`, `created_at`, `transaction_date`.
10. No `updated_at` triggers.
11. `debts` has 6 columns; the app uses ~15 (debt_type, direction, person, creditor, installment fields, goal linkage, received_via, gold_karat, etc.).
12. `financial_goals` has 9 columns; the app uses ~15 (priority, linked savings/debts, monthly_contribution, status, emoji, monthly_spending_limit).

### Existing functions
`public.update_payment_method_balance`, `public.handle_balance_updates` — flagged for mutable `search_path`; we'll recreate with `SET search_path = public`.

### Migration history
`list_migrations` returned empty — all current DDL was applied ad-hoc without migration records. We start clean.

---

## 2. New schema (complete)

### Design principles

- **UUID PKs** everywhere, `id uuid DEFAULT gen_random_uuid()`.
- **All user-owned tables** have `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`.
- **RLS enabled + per-operation policies** (`auth.uid() = user_id`) on every user-owned table.
- **Enums for every categorical column** (see §3).
- **`created_at` + `updated_at`** on every mutable table, with shared `public.set_updated_at()` trigger.
- **Covering indexes** on `(user_id)`, `(user_id, created_at DESC)`, and business lookups (`debt_id`, `plan_id`, `account_id`, `subscription_id`).
- **`ON DELETE CASCADE`** from user → all owned rows; business FKs (`debt_payments.debt_id`, etc.) use `ON DELETE CASCADE` where child-only-exists-with-parent; otherwise `ON DELETE SET NULL`.
- **Amount columns** `numeric(20,4)` (consistent precision for fiat + gold grams + crypto).
- **Currency** stored as the enum `currency_code`, never free-text.
- **No overlapping columns** between tables — single source of truth per field.

### Tables (18 + extended user_settings; unused scaffold tables are dropped)

| Table | Purpose | User-owned |
|-------|---------|------------|
| `profiles` | User identity + snapshot fields (name, email, city, country, base_currency, financial_goals_notes, active_budget_plan_id) | ✅ |
| `user_settings` | UI + behaviour prefs (theme, language, show_secondary_currency, month_start_day, enable_ai, etc.) | ✅ |
| `onboarding_state` | Survey answers bag, current step index, flow version, plan accepted flag | ✅ |
| `payment_methods` | Payment method rows (name, type, currency, color, is_default, balance) | ✅ |
| `income_sources` | Income source rows (name, source_type, amount, currency, is_recurring, recurring_frequency, day_of_month, notes, payment_method_id) | ✅ |
| `expenses` | Ad-hoc expenses (category, amount, currency, description, date, payment_method_id, linked_subscription_id, linked_debt_payment_id) | ✅ |
| `recurring_expenses` | Recurring expense templates | ✅ |
| `debts` | Full debt shape (kind, direction, person, creditor, name, amount, currency, installment_count, installment_frequency, installment_start_date, interest_free, received_via, gold_karat, linked_credit_card_debt_id, installment_provider, goal_id) | ✅ |
| `debt_payments` | Payment events against debts | ✅ |
| `recurring_debt_payments` | Recurring payment schedule per debt | ✅ |
| `subscriptions` | Real subscription shape (brand_key, service_name, plan_name, amount, currency, billing_cycle, billing_day, start_date, next_billing_date, payment_method_id, expense_category, status, notes) | ✅ |
| `goals` | Full goal shape (name, emoji, category, target_amount, currency, manual_current_amount, target_date, linked_savings_account_ids[], linked_debt_ids[], monthly_spending_limit, priority, status, monthly_contribution, notes) | ✅ |
| `budget_plans` | Named budget scenarios (name, household, buddgy_guided_complete, buddgy_flow jsonb) | ✅ |
| `budget_categories` | Category rows per plan (plan_id, name, icon, amount, currency, savings_allocation_badge) | ✅ |
| `budget_subcategories` | Subcategory rows per category | ✅ |
| `savings_accounts` | Savings bucket (name, category, type, icon, currency, opening_balance, current_balance, notes) | ✅ |
| `savings_holdings` | Market-tracked positions (asset_symbol, quantity, currency, initial_amount, current_value) | ✅ |
| `savings_transactions` | Deposit/withdraw/correct ledger (account_id, kind, amount, currency, balance_after, notes) | ✅ |
| `recurring_savings_deposits` | Recurring deposit schedule | ✅ |
| `notifications` | User-facing notifications (renamed from `notifications_insights`) | ✅ |
| `app_analytics_events` | **Kept as-is** | ✅ |
| `onboarding_survey_config` | **Kept as-is** | ❌ (admin) |
| `live_market_data` | **Kept as-is** | ❌ (shared cache) |

### Tables dropped

`public.profiles` (current empty table → rebuilt cleanly), `public.user_profiles` (merged into new `profiles`), `public.settings` (split into `profiles` + `user_settings`), `public.monthly_budgets` (replaced by `budget_categories`), `public.liquid_savings` (replaced by `savings_accounts`), `public.investments` (replaced by `savings_holdings`), `public.transactions` (replaced by `expenses`), `public.notifications_insights` (renamed to `notifications`), and the old `public.subscriptions` (rebuilt with proper UUID FK).

**`user_finance` is kept intact during the migration** as the rollback safety net; dropped only after the frontend cutover is verified stable.

---

## 3. Enums to create

```
currency_code            AED, USD, EGP, EUR, GBP, SAR, KWD, QAR, BHD, OMR, MAD, TND, JOD, XAU, USDT, USDC, BTC, ETH
payment_method_type      cash, bank_transfer, card_debit, card_credit, nol, other
income_source_type       salary, freelance, business, rental, investment, debt, gift, refund, other
recurring_frequency      weekly, monthly, quarterly, annually
recurring_income_freq    weekly, biweekly, monthly, quarterly, annually
debt_kind                personal, installment, credit_card, mortgage, loan, other
debt_direction           i_owe, they_owe
debt_received_via        cash, bank_transfer, card, gold, other
installment_provider     tabby, tamara, credit_card, postpay, other
gold_karat               18, 21, 22, 24
subscription_status      active, paused, cancelled, trial
subscription_billing_cycle  weekly, monthly, quarterly, yearly
savings_category         savings, investment
savings_type             bank, cash, gold, crypto, stock, bond, real_estate, other
goal_category            spending_control, emergency, vacation, home, car, education, wedding, retirement, other
goal_status              active, paused, achieved
expense_category         Rent, Transport, Food, Enjoyment, Savings, Debt, Remittance, Other
budget_entry_mode        amount, percent_of_income
budget_household         solo, partner, family
theme                    dark, light
locale                   en, ar
notification_type        info, warning, success, error
onboarding_phase         survey, buddgy
```

---

## 4. RLS policy pattern

For every user-owned table `T` with column `user_id`:

```sql
ALTER TABLE public.T ENABLE ROW LEVEL SECURITY;
CREATE POLICY T_select_own ON public.T FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY T_insert_own ON public.T FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY T_update_own ON public.T FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY T_delete_own ON public.T FOR DELETE USING (auth.uid() = user_id);
```

`onboarding_survey_config`: SELECT for authenticated when `published = true` (matches current).
`live_market_data`: SELECT for authenticated (shared cache).
`app_analytics_events`: INSERT `auth.uid() = user_id`, SELECT only for service role.

---

## 5. Triggers & functions

- `public.set_updated_at()` — one shared trigger function (`SET search_path = public`), attached to every mutable table.
- `public.maintain_payment_method_balance()` — replacement for the current `handle_balance_updates` + `update_payment_method_balance` with locked search_path. Keeps `payment_methods.balance` in sync when a related debit/credit lands.
- `public.backfill_from_user_finance(p_user_id uuid)` — SECURITY DEFINER function that unpacks one user's JSONB payload into the new tables. Idempotent (upserts by `id` from the JSON).

---

## 6. Indexes (minimum)

For every user-owned table:
- `CREATE INDEX idx_T_user ON T (user_id);`
- `CREATE INDEX idx_T_user_created ON T (user_id, created_at DESC);`

Additional:
- `expenses (user_id, expense_date DESC)`, `expenses (payment_method_id)`, `expenses (linked_subscription_id)`, `expenses (linked_debt_payment_id)`
- `debt_payments (debt_id)`, `debt_payments (payment_method_id)`
- `budget_categories (plan_id)`, `budget_subcategories (category_id)`
- `savings_transactions (account_id, transaction_date DESC)`
- `subscriptions (user_id, status)`, `subscriptions (next_billing_date)`

---

## 7. Migration order (one session, phases verified internally)

1. **Snapshot backup (in-DB)** — `CREATE SCHEMA backups_20260416;` then `CREATE TABLE backups_20260416.<name> AS TABLE public.<name>` for every public table. Instant restore via `INSERT INTO public.<name> SELECT * FROM backups_20260416.<name>`.
2. **Schema dump to repo** — full DDL + data dumps written to `supabase/backups/20260416/`.
3. **Create enums** (§3).
4. **Create `set_updated_at` trigger function** with locked search_path.
5. **Create new tables** (§2) with RLS + policies + indexes + updated_at triggers. Additive — no drops.
6. **Migrate the 11 real users** from old `user_profiles` → new `profiles` (carry `display_name`, `onboarding_completed`).
7. **Run `backfill_from_user_finance()`** for each of the 12 users in `user_finance`. Verify row counts against the JSONB item totals above.
8. **Regenerate TypeScript types** (`mcp generate_typescript_types`), commit to repo.
9. **Frontend rewrite** — see §8.
10. **Deploy frontend** — push to dev + main; app reads/writes via normalized tables; `user_finance` is no longer written to but still exists.
11. **Verification window** — 2–7 days watching for errors.
12. **Drop phase** — drop `user_finance`, the old empty scaffold tables (`profiles` old, `user_profiles`, `settings`, `monthly_budgets`, `liquid_savings`, `investments`, `transactions`, old `subscriptions`, `notifications_insights`), and the `backups_20260416` schema.

---

## 8. Frontend rewrite scope

Current persistence: `useFinanceStore` → `syncFinanceToSupabase()` → `user_finance.upsert({ user_id, payload })`.

New persistence:

- **One hook per aggregate** — `useRemoteProfile`, `useRemoteSettings`, `useRemoteOnboardingState`, `useRemoteIncomeSources`, `useRemotePaymentMethods`, `useRemoteExpenses`, `useRemoteSubscriptions`, `useRemoteGoals`, `useRemoteDebts`, `useRemoteDebtPayments`, `useRemoteSavings`, `useRemoteBudgetPlans`, `useRemoteRecurring*`.
- **Each hook:** loads on mount via a targeted `supabase.from('T').select(...).eq('user_id', uid)`. Writes via table-specific actions (`addExpense`, `updateExpense`, etc.).
- **Zustand store** keeps its existing shape as the in-memory cache — only the persistence layer changes. No component rewrites.
- **Dashboard + list pages** stop pulling the entire blob on mount. Each page loads only the tables it needs (e.g. `/expenses` does `expenses.select()` + `payment_methods.select()`, not 19 arrays).

Estimated touch:
- ~2 new files per aggregate × ~15 aggregates ≈ **30 new hook files**
- `syncFinanceToSupabase.ts` → replaced with a thin dispatcher
- `useFinanceStore.ts` → unchanged shape; remove the single-blob serialize/hydrate code
- Types from Supabase regenerated into `src/lib/supabase/database.types.ts`

---

## 9. Rollback plan

**Pre-frontend-deploy rollback** (still in DB-migration phase):
- `DROP SCHEMA public CASCADE;` is too broad. Instead: drop the new tables + enums + functions, then `CREATE TABLE public.user_finance AS TABLE backups_20260416.user_finance`. Data is back in seconds.

**Post-frontend-deploy rollback** (app is writing to new tables):
- `git revert` the frontend commits on `dev` and `main`; the Zustand store persists to `user_finance` again.
- New-table writes from the rollout window are preserved in the new tables; re-serialize them back into `user_finance.payload` via a reverse backfill function if needed.

**Nuclear option:**
- Truncate the new tables, `INSERT INTO public.user_finance SELECT * FROM backups_20260416.user_finance` — app is back to pre-migration state.

---

## 10. Risks and mitigations

- **Advisor `function_search_path_mutable`** — fixed by `SET search_path = public` on every function we create/replace.
- **Backfill edge cases** — some payloads (see `ca8cdb66…` user, 451 KB; `2443ecf5…`, 1.27 MB) are large and may contain legacy shapes that don't match the current store types. The backfill function uses `coalesce` + `jsonb_path_exists` guards and logs skipped records to a `backfill_issues` table for manual review.
- **Auth middleware** — `user_profiles.onboarding_completed` is read by `src/middleware.ts`. Renamed/moved into new `profiles.onboarding_completed`; middleware query updated in the frontend rewrite commit.
- **TypeScript drift** — regenerating types mid-migration could leave the build broken; we regenerate only after all new tables exist + backfill succeeds.
- **Zero-downtime** — since `user_finance` stays intact during the migration, deploying the new frontend is a single atomic commit. If anything goes wrong, `git revert` gives you the old app back.
- **Large JSONB rows** — one user has 1.27 MB of state. Backfill runs inside a single transaction per user to keep things atomic.

---

## 11. Scope estimate

| Workstream | Size |
|------------|------|
| DB DDL (schema + enums + policies + indexes + triggers) | ~600 lines SQL |
| Backfill function | ~300 lines SQL |
| Frontend: new hooks | ~30 files, ~1 500 lines TS |
| Frontend: sync layer rewrite | ~5 files, ~400 lines TS |
| Frontend: type regen | auto-generated |
| Total | One large commit per phase, ~4 phases over 1–2 days |

---

## 12. What I need from you to proceed

Just the word **go** (or any specific overrides). On `go`:

1. I take the in-DB snapshot backup (schema `backups_20260416`).
2. I write the DDL + backfill to `supabase/migrations/0001_normalized_schema.sql` + `0002_backfill.sql`.
3. I apply them to production.
4. I regenerate TS types.
5. I rewrite the frontend sync layer.
6. I push to `dev` and auto-merge to `main` per your workflow rules.
7. I close out with SHAs + a verification checklist.

If anything in §2–§10 looks wrong or you want to trim scope (e.g. skip the frontend rewrite for now, or keep `user_finance` as dual-write rather than rollback-only), say so before `go`.
