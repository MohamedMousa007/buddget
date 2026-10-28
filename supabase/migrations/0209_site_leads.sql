-- Beta list sign-ups and contact messages from the public website. Written only by the service role
-- (the /api/site/lead route); RLS is on with no policies, so no client key can read or write it.
CREATE TABLE IF NOT EXISTS public.site_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('waitlist', 'contact')),
  email text NOT NULL CHECK (char_length(email) <= 254),
  name text CHECK (name IS NULL OR char_length(name) <= 120),
  message text CHECK (message IS NULL OR char_length(message) <= 4000),
  locale text NOT NULL CHECK (locale IN ('en', 'ar')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS site_leads_waitlist_email_key ON public.site_leads (lower(email)) WHERE kind = 'waitlist';
CREATE INDEX IF NOT EXISTS site_leads_created_at_idx ON public.site_leads (created_at DESC);

ALTER TABLE public.site_leads ENABLE ROW LEVEL SECURITY;
