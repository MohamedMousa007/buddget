import { computeMonthlyStats, type MonthlyStatsInput } from './monthlyStats'

type Stats = ReturnType<typeof computeMonthlyStats>

let last: { input: MonthlyStatsInput; result: Stats } | null = null

function sameInput(a: MonthlyStatsInput, b: MonthlyStatsInput): boolean {
  const keys = Object.keys(a) as (keyof MonthlyStatsInput)[]
  return keys.length === Object.keys(b).length && keys.every((k) => Object.is(a[k], b[k]))
}

/**
 * Hook instances on one screen (page + useNetWorth + useFlowBand...) share identical inputs,
 * so the last result is reused instead of recomputing the whole ledger per instance.
 */
export function computeMonthlyStatsShared(input: MonthlyStatsInput): Stats {
  if (last && sameInput(last.input, input)) return last.result
  const result = computeMonthlyStats(input)
  last = { input, result }
  return result
}
