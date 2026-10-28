import { APP_CLIENT_VERSION, isVersionBelow } from '@/lib/appVersion'

export const LOCK_OUT_CONFIRMATION = 'LOCK OUT USERS'

/** A minimum above the newest shipped release would lock out every user, so it needs a typed confirmation. */
export function exceedsLatestRelease(...minimums: readonly string[]): boolean {
  return minimums.some((v) => v !== '' && isVersionBelow(APP_CLIENT_VERSION, v))
}

export function confirmsLockOut(text: unknown): boolean {
  return text === LOCK_OUT_CONFIRMATION
}
