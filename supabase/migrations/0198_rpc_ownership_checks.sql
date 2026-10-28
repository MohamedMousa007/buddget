-- B1/P2b Q6: tenant checks on uuids carried inside jsonb arguments of the SECURITY DEFINER composite RPCs.
-- Signatures are UNCHANGED (CREATE OR REPLACE, same argument lists): installed app builds keep working and no
-- PostgREST overload is created. Behaviour only changes for a caller sending ANOTHER user's uuid (previously the
-- FK accepted it because definer functions bypass RLS). Own ids, null/empty ids and all outputs are identical.
-- Bodies are the live definitions (pg_get_functiondef 2026-10-27) plus the PERFORM assert lines marked "Q6".
--
-- AUDIT BEFORE APPLY (SELECT only). Rows this migration updates: ZERO (functions only). Cross-tenant references
-- that already exist (expect 0 each; any hit is a pre-existing leak to inspect, not something this file changes):
--   select count(*) from debt_payments p join payment_methods m on m.id = p.payment_method_id where m.user_id <> p.user_id;
--   select count(*) from expenses e join payment_methods m on m.id = e.payment_method_id where m.user_id <> e.user_id;
--   select count(*) from subscriptions s join payment_methods m on m.id = s.payment_method_id where m.user_id <> s.user_id;
--   select count(*) from recurring_expenses r join payment_methods m on m.id = r.payment_method_id where m.user_id <> r.user_id;
--   select count(*) from income_sources i join payment_methods m on m.id = i.payment_method_id where m.user_id <> i.user_id;
--   select count(*) from debts d join debts c on c.id = d.linked_credit_card_debt_id where c.user_id <> d.user_id;

-- Internal helpers: not callable from the API (no grants), invoked only inside the definer functions below.
CREATE OR REPLACE FUNCTION public.assert_payment_method_owned(p_pm uuid, p_user uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF p_pm IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.payment_methods WHERE id = p_pm AND user_id = p_user) THEN
    RAISE EXCEPTION 'payment method not found or not owned by caller';
  END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.assert_debt_owned(p_debt uuid, p_user uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF p_debt IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.debts WHERE id = p_debt AND user_id = p_user) THEN
    RAISE EXCEPTION 'debt not found or not owned by caller';
  END IF;
END $function$;

