import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ send: vi.fn(), del: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/sendNativePush', () => ({ PUSH_NOT_CONFIGURED: 'nc', sendNativePush: h.send }))

import { emitNotification } from '@/lib/server/emitNotification'

const service = {
  from: () => ({
    insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'n1' }, error: null }) }) }),
    delete: () => ({ eq: (_c: string, id: string) => h.del(id) }),
  }),
} as never
const args = { userId: 'u', category: 'goal_behind', severity: 'info' as const, dedupeKey: 'k', title: 't', body: 'b' }

beforeEach(() => {
  h.send.mockReset()
  h.del.mockReset().mockResolvedValue({ error: null })
})

describe('NAT-9 push failure does not burn the dedupe key', () => {
  it('a send that could not start drops the row so the next run retries', async () => {
    h.send.mockResolvedValue({ ok: false, error: 'Failed to load tokens' })
    expect(await emitNotification(service, args)).toEqual({ created: false })
    expect(h.del).toHaveBeenCalledWith('n1')
  })
  it('a thrown send does the same', async () => {
    h.send.mockRejectedValue(new Error('boom'))
    expect(await emitNotification(service, args)).toEqual({ created: false })
  })
  it('a delivered push, or an unconfigured server, keeps the row', async () => {
    h.send.mockResolvedValue({ ok: true, sent: 1, failed: 0 })
    expect(await emitNotification(service, args)).toEqual({ created: true })
    h.send.mockResolvedValue({ ok: false, error: 'nc' })
    expect(await emitNotification(service, args)).toEqual({ created: true })
    expect(h.del).not.toHaveBeenCalled()
  })
})
