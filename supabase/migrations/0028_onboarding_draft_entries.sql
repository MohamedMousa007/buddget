-- Persist half-filled modal drafts during onboarding so a mid-modal tab close
-- resumes with the user's in-progress entry, not a blank form. Cleared on
-- successful save. Schema: { "incomeDraft": {...}, "pmDraft": {...}, ... }
-- keyed by modal id.

ALTER TABLE public.onboarding_state
  ADD COLUMN draft_entries jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.onboarding_state.draft_entries IS
  'Half-filled modal drafts during onboarding, keyed by modal id (e.g. "incomeDraft", "pmDraft"). Debounced write from the client; cleared on successful save.';
