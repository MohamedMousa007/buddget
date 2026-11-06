-- QA6 ADS-1 + SLG-3.
--
-- ADS-1: admin_user_directory matched the search text against the UNMASKED email while the API masks it for staff without
-- `users.pii`, so a view-only role could recover addresses character by character. The new p_match_email flag (default false =
-- safe) makes the search match the MASKED address unless the caller holds `users.pii`; `%`, `_` and `\` in the search text are
-- escaped so they match literally. The 6-argument function is replaced by a 7-argument one (service_role only).
--
-- SLG-3: check_sms_promotion_eligibility filtered on tier = 'learned', a value 0097 removed, so no template could ever be
-- promoted. It now reads the post-0097 names (tier 'template', status 'active', not merged) and enforces SAFE FLOORS that the
-- config table cannot lower: >= 5 distinct users, >= 7 days old, on top of the existing match/confidence/failure gates; the
-- app still applies the replay-regression gate before it flips the tier (promotionChecker.ts). The config row is raised to match.
--
-- ROLLBACK: recreate the 6-argument admin_user_directory from 0131; recreate check_sms_promotion_eligibility from 0097 and
--           update sms_promotion_config set min_unique_users = 3, min_age_days = 0 where id = 1.

CREATE OR REPLACE FUNCTION private.mask_email(e text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE WHEN e IS NULL THEN NULL ELSE
    left(split_part(e, '@', 1), 2) || '***@' || left(split_part(split_part(e, '@', 2), '.', 1), 2) || '***'
    || CASE WHEN position('.' IN split_part(e, '@', 2)) > 0 THEN substr(split_part(e, '@', 2), position('.' IN split_part(e, '@', 2))) ELSE '' END
  END
$function$;
REVOKE ALL ON FUNCTION private.mask_email(text) FROM PUBLIC, anon, authenticated;

DO $mig$
DECLARE
  old_sig regprocedure := 'public.admin_user_directory(text,integer,integer,text,text,text)'::regprocedure;
  d text := pg_get_functiondef(old_sig);
  e1 text := $q$u.email ILIKE '%' || q || '%'$q$;
  n1 text := $q$(CASE WHEN p_match_email THEN u.email ELSE private.mask_email(u.email) END) ILIKE '%' || qpat || '%'$q$;
BEGIN
  IF position(e1 IN d) = 0 THEN RAISE EXCEPTION 'admin_user_directory: email clause not found'; END IF;
  d := replace(d, e1, n1);
  FOREACH e1 IN ARRAY ARRAY['p.name', 'p.display_name', $q$u.raw_user_meta_data->>'full_name'$q$] LOOP
    IF position(e1 || $q$ ILIKE '%' || q || '%'$q$ IN d) = 0 THEN RAISE EXCEPTION 'admin_user_directory: % clause not found', e1; END IF;
    d := replace(d, e1 || $q$ ILIKE '%' || q || '%'$q$, e1 || $q$ ILIKE '%' || qpat || '%'$q$);
  END LOOP;
  e1 := $q$q text := NULLIF(btrim(p_search), '');$q$;
  IF position(e1 IN d) = 0 THEN RAISE EXCEPTION 'admin_user_directory: declaration not found'; END IF;
  d := replace(d, e1, e1 || $q$
  qpat text := replace(replace(replace(NULLIF(btrim(p_search), ''), '\', '\\'), '%', '\%'), '_', '\_');$q$);
  e1 := $q$p_state text DEFAULT NULL::text)$q$;
  IF position(e1 IN d) = 0 THEN RAISE EXCEPTION 'admin_user_directory: signature not found'; END IF;
  d := replace(d, e1, $q$p_state text DEFAULT NULL::text, p_match_email boolean DEFAULT false)$q$);
  EXECUTE d;
  DROP FUNCTION public.admin_user_directory(text, integer, integer, text, text, text);
  REVOKE ALL ON FUNCTION public.admin_user_directory(text, integer, integer, text, text, text, boolean) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.admin_user_directory(text, integer, integer, text, text, text, boolean) TO service_role;
END
$mig$;

UPDATE public.sms_promotion_config SET min_unique_users = GREATEST(min_unique_users, 5), min_age_days = GREATEST(min_age_days, 7), updated_at = now() WHERE id = 1;

CREATE OR REPLACE FUNCTION public.check_sms_promotion_eligibility()
 RETURNS TABLE(template_id uuid, sender text, match_count integer, unique_user_count integer, age_days integer, failure_rate numeric, avg_ai_confidence numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    t.id AS template_id,
    t.sender,
    t.match_count,
    t.unique_user_count,
    EXTRACT(DAY FROM now() - t.created_at)::int AS age_days,
    COALESCE(
      (
        SELECT COUNT(CASE WHEN l.parsed_ok = false THEN 1 END)::numeric
          / NULLIF(COUNT(*)::numeric, 0)
        FROM sms_parse_log l
        WHERE l.sender = t.sender
          AND l.created_at > t.created_at
      ),
      0
    ) AS failure_rate,
    COALESCE(t.avg_ai_confidence, 1.0) AS avg_ai_confidence
  FROM sms_tracking_templates_ai t, sms_promotion_config c
  WHERE t.tier = 'template'
    AND t.status = 'active'
    AND t.merged_into IS NULL
    AND t.ai_enabled = true
    AND t.match_count >= c.min_match_count
    AND t.unique_user_count >= GREATEST(c.min_unique_users, 5)
    AND EXTRACT(DAY FROM now() - t.created_at) >= GREATEST(c.min_age_days, 7)
    AND COALESCE(t.avg_ai_confidence, 1.0) >= c.min_avg_confidence
    AND COALESCE(
      (
        SELECT COUNT(CASE WHEN l.parsed_ok = false THEN 1 END)::numeric
          / NULLIF(COUNT(*)::numeric, 0)
        FROM sms_parse_log l
        WHERE l.sender = t.sender
          AND l.created_at > t.created_at
      ),
      0
    ) <= c.max_failure_rate;
END;
$function$;
