import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdminContext } from './guard'

const cred = { setup_completed_at: '2026-01-01', locked_until: null as string | null, password_hash: 'h' }
vi.mock('./credentials', () => ({
  loadCredentials: vi.fn(async () => cred),
  isLocked: (c: { locked_until: string | null }) => !!c.locked_until,
  allowAttempt: vi.fn(async () => true),
  clearFailures: vi.fn(async () => undefined),
  recordFailure: vi.fn(async () => ({ locked: false })),
}))
vi.mock('./crypto', () => ({ verifyPassword: vi.fn(async (p: string) => p === 'right') }))
vi.mock('./emailCode', () => ({ verifyEmailCode: vi.fn(async (_e: string, code: unknown) => code === '123456') }))

const perms = vi.hoisted(() => ({ roles: ['owner', 'admin'] as string[] }))
vi.mock('@/lib/admin/permissions', () => ({ confirmsInApp: (k: string) => perms.roles.includes(k) }))

import { stepUp } from './stepUp'

function ctx(roleKey: string) {
  const audit = vi.fn(async () => true)
  return { c: { user: { id: 'u1', email: 'a@x.test' }, role: { key: roleKey, rank: 0 }, service: {}, audit } as unknown as AdminContext, audit }
}

describe('stepUp in-app confirmation (BUD-94)', () => {
  beforeEach(() => {
    cred.locked_until = null
    perms.roles = ['owner', 'admin']
  })

  it('accepts the popup from owner and admin and marks the audit entry', async () => {
    for (const role of ['owner', 'admin']) {
      const { c, audit } = ctx(role)
      expect(await stepUp(c, { confirmed: true })).toBe(true)
      expect(audit).toHaveBeenCalledWith('auth.step_up_inapp', { metadata: { method: 'inapp_confirm', role } })
    }
  })

  it('refuses the popup from roles below admin and from custom roles, and logs the failure', async () => {
    for (const role of ['support_lead', 'custom_rank_5']) {
      const { c, audit } = ctx(role)
      expect(await stepUp(c, { confirmed: true })).toBe(false)
      expect(audit).toHaveBeenCalledWith('auth.step_up_failed')
    }
  })

  it('a lower role still passes with the emailed code or password', async () => {
    expect(await stepUp(ctx('support_lead').c, { code: '123456' })).toBe(true)
    expect(await stepUp(ctx('support_lead').c, { stepUpPassword: 'right' })).toBe(true)
  })

  it('a truthy non-boolean is not a confirmation', async () => {
    expect(await stepUp(ctx('owner').c, { confirmed: 'true' })).toBe(false)
  })

  it('a locked account fails even for the owner', async () => {
    cred.locked_until = '2999-01-01'
    expect(await stepUp(ctx('owner').c, { confirmed: true })).toBe(false)
  })

  it('with the flag emptied, admin needs the code again', async () => {
    perms.roles = []
    expect(await stepUp(ctx('admin').c, { confirmed: true })).toBe(false)
    expect(await stepUp(ctx('admin').c, { code: '123456' })).toBe(true)
  })
})
