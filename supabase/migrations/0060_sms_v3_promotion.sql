-- Migration 0060: SMS v3 — Promotion tier, config table, DB function

-- 1. sms_tracking_templates_ai: add promotion tier + audit columns
ALTER TABLE public.sms_tracking_templates_ai
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'learned'
    CHECK (tier IN ('learned', 'promoted')),
  ADD COLUMN IF NOT EXISTS kind text,
  ADD COLUMN IF NOT EXISTS unique_user_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_ai_confidence numeric(4,3),
  ADD COLUMN IF NOT EXISTS last_matched_at timestamptz,
  ADD COLUMN IF NOT EXISTS promoted_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_promoted boolean NOT NULL DEFAULT false;

-- Index for promoted-tier fast lookup (cache warm-up query)
CREATE INDEX IF NOT EXISTS idx_sms_templates_promoted
  ON public.sms_tracking_templates_ai (sender, tier)
  WHERE tier = 'promoted';

-- 2. sms_promotion_config singleton table (admin-editable criteria)
CREATE TABLE IF NOT EXISTS public.sms_promotion_config (
  id                     int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  min_match_count        int NOT NULL DEFAULT 50,
  min_unique_users       int NOT NULL DEFAULT 3,
  min_age_days           int NOT NULL DEFAULT 7,
  max_failure_rate       numeric(4,3) NOT NULL DEFAULT 0.05,
  min_avg_confidence     numeric(4,3) NOT NULL DEFAULT 0.90,
  auto_promotion_enabled boolean NOT NULL DEFAULT false,
  updated_at             timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.sms_promotion_config DEFAULT VALUES ON CONFLICT DO NOTHING;

-- 3. RLS: service_role only (admin API uses service role key)
ALTER TABLE public.sms_promotion_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON public.sms_promotion_config
  USING (auth.role() = 'service_role');

-- 4. Legacy column comments on sms_parse_log (never dropped — keep for historical rows)
COMMENT ON COLUMN public.sms_parse_log.is_duplicate IS 'Legacy v1 dedup flag. Never set true in v2+. Keep for historical rows.';
COMMENT ON COLUMN public.sms_parse_log.awaiting_confirmation IS 'Legacy v1 confirmation gate flag. Keep for historical rows.';
COMMENT ON COLUMN public.sms_parse_log.parsed_at IS 'Legacy v1 stale-claim CAS timestamp. Keep for historical rows.';

-- 5. DB function: returns templates eligible for promotion based on current config
CREATE OR REPLACE FUNCTION public.check_sms_promotion_eligibility()
RETURNS TABLE (
  template_id uuid,
  sender text,
  match_count int,
  unique_user_count int,
  age_days int,
  failure_rate numeric,
  avg_ai_confidence numeric
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id AS template_id,
    t.sender,
    t.match_count,
    t.unique_user_count,
    EXTRACT(DAY FROM now() - t.created_at)::int AS age_days,
    COALESCE(
      (
        SELECT COUNT(CASE WHEN l.parsed_ok = false THEN 1 END)::numeric
          / NULLIF(COUNT(*)::numeric, 0)
        FROM sms_parse_log l
        WHERE l.sender = t.sender
          AND l.created_at > t.created_at
      ),
      0
    ) AS failure_rate,
    COALESCE(t.avg_ai_confidence, 1.0) AS avg_ai_confidence
  FROM sms_tracking_templates_ai t, sms_promotion_config c
  WHERE t.tier = 'learned'
    AND t.ai_enabled = true
    AND t.match_count >= c.min_match_count
    AND t.unique_user_count >= c.min_unique_users
    AND EXTRACT(DAY FROM now() - t.created_at) >= c.min_age_days
    AND COALESCE(t.avg_ai_confidence, 1.0) >= c.min_avg_confidence
    AND COALESCE(
      (
        SELECT COUNT(CASE WHEN l.parsed_ok = false THEN 1 END)::numeric
          / NULLIF(COUNT(*)::numeric, 0)
        FROM sms_parse_log l
        WHERE l.sender = t.sender
          AND l.created_at > t.created_at
      ),
      0
    ) <= c.max_failure_rate;
END;
$$;
