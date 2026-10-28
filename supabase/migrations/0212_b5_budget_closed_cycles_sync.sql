-- B5 R18: closed budget cycles now ride in profiles.financial_profile (jsonb) as `closedCycles: text[]`,
-- the same synced field that already carries `closeMemory`. No DDL is needed; this audit documents the shape.
-- Idempotent and read-only.
SELECT count(*) AS profiles_total,
       count(*) FILTER (WHERE financial_profile ? 'closedCycles') AS already_with_closed_cycles,
       count(*) FILTER (WHERE financial_profile ? 'closedCycles' AND jsonb_typeof(financial_profile->'closedCycles') <> 'array') AS malformed
FROM public.profiles;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE financial_profile ? 'closedCycles' AND jsonb_typeof(financial_profile->'closedCycles') <> 'array') THEN
    RAISE EXCEPTION 'financial_profile.closedCycles must be an array';
  END IF;
END $$;
