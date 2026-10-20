const PREFIX = 'bdg-sync-cursor-v1:'

/** Where this device last caught up with the server, per account. Only trusted together with a store that holds that account's data. */
export function readSyncCursor(userId: string, storeVersion: number): string | null {
  try {
    return window.localStorage.getItem(`${PREFIX}${storeVersion}:${userId}`)
  } catch {
    return null
  }
}

export function writeSyncCursor(userId: string, storeVersion: number, cursor: string): void {
  try {
    window.localStorage.setItem(`${PREFIX}${storeVersion}:${userId}`, cursor)
  } catch {
    /* restricted storage: the next pull is simply a full one */
  }
}

/** The local copy is gone or suspect (sign-out, reset, fallback): the next pull starts from scratch. */
export function clearSyncCursors(): void {
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i)
      if (k?.startsWith(PREFIX)) window.localStorage.removeItem(k)
    }
  } catch {
    /* restricted storage */
  }
}
