import { getDaysInMonth } from 'date-fns'
import type { BudgetBlock, BudgetPlan, BudgetPlanCategory, Currency } from '@/lib/store/types'
import {
  BLOCK_CHAPTER,
  BUDGET_BLOCKS,
  CHAPTERS,
  blockTotals,
  chapterTotals,
  freeToAssign,
  lineBlock,
  percentOfIncome,
  planIncome,
} from '@/lib/budget/blocks'
import { effectivePlanCategoryAmountInBase } from '@/lib/budget/budgetPlans'
import { debtFreeMonth } from '@/lib/budget/debtPayoff'
import { computeInsights } from '@/lib/budget/insights'
import { HOUSING } from '@/lib/budget/legacyUpgrade'
import { getLineStatus } from '@/lib/budget/lineStatus'
import { shiftMonth } from '@/lib/budget/lineSpend'
import type {
  BlockView,
  ChapterView,
  DebtExtras,
  GoalExtras,
  LineView,
  PlanExtras,
  PlanMode,
  PlanView,
  SubscriptionsExtras,
} from '@/lib/budget/planView.types'

export interface PlanViewInput {
  plan: BudgetPlan
  mode: PlanMode
  base: Currency
  rates: Record<string, number>
  /** Today; the projections count months from here. */
  now: Date
  /** Income the sources project for the selected cycle (base); the plan's override wins. */
  projectedIncome: number
  cycle: { start: Date; dayOfCycle: number; daysInCycle: number }
  paydayDay: number | null
  /** Spent per line id in the selected cycle (base). Ignored in plan mode. */
  spentByLine: Record<string, number>
  /** Three-month average per line id; missing or null = no history. */
  averageByLine: Record<string, number | null>
  /** Cycles in a row each line ended over its cap. */
  monthsOverCapByLine: Record<string, number>
  unassignedSpend: number
  subscriptions: { extras: SubscriptionsExtras; monthly: number }
  debts: DebtExtras[]
  goals: GoalExtras[]
  safety: { liquid: number; essentialsMonthly: number; targetMonths: number }
}

/** A bill, subscription or debt counts as paid once the cycle's spend covers 90% of the plan. */
export const PAID_RATIO = 0.9
const PAYABLE_BLOCKS: readonly BudgetBlock[] = ['bills', 'subscriptions', 'debts']

/** Day of the cycle (1-based) a calendar day of month falls on; the 31st clamps to a short month's last day. */
export function cycleDayOf(start: Date, daysInCycle: number, dueDay: number): number | null {
  for (let n = 0; n < daysInCycle; n++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + n)
    if (d.getDate() === Math.min(dueDay, getDaysInMonth(d))) return n + 1
  }
  return null
}

/** The view of one line, wherever its block is. */
export function findLineView(view: PlanView, lineId: string): LineView | null {
  for (const block of BUDGET_BLOCKS) {
    const found = view.blocks[block].lines.find((l) => l.line.id === lineId)
    if (found) return found
  }
  return null
}

export function isBalanced(free: number, income: number): boolean {
  return Math.abs(free) <= Math.max(1, income * 0.002)
}

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0)

interface LiveSources {
  subscriptionsMonthly: number
  debts: Map<string, number>
  goals: Map<string, number>
  /** Live totals of debts and goals no line names, for lines linked without ids. */
  unclaimedDebts: number
  unclaimedGoals: number
}

function liveSources(i: PlanViewInput): LiveSources {
  const claimed = (type: 'debts' | 'goal') =>
    new Set(i.plan.categories.filter((c) => c.linkType === type).flatMap((c) => c.linkIds ?? []))
  const claimedDebts = claimed('debts')
  const claimedGoals = claimed('goal')
  return {
    subscriptionsMonthly: i.subscriptions.monthly,
    debts: new Map(i.debts.map((d) => [d.id, d.minimum])),
    goals: new Map(i.goals.map((g) => [g.id, g.monthly])),
    unclaimedDebts: sum(i.debts.filter((d) => !claimedDebts.has(d.id)).map((d) => d.minimum)),
    unclaimedGoals: sum(i.goals.filter((g) => !claimedGoals.has(g.id)).map((g) => g.monthly)),
  }
}

/** What the app itself says the line should be this month; null for lines the user types. */
function liveAmountOf(c: BudgetPlanCategory, live: LiveSources): number | null {
  const ids = c.linkIds ?? []
  switch (c.linkType) {
    case 'subscriptions': return live.subscriptionsMonthly
    case 'debts': return ids.length ? sum(ids.map((id) => live.debts.get(id) ?? 0)) : live.unclaimedDebts
    case 'goal': return ids.length ? sum(ids.map((id) => live.goals.get(id) ?? 0)) : live.unclaimedGoals
    default: return null
  }
}

