-- 0205_b3_link_column_fks.sql  (QA round 2, B3/S1: Q9)
--
-- DEPLOY ORDER: RESTRICTIVE. Apply ONLY AFTER the sync tier reorder in src/lib/supabase/remote/sync.ts is deployed and
-- verified (income_sources -> level2, income_events and profiles -> level3; test: syncLinkTiers.test.ts). Before it,
-- a debt/pocket and the income source/event linked to it created in one flush would hit a foreign-key violation and
-- poison the whole level. Old installed builds still flush in the old order: a brand-new parent+child pair created
-- in the same flush by an old build fails once and is retried by the sync loop after the parent has landed.
-- Every FK is ON DELETE SET NULL so the 90-day tombstone purge in housekeeping() can never be blocked or rolled back
-- by a live child row (all columns are nullable, verified). NOT VALID then VALIDATE; idempotent.
--
-- Included (14 FKs): income_events.{payment_method_id, linked_debt_id, linked_savings_account_id, template_id},
--   income_sources.{linked_debt_id, linked_savings_account_id}, profiles.{active_budget_plan_id, default_carry_pocket_id},
--   savings_accounts.linked_payment_method_id, savings_month_summary.pocket_id,
--   sms_parse_log.{debt_payment_id, savings_transaction_id, paired_log_id, learn_template_id}.
-- Deliberately skipped, with reasons:
--   * subscriptions.linked_recurring_expense_id: recurring_expenses.linked_subscription_id already points back, a pair of
--     FKs makes a cycle that no sync tier order can satisfy.
--   * income_events.shared_plan_id, income_sources.shared_plan_id, profiles.active_shared_budget_id,
--     profiles.default_shared_budget_plan_id: no shared-plan table exists in the schema.
--   * expenses.sms_log_id, income_events.sms_log_id: pushed by the client, and sms_parse_log rows are purged/undone
--     server-side, so a stale local id would be re-sent on the next edit and fail the batch forever. The Q4/Q16 risk
--     (pointing at ANOTHER user's log) is closed by the ownership checks in 0202 instead.
--   * Composite (id, user_id) FKs for cross-tenant references: separate decision (needs unique indexes on 8 tables).
--
-- AUDIT BEFORE APPLY (SELECT only). Expected 0 orphans per column (measured 2026-10-28; the DO block asserts each):
--   select 'ie_pm', count(*) from public.income_events x where payment_method_id is not null and not exists (select 1 from public.payment_methods p where p.id = x.payment_method_id)
--   union all select 'ie_debt', count(*) from public.income_events x where linked_debt_id is not null and not exists (select 1 from public.debts p where p.id = x.linked_debt_id)
--   union all select 'ie_sav', count(*) from public.income_events x where linked_savings_account_id is not null and not exists (select 1 from public.savings_accounts p where p.id = x.linked_savings_account_id)
--   union all select 'ie_tpl', count(*) from public.income_events x where template_id is not null and not exists (select 1 from public.income_sources p where p.id = x.template_id)
--   -- ... same shape for the other 10 columns; the DO block below runs all 14.
--   -- Reported, NOT changed here: 1 income_event whose template_id belongs to ANOTHER user's income source (cross tenant):
--   select x.id, x.user_id, p.user_id as source_owner from public.income_events x join public.income_sources p on p.id = x.template_id where p.user_id <> x.user_id;
--   -- nullable check (expect 14 rows, all YES):
--   select table_name, column_name, is_nullable from information_schema.columns where table_schema = 'public' and
--     (table_name, column_name) in (('income_events','payment_method_id'),('income_events','linked_debt_id'),('income_events','linked_savings_account_id'),('income_events','template_id'),
--      ('income_sources','linked_debt_id'),('income_sources','linked_savings_account_id'),('profiles','active_budget_plan_id'),('profiles','default_carry_pocket_id'),
--      ('savings_accounts','linked_payment_method_id'),('savings_month_summary','pocket_id'),('sms_parse_log','debt_payment_id'),('sms_parse_log','savings_transaction_id'),
--      ('sms_parse_log','paired_log_id'),('sms_parse_log','learn_template_id'));

DO $$
DECLARE
  specs text[][] := ARRAY[
    ['income_events',        'payment_method_id',         'payment_methods',          'income_events_payment_method_id_fkey'],
    ['income_events',        'linked_debt_id',            'debts',                    'income_events_linked_debt_id_fkey'],
    ['income_events',        'linked_savings_account_id', 'savings_accounts',         'income_events_linked_savings_account_id_fkey'],
    ['income_events',        'template_id',               'income_sources',           'income_events_template_id_fkey'],
    ['income_sources',       'linked_debt_id',            'debts',                    'income_sources_linked_debt_id_fkey'],
    ['income_sources',       'linked_savings_account_id', 'savings_accounts',         'income_sources_linked_savings_account_id_fkey'],
    ['profiles',             'active_budget_plan_id',     'budget_plans',             'profiles_active_budget_plan_id_fkey'],
    ['profiles',             'default_carry_pocket_id',   'savings_accounts',         'profiles_default_carry_pocket_id_fkey'],
    ['savings_accounts',     'linked_payment_method_id',  'payment_methods',          'savings_accounts_linked_payment_method_id_fkey'],
    ['savings_month_summary','pocket_id',                 'savings_accounts',         'savings_month_summary_pocket_id_fkey'],
    ['sms_parse_log',        'debt_payment_id',           'debt_payments',            'sms_parse_log_debt_payment_id_fkey'],
    ['sms_parse_log',        'savings_transaction_id',    'savings_transactions',     'sms_parse_log_savings_transaction_id_fkey'],
    ['sms_parse_log',        'paired_log_id',             'sms_parse_log',            'sms_parse_log_paired_log_id_fkey'],
    ['sms_parse_log',        'learn_template_id',         'sms_tracking_templates_ai','sms_parse_log_learn_template_id_fkey']
  ];
  i int;
  n bigint;
BEGIN
  -- 1. assert zero orphans for all 14 before adding anything
  FOR i IN 1 .. array_length(specs, 1) LOOP
    EXECUTE format('SELECT count(*) FROM public.%I x WHERE x.%I IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.%I p WHERE p.id = x.%I)',
                   specs[i][1], specs[i][2], specs[i][3], specs[i][2]) INTO n;
    IF n > 0 THEN
      RAISE EXCEPTION '0205: % orphan values in %.% -> %; fix or null them first', n, specs[i][1], specs[i][2], specs[i][3];
    END IF;
  END LOOP;
  -- 2. add each FK once (NOT VALID), then validate
  FOR i IN 1 .. array_length(specs, 1) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = specs[i][4] AND conrelid = ('public.' || specs[i][1])::regclass) THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.%I (id) ON DELETE SET NULL NOT VALID',
                     specs[i][1], specs[i][4], specs[i][2], specs[i][3]);
    END IF;
    EXECUTE format('ALTER TABLE public.%I VALIDATE CONSTRAINT %I', specs[i][1], specs[i][4]);
  END LOOP;
END $$;

-- POST-APPLY CHECKS (expect): 14 rows, convalidated = true, confdeltype = 'n' (SET NULL)
--   select conrelid::regclass, conname, convalidated, confdeltype from pg_constraint where conname like any
--     (array['income_events\_%\_fkey','income_sources\_linked\_%\_fkey','profiles\_%\_fkey','savings_accounts\_linked\_%\_fkey','savings_month_summary\_pocket\_id\_fkey','sms_parse_log\_%\_fkey'])
--     and contype = 'f' and confdeltype = 'n';
--   Smoke: create a debt + a payday income source linked to it + an income event from that source in one offline session, reconnect;
--   delete the debt, wait for housekeeping or hard-delete in a transaction: children keep their rows with the link nulled.
-- ROLLBACK: alter table public.<t> drop constraint <name>;
