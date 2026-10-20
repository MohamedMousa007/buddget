-- The daily notification run only needs the users who have something that can alert: an active recurring debt payment,
-- an active or trial subscription, or an active automatic goal. One query names them; everyone else is skipped.
CREATE OR REPLACE FUNCTION public.notification_candidate_users() RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT COALESCE(array_agg(u), '{}'::uuid[]) FROM (
    SELECT user_id AS u FROM recurring_debt_payments WHERE is_active AND deleted_at IS NULL
    UNION SELECT user_id FROM subscriptions WHERE deleted_at IS NULL AND status IN ('active', 'trial')
    UNION SELECT user_id FROM goals WHERE deleted_at IS NULL AND status = 'active' AND funding_mode <> 'manual'
  ) x;
$$;
REVOKE ALL ON FUNCTION public.notification_candidate_users() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notification_candidate_users() TO service_role;
