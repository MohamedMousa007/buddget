export type PlanFrequency = 'weekly' | 'monthly' | 'quarterly'
export type PlanLengthUnit = 'months' | 'years'

const MONTHS_PER_PERIOD: Record<PlanFrequency, number> = { weekly: 12 / 52, monthly: 1, quarterly: 3 }

const round2 = (n: number) => Math.round(n * 100) / 100

/** Number of payments that fit in a plan of `length` months/years at `frequency` (min 1). */
export function paymentsForLength(length: number, unit: PlanLengthUnit, frequency: PlanFrequency): number {
  const months = unit === 'years' ? length * 12 : length
  return Math.max(1, Math.round(months / MONTHS_PER_PERIOD[frequency]))
}

/** Plan length in `unit` covered by `count` payments at `frequency`. */
export function lengthForPayments(count: number, unit: PlanLengthUnit, frequency: PlanFrequency): number {
  const months = count * MONTHS_PER_PERIOD[frequency]
  return round2(unit === 'years' ? months / 12 : months)
}

export const totalFromPer = (per: number, count: number): number => round2(per * count)

export const perFromTotal = (total: number, count: number): number => round2(total / count)
