# DB Migration log — 2026-04-16

Executed in the order below on project `ydihurtbcnoflhormgzi` (buddget prod).
All migrations recorded in `supabase.migrations.schema_migrations`.

| # | Migration | What it did |
|---|-----------|-------------|
| 0001 | `backup_snapshot_20260416` | Created `backups_20260416` schema; copied all 18 public tables structure + data. Instant-restore fallback. |
| 0002 | `drop_scaffolds_and_fix_triggers` | Dropped 13 empty scaffold tables (debts, debt_payments, financial_goals, investments, liquid_savings, monthly_budgets, notifications_insights, payment_methods, profiles, settings, subscriptions, income_sources, transactions). Dropped broken trigger fns `handle_balance_updates`, `update_payment_method_balance` (mutable search_path). |
| 0003 | `enums_and_helpers` | Created 22 enum types (currency_code, payment_method_type, income_source_type, debt_kind, subscription_status, savings_type, goal_category, expense_category, …). Created `public.set_updated_at()` trigger fn with locked search_path. |
| 0004 | `new_schema_part1_identity_and_primitives` | Created `profiles`, `user_settings`, `onboarding_state`, `payment_methods`, `income_sources` with RLS + policies + indexes + updated_at triggers. |
| 0005 | `new_schema_part2_budgets_expenses_debts` | Created `budget_plans`, `budget_categories`, `budget_subcategories`, `subscriptions`, `debts`, `debt_payments`, `recurring_debt_payments`, `expenses`, `recurring_expenses`. |
| 0006 | `new_schema_part3_goals_savings_notifications` | Created `goals`, `savings_accounts`, `savings_holdings`, `savings_transactions`, `recurring_savings_deposits`, `notifications`. |
| 0007 | `migrate_user_profiles_and_handle_new_user` | Migrated 16 `user_profiles` rows → new `profiles`. Rewrote `handle_new_user()` to seed `profiles` + `user_settings` + `onboarding_state` on auth.users insert. |
| 0008 | `backfill_function` | Enabled `uuid-ossp` extension (in `extensions` schema). Created `public.backfill_issues` log table + `public.stable_uuid(user_id, legacy_id)` deterministic UUID derivation. |
| 0009 | `backfill_from_user_finance_fn` | Created the big `public.backfill_from_user_finance(user_id)` SECURITY DEFINER function that unpacks one user's JSONB payload into all normalized tables. |
| 0010 | `extend_enums_for_backfill` | Added legacy values found in real data: `income_source_type.{bonus,savings}`, `savings_type.stablecoin`, `savings_transaction_kind.withdrawal`. |
| 0011 | `lock_down_backfill_issues_and_market_data` | Enabled RLS on `backfill_issues` (no policies → service-role only). Added `live_market_data_select_authenticated` policy. |

## Data migration results (100% reconciled)

| Entity | Expected (JSONB) | Actual (new tables) | Status |
|--------|------------------|---------------------|--------|
| profiles | 12 | 12 | ✓ |
| user_settings | 12 | 12 | ✓ |
| onboarding_state | 12 | 12 | ✓ |
| payment_methods | 18 | 18 | ✓ |
| income_sources | 20 | 20 | ✓ |
| expenses | 78 | 78 | ✓ |
| debts | 9 | 9 | ✓ |
| debt_payments | 6 | 6 | ✓ |
| subscriptions | 1 | 1 | ✓ |
| goals | 1 | 1 | ✓ |
| budget_plans | 10 | 10 | ✓ |
| budget_categories | (from plans) 27 | 27 | ✓ |
| savings_accounts | 11 | 11 | ✓ |
| savings_transactions | 25 | 25 | ✓ |
| savings_holdings | 2 | 2 | ✓ |
| recurring_expenses | 1 | 1 | ✓ |

`public.backfill_issues` is empty (0 rows).

## Security advisor — clean

Remaining warnings (both pre-existing, not introduced by this migration):
- `auth_leaked_password_protection` — feature opt-in; unrelated to schema.

## Rollback

Pre-frontend-cutover (now): `user_finance` is untouched; app still writes there. If needed, drop new tables + `backups_20260416`-less DDL and everything's back.

Instant data restore of any old table:
```sql
-- e.g. restore user_profiles:
TRUNCATE public.user_profiles;
INSERT INTO public.user_profiles SELECT * FROM backups_20260416.user_profiles;
```

## What's next (NOT yet done — see RESUME section)

- Frontend sync-layer rewrite (~30 new hook files, major refactor of `src/lib/supabase/syncFinanceToSupabase.ts`).
- Cut the app over from `user_finance.payload` reads/writes to normalized tables.
- Verification window (2–7 days watching for errors).
- Drop `user_finance`, `user_profiles` old, `backups_20260416`.

## Files now in the repo

- `src/lib/supabase/database.types.ts` — regenerated TypeScript types for the full new schema (1669 lines).
- `supabase/migrations/PLAN-normalized-schema.md` — original plan doc.
- `supabase/migrations/MIGRATION-LOG-20260416.md` — this log.
