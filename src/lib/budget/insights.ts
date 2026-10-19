import type { BudgetBlock } from '@/lib/store/types'

export type InsightKind =
  | 'safetyNet' | 'lineOverCap' | 'housingShare' | 'essentialsShare'
  | 'subscriptionsDrift' | 'unassignedSpend' | 'freeToAssign'

export interface Insight {
  id: string
  kind: InsightKind
  severity: 'info' | 'warn'
  lineId?: string
  params: Record<string, number | string>
  action: 'openLine' | 'raise' | 'cap' | 'moveBuffer' | 'update' | 'addLine'
  mood: 'worried' | 'curious' | 'happy'
}

export interface InsightLine {
  id: string
  name: string
  block: BudgetBlock
  planned: number
  monthsOverCap: number
  avg3: number | null
  /** Locked or linked: the app never rewrites its amount on its own. */
  fixed?: boolean
}

export interface InsightsInput {
  income: number
  totals: Record<BudgetBlock, number>
  essentialsMonthly: number
  liquidSavings: number
  emergencyTargetMonths: number
  housingMonthly: number
  lines: InsightLine[]
  subscriptionsLive: number
  subscriptionsPlanned: number
  unassignedSpend: number
  free: number
}

/** An insight plus the money at stake, used only to order same-severity insights. */
type Candidate = Insight & { impact: number }

export const MAX_INSIGHTS = 3
export const HOUSING_SHARE_LIMIT = 0.35
export const ESSENTIALS_SHARE_LIMIT = 0.6
export const SUBSCRIPTION_DRIFT_MIN = 5
export const FREE_MONEY_SHARE = 0.01
export const OVER_CAP_MONTHS = 3
/** `monthsToTarget` when nothing is planned into the safety net. */
export const NEVER = -1

export function safetyNetInsight(i: InsightsInput): Candidate | null {
  if (i.essentialsMonthly <= 0) return null
  const runway = i.liquidSavings / i.essentialsMonthly
  if (runway >= i.emergencyTargetMonths) return null
  const gap = i.emergencyTargetMonths * i.essentialsMonthly - i.liquidSavings
  const contribution = i.totals.safety
  return {
    id: 'safetyNet', kind: 'safetyNet', severity: 'warn',
    params: {
      runway, target: i.emergencyTargetMonths,
      monthsToTarget: contribution > 0 ? Math.ceil(gap / contribution) : NEVER,
    },
    action: 'moveBuffer', mood: 'worried', impact: gap,
  }
}

export function lineOverCapInsights(i: InsightsInput): Candidate[] {
  return i.lines
    .filter((l) => l.monthsOverCap >= OVER_CAP_MONTHS)
    .map((l) => {
      const raiseTo = l.avg3 != null && l.avg3 > l.planned ? l.avg3 : null
      return {
        id: `lineOverCap:${l.id}`, kind: 'lineOverCap', severity: 'warn', lineId: l.id,
        params: { name: l.name, months: l.monthsOverCap, planned: l.planned, ...(raiseTo != null ? { avg3: raiseTo } : {}) },
        action: l.fixed ? 'openLine' : raiseTo != null ? 'raise' : 'cap', mood: 'worried',
        impact: raiseTo != null ? raiseTo - l.planned : l.planned,
      } satisfies Candidate
    })
}

export function housingShareInsight(i: InsightsInput): Candidate | null {
  if (i.income <= 0 || i.housingMonthly / i.income <= HOUSING_SHARE_LIMIT) return null
  return {
    id: 'housingShare', kind: 'housingShare', severity: 'warn',
    params: { percent: Math.round((i.housingMonthly / i.income) * 100), housing: i.housingMonthly },
    action: 'openLine', mood: 'worried', impact: i.housingMonthly - HOUSING_SHARE_LIMIT * i.income,
  }
}

export function essentialsShareInsight(i: InsightsInput): Candidate | null {
  if (i.income <= 0 || i.essentialsMonthly / i.income <= ESSENTIALS_SHARE_LIMIT) return null
  return {
    id: 'essentialsShare', kind: 'essentialsShare', severity: 'info',
    params: { percent: Math.round((i.essentialsMonthly / i.income) * 100), essentials: i.essentialsMonthly },
    action: 'update', mood: 'curious', impact: i.essentialsMonthly - ESSENTIALS_SHARE_LIMIT * i.income,
  }
}

export function subscriptionsDriftInsight(i: InsightsInput): Candidate | null {
  const delta = i.subscriptionsLive - i.subscriptionsPlanned
  if (Math.abs(delta) <= SUBSCRIPTION_DRIFT_MIN) return null
  return {
    id: 'subscriptionsDrift', kind: 'subscriptionsDrift', severity: 'info',
    params: { live: i.subscriptionsLive, planned: i.subscriptionsPlanned, delta },
    action: 'update', mood: 'curious', impact: Math.abs(delta),
  }
}

export function unassignedSpendInsight(i: InsightsInput): Candidate | null {
  if (i.unassignedSpend <= 0) return null
  return {
    id: 'unassignedSpend', kind: 'unassignedSpend', severity: 'info',
    params: { amount: i.unassignedSpend },
    action: 'addLine', mood: 'curious', impact: i.unassignedSpend,
  }
}

export function freeToAssignInsight(i: InsightsInput): Candidate | null {
  if (i.free <= i.income * FREE_MONEY_SHARE) return null
  return {
    id: 'freeToAssign', kind: 'freeToAssign', severity: 'info',
    params: { amount: i.free },
    action: 'moveBuffer', mood: 'happy', impact: i.free,
  }
}

const SEVERITY_RANK = { warn: 0, info: 1 } as const

/** At most three insights: warnings first, then the most money at stake. */
export function computeInsights(input: InsightsInput): Insight[] {
  const candidates: Array<Candidate | null> = [
    safetyNetInsight(input),
    ...lineOverCapInsights(input),
    housingShareInsight(input),
    essentialsShareInsight(input),
    subscriptionsDriftInsight(input),
    unassignedSpendInsight(input),
    freeToAssignInsight(input),
  ]
  return candidates
    .filter((c): c is Candidate => c !== null)
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.impact - a.impact)
    .slice(0, MAX_INSIGHTS)
    .map((c) => ({ id: c.id, kind: c.kind, severity: c.severity, lineId: c.lineId, params: c.params, action: c.action, mood: c.mood }))
}
