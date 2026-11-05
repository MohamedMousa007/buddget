-- QA round 5, AI-1. A failed chat call (upstream error, empty, blocked) was settled with status 'error' but still counted toward
-- the daily message cap (ai_chat_per_day) and the chat turn count: 7 of 10 live chat events in 30 days were failures. Receipt and
-- voice already count only status 'ok'. Chat now does the same; the rate limit and unit windows still bound failing calls.
DO $mig$
DECLARE
  d text;
  r text := 'public.ai_quota_reserve(uuid,uuid,text,numeric)';
  s text := 'public.ai_quota_settle(uuid,uuid,numeric,integer,integer,integer,text,text,integer,text)';
BEGIN
  d := pg_get_functiondef(r::regprocedure);
  IF d NOT LIKE '%feature = ''chat'' and status = ''ok''%' THEN
    d := replace(d, 'feature = ''chat'' and created_at > t - interval ''24 hours''', 'feature = ''chat'' and status = ''ok'' and created_at > t - interval ''24 hours''');
    IF d NOT LIKE '%feature = ''chat'' and status = ''ok''%' THEN RAISE EXCEPTION 'ai_quota_reserve: chat per-day clause not found'; END IF;
    EXECUTE d;
  END IF;
  d := pg_get_functiondef(s::regprocedure);
  IF d NOT LIKE '%r.feature = ''chat'' and p_status = ''ok''%' THEN
    d := replace(d, 'when r.feature = ''chat'' then 1', 'when r.feature = ''chat'' and p_status = ''ok'' then 1');
    IF d NOT LIKE '%r.feature = ''chat'' and p_status = ''ok''%' THEN RAISE EXCEPTION 'ai_quota_settle: turn increment not found'; END IF;
    EXECUTE d;
  END IF;
END
$mig$;
