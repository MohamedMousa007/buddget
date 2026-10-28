import { describe, expect, it, vi } from 'vitest'
import { tryPairLeg } from './pairing'

describe('tryPairLeg', () => {
  it('publishes kind and parsed_ok on the claim row before looking for a sibling', async () => {
    const order: string[] = []
    const service = {
      from: () => ({
        update: (v: Record<string, unknown>) => ({
          eq: async () => { order.push(`update:${JSON.stringify(v)}`); return { error: null } },
        }),
      }),
      rpc: vi.fn(async () => { order.push('rpc'); return { data: [{ sibling_id: 's1', sibling_kind: 'own_transfer' }], error: null } }),
    }
    const sibling = await tryPairLeg(service as never, {
      userId: 'u', logId: 'l', receivedAtIso: '2026-10-01T10:00:00Z', amount: 100, kind: 'own_transfer',
    })
    expect(order[0]).toBe('update:{"kind":"own_transfer","parsed_ok":true,"amount":100}')
    expect(order[1]).toBe('rpc')
    expect(sibling?.siblingId).toBe('s1')
  })

  it('also publishes amount and account_last4 so a concurrent sibling can match on them', async () => {
    const updates: Record<string, unknown>[] = []
    const service = {
      from: () => ({
        update: (v: Record<string, unknown>) => ({
          eq: async () => { updates.push(v); return { error: null } },
        }),
      }),
      rpc: vi.fn(async () => ({ data: [], error: null })),
    }
    await tryPairLeg(service as never, {
      userId: 'u', logId: 'l', receivedAtIso: '2026-10-01T10:00:00Z', amount: 250.5, kind: 'cc_payoff', accountLast4: '0978',
    })
    expect(updates[0]).toEqual({ kind: 'cc_payoff', parsed_ok: true, amount: 250.5, account_last4: '0978' })
  })
})
