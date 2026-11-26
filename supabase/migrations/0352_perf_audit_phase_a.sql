-- Performance audit, phase A (docs/architecture/performance-optimization-roadmap.md). Safe to run again.
--
-- 1. F-01: loyalty_refresh_tier no longer takes a row lock on every call. entitlements_state (the Pro/Rewards read,
--    mean 433 ms) calls it on every /api/entitlements/me through rewards_touch; the lock made concurrent reads for one
--    user wait on each other. Fast path: read without a lock and return when nothing would change. Only a real tier or
--    gift change takes the lock and re-checks under it, so the Sparks gift can still never be granted twice.
-- 2. F-14: drop four non-unique indexes that are strict prefixes of another index with the same predicate.
-- 3. F-05: cap the avatar data URL at 300,000 characters (the UI writes about 60-170 KB; the client validator allowed 8 MB).
-- 4. F-13/F-16: admin_user_directory gets an id tie-break (stable OFFSET pages) and p_with_total, so the type-ahead
--    search skips the whole-set count. Old callers keep working (p_with_total defaults to true).
--
-- Rollback: re-run the previous definitions from 0307 (loyalty_refresh_tier) and 0246/0314 (admin_user_directory),
-- recreate the four indexes from their original migrations, and `ALTER TABLE public.profiles DROP CONSTRAINT
-- profiles_avatar_image_path_len`.

