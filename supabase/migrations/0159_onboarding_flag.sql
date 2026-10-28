-- First-run journey rollout. Starts at 10% of accounts; staff always see it. Raise rollout_pct or flip enabled from the admin portal.
INSERT INTO public.feature_flags (key, description, enabled, rollout_pct)
VALUES ('onboarding_v1', 'First-run setup journey for new accounts', true, 10)
ON CONFLICT (key) DO NOTHING;
