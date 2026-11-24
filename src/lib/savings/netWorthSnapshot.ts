/** The local calendar day, `YYYY-MM-DD`, the same key `net_worth_snapshots.day` uses. */
export const snapshotDay = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Where this device remembers the last day it saved a snapshot for this account and currency. */
export const snapshotStampKey = (userId: string, currency: string): string => `bdg-nw-day:${userId}:${currency}`

/**
 * Net worth history only grew while the Wealth page was open. The app now also saves one snapshot a day from anywhere,
 * but only when the figure is complete (every holding priced, no gold or valuation gap) and not already saved today:
 * a partial figure would put a false dip into the history that the Insights net worth path is drawn from.
 */
export function dailySnapshotDue(i: { ready: boolean; netWorth: number; lastDay: string | null; today: string }): boolean {
  return i.ready && Number.isFinite(i.netWorth) && i.lastDay !== i.today
}
