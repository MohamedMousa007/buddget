const KEY = 'bdg-pw-updated'

/** Set just before the reset flow's full reload, so the next page asks the server about the one-shot cookie (HttpOnly, so unreadable here). */
export function setPasswordUpdatedHint(): void {
  try { sessionStorage.setItem(KEY, '1') } catch { /* private mode: the message is skipped, the password is still changed */ }
}

/** True once per hint; clears it. A forged hint only costs one request that answers `pending: false`. */
export function takePasswordUpdatedHint(): boolean {
  try {
    const set = sessionStorage.getItem(KEY) === '1'
    if (set) sessionStorage.removeItem(KEY)
    return set
  } catch { return false }
}
