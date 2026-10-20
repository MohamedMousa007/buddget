-- Delta sync (scaling plan phase 2): one request returns everything that changed for the signed-in user since a cursor.
--  * No cursor: the live rows (what the old 22 queries returned), in one round trip.
--  * With a cursor: rows changed since it (a 2-minute overlap covers transactions that commit late), tombstones included,
--    so deletions on one device reach the others.
--  * Budget plans, categories, sub-categories and activations are small and nested, so they return whole (live rows) plus
--    the ids of plans deleted since the cursor.
-- SECURITY INVOKER: row level security applies, and every query is also filtered by auth.uid().
-- No index on updated_at on purpose: it changes on every update and would stop updates from being HOT.

CREATE OR REPLACE FUNCTION public.sync_table_delta(p_table text, p_win timestamptz) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path = public, pg_temp AS $$
DECLARE r jsonb;
BEGIN
  IF p_table <> ALL (ARRAY[
    'payment_methods','income_sources','income_events','expenses','receipts','recurring_expenses','subscriptions','debts',
    'debt_payments','recurring_debt_payments','savings_accounts','savings_holdings','savings_transactions',
    'recurring_savings_deposits','goals','buddgy_memories'
  ]) THEN RAISE EXCEPTION 'table not synced: %', p_table; END IF;
  EXECUTE format(
    'SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM public.%I t WHERE t.user_id = (SELECT auth.uid()) AND %s',
    p_table,
    CASE WHEN p_win IS NULL THEN 't.deleted_at IS NULL' ELSE format('t.updated_at > %L', p_win) END
  ) INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.sync_table_delta(text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_table_delta(text, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_pull(p_since timestamptz DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path = public, pg_temp AS $$
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
    'recurring_savings_deposits','goals','buddgy_memories'
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
    'budget_plan_activations', COALESCE((SELECT jsonb_agg(to_jsonb(a)) FROM budget_plan_activations a WHERE a.user_id = uid AND a.deleted_at IS NULL), '[]'::jsonb)
  );
END $$;
REVOKE ALL ON FUNCTION public.sync_pull(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_pull(timestamptz) TO authenticated;
