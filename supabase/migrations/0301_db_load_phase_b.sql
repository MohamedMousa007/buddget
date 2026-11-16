-- 0301_db_load_phase_b.sql  (database load plan, phase B: lighter clients and cheaper limit checks; no user-visible change)
--   1. sync_changed_since(p_since): a boolean "did anything change?" probe so the client skips the full sync_pull_v2 when not.
--   2. ai_credit_counters: running per-user session and week totals kept by settle, so the credit check reads one row.
--      A counter is trusted only while its window cut equals the current cut; otherwise the old sum is used and the next
--      settle rebuilds it, so a counter can only ever be as wrong as the raw events (never more). Resets, week rollover, session
--      expiry and timezone changes all move the cut and therefore invalidate the counter by themselves.
--   3. A covering index for the remaining unit sums (index-only scans); the plain (user_id, created_at) index is redundant after it.
--   4. db_retention(): app_analytics_daily older than 400 days; sms_parse_log rows that are rejected, unlinked and older than 365 days.
--      Rows with any ledger link (expense, income, debt payment, savings transaction, pairing) are never touched.
--
-- AUDIT SELECTs (expected today in brackets):
--   select count(*) from app_analytics_daily where day < current_date - 400;                                      -- 0
--   select count(*) from sms_parse_log where status = 'rejected' and received_at < now() - interval '365 days';  -- 0
--   select count(*) from ai_usage_events;                                                                         -- 277
-- ROLLBACK: select cron.unschedule('db-retention'); drop table ai_credit_counters; restore ai_credit_windows / ai_quota_settle_core from 0298;
--   create index ai_usage_events_user_created_idx on ai_usage_events (user_id, created_at desc); drop index ai_usage_events_user_cover_idx;
--   drop function sync_changed_since(timestamptz), ai_credit_cuts(uuid, timestamptz), ai_credit_bump(uuid, bigint), db_retention();

-- 1. Sync probe ---------------------------------------------------------------------------------------------------
-- Same window rule as sync_pull (since minus 2 minutes), same tables, same updated_at column. It is volatile only because it also
-- runs the caller's overdue SMS discards, exactly like sync_pull_v2, so an unchanged sync never delays them.
-- Anything unusual (no session, no cursor, a cursor older than 60 days, no profile yet) answers true: the full pull decides.
CREATE OR REPLACE FUNCTION public.sync_changed_since(p_since timestamptz) RETURNS boolean
LANGUAGE plpgsql VOLATILE SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  uid uuid := (SELECT auth.uid());
  win timestamptz;
  t text;
  hit boolean;
