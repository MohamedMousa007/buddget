import { describe, expect, it } from 'vitest'
import type { ServiceClient } from '@/lib/supabase/service'
import { resolveExactPaymentMethod, resolvePaymentMethodByLast4 } from './createSmsExpense'

type Method = { id: string; last4: string | null; is_default?: boolean }

function svc(methods: Method[]) {
  return {
    from: () => {
      const filters: Record<string, unknown> = {}
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: (c: string, v: unknown) => { filters[c] = v; return chain },
        is: () => chain,
        limit: () => chain,
        maybeSingle: async () => {
          const hits = methods.filter((m) => Object.entries(filters).every(([k, v]) => k === 'user_id' || (m as unknown as Record<string, unknown>)[k] === v))
          if (hits.length > 1) return { data: null, error: { code: 'PGRST116' } }
          return { data: hits[0] ? { id: hits[0].id } : null, error: null }
        },
        then: (r: (v: unknown) => unknown) => r({ data: methods.map((m) => ({ id: m.id, last4: m.last4 })), error: null }),
      }
      return chain
    },
  } as unknown as ServiceClient
}

describe('last4 shared by several registered methods', () => {
  const unique: Method[] = [{ id: 'a', last4: '1111' }, { id: 'b', last4: '2222' }]
  const shared: Method[] = [{ id: 'a', last4: '1111' }, { id: 'b', last4: '1111' }, { id: 'd', last4: null, is_default: true }]

  it('a unique last4 resolves', async () => {
    expect(await resolveExactPaymentMethod(svc(unique), 'u', '2222')).toBe('b')
    expect(await resolvePaymentMethodByLast4(svc(unique), 'u', '1111')).toBe('a')
  })

  it('an ambiguous last4 picks nothing (exact)', async () => {
    expect(await resolveExactPaymentMethod(svc(shared), 'u', '1111')).toBeNull()
  })

  it('an ambiguous last4 does not fall through to provider or default', async () => {
    expect(await resolvePaymentMethodByLast4(svc(shared), 'u', '1111', { sender: 'Some Bank' })).toBeNull()
  })

  it('an unknown last4 still falls back as before', async () => {
    expect(await resolveExactPaymentMethod(svc(unique), 'u', '9999')).toBeNull()
  })

  it('a shorter tail the bank prints names the account saved with more digits', async () => {
    const hsbc: Method[] = [{ id: 'acct', last4: '0001' }, { id: 'usd', last4: '0110' }, { id: 'card', last4: '5950' }]
    expect(await resolveExactPaymentMethod(svc(hsbc), 'u', '001')).toBe('acct')
    expect(await resolvePaymentMethodByLast4(svc(hsbc), 'u', '110')).toBe('usd')
  })

  it('a partial tail that fits two methods picks neither and does not fall back', async () => {
    const two: Method[] = [{ id: 'a', last4: '0001' }, { id: 'b', last4: '1001' }, { id: 'd', last4: null, is_default: true }]
    expect(await resolveExactPaymentMethod(svc(two), 'u', '001')).toBeNull()
    expect(await resolvePaymentMethodByLast4(svc(two), 'u', '001')).toBeNull()
  })
})