REVOKE ALL ON FUNCTION public.assert_payment_method_owned(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_debt_owned(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.add_debt_payment_with_expense(p_payment jsonb, p_expense jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_pay_id uuid := COALESCE((p_payment ->> 'id')::uuid, gen_random_uuid());
  v_exp_id uuid := COALESCE((p_expense ->> 'id')::uuid, gen_random_uuid());
  v_debt_id uuid := (p_payment ->> 'debt_id')::uuid;
  v_debt public.debts;
BEGIN
  SELECT * INTO v_debt FROM public.debts WHERE id = v_debt_id;
  IF v_debt IS NULL OR v_debt.user_id <> v_user THEN
    RAISE EXCEPTION 'Debt not found or not owned by caller';
  END IF;
  PERFORM public.assert_payment_method_owned(NULLIF(p_payment ->> 'payment_method_id','')::uuid, v_user); -- Q6
  PERFORM public.assert_payment_method_owned(NULLIF(p_expense ->> 'payment_method_id','')::uuid, v_user); -- Q6

  INSERT INTO public.debt_payments (
    id, user_id, debt_id, payment_method_id, amount, currency, payment_date, notes
  ) VALUES (
    v_pay_id, v_user, v_debt_id,
    NULLIF(p_payment ->> 'payment_method_id','')::uuid,
    (p_payment ->> 'amount')::numeric,
    (p_payment ->> 'currency')::public.currency_code,
    COALESCE((p_payment ->> 'payment_date')::date, CURRENT_DATE),
    p_payment ->> 'notes'
  );

  INSERT INTO public.expenses (
    id, user_id, description, category, amount, currency, expense_date,
    payment_method_id, linked_debt_payment_id, is_debt_payment, notes
  ) VALUES (
    v_exp_id, v_user,
    COALESCE(p_expense ->> 'description', 'Debt payment: ' || v_debt.name),
    'Debt'::public.expense_category,
    (p_expense ->> 'amount')::numeric,
    (p_expense ->> 'currency')::public.currency_code,
    COALESCE((p_expense ->> 'expense_date')::date, CURRENT_DATE),
    NULLIF(p_expense ->> 'payment_method_id','')::uuid,
    v_pay_id,
    true,
    p_expense ->> 'notes'
  );

  RETURN jsonb_build_object('debt_payment_id', v_pay_id, 'expense_id', v_exp_id);
END $function$;

CREATE OR REPLACE FUNCTION public.add_income_with_debt(p_income jsonb, p_debt jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_income_id uuid := COALESCE((p_income ->> 'id')::uuid, gen_random_uuid());
  v_debt_id uuid := COALESCE((p_debt ->> 'id')::uuid, gen_random_uuid());
BEGIN
  PERFORM public.assert_payment_method_owned(NULLIF(p_income ->> 'payment_method_id','')::uuid, v_user); -- Q6
  PERFORM public.assert_debt_owned(NULLIF(p_debt ->> 'linked_credit_card_debt_id','')::uuid, v_user); -- Q6

  INSERT INTO public.debts (
    id, user_id, name, description, debt_type, direction,
    amount, currency, starting_balance, interest_free,
    person, relationship, creditor,
    installment_count, installment_frequency, installment_start_date,
    installment_provider, linked_credit_card_debt_id,
    received_via, gold_karat, is_gold, notes
  ) VALUES (
    v_debt_id, v_user,
    p_debt ->> 'name',
    p_debt ->> 'description',
    COALESCE(p_debt ->> 'debt_type', 'personal')::public.debt_kind,
    COALESCE(p_debt ->> 'direction', 'i_owe')::public.debt_direction,
    (p_debt ->> 'amount')::numeric,
    (p_debt ->> 'currency')::public.currency_code,
    NULLIF(p_debt ->> 'starting_balance','')::numeric,
    COALESCE((p_debt ->> 'interest_free')::boolean, true),
    p_debt ->> 'person',
    p_debt ->> 'relationship',
    p_debt ->> 'creditor',
    NULLIF(p_debt ->> 'installment_count','')::int,
    NULLIF(p_debt ->> 'installment_frequency','')::public.recurring_frequency,
    NULLIF(p_debt ->> 'installment_start_date','')::date,
    NULLIF(p_debt ->> 'installment_provider','')::public.installment_provider,
    NULLIF(p_debt ->> 'linked_credit_card_debt_id','')::uuid,
    NULLIF(p_debt ->> 'received_via','')::public.debt_received_via,
    NULLIF(p_debt ->> 'gold_karat','')::public.gold_karat,
    COALESCE((p_debt ->> 'is_gold')::boolean, false),
    p_debt ->> 'notes'
  );

  INSERT INTO public.income_sources (
    id, user_id, name, source_type, amount, currency,
    is_recurring, recurring_frequency, day_of_month, notes, payment_method_id
  ) VALUES (
    v_income_id, v_user,
    p_income ->> 'name',
    COALESCE(p_income ->> 'source_type', 'debt')::public.income_source_type,
    (p_income ->> 'amount')::numeric,
    (p_income ->> 'currency')::public.currency_code,
    COALESCE((p_income ->> 'is_recurring')::boolean, false),
    NULLIF(p_income ->> 'recurring_frequency','')::public.recurring_frequency,
    NULLIF(p_income ->> 'day_of_month','')::int,
    p_income ->> 'notes',
    NULLIF(p_income ->> 'payment_method_id','')::uuid
  );

  UPDATE public.user_settings SET no_income_declared = false WHERE user_id = v_user;

  RETURN jsonb_build_object('income_id', v_income_id, 'debt_id', v_debt_id);
END $function$;

CREATE OR REPLACE FUNCTION public.add_subscription_with_recurring_expense(p_subscription jsonb, p_recurring_expense jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_sub_id uuid := COALESCE((p_subscription ->> 'id')::uuid, gen_random_uuid());
  v_re_id uuid := COALESCE((p_recurring_expense ->> 'id')::uuid, gen_random_uuid());
BEGIN
  PERFORM public.assert_payment_method_owned(NULLIF(p_subscription ->> 'payment_method_id','')::uuid, v_user); -- Q6
  PERFORM public.assert_payment_method_owned(NULLIF(p_recurring_expense ->> 'payment_method_id','')::uuid, v_user); -- Q6

  -- Create the recurring expense first (needed for the subscription's linked_recurring_expense_id).
  INSERT INTO public.recurring_expenses (
    id, user_id, description, category, amount, currency, frequency, day_of_month,
    next_due_date, is_active, payment_method_id, linked_subscription_id, notes
  ) VALUES (
    v_re_id, v_user,
    p_recurring_expense ->> 'description',
    COALESCE(p_recurring_expense ->> 'category', 'Enjoyment')::public.expense_category,
    (p_recurring_expense ->> 'amount')::numeric,
    (p_recurring_expense ->> 'currency')::public.currency_code,
    COALESCE(p_recurring_expense ->> 'frequency', 'monthly')::public.recurring_frequency,
    NULLIF(p_recurring_expense ->> 'day_of_month','')::int,
    NULLIF(p_recurring_expense ->> 'next_due_date','')::date,
    COALESCE((p_recurring_expense ->> 'is_active')::boolean, true),
    NULLIF(p_recurring_expense ->> 'payment_method_id','')::uuid,
    v_sub_id,
    p_recurring_expense ->> 'notes'
  );

  INSERT INTO public.subscriptions (
    id, user_id, name, brand_key, plan_name, amount, currency,
    billing_cycle, billing_day, start_date, next_billing_date,
    payment_method_id, expense_category, linked_recurring_expense_id,
    status, notes
  ) VALUES (
    v_sub_id, v_user,
    p_subscription ->> 'name',
    p_subscription ->> 'brand_key',
    p_subscription ->> 'plan_name',
    (p_subscription ->> 'amount')::numeric,
    (p_subscription ->> 'currency')::public.currency_code,
    COALESCE(p_subscription ->> 'billing_cycle', 'monthly')::public.subscription_billing_cycle,
    COALESCE((p_subscription ->> 'billing_day')::int, 1),
    COALESCE((p_subscription ->> 'start_date')::date, CURRENT_DATE),
    NULLIF(p_subscription ->> 'next_billing_date','')::date,
    NULLIF(p_subscription ->> 'payment_method_id','')::uuid,
    COALESCE(p_subscription ->> 'expense_category', 'Enjoyment')::public.expense_category,
    v_re_id,
    COALESCE(p_subscription ->> 'status', 'active')::public.subscription_status,
    p_subscription ->> 'notes'
  );

  RETURN jsonb_build_object('subscription_id', v_sub_id, 'recurring_expense_id', v_re_id);
END $function$;

CREATE OR REPLACE FUNCTION public.update_subscription_and_re(p_subscription_id uuid, p_subscription_updates jsonb, p_recurring_expense_updates jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_sub public.subscriptions;
BEGIN
  SELECT * INTO v_sub FROM public.subscriptions WHERE id = p_subscription_id;
  IF v_sub IS NULL OR v_sub.user_id <> v_user THEN
    RAISE EXCEPTION 'Subscription not found or not owned by caller';
  END IF;
  PERFORM public.assert_payment_method_owned(NULLIF(p_subscription_updates ->> 'payment_method_id','')::uuid, v_user); -- Q6
  PERFORM public.assert_payment_method_owned(NULLIF(p_recurring_expense_updates ->> 'payment_method_id','')::uuid, v_user); -- Q6

  UPDATE public.subscriptions SET
    name = COALESCE(p_subscription_updates ->> 'name', name),
    brand_key = COALESCE(p_subscription_updates ->> 'brand_key', brand_key),
    plan_name = COALESCE(p_subscription_updates ->> 'plan_name', plan_name),
    amount = COALESCE((p_subscription_updates ->> 'amount')::numeric, amount),
    currency = COALESCE((p_subscription_updates ->> 'currency')::public.currency_code, currency),
    billing_cycle = COALESCE((p_subscription_updates ->> 'billing_cycle')::public.subscription_billing_cycle, billing_cycle),
    billing_day = COALESCE((p_subscription_updates ->> 'billing_day')::int, billing_day),
    start_date = COALESCE((p_subscription_updates ->> 'start_date')::date, start_date),
    next_billing_date = COALESCE(NULLIF(p_subscription_updates ->> 'next_billing_date','')::date, next_billing_date),
    payment_method_id = COALESCE(NULLIF(p_subscription_updates ->> 'payment_method_id','')::uuid, payment_method_id),
    expense_category = COALESCE((p_subscription_updates ->> 'expense_category')::public.expense_category, expense_category),
    notes = COALESCE(p_subscription_updates ->> 'notes', notes)
  WHERE id = p_subscription_id;

  IF v_sub.linked_recurring_expense_id IS NOT NULL THEN
    UPDATE public.recurring_expenses SET
      description = COALESCE(p_recurring_expense_updates ->> 'description', description),
      amount = COALESCE((p_recurring_expense_updates ->> 'amount')::numeric, amount),
      currency = COALESCE((p_recurring_expense_updates ->> 'currency')::public.currency_code, currency),
      day_of_month = COALESCE((p_recurring_expense_updates ->> 'day_of_month')::int, day_of_month),
      payment_method_id = COALESCE(NULLIF(p_recurring_expense_updates ->> 'payment_method_id','')::uuid, payment_method_id),
      category = COALESCE((p_recurring_expense_updates ->> 'category')::public.expense_category, category),
      notes = COALESCE(p_recurring_expense_updates ->> 'notes', notes)
    WHERE id = v_sub.linked_recurring_expense_id;
  END IF;
END $function$;
-- CREATE OR REPLACE keeps the existing ACL on these four (authenticated + service_role, no anon/public).
