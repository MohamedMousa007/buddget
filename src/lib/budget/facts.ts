import type { Currency } from '@/lib/store/types'

/**
 * Everything the budget engine and the question graph know about the user, already in base currency.
 * Built from the store (and the studio answers) by a thin adapter; the libraries themselves stay pure.
 */
export interface BudgetFacts {
  baseCurrency: Currency
  /** ISO country name or code as stored on the profile; drives benchmark tables. */
  country: string | null
  /** Projected monthly income for the cycle (base). 0 when unknown. */
  monthlyIncome: number
  incomeStability: 'fixed' | 'variable' | 'mixed'
  /** Conservative income for variable earners (e.g. lowest of the last 6 months); null when unknown. */
  incomeFloor: number | null
  household: 'solo' | 'couple' | 'family'
  dependents: number
  supportsOthers: boolean
  housing: 'rent' | 'own' | 'family' | 'company' | null
  rent: number | null
  rentIncludesUtilities: boolean
  lifestyle: 'minimal' | 'balanced' | 'comfortable'
  foodFrequency: 'everyday' | 'mostdays' | 'sometimes' | 'rarely' | null
  transportMode: 'public' | 'car' | 'taxi' | 'walk' | null
  hasCar: boolean
  /** Fixed bills already known (recurring expenses that are not subscriptions or debt). */
  bills: FactBill[]
  subscriptionsMonthly: number
  subscriptionCount: number
  debts: FactDebt[]
  goals: FactGoal[]
  /** Liquid savings counted toward the safety net (base). */
  liquidSavings: number
  /** Monthly essentials if known (user figure or derived); null lets the engine estimate. */
  essentialsMonthly: number | null
  emergencyTargetMonths: number
  zakatMonthly: number
  /** Three-month average spend per everyday category key (see EVERYDAY_KEYS in the engine). */
  averages: Partial<Record<EverydayKey, number>>
  priorities: StudioPriority[]
  /** Typed fields that hold a real stored value (not a default); lets the studio skip questions it can already answer. */
  known?: ReadonlySet<KnownFact>
  /** 0 = save hard, 100 = live comfortably. */
  securityLean: number
  payoffStrategy: 'avalanche' | 'snowball' | 'minimums'
  /** Extra a month the user wants to send at the target debt; the plan gives it what slack allows. */
  extraPayoff?: number
  investInterest: boolean
}

export type EverydayKey = 'groceries' | 'dining' | 'transport' | 'health' | 'shopping' | 'fun' | 'family' | 'other'

export type KnownFact = 'household' | 'lifestyle' | 'rentIncludesUtilities' | 'supportsOthers' | 'incomeStability'

export type StudioPriority = 'safety' | 'debt' | 'goals' | 'invest' | 'enjoy' | 'family'

export interface FactBill {
  name: string
  amount: number
  dueDay: number | null
  /** Lucide icon key. */
  icon: string
  essential: boolean
  expenseCategories?: string[]
}

export interface FactDebt {
  id: string
  name: string
  /** Monthly minimum (base). */
  minimum: number
  balance: number
  /** Annual rate in percent; null when unknown. */
  apr: number | null
  kind: 'credit_card' | 'installment' | 'loan' | 'personal'
}

export interface FactGoal {
  id: string
  name: string
  /** Planned monthly draw from the goal's own funding settings (base). */
  monthly: number
  targetAmount: number | null
  saved: number
  /** `YYYY-MM-DD` or null. */
  targetDate: string | null
  priority: number
  /** Lucide icon key. */
  icon: string
}

/** One line the engine proposes, before it gets an id and becomes a `BudgetPlanCategory`. */
export interface DraftLine {
  block: import('@/lib/store/types').BudgetBlock
  name: string
  /** Lucide icon key. */
  icon: string
  amount: number
  linkType: import('@/lib/store/types').BudgetLinkType
  linkIds: string[]
  dueDay: number | null
  essential: boolean
  isSavings: boolean
  expenseCategories: string[]
  rationale: string
  confidence: 'high' | 'estimated'
}

export interface PlanDraft {
  name: string
  intent: import('@/lib/store/types').BudgetPlanIntent
  income: number
  lines: DraftLine[]
  reasons: string[]
  risks: string[]
  /** Income minus lines; the engine aims for 0 and routes any remainder to the buffer line. */
  free: number
}
