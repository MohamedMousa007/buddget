-- Per-user IANA timezone, written by the client from the device. NULL means "not reported yet": server code falls back to Africa/Cairo.
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS timezone text;
