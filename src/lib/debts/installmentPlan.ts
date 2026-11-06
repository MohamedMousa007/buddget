export type PlanFrequency = 'weekly' | 'monthly' | 'quarterly'
export type PlanLengthUnit = 'months' | 'years'

const MONTHS_PER_PERIOD: Record<PlanFrequency, number> = { weekly: 12 / 52, monthly: 1, quarterly: 3 }

/** Longest plan the form accepts (50 years of monthly slices). */
export const MAX_INSTALLMENT_COUNT = 600

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

/**
 * Amount to post for a scheduled installment. Equal slices are rounded to cents, so `count` slices strand or
 * overshoot the total by up to count x 0.5c (100 / 3 = 33.33 x 3). The rounding remainder is folded into the
 * LAST installment: when `completed` of `count` slices are already covered, it pays exactly what is left, so the
 * installments always sum to the total to the cent. A slice never exceeds what is left.
 */
export function settleInstallmentAmount(
  amount: number,
  remaining: number,
  plan?: { count: number; completed: number },
): number {
  const isLast = !!plan && plan.count > 0 && plan.completed >= plan.count - 1
  return isLast || amount >= remaining ? remaining : amount
}
