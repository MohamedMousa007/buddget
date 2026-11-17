import { describe, expect, it } from 'vitest'
import { can, isPermission, outranks, resolvePermissions } from './permissions'

describe('permissions', () => {
  it('gives the owner everything', () => {
    expect(can(resolvePermissions('owner', [], []), 'users.delete')).toBe(true)
  })

  it('strips owner-only permissions from other roles, even when granted individually', () => {
    const perms = resolvePermissions('admin', ['users.view'], ['users.delete', 'sms.view'])
    expect(can(perms, 'users.delete')).toBe(false)
    expect(can(perms, 'sms.view')).toBe(true)
  })

  it('ignores unknown permission strings', () => {
    expect(resolvePermissions('viewer', ['nope'], []).size).toBe(0)
  })

  it('knows the Pro, Sparks and invite permissions, and the owner holds them', () => {
    for (const p of ['billing.grant', 'sparks.manage', 'referrals.manage', 'loyalty.manage'] as const) {
      expect(isPermission(p)).toBe(true)
      expect(can(resolvePermissions('owner', [], []), p)).toBe(true)
      expect(can(resolvePermissions('admin', [p], []), p)).toBe(true)
    }
    expect(can(resolvePermissions('support_agent', ['users.view'], ['sparks.manage']), 'sparks.manage')).toBe(true)
    expect(can(resolvePermissions('support_agent', ['users.view'], []), 'billing.grant')).toBe(false)
  })

  it('ranks lower numbers as more powerful', () => {
    expect(outranks(10, 20)).toBe(true)
    expect(outranks(10, 10)).toBe(false)
  })
})
