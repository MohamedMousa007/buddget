export interface BalanceReport {
  balance: number
  reportedAt: string
}

export interface GapResult {
  /** reported - ledger, newest report. Negative = money left that the ledger does not explain. */
  amount: number
  reportedAt: string
}

/** Clock-skew window: a row logged a moment after the bank's timestamp still explains the report. */
export const SKEW_MS = 2 * 60 * 1000

/**
 * A gap is real only when the two newest reports both disagree with the ledger by about the same amount
 * (one report can be a timing race). `balanceAt(instant)` is the ledger balance at that instant.
 * `tolerance` is in account currency (1 unit exact, wider when the account has converted rows).
 */
export function detectGap(
  reports: readonly BalanceReport[],
  balanceAt: (instant: number) => number | undefined,
  tolerance = 1,
): GapResult | null {
  const [newest, previous] = [...reports].sort((a, b) => b.reportedAt.localeCompare(a.reportedAt))
  if (!newest || !previous) return null
  const gapOf = (r: BalanceReport) => {
    const ledger = balanceAt(new Date(r.reportedAt).getTime() + SKEW_MS)
    return ledger == null ? null : Math.round((r.balance - ledger) * 100) / 100
  }
  const g1 = gapOf(newest)
  const g0 = gapOf(previous)
  if (g1 == null || g0 == null) return null
  if (Math.abs(g1) <= tolerance || Math.abs(g0) <= tolerance) return null
  if (Math.sign(g1) !== Math.sign(g0) || Math.abs(g1 - g0) > tolerance) return null
  return { amount: g1, reportedAt: newest.reportedAt }
}
