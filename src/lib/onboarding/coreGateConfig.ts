import type { Currency } from '@/lib/store/types'

/**
 * Four-question core-onboarding gate — the bare minimum Buddget needs before
 * the app becomes useful:
 *   display_name — greeting + AI personalization
 *   country      — tailors currency defaults + cost-of-living hints
 *   city         — local context for tips
 *   base_currency — drives every amount in the app
 *
 * Everything else (income, debts, payments, budget categories) is collected
 * in-context via the dashboard first-run checklist once the user lands on /.
 */
export type CoreGateStepId = 'display_name' | 'country' | 'city' | 'base_currency'

export interface CoreGateStep {
  id: CoreGateStepId
  /** Determines which input component to render. */
  type: 'text' | 'country' | 'single'
}

export const CORE_GATE_STEPS: readonly CoreGateStep[] = [
  { id: 'display_name', type: 'text' },
  { id: 'country', type: 'country' },
  { id: 'city', type: 'text' },
  { id: 'base_currency', type: 'single' },
]

/**
 * Currency options surfaced on the core gate. Kept intentionally short —
 * Settings > Currency exposes the full list for power users. Matches what
 * the expert flow asked, minus the marketing copy.
 */
export const CORE_GATE_CURRENCIES: readonly Currency[] = [
  'AED',
  'USD',
  'EGP',
  'EUR',
  'GBP',
  'SAR',
]

export interface CoreGateAnswers {
  display_name: string
  country: string
  city: string
  base_currency: Currency
}

export function createEmptyCoreGateAnswers(): CoreGateAnswers {
  return { display_name: '', country: '', city: '', base_currency: 'AED' }
}

/** Returns true when the currently-visible step has a non-empty valid answer. */
export function isCoreGateStepComplete(
  stepId: CoreGateStepId,
  answers: CoreGateAnswers,
): boolean {
  switch (stepId) {
    case 'display_name':
      return answers.display_name.trim().length > 0
    case 'country':
      return answers.country.trim().length > 0
    case 'city':
      return answers.city.trim().length > 0
    case 'base_currency':
      return !!answers.base_currency
  }
}
