import type { Currency, ExpenseCategory, GoldKarat, PaymentMethodType } from '@/lib/store/types'

export interface OnboardingDraft {
  name: string
  country: string
  baseCurrency: Currency
  incomeSources: Array<{
    name: string
    amount: number
    currency: Currency
    isRecurring: boolean
  }>
  fixedCosts: Array<{
    name: string
    amount: number
    category: ExpenseCategory
  }>
  subscriptions: Array<{
    name: string
    amount: number
    icon?: string
  }>
  paymentMethods: Array<{
    name: string
    type: PaymentMethodType
  }>
  savingsGoal: number | null
  debts: Array<{
    name: string
    person: string
    startingBalance: number
    currency: string
    isGold: boolean
    goldKarat?: GoldKarat
  }>
  budgetStyle: 'balanced' | 'aggressive_saver' | 'just_tracking'
}

/** Props passed to each step body under `/onboarding`. */
export type OnboardingStepProps = {
  draft: OnboardingDraft
  updateDraft: (updates: Partial<OnboardingDraft>) => void
  /** Step review “Edit” links only; optional on earlier steps. */
  goTo?: (stepIndex: number) => void
}

export const EMPTY_DRAFT: OnboardingDraft = {
  name: '',
  country: '',
  baseCurrency: 'AED',
  incomeSources: [],
  fixedCosts: [],
  subscriptions: [],
  paymentMethods: [],
  savingsGoal: null,
  debts: [],
  budgetStyle: 'balanced',
}
