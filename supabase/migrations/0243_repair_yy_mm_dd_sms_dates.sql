-- DBI-1 data repair: SMS that print yy/mm/dd ("26/10/24") were read as dd/mm/yy and filed in the wrong year.
-- Exactly 5 rows: the date becomes the Cairo calendar day the SMS was received (sms_parse_log.received_at),
-- or, for the one expense with no SMS link, the Cairo day it was created. No occurrence_date is set on these rows
-- and no unique index involves the date, so nothing can collide.
UPDATE public.income_events i
SET received_date = (l.received_at AT TIME ZONE 'Africa/Cairo')::date, updated_at = now()
FROM public.sms_parse_log l
WHERE l.id = i.sms_log_id
  AND i.id IN ('0473c90c-5074-49d1-82f9-843137593a3e', '1202a9e4-b8cc-4941-badb-a003b4df113c', '8290b9ea-8073-465e-b0de-65f3b99c315f')
  AND abs(i.received_date - (l.received_at AT TIME ZONE 'Africa/Cairo')::date) > 60;

UPDATE public.expenses e
SET expense_date = (l.received_at AT TIME ZONE 'Africa/Cairo')::date, updated_at = now()
FROM public.sms_parse_log l
WHERE l.id = e.sms_log_id
  AND e.id = '944ebd53-001a-4014-9e3b-392aa67143b7'
  AND abs(e.expense_date - (l.received_at AT TIME ZONE 'Africa/Cairo')::date) > 60;

UPDATE public.expenses
SET expense_date = (created_at AT TIME ZONE 'Africa/Cairo')::date, updated_at = now()
WHERE id = '41c10f37-5a3e-417b-aaa8-037717f0e4c6'
  AND sms_log_id IS NULL
  AND expense_date < '2020-01-01';
