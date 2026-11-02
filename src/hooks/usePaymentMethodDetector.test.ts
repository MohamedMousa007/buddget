import { describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/lib/query/sharedFetch', () => ({ sharedFetch: async () => null }))

import type { PaymentMethod } from '@/lib/store/types'
import { detectAccounts, type Row } from './usePaymentMethodDetector'

const row = (last4: string, bank: string | null, sender: string | null = null, body: string | null = null): Row =>
  ({ account_last4: last4, bank_name: bank, sender, payment_instrument: null, raw_body: body })
const pm = (o: Partial<PaymentMethod>): PaymentMethod => ({ id: 'x', name: 'x', type: 'bank_account', currency: 'EGP', isDefault: false, ...o }) as PaymentMethod

describe('detectAccounts', () => {
  it('offers nothing for a number the user already has, however the bank prints it', () => {
    const rows = [row('001', 'HSBC Egypt'), row('0001', 'HSBC Egypt'), row('5950', 'HSBC Egypt')]
    const mine = [pm({ id: 'a', name: 'HSBC Egypt ••0001', last4: '0001', last4Aliases: ['5950'] })]
    expect(detectAccounts(rows, mine)).toEqual([])
  })
  it('merges one account printed in two lengths and keeps the longest', () => {
    const out = detectAccounts([row('001', 'HSBC Egypt'), row('0001', 'HSBC Egypt'), row('0001', 'HSBC Egypt')], [])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ last4: '0001', count: 3, key: 'pm:0001' })
  })
  it('keeps the same digits at two banks apart and gives each prompt its own key', () => {
    const out = detectAccounts([row('1234', 'HSBC Egypt'), row('1234', 'CIB')], [])
    expect(out).toHaveLength(2)
    expect(new Set(out.map((o) => o.key)).size).toBe(2)
  })
  it('reads a masked account number as a bank account', () => {
    const body = 'Purchase from 103-104***-001 EGP 925.00- Your available balance is EGP 598.99'
    expect(detectAccounts([row('001', 'HSBC Egypt', null, body)], [])[0].type).toBe('bank_account')
  })

  it('takes the currency from the balance a message states, with LE meaning EGP, and leaves it open otherwise', () => {
    const usd = detectAccounts([row('0110', 'HSBC', null, 'Transfer from 103-104***-110 USD 200.00- Your available balance is USD 2,172.73')], [])
    expect(usd[0].currency).toBe('USD')
    const le = detectAccounts([row('5555', 'Bank', null, 'Withdrawal ending 5555. Your available balance is LE 1,000.00')], [])
    expect(le[0].currency).toBe('EGP')
    expect(detectAccounts([row('7777', 'HSBC Egypt', null, 'Purchase ending 7777 USD 12.00 at SHOP')], [])[0].currency).toBeNull()
  })
})
