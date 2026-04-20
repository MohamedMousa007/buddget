-- Part of the database audit follow-up (DB-1 + DB-8 in the audit report).
--
-- Every user-owned RLS policy currently re-evaluates `auth.uid()` per row
-- (92 warnings from the performance advisor) and targets the `public`
-- role (40 "anonymous access" warnings from the security advisor, even
-- though anonymous sign-ins are disabled at the auth layer).
--
-- This migration rewrites each policy to:
--   1. Wrap `auth.uid()` with `(SELECT auth.uid())` so Postgres treats
--      it as a stable initplan — one evaluation per query instead of
--      per row. Official Supabase-recommended pattern.
--   2. Switch `TO public` → `TO authenticated` so defence-in-depth
--      matches the auth settings.
--
-- Also fixes a latent bug on `user_finance_update_own`: it had `USING`
-- but no `WITH CHECK`, so a user could have flipped a row's `user_id`
-- to another user's id. The table is being retired in a later pass but
-- this closes the gap while we're already touching it.
--
-- Skipped intentionally:
--   - `live_market_data_select_authenticated` — already `authenticated`,
--     qual is `true` (public ticker data, no `auth.uid()` to wrap).
--   - `onboarding_survey_select_published` — table is being retired,
--     qual is `published = true` with no `auth.uid()`.

-- ── app_analytics_events ─────────────────────────────────────────────
DROP POLICY IF EXISTS analytics_insert_own ON public.app_analytics_events;
CREATE POLICY analytics_insert_own ON public.app_analytics_events
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ── budget_categories ────────────────────────────────────────────────
DROP POLICY IF EXISTS budget_categories_select_own ON public.budget_categories;
DROP POLICY IF EXISTS budget_categories_insert_own ON public.budget_categories;
DROP POLICY IF EXISTS budget_categories_update_own ON public.budget_categories;
DROP POLICY IF EXISTS budget_categories_delete_own ON public.budget_categories;
CREATE POLICY budget_categories_select_own ON public.budget_categories
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY budget_categories_insert_own ON public.budget_categories
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY budget_categories_update_own ON public.budget_categories
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY budget_categories_delete_own ON public.budget_categories
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- ── budget_plans ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS budget_plans_select_own ON public.budget_plans;
DROP POLICY IF EXISTS budget_plans_insert_own ON public.budget_plans;
DROP POLICY IF EXISTS budget_plans_update_own ON public.budget_plans;
DROP POLICY IF EXISTS budget_plans_delete_own ON public.budget_plans;
CREATE POLICY budget_plans_select_own ON public.budget_plans
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY budget_plans_insert_own ON public.budget_plans
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY budget_plans_update_own ON public.budget_plans
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY budget_plans_delete_own ON public.budget_plans
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- ── budget_subcategories ─────────────────────────────────────────────
DROP POLICY IF EXISTS budget_subcategories_select_own ON public.budget_subcategories;
DROP POLICY IF EXISTS budget_subcategories_insert_own ON public.budget_subcategories;
DROP POLICY IF EXISTS budget_subcategories_update_own ON public.budget_subcategories;
DROP POLICY IF EXISTS budget_subcategories_delete_own ON public.budget_subcategories;
CREATE POLICY budget_subcategories_select_own ON public.budget_subcategories
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY budget_subcategories_insert_own ON public.budget_subcategories
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY budget_subcategories_update_own ON public.budget_subcategories
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY budget_subcategories_delete_own ON public.budget_subcategories
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- ── debt_payments ────────────────────────────────────────────────────
DROP POLICY IF EXISTS debt_payments_select_own ON public.debt_payments;
DROP POLICY IF EXISTS debt_payments_insert_own ON public.debt_payments;
DROP POLICY IF EXISTS debt_payments_update_own ON public.debt_payments;
DROP POLICY IF EXISTS debt_payments_delete_own ON public.debt_payments;
CREATE POLICY debt_payments_select_own ON public.debt_payments
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY debt_payments_insert_own ON public.debt_payments
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY debt_payments_update_own ON public.debt_payments
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY debt_payments_delete_own ON public.debt_payments
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- ── debts ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS debts_select_own ON public.debts;
DROP POLICY IF EXISTS debts_insert_own ON public.debts;
DROP POLICY IF EXISTS debts_update_own ON public.debts;
DROP POLICY IF EXISTS debts_delete_own ON public.debts;
CREATE POLICY debts_select_own ON public.debts
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY debts_insert_own ON public.debts
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY debts_update_own ON public.debts
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY debts_delete_own ON public.debts
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- ── expenses ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS expenses_select_own ON public.expenses;
DROP POLICY IF EXISTS expenses_insert_own ON public.expenses;
DROP POLICY IF EXISTS expenses_update_own ON public.expenses;
DROP POLICY IF EXISTS expenses_delete_own ON public.expenses;
CREATE POLICY expenses_select_own ON public.expenses
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY expenses_insert_own ON public.expenses
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY expenses_update_own ON public.expenses
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY expenses_delete_own ON public.expenses
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- ── goals ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS goals_select_own ON public.goals;
DROP POLICY IF EXISTS goals_insert_own ON public.goals;
DROP POLICY IF EXISTS goals_update_own ON public.goals;
DROP POLICY IF EXISTS goals_delete_own ON public.goals;
CREATE POLICY goals_select_own ON public.goals
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY goals_insert_own ON public.goals
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY goals_update_own ON public.goals
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY goals_delete_own ON public.goals
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- ── income_sources ───────────────────────────────────────────────────
DROP POLICY IF EXISTS income_sources_select_own ON public.income_sources;
DROP POLICY IF EXISTS income_sources_insert_own ON public.income_sources;
DROP POLICY IF EXISTS income_sources_update_own ON public.income_sources;
DROP POLICY IF EXISTS income_sources_delete_own ON public.income_sources;
CREATE POLICY income_sources_select_own ON public.income_sources
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY income_sources_insert_own ON public.income_sources
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY income_sources_update_own ON public.income_sources
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY income_sources_delete_own ON public.income_sources
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- ── notifications ────────────────────────────────────────────────────
DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
DROP POLICY IF EXISTS notifications_insert_own ON public.notifications;
DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
DROP POLICY IF EXISTS notifications_delete_own ON public.notifications;
CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY notifications_insert_own ON public.notifications
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY notifications_delete_own ON public.notifications
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- ── onboarding_state ─────────────────────────────────────────────────
DROP POLICY IF EXISTS onboarding_state_select_own ON public.onboarding_state;
DROP POLICY IF EXISTS onboarding_state_insert_own ON public.onboarding_state;
DROP POLICY IF EXISTS onboarding_state_update_own ON public.onboarding_state;
DROP POLICY IF EXISTS onboarding_state_delete_own ON public.onboarding_state;
CREATE POLICY onboarding_state_select_own ON public.onboarding_state
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY onboarding_state_insert_own ON public.onboarding_state
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY onboarding_state_update_own ON public.onboarding_state
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY onboarding_state_delete_own ON public.onboarding_state
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- ── payment_methods ──────────────────────────────────────────────────
DROP POLICY IF EXISTS payment_methods_select_own ON public.payment_methods;
DROP POLICY IF EXISTS payment_methods_insert_own ON public.payment_methods;
DROP POLICY IF EXISTS payment_methods_update_own ON public.payment_methods;
DROP POLICY IF EXISTS payment_methods_delete_own ON public.payment_methods;
CREATE POLICY payment_methods_select_own ON public.payment_methods
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY payment_methods_insert_own ON public.payment_methods
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY payment_methods_update_own ON public.payment_methods
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY payment_methods_delete_own ON public.payment_methods
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- ── profiles (NOTE: uses `id` column, not `user_id`) ─────────────────
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
DROP POLICY IF EXISTS profiles_delete_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = id);
CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = id);
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);
CREATE POLICY profiles_delete_own ON public.profiles
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = id);

