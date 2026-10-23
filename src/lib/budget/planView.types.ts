import type { BudgetBlock, BudgetPlan, BudgetPlanCategory, Currency } from '@/lib/store/types'
import type { BudgetChapter } from '@/lib/budget/blocks'
import type { LineStatusView } from '@/lib/budget/lineStatus'
import type { Insight } from '@/lib/budget/insights'
import type { GoalStatusView } from '@/lib/goals/goalStatus'

/** `plan` designs the budget; `month` overlays what actually happened in the selected cycle. */
export type PlanMode = 'plan' | 'month'

/** All money below is in `base` currency, already converted. Nothing here formats numbers. */
export interface LineView {
  line: BudgetPlanCategory
  block: BudgetBlock
  amount: number
  /** Share of income, 0-100. */
  percent: number
  /** Spent in the selected cycle (0 in plan mode). */
  spent: number
  /** spent / amount as 0-100+ (0 when amount is 0). */
  usedPercent: number
  /** Three-month average spend for the line, null when there is no history. */
  average: number | null
  /** Live monthly value for a linked line (subscriptions, debt minimum, goal draw); null when not linked. */
  liveAmount: number | null
  dueDay: number | null
  paid: boolean
  status: LineStatusView
}

export interface BlockView {
  block: BudgetBlock
  total: number
  percent: number
  /** Sum of `spent` over the block's lines (0 in plan mode). */
  spent: number
  lines: LineView[]
}

export interface ChapterView {
  chapter: BudgetChapter
  total: number
  percent: number
  spent: number
  blocks: BlockView[]
}

export interface SubscriptionItem {
  id: string
  name: string
  /** Brand catalogue key when known (drives the logo), else null. */
  brandKey: string | null
  amount: number
}

export interface SubscriptionsExtras {
  items: SubscriptionItem[]
  /** Next scheduled charge in the cycle. */
  next: { name: string; date: string; amount: number } | null
  /** Charges already posted this cycle and charges still to come (month mode). */
  charged: number
  total: number
  left: { name: string; date: string; amount: number }[]
  /** Yearly plans' monthly set-aside. */
  yearlySetAside: number
}

export interface DebtExtras {
  id: string
  name: string
  kind: 'credit_card' | 'installment' | 'loan' | 'personal'
  balance: number
  /** 0-100 of the starting balance already paid. */
  paidPercent: number
  minimum: number
  installment: { done: number; total: number } | null
  paidThisCycle: boolean
}

export interface GoalExtras {
  id: string
  name: string
  /** Lucide icon key. */
  icon: string
  current: number
  target: number | null
  percent: number
  targetDate: string | null
  monthly: number
  status: GoalStatusView
}

export interface SafetyExtras {
  monthsHeld: number
  targetMonths: number
  liquid: number
  essentialsMonthly: number
  /** `YYYY-MM` the target is reached at the planned contribution, null when never or no contribution. */
  reachedMonth: string | null
}

export interface PlanExtras {
  subscriptions: SubscriptionsExtras
  debts: DebtExtras[]
  goals: GoalExtras[]
  safety: SafetyExtras
  /** Salary day of month for the bills rail, null when unknown. */
  paydayDay: number | null
  /** Debt-free month (`YYYY-MM`) at minimums plus the planned extra payoff, null when unknown. */
  debtFreeMonth: string | null
}

export interface PlanView {
  plan: BudgetPlan
  mode: PlanMode
  base: Currency
  income: number
  /** Income minus every line. Zero is balanced, negative is over-assigned. */
  free: number
  balanced: boolean
  totals: Record<BudgetBlock, number>
  chapters: ChapterView[]
  blocks: Record<BudgetBlock, BlockView>
  /** One entry per block in page order, for the flow strip. */
  flow: { block: BudgetBlock; percent: number; amount: number }[]
  insights: Insight[]
  extras: PlanExtras
  dayOfCycle: number
  daysInCycle: number
  /** Ledger spend this cycle that no plan line claims. */
  unassignedSpend: number
  /** True while every line is a pre-v2 row without a block: offer the "group my lines" upgrade. */
  needsUpgrade: boolean
  /** The plan is in its first cycle and mostly estimated: over-cap reads as a heads-up. */
  learning: boolean
}
