import type { OnboardingPaymentDraft } from '@/lib/store/types'
import type { IncomeOnboardingPayload } from '@/components/onboarding/IncomeOnboardingPanel'
import type { DebtOnboardingPayload } from '@/components/onboarding/DebtOnboardingPanel'
import type { SubscriptionsOnboardingPayload } from '@/components/onboarding/SubscriptionsOnboardingPanel'

export type StepContinuePayload =
  | { kind: 'static' }
  | { kind: 'text'; textValue: string }
  | { kind: 'number'; textValue: string }
  | { kind: 'single'; selected: string }
  | { kind: 'multi'; values: string[] }
  | { kind: 'payment'; drafts: OnboardingPaymentDraft[] }
  | { kind: 'income'; payload: IncomeOnboardingPayload }
  | { kind: 'debt'; payload: DebtOnboardingPayload }
  | { kind: 'subscriptions'; payload: SubscriptionsOnboardingPayload }
