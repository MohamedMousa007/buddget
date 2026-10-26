-- A user-chosen label can stand in for the last four digits on screen. last4 is still stored: SMS matching reads it.
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS label text;
DO $$ BEGIN
  ALTER TABLE public.payment_methods ADD CONSTRAINT payment_methods_label_len CHECK (label IS NULL OR char_length(label) BETWEEN 1 AND 24);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- "Check against my messages" is no longer a choice: every account is checked.
UPDATE public.payment_methods SET track_sms = true WHERE track_sms = false;