function lineViewOf(c: BudgetPlanCategory, i: PlanViewInput, income: number, live: LiveSources): LineView {
  const tracking = i.mode === 'month'
  const block = lineBlock(c)
  const amount = effectivePlanCategoryAmountInBase(c, i.base, i.rates)
  const spent = tracking ? i.spentByLine[c.id] ?? 0 : 0
  const average = i.averageByLine[c.id] ?? null
  const liveAmount = liveAmountOf(c, live)
  const singleDebt = c.linkType === 'debts' && c.linkIds?.length === 1 ? i.debts.find((d) => d.id === c.linkIds![0]) : undefined
  const paid = tracking && PAYABLE_BLOCKS.includes(block) && amount > 0 &&
    (spent >= amount * PAID_RATIO || singleDebt?.paidThisCycle === true)
  return {
    line: c,
    block,
    amount,
    percent: percentOfIncome(amount, income),
    spent,
    usedPercent: amount > 0 ? (spent / amount) * 100 : 0,
    average,
    liveAmount,
    dueDay: c.dueDay ?? null,
    paid,
    status: getLineStatus({
      block,
      planned: amount,
      spent,
      mode: i.mode,
      dayOfCycle: i.cycle.dayOfCycle,
      daysInCycle: i.cycle.daysInCycle,
      dueDay: c.dueDay != null ? cycleDayOf(i.cycle.start, i.cycle.daysInCycle, c.dueDay) : null,
      paid,
      linkedDrift: liveAmount == null ? 0 : liveAmount - amount,
      locked: c.locked === true,
      essential: c.essential === true,
      averageSpend: average,
      unbudgeted: amount <= 0 && spent > 0,
      hasHistoryOverCap: i.monthsOverCapByLine[c.id] ?? 0,
    }),
  }
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function extrasOf(i: PlanViewInput, totals: Record<BudgetBlock, number>): PlanExtras {
  const { liquid, essentialsMonthly, targetMonths } = i.safety
  const gap = targetMonths * essentialsMonthly - liquid
  const contribution = totals.safety
  const reachedMonth = gap <= 0
    ? monthKey(i.now)
    : contribution > 0 ? shiftMonth(monthKey(i.now), Math.ceil(gap / contribution)) : null
  const minimums = sum(i.debts.map((d) => d.minimum))
  return {
    subscriptions: i.subscriptions.extras,
    debts: i.debts,
    goals: i.goals,
    safety: {
      monthsHeld: essentialsMonthly > 0 ? liquid / essentialsMonthly : 0,
      targetMonths,
      liquid,
      essentialsMonthly,
      reachedMonth,
    },
    paydayDay: i.paydayDay,
    debtFreeMonth: debtFreeMonth(i.debts, Math.max(0, totals.debts - minimums), i.now),
  }
}

export function buildPlanView(i: PlanViewInput): PlanView {
  const { plan, mode, base } = i
  const income = planIncome(plan, i.projectedIncome)
  const totals = blockTotals(plan, base, i.rates)
  const chapterSums = chapterTotals(totals)
  const free = freeToAssign(income, totals)
  const live = liveSources(i)

  const lines = plan.categories.map((c) => lineViewOf(c, i, income, live))
  const blocks = Object.fromEntries(
    BUDGET_BLOCKS.map((block): [BudgetBlock, BlockView] => {
      const own = lines.filter((l) => l.block === block)
      return [block, {
        block,
        total: totals[block],
        percent: percentOfIncome(totals[block], income),
        spent: sum(own.map((l) => l.spent)),
        lines: own,
      }]
    })
  ) as Record<BudgetBlock, BlockView>

  const chapters = CHAPTERS.map((chapter): ChapterView => {
    const own = BUDGET_BLOCKS.filter((b) => BLOCK_CHAPTER[b] === chapter).map((b) => blocks[b])
    return {
      chapter,
      total: chapterSums[chapter],
      percent: percentOfIncome(chapterSums[chapter], income),
      spent: sum(own.map((b) => b.spent)),
      blocks: own,
    }
  })

  const unassignedSpend = mode === 'month' ? i.unassignedSpend : 0
  const housingMonthly = sum(
    lines.filter((l) => l.block === 'bills' && (HOUSING.test(l.line.name) || l.line.expenseCategories?.includes('Rent')))
      .map((l) => l.amount)
  )

  return {
    plan,
    mode,
    base,
    income,
    free,
    balanced: isBalanced(free, income),
    totals,
    chapters,
    blocks,
    flow: BUDGET_BLOCKS.map((block) => ({ block, percent: blocks[block].percent, amount: totals[block] })),
    insights: computeInsights({
      income,
      totals,
      essentialsMonthly: i.safety.essentialsMonthly,
      liquidSavings: i.safety.liquid,
      emergencyTargetMonths: i.safety.targetMonths,
      housingMonthly,
      lines: lines.map((l) => ({
        id: l.line.id,
        name: l.line.name,
        block: l.block,
        planned: l.amount,
        monthsOverCap: i.monthsOverCapByLine[l.line.id] ?? 0,
        avg3: l.average,
      })),
      subscriptionsLive: i.subscriptions.monthly,
      subscriptionsPlanned: totals.subscriptions,
      unassignedSpend,
      free,
    }),
    extras: extrasOf(i, totals),
    dayOfCycle: i.cycle.dayOfCycle,
    daysInCycle: i.cycle.daysInCycle,
    unassignedSpend,
    needsUpgrade: plan.categories.length > 0 && plan.categories.every((c) => !c.block),
  }
}
