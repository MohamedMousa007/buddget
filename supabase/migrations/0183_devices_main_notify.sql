-- One main phone per account. A phone is pushed to when notify is true, or when notify is null and it is the main phone.
-- notify replaces notify_on_sms (kept for old clients, no longer read by the server).
ALTER TABLE public.user_devices
  ADD COLUMN IF NOT EXISTS is_main boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify boolean,
  ADD COLUMN IF NOT EXISTS push_permission text,
  ADD COLUMN IF NOT EXISTS last_sms_at timestamptz;

DO $$ BEGIN
  ALTER TABLE public.user_devices ADD CONSTRAINT user_devices_push_permission_check CHECK (push_permission IS NULL OR push_permission IN ('granted','denied'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Keep today's behaviour for existing phones: the old default was "a phone that collects texts stays quiet".
UPDATE public.user_devices SET notify = COALESCE(notify_on_sms, NOT collects_sms) WHERE notify IS NULL;

-- Someone must still be told: a main phone left silent with nobody else switched on follows the main-phone default instead,
-- so a single-phone account never goes quiet (the old code fell back to telling every phone).
UPDATE public.user_devices d SET notify = NULL
WHERE d.is_main AND d.revoked_at IS NULL AND d.notify = false
  AND NOT EXISTS (SELECT 1 FROM public.user_devices o WHERE o.user_id = d.user_id AND o.revoked_at IS NULL AND o.device_id <> d.device_id AND o.notify IS TRUE);

UPDATE public.user_devices d SET last_sms_at = s.last_at
FROM (SELECT user_id, device_id, max(received_at) AS last_at FROM public.sms_parse_log WHERE device_id IS NOT NULL GROUP BY 1, 2) s
WHERE s.user_id = d.user_id AND s.device_id = d.device_id AND d.last_sms_at IS NULL;

-- Main = the most recently seen phone that was already being notified, else the most recently seen phone.
WITH ranked AS (
  SELECT user_id, device_id,
         row_number() OVER (PARTITION BY user_id ORDER BY (notify IS TRUE) DESC, last_seen_at DESC) AS rn
  FROM public.user_devices WHERE revoked_at IS NULL
)
UPDATE public.user_devices d SET is_main = true
FROM ranked r WHERE r.rn = 1 AND r.user_id = d.user_id AND r.device_id = d.device_id AND NOT d.is_main;

CREATE UNIQUE INDEX IF NOT EXISTS user_devices_one_main_idx ON public.user_devices (user_id) WHERE is_main AND revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS push_tokens_device_idx ON public.push_tokens (user_id, device_id) WHERE device_id IS NOT NULL;
