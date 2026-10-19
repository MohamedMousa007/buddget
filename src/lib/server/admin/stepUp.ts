import type { AdminContext } from './guard'
import { consumeSecondFactor, loadCredentials } from './credentials'

/** Dangerous actions re-ask for a fresh authenticator code even inside an unlocked session. */
export async function stepUp(ctx: AdminContext, code: unknown): Promise<boolean> {
  if (typeof code !== 'string') return false
  const cred = await loadCredentials(ctx.service, ctx.user.id)
  if (!cred) return false
  return (await consumeSecondFactor(ctx.service, cred, code)).ok
}
