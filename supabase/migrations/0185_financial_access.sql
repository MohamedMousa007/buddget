-- Financial access becomes owner-approved. Staff ask per user, for a short window or for good; only the owner decides.
-- Replaces the single users.financial permission with financial.request (may ask); financial.approve is owner-only in code.
ALTER TABLE public.admin_access_grants
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'one_time',
  ADD COLUMN IF NOT EXISTS denied_at timestamptz,
  ADD COLUMN IF NOT EXISTS note text;
DO $$ BEGIN
  ALTER TABLE public.admin_access_grants ADD CONSTRAINT admin_access_grants_mode_check CHECK (mode IN ('one_time','permanent'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.admin_access_grants ADD CONSTRAINT admin_access_grants_permanent_open CHECK (mode <> 'permanent' OR expires_at IS NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS admin_access_grants_pending_idx ON public.admin_access_grants (requested_at DESC) WHERE approved_at IS NULL AND denied_at IS NULL AND revoked_at IS NULL;

-- Users the owner has put out of reach of every staff member.
CREATE TABLE IF NOT EXISTS public.admin_financial_exclusions (
  user_id     uuid PRIMARY KEY,
  excluded_by uuid REFERENCES public.admin_staff(id) ON DELETE SET NULL,
  reason      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_financial_exclusions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_financial_exclusions FROM anon, authenticated;

-- Which of these users the staff member may read right now (list endpoints mask the rest). One query, not one per row.
CREATE OR REPLACE FUNCTION public.admin_granted_users(p_staff uuid, p_users uuid[]) RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT u FROM unnest(p_users) AS u WHERE public.admin_has_grant(p_staff, u, 'financial');
$$;
REVOKE EXECUTE ON FUNCTION public.admin_granted_users(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_granted_users(uuid, uuid[]) TO service_role;
