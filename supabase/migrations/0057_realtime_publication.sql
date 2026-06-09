-- The supabase_realtime publication had NO tables — SmsRealtimeSync subscribed
-- to sms_parse_log changes but could never receive an event, so the dashboard
-- never live-updated after an SMS expense was created.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'sms_parse_log'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sms_parse_log;
  END IF;
END $$;
