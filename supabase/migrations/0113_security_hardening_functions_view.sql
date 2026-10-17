-- Security hardening that changes no app behaviour:
--  * every flagged function gets a fixed search_path (same schemas the role default already used);
--  * sms_parse_today stops running with its owner's rights and is no longer reachable via the public API
--    (only the server's service role reads it);
--  * RPCs are callable only by the roles that actually call them: server-only functions by service_role,
--    client RPCs by signed-in users (+ service_role). Trigger functions are untouched.

ALTER FUNCTION public.increment_sms_template_match_count(uuid) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.check_sms_promotion_eligibility() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.sms_mark_pushed(uuid, jsonb, boolean) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.sms_mark_acked(uuid, uuid) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.bump_sms_keyword(text, text) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.bump_sms_sender(text, boolean) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.learn_sms_sender_currency(uuid, text, currency_code, boolean) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.get_sms_keyword_pool(integer) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.touch_income_sources_updated_at() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.touch_income_events_updated_at() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.sms_try_pair(uuid, uuid, timestamp with time zone, integer, numeric, boolean, text[], numeric, text, text, boolean) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.bump_sms_template_failure(uuid, boolean, text) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.record_sms_template_shadow(uuid, boolean) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.record_sms_template_signal() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.sms_templates_awaiting_adjudication(integer) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.detect_zero_variance_templates(integer) SET search_path = public, extensions, pg_temp;

ALTER VIEW public.sms_parse_today SET (security_invoker = true);
REVOKE ALL ON public.sms_parse_today FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.sms_parse_today TO service_role;

-- Server-only RPCs (every caller uses the service-role client).
REVOKE EXECUTE ON FUNCTION public.increment_sms_template_match_count(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_sms_promotion_eligibility() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sms_mark_pushed(uuid, jsonb, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sms_mark_acked(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_sms_keyword(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_sms_sender(text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.learn_sms_sender_currency(uuid, text, currency_code, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sms_try_pair(uuid, uuid, timestamp with time zone, integer, numeric, boolean, text[], numeric, text, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_sms_template_failure(uuid, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_sms_template_shadow(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sms_templates_awaiting_adjudication(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.detect_zero_variance_templates(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_merchant_category(text, expense_category, text, text) FROM PUBLIC, anon, authenticated;

-- Client RPCs: signed-in users only (anonymous API callers have no business running them).
REVOKE EXECUTE ON FUNCTION public.deposit_to_savings(uuid, numeric, currency_code, text, date, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.withdraw_from_savings(uuid, numeric, currency_code, text, date, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.correct_savings_balance(uuid, numeric, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.add_subscription_with_recurring_expense(jsonb, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancel_subscription(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reactivate_subscription(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_subscription_and_re(uuid, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.add_income_with_debt(jsonb, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.add_debt_payment_with_expense(jsonb, jsonb) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.deposit_to_savings(uuid, numeric, currency_code, text, date, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.withdraw_from_savings(uuid, numeric, currency_code, text, date, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.correct_savings_balance(uuid, numeric, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.add_subscription_with_recurring_expense(jsonb, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_subscription(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reactivate_subscription(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_subscription_and_re(uuid, jsonb, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.add_income_with_debt(jsonb, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.add_debt_payment_with_expense(jsonb, jsonb) TO authenticated, service_role;
