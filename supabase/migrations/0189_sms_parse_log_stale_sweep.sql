-- D1: sms_heal_stuck() (0140, every 5 minutes) only looks at the last 2 days to stay on the received_at index, so rows
-- stranded before it ran or while it was unscheduled stay 'processing' forever. Sweep that backlog once.
UPDATE public.sms_parse_log
   SET status = 'failed', failure_code = 'timed_out'
 WHERE status = 'processing' AND received_at <= now() - interval '2 days';
