-- QA-47 data repair: SMS purchases whose bank printed the next day (bank clock / posting date) were booked one day
-- after they were captured. Exactly 10 rows (2 users), listed by a SELECT on 2026-11-19: SMS-linked, live, and
-- expense_date = capture day (occurred_at in the user's time zone) + 1. The date becomes the capture day; the
-- condition is repeated so a second run, or a row the user re-dated since, changes nothing.
UPDATE public.expenses e
SET expense_date = (e.occurred_at AT TIME ZONE coalesce(us.timezone, 'Africa/Cairo'))::date, updated_at = now()
FROM public.expenses e2
LEFT JOIN public.user_settings us ON us.user_id = e2.user_id
WHERE e2.id = e.id
  AND e.id IN (
    '7031be0d-fc74-404a-82c6-427c5c78df91', '52fcbb7d-38d1-4e9c-adf8-450326bebb93', '07a04766-041c-484f-a7ae-0775c98c58c8',
    '6c6d7321-a234-4558-925f-1b457bc6c2ef', '4d4ff64b-e31d-485c-bfcb-62a6c9331ff7', '50dc3d53-5b76-491f-9f37-7a1b71c17d6c',
    '4e6bfdcb-356a-4b5e-9bec-c65a6d5d92d6', '6aa36035-d977-456f-b572-4c755752b1f6', '94f1b431-946c-4016-867f-f603fb43b716',
    '467ff52a-c64d-4e51-8377-3d3cfd9a4175'
  )
  AND e.sms_log_id IS NOT NULL
  AND e.expense_date = (e.occurred_at AT TIME ZONE coalesce(us.timezone, 'Africa/Cairo'))::date + 1;
