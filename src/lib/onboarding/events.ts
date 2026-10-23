/** The funnel the admin portal reads. Anything else is refused by the server. */
export const ONBOARDING_EVENTS = [
  'onboarding_started',
  'onboarding_step_view',
  'onboarding_step_complete',
  'onboarding_step_skip',
  'onboarding_completed',
  'onboarding_skipped',
  'onboarding_permission',
] as const

export type OnboardingEvent = (typeof ONBOARDING_EVENTS)[number]
