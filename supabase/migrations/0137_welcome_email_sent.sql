-- The welcome email goes out once per account. Claimed atomically (UPDATE ... WHERE welcome_email_sent_at IS NULL),
-- and everyone who already has an account counts as welcomed so deploying this never mails the existing user base.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS welcome_email_sent_at timestamptz;
UPDATE public.profiles SET welcome_email_sent_at = now() WHERE welcome_email_sent_at IS NULL;
