export const SIGNOUT_FLUSH_TIMEOUT_MS = 3_000

/**
 * Holds the local wipe at sign-out until the last edits are sent, but never on a stalled request: once the timeout
 * passes with the flush still running, `askWipeAnyway` decides. True wipes now (the unsent edits are lost); false keeps
 * waiting for the flush. Resolves when it is time to wipe.
 */
export async function settleBeforeWipe(finalFlush: Promise<unknown>, askWipeAnyway: () => Promise<boolean>, timeoutMs: number = SIGNOUT_FLUSH_TIMEOUT_MS): Promise<void> {
  const settled = finalFlush.then(() => undefined, (e) => console.error('[auth] flush before signOut failed', e))
  let timer: ReturnType<typeof setTimeout> | undefined
  const sent = await Promise.race([
    settled.then(() => true),
    new Promise<boolean>((resolve) => { timer = setTimeout(() => resolve(false), timeoutMs) }),
  ])
  clearTimeout(timer)
  if (sent) return
  if (!(await askWipeAnyway())) await settled
}
