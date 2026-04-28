export type StepId =
  | 'welcome'
  | 'location'
  | 'income'
  | 'fixed-costs'
  | 'subscriptions'
  | 'payment-methods'
  | 'savings-goal'
  | 'debts'
  | 'budget-style'
  | 'review'

export interface OnboardingStep {
  id: StepId
  title: string
  subtitle: string
  optional?: boolean
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'What should we call you?',
    subtitle: 'Just your first name is fine.',
  },
  {
    id: 'location',
    title: 'Where are you based?',
    subtitle: "We'll set your currency automatically.",
  },
  {
    id: 'income',
    title: 'How much do you earn each month?',
    subtitle: 'Add all your income sources.',
  },
  {
    id: 'fixed-costs',
    title: 'What are your fixed monthly costs?',
    subtitle: "Rent, bills — things that don't change.",
  },
  {
    id: 'subscriptions',
    title: 'Any subscriptions?',
    subtitle: 'Tap the ones you pay for.',
    optional: true,
  },
  {
    id: 'payment-methods',
    title: 'How do you usually pay?',
    subtitle: 'Select all that apply.',
  },
  {
    id: 'savings-goal',
    title: 'How much do you want to save each month?',
    subtitle: 'You can always change this later.',
    optional: true,
  },
  {
    id: 'debts',
    title: 'Are you paying off anything?',
    subtitle: "Loans, family debts — we'll track them for you.",
    optional: true,
  },
  {
    id: 'budget-style',
    title: 'How do you want to manage spending?',
    subtitle: 'Pick the style that fits you.',
  },
  {
    id: 'review',
    title: 'Does this look right?',
    subtitle: "Review what you've told us before we build your plan.",
  },
]

export function onboardingStepIndex(id: StepId): number {
  const i = ONBOARDING_STEPS.findIndex((s) => s.id === id)
  return Math.max(0, i)
}
