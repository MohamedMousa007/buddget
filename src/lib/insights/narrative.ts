import type { HeroVerdict } from './analysis'
import type { Insight } from './types'

/**
 * Buddgy's read on the month, as data. The pure function picks what to say from the detectors and the hero verdict;
 * the copy module turns each line into words, so no sentence is built by joining strings. No AI call.
 */
export type ReadLine =
  | { key: 'paceBudget'; dailyRate: number; over: boolean; delta: number; far: boolean }
  | { key: 'paceUsual'; dailyRate: number; more: boolean; delta: number }
  | { key: 'paceProjection'; dailyRate: number; projected: number }
  | { key: 'early'; spent: number; daysMore: number }
  | { key: 'driverShift'; name: string; pct: number; up: boolean }
  | { key: 'driverTop'; name: string; share: number }
  | { key: 'driverUnusual'; description: string; amount: number }
  | { key: 'bills'; count: number; total: number }
  | { key: 'actionLand'; landDaily: number }
  | { key: 'actionNothingLeft' }
  | { key: 'actionKeep'; delta: number }

export type ReadQuestion = { key: 'whyCategory'; name: string } | { key: 'whereCut' } | { key: 'makePlan' } | { key: 'billsOk' } | { key: 'whatNext' }

export interface BuddgyRead {
  lines: ReadLine[]
  /** Always two: they open Buddgy with the question already asked. */
  questions: [ReadQuestion, ReadQuestion]
}

const find = (insights: readonly Insight[], kind: Insight['kind']) => insights.find((f) => f.kind === kind)
const num = (v: number | string | undefined) => Number(v ?? 0)

/** At most three lines: how the month ends, what drives it, what to do. Null when there is nothing to read yet. */
export function composeRead(verdict: HeroVerdict, insights: readonly Insight[]): BuddgyRead | null {
  if (verdict.kind === 'noIncome') return null
  const lines: ReadLine[] = []
  if (verdict.kind === 'budget') lines.push({ key: 'paceBudget', dailyRate: verdict.dailyRate, over: verdict.over, delta: verdict.delta, far: verdict.status === 'over' })
  else if (verdict.kind === 'usual') lines.push({ key: 'paceUsual', dailyRate: verdict.dailyRate, more: verdict.more, delta: verdict.delta })
  else if (verdict.kind === 'projection') lines.push({ key: 'paceProjection', dailyRate: verdict.dailyRate, projected: verdict.projected })
  else lines.push({ key: 'early', spent: verdict.spent, daysMore: verdict.daysMore })

  const shift = find(insights, 'categoryShift')
  const top = find(insights, 'topCategory')
  const unusual = find(insights, 'unusualPurchase')
  const bills = find(insights, 'billsBeforePayday')
  if (shift && num(shift.params.up) === 1) lines.push({ key: 'driverShift', name: String(shift.params.name), pct: num(shift.params.pct), up: true })
  else if (unusual) lines.push({ key: 'driverUnusual', description: String(unusual.params.description), amount: num(unusual.params.amount) })
  else if (top) lines.push({ key: 'driverTop', name: String(top.params.name), share: num(top.params.share) })
  else if (shift) lines.push({ key: 'driverShift', name: String(shift.params.name), pct: num(shift.params.pct), up: false })

  const over = verdict.kind === 'budget' && verdict.over
  if (verdict.kind === 'budget' && verdict.daysLeft > 0) {
    if (!over) lines.push({ key: 'actionKeep', delta: verdict.delta })
    else if (verdict.landDaily === null) {
      if (bills) lines.push({ key: 'bills', count: num(bills.params.count), total: num(bills.params.total) })
    } else if (verdict.landDaily > 0) lines.push({ key: 'actionLand', landDaily: verdict.landDaily })
    else lines.push({ key: 'actionNothingLeft' })
  } else if (bills) {
    lines.push({ key: 'bills', count: num(bills.params.count), total: num(bills.params.total) })
  }

  const first: ReadQuestion = shift && num(shift.params.up) === 1 ? { key: 'whyCategory', name: String(shift.params.name) } : top ? { key: 'whereCut' } : bills ? { key: 'billsOk' } : { key: 'whatNext' }
  const second: ReadQuestion = over || first.key !== 'whatNext' ? { key: 'makePlan' } : { key: 'whereCut' }
  return { lines, questions: [first, second] }
}
