-- Empty strings from the API become NULL, so the portal does not show blank areas and versions.
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
  VALUES (p_user, NULLIF(p_email, ''), left(p_subject, 200), cat, prio, 'in_app', p_kind, NULLIF(p_area, ''), p_severity, p_state,
          p_confidence, NULLIF(p_version, ''), NULLIF(p_platform, ''), COALESCE(p_context, '{}'::jsonb), now() + first_due, now() + interval '5 days')
  RETURNING support_tickets.id, support_tickets.number INTO t_id, t_no;
  INSERT INTO support_ticket_messages (ticket_id, author_type, author_label, body) VALUES (t_id, 'user', 'Customer', left(p_body, 10000));
  IF p_to_linear THEN
    INSERT INTO integration_outbox (kind, ticket_id, idempotency_key, payload)
    VALUES ('linear.issue', t_id, 'ticket:' || t_id::text,
            jsonb_build_object('number', t_no, 'kind', p_kind, 'area', NULLIF(p_area, ''), 'severity', p_severity, 'subject', left(p_subject, 200),
                               'platform', NULLIF(p_platform, ''), 'version', NULLIF(p_version, '')));
  END IF;
  RETURN QUERY SELECT t_id, t_no;
END $$;
REVOKE EXECUTE ON FUNCTION public.support_submit(uuid, text, text, text, text, text, text, text, real, text, text, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.support_submit(uuid, text, text, text, text, text, text, text, real, text, text, jsonb, boolean) TO service_role;
