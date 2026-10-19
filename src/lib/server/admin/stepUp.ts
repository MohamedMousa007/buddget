import type { AdminContext } from './guard'
import { allowAttempt, clearFailures, isLocked, loadCredentials, recordFailure } from './credentials'
import { verifyPassword } from './crypto'
import { verifyEmailCode } from './emailCode'

export const STEP_UP_ERROR = 'Confirm with the code we emailed you or your admin password.'

export interface StepUpProof {
  /** The 6-digit code emailed to the staff member. */
  code?: unknown
  /** The admin password, as the alternative to a code. */
  stepUpPassword?: unknown
}

/**
 * Dangerous actions re-prove the person even inside an unlocked (or SSO) session, with a fresh emailed code or the
 * admin password. Failures count towards the same lockout as unlocking.
 */
export async function stepUp(ctx: AdminContext, proof: StepUpProof): Promise<boolean> {
  const cred = await loadCredentials(ctx.service, ctx.user.id)
  if (!cred?.setup_completed_at || isLocked(cred)) return false
  if (!(await allowAttempt(ctx.service, `admin-stepup:${ctx.user.id}`, 900, 12))) return false

  const ok =
    typeof proof.stepUpPassword === 'string' && proof.stepUpPassword
      ? await verifyPassword(proof.stepUpPassword, cred.password_hash)
      : !!ctx.user.email && (await verifyEmailCode(ctx.user.email, proof.code, ctx.user.id))
  if (ok) {
    await clearFailures(ctx.service, ctx.user.id)
    return true
  }
  await recordFailure(ctx.service, cred)
  await ctx.audit('auth.step_up_failed')
  return false
}
