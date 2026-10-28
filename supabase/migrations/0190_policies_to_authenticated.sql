-- D3/D4: re-apply the role scope idempotently. ALTER POLICY ... TO only changes the role list, never the predicate.
-- Tables whose policies 0163 already scoped are repeated so the end state does not depend on that migration's ledger entry.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.tablename, p.policyname
      FROM pg_policies p
     WHERE p.schemaname = 'public'
       AND p.tablename IN ('receipts', 'sms_parse_log', 'push_tokens', 'biometric_devices', 'sms_ingest_tokens', 'sms_template_signals')
  LOOP
    EXECUTE format('ALTER POLICY %I ON public.%I TO authenticated', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Service-role-only gates were written for PUBLIC and test auth.role(); scope them to the role they are for.
ALTER POLICY service_role_only ON public.sms_promotion_config TO service_role;
ALTER POLICY service_role_only ON public.sms_template_users TO service_role;
