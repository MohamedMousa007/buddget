import type { GoalCategory, GoalFrequency, GoalFundingMode } from '@/lib/store/types'

export interface NewGoalDraft {
  step: 1 | 2 | 3
  category: GoalCategory
  name: string
  targetAmount: string
  currency: string
  targetDate: string
  frequency: GoalFrequency
  alreadySaved: string
  fundingMode: GoalFundingMode
  /** null = still using the suggested share. */
  sharePct: number | null
  fixedAmount: string
  monthlySpendingLimit: string
  spendingCategory: string
  linkedDebtIds: string[]
}

const KEY = 'buddget-goal-draft'

export function loadDraft(): NewGoalDraft | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as NewGoalDraft) : null
  } catch {
    return null
  }
}

export function saveDraft(d: NewGoalDraft): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(d))
  } catch {
    /* private window or full storage: the draft is a convenience */
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nothing to clear */
  }
}
