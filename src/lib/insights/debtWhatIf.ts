export interface DebtPayoff {
  /** Months until the plans are paid off at the current monthly payments. */
  months: number
  /** Months with the extra payment added. */
  monthsWithExtra: number
  monthsSooner: number
}

/**
 * Pay-off time for plans that carry no interest (instalments), at today's monthly payments and with an extra amount
 * a month. Null when there is nothing to pay or no payment to measure against.
 */
export function debtPayoff(remaining: number, monthly: number, extra: number): DebtPayoff | null {
  if (!(remaining > 0) || !(monthly > 0)) return null
  const e = Math.max(0, extra)
  const months = Math.ceil(remaining / monthly)
  const monthsWithExtra = Math.ceil(remaining / (monthly + e))
  return { months, monthsWithExtra, monthsSooner: Math.max(0, months - monthsWithExtra) }
}
