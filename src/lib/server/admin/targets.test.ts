import { describe, expect, it } from 'vitest'
import { blockedTarget } from './targets'
import type { AdminContext } from './guard'

const ranks: Record<string, number> = { owner: 0, admin: 10, support_agent: 30 }

/** A context whose staff table says who is staff and at which rank. */
function ctx(actorId: string, actorRank: number, staff: Record<string, string>): AdminContext {
  const service = {
    from: (table: string) => ({
      select: () => ({
        eq: (_col: string, value: string) => ({
          maybeSingle: async () => ({ data: table === 'admin_staff' && staff[value] ? { role_key: staff[value] } : null }),
          single: async () => ({ data: table === 'admin_roles' ? { rank: ranks[value] } : null }),
        }),
      }),
    }),
  }
  return { user: { id: actorId }, role: { rank: actorRank }, service } as unknown as AdminContext
}

describe('blockedTarget', () => {
  it('refuses acting on yourself unless the caller opts in', async () => {
    const c = ctx('owner1', 0, { owner1: 'owner' })
    expect(await blockedTarget(c, 'owner1')).toMatch(/your own account/)
    expect(await blockedTarget(c, 'owner1', { allowSelf: true })).toBeNull()
  })
  it('lets the owner act on a staff member’s app account, but nobody act on someone at or above them', async () => {
    const staff = { owner1: 'owner', a1: 'admin', s1: 'support_agent' }
    expect(await blockedTarget(ctx('owner1', 0, staff), 'a1')).toBeNull()
    expect(await blockedTarget(ctx('a1', 10, staff), 's1')).toBeNull()
    expect(await blockedTarget(ctx('a1', 10, staff), 'owner1')).toMatch(/at or above/)
    expect(await blockedTarget(ctx('s1', 30, staff), 'a1')).toMatch(/at or above/)
  })
  it('lets anyone act on an ordinary user', async () => {
    expect(await blockedTarget(ctx('s1', 30, { s1: 'support_agent' }), 'someone')).toBeNull()
  })
})
