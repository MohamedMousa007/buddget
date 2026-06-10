-- Migration 0062: Remove auto_promotion_enabled — auto-promotion is always on.
-- The toggle was confusing (users expected it always on) and the feature is
-- now enabled unconditionally; the column is dead weight.
ALTER TABLE public.sms_promotion_config
  DROP COLUMN IF EXISTS auto_promotion_enabled;