BEGIN
  IF uid IS NULL OR p_since IS NULL OR p_since < now() - interval '60 days' THEN RETURN true; END IF;
  win := p_since - interval '2 minutes';
  PERFORM public.sms_run_my_pending_discards();
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = uid) THEN RETURN true; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = uid AND p.updated_at > win)
     OR EXISTS (SELECT 1 FROM public.user_settings s WHERE s.user_id = uid AND s.updated_at > win) THEN RETURN true; END IF;
  FOREACH t IN ARRAY ARRAY[
    'payment_methods','income_sources','income_events','expenses','receipts','recurring_expenses','subscriptions','debts',
    'debt_payments','recurring_debt_payments','savings_accounts','savings_holdings','savings_transactions',
    'recurring_savings_deposits','goals','buddgy_memories','account_adjustments',
    'budget_plans','budget_categories','budget_subcategories','budget_plan_activations'
  ] LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I t WHERE t.user_id = $1 AND t.updated_at > $2)', t) INTO hit USING uid, win;
    IF hit THEN RETURN true; END IF;
  END LOOP;
  RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.sync_changed_since(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_changed_since(timestamptz) TO authenticated;

-- 2. AI credit counters -------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_credit_counters (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  week_cut timestamptz,
  week_micro bigint NOT NULL DEFAULT 0,
  session_cut timestamptz,
  session_micro bigint NOT NULL DEFAULT 0
);
ALTER TABLE public.ai_credit_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_credit_counters FROM anon, authenticated;
GRANT ALL ON public.ai_credit_counters TO service_role;

-- The cut points of the user's windows (everything at or after a cut counts) and the window bounds. Rules unchanged from 0298.
CREATE OR REPLACE FUNCTION public.ai_credit_cuts(p_user uuid, p_t timestamptz) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  tz text; wsd smallint; ws date;
  wk_start timestamptz; wk_end timestamptz; s_start timestamptz; s_cut timestamptz; w_cut timestamptz;
BEGIN
  SELECT timezone, week_start_day INTO tz, wsd FROM public.user_settings WHERE user_id = p_user;
  tz := coalesce(nullif(tz, ''), 'UTC');
  BEGIN PERFORM now() AT TIME ZONE tz; EXCEPTION WHEN others THEN tz := 'UTC'; END;
  ws := public.loyalty_week_start(public.loyalty_local_day(p_t, tz), wsd);
  wk_start := ws::timestamp AT TIME ZONE tz;
  wk_end := (ws + 7)::timestamp AT TIME ZONE tz;
  SELECT session_start INTO s_start FROM public.ai_credit_sessions WHERE user_id = p_user;
  IF s_start IS NOT NULL AND s_start + interval '5 hours' <= p_t THEN s_start := NULL; END IF;
  w_cut := greatest(wk_start, coalesce((SELECT max(created_at) FROM public.ai_credit_resets WHERE user_id = p_user AND scope = 'week'), '-infinity'));
  IF s_start IS NOT NULL THEN
    s_cut := greatest(s_start, coalesce((SELECT max(created_at) FROM public.ai_credit_resets WHERE user_id = p_user AND scope = 'session'), '-infinity'));
  END IF;
  RETURN jsonb_build_object('tz', tz, 'wk_start', wk_start, 'wk_end', wk_end, 's_start', s_start, 'w_cut', w_cut, 's_cut', s_cut);
END $$;
REVOKE ALL ON FUNCTION public.ai_credit_cuts(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_credit_cuts(uuid, timestamptz) TO service_role;

-- Same result as 0298 (same keys, same units); the sums come from the counter while its cut is current.
CREATE OR REPLACE FUNCTION public.ai_credit_windows(p_user uuid, p_t timestamptz) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  c jsonb := public.ai_credit_cuts(p_user, p_t);
  k public.ai_credit_counters%rowtype;
  s_start timestamptz := (c ->> 's_start')::timestamptz;
  w_cut timestamptz := (c ->> 'w_cut')::timestamptz;
  s_cut timestamptz := (c ->> 's_cut')::timestamptz;
  s_used numeric := 0; w_used numeric; has_k boolean;
BEGIN
  SELECT * INTO k FROM public.ai_credit_counters WHERE user_id = p_user;
  has_k := found;
  IF has_k AND k.week_cut IS NOT DISTINCT FROM w_cut THEN
    w_used := k.week_micro / 1000.0;
  ELSE
    SELECT coalesce(sum(cost_usd_micro), 0) / 1000.0 INTO w_used FROM public.ai_usage_events
      WHERE user_id = p_user AND feature <> 'sms' AND NOT credits_exempt AND created_at >= w_cut;
  END IF;
  IF s_start IS NOT NULL THEN
    IF has_k AND k.session_cut IS NOT DISTINCT FROM s_cut THEN
      s_used := k.session_micro / 1000.0;
    ELSE
      SELECT coalesce(sum(cost_usd_micro), 0) / 1000.0 INTO s_used FROM public.ai_usage_events
        WHERE user_id = p_user AND feature <> 'sms' AND NOT credits_exempt AND created_at >= s_cut;
    END IF;
  END IF;
  RETURN jsonb_build_object('session_used', s_used, 'session_start', s_start, 'session_reset', s_start + interval '5 hours',
    'week_used', w_used, 'week_start', (c ->> 'wk_start')::timestamptz, 'week_reset', (c ->> 'wk_end')::timestamptz, 'timezone', c ->> 'tz');
END $$;
REVOKE ALL ON FUNCTION public.ai_credit_windows(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_credit_windows(uuid, timestamptz) TO service_role;

-- Called by settle after the event row is inserted, under the per-user lock reserve also takes: a counter whose cut is current gets
-- the cost added; any other counter is rebuilt from the events (which already include this one) and stamped with the current cut.
CREATE OR REPLACE FUNCTION public.ai_credit_bump(p_user uuid, p_cost bigint) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  c jsonb; k public.ai_credit_counters%rowtype;
  w_cut timestamptz; s_cut timestamptz;
  w_micro bigint; s_micro bigint; has_k boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  c := public.ai_credit_cuts(p_user, now());
  w_cut := (c ->> 'w_cut')::timestamptz;
  s_cut := (c ->> 's_cut')::timestamptz;
  SELECT * INTO k FROM public.ai_credit_counters WHERE user_id = p_user;
  has_k := found;
  IF has_k AND k.week_cut IS NOT DISTINCT FROM w_cut THEN w_micro := k.week_micro + p_cost;
  ELSE SELECT coalesce(sum(cost_usd_micro), 0) INTO w_micro FROM public.ai_usage_events WHERE user_id = p_user AND feature <> 'sms' AND NOT credits_exempt AND created_at >= w_cut; END IF;
  IF s_cut IS NULL THEN s_micro := 0;
  ELSIF has_k AND k.session_cut IS NOT DISTINCT FROM s_cut THEN s_micro := k.session_micro + p_cost;
  ELSE SELECT coalesce(sum(cost_usd_micro), 0) INTO s_micro FROM public.ai_usage_events WHERE user_id = p_user AND feature <> 'sms' AND NOT credits_exempt AND created_at >= s_cut; END IF;
  INSERT INTO public.ai_credit_counters (user_id, week_cut, week_micro, session_cut, session_micro)
  VALUES (p_user, w_cut, w_micro, s_cut, s_micro)
  ON CONFLICT (user_id) DO UPDATE SET week_cut = excluded.week_cut, week_micro = excluded.week_micro,
    session_cut = excluded.session_cut, session_micro = excluded.session_micro;
END $$;
REVOKE ALL ON FUNCTION public.ai_credit_bump(uuid, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_credit_bump(uuid, bigint) TO service_role;

-- settle_core as in 0298, plus the counter update for events that count toward credits (not sms, not credits_exempt).
CREATE OR REPLACE FUNCTION public.ai_quota_settle_core(
  p_reservation uuid, p_user uuid, p_units numeric, p_in integer, p_cached integer, p_out integer, p_model text, p_tier text, p_latency integer, p_status text,
  p_audio_seconds integer DEFAULT 0, p_extra_cost_micro bigint DEFAULT 0)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.ai_reservations%rowtype; v_cost bigint;
BEGIN
  SELECT * INTO r FROM public.ai_reservations WHERE id = p_reservation AND user_id = p_user AND NOT settled FOR UPDATE;
  IF NOT found THEN RETURN 0; END IF;
  UPDATE public.ai_reservations SET settled = true WHERE id = p_reservation;
  v_cost := public.ai_cost_usd_micro(p_model, p_in, p_cached, p_out, p_audio_seconds, p_extra_cost_micro);
  INSERT INTO public.ai_usage_events (user_id, chat_id, feature, model, tier, in_tokens, cached_tokens, out_tokens, units, latency_ms, status, cost_usd_micro, credits_exempt)
  VALUES (p_user, r.chat_id, r.feature, p_model, p_tier, p_in, p_cached, p_out, p_units, p_latency, p_status, v_cost, r.advisor_free);
  IF r.chat_id IS NOT NULL THEN
    UPDATE public.ai_chats SET units = units + p_units, turns = turns + CASE WHEN r.feature = 'chat' AND p_status = 'ok' THEN 1 ELSE 0 END, last_at = now()
      WHERE chat_id = r.chat_id;
  END IF;
  IF r.feature <> 'sms' AND NOT r.advisor_free THEN
    -- A counter failure must never fail a settle: drop the counter so the check falls back to summing the events.
    BEGIN
      PERFORM public.ai_credit_bump(p_user, coalesce(v_cost, 0));
    EXCEPTION WHEN OTHERS THEN
      DELETE FROM public.ai_credit_counters WHERE user_id = p_user;
    END;
  END IF;
  RETURN v_cost;
END $$;
REVOKE ALL ON FUNCTION public.ai_quota_settle_core(uuid, uuid, numeric, integer, integer, integer, text, text, integer, text, integer, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_quota_settle_core(uuid, uuid, numeric, integer, integer, integer, text, text, integer, text, integer, bigint) TO service_role;

-- 3. Covering index for the per-user unit and cost sums --------------------------------------------------------------
CREATE INDEX IF NOT EXISTS ai_usage_events_user_cover_idx
  ON public.ai_usage_events (user_id, created_at DESC) INCLUDE (feature, units, cost_usd_micro, credits_exempt);
DROP INDEX IF EXISTS public.ai_usage_events_user_created_idx;

-- 4. Retention -----------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.db_retention() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE n integer := 0; m integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.app_analytics_daily WHERE day < current_date - 400 LIMIT 1)
     AND NOT EXISTS (SELECT 1 FROM public.sms_parse_log WHERE status = 'rejected' AND received_at < now() - interval '365 days' LIMIT 1) THEN
    RETURN 0;
  END IF;
  DELETE FROM public.app_analytics_daily WHERE day < current_date - 400;
  GET DIAGNOSTICS m = ROW_COUNT; n := n + m;
  WITH d AS (
    DELETE FROM public.sms_parse_log l
     WHERE l.id IN (SELECT id FROM public.sms_parse_log
                     WHERE status = 'rejected' AND received_at < now() - interval '365 days'
                       AND expense_id IS NULL AND income_id IS NULL AND debt_payment_id IS NULL AND savings_transaction_id IS NULL
                       AND paired_log_id IS NULL AND discard_requested_at IS NULL
                     LIMIT 2000)
       AND NOT EXISTS (SELECT 1 FROM public.expenses e WHERE e.sms_log_id = l.id)
       AND NOT EXISTS (SELECT 1 FROM public.income_events i WHERE i.sms_log_id = l.id)
       AND NOT EXISTS (SELECT 1 FROM public.sms_parse_log o WHERE o.paired_log_id = l.id)
    RETURNING 1)
  SELECT count(*) INTO m FROM d; n := n + m;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.db_retention() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.db_retention() TO service_role;
SELECT cron.schedule('db-retention', '10 2 * * *', 'SELECT public.db_retention()');