-- ── recurring_debt_payments ──────────────────────────────────────────
DROP POLICY IF EXISTS rdp_select_own ON public.recurring_debt_payments;
DROP POLICY IF EXISTS rdp_insert_own ON public.recurring_debt_payments;
DROP POLICY IF EXISTS rdp_update_own ON public.recurring_debt_payments;
DROP POLICY IF EXISTS rdp_delete_own ON public.recurring_debt_payments;
CREATE POLICY rdp_select_own ON public.recurring_debt_payments
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY rdp_insert_own ON public.recurring_debt_payments
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY rdp_update_own ON public.recurring_debt_payments
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY rdp_delete_own ON public.recurring_debt_payments
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- ── recurring_expenses ───────────────────────────────────────────────
DROP POLICY IF EXISTS recurring_expenses_select_own ON public.recurring_expenses;
DROP POLICY IF EXISTS recurring_expenses_insert_own ON public.recurring_expenses;
DROP POLICY IF EXISTS recurring_expenses_update_own ON public.recurring_expenses;
DROP POLICY IF EXISTS recurring_expenses_delete_own ON public.recurring_expenses;
CREATE POLICY recurring_expenses_select_own ON public.recurring_expenses
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY recurring_expenses_insert_own ON public.recurring_expenses
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY recurring_expenses_update_own ON public.recurring_expenses
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY recurring_expenses_delete_own ON public.recurring_expenses
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- ── recurring_savings_deposits ───────────────────────────────────────
DROP POLICY IF EXISTS rsd_select_own ON public.recurring_savings_deposits;
DROP POLICY IF EXISTS rsd_insert_own ON public.recurring_savings_deposits;
DROP POLICY IF EXISTS rsd_update_own ON public.recurring_savings_deposits;
DROP POLICY IF EXISTS rsd_delete_own ON public.recurring_savings_deposits;
CREATE POLICY rsd_select_own ON public.recurring_savings_deposits
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY rsd_insert_own ON public.recurring_savings_deposits
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY rsd_update_own ON public.recurring_savings_deposits
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY rsd_delete_own ON public.recurring_savings_deposits
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- ── savings_accounts ─────────────────────────────────────────────────
DROP POLICY IF EXISTS savings_accounts_select_own ON public.savings_accounts;
DROP POLICY IF EXISTS savings_accounts_insert_own ON public.savings_accounts;
DROP POLICY IF EXISTS savings_accounts_update_own ON public.savings_accounts;
DROP POLICY IF EXISTS savings_accounts_delete_own ON public.savings_accounts;
CREATE POLICY savings_accounts_select_own ON public.savings_accounts
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY savings_accounts_insert_own ON public.savings_accounts
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY savings_accounts_update_own ON public.savings_accounts
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY savings_accounts_delete_own ON public.savings_accounts
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- ── savings_holdings ─────────────────────────────────────────────────
DROP POLICY IF EXISTS savings_holdings_select_own ON public.savings_holdings;
DROP POLICY IF EXISTS savings_holdings_insert_own ON public.savings_holdings;
DROP POLICY IF EXISTS savings_holdings_update_own ON public.savings_holdings;
DROP POLICY IF EXISTS savings_holdings_delete_own ON public.savings_holdings;
CREATE POLICY savings_holdings_select_own ON public.savings_holdings
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY savings_holdings_insert_own ON public.savings_holdings
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY savings_holdings_update_own ON public.savings_holdings
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY savings_holdings_delete_own ON public.savings_holdings
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- ── savings_transactions ─────────────────────────────────────────────
DROP POLICY IF EXISTS savings_transactions_select_own ON public.savings_transactions;
DROP POLICY IF EXISTS savings_transactions_insert_own ON public.savings_transactions;
DROP POLICY IF EXISTS savings_transactions_update_own ON public.savings_transactions;
DROP POLICY IF EXISTS savings_transactions_delete_own ON public.savings_transactions;
CREATE POLICY savings_transactions_select_own ON public.savings_transactions
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY savings_transactions_insert_own ON public.savings_transactions
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY savings_transactions_update_own ON public.savings_transactions
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY savings_transactions_delete_own ON public.savings_transactions
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- ── subscriptions ────────────────────────────────────────────────────
DROP POLICY IF EXISTS subscriptions_select_own ON public.subscriptions;
DROP POLICY IF EXISTS subscriptions_insert_own ON public.subscriptions;
DROP POLICY IF EXISTS subscriptions_update_own ON public.subscriptions;
DROP POLICY IF EXISTS subscriptions_delete_own ON public.subscriptions;
CREATE POLICY subscriptions_select_own ON public.subscriptions
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY subscriptions_insert_own ON public.subscriptions
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY subscriptions_update_own ON public.subscriptions
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY subscriptions_delete_own ON public.subscriptions
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- ── trusted_devices (already `authenticated`, only wrap auth.uid()) ──
DROP POLICY IF EXISTS trusted_devices_self_select ON public.trusted_devices;
DROP POLICY IF EXISTS trusted_devices_self_insert ON public.trusted_devices;
DROP POLICY IF EXISTS trusted_devices_self_update ON public.trusted_devices;
DROP POLICY IF EXISTS trusted_devices_self_delete ON public.trusted_devices;
CREATE POLICY trusted_devices_self_select ON public.trusted_devices
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY trusted_devices_self_insert ON public.trusted_devices
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY trusted_devices_self_update ON public.trusted_devices
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY trusted_devices_self_delete ON public.trusted_devices
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

