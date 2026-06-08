ALTER TABLE public.sms_parse_log
  ADD COLUMN IF NOT EXISTS parse_method text
  CHECK (parse_method IN ('ai', 'static'));

COMMENT ON COLUMN public.sms_parse_log.parse_method IS
  'ai = Gemini API path; static = regex template bypass. NULL = iOS/webhook ingest pipeline.';
