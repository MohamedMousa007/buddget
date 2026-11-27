import { describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ pocket: { id: 'p', currency: 'EGP', currentBalance: 100, heldInPaymentMethodId: 'acct1' }, balance: 100 }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/carryCycle', () => ({
  must: <T,>(r: T) => r,
  carryPostDate: () => '2026-09-30',
  closedCycleDrift: async (_s: unknown, _u: unknown, _d: unknown, _r: unknown, o: { monthKey: string }) => [{
    item: { monthKey: o.monthKey, currency: 'EGP', carry: 0, adjustment: 0, pocketId: 'p', carrySettledAt: null, settledAt: 's', posted: 0, recomputed: -80, delta: -80, stale: true },
    ctx: { base: 'EGP', end: new Date('2026-10-01T00:00:00Z'), accounts: [{ ...h.pocket }], figures: { income: 0, spend: 80, allocated: 0 } },
  }],
}))
vi.mock('@/lib/server/pocketLedger', () => ({
  groupIdFor: (k: string) => k,
  primaryTrackedAccountId: async () => null,
  depositToPocket: async () => {},
}))

import { applyCarryDrift } from './carryAdjust'

const service = () => {
  const claimed = new Set<string>()
  return {
    from: () => {
      let month = ''
      const q: Record<string, unknown> = {
        update: () => q,
        eq: (k: string, v: string) => (k === 'month_key' && (month = v), q),
        is: () => q,
        select: async () => {
          const fresh = !claimed.has(month)
          claimed.add(month)
          return { data: fresh ? [{ month_key: month }] : [], error: null }
        },
      }
      return q
    },
    rpc: async (_n: string, a: { p_delta: number }) => {
      await Promise.resolve()
      // The floor lives in adjust_pocket_balance (migration 0285), under the pocket's row lock.
      if (h.balance + a.p_delta < 0) return { error: { message: 'insufficient pocket balance' } }
      h.balance += a.p_delta
      return { error: null }
    },
  } as never
}

describe('applyCarryDrift concurrency', () => {
  it('two months carried into one pocket at once: the second withdrawal is refused and its claim released, never an overdraw', async () => {
    const s = service()
    const done = await Promise.allSettled([applyCarryDrift(s, 'u', '2026-08', 1, {}), applyCarryDrift(s, 'u', '2026-09', 1, {})])
    expect(done.map((d) => d.status).sort()).toEqual(['fulfilled', 'rejected'])
    expect(h.balance).toBe(20)
  })
})
