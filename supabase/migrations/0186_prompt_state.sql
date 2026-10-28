-- Prompts the user has settled for good (zakat basis, "keep separate", "not a subscription", ignored accounts).
-- Stored with the account so a new phone or a reinstall does not ask again. Shape: { "<key>": "<iso time dismissed>" }.
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS prompt_state jsonb NOT NULL DEFAULT '{}'::jsonb;
