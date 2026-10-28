-- In-app support intake: the app creates tickets (it never did), with triage fields, SLA clocks, and an outbox for Linear.
-- Staff access stays through portal routes (service role); users reach their own tickets only through API routes.
-- Retention: tickets are kept (support history). integration_outbox rows are kept 30 days after they are sent.
ALTER TABLE public.support_tickets
  ADD COLUMN kind text NOT NULL DEFAULT 'support' CHECK (kind IN ('support','bug','feature','billing','account','praise','other')),
  ADD COLUMN area text,
  ADD COLUMN severity text NOT NULL DEFAULT 'normal' CHECK (severity IN ('low','normal','high','critical')),
  ADD COLUMN triage_state text NOT NULL DEFAULT 'triaged' CHECK (triage_state IN ('new','auto_triaged','needs_human','triaged')),
  ADD COLUMN triage_confidence real,
  ADD COLUMN duplicate_of uuid REFERENCES public.support_tickets(id) ON DELETE SET NULL,
  ADD COLUMN app_version text,
  ADD COLUMN platform text,
  ADD COLUMN context jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN votes integer NOT NULL DEFAULT 0,
  ADD COLUMN sla_first_response_due timestamptz,
  ADD COLUMN sla_resolution_due timestamptz;
CREATE INDEX support_tickets_triage_idx ON public.support_tickets (triage_state, created_at DESC) WHERE triage_state IN ('new','needs_human');

CREATE TABLE public.integration_outbox (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind            text NOT NULL CHECK (kind IN ('linear.issue')),
  ticket_id       uuid REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  payload         jsonb NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','dead')),
  attempts        integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  sent_at         timestamptz
);
CREATE INDEX integration_outbox_due_idx ON public.integration_outbox (next_attempt_at) WHERE status IN ('pending','failed');
ALTER TABLE public.integration_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.integration_outbox FROM anon, authenticated;

-- One round trip: ticket, first message and (for bugs) the Linear outbox row, or none of them.
CREATE OR REPLACE FUNCTION public.support_submit(
  p_user uuid, p_email text, p_kind text, p_subject text, p_body text, p_area text, p_severity text, p_state text,
  p_confidence real, p_platform text, p_version text, p_context jsonb, p_to_linear boolean
) RETURNS TABLE (ticket_id uuid, ticket_number bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  t_id uuid; t_no bigint; cat text; prio text; first_due interval;
BEGIN
  cat := CASE p_kind WHEN 'bug' THEN 'bug' WHEN 'feature' THEN 'feature' WHEN 'billing' THEN 'billing' WHEN 'account' THEN 'account' WHEN 'support' THEN 'general' ELSE 'other' END;
  prio := CASE p_severity WHEN 'critical' THEN 'urgent' WHEN 'high' THEN 'high' WHEN 'low' THEN 'low' ELSE 'normal' END;
  first_due := CASE WHEN prio = 'urgent' THEN interval '4 hours' ELSE interval '24 hours' END;
  INSERT INTO support_tickets (user_id, requester_email, subject, category, priority, source, kind, area, severity, triage_state,
                               triage_confidence, app_version, platform, context, sla_first_response_due, sla_resolution_due)
  VALUES (p_user, p_email, left(p_subject, 200), cat, prio, 'in_app', p_kind, p_area, p_severity, p_state,
          p_confidence, p_version, p_platform, COALESCE(p_context, '{}'::jsonb), now() + first_due, now() + interval '5 days')
  RETURNING support_tickets.id, support_tickets.number INTO t_id, t_no;
  INSERT INTO support_ticket_messages (ticket_id, author_type, author_label, body) VALUES (t_id, 'user', 'Customer', left(p_body, 10000));
  IF p_to_linear THEN
    INSERT INTO integration_outbox (kind, ticket_id, idempotency_key, payload)
    VALUES ('linear.issue', t_id, 'ticket:' || t_id::text,
            jsonb_build_object('number', t_no, 'kind', p_kind, 'area', p_area, 'severity', p_severity, 'subject', left(p_subject, 200),
                               'platform', p_platform, 'version', p_version));
  END IF;
  RETURN QUERY SELECT t_id, t_no;
END $$;
REVOKE EXECUTE ON FUNCTION public.support_submit(uuid, text, text, text, text, text, text, text, real, text, text, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.support_submit(uuid, text, text, text, text, text, text, text, real, text, text, jsonb, boolean) TO service_role;
