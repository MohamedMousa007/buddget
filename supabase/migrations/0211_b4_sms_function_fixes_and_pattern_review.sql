-- QA2 B4 / N16 N22 N26 N27 LF3 PR1 LF4: SMS function fixes + pattern review tables, pack and coverage.
--
-- Contents
--   1. N16  bump_sms_template_failure_v2(template, hard, reason, user): a hard signal quarantines a GLOBAL template only
--           after hard signals from >= 2 distinct users within 30 days (system oracles, reason 'zero_variance%', and
--           user-owned templates stay immediate). The old 3-arg function is kept (same signature, rewritten from the live
--           definition) and delegates to v2 with no user, so a legacy caller can no longer quarantine a global template
--           alone. Table sms_template_hard_signals holds the evidence (user ids; cascades on account erasure).
--   2. N22  sms_try_pair: same signature, rewritten from the live definition. Registered-sibling check accepts a
--           3- vs 4-digit last4 (suffix match, min 3 digits) and requires the sibling's account to resolve to exactly ONE
--           registered payment method (ambiguous => no pairing). raw_body reference match is NULL-safe (purged text).
--   3. N26  sms_heal_stuck: catch-all, includes NULL parsed_at (falls back to created_at) and rows of any age.
--   4. N27  sms_parse_today (view, security_invoker kept, same columns): day boundary in the user's timezone (Cairo
--           fallback, computed once per user); new view sms_ai_today counts AI-cost rows (ai_new rejects too) for the quota.
--   5. LF3  daily legacy harvest: the masker lives in TypeScript (harvestLegacySms + the LF6 masker), pg_net is not
--           installed, so the cron entry is documented and DISABLED here; sms_legacy_harvest_pending() reports the
--           backlog for the Vercel/prices-cron caller and for the retention pre-flight.
--   6. PR1  private.sms_review_pack / private.sms_coverage_by_bank and PUBLIC service-role-only
--           wrappers public.sms_review_pack(period_start, period_end) and public.sms_coverage_by_bank() (PostgREST cannot
--           reach schema private). Both return jsonb arrays, no raw bodies, no user ids.
--
-- DEPLOY ORDER: after 0209 (uses its settings key and columns). Additive (new tables/functions/columns-free) except the
--   function/view rewrites, which keep signatures and are backward compatible, so DB first then code is fine. The code
--   that should call bump_sms_template_failure_v2 with a user id (parse route, runAdjudication) switches after apply.
--
-- AUDIT SELECTs (expected on the day of writing in brackets)
--   select count(*) from pg_proc where proname in ('bump_sms_template_failure','sms_try_pair','sms_heal_stuck');  -- 3 (one overload each)
--   select count(*) from sms_tracking_templates_ai where status = 'quarantined';                                 -- 2
--   select count(*) from sms_parse_log where status = 'processing';                                              -- 0
--   select count(*) from sms_parse_log where status = 'processing' and parsed_at is null;                       -- 0
--   select count(*) from pg_class where relname in ('sms_pattern_reviews','sms_template_hard_signals');          -- 0
--   select count(*) from payment_methods pm where deleted_at is null and last4 is not null
--     and exists (select 1 from payment_methods o where o.user_id = pm.user_id and o.id <> pm.id and o.deleted_at is null and o.last4 = pm.last4); -- last4 collisions
--
-- ROLLBACK: restore the previous bodies of the three functions and the view from pg_get_functiondef/pg_get_viewdef
--   captured before applying (the live bodies are reproduced in comments next to each rewrite), then
--   drop table sms_pattern_reviews, sms_template_hard_signals; drop function bump_sms_template_failure_v2, sms_last4_match,
--   sms_safe_tz, sms_review_pack, sms_coverage_by_bank, sms_legacy_harvest_pending and the private.* ones.

BEGIN;

