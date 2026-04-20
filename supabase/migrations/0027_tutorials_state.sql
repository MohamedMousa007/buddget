-- Add per-user tutorial tracking for the conversational onboarding + guided app tour
-- shipped under plan /Users/mohamedmousa/.claude/plans/lexical-humming-graham.md (SP0).
--
-- `tutorials_completed` stores versioned tour IDs (e.g. 'postOnboardingTour:v1') so we can
--   re-fire a tour on all users by bumping its version.
-- `tutorial_current_step` is a resume marker if the user closes mid-tour (e.g.
--   'postOnboardingTour:v1:4' = step index 4). Nullable; cleared on tour completion.

ALTER TABLE public.user_settings
  ADD COLUMN tutorials_completed text[] NOT NULL DEFAULT '{}',
  ADD COLUMN tutorial_current_step text;

COMMENT ON COLUMN public.user_settings.tutorials_completed IS
  'Versioned tour IDs the user has finished (e.g. "postOnboardingTour:v1"). Bump the version on a tour to re-fire it for existing users.';

COMMENT ON COLUMN public.user_settings.tutorial_current_step IS
  'Resume marker if the user closed the app mid-tour. Format: "<tourId>:<version>:<stepIndex>". Null when no tour is in flight.';
