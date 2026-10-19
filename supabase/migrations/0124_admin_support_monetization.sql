-- Support desk + the structures monetization will land on: plans, entitlements, loyalty, feature flags,
-- platform settings. All service-role only (RLS on, no policies). Users with no entitlement row are on
-- the default plan, so nothing here changes app behaviour until the app starts reading it.

CREATE TABLE public.support_tickets (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number           bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  user_id          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requester_email  text,
  subject          text NOT NULL CHECK (char_length(subject) BETWEEN 3 AND 200),
  category         text NOT NULL DEFAULT 'general'
                   CHECK (category IN ('general','bug','sms','sync','billing','account','feature','other')),
  priority         text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status           text NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending','resolved','closed')),
  assignee_id      uuid REFERENCES public.admin_staff(id) ON DELETE SET NULL,
  source           text NOT NULL DEFAULT 'admin' CHECK (source IN ('in_app','email','admin','sms_queue')),
  tags             text[] NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  first_response_at timestamptz,
  resolved_at      timestamptz
);
CREATE INDEX support_tickets_status_idx ON public.support_tickets (status, priority, created_at DESC);
CREATE INDEX support_tickets_user_idx ON public.support_tickets (user_id);
CREATE INDEX support_tickets_assignee_idx ON public.support_tickets (assignee_id);
CREATE TRIGGER support_tickets_touch BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.admin_touch_updated_at();

CREATE TABLE public.support_ticket_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_type     text NOT NULL CHECK (author_type IN ('user','staff','system')),
  author_staff_id uuid REFERENCES public.admin_staff(id) ON DELETE SET NULL,
  author_label    text,
  body            text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 10000),
  internal        boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_ticket_messages_ticket_idx ON public.support_ticket_messages (ticket_id, created_at);

CREATE TABLE public.admin_user_notes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  staff_id     uuid REFERENCES public.admin_staff(id) ON DELETE SET NULL,
  author_label text,
  body         text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  pinned       boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_user_notes_user_idx ON public.admin_user_notes (user_id, created_at DESC);

CREATE TABLE public.plans (
  key                text PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9_]{1,31}$'),
  name               text NOT NULL,
  description        text NOT NULL DEFAULT '',
  status             text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  is_default         boolean NOT NULL DEFAULT false,
  price_monthly_cents integer CHECK (price_monthly_cents >= 0),
  price_yearly_cents  integer CHECK (price_yearly_cents >= 0),
  currency           text NOT NULL DEFAULT 'USD',
  trial_days         integer NOT NULL DEFAULT 0 CHECK (trial_days BETWEEN 0 AND 365),
  limits             jsonb NOT NULL DEFAULT '{}'::jsonb,
  features           text[] NOT NULL DEFAULT '{}',
  sort_order         integer NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX plans_single_default ON public.plans ((true)) WHERE is_default;
CREATE TRIGGER plans_touch BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.admin_touch_updated_at();

CREATE TABLE public.user_entitlements (
  user_id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_key         text NOT NULL REFERENCES public.plans(key) ON UPDATE CASCADE,
  status           text NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','trialing','past_due','canceled','expired','paused')),
  source           text NOT NULL DEFAULT 'admin'
                   CHECK (source IN ('default','admin','apple','google','stripe','promo','loyalty')),
  trial_ends_at    timestamptz,
  current_period_end timestamptz,
  canceled_at      timestamptz,
  limit_overrides  jsonb NOT NULL DEFAULT '{}'::jsonb,
  feature_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  note             text,
  granted_by       uuid REFERENCES public.admin_staff(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_entitlements_plan_idx ON public.user_entitlements (plan_key, status);
CREATE TRIGGER user_entitlements_touch BEFORE UPDATE ON public.user_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.admin_touch_updated_at();

CREATE TABLE public.loyalty_tiers (
  key         text PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9_]{1,31}$'),
  name        text NOT NULL,
  description text NOT NULL DEFAULT '',
  min_points  integer NOT NULL DEFAULT 0 CHECK (min_points >= 0),
  color       text,
  perks       jsonb NOT NULL DEFAULT '[]'::jsonb,
  status      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.loyalty_accounts (
  user_id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  points_balance  integer NOT NULL DEFAULT 0,
  lifetime_points integer NOT NULL DEFAULT 0,
  tier_key        text REFERENCES public.loyalty_tiers(key) ON UPDATE CASCADE ON DELETE SET NULL,
  tier_locked     boolean NOT NULL DEFAULT false,
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX loyalty_accounts_tier_idx ON public.loyalty_accounts (tier_key);
CREATE TRIGGER loyalty_accounts_touch BEFORE UPDATE ON public.loyalty_accounts
  FOR EACH ROW EXECUTE FUNCTION public.admin_touch_updated_at();

CREATE TABLE public.loyalty_ledger (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta      integer NOT NULL CHECK (delta <> 0),
  reason     text NOT NULL,
  ref        text,
  actor_id   uuid REFERENCES public.admin_staff(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX loyalty_ledger_user_idx ON public.loyalty_ledger (user_id, created_at DESC);

CREATE TABLE public.feature_flags (
  key         text PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9_.-]{1,63}$'),
  description text NOT NULL DEFAULT '',
  enabled     boolean NOT NULL DEFAULT false,
  rollout_pct integer NOT NULL DEFAULT 100 CHECK (rollout_pct BETWEEN 0 AND 100),
  plan_keys   text[] NOT NULL DEFAULT '{}',
  platforms   text[] NOT NULL DEFAULT '{}',
  updated_by  uuid REFERENCES public.admin_staff(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER feature_flags_touch BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.admin_touch_updated_at();

CREATE TABLE public.platform_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_by uuid REFERENCES public.admin_staff(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['support_tickets','support_ticket_messages','admin_user_notes','plans','user_entitlements',
    'loyalty_tiers','loyalty_accounts','loyalty_ledger','feature_flags','platform_settings'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

-- Today everyone is on Free. Limits mirror what the app already enforces; null/absent = unlimited.
INSERT INTO public.plans (key, name, description, status, is_default, price_monthly_cents, price_yearly_cents, limits, sort_order)
VALUES ('free', 'Free', 'Everyone starts here.', 'active', true, 0, 0, '{"ai_budget_per_hour": 15}'::jsonb, 0);
