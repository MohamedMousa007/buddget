export const SIGNOUT_FLUSH_TIMEOUT_MS = 3_000

/**
 * Decides whether sign-out may wipe the device. `finalFlush` resolves true only when the server has acknowledged every
 * local edit (a flush that failed, was skipped offline, or left rows unsent resolves false). Acked in time: wipe.
 * Otherwise (failed, offline, or still running at the timeout) `askWipeAnyway` decides: true wipes and loses the unsent
 * edits, false keeps the user signed in with the edits on the device. Resolves true when it is time to wipe.
 */
export async function settleBeforeWipe(finalFlush: Promise<boolean>, askWipeAnyway: () => Promise<boolean>, timeoutMs: number = SIGNOUT_FLUSH_TIMEOUT_MS): Promise<boolean> {
  const acked = finalFlush.catch((e) => {
    console.error('[auth] flush before signOut failed', e)
    return false
  })
  let timer: ReturnType<typeof setTimeout> | undefined
  const first = await Promise.race([
    acked,
    new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), timeoutMs) }),
  ])
  clearTimeout(timer)
  if (first === true) return true
  return askWipeAnyway()
}
