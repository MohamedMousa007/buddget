import { isPermission, OWNER_ROLE } from '@/lib/admin/permissions'
import { allowAttempt } from './credentials'
import type { AdminContext } from './guard'

interface Limit {
  /** Per staff member, per hour. */
  staff: number
  /** Per target user, per hour, across all staff. */
  target: number
}

/** Actions that reach a user's phone or inbox, or weaken their sign-in: bounded so none can be used to harass or lock out someone. */
export const USER_ACTION_LIMITS: Record<string, Limit> = {
  notify: { staff: 20, target: 3 },
  test_push: { staff: 20, target: 5 },
  send_password_reset: { staff: 20, target: 2 },
  clear_trusted_devices: { staff: 20, target: 3 },
  remove_biometric: { staff: 20, target: 3 },
  reset_sms_tokens: { staff: 30, target: 5 },
  clear_push_tokens: { staff: 30, target: 5 },
}

const HOUR = 3600

type RateContext = Pick<AdminContext, 'service' | 'staff'>

/** False when this staff member or this target user has used the action too often. Actions without a limit always pass. */
export async function allowUserAction(ctx: RateContext, op: string, targetId: string): Promise<boolean> {
  const limit = USER_ACTION_LIMITS[op]
  if (!limit) return true
  return (
    (await allowAttempt(ctx.service, `uact:${op}:by:${ctx.staff.id}`, HOUR, limit.staff)) &&
    (await allowAttempt(ctx.service, `uact:${op}:to:${targetId}`, HOUR, limit.target))
  )
}

/** A non-owner can only hand out a role whose every permission they hold themselves. */
export function holdsAllPermissions(ctx: Pick<AdminContext, 'role' | 'permissions'>, perms: readonly string[]): boolean {
  if (ctx.role.key === OWNER_ROLE || ctx.permissions.has('*')) return true
  return perms.every((p) => isPermission(p) && ctx.permissions.has(p))
}

/**
 * Writes one audit row for a read of unmasked personal data, at most once per staff member, subject and 10 minutes,
 * so browsing a list is visible in the log without flooding it.
 */
export async function auditPiiRead(ctx: AdminContext, subject: string, targetType: string, targetId: string | null, opts: { onlyWithPii?: boolean } = {}): Promise<void> {
  if (opts.onlyWithPii !== false && !ctx.canSeePii) return
  if (!(await allowAttempt(ctx.service, `piiread:${ctx.staff.id}:${subject}:${targetId ?? '-'}`, 600, 1))) return
  await ctx.audit(`pii.${subject}`, { targetType, targetId: targetId ?? undefined, summary: `Viewed ${subject.replace(/_/g, ' ')}${ctx.canSeePii ? ' with personal details unmasked' : ''}` })
}
