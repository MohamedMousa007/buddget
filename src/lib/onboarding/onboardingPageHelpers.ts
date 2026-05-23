import type { OnboardingPaymentDraft } from '@/lib/store/types'

/** Extracts payment method drafts from legacy onboarding answers bag. */
export function valueForPaymentStep(answers: Record<string, unknown>): OnboardingPaymentDraft[] {
  const a = answers.payment_methods
  if (Array.isArray(a)) {
    return a.filter(
      (x): x is OnboardingPaymentDraft =>
        typeof x === 'object' &&
        x !== null &&
        'nickname' in x &&
        'type' in x &&
        'preset' in x
    ) as OnboardingPaymentDraft[]
  }
  return []
}
