-- Admin portal auth rework: portal sign-in follows the app session (per-person switch) and the second factor is an
-- emailed code. The TOTP / recovery columns on admin_credentials are no longer read or written (kept, not dropped).
ALTER TABLE public.admin_credentials ADD COLUMN IF NOT EXISTS sso_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.admin_credentials ADD COLUMN IF NOT EXISTS setup_completed_at timestamptz;

UPDATE public.admin_credentials SET setup_completed_at = totp_confirmed_at
WHERE setup_completed_at IS NULL AND totp_confirmed_at IS NOT NULL;

ALTER TABLE public.admin_sessions DROP CONSTRAINT IF EXISTS admin_sessions_method_check;
ALTER TABLE public.admin_sessions ADD CONSTRAINT admin_sessions_method_check
  CHECK (method IN ('password_totp', 'biometric', 'recovery', 'password_email'));
