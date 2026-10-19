-- The SMS tracking screen reads its "parsed today" count straight from the browser, but 0113 revoked the view from
-- signed-in users, so every read failed with "permission denied". The view is security_invoker, so row security on
-- sms_parse_log still applies: each user sees only their own count.
GRANT SELECT ON public.sms_parse_today TO authenticated;
