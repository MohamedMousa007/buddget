-- Phase 3: Shared / household budgets, notifications, invite tokens

-- ---------------------------------------------------------------------------
-- shared_budget_plans
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shared_budget_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Shared Budget',
  owner_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shared_budget_plans_owner_id_idx ON public.shared_budget_plans (owner_id);

-- ---------------------------------------------------------------------------
-- shared_budget_members (user_id nullable while invite is email-only pending)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shared_budget_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.shared_budget_plans (id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users (id) ON DELETE CASCADE,
  invited_email TEXT,
  invited_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'viewer')),
  sync_transactions BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined')),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  CONSTRAINT shared_budget_members_plan_user_unique UNIQUE (plan_id, user_id),
  CONSTRAINT shared_budget_members_plan_email_unique UNIQUE (plan_id, invited_email),
  CONSTRAINT shared_budget_members_user_or_email CHECK (user_id IS NOT NULL OR invited_email IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS shared_budget_members_plan_id_idx ON public.shared_budget_members (plan_id);
CREATE INDEX IF NOT EXISTS shared_budget_members_user_id_idx ON public.shared_budget_members (user_id);

-- ---------------------------------------------------------------------------
-- shared_budget_data
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shared_budget_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.shared_budget_plans (id) ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users (id),
  CONSTRAINT shared_budget_data_plan_unique UNIQUE (plan_id)
);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_created_at_idx
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_user_id_unread_idx
  ON public.notifications (user_id) WHERE read = false;

-- ---------------------------------------------------------------------------
-- Invite tokens for users not yet on Buddget (72h, single-use)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.budget_invite_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  plan_id UUID NOT NULL REFERENCES public.shared_budget_plans (id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.shared_budget_members (id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS budget_invite_tokens_expires_idx ON public.budget_invite_tokens (expires_at);

-- Rate limiting for email lookup API (service role inserts only)
CREATE TABLE IF NOT EXISTS public.budget_email_lookup_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS budget_email_lookup_log_user_created_idx
  ON public.budget_email_lookup_log (user_id, created_at DESC);

ALTER TABLE public.budget_email_lookup_log ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- user_profiles: default shared plan
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS default_budget_plan_id UUID REFERENCES public.shared_budget_plans (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- RLS: shared_budget_plans
-- ---------------------------------------------------------------------------
ALTER TABLE public.shared_budget_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shared_budget_plans_owner_all"
  ON public.shared_budget_plans
  FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "shared_budget_plans_member_select"
  ON public.shared_budget_plans
  FOR SELECT
  USING (
    id IN (
      SELECT plan_id FROM public.shared_budget_members
      WHERE user_id = auth.uid() AND status = 'accepted'
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: shared_budget_members
-- ---------------------------------------------------------------------------
ALTER TABLE public.shared_budget_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shared_budget_members_owner_all"
  ON public.shared_budget_members
  FOR ALL
  USING (
    plan_id IN (SELECT id FROM public.shared_budget_plans WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    plan_id IN (SELECT id FROM public.shared_budget_plans WHERE owner_id = auth.uid())
  );

CREATE POLICY "shared_budget_members_self_select"
  ON public.shared_budget_members
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "shared_budget_members_self_update"
  ON public.shared_budget_members
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RLS: shared_budget_data
-- ---------------------------------------------------------------------------
ALTER TABLE public.shared_budget_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shared_budget_data_select"
  ON public.shared_budget_data
  FOR SELECT
  USING (
    plan_id IN (SELECT id FROM public.shared_budget_plans WHERE owner_id = auth.uid())
    OR plan_id IN (
      SELECT plan_id FROM public.shared_budget_members
      WHERE user_id = auth.uid() AND status = 'accepted'
    )
  );

CREATE POLICY "shared_budget_data_write"
  ON public.shared_budget_data
  FOR ALL
  USING (
    plan_id IN (SELECT id FROM public.shared_budget_plans WHERE owner_id = auth.uid())
    OR plan_id IN (
      SELECT plan_id FROM public.shared_budget_members
      WHERE user_id = auth.uid() AND role = 'manager' AND status = 'accepted'
    )
  )
  WITH CHECK (
    plan_id IN (SELECT id FROM public.shared_budget_plans WHERE owner_id = auth.uid())
    OR plan_id IN (
      SELECT plan_id FROM public.shared_budget_members
      WHERE user_id = auth.uid() AND role = 'manager' AND status = 'accepted'
    )
  );

-- Viewers must not UPDATE: split write policy — FOR ALL on write includes UPDATE.
-- Restrict UPDATE/INSERT/DELETE to owner or manager only (policy above).
-- SELECT allowed for viewers via shared_budget_data_select.

-- ---------------------------------------------------------------------------
-- RLS: notifications
-- ---------------------------------------------------------------------------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_own"
  ON public.notifications
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RLS: budget_invite_tokens (only service role / server — no client access)
-- ---------------------------------------------------------------------------
ALTER TABLE public.budget_invite_tokens ENABLE ROW LEVEL SECURITY;

-- No policies for authenticated users — API uses service role only.

-- ---------------------------------------------------------------------------
-- Triggers: updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_shared_budget_plans_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shared_budget_plans_updated ON public.shared_budget_plans;
CREATE TRIGGER trg_shared_budget_plans_updated
  BEFORE UPDATE ON public.shared_budget_plans
  FOR EACH ROW EXECUTE PROCEDURE public.touch_shared_budget_plans_updated_at();

CREATE OR REPLACE FUNCTION public.touch_shared_budget_data_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shared_budget_data_updated ON public.shared_budget_data;
CREATE TRIGGER trg_shared_budget_data_updated
  BEFORE UPDATE ON public.shared_budget_data
  FOR EACH ROW EXECUTE PROCEDURE public.touch_shared_budget_data_updated_at();

-- ---------------------------------------------------------------------------
-- Server-only: exact email lookup for invite flow (no email returned to client)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_lookup_user_by_email(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  SELECT u.id AS uid, p.display_name AS dname
  INTO r
  FROM auth.users u
  LEFT JOIN public.user_profiles p ON p.user_id = u.id
  WHERE lower(trim(u.email)) = lower(trim(p_email))
  LIMIT 1;
  IF r.uid IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;
  RETURN jsonb_build_object(
    'found', true,
    'userId', r.uid,
    'displayName', coalesce(r.dname, '')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_lookup_user_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_lookup_user_by_email(text) TO service_role;
