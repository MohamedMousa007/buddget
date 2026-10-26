import type { AdminContext } from './guard'

/** The users, out of these, whose financial content this staff member may read right now (owner: all). One query. */
export async function grantedUsers(ctx: AdminContext, userIds: readonly string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set()
  const { data } = await ctx.service.rpc('admin_granted_users', { p_staff: ctx.staff.id, p_users: [...new Set(userIds)] })
  return new Set(data ?? [])
}

export async function hasFinancialGrant(ctx: AdminContext, userId: string): Promise<boolean> {
  return (await grantedUsers(ctx, [userId])).has(userId)
}
