-- Linear hand-off: where the issue ended up, and a claim step that two workers can run at once without sending twice.
ALTER TABLE public.support_tickets ADD COLUMN linear_issue_id text, ADD COLUMN linear_issue_url text;

-- Takes up to p_limit due rows, pushes each one's next attempt out (exponential, capped), and returns them.
-- A worker that crashes after claiming only delays the row; it does not lose it or send it twice at once.
CREATE OR REPLACE FUNCTION public.integration_outbox_claim(p_limit integer) RETURNS SETOF public.integration_outbox
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  UPDATE integration_outbox o
  SET attempts = o.attempts + 1,
      next_attempt_at = now() + (interval '1 minute' * power(2, least(o.attempts, 8))::int)
  WHERE o.id IN (
    SELECT id FROM integration_outbox
    WHERE status IN ('pending', 'failed') AND next_attempt_at <= now()
    ORDER BY next_attempt_at
    LIMIT GREATEST(1, LEAST(p_limit, 20))
    FOR UPDATE SKIP LOCKED
  )
  RETURNING o.*;
$$;
REVOKE EXECUTE ON FUNCTION public.integration_outbox_claim(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.integration_outbox_claim(integer) TO service_role;
