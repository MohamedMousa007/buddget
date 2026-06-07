-- User-configurable SMS keyword list, merged with built-in bank vocabulary at runtime.
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS custom_sms_keywords text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.user_settings.custom_sms_keywords IS
  'User-defined keywords that trigger SMS forwarding to /api/sms/parse.
   Merged with the built-in Egyptian-bank keyword list in isBankishMessage().';
