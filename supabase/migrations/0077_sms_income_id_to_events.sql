-- sms_parse_log.income_id was created (0046) referencing income_sources, but the
-- income ledger cutover made the SMS income path write income_events ids into it
-- (createSmsExpense inserts income_events; confirm/undo/AppShell read income_events).
-- An income_events id is not in income_sources → FK violation → the link never
-- persists and SMS-detected income gets stuck "awaiting confirmation".
-- Repoint the FK to income_events. Verified 0 dangling rows before applying.

ALTER TABLE public.sms_parse_log
  DROP CONSTRAINT IF EXISTS sms_parse_log_income_id_fkey;

ALTER TABLE public.sms_parse_log
  ADD CONSTRAINT sms_parse_log_income_id_fkey
  FOREIGN KEY (income_id) REFERENCES public.income_events (id) ON DELETE SET NULL;
