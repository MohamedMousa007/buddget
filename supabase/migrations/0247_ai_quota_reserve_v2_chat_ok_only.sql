-- QA6 BAI-1. 0230 made the daily chat message cap (ai_chat_per_day) count only status 'ok', but patched ONLY ai_quota_reserve (v1).
-- The app calls ai_quota_reserve_v2 first, whose chat per-day subquery still counted every chat event, so failed turns burned the cap.
-- Same replace pattern as 0230, applied to v2. Idempotent; raises if the clause is missing.
-- ROLLBACK: remove "and status = 'ok'" from the chat clause of ai_quota_reserve_v2.
DO $mig$
DECLARE
  d text;
  r text := 'public.ai_quota_reserve_v2(uuid,uuid,text,numeric)';
BEGIN
  d := pg_get_functiondef(r::regprocedure);
  IF d NOT LIKE '%feature = ''chat'' and status = ''ok''%' THEN
    d := replace(d, 'feature = ''chat'' and created_at > t - interval ''24 hours''', 'feature = ''chat'' and status = ''ok'' and created_at > t - interval ''24 hours''');
    IF d NOT LIKE '%feature = ''chat'' and status = ''ok''%' THEN RAISE EXCEPTION 'ai_quota_reserve_v2: chat per-day clause not found'; END IF;
    EXECUTE d;
  END IF;
END
$mig$;
