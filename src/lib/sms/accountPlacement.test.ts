import { describe, expect, it, vi } from 'vitest'
import type { ServiceClient } from '@/lib/supabase/service'
import { ensureProvisionalAccount, placeSmsAccount, provisionalName, provisionalSpec } from './accountPlacement'
import { resolvePaymentMethodByLast4 } from './createSmsExpense'

const cib = { id: 'pm-cib', last4: '7887', bankKey: 'cib' }

describe('placeSmsAccount (6a.1 guardrails)', () => {
  it('uses the registered account the digits name', () => {
    expect(placeSmsAccount([cib], { tail: '7887', bankKey: 'cib', currency: 'EGP' })).toEqual({ kind: 'existing', id: 'pm-cib' })
  })

  it('proposes a provisional account only with bank, digits and currency', () => {
    expect(placeSmsAccount([cib], { tail: '1234', bankKey: 'nbe', currency: 'EGP' })).toEqual({ kind: 'provisional', bankKey: 'nbe', tail: '1234', currency: 'EGP' })
  })

  it.each([
    ['no bank', { tail: '1234', bankKey: null, currency: 'EGP' }],
    ['no digits', { tail: null, bankKey: 'nbe', currency: 'EGP' }],
    ['two digits', { tail: '12', bankKey: 'nbe', currency: 'EGP' }],
    ['no currency', { tail: '1234', bankKey: 'nbe', currency: null }],
    ['unsupported currency', { tail: '1234', bankKey: 'nbe', currency: 'ZZZ' }],
    ['unknown brand key', { tail: '1234', bankKey: 'not-a-bank', currency: 'EGP' }],
  ])('stays unassigned with %s', (_name, sms) => {
    expect(placeSmsAccount([cib], sms)).toEqual({ kind: 'unassigned' })
  })

  it('never creates an account for a pass-through rail', () => {
    expect(provisionalSpec({ tail: '1234', bankKey: 'applepay', currency: 'SAR' })).toBeNull()
  })

  it('creates nothing when two registered accounts fit', () => {
    const twins = [{ id: 'a', last4: '6212', bankKey: 'cib' }, { id: 'b', last4: '6212', bankKey: 'cib' }]
    expect(placeSmsAccount(twins, { tail: '6212', bankKey: 'cib', currency: 'EGP' })).toEqual({ kind: 'ambiguous' })
  })

  it('names the account by bank and digits, the dedupe identity', () => {
    expect(provisionalName({ bankKey: 'cib', tail: '1234', currency: 'EGP' })).toBe('CIB ••1234')
  })
})

function fakeService(insertResult: { data: { id: string } | null; error: { code: string; message: string } | null }, existingId: string | null = null) {
  const inserted: Record<string, unknown>[] = []
  const chain: Record<string, unknown> = {}
  for (const k of ['select', 'eq', 'ilike', 'is', 'limit']) chain[k] = () => chain
  chain.maybeSingle = () => Promise.resolve({ data: existingId ? { id: existingId } : null, error: null })
  const from = vi.fn(() => ({
    ...chain,
    insert: (row: Record<string, unknown>) => {
      inserted.push(row)
      return { select: () => ({ single: () => Promise.resolve(insertResult) }) }
    },
  }))
  return { service: { from } as unknown as ServiceClient, inserted }
}

describe('ensureProvisionalAccount', () => {
  const spec = { bankKey: 'cib', tail: '1234', currency: 'EGP' as const }

  it('creates a provisional, non-default account with no opening balance', async () => {
    const { service, inserted } = fakeService({ data: { id: 'new' }, error: null })
    expect(await ensureProvisionalAccount(service, 'u1', spec)).toBe('new')
    expect(inserted[0]).toMatchObject({ user_id: 'u1', name: 'CIB ••1234', last4: '1234', currency: 'EGP', provisional: true, is_default: false })
    expect(inserted[0]).not.toHaveProperty('opening_balance')
  })

  it('returns the account a concurrent message created first', async () => {
    const { service } = fakeService({ data: null, error: { code: '23505', message: 'duplicate' } }, 'first')
    expect(await ensureProvisionalAccount(service, 'u1', spec)).toBe('first')
  })

  it('leaves the row unassigned when the insert fails', async () => {
    const { service } = fakeService({ data: null, error: { code: 'XX000', message: 'boom' } })
    expect(await ensureProvisionalAccount(service, 'u1', spec)).toBeNull()
  })
})

describe('resolvePaymentMethodByLast4 with create (the server path)', () => {
  function svc(methods: { id: string; name: string; last4: string | null }[]) {
    const inserted: Record<string, unknown>[] = []
    const chain: Record<string, unknown> = {}
    for (const k of ['select', 'eq', 'ilike', 'is', 'limit']) chain[k] = () => chain
    chain.maybeSingle = () => Promise.resolve({ data: null, error: null })
    chain.then = (r: (v: unknown) => unknown) => r({ data: methods.map((m) => ({ ...m, last4_aliases: [] })), error: null })
    chain.insert = (row: Record<string, unknown>) => {
      inserted.push(row)
      return { select: () => ({ single: () => Promise.resolve({ data: { id: 'prov-1' }, error: null }) }) }
    }
    return { service: { from: () => chain } as unknown as ServiceClient, inserted }
  }
  const CIB = { sender: 'CIB', bankName: 'CIB' }

  it('creates a provisional account when the digits match nothing and bank, digits and currency are present', async () => {
    const { service, inserted } = svc([{ id: 'a', name: 'CIB ••7887', last4: '7887' }])
    expect(await resolvePaymentMethodByLast4(service, 'u', '1234', CIB, { currency: 'EGP' })).toBe('prov-1')
    expect(inserted).toHaveLength(1)
    expect(inserted[0]).toMatchObject({ name: 'CIB ••1234', provisional: true })
  })

  it('uses the registered account and creates nothing when the digits match', async () => {
    const { service, inserted } = svc([{ id: 'a', name: 'CIB ••7887', last4: '7887' }])
    expect(await resolvePaymentMethodByLast4(service, 'u', '7887', CIB, { currency: 'EGP' })).toBe('a')
    expect(inserted).toHaveLength(0)
  })

  it('creates nothing without a bank, and nothing for callers that did not ask', async () => {
    const a = svc([])
    expect(await resolvePaymentMethodByLast4(a.service, 'u', '1234', { sender: null, bankName: null }, { currency: 'EGP' })).toBeNull()
    expect(await resolvePaymentMethodByLast4(a.service, 'u', '1234', CIB)).toBeNull()
    expect(a.inserted).toHaveLength(0)
  })
})
