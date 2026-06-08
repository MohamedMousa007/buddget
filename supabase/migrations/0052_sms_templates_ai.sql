-- Hybrid AI/Static Parsing Pipeline: local pattern database.
-- When a new SMS sender format is parsed by Gemini at >= 0.9 confidence,
-- the route asynchronously learns a regex and stores it here.
-- Subsequent SMS from the same sender match the regex and bypass Gemini entirely.

CREATE TABLE IF NOT EXISTS public.sms_tracking_templates_ai (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender          TEXT        NOT NULL,
  regex_pattern   TEXT        NOT NULL,
  template_sample TEXT        NOT NULL,
  mapping_rules   JSONB       NOT NULL,
  ai_enabled      BOOLEAN     NOT NULL DEFAULT true,
  match_count     INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_templates_sender
  ON public.sms_tracking_templates_ai (sender);

-- Silently ignore duplicate patterns for the same sender (handles concurrent learning race)
CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_templates_sender_pattern
  ON public.sms_tracking_templates_ai (sender, md5(regex_pattern));

-- Atomic counter increment — prevents lost-update under concurrent template hits
CREATE OR REPLACE FUNCTION public.increment_sms_template_match_count(p_id UUID)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.sms_tracking_templates_ai
  SET match_count = match_count + 1, updated_at = now()
  WHERE id = p_id;
$$;

-- Only service-role backend can access this table; no direct user-level access
ALTER TABLE public.sms_tracking_templates_ai ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON public.sms_tracking_templates_ai
  FOR ALL TO authenticated USING (false);

COMMENT ON TABLE public.sms_tracking_templates_ai IS
  'Learned regex patterns for bank SMS parsing. Populated automatically by the AI parsing pipeline.
   When a template matches an incoming SMS, Gemini is bypassed entirely.';
