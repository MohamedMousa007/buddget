export interface BalanceReport {
  balance: number
  reportedAt: string
}

export interface GapResult {
  /** reported - ledger, newest report. Negative = money left that the ledger does not explain. */
  amount: number
  reportedAt: string
  newest: BalanceReport
  previous: BalanceReport
}

/** Clock-skew window: a row logged a moment after the bank's timestamp still explains the report. */
export const SKEW_MS = 2 * 60 * 1000

/** A lone newest report is trusted once it is old enough that a late-arriving entry would have landed. */
export const SETTLE_MS = 15 * 60 * 1000

/**
 * A gap is real when the two newest reports both disagree with the ledger by about the same amount
 * (one report can be a timing race), when the unexplained amount has grown since the previous report (money went
 * missing between the two, once the newest report has settled), or when the ledger matched the previous report and misses the newest by more than
 * the tolerance, once that report has settled: money left between the two reports that no entry explains.
 * `balanceAt(instant)` is the ledger balance at that instant.
 * `tolerance` is in account currency (1 unit exact, wider when the account has converted rows).
 */
export function detectGap(
  reports: readonly BalanceReport[],
  balanceAt: (instant: number) => number | undefined,
  tolerance = 1,
  now: number = Date.now(),
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
  if (Math.abs(g1) <= tolerance) return null
  const matchedBefore = Math.abs(g0) <= tolerance
  if (matchedBefore) {
    const settled = now - new Date(newest.reportedAt).getTime() >= SETTLE_MS
    return settled ? { amount: g1, reportedAt: newest.reportedAt, newest, previous } : null
  }
  if (Math.sign(g1) !== Math.sign(g0)) return null
  const persistent = Math.abs(g1 - g0) <= tolerance
  // More money is unexplained than at the previous report: it went missing between the two. Less is a deposit or a
  // correction catching up, which is not a reason to alarm.
  const growing = Math.abs(g1) > Math.abs(g0) + tolerance
  if (!persistent && !growing) return null
  if (!persistent && now - new Date(newest.reportedAt).getTime() < SETTLE_MS) return null
  return { amount: g1, reportedAt: newest.reportedAt, newest, previous }
}
