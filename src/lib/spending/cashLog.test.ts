import { beforeEach, describe, expect, it } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Expense } from '@/lib/store/types'
import { ATM_CATEGORY, CASH_LOG_NO, CASH_LOG_YES, answerCashLog, cashLogAnswer, cashWithdrawnThisCycle } from './cashLog'

const row = (over: Partial<Expense> = {}): Expense =>
  ({ id: 'a', date: '2026-10-05', description: 'ATM', category: ATM_CATEGORY, amount: 500, currency: 'EGP', amountInBaseCurrency: 500, isRecurring: false, ...over }) as Expense

describe('cashLogAnswer', () => {
  it('is null when neither key exists', () => {
    expect(cashLogAnswer(undefined)).toBeNull()
    expect(cashLogAnswer({})).toBeNull()
  })

  it('reads a single key', () => {
    expect(cashLogAnswer({ [CASH_LOG_YES]: '2026-10-01T00:00:00Z' })).toBe('yes')
    expect(cashLogAnswer({ [CASH_LOG_NO]: '2026-10-01T00:00:00Z' })).toBe('no')
  })

  it('lets the later answer win', () => {
    expect(cashLogAnswer({ [CASH_LOG_YES]: '2026-10-01T00:00:00Z', [CASH_LOG_NO]: '2026-10-02T00:00:00Z' })).toBe('no')
    expect(cashLogAnswer({ [CASH_LOG_YES]: '2026-10-03T00:00:00Z', [CASH_LOG_NO]: '2026-10-02T00:00:00Z' })).toBe('yes')
  })
})

describe('answerCashLog', () => {
  beforeEach(() => useFinanceStore.getState().updateSettings({ promptState: undefined }))

  it('writes nothing until answered, then flips with the latest answer', () => {
    expect(cashLogAnswer(useFinanceStore.getState().settings.promptState)).toBeNull()
    answerCashLog('no')
    expect(cashLogAnswer(useFinanceStore.getState().settings.promptState)).toBe('no')
    const before = useFinanceStore.getState().settings.promptState?.[CASH_LOG_NO]
    answerCashLog('yes')
    const state = useFinanceStore.getState().settings.promptState
    expect(state?.[CASH_LOG_NO]).toBe(before)
    expect(state?.[CASH_LOG_YES]).toBeTruthy()
  })
})

describe('cashWithdrawnThisCycle', () => {
  it('sums withdrawals in the month and ignores refunded rows, other categories and other months', () => {
    const rows = [
      row({ id: '1', amount: 500 }),
      row({ id: '2', amount: 250, amountInBaseCurrency: 250 }),
      row({ id: '3', refundKind: 'refunded' }),
      row({ id: '4', category: 'Food' }),
      row({ id: '5', date: '2026-09-05' }),
    ]
    expect(cashWithdrawnThisCycle(rows, '2026-10', 1, 'EGP', {})).toBe(750)
  })

  it('is zero with no withdrawals', () => {
    expect(cashWithdrawnThisCycle([row({ category: 'Food' })], '2026-10', 1, 'EGP', {})).toBe(0)
  })
})
