import type { OnboardingPaymentDraft } from '@/lib/store/types'
import type { IncomeOnboardingPayload } from '@/components/onboarding/IncomeOnboardingPanel'
import type { DebtOnboardingPayload } from '@/components/onboarding/DebtOnboardingPanel'

/**
 * `live` covers any step whose panel reads & writes the finance store directly
 * (subscriptions / goals / savings). The Continue button on those steps advances
 * without carrying a payload since state is already persisted.
 */
export type StepContinuePayload =
  | { kind: 'static' }
  | { kind: 'text'; textValue: string }
  | { kind: 'number'; textValue: string }
  | { kind: 'single'; selected: string }
  | { kind: 'multi'; values: string[] }
  | { kind: 'payment'; drafts: OnboardingPaymentDraft[] }
  | { kind: 'income'; payload: IncomeOnboardingPayload }
  | { kind: 'debt'; payload: DebtOnboardingPayload }
  | { kind: 'live' }
