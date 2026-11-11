-- QA6 BAI-5. A hop reservation (feature chat_hop) skips the per-day and turn caps, and the server only infers "hop" from the
-- last message being a tool result, which a client can forge. Cap hops per chat at (turns + 1) * 3 (TURN_LIMITS.maxHops) so a
-- forged client cannot keep one chat alive past ai_chat_turns. Idempotent; raises if the anchor clause is missing.
-- ROLLBACK: remove the "chat_hop cap" line from the hop branch of ai_quota_reserve_v2.
DO $mig$
DECLARE
  d text;
  r text := 'public.ai_quota_reserve_v2(uuid,uuid,text,numeric)';
  a text := E'or v_chat.units >= (L ->> ''ai_chat_units_hard'')::numeric * 1.5 then';
  n text := E'or v_chat.units >= (L ->> ''ai_chat_units_hard'')::numeric * 1.5\n         or (select count(*) from (select 1 from public.ai_usage_events where chat_id = v_chat.chat_id and feature = ''chat_hop'' union all select 1 from public.ai_reservations where chat_id = v_chat.chat_id and feature = ''chat_hop'' and not settled and expires_at > t) h) >= (v_chat.turns + 1) * 3 -- chat_hop cap\n         then';
BEGIN
  d := pg_get_functiondef(r::regprocedure);
  IF d NOT LIKE '%chat_hop cap%' THEN
    IF position(a in d) = 0 THEN RAISE EXCEPTION 'ai_quota_reserve_v2: hop clause not found'; END IF;
    d := replace(d, a, n);
    EXECUTE d;
  END IF;
END
$mig$;
