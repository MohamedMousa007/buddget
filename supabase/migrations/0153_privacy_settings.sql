-- Accounts refactor 4/5: per-surface balance hiding ({preset, hero, lists, notifications, widgets, buddgy}); empty = defaults (visible).
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS privacy jsonb NOT NULL DEFAULT '{}'::jsonb;
