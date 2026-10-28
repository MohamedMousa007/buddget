import { describe, expect, it, vi } from 'vitest'
import type { ServiceClient } from '@/lib/supabase/service'

const h = vi.hoisted(() => ({ plain: vi.fn(async () => ({ expenseId: 'plain-1', incomeId: null, debtPaymentId: null, error: null })) }))
vi.mock('./createSmsExpense', async (orig) => ({
  ...(await orig<typeof import('./createSmsExpense')>()),
  createSmsDebtPayment: async () => ({ expenseId: null, incomeId: null, debtPaymentId: null, error: null, needsConfirm: true }),
  createSmsExpense: h.plain,
}))

import { createSmsTransaction } from './dispatch'

const row = { userId: 'u1', amount: 500, currency: 'USD', day: '2026-10-01', kind: 'cc_payoff', rawBody: 'x', source: 'sms' } as never

describe('debt payment that cannot be tied to one debt', () => {
  it('waits for the user instead of booking a plain expense', async () => {
    h.plain.mockClear()
    const tx = await createSmsTransaction({} as ServiceClient, row, { exchangeRates: {} })
    expect(tx).toMatchObject({ outcome: 'awaiting_confirmation', confirmReason: 'cc_ambiguous', expenseId: null })
    expect(h.plain).not.toHaveBeenCalled()
  })
  it('books the unlinked CC Payoff expense once the user has confirmed', async () => {
    const tx = await createSmsTransaction({} as ServiceClient, row, { exchangeRates: {}, userConfirmed: true })
    expect(tx).toMatchObject({ outcome: 'expense', expenseId: 'plain-1', category: 'CC Payoff' })
  })
})
