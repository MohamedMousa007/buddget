/** One finding, as data. The words come from i18n templates keyed by `kind`, so no sentence is built by joining strings. */
export type InsightKind = 'pace' | 'topCategory' | 'kept' | 'bnplBurden' | 'subsTotal' | 'billsBeforePayday' | 'payMix'
export type InsightArea = 'spending' | 'income' | 'bills' | 'debts' | 'how'

export interface Insight {
  kind: InsightKind
  area: InsightArea
  /** Higher shows first. */
  score: number
  /** The numbers behind the sentence. Money is in the base currency, shares are whole percents. */
  params: Record<string, number | string>
}

/** Everything a detector may read, already reduced to plain numbers. The hook builds it from the stores. */
export interface InsightInput {
  cycle: { daysElapsed: number; daysLeft: number; totalDays: number }
  /** Counted spend so far this cycle (`isReportSpendRow`, base currency). */
  spent: number
  /** Counted purchases so far this cycle. */
  expenseCount: number
  dailyRate: number
  projectedSpend: number
  /** Mean full-cycle spend of the 3 closed cycles before this one; null until all 3 have data. */
  usualSpend: number | null
  /** The app's own "left to spend" figure. */
  leftToSpend: number
  /** Habit detectors: debt repayments and unconverted foreign rows are left out. */
  topCategory: { name: string; amount: number; total: number } | null
  keptLast: { received: number; spent: number } | null
  bnpl: { plans: number; remaining: number; monthly: number; incomeMonthly: number }
  subs: { count: number; monthly: number }
  bills: { count: number; total: number }
  pay: { card: number; cash: number; unassigned: number; other: number; placedCount: number }
}

export type HeroState = 'learning' | 'ok' | 'tight'

export interface InsightHero {
  state: HeroState
  /** Safe to spend per day until payday; 0 when nothing is left. */
  perDay: number
  /** Days from today until the money runs out at the current pace; null when it lasts to payday. */
  runOutInDays: number | null
  daysLeft: number
  /** Days of data still needed before the hero can speak with confidence. */
  daysMore: number
}
