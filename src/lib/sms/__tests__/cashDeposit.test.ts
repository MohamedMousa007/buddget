import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { cashDepositVerdict, isCashDeposit } from '../cashDeposit'
import type { SmsRowData } from '../createSmsExpense'

const created = vi.hoisted(() => [] as Array<Record<string, unknown>>)
vi.mock('../createSmsExpense', async (orig) => ({
  ...(await orig<typeof import('../createSmsExpense')>()),
  createSmsExpense: vi.fn(async (_s: unknown, row: Record<string, unknown>) => {
    created.push(row)
    return { expenseId: 'e1', incomeId: 'i1', error: null }
  }),
}))

const salary = vi.hoisted(() => vi.fn(async () => ({ outcome: 'matched', sourceId: 'src-1', occurrenceDate: '2026-11-09' })))
vi.mock('../matchSalary', () => ({ matchSalary: salary }))

import { createSmsTransaction } from '../dispatch'

describe('isCashDeposit (S2c step 8b, N18)', () => {
  it.each([
    'Deposit: ATM 4411 Cairo, EGP 900.00, to: account 4455',
    'Cash deposit machine: EGP 1,200.00 deposited to your account ending 4455',
    'تم إيداع 900 جنيه عبر صراف آلي في حسابك',
    'عملية إيداع نقدي بمبلغ 500 جنيه من الصراف',
  ])('true: %s', (t) => expect(isCashDeposit(t)).toBe(true))

  it.each([
    'Direct deposit of salary EGP 12,000.00 received from Sample Corp',
    'Deposit fee EGP 5.00 charged for ATM service',
    'ATM withdrawal EGP 500.00 on card 4455',
    'Your fixed deposit matures on 12/12',
    'Deposit of EGP 900.00 received from Sample Sender via IPN',
    'رسوم إيداع صراف 5 جنيه',
    'تم سحب 500 جنيه من الصراف',
    'Cash deposit of EGP 900.00 to your account ending 4455',
  ])('false: %s', (t) => expect(isCashDeposit(t)).toBe(false))
})

describe('cashDepositVerdict', () => {
  const text = 'Deposit: ATM 4411 Cairo, EGP 900.00, to: account 4455'
  it('turns any debit or transfer reading into income and flags it', () => {
    for (const kind of ['atm_withdrawal', 'instant_transfer_in', 'instant_transfer_out', 'own_transfer', 'purchase', null] as const) {
      expect(cashDepositVerdict(kind, text)).toEqual({ kind: 'income', flag: true })
    }
  })
  it('leaves a decline and a message whose own ledger sign says money left', () => {
    expect(cashDepositVerdict('declined', text)).toEqual({ kind: 'declined', flag: false })
    expect(cashDepositVerdict('atm_withdrawal', `${text} EGP 900.00-`)).toEqual({ kind: 'atm_withdrawal', flag: false })
  })
  it('leaves everything else alone', () => {
    expect(cashDepositVerdict('purchase', 'Purchase EGP 20.00 at Shop')).toEqual({ kind: 'purchase', flag: false })
  })
})

describe('dispatch applies it whatever the tier said', () => {
  beforeEach(() => { created.length = 0 })
  const chain = (): Record<string, unknown> => {
    const self: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'is', 'in', 'not', 'gte', 'lte', 'order', 'limit', 'update', 'insert', 'neq']) self[m] = () => self
    self.maybeSingle = async () => ({ data: null, error: null })
    self.single = async () => ({ data: null, error: null })
    self.then = (res: (v: unknown) => unknown) => res({ data: [], error: null })
    return self
  }
  const service = { from: () => chain(), rpc: async () => ({ data: [], error: null }) } as unknown as SupabaseClient
  const row = (over: Partial<SmsRowData>): SmsRowData => ({
    userId: 'u1', amount: 900, currency: 'EGP', day: '2026-11-09', kind: 'atm_withdrawal', cleanTitle: 'ATM Withdrawal', merchantNormalized: null, merchant: null,
    bankName: null, categoryHint: null, source: 'sms', rawBody: 'Deposit: ATM 4411 Cairo, EGP 900.00, to: account 4455', ...over,
  })

  it('books a deposit the tier read as a withdrawal as a transfer from cash with the cash_deposit flag', async () => {
    await createSmsTransaction(service, row({}), { exchangeRates: {} })
    expect(created[0]).toMatchObject({ kind: 'own_transfer', destinationLeg: true, fromCash: true, cleanTitle: 'Cash deposit', smsFlags: ['cash_deposit'] })
  })
  it('keeps the flag once and an existing flag', async () => {
    await createSmsTransaction(service, row({ kind: 'income', smsFlags: ['date_unsure'] }), { exchangeRates: {} })
    expect(created[0]!.smsFlags).toEqual(['date_unsure', 'cash_deposit'])
  })

  it('never goes through salary matching, even when the amount equals an expected salary', async () => {
    salary.mockClear()
    const tx = await createSmsTransaction(service, row({}), { exchangeRates: {} })
    expect(salary).not.toHaveBeenCalled()
    expect(tx).toMatchObject({ outcome: 'transfer_single', kind: 'income', category: 'Transfer', expenseId: 'e1', incomeId: null })
    expect(tx.confirmReason).toBeNull()
    expect(created[0]).toMatchObject({ kind: 'own_transfer', destinationLeg: true, fromCash: true, cleanTitle: 'Cash deposit', smsFlags: ['cash_deposit'] })
    expect(created[0]!.templateId).toBeUndefined()
  })
})
