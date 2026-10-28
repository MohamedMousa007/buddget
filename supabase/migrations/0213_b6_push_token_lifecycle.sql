-- B6 / O17: push token lifecycle. Additive: a new function and a new pg_cron job; housekeeping() and every existing
-- signature stay as they are.
--
-- Audit before applying (read-only, run first and keep the numbers):
--   SELECT count(*) AS tokens, count(DISTINCT user_id) AS users,
--          count(*) FILTER (WHERE updated_at < now() - interval '90 days') AS stale_90d,
--          count(*) FILTER (WHERE device_id IS NULL) AS null_device,
--          count(*) FILTER (WHERE device_id IS NULL AND updated_at < now() - interval '60 days') AS null_device_60d
--   FROM public.push_tokens;
--   SELECT count(*) AS on_revoked_device FROM public.push_tokens t
--   JOIN public.user_devices d ON d.user_id = t.user_id AND d.device_id = t.device_id AND d.revoked_at IS NOT NULL;
--   SELECT count(*) AS shadowed_null FROM public.push_tokens n
--   WHERE n.device_id IS NULL AND EXISTS (SELECT 1 FROM public.push_tokens k
--     WHERE k.user_id = n.user_id AND k.platform = n.platform AND k.device_id IS NOT NULL AND k.updated_at > n.updated_at);
--
-- Rules (a token is re-registered on every launch, so updated_at is its heartbeat):
--   1. untouched for 90 days: gone (the app is not opening, FCM would reject it soon anyway)
--   2. legacy token with no device_id, untouched for 60 days: gone (pushTargets cannot place it on any device)
--   3. legacy no-device token older than 7 days and shadowed by a newer token of the same user and platform that has a device_id: gone
--   4. token whose device was revoked by the user: gone

CREATE OR REPLACE FUNCTION public.push_token_sweep() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  n_stale integer; n_legacy integer; n_shadowed integer; n_revoked integer;
BEGIN
  DELETE FROM push_tokens WHERE updated_at < now() - interval '90 days';
  GET DIAGNOSTICS n_stale = ROW_COUNT;

  DELETE FROM push_tokens WHERE device_id IS NULL AND updated_at < now() - interval '60 days';
  GET DIAGNOSTICS n_legacy = ROW_COUNT;

  DELETE FROM push_tokens n WHERE n.device_id IS NULL AND n.updated_at < now() - interval '7 days' AND EXISTS (
    SELECT 1 FROM push_tokens k
    WHERE k.user_id = n.user_id AND k.platform = n.platform AND k.device_id IS NOT NULL AND k.updated_at > n.updated_at);
  GET DIAGNOSTICS n_shadowed = ROW_COUNT;

  DELETE FROM push_tokens t USING user_devices d
  WHERE d.user_id = t.user_id AND d.device_id = t.device_id AND d.revoked_at IS NOT NULL;
  GET DIAGNOSTICS n_revoked = ROW_COUNT;

  RETURN jsonb_build_object('stale', n_stale, 'legacy_no_device', n_legacy, 'shadowed_no_device', n_shadowed, 'revoked_device', n_revoked);
END $$;
REVOKE ALL ON FUNCTION public.push_token_sweep() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.push_token_sweep() TO service_role;

SELECT cron.schedule('push-token-sweep', '45 1 * * *', $$SELECT public.push_token_sweep()$$);
