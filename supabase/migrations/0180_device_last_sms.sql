-- Latest captured bank text per device, in one pass (the devices list used to ask once per phone).
CREATE OR REPLACE FUNCTION public.user_device_last_sms(p_user uuid)
RETURNS TABLE (device_id text, last_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT device_id, max(received_at) FROM sms_parse_log WHERE user_id = p_user AND device_id IS NOT NULL GROUP BY device_id
$$;
REVOKE EXECUTE ON FUNCTION public.user_device_last_sms(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_device_last_sms(uuid) TO service_role;
