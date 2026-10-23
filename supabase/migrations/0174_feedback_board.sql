-- Feedback board: staff publish a neutral, staff-written title for an idea; users vote up or down.
-- User-written text is never shown to other users. 10 net votes sends the idea to Linear once.
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS board_state text NOT NULL DEFAULT 'hidden' CHECK (board_state IN ('hidden','published','planned','shipped')),
  ADD COLUMN IF NOT EXISTS board_title text,
  ADD COLUMN IF NOT EXISTS board_summary text;
CREATE INDEX IF NOT EXISTS support_tickets_board_idx ON public.support_tickets (votes DESC) WHERE board_state <> 'hidden';

CREATE TABLE IF NOT EXISTS public.feedback_votes (
  ticket_id  uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  value      smallint NOT NULL CHECK (value IN (-1, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticket_id, user_id)
);
CREATE INDEX IF NOT EXISTS feedback_votes_user_idx ON public.feedback_votes (user_id);
ALTER TABLE public.feedback_votes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.feedback_votes FROM anon, authenticated;

-- value 0 removes the vote. Returns the new score and whether this vote pushed the idea over the Linear threshold.
CREATE OR REPLACE FUNCTION public.cast_feedback_vote(p_user uuid, p_ticket uuid, p_value integer, p_threshold integer DEFAULT 10)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE t support_tickets%ROWTYPE; score integer; queued boolean := false;
BEGIN
  SELECT * INTO t FROM support_tickets WHERE id = p_ticket AND board_state <> 'hidden' FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF p_value = 0 THEN DELETE FROM feedback_votes WHERE ticket_id = p_ticket AND user_id = p_user;
  ELSE INSERT INTO feedback_votes (ticket_id, user_id, value) VALUES (p_ticket, p_user, p_value)
       ON CONFLICT (ticket_id, user_id) DO UPDATE SET value = EXCLUDED.value; END IF;
  SELECT coalesce(sum(value), 0) INTO score FROM feedback_votes WHERE ticket_id = p_ticket;
  UPDATE support_tickets SET votes = score WHERE id = p_ticket;
  IF score >= p_threshold AND t.linear_issue_id IS NULL THEN
    INSERT INTO integration_outbox (kind, ticket_id, idempotency_key, payload)
    VALUES ('linear.issue', p_ticket, 'ticket:' || p_ticket::text,
            jsonb_build_object('number', t.number, 'kind', 'feature', 'area', t.area, 'severity', 'normal',
                               'subject', left(coalesce(t.board_title, t.subject), 200), 'platform', t.platform, 'version', t.app_version))
    ON CONFLICT (idempotency_key) DO NOTHING;
    queued := FOUND;
  END IF;
  RETURN jsonb_build_object('votes', score, 'queued', queued);
END $$;
REVOKE EXECUTE ON FUNCTION public.cast_feedback_vote(uuid, uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cast_feedback_vote(uuid, uuid, integer, integer) TO service_role;
