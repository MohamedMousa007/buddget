/** A sync notice repeats on every sync pass while the cause lasts; once a minute is enough to tell the user. */
export const SYNC_NOTICE_QUIET_MS = 60_000

/** Whether `notice` may show now, given when each notice last showed; records the showing when it may. */
export function takeSyncNotice(shown: Map<string, number>, notice: string, now: number): boolean {
  const last = shown.get(notice)
  if (last !== undefined && now - last < SYNC_NOTICE_QUIET_MS) return false
  shown.set(notice, now)
  return true
}
