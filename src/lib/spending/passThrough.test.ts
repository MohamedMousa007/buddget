import { beforeEach, describe, expect, it } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Expense, IncomeEvent } from '@/lib/store/types'
import { actualIncomeForMonth } from '@/lib/utils/calculations'
import {
  PASS_THROUGH_NO, PASS_THROUGH_YES, answerPassThrough, applyPassThrough, passThroughAnswer, pendingPassThroughPairs,
} from './passThrough'

const AT = '2026-10-05T10:00:00.000Z'
const LATER = '2026-10-05T10:00:20.000Z'
const out = (over: Partial<Expense> = {}): Expense =>
  ({ id: 'out', date: '2026-10-05', occurredAt: LATER, description: 'Transfer', category: 'Instapay', amount: 1500, currency: 'EGP', paymentMethodId: 'pm', isRecurring: false, smsLogId: 'log-out', ...over }) as Expense
const inn = (over: Partial<IncomeEvent> = {}): IncomeEvent =>
  ({ id: 'in', name: 'Transfer', amount: 1500, currency: 'EGP', receivedDate: '2026-10-05', occurredAt: AT, status: 'confirmed', paymentMethodId: 'pm', smsLogId: 'log-in', createdAt: AT, updatedAt: AT, ...over }) as IncomeEvent

describe('pendingPassThroughPairs', () => {
  it('pairs a bank-message credit with a transfer out of the same amount on the same account', () => {
    expect(pendingPassThroughPairs([out()], [inn()])).toEqual([{ expenseId: 'out', incomeId: 'in' }])
  })

  it('treats two legs the server could not place as the same unknown account', () => {
    expect(pendingPassThroughPairs([out({ paymentMethodId: '' })], [inn({ paymentMethodId: undefined })])).toHaveLength(1)
  })

  it.each([
    ['a manual expense', { smsLogId: undefined }, {}],
    ['a purchase', { category: 'Food' }, {}],
    ['an expense with no exact time', { occurredAt: undefined }, {}],
    ['an expense already left out', { spendExclusion: 'manual' as const }, {}],
    ['a refunded expense', { refundKind: 'refunded' as const }, {}],
    ['a salary credit', {}, { templateId: 't1' }],
    ['a credit already marked', {}, { exclusion: 'pass_through' as const }],
    ['a different account', {}, { paymentMethodId: 'other' }],
    ['a different amount', {}, { amount: 1499 }],
  ])('never pairs %s', (_name, e, i) => {
    expect(pendingPassThroughPairs([out(e)], [inn(i)])).toEqual([])
  })
})

describe('the one remembered answer', () => {
  beforeEach(() => {
    useFinanceStore.setState({ expenses: [out()], incomeEvents: [inn()] })
    useFinanceStore.getState().updateSettings({ promptState: {} })
  })
  const state = () => useFinanceStore.getState()

  it('is unanswered until the user says so', () => {
    expect(passThroughAnswer(undefined)).toBeNull()
    expect(passThroughAnswer({ [PASS_THROUGH_YES]: 'x' })).toBe('yes')
    expect(passThroughAnswer({ [PASS_THROUGH_NO]: 'x' })).toBe('no')
  })

  it('"no" is remembered and changes no row', () => {
    expect(answerPassThrough('no', pendingPassThroughPairs(state().expenses, state().incomeEvents))).toBeNull()
    expect(passThroughAnswer(state().settings.promptState)).toBe('no')
    expect(state().expenses[0].spendExclusion).toBeUndefined()
    expect(state().incomeEvents[0].exclusion).toBeUndefined()
  })

  it('"yes" leaves both legs out, keeps the rows, and each side can be undone', () => {
    const undo = answerPassThrough('yes', pendingPassThroughPairs(state().expenses, state().incomeEvents))
    expect(passThroughAnswer(state().settings.promptState)).toBe('yes')
    expect(state().expenses[0]).toMatchObject({ spendExclusion: 'for_someone' })
    expect(state().expenses[0].owedSettledAt).toBeTruthy()
    expect(state().incomeEvents[0].exclusion).toBe('pass_through')
    // Nothing is left to ask about.
    expect(pendingPassThroughPairs(state().expenses, state().incomeEvents)).toEqual([])
    undo?.()
    expect(state().expenses[0].spendExclusion).toBeUndefined()
    expect(state().incomeEvents[0].exclusion ?? null).toBeNull()
  })

  it('a confirmed pass-through credit leaves the income total and comes back when counted again', () => {
    const month = '2026-10'
    const total = () => actualIncomeForMonth([], state().incomeEvents, 'EGP', {}, month, 1, true)
    expect(total()).toBe(1500)
    applyPassThrough([{ expenseId: 'out', incomeId: 'in' }])
    expect(total()).toBe(0)
    state().updateIncomeEvent('in', { exclusion: null })
    expect(total()).toBe(1500)
  })
})
