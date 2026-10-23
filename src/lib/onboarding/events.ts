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

const STEP_KEYS = ['about', 'goals', 'accounts', 'income', 'automate', 'budget']
const PERMISSION_KINDS = ['sms', 'push']

/** The only metadata each event may carry; anything else is refused, so a bad client cannot poison the funnel query. */
export function sanitizeMeta(type: OnboardingEvent, meta: Record<string, unknown>): Record<string, string | number | boolean> | null {
  switch (type) {
    case 'onboarding_started':
      return {}
    case 'onboarding_step_view':
    case 'onboarding_step_complete':
    case 'onboarding_step_skip':
      return typeof meta.step === 'string' && STEP_KEYS.includes(meta.step) ? { step: meta.step } : null
    case 'onboarding_permission':
      return typeof meta.kind === 'string' && PERMISSION_KINDS.includes(meta.kind) && typeof meta.granted === 'boolean'
        ? { kind: meta.kind, granted: meta.granted }
        : null
    case 'onboarding_completed':
      return typeof meta.budget === 'boolean' ? { budget: meta.budget } : {}
    case 'onboarding_skipped':
      return typeof meta.step === 'number' && Number.isInteger(meta.step) && meta.step >= 0 && meta.step < STEP_KEYS.length ? { step: meta.step } : {}
  }
}
