import { describe, expect, it } from 'vitest'
import type { ServiceClient } from '@/lib/supabase/service'
import { resolveExactPaymentMethod, resolvePaymentMethodByLast4 } from './createSmsExpense'

type Method = { id: string; last4: string | null; name?: string; is_default?: boolean }

function svc(methods: Method[]) {
  return {
    from: () => {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        is: () => chain,
        limit: () => chain,
        then: (r: (v: unknown) => unknown) => r({ data: methods.map((m) => ({ id: m.id, name: m.name ?? '', last4: m.last4, last4_aliases: [] })), error: null }),
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

  const HSBC = { sender: 'HSBC', bankName: 'HSBC Egypt' }
  const CIB = { sender: 'CIB', bankName: 'CIB' }

  it('a shorter tail the bank prints names the account saved with more digits', async () => {
    const hsbc: Method[] = [{ id: 'acct', name: 'HSBC Egypt ••0001', last4: '0001' }, { id: 'usd', name: 'HSBC Egypt ••0110', last4: '0110' }, { id: 'card', name: 'HSBC Egypt ••5950', last4: '5950' }]
    expect(await resolveExactPaymentMethod(svc(hsbc), 'u', '001', HSBC)).toBe('acct')
    expect(await resolvePaymentMethodByLast4(svc(hsbc), 'u', '110', HSBC)).toBe('usd')
  })

  it('a partial tail that fits two methods picks neither and does not fall back', async () => {
    const two: Method[] = [{ id: 'a', name: 'HSBC Egypt ••0001', last4: '0001' }, { id: 'b', name: 'HSBC Egypt ••1001', last4: '1001' }, { id: 'd', last4: null, is_default: true }]
    expect(await resolveExactPaymentMethod(svc(two), 'u', '001', HSBC)).toBeNull()
    expect(await resolvePaymentMethodByLast4(svc(two), 'u', '001', HSBC)).toBeNull()
  })

  describe('two banks that print the same short tail', () => {
    const both: Method[] = [{ id: 'hsbc', name: 'HSBC Egypt ••0001', last4: '0001' }, { id: 'cib', name: 'CIB ••0001', last4: '0001' }, { id: 'd', last4: null, is_default: true }]
    it('a message from bank A picks only bank A, whatever the other bank holds', async () => {
      expect(await resolveExactPaymentMethod(svc(both), 'u', '001', HSBC)).toBe('hsbc')
      expect(await resolveExactPaymentMethod(svc(both), 'u', '001', CIB)).toBe('cib')
      expect(await resolveExactPaymentMethod(svc(both), 'u', '0001', HSBC)).toBe('hsbc')
    })
    it('a short tail never matches a bank-B-only account for a bank-A message, and that is no ambiguity either', async () => {
      const onlyCib: Method[] = [{ id: 'cib', name: 'CIB ••0001', last4: '0001' }, { id: 'd', last4: null, is_default: true }]
      expect(await resolveExactPaymentMethod(svc(onlyCib), 'u', '001', HSBC)).toBeNull()
      expect(await resolveExactPaymentMethod(svc(onlyCib), 'u', '01', HSBC)).toBeNull()
    })
    it('an unknown message bank matches no 2-3 digit or partial tail', async () => {
      expect(await resolveExactPaymentMethod(svc(both), 'u', '001')).toBeNull()
      expect(await resolveExactPaymentMethod(svc(both), 'u', '001', { sender: 'Unknown Co' })).toBeNull()
      expect(await resolveExactPaymentMethod(svc([{ id: 'x', name: 'HSBC Egypt ••001', last4: '001' }]), 'u', '001')).toBeNull()
    })
    it('a 4+ digit exact tail needs no bank, with or without a different bank on the message', async () => {
      const one: Method[] = [{ id: 'hsbc', name: 'HSBC Egypt ••0001', last4: '0001' }]
      expect(await resolveExactPaymentMethod(svc(one), 'u', '0001')).toBe('hsbc')
      expect(await resolveExactPaymentMethod(svc(one), 'u', '0001', CIB)).toBe('hsbc')
    })
  })
})
