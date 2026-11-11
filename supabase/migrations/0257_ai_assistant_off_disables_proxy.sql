-- QA6 BAI-6. Legacy /api/ai is billed as feature 'proxy' and was not covered by feature_overrides, so a user with
-- ai_assistant switched off kept full model access through it. ai_assistant=false now also disables 'proxy'.
-- Idempotent; raises if the anchor clause is missing.
-- ROLLBACK: remove the "ai_assistant proxy" line from ai_effective_limits.
DO $mig$
DECLARE
  d text;
  r text := 'public.ai_effective_limits(uuid)';
  a text := E'if mapped is not null then v_disabled := v_disabled || to_jsonb(mapped); end if;';
  n text := E'if mapped is not null then v_disabled := v_disabled || to_jsonb(mapped); end if;\n        if k = ''ai_assistant'' then v_disabled := v_disabled || to_jsonb(''proxy''::text); end if; -- ai_assistant proxy';
BEGIN
  d := pg_get_functiondef(r::regprocedure);
  IF d NOT LIKE '%ai_assistant proxy%' THEN
    IF position(a in d) = 0 THEN RAISE EXCEPTION 'ai_effective_limits: anchor not found'; END IF;
    d := replace(d, a, n);
    EXECUTE d;
  END IF;
END
$mig$;