-- 1 ----------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.loyalty_refresh_tier(p_user uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare a record; v_new text; v_rank smallint; g record;
begin
  -- Fast path, no lock: most calls change nothing.
  select tier_key, tier_locked, lifetime_points, gifted_rank into a from public.loyalty_accounts where user_id = p_user;
  if not found then return null; end if;
  if a.tier_locked then return a.tier_key; end if;
  v_new := case when public.loyalty_tiers_enabled() then public.loyalty_tier_key(a.lifetime_points, public.loyalty_pro_active(p_user),
                  exists (select 1 from public.founders f where f.user_id = p_user and f.retired_at is null)) end;
  select least(t.sort_order, 3) into v_rank from public.loyalty_tiers t where t.key = v_new;
  if v_new is not distinct from a.tier_key and (v_rank is null or v_rank <= a.gifted_rank) then return v_new; end if;

  -- Something changes: lock and decide again on the locked row (unchanged from 0307 below this line).
  select tier_key, tier_locked, lifetime_points, gifted_rank into a from public.loyalty_accounts where user_id = p_user for update;
  if not found then return null; end if;
  if a.tier_locked then return a.tier_key; end if;
  v_new := case when public.loyalty_tiers_enabled() then public.loyalty_tier_key(a.lifetime_points, public.loyalty_pro_active(p_user),
                  exists (select 1 from public.founders f where f.user_id = p_user and f.retired_at is null)) end;
  if v_new is distinct from a.tier_key then
    update public.loyalty_accounts set tier_key = v_new, updated_at = now() where user_id = p_user;
  end if;
  select least(t.sort_order, 3) into v_rank from public.loyalty_tiers t where t.key = v_new;
  if v_rank is not null and v_rank > a.gifted_rank then
    for g in select key, sparks_gift from public.loyalty_tiers where sort_order > a.gifted_rank and sort_order <= v_rank and sparks_gift > 0 and status = 'active' loop
      perform public.spark_grant_reward(p_user, g.sparks_gift, 'tier:' || g.key, 'Reached ' || g.key);
    end loop;
    update public.loyalty_accounts set gifted_rank = v_rank where user_id = p_user;
  end if;
  return v_new;
end;
$function$;

-- 2 ----------------------------------------------------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_debt_payments_user;           -- covered by idx_debt_payments_user_updated (user_id, updated_at)
DROP INDEX IF EXISTS public.idx_expenses_live;                -- covered by idx_expenses_live_user_id (user_id, id) WHERE deleted_at IS NULL
DROP INDEX IF EXISTS public.idx_income_events_user;           -- covered by idx_income_events_user_updated (user_id, updated_at)
DROP INDEX IF EXISTS public.idx_savings_transactions_user;    -- covered by idx_savings_transactions_user_updated (user_id, updated_at)

-- 3 ----------------------------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_avatar_image_path_len' AND conrelid = 'public.profiles'::regclass) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_avatar_image_path_len
      CHECK (avatar_image_path IS NULL OR length(avatar_image_path) <= 300000) NOT VALID;
  END IF;
END $$;
ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_avatar_image_path_len;

-- 4 ----------------------------------------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_user_directory(text, integer, integer, text, text, text, boolean);
CREATE OR REPLACE FUNCTION public.admin_user_directory(p_search text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0,
  p_order text DEFAULT 'created_desc'::text, p_plan text DEFAULT NULL::text, p_state text DEFAULT NULL::text,
  p_match_email boolean DEFAULT false, p_with_total boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  result jsonb;
  q text := NULLIF(btrim(p_search), '');
  qpat text := replace(replace(replace(NULLIF(btrim(p_search), ''), '\', '\\'), '%', '\%'), '_', '\_');
  lim integer := LEAST(GREATEST(p_limit, 1), 200);
  off integer := GREATEST(p_offset, 0);
BEGIN
  IF p_order IN ('active_desc', 'expenses_desc') OR p_state = 'inactive' THEN
    WITH base AS (
      SELECT u.id, u.email, u.created_at, u.last_sign_in_at, u.banned_until,
             (u.email_confirmed_at IS NOT NULL) AS confirmed,
             COALESCE(u.raw_app_meta_data->>'provider', 'email') AS provider,
             COALESCE(NULLIF(btrim(p.display_name), ''), NULLIF(btrim(p.name), ''), NULLIF(btrim(u.raw_user_meta_data->>'full_name'), ''), NULLIF(btrim(u.raw_user_meta_data->>'name'), '')) AS name, p.country, p.base_currency::text AS currency,
             COALESCE(e.plan_key, (SELECT key FROM plans WHERE is_default LIMIT 1)) AS plan_key,
             COALESCE(e.status, 'active') AS plan_status,
             (SELECT max(a.last_event_at) FROM app_activity_days a WHERE a.user_id = u.id) AS last_active_at,
             (SELECT count(*) FROM expenses x WHERE x.user_id = u.id AND x.deleted_at IS NULL) AS expenses,
             COALESCE(s.sms_tracking_enabled, false) AS sms_enabled,
             (SELECT string_agg(DISTINCT t.platform, ',') FROM push_tokens t WHERE t.user_id = u.id) AS platforms
      FROM auth.users u
      LEFT JOIN profiles p ON p.id = u.id
      LEFT JOIN user_entitlements e ON e.user_id = u.id
      LEFT JOIN user_settings s ON s.user_id = u.id
      WHERE (q IS NULL OR (CASE WHEN p_match_email THEN u.email ELSE private.mask_email(u.email) END) ILIKE '%' || qpat || '%' OR p.name ILIKE '%' || qpat || '%' OR p.display_name ILIKE '%' || qpat || '%' OR u.raw_user_meta_data->>'full_name' ILIKE '%' || qpat || '%' OR u.id::text = q)
        AND (p_plan IS NULL OR COALESCE(e.plan_key, (SELECT key FROM plans WHERE is_default LIMIT 1)) = p_plan)
    ), filtered AS (
      SELECT * FROM base
      WHERE (p_state IS NULL
        OR (p_state = 'banned' AND banned_until IS NOT NULL AND banned_until > now())
        OR (p_state = 'unconfirmed' AND NOT confirmed)
        OR (p_state = 'sms' AND sms_enabled)
        OR (p_state = 'inactive' AND (last_active_at IS NULL OR last_active_at < now() - interval '30 days')))
    ), page AS (
      SELECT * FROM filtered
      ORDER BY
        CASE WHEN p_order = 'active_desc'   THEN last_active_at END DESC NULLS LAST,
        CASE WHEN p_order = 'expenses_desc' THEN expenses END DESC,
        CASE WHEN p_order = 'created_asc'   THEN created_at END ASC,
        CASE WHEN p_order = 'email_asc'     THEN email END ASC,
        created_at DESC, id DESC
      LIMIT lim OFFSET off
    )
    SELECT jsonb_build_object(
      'total', CASE WHEN p_with_total THEN (SELECT count(*) FROM filtered) END,
      'rows', COALESCE((SELECT jsonb_agg(to_jsonb(page)) FROM page), '[]'::jsonb)
    ) INTO result;
  ELSE
    WITH cheap AS (
      SELECT u.id, u.email, u.created_at, u.last_sign_in_at, u.banned_until,
             (u.email_confirmed_at IS NOT NULL) AS confirmed,
             COALESCE(u.raw_app_meta_data->>'provider', 'email') AS provider,
             COALESCE(NULLIF(btrim(p.display_name), ''), NULLIF(btrim(p.name), ''), NULLIF(btrim(u.raw_user_meta_data->>'full_name'), ''), NULLIF(btrim(u.raw_user_meta_data->>'name'), '')) AS name, p.country, p.base_currency::text AS currency,
             COALESCE(e.plan_key, (SELECT key FROM plans WHERE is_default LIMIT 1)) AS plan_key,
             COALESCE(e.status, 'active') AS plan_status,
             COALESCE(s.sms_tracking_enabled, false) AS sms_enabled
      FROM auth.users u
      LEFT JOIN profiles p ON p.id = u.id
      LEFT JOIN user_entitlements e ON e.user_id = u.id
      LEFT JOIN user_settings s ON s.user_id = u.id
      WHERE (q IS NULL OR (CASE WHEN p_match_email THEN u.email ELSE private.mask_email(u.email) END) ILIKE '%' || qpat || '%' OR p.name ILIKE '%' || qpat || '%' OR p.display_name ILIKE '%' || qpat || '%' OR u.raw_user_meta_data->>'full_name' ILIKE '%' || qpat || '%' OR u.id::text = q)
        AND (p_plan IS NULL OR COALESCE(e.plan_key, (SELECT key FROM plans WHERE is_default LIMIT 1)) = p_plan)
        AND (p_state IS NULL
          OR (p_state = 'banned' AND u.banned_until IS NOT NULL AND u.banned_until > now())
          OR (p_state = 'unconfirmed' AND u.email_confirmed_at IS NULL)
          OR (p_state = 'sms' AND COALESCE(s.sms_tracking_enabled, false)))
    ), page AS (
      SELECT *, row_number() OVER (
        ORDER BY
          CASE WHEN p_order = 'created_asc' THEN created_at END ASC,
          CASE WHEN p_order = 'email_asc'   THEN email END ASC,
          created_at DESC, id DESC
      ) AS rn
      FROM cheap
      ORDER BY rn
      LIMIT lim OFFSET off
    )
    SELECT jsonb_build_object(
      'total', CASE WHEN p_with_total THEN (SELECT count(*) FROM cheap) END,
      'rows', COALESCE((
        SELECT jsonb_agg(to_jsonb(r) - 'rn' ORDER BY r.rn)
        FROM (
          SELECT page.*,
                 (SELECT max(a.last_event_at) FROM app_activity_days a WHERE a.user_id = page.id) AS last_active_at,
                 (SELECT count(*) FROM expenses x WHERE x.user_id = page.id AND x.deleted_at IS NULL) AS expenses,
                 (SELECT string_agg(DISTINCT t.platform, ',') FROM push_tokens t WHERE t.user_id = page.id) AS platforms
          FROM page
        ) r
      ), '[]'::jsonb)
    ) INTO result;
  END IF;
  RETURN result;
END $function$;

-- Admin RPCs are service-role only (0314).
REVOKE ALL ON FUNCTION public.admin_user_directory(text, integer, integer, text, text, text, boolean, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_directory(text, integer, integer, text, text, text, boolean, boolean) TO service_role;
