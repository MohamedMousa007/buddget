-- SYN9: sync_pull returned only live budget_plan_activations, so an activation tombstoned on another device
-- lingered locally. It now also returns the deleted activation ids changed since the window, like budget_plans_deleted.
-- Every other output is unchanged (definition read from the live function before editing).
CREATE OR REPLACE FUNCTION public.sync_pull(p_since timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  uid uuid := (SELECT auth.uid());
  win timestamptz := CASE WHEN p_since IS NULL THEN NULL ELSE p_since - interval '2 minutes' END;
  t text;
  lists jsonb := '{}'::jsonb;
BEGIN
  IF uid IS NULL THEN RETURN NULL; END IF;
  FOREACH t IN ARRAY ARRAY[
    'payment_methods','income_sources','income_events','expenses','receipts','recurring_expenses','subscriptions','debts',
    'debt_payments','recurring_debt_payments','savings_accounts','savings_holdings','savings_transactions',
    'recurring_savings_deposits','goals','buddgy_memories','account_adjustments'
  ] LOOP
    lists := lists || jsonb_build_object(t, sync_table_delta(t, win));
  END LOOP;

  RETURN jsonb_build_object(
    'cursor', now(),
    'profile', (SELECT to_jsonb(p) FROM profiles p WHERE p.id = uid AND (win IS NULL OR p.updated_at > win)),
    'settings', (SELECT to_jsonb(s) FROM user_settings s WHERE s.user_id = uid AND (win IS NULL OR s.updated_at > win)),
    'has_profile', EXISTS (SELECT 1 FROM profiles p WHERE p.id = uid),
    'lists', lists,
    'budget_plans', COALESCE((SELECT jsonb_agg(to_jsonb(b)) FROM budget_plans b WHERE b.user_id = uid AND b.deleted_at IS NULL), '[]'::jsonb),
    'budget_plans_deleted', CASE WHEN win IS NULL THEN '[]'::jsonb
      ELSE COALESCE((SELECT jsonb_agg(b.id) FROM budget_plans b WHERE b.user_id = uid AND b.deleted_at IS NOT NULL AND b.updated_at > win), '[]'::jsonb) END,
    'budget_categories', COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM budget_categories c WHERE c.user_id = uid AND c.deleted_at IS NULL), '[]'::jsonb),
    'budget_subcategories', COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM budget_subcategories s WHERE s.user_id = uid AND s.deleted_at IS NULL), '[]'::jsonb),
    'budget_plan_activations', COALESCE((SELECT jsonb_agg(to_jsonb(a)) FROM budget_plan_activations a WHERE a.user_id = uid AND a.deleted_at IS NULL), '[]'::jsonb),
    'budget_plan_activations_deleted', CASE WHEN win IS NULL THEN '[]'::jsonb
      ELSE COALESCE((SELECT jsonb_agg(a.id) FROM budget_plan_activations a WHERE a.user_id = uid AND a.deleted_at IS NOT NULL AND a.updated_at > win), '[]'::jsonb) END
  );
END $function$;
