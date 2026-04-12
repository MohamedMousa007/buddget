/**
 * Estimates equal payments needed to clear `remainingAmount` by `targetDate` at `frequency`.
 */
export function calculateGoalPayment(
  remainingAmount: number,
  targetDate: string,
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'annually'
): { amountPerPeriod: number; totalPeriods: number; startDate: string } {
  const now = new Date()
  const target = new Date(targetDate)
  const msPerPeriod = {
    weekly: 7 * 24 * 60 * 60 * 1000,
    monthly: 30.44 * 24 * 60 * 60 * 1000,
    quarterly: 91.31 * 24 * 60 * 60 * 1000,
    annually: 365.25 * 24 * 60 * 60 * 1000,
  }
  const totalMs = target.getTime() - now.getTime()
  const totalPeriods = Math.max(1, Math.ceil(totalMs / msPerPeriod[frequency]))
  const amountPerPeriod = Math.ceil((remainingAmount / totalPeriods) * 100) / 100
  return { amountPerPeriod, totalPeriods, startDate: now.toISOString() }
}
