/** Page-based onboarding: Step 1 = index 0 … Step 10 = index 9. */
export const ONBOARDING_V2_STEP_COUNT = 10

export type OnboardingBudgetPersona = 'balanced' | 'aggressive_saver' | 'just_tracking'

export type V2PaymentChipId = 'cash' | 'bank' | 'nol_silver' | 'nol_gold' | 'credit'

export const V2_PAYMENT_CHIPS: {
  id: V2PaymentChipId
  type: import('@/lib/store/types').PaymentMethodType
  defaultLabel: string
}[] = [
  { id: 'cash', type: 'cash', defaultLabel: 'Cash' },
  { id: 'bank', type: 'bank_transfer', defaultLabel: 'Bank' },
  { id: 'nol_silver', type: 'nol', defaultLabel: 'Nol Silver' },
  { id: 'nol_gold', type: 'nol', defaultLabel: 'Nol Gold' },
  { id: 'credit', type: 'card_credit', defaultLabel: 'Credit card' },
]
