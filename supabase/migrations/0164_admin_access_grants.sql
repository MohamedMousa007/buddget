-- Break-glass access to a user's financial content (data tier T3). Service-role only, like every admin table.
-- Retention: grants are kept one year after the request (an access record), then removed by housekeeping in a later change.
CREATE TABLE public.admin_access_grants (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id       uuid NOT NULL REFERENCES public.admin_staff(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL,
  scope          text NOT NULL CHECK (scope IN ('financial')),
  reason         text NOT NULL CHECK (char_length(reason) BETWEEN 8 AND 500),
  ticket_number  integer,
  requested_at   timestamptz NOT NULL DEFAULT now(),
  approved_by    uuid REFERENCES public.admin_staff(id) ON DELETE SET NULL,
  approved_at    timestamptz,
  expires_at     timestamptz,
  revoked_at     timestamptz,
  extended       boolean NOT NULL DEFAULT false
);
CREATE INDEX admin_access_grants_lookup_idx ON public.admin_access_grants (staff_id, target_user_id, scope, expires_at DESC);
CREATE INDEX admin_access_grants_target_idx ON public.admin_access_grants (target_user_id, requested_at DESC);
ALTER TABLE public.admin_access_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_access_grants FROM anon, authenticated;

-- The check lives in SQL, so a route that forgets it still cannot read financial content.
CREATE OR REPLACE FUNCTION public.admin_has_grant(p_staff uuid, p_user uuid, p_scope text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_access_grants
    WHERE staff_id = p_staff AND target_user_id = p_user AND scope = p_scope
      AND approved_at IS NOT NULL AND revoked_at IS NULL AND expires_at > now()
  );
$$;

-- A bounded snapshot of what support needs to see: accounts, recent money in and out, debts, goals, the live plan.
CREATE OR REPLACE FUNCTION public.admin_user_financial_snapshot(p_staff uuid, p_user uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT admin_has_grant(p_staff, p_user, 'financial') THEN
    RAISE EXCEPTION 'No active access grant' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'accounts', (SELECT COALESCE(jsonb_agg(jsonb_build_object('name', name, 'type', type, 'currency', currency, 'opening_balance', opening_balance, 'closed', closed_at IS NOT NULL) ORDER BY created_at), '[]'::jsonb)
                 FROM (SELECT * FROM payment_methods WHERE user_id = p_user AND deleted_at IS NULL ORDER BY created_at LIMIT 30) a),
    'expenses', (SELECT COALESCE(jsonb_agg(jsonb_build_object('date', expense_date, 'description', description, 'category', category, 'amount', amount, 'currency', currency) ORDER BY expense_date DESC), '[]'::jsonb)
                 FROM (SELECT * FROM expenses WHERE user_id = p_user AND deleted_at IS NULL ORDER BY expense_date DESC LIMIT 30) e),
    'income', (SELECT COALESCE(jsonb_agg(jsonb_build_object('date', received_date, 'name', name, 'amount', amount, 'currency', currency, 'status', status) ORDER BY received_date DESC), '[]'::jsonb)
               FROM (SELECT * FROM income_events WHERE user_id = p_user AND deleted_at IS NULL ORDER BY received_date DESC LIMIT 10) i),
    'debts', (SELECT COALESCE(jsonb_agg(jsonb_build_object('name', name, 'type', debt_type, 'direction', direction, 'starting_balance', starting_balance, 'currency', currency, 'status', status)), '[]'::jsonb)
              FROM (SELECT * FROM debts WHERE user_id = p_user AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 20) d),
    'goals', (SELECT COALESCE(jsonb_agg(jsonb_build_object('name', name, 'target_amount', target_amount, 'currency', currency, 'target_date', target_date, 'status', status)), '[]'::jsonb)
              FROM (SELECT * FROM goals WHERE user_id = p_user AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 20) g),
    'plan', (SELECT jsonb_build_object('name', name, 'status', status) FROM budget_plans WHERE user_id = p_user AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1)
  );
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_has_grant(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_user_financial_snapshot(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_has_grant(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_user_financial_snapshot(uuid, uuid) TO service_role;