-- ── user_finance (being retired, but tighten while we're here) ───────
DROP POLICY IF EXISTS user_finance_select_own ON public.user_finance;
DROP POLICY IF EXISTS user_finance_insert_own ON public.user_finance;
DROP POLICY IF EXISTS user_finance_update_own ON public.user_finance;
DROP POLICY IF EXISTS user_finance_delete_own ON public.user_finance;
CREATE POLICY user_finance_select_own ON public.user_finance
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY user_finance_insert_own ON public.user_finance
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY user_finance_update_own ON public.user_finance
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY user_finance_delete_own ON public.user_finance
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- ── user_profiles (stub table, kept for now; being retired later) ────
DROP POLICY IF EXISTS user_profiles_select_own ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_insert_own ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_update_own ON public.user_profiles;
CREATE POLICY user_profiles_select_own ON public.user_profiles
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY user_profiles_insert_own ON public.user_profiles
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY user_profiles_update_own ON public.user_profiles
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ── user_settings ────────────────────────────────────────────────────
DROP POLICY IF EXISTS user_settings_select_own ON public.user_settings;
DROP POLICY IF EXISTS user_settings_insert_own ON public.user_settings;
DROP POLICY IF EXISTS user_settings_update_own ON public.user_settings;
DROP POLICY IF EXISTS user_settings_delete_own ON public.user_settings;
CREATE POLICY user_settings_select_own ON public.user_settings
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY user_settings_insert_own ON public.user_settings
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY user_settings_update_own ON public.user_settings
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY user_settings_delete_own ON public.user_settings
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);
