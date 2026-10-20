-- The app shows the admin badge from the account's own app metadata (is_staff), which users cannot write. Keep it in step
-- with admin_staff in the database itself: granted on invite claim / activation, removed on suspension or deletion.
CREATE OR REPLACE FUNCTION public.sync_staff_claim() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.user_id IS NOT NULL
     AND (TG_OP = 'DELETE' OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.status <> 'active') THEN
    UPDATE auth.users SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) - 'is_staff' WHERE id = OLD.user_id;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.user_id IS NOT NULL AND NEW.status = 'active' THEN
    UPDATE auth.users SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"is_staff": true}'::jsonb
    WHERE id = NEW.user_id AND coalesce(raw_app_meta_data->>'is_staff', '') <> 'true';
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.sync_staff_claim() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_admin_staff_claim ON public.admin_staff;
CREATE TRIGGER trg_admin_staff_claim AFTER INSERT OR DELETE OR UPDATE OF user_id, status ON public.admin_staff
  FOR EACH ROW EXECUTE FUNCTION public.sync_staff_claim();

UPDATE auth.users u SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"is_staff": true}'::jsonb
FROM public.admin_staff s WHERE s.user_id = u.id AND s.status = 'active' AND coalesce(u.raw_app_meta_data->>'is_staff', '') <> 'true';
