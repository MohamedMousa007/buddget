-- One row per signed-in install of the app. It is where a phone is named, where it is chosen as an SMS collector,
-- and where a lost phone is removed. The server is the authority for collects_sms and notify_on_sms; a phone only
-- reports itself (platform, model, version, last seen). Service role only: the app reaches it through /api/devices.
CREATE TABLE IF NOT EXISTS public.user_devices (
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id     text NOT NULL,
  platform      text NOT NULL CHECK (platform IN ('ios','android','web')),
  model         text,
  name          text,
  app_version   text,
  collects_sms  boolean NOT NULL DEFAULT false,
  -- null = automatic: a phone that collects texts stays quiet when the account has other phones to tell.
  notify_on_sms boolean,
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  revoked_at    timestamptz,
  PRIMARY KEY (user_id, device_id)
);
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_devices FROM anon, authenticated;

ALTER TABLE public.push_tokens ADD COLUMN IF NOT EXISTS device_id text;
ALTER TABLE public.sms_parse_log ADD COLUMN IF NOT EXISTS device_id text;
CREATE INDEX IF NOT EXISTS sms_parse_log_device_idx ON public.sms_parse_log (user_id, device_id, received_at DESC) WHERE device_id IS NOT NULL;
