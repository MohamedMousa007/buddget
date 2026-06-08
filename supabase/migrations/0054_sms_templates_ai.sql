-- Local pattern database for SMS parsing bypassing Gemini.
-- Learned regexes from high-confidence Gemini parses enable instant, cost-free parsing of repeated bank SMS patterns.
CREATE TABLE IF NOT EXISTS public.sms_tracking_templates_ai (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender TEXT NOT NULL,
  regex_pattern TEXT NOT NULL,
  template_sample TEXT NOT NULL,
  mapping_rules JSONB NOT NULL, -- {"amountGroup":1, "currencyGroup":2, "merchantGroup":3, "lastFourGroup":null, "kindGroup":null}
  ai_enabled BOOLEAN NOT NULL DEFAULT true, -- admin can disable AI fallback for this pattern
  match_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_templates_user_sender
  ON public.sms_tracking_templates_ai (user_id, sender)
  WHERE ai_enabled = true;

CREATE INDEX IF NOT EXISTS idx_sms_templates_match_count
  ON public.sms_tracking_templates_ai (user_id, match_count DESC);

-- Atomic increment function for match_count (called after successful static parse).
CREATE OR REPLACE FUNCTION increment_sms_template_match_count(template_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.sms_tracking_templates_ai
  SET match_count = match_count + 1, updated_at = now()
  WHERE id = template_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE public.sms_tracking_templates_ai IS
  'User-learned regex patterns for SMS parsing. Created by Gemini when parsing confidence >= 0.9.
   Enables zero-API-cost parsing of repeated bank SMS formats.';

COMMENT ON COLUMN public.sms_tracking_templates_ai.mapping_rules IS
  'JSON object mapping capture group numbers to fields: {"amountGroup": 1, "currencyGroup": 2, ...}
   Groups are 1-indexed from the regex. Null group means field not extracted.';

COMMENT ON COLUMN public.sms_tracking_templates_ai.ai_enabled IS
  'When true, use this template for static matching. When false, skip to Gemini fallback.
   Admin toggles this to disable problematic patterns without deleting them.';
