-- Part of the database audit follow-up (DB-5 in the audit report).
--
-- Retire three dead identity/config tables:
--   1. `user_finance`            — v16 pre-normalisation JSONB blob. All 19 rows
--                                  have a matching `profiles` row (verified
--                                  via LEFT JOIN). App code only read it in a
--                                  legacy-fallback branch of `pullCore` that
--                                  no current user hits.
--   2. `user_profiles`           — 5-column subset of `profiles`. Every col
--                                  already lives on `profiles`. All 14 rows
--                                  have matching `profiles` rows.
--   3. `onboarding_survey_config` — legacy 27-step Core-Gate survey config,
--                                  retired when SP7 made Journey v3 the
--                                  default. Only consumer was
--                                  `useOnboardingSurveyConfig`, which has
--                                  no live call-site.
--
-- Also drops `backfill_from_user_finance(uuid)` — the one-shot migration
-- helper that copied data out of the legacy blob into the normalised
-- tables. No longer callable without its target.

DROP FUNCTION IF EXISTS public.backfill_from_user_finance(uuid);

DROP TABLE IF EXISTS public.user_finance;
DROP TABLE IF EXISTS public.user_profiles;
DROP TABLE IF EXISTS public.onboarding_survey_config;
