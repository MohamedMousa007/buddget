const PREFIX = 'bdg-reset-seen-v1:'

export type ResetVerdict = 'none' | 'init' | 'wipe'

/**
 * Whether this device must drop its local copy because the account was reset elsewhere (admin portal, another
 * device). `seen` is the last reset stamp this device honoured: null means it has never recorded one, so it adopts
 * the server's stamp as its baseline instead of wiping (a device that predates the feature may hold unsynced work).
 */
export function decideReset(seen: string | null, at: string | null): ResetVerdict {
  if (seen === null) return 'init'
  if (!at) return 'none'
  const server = Date.parse(at)
  const local = seen === '' ? -Infinity : Date.parse(seen)
  return Number.isFinite(server) && server > local ? 'wipe' : 'none'
}

export function readResetSeen(userId: string): string | null {
  try {
    return window.localStorage.getItem(`${PREFIX}${userId}`)
  } catch {
    return null
  }
}

/** '' records "no reset yet", which is different from never having looked. */
export function writeResetSeen(userId: string, at: string | null): void {
  try {
    window.localStorage.setItem(`${PREFIX}${userId}`, at ?? '')
  } catch {
    /* restricted storage: the next pull adopts the stamp again, which only skips a wipe */
  }
}
