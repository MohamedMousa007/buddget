import type { OnboardingRecord } from '@/lib/store/types'

export interface EligibilityInput {
  /** The rollout flag; null while it is still loading. */
  flagOn: boolean | null
  /** The first sync finished and the store holds this account's own profile (not the empty local one). */
  profileLoaded: boolean
  record: OnboardingRecord | undefined
  openAccounts: number
  incomeSources: number
  incomeEvents: number
  expenses: number
  plans: number
  /** Debts, goals, subscriptions, pockets, holdings and recurring items together. */
  others: number
}

export type OnboardingState = 'hidden' | 'new' | 'resume'

/**
 * Whether to offer the first-run journey. Only an account that holds nothing yet, or one that started it and has not
 * finished, ever sees it: a returning user on a fresh install has server data by the time the profile loads, so they
 * land in the app. Nothing is offered until the profile is loaded from the server, because an empty store means "not synced yet" too.
 */
export function onboardingState(i: EligibilityInput): OnboardingState {
  if (i.record?.doneAt || i.record?.skippedAt) return 'hidden'
  if (i.flagOn !== true || !i.profileLoaded) return 'hidden'
  if (i.record) return 'resume'
  const holdsData = i.openAccounts + i.incomeSources + i.incomeEvents + i.expenses + i.plans + i.others > 0
  return holdsData ? 'hidden' : 'new'
}
