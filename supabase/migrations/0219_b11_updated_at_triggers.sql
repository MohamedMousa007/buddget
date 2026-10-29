-- B11 / Q14: updated_at triggers. NOT YET APPLIED.
-- Audit (live, read-only, 2026-10-29): 11 public tables have updated_at and not exactly one updated_at trigger.
--   income_sources has TWO identical triggers (trg_income_sources_updated -> touch_income_sources_updated_at(), trg_income_sources_updated_at -> set_updated_at(); both only set NEW.updated_at := now()). Drop the older one.
--   Missing a trigger and user/cron-written (get set_updated_at): push_tokens (27 rows), savings_month_summary (0 rows), merchant_category_overrides (0 rows).
--   Missing but deliberately left alone, written by code/admin with meaningful timestamps: asset_prices (provider time), email_templates, merchant_categories, platform_settings, sms_promotion_config, sms_sender_currency, sms_tracking_templates_ai.
-- Idempotent. No data change. touch_income_sources_updated_at() is kept (the function may still be referenced elsewhere).

DROP TRIGGER IF EXISTS trg_income_sources_updated ON public.income_sources;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['push_tokens','savings_month_summary','merchant_category_overrides'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = ('public.' || t)::regclass AND tgname = 'trg_' || t || '_updated_at') THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', 'trg_' || t || '_updated_at', t);
    END IF;
  END LOOP;
END $$;
