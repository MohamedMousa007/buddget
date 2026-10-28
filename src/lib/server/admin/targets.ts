import type { AdminContext } from './guard'
import { outranks } from '@/lib/admin/permissions'

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Staff accounts are only ever acted on by someone who outranks them, and nobody acts destructively on themselves,
 * except where the caller opts in with `allowSelf` (the owner resetting or emptying their own app account).
 * Returns an error message, or null when the action is allowed.
 */
export async function blockedTarget(ctx: AdminContext, targetUserId: string, opts: { allowSelf?: boolean } = {}): Promise<string | null> {
  if (targetUserId === ctx.user.id) return opts.allowSelf ? null : 'You cannot do this to your own account.'
  const { data } = await ctx.service.from('admin_staff').select('role_key').eq('user_id', targetUserId).maybeSingle()
  if (!data) return null
  const { data: role } = await ctx.service.from('admin_roles').select('rank').eq('key', data.role_key).single()
  if (!role || !outranks(ctx.role.rank, role.rank)) return 'That account belongs to staff at or above your level.'
  return null
}
