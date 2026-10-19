-- Transactional email templates (replaces Supabase's template editor), version history and delivery log.
-- Service role only: RLS on, no policies, grants revoked. All access goes through admin API routes.

CREATE TABLE public.email_scenarios (
  key text PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9_]{1,47}$'),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  locale text NOT NULL CHECK (locale IN ('en', 'ar')),
  subject text NOT NULL,
  preheader text NOT NULL DEFAULT '',
  html text NOT NULL,
  mode text NOT NULL DEFAULT 'visual' CHECK (mode IN ('visual', 'html')),
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL CHECK (status IN ('draft', 'published')),
  version int NOT NULL CHECK (version > 0),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_templates_size CHECK (octet_length(html) <= 102400),
  UNIQUE (key, locale, version)
);
-- One published row and one working draft per (key, locale).
CREATE UNIQUE INDEX email_templates_one_published ON public.email_templates (key, locale) WHERE status = 'published';
CREATE UNIQUE INDEX email_templates_one_draft ON public.email_templates (key, locale) WHERE status = 'draft';

CREATE TABLE public.email_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  locale text NOT NULL CHECK (locale IN ('en', 'ar')),
  version int NOT NULL,
  subject text NOT NULL,
  preheader text NOT NULL DEFAULT '',
  html text NOT NULL,
  mode text NOT NULL,
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  published_by uuid,
  published_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (key, locale, version)
);

-- Never holds tokens, codes or links: only who, which scenario, and what the provider said.
CREATE TABLE public.email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  to_email text NOT NULL,
  template_key text NOT NULL,
  locale text NOT NULL,
  provider_message_id text,
  status text NOT NULL CHECK (status IN ('queued', 'sent', 'delivered', 'bounced', 'complained', 'failed')),
  error text,
  latency_ms int,
  source text NOT NULL CHECK (source IN ('auth_hook', 'admin', 'system')),
  is_test boolean NOT NULL DEFAULT false
);
CREATE INDEX email_log_created_idx ON public.email_log (created_at DESC);
CREATE INDEX email_log_provider_idx ON public.email_log (provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE INDEX email_log_key_status_idx ON public.email_log (template_key, status, created_at DESC);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['email_scenarios', 'email_templates', 'email_template_versions', 'email_log'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

-- emails.view / emails.manage on the roles that run the platform.
UPDATE public.admin_roles SET permissions = permissions || ARRAY['emails.view', 'emails.manage']
  WHERE key IN ('admin', 'engineer') AND NOT permissions @> ARRAY['emails.view'];
UPDATE public.admin_roles SET permissions = permissions || ARRAY['emails.view']
  WHERE key IN ('support_lead', 'growth') AND NOT permissions @> ARRAY['emails.view'];
