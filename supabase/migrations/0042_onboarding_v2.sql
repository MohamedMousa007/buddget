-- Track which onboarding version a user completed
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lite_mode boolean NOT NULL DEFAULT false;

-- onboarding_version: 0 = never completed, 2 = new flow completed
-- country already exists on profiles table
-- lite_mode: true = user skipped income, tracking expenses only

-- Update existing completed users to version 1 (old flow)
UPDATE public.profiles
  SET onboarding_version = 1
  WHERE onboarding_completed = true;
