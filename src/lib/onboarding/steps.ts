import type { Currency, OnboardingGoal } from '@/lib/store/types'
import type { StudioPriority } from '@/lib/budget/facts'

export const STEPS = ['about', 'goals', 'accounts', 'income', 'automate', 'budget'] as const
export type StepKey = (typeof STEPS)[number]

/** Bank-text capture and reminders only exist in the apps, so the web journey has one step fewer. */
export const visibleSteps = (native: boolean): StepKey[] => (native ? [...STEPS] : STEPS.filter((s) => s !== 'automate'))

export const COUNTRIES = {
  EG: { currency: 'EGP' as Currency, name: 'Egyptian pound' },
  AE: { currency: 'AED' as Currency, name: 'UAE dirham' },
  SA: { currency: 'SAR' as Currency, name: 'Saudi riyal' },
} as const
export type CountryCode = keyof typeof COUNTRIES

export const OTHER_CURRENCIES: readonly Currency[] = ['USD', 'EUR', 'GBP', 'EGP', 'AED', 'SAR']

export const MAX_GOALS = 2

/** What each stated goal asks the first budget to put first. */
const GOAL_PRIORITIES: Record<OnboardingGoal, StudioPriority[]> = {
  see: [],
  runout: ['safety'],
  save: ['goals'],
  debt: ['debt'],
  budget: [],
}

export function prioritiesFor(goals: readonly OnboardingGoal[]): StudioPriority[] {
  return [...new Set(goals.flatMap((g) => GOAL_PRIORITIES[g]))]
}

/** Picks or drops a goal, keeping at most two; a third pick replaces the oldest. */
export function toggleGoal(goals: readonly OnboardingGoal[], goal: OnboardingGoal): OnboardingGoal[] {
  if (goals.includes(goal)) return goals.filter((g) => g !== goal)
  return [...goals, goal].slice(-MAX_GOALS)
}
