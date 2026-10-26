-- Switch-over, applied together with the code that uses it (old clients keep working until then).
-- Live means: approved by the owner, not revoked or denied, not expired (permanent has no expiry), user not excluded.
-- The owner's own staff row reads any non-excluded-or-not user (the owner is never locked out), still audited by the route.
CREATE OR REPLACE FUNCTION public.admin_has_grant(p_staff uuid, p_user uuid, p_scope text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM admin_staff s WHERE s.id = p_staff AND s.role_key = 'owner' AND s.status = 'active')
      OR (
        NOT EXISTS (SELECT 1 FROM admin_financial_exclusions x WHERE x.user_id = p_user)
        AND EXISTS (
          SELECT 1 FROM admin_access_grants g
          JOIN admin_staff a ON a.id = g.approved_by AND a.role_key = 'owner'
          JOIN admin_staff me ON me.id = g.staff_id AND me.status = 'active'
          WHERE g.staff_id = p_staff AND g.target_user_id = p_user AND g.scope = p_scope
            AND g.approved_at IS NOT NULL AND g.revoked_at IS NULL AND g.denied_at IS NULL
            AND (g.expires_at IS NULL AND g.mode = 'permanent' OR g.expires_at > now())
        )
      );
$$;
REVOKE EXECUTE ON FUNCTION public.admin_has_grant(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_has_grant(uuid, uuid, text) TO service_role;

-- Everyone who could ask before (users.financial, users.pii) may still ask; nobody but the owner approves.
UPDATE public.admin_roles SET permissions = array_remove(permissions, 'users.financial') WHERE 'users.financial' = ANY (permissions);
UPDATE public.admin_staff SET extra_permissions = array_remove(extra_permissions, 'users.financial') WHERE 'users.financial' = ANY (extra_permissions);
UPDATE public.admin_roles SET permissions = permissions || ARRAY['financial.request']
WHERE key IN ('admin','support_lead','compliance') AND NOT ('financial.request' = ANY (permissions));

-- The per-device last-text lookup is now a column (0183).
DROP FUNCTION IF EXISTS public.user_device_last_sms(uuid);
