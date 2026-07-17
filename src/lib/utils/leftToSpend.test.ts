import { describe, expect, it } from 'vitest'
import type { IncomeEvent, SavingsTransaction } from '@/lib/store/types'
import { calculateLeftToSpendCashFlow } from './calculations'

/**
 * "Left to spend" = income − non-savings spend − money moved INTO savings this month.
 *
 * A savings WITHDRAWAL must not add to it twice. The withdraw action posts a confirmed
 * IncomeEvent (the money returning), which `actualIncomeForMonth` already counts. The old
 * code ALSO subtracted the net ledger (deposits − withdrawals), so a withdrawal added once
 * via income and again via −(−withdrawal): +600 left-to-spend for a 300 withdrawal.
 */

const MONTH = '2026-07'
const RATES = { USD_EGP: 50 }

const base = {
  monthStr: MONTH,
  monthStartDay: 1,
  expenses: [],
  incomeSources: [],
  baseCurrency: 'EGP' as const,
  exchangeRates: RATES,
  incomeBlocked: false,
}

const event = (over: Partial<IncomeEvent>): IncomeEvent =>
  ({
    id: `ev_${Math.random()}`, name: 'x', amount: 0, currency: 'EGP',
    receivedDate: '2026-07-10', status: 'confirmed', sourceType: 'other',
    ...over,
  }) as IncomeEvent

const tx = (over: Partial<SavingsTransaction>): SavingsTransaction =>
  ({
    id: `tx_${Math.random()}`, accountId: 'sav_1', type: 'deposit', amount: 0,
    currency: 'EGP', date: '2026-07-10', ...over,
  }) as SavingsTransaction

const leftToSpend = (over: Partial<Parameters<typeof calculateLeftToSpendCashFlow>[0]>) =>
  calculateLeftToSpendCashFlow({ ...base, incomeEvents: [], savingsTransactions: [], ...over })

describe('calculateLeftToSpendCashFlow — savings', () => {
  it('salary 10k, nothing else', () => {
    expect(leftToSpend({ incomeEvents: [event({ amount: 10_000, sourceType: 'salary' })] })).toBe(10_000)
  })

  it('depositing 300 to savings reduces left-to-spend by 300', () => {
    expect(
      leftToSpend({
        incomeEvents: [event({ amount: 10_000, sourceType: 'salary' })],
        savingsTransactions: [tx({ type: 'deposit', amount: 300 })],
      }),
    ).toBe(9_700)
  })

  it('REGRESSION: a 300 withdrawal adds back 300, not 600', () => {
    // The withdraw action posts this IncomeEvent; the ledger row is the same movement.
    const withdrawal = leftToSpend({
      incomeEvents: [
        event({ amount: 10_000, sourceType: 'salary' }),
        event({ amount: 300, name: 'Withdrawal from Vault', sourceType: 'other' }),
      ],
      savingsTransactions: [tx({ type: 'withdrawal', amount: 300 })],
    })
    // Old basis: 10_000 + 300 (income) − (−300) (net ledger) = 10_600. Correct is 10_300.
    expect(withdrawal).toBe(10_300)
  })

  it('an opening balance does not reduce left-to-spend — no cash moved', () => {
    // Declaring a pre-existing account must not look like spending this month's income.
    expect(
      leftToSpend({
        incomeEvents: [event({ amount: 10_000, sourceType: 'salary' })],
        savingsTransactions: [tx({ type: 'deposit', amount: 50_000, isCashFlow: false })],
      }),
    ).toBe(10_000)
  })

  it('a balance correction does not reduce left-to-spend', () => {
    expect(
      leftToSpend({
        incomeEvents: [event({ amount: 10_000, sourceType: 'salary' })],
        savingsTransactions: [tx({ type: 'deposit', amount: 1_000, isCashFlow: false })],
      }),
    ).toBe(10_000)
  })

  it('a legacy Savings-category expense still reduces left-to-spend', () => {
    expect(
      leftToSpend({
        incomeEvents: [event({ amount: 10_000, sourceType: 'salary' })],
        expenses: [
          { id: 'e1', date: '2026-07-05', description: 'to vault', category: 'Savings',
            amount: 500, currency: 'EGP', amountInBaseCurrency: 500, paymentMethodId: 'pm',
            isRecurring: false, createdAt: '', updatedAt: '' } as never,
        ],
      }),
    ).toBe(9_500)
  })
})
