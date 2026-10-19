-- Admin portal core: staff, roles, credentials (password + TOTP), sessions, biometric devices, audit log.
-- Every table is service-role only: RLS on, no policies, grants revoked from anon/authenticated.

CREATE OR REPLACE FUNCTION public.admin_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TABLE public.admin_roles (
  key         text PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9_]{1,31}$'),
  name        text NOT NULL,
  description text NOT NULL DEFAULT '',
  rank        integer NOT NULL CHECK (rank >= 0),
  permissions text[] NOT NULL DEFAULT '{}',
  is_system   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.admin_staff (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             text NOT NULL,
  user_id           uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name      text,
  department        text,
  role_key          text NOT NULL REFERENCES public.admin_roles(key) ON UPDATE CASCADE,
  extra_permissions text[] NOT NULL DEFAULT '{}',
  status            text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  invited_by        uuid REFERENCES public.admin_staff(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  last_login_at     timestamptz
);
CREATE UNIQUE INDEX admin_staff_email_key ON public.admin_staff (lower(email));
CREATE UNIQUE INDEX admin_staff_single_owner ON public.admin_staff ((true)) WHERE role_key = 'owner';
CREATE INDEX admin_staff_role_idx ON public.admin_staff (role_key);
CREATE TRIGGER admin_staff_touch BEFORE UPDATE ON public.admin_staff
  FOR EACH ROW EXECUTE FUNCTION public.admin_touch_updated_at();

-- The owner is m.mousaofficial@gmail.com and nobody else. No API path, service role included, can
-- change that: only someone with direct database access who drops this trigger can.
CREATE OR REPLACE FUNCTION public.admin_guard_owner() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.role_key = 'owner' THEN RAISE EXCEPTION 'The owner account cannot be removed'; END IF;
    RETURN OLD;
  END IF;
  IF NEW.role_key = 'owner' AND lower(NEW.email) <> 'm.mousaofficial@gmail.com' THEN
    RAISE EXCEPTION 'Only m.mousaofficial@gmail.com can hold the owner role';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.role_key = 'owner' THEN
    IF NEW.role_key <> 'owner' OR NEW.status <> 'active' OR lower(NEW.email) <> lower(OLD.email)
       OR NEW.extra_permissions <> OLD.extra_permissions
       OR (OLD.user_id IS NOT NULL AND NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
      RAISE EXCEPTION 'The owner account is immutable';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER admin_staff_guard_owner BEFORE INSERT OR UPDATE OR DELETE ON public.admin_staff
  FOR EACH ROW EXECUTE FUNCTION public.admin_guard_owner();

CREATE OR REPLACE FUNCTION public.admin_guard_system_roles() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_system THEN RAISE EXCEPTION 'System roles cannot be deleted'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.key = 'owner' THEN RAISE EXCEPTION 'The owner role is immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER admin_roles_guard BEFORE UPDATE OR DELETE ON public.admin_roles
  FOR EACH ROW EXECUTE FUNCTION public.admin_guard_system_roles();

CREATE TABLE public.admin_credentials (
  user_id             uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  password_hash       text NOT NULL,
  totp_secret_enc     text,
  totp_confirmed_at   timestamptz,
  totp_last_step      bigint,
  recovery_hashes     text[] NOT NULL DEFAULT '{}',
  failed_attempts     integer NOT NULL DEFAULT 0,
  locked_until        timestamptz,
  password_changed_at timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER admin_credentials_touch BEFORE UPDATE ON public.admin_credentials
  FOR EACH ROW EXECUTE FUNCTION public.admin_touch_updated_at();

CREATE TABLE public.admin_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash   text NOT NULL UNIQUE,
  method       text NOT NULL CHECK (method IN ('password_totp', 'biometric', 'recovery')),
  ip           text,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz
);
CREATE INDEX admin_sessions_user_idx ON public.admin_sessions (user_id, created_at DESC);

CREATE TABLE public.admin_biometric_devices (
  device_id    text PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  secret_hash  text NOT NULL,
  label        text,
  platform     text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
CREATE INDEX admin_biometric_devices_user_idx ON public.admin_biometric_devices (user_id);

CREATE TABLE public.admin_audit_log (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id    uuid,
  actor_email text,
  action      text NOT NULL,
  target_type text,
  target_id   text,
  summary     text,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip          text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_audit_log_created_idx ON public.admin_audit_log (created_at DESC);
CREATE INDEX admin_audit_log_actor_idx ON public.admin_audit_log (actor_id, created_at DESC);
CREATE INDEX admin_audit_log_target_idx ON public.admin_audit_log (target_type, target_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.admin_audit_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN RAISE EXCEPTION 'The audit log is append-only'; END $$;
CREATE TRIGGER admin_audit_log_immutable BEFORE UPDATE OR DELETE ON public.admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.admin_audit_immutable();

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['admin_roles','admin_staff','admin_credentials','admin_sessions','admin_biometric_devices','admin_audit_log'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

INSERT INTO public.admin_roles (key, name, description, rank, permissions, is_system) VALUES
 ('owner', 'Owner', 'Full control of everything. Immutable.', 0, ARRAY['*'], true),
 ('admin', 'Administrator', 'Runs the platform day to day. Everything except owner-only actions.', 10,
  ARRAY['overview.view','analytics.view','users.view','users.pii','users.edit','users.limits','users.suspend','users.logs','users.tools',
        'sms.view','sms.manage','support.view','support.reply','support.manage','billing.view','billing.manage',
        'loyalty.view','loyalty.manage','flags.view','flags.manage','platform.view','platform.manage',
        'staff.view','staff.manage','audit.view','security.view'], true),
 ('support_lead', 'Support lead', 'Owns the support queue, fixes user issues, adjusts limits.', 20,
  ARRAY['overview.view','analytics.view','users.view','users.pii','users.edit','users.limits','users.suspend','users.logs','users.tools',
        'sms.view','support.view','support.reply','support.manage','billing.view','loyalty.view','audit.view'], true),
 ('support_agent', 'Support agent', 'Answers tickets and diagnoses user issues.', 30,
  ARRAY['users.view','users.logs','users.tools','sms.view','support.view','support.reply'], true),
 ('engineer', 'Engineer', 'Reliability, SMS pipeline, platform configuration and rollouts.', 20,
  ARRAY['overview.view','analytics.view','users.view','users.logs','sms.view','sms.manage','flags.view','flags.manage',
        'platform.view','platform.manage','security.view','audit.view'], true),
 ('finance', 'Finance', 'Plans, entitlements and revenue.', 20,
  ARRAY['overview.view','analytics.view','users.view','billing.view','billing.manage','loyalty.view'], true),
 ('growth', 'Growth & marketing', 'Acquisition, engagement, loyalty and rollouts.', 20,
  ARRAY['overview.view','analytics.view','users.view','billing.view','loyalty.view','loyalty.manage','flags.view'], true),
 ('viewer', 'Viewer', 'Read-only dashboards.', 90, ARRAY['overview.view','analytics.view'], true);

INSERT INTO public.admin_staff (email, user_id, display_name, department, role_key)
SELECT u.email, u.id, 'Mohamed Mousa', 'Leadership', 'owner'
FROM auth.users u WHERE lower(u.email) = 'm.mousaofficial@gmail.com';
