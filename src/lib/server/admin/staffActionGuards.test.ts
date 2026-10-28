import { beforeEach, describe, expect, it, vi } from 'vitest'

const allowAttempt = vi.fn()
vi.mock('./credentials', () => ({ allowAttempt: (...a: unknown[]) => allowAttempt(...a) }))

import { allowUserAction, auditPiiRead, holdsAllPermissions, USER_ACTION_LIMITS } from './staffActionGuards'

const ctx = { service: {} as never, staff: { id: 's1' } as never }

beforeEach(() => allowAttempt.mockReset())

describe('allowUserAction', () => {
  it('limits per staff member and per target', async () => {
    allowAttempt.mockResolvedValue(true)
    expect(await allowUserAction(ctx, 'notify', 'u1')).toBe(true)
    expect(allowAttempt).toHaveBeenCalledWith(ctx.service, 'uact:notify:by:s1', 3600, USER_ACTION_LIMITS.notify!.staff)
    expect(allowAttempt).toHaveBeenCalledWith(ctx.service, 'uact:notify:to:u1', 3600, USER_ACTION_LIMITS.notify!.target)
  })

  it('refuses when either bucket is spent', async () => {
    allowAttempt.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    expect(await allowUserAction(ctx, 'send_password_reset', 'u1')).toBe(false)
    allowAttempt.mockReset()
    allowAttempt.mockResolvedValueOnce(false)
    expect(await allowUserAction(ctx, 'send_password_reset', 'u1')).toBe(false)
  })

  it('does not limit actions without a limit', async () => {
    expect(await allowUserAction(ctx, 'note', 'u1')).toBe(true)
    expect(allowAttempt).not.toHaveBeenCalled()
  })
})

describe('holdsAllPermissions', () => {
  const actor = (key: string, perms: string[]) => ({ role: { key } as never, permissions: new Set(perms) })
  it('lets the owner assign anything', () => expect(holdsAllPermissions(actor('owner', ['*']), ['users.security'])).toBe(true))
  it('refuses a role holding a permission the actor lacks', () => {
    expect(holdsAllPermissions(actor('lead', ['users.view']), ['users.view', 'users.security'])).toBe(false)
  })
  it('allows a subset', () => expect(holdsAllPermissions(actor('lead', ['users.view', 'users.notify']), ['users.view'])).toBe(true))
  it('treats an unknown permission as not held', () => expect(holdsAllPermissions(actor('lead', ['users.view']), ['nope'])).toBe(false))
})

describe('auditPiiRead', () => {
  const audit = vi.fn()
  const full = (canSeePii: boolean) => ({ ...ctx, canSeePii, audit }) as never

  beforeEach(() => audit.mockReset())

  it('audits once per window when the reader sees unmasked data', async () => {
    allowAttempt.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    await auditPiiRead(full(true), 'user_view', 'user', 'u1')
    await auditPiiRead(full(true), 'user_view', 'user', 'u1')
    expect(audit).toHaveBeenCalledTimes(1)
    expect(audit.mock.calls[0]![0]).toBe('pii.user_view')
  })

  it('skips masked readers unless asked', async () => {
    await auditPiiRead(full(false), 'user_list', 'user', null)
    expect(audit).not.toHaveBeenCalled()
    allowAttempt.mockResolvedValue(true)
    await auditPiiRead(full(false), 'user_activity', 'user', 'u1', { onlyWithPii: false })
    expect(audit).toHaveBeenCalledTimes(1)
  })
})
