-- Migration 0066: dedupe key for server-emitted notifications.
-- The cron + SMS pipeline emit notification rows idempotently; a stable
-- dedupe_key (e.g. 'recurring_due:<id>:<date>', 'month_end:<month>', 'sms:<logId>')
-- with a partial unique index guarantees re-evaluation never duplicates a row.
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS dedupe_key text;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_dedupe_uq
  ON public.notifications (user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;
