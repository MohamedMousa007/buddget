import { isValidTimeZone } from '@/lib/server/userTimeZone'

export const deviceTimeZone = (): string | undefined => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return undefined
  }
}

/** The zone to store, or null when the stored one is already right or the device reports nothing usable. */
export function timeZoneUpdate(stored: string | null | undefined, device: string | undefined): string | null {
  if (!device || !isValidTimeZone(device) || device === stored) return null
  return device
}

/** A Date whose local fields read as `now` does on the wall clock in `timeZone`, for date-fns style "today" logic on a server. */
export function wallClockNow(now: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(now)
  const n = (t: string) => Number(parts.find((p) => p.type === t)!.value)
  return new Date(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second'))
}
