import { describe, expect, it } from 'vitest'
import { can, outranks, resolvePermissions } from './permissions'

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

  it('ranks lower numbers as more powerful', () => {
    expect(outranks(10, 20)).toBe(true)
    expect(outranks(10, 10)).toBe(false)
  })
})
