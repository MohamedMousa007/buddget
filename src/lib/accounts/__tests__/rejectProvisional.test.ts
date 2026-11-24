import { beforeEach, describe, expect, it } from 'vitest'
import type { ServiceClient } from '@/lib/supabase/service'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { rejectProvisional } from '@/lib/accounts/provisional'
import { isOpenAccount, isSetUpAccount } from '@/lib/accounts/kinds'
import { resolvePaymentMethodByLast4 } from '@/lib/sms/createSmsExpense'

const s = () => useFinanceStore.getState()
const find = (id: string) => s().paymentMethods.find((m) => m.id === id)!

describe('Not mine on a provisional account (QA bug 9)', () => {
  let id: string
  beforeEach(() => {
    s().reset()
    id = s().addPaymentMethod({ name: 'CIB ••1234', type: 'bank_account', currency: 'EGP', isDefault: false, last4: '1234', provisional: true })
  })

  it('closes the account in the same step, so it never joins the Accounts list', () => {
    rejectProvisional(id)
    const m = find(id)
    expect(m.excluded).toBe(true)
    expect(m.provisional).toBe(false)
    expect(m.closedAt).toBeTruthy()
    expect(isOpenAccount(m)).toBe(false)
    expect(isSetUpAccount(m)).toBe(false)
  })

  it('Undo puts it back as an open provisional account', () => {
    const undo = rejectProvisional(id)
    undo()
    const m = find(id)
    expect(m.provisional).toBe(true)
    expect(m.excluded).toBe(false)
    expect(m.closedAt).toBeUndefined()
  })
})

describe('a later bank message with the same digits', () => {
  function svc(rows: Record<string, unknown>[]) {
    const inserted: Record<string, unknown>[] = []
    const chain: Record<string, unknown> = {}
    for (const k of ['select', 'eq', 'ilike', 'is', 'limit']) chain[k] = () => chain
    chain.maybeSingle = () => Promise.resolve({ data: null, error: null })
    chain.then = (r: (v: unknown) => unknown) => r({ data: rows, error: null })
    chain.insert = (row: Record<string, unknown>) => {
      inserted.push(row)
      return { select: () => ({ single: () => Promise.resolve({ data: { id: 'prov-new' }, error: null }) }) }
    }
    return { service: { from: () => chain } as unknown as ServiceClient, inserted }
  }

  it('lands on the rejected (closed, excluded) account and creates no new provisional one', async () => {
    const rejected = { id: 'rejected', name: 'CIB ••1234', last4: '1234', last4_aliases: [], provisional: false, excluded: true, closed_at: '2026-11-24T00:00:00Z' }
    const { service, inserted } = svc([rejected])
    expect(await resolvePaymentMethodByLast4(service, 'u', '1234', { sender: 'CIB', bankName: 'CIB' }, { currency: 'EGP' })).toBe('rejected')
    expect(inserted).toHaveLength(0)
  })
})