-- 1. N16 -------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sms_template_hard_signals (
  template_id uuid NOT NULL REFERENCES public.sms_tracking_templates_ai(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (template_id, user_id)
);
ALTER TABLE public.sms_template_hard_signals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sms_template_hard_signals FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_template_hard_signals TO service_role;

CREATE OR REPLACE FUNCTION public.bump_sms_template_failure_v2(
  p_template_id uuid, p_hard boolean DEFAULT false, p_reason text DEFAULT NULL::text, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare t record; cfg record; rate numeric; should_quarantine boolean := false; v_users int;
  v_system boolean := coalesce(p_reason, '') like 'zero_variance%';
begin
  select * into t from sms_tracking_templates_ai where id = p_template_id;
  if not found then return 'not_found'; end if;

  if t.status <> 'active' then
    update sms_tracking_templates_ai set failure_count = failure_count + 1, updated_at = now()
     where id = p_template_id;
    return t.status;
  end if;

  update sms_tracking_templates_ai
     set failure_count = failure_count + 1, hard_fail = hard_fail or p_hard, updated_at = now()
   where id = p_template_id returning * into t;

  if p_hard then
    if v_system or t.user_id is not null then
      should_quarantine := true;
    else
      if p_user_id is not null then
        insert into sms_template_hard_signals (template_id, user_id, reason)
        values (p_template_id, p_user_id, left(p_reason, 200))
        on conflict (template_id, user_id) do update set created_at = now(), reason = excluded.reason;
      end if;
      select count(*) into v_users from sms_template_hard_signals
       where template_id = p_template_id and created_at > now() - interval '30 days';
      should_quarantine := v_users >= 2;
    end if;
  else
    select * into cfg from sms_promotion_config where id = 1;
    if found and t.match_count >= cfg.min_matches_before_retire then
      rate := t.failure_count::numeric / greatest(t.match_count, 1)::numeric;
      should_quarantine := rate > cfg.max_failure_rate;
    end if;
  end if;

  if should_quarantine then
    update sms_tracking_templates_ai
       set status = 'quarantined', hard_fail = hard_fail or p_hard, prev_tier = tier,
           quarantined_at = now(), updated_at = now()
     where id = p_template_id;
    return 'quarantined';
  end if;
  return 'active';
end;
$function$;

-- Live 3-arg function (same signature) now delegates; legacy callers carry no user so one of them cannot quarantine alone.
CREATE OR REPLACE FUNCTION public.bump_sms_template_failure(
  p_template_id uuid, p_hard boolean DEFAULT false, p_reason text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
begin
  return public.bump_sms_template_failure_v2(p_template_id, p_hard, p_reason, null);
end;
$function$;

REVOKE ALL ON FUNCTION public.bump_sms_template_failure_v2(uuid, boolean, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_sms_template_failure_v2(uuid, boolean, text, uuid) TO service_role;

-- 2. N22 -------------------------------------------------------------------------------------------------------
-- Suffix match of two card/account tails: 978 matches 0978, but never fewer than 3 digits.
CREATE OR REPLACE FUNCTION public.sms_last4_match(a text, b text)
 RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO 'pg_temp'
AS $$
  SELECT a IS NOT NULL AND b IS NOT NULL
     AND least(length(a), length(b)) >= 3
     AND right(a, least(length(a), length(b))) = right(b, least(length(a), length(b)))
$$;
REVOKE ALL ON FUNCTION public.sms_last4_match(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sms_last4_match(text, text) TO service_role;

-- Live signature kept (11 args). Changes: raw_body NULL-safe; registered sibling must resolve to exactly one method.
CREATE OR REPLACE FUNCTION public.sms_try_pair(p_user_id uuid, p_log_id uuid, p_received_at timestamp with time zone, p_window_seconds integer, p_amount numeric, p_require_equal_amount boolean, p_match_kinds text[], p_amount_tolerance numeric DEFAULT 0, p_self_kind text DEFAULT NULL::text, p_reference text DEFAULT NULL::text, p_require_registered_sibling boolean DEFAULT false)
 RETURNS TABLE(sibling_id uuid, sibling_kind text, sibling_expense_id uuid, sibling_income_id uuid, sibling_status text)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_sibling sms_parse_log%ROWTYPE;
BEGIN
  SELECT * INTO v_sibling
  FROM sms_parse_log s
  WHERE s.user_id = p_user_id
    AND s.id <> p_log_id
    AND s.paired_log_id IS NULL
    AND s.parsed_ok = true
    AND s.kind = ANY(p_match_kinds)
    AND s.received_at BETWEEN p_received_at - make_interval(secs => p_window_seconds)
                          AND p_received_at + make_interval(secs => p_window_seconds)
    AND (
      (p_reference IS NOT NULL AND coalesce(s.raw_body, '') ILIKE '%' || p_reference || '%')
      OR (p_reference IS NULL AND (
        NOT p_require_equal_amount
        OR abs(s.amount - p_amount) <= CASE
             WHEN p_require_registered_sibling THEN COALESCE(p_amount_tolerance, 0)
             WHEN 'cc_payoff' IN (COALESCE(p_self_kind, ''), COALESCE(s.kind, ''))
               THEN COALESCE(p_amount_tolerance, 0)
             ELSE 0
           END
      ))
    )
    AND (
      NOT p_require_registered_sibling
      OR (
        SELECT count(*) FROM payment_methods pm
        WHERE pm.user_id = p_user_id
          AND public.sms_last4_match(pm.last4, s.account_last4)
          AND pm.deleted_at IS NULL
      ) = 1
    )
  ORDER BY abs(extract(epoch FROM (s.received_at - p_received_at)))
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE sms_parse_log SET paired_log_id = v_sibling.id WHERE id = p_log_id;
  UPDATE sms_parse_log SET paired_log_id = p_log_id WHERE id = v_sibling.id;

  sibling_id := v_sibling.id;
  sibling_kind := v_sibling.kind;
  sibling_expense_id := v_sibling.expense_id;
  sibling_income_id := v_sibling.income_id;
  sibling_status := v_sibling.status;
  RETURN NEXT;
END;
$function$;

-- 3. N26 -------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sms_heal_stuck()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE n integer;
BEGIN
  UPDATE sms_parse_log SET status = 'failed', failure_code = 'timed_out'
   WHERE status = 'processing' AND coalesce(parsed_at, created_at) < now() - interval '2 minutes';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $function$;

-- Cheap lookup for the unbounded heal scan.
CREATE INDEX IF NOT EXISTS sms_parse_log_processing_idx ON public.sms_parse_log (status) WHERE status = 'processing';

-- 4. N27 -------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sms_safe_tz(p text)
 RETURNS text LANGUAGE plpgsql STABLE SET search_path TO 'pg_temp'
AS $$
BEGIN
  IF p IS NULL OR p = '' THEN RETURN 'Africa/Cairo'; END IF;
  PERFORM now() AT TIME ZONE p;
  RETURN p;
EXCEPTION WHEN OTHERS THEN
  RETURN 'Africa/Cairo';
END $$;
REVOKE ALL ON FUNCTION public.sms_safe_tz(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sms_safe_tz(text) TO authenticated, service_role;

-- sms_parse_today keeps its original meaning (parsed_ok rows; the number users see) with the day boundary in the
-- user's timezone. The timezone function runs once per user (CTE over distinct users), never per log row.
-- Live: SELECT user_id, count(*) FROM sms_parse_log WHERE parsed_ok AND received_at >= date_trunc('day', now() AT TIME ZONE 'utc') GROUP BY user_id
CREATE OR REPLACE VIEW public.sms_parse_today WITH (security_invoker = true) AS
  WITH u AS (
    SELECT d.user_id, (date_trunc('day', now() AT TIME ZONE public.sms_safe_tz(us.timezone)) AT TIME ZONE public.sms_safe_tz(us.timezone)) AS day_start
      FROM (SELECT DISTINCT user_id FROM public.sms_parse_log WHERE received_at >= now() - interval '2 days') d
      LEFT JOIN public.user_settings us ON us.user_id = d.user_id
  )
  SELECT l.user_id, (count(*))::integer AS parsed_count_today
    FROM u JOIN public.sms_parse_log l ON l.user_id = u.user_id AND l.received_at >= u.day_start
   WHERE l.parsed_ok = true
   GROUP BY l.user_id;

-- Rows that cost an AI call today (parsed ok OR rejected by the AI tier): the daily AI quota reads this one.
CREATE OR REPLACE VIEW public.sms_ai_today WITH (security_invoker = true) AS
  WITH u AS (
    SELECT d.user_id, (date_trunc('day', now() AT TIME ZONE public.sms_safe_tz(us.timezone)) AT TIME ZONE public.sms_safe_tz(us.timezone)) AS day_start
      FROM (SELECT DISTINCT user_id FROM public.sms_parse_log WHERE received_at >= now() - interval '2 days') d
      LEFT JOIN public.user_settings us ON us.user_id = d.user_id
  )
  SELECT l.user_id, (count(*))::integer AS ai_count_today
    FROM u JOIN public.sms_parse_log l ON l.user_id = u.user_id AND l.received_at >= u.day_start
   WHERE l.parsed_ok = true OR (l.parse_method = 'ai_new' AND l.status = 'rejected')
   GROUP BY l.user_id;
REVOKE ALL ON public.sms_ai_today FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.sms_ai_today TO service_role;

-- 5. LF3 -------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.sms_legacy_harvest_pending()
 RETURNS bigint LANGUAGE sql STABLE SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT count(*) FROM public.sms_parse_log
   WHERE raw_body IS NOT NULL AND status <> 'processing'
     AND (learned_at IS NULL OR coalesce(masked_version, 0) < private.sms_setting_num('sms_masked_version_min', 1))
$$;
CREATE OR REPLACE FUNCTION public.sms_legacy_harvest_pending()
 RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$ SELECT private.sms_legacy_harvest_pending() $$;
REVOKE ALL ON FUNCTION private.sms_legacy_harvest_pending(), public.sms_legacy_harvest_pending() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.sms_legacy_harvest_pending(), public.sms_legacy_harvest_pending() TO service_role;

-- The daily batched harvest needs the TypeScript masker (harvestLegacySms + LF6), which only an HTTP route can run, and
-- pg_net is not installed. Schedule it with a Vercel cron entry calling the route (or the existing prices-cron harvest),
-- or once the B6 scheduler (pg_net + vault secret) exists:
--   SELECT cron.schedule('sms-legacy-harvest', '35 1 * * *', $$SELECT private.invoke_cron('/api/cron/sms-harvest')$$);
-- Intentionally NOT scheduled here (private.invoke_cron does not exist yet).

-- 6. PR1 -------------------------------------------------------------------------------------------------------
-- sms_pattern_reviews lives in 0209 (sms_retention reads it); the hold is derived from its rows, no trigger.

-- Review pack: masked shapes with outcomes, counts and links. NO raw bodies, NO user ids, no per-user rows.
CREATE OR REPLACE FUNCTION private.sms_review_pack(p_start date, p_end date)
 RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public', 'pg_temp'
AS $$
  WITH shapes AS (
    SELECT c.skeleton_key, c.redacted_body AS skeleton, c.sender_key, c.parse_method AS parse_tier, c.kind, c.currency,
           c.seen_count, c.ok_count, c.first_seen, c.last_seen, c.matched_template_id IS NOT NULL AS has_template
      FROM public.sms_corpus c
     WHERE c.last_seen >= p_start::timestamptz AND c.first_seen < (p_end + 1)::timestamptz
     ORDER BY c.seen_count DESC, c.last_seen DESC
     LIMIT 500
  ), per_shape AS (
    SELECT s.skeleton_key,
           (SELECT count(*) FROM public.sms_parse_log WHERE skeleton_key = s.skeleton_key
               AND received_at >= p_start::timestamptz AND received_at < (p_end + 1)::timestamptz) AS rows_in_period,
           (SELECT coalesce(jsonb_object_agg(o.status, o.n), '{}'::jsonb) FROM (
              SELECT status, count(*) n FROM public.sms_parse_log
               WHERE skeleton_key = s.skeleton_key
                 AND received_at >= p_start::timestamptz AND received_at < (p_end + 1)::timestamptz
               GROUP BY status) o) AS outcomes,
           (SELECT coalesce(jsonb_object_agg(f.failure_code, f.n), '{}'::jsonb) FROM (
              SELECT failure_code, count(*) n FROM public.sms_parse_log
               WHERE skeleton_key = s.skeleton_key AND failure_code IS NOT NULL
                 AND received_at >= p_start::timestamptz AND received_at < (p_end + 1)::timestamptz
               GROUP BY failure_code) f) AS failure_codes,
           (SELECT count(*) FROM public.sms_parse_log WHERE skeleton_key = s.skeleton_key AND paired_log_id IS NOT NULL
               AND received_at >= p_start::timestamptz AND received_at < (p_end + 1)::timestamptz) AS paired_count,
           (SELECT count(*) FROM public.sms_corrections WHERE redacted_body = s.skeleton AND revoked_at IS NULL) AS corrected_count
      FROM shapes s
  ), unshaped AS (
    SELECT coalesce(nullif(bank_name, ''), 'unknown') AS bank, parse_method AS parse_tier, status, failure_code, count(*) AS n
      FROM public.sms_parse_log
     WHERE skeleton_key IS NULL AND received_at >= p_start::timestamptz AND received_at < (p_end + 1)::timestamptz
     GROUP BY 1, 2, 3, 4
  )
  SELECT coalesce(jsonb_agg(x.j), '[]'::jsonb) FROM (
    SELECT jsonb_build_object(
             'row_type', 'shape', 'skeleton', s.skeleton, 'sender_key', s.sender_key, 'parse_tier', s.parse_tier,
             'kind', s.kind, 'currency', s.currency, 'seen_count', s.seen_count, 'ok_count', s.ok_count,
             'first_seen', s.first_seen, 'last_seen', s.last_seen, 'has_template', s.has_template,
             'rows_in_period', p.rows_in_period, 'outcomes', p.outcomes, 'failure_codes', p.failure_codes,
             'paired_count', p.paired_count, 'corrected_count', p.corrected_count) AS j
      FROM shapes s JOIN per_shape p USING (skeleton_key)
    UNION ALL
    SELECT jsonb_build_object('row_type', 'unshaped', 'bank', bank, 'parse_tier', parse_tier, 'outcome', status,
                              'failure_code', failure_code, 'count', n)
      FROM unshaped
  ) x
$$;

-- Coverage per bank: share handled by each tier, plus the most frequent masked shapes still on the AI tier.
CREATE OR REPLACE FUNCTION private.sms_coverage_by_bank()
 RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public', 'pg_temp'
AS $$
  WITH base AS (
    SELECT coalesce(nullif(bank_name, ''), 'unknown') AS bank,
           count(*) AS total,
           count(*) FILTER (WHERE parse_method IN ('fully_curated', 'curated_db')) AS curated,
           count(*) FILTER (WHERE parse_method = 'template') AS template,
           count(*) FILTER (WHERE parse_method = 'ai_new') AS ai,
           count(*) FILTER (WHERE status = 'failed') AS failed
      FROM public.sms_parse_log WHERE is_duplicate = false
     GROUP BY 1
  ), top_shapes AS (
    SELECT bank, jsonb_agg(skeleton ORDER BY n DESC) AS shapes FROM (
      SELECT coalesce(nullif(l.bank_name, ''), 'unknown') AS bank, c.redacted_body AS skeleton, c.seen_count AS n,
             row_number() OVER (PARTITION BY coalesce(nullif(l.bank_name, ''), 'unknown') ORDER BY c.seen_count DESC) AS rn
        FROM public.sms_corpus c
        JOIN (SELECT DISTINCT skeleton_key, bank_name FROM public.sms_parse_log WHERE skeleton_key IS NOT NULL) l
          ON l.skeleton_key = c.skeleton_key
       WHERE c.parse_method = 'ai_new'
    ) q WHERE rn <= 5 GROUP BY bank
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'bank', b.bank, 'sender_key', b.bank, 'total', b.total, 'curated', b.curated, 'template', b.template,
           'ai', b.ai, 'failed', b.failed, 'top_unlearned', coalesce(t.shapes, '[]'::jsonb)) ORDER BY b.total DESC), '[]'::jsonb)
    FROM base b LEFT JOIN top_shapes t USING (bank)
$$;

-- Public wrappers: exactly the names/params the admin route calls via PostgREST. Service role only.
CREATE OR REPLACE FUNCTION public.sms_review_pack(period_start date, period_end date)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$ SELECT private.sms_review_pack(period_start, period_end) $$;
CREATE OR REPLACE FUNCTION public.sms_coverage_by_bank()
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$ SELECT private.sms_coverage_by_bank() $$;

REVOKE ALL ON FUNCTION private.sms_review_pack(date, date), private.sms_coverage_by_bank(),
  public.sms_review_pack(date, date), public.sms_coverage_by_bank() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.sms_review_pack(date, date), private.sms_coverage_by_bank(),
  public.sms_review_pack(date, date), public.sms_coverage_by_bank() TO service_role;

DO $$
BEGIN
  IF (SELECT count(*) FROM pg_proc WHERE proname IN ('bump_sms_template_failure', 'sms_try_pair', 'sms_heal_stuck')) <> 3 THEN
    RAISE EXCEPTION '0211: expected exactly one overload of each rewritten function';
  END IF;
END $$;

COMMIT;
