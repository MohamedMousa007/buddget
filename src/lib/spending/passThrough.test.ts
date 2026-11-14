import { beforeEach, describe, expect, it } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Expense, IncomeEvent } from '@/lib/store/types'
import { actualIncomeForMonth } from '@/lib/utils/calculations'
import {
  PASS_THROUGH_COUNTED, PASS_THROUGH_NO, PASS_THROUGH_YES, answerPassThrough, applyPassThrough, countPassThroughCredit, excludedPassThroughPairs,
  labelledPassThroughPairs, passThroughAnswer, pendingPassThroughPairs, rememberedYesPairs,
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

const YES = { [PASS_THROUGH_YES]: 'x' }

describe('I3/I7: a remembered yes applies only to pairs the legs prove', () => {
  it('applies a pair on the same known account', () => {
    expect(rememberedYesPairs([out()], [inn()], YES)).toEqual([{ expenseId: 'out', incomeId: 'in' }])
  })

  it('labels, and does not apply, a pair with both legs unassigned', () => {
    const e = [out({ paymentMethodId: '' })]
    const i = [inn({ paymentMethodId: undefined })]
    expect(rememberedYesPairs(e, i, YES)).toEqual([])
    expect(labelledPassThroughPairs(e, i, YES)).toHaveLength(1)
  })

  it('never pairs, so never applies, legs on two different known accounts', () => {
    expect(rememberedYesPairs([out({ paymentMethodId: 'a' })], [inn({ paymentMethodId: 'b' })], YES)).toEqual([])
    expect(labelledPassThroughPairs([out({ paymentMethodId: 'a' })], [inn({ paymentMethodId: 'b' })], YES)).toEqual([])
  })

  it('applies nothing before an answer or after "no", and labels per the answer', () => {
    expect(rememberedYesPairs([out()], [inn()], {})).toEqual([])
    expect(rememberedYesPairs([out()], [inn()], { [PASS_THROUGH_NO]: 'x' })).toEqual([])
    expect(labelledPassThroughPairs([out()], [inn()], {})).toHaveLength(1)
    expect(labelledPassThroughPairs([out()], [inn()], { [PASS_THROUGH_NO]: 'x' })).toEqual([])
    expect(labelledPassThroughPairs([out()], [inn()], YES)).toEqual([])
  })
})

describe('P1-1: undo holds when the remembered yes runs again', () => {
  beforeEach(() => {
    useFinanceStore.setState({ expenses: [out()], incomeEvents: [inn()] })
    useFinanceStore.getState().updateSettings({ promptState: {} })
  })
  const state = () => useFinanceStore.getState()
  const rerun = () => {
    const pairs = rememberedYesPairs(state().expenses, state().incomeEvents, state().settings.promptState)
    if (pairs.length > 0) applyPassThrough(pairs)
    return pairs
  }

  it('keeps both legs counted after undo, and the effect finds nothing to apply', () => {
    const undo = answerPassThrough('yes', pendingPassThroughPairs(state().expenses, state().incomeEvents))
    expect(rerun()).toEqual([])
    undo?.()
    expect(rerun()).toEqual([])
    expect(state().expenses[0].spendExclusion).toBeUndefined()
    expect(state().incomeEvents[0].exclusion ?? null).toBeNull()
    expect(state().expenses[0].smsFlagsAck).toEqual([PASS_THROUGH_COUNTED])
    expect(state().incomeEvents[0].smsFlagsAck).toEqual([PASS_THROUGH_COUNTED])
  })

  it('a later pair on the same known account is applied once, then no longer pending', () => {
    useFinanceStore.setState({ expenses: [out()], incomeEvents: [inn()] })
    useFinanceStore.getState().updateSettings({ promptState: YES })
    expect(rerun()).toHaveLength(1)
    expect(rerun()).toEqual([])
  })

  it('keeps existing acknowledgements and adds the marker once', () => {
    useFinanceStore.setState({ expenses: [out({ smsFlagsAck: ['date_unsure'] })], incomeEvents: [inn()] })
    const undo = applyPassThrough([{ expenseId: 'out', incomeId: 'in' }])
    undo()
    undo()
    expect(state().expenses[0].smsFlagsAck).toEqual(['date_unsure', PASS_THROUGH_COUNTED])
  })

  it('the income sheet undo counts both legs of a left-out pair', () => {
    applyPassThrough([{ expenseId: 'out', incomeId: 'in' }])
    countPassThroughCredit('in')
    expect(state().expenses[0].spendExclusion).toBeUndefined()
    expect(state().expenses[0].smsFlagsAck).toContain(PASS_THROUGH_COUNTED)
    expect(state().incomeEvents[0].smsFlagsAck).toContain(PASS_THROUGH_COUNTED)
  })
})

describe('a row carrying pass_through_counted', () => {
  it('is never paired or labelled again', () => {
    const counted = [PASS_THROUGH_COUNTED]
    expect(pendingPassThroughPairs([out({ smsFlagsAck: counted })], [inn()])).toEqual([])
    expect(pendingPassThroughPairs([out()], [inn({ smsFlagsAck: counted })])).toEqual([])
    expect(labelledPassThroughPairs([out({ smsFlagsAck: counted })], [inn()], {})).toEqual([])
  })
})

describe('the review list', () => {
  const excludedOut = (over: Partial<Expense> = {}) => out({ spendExclusion: 'for_someone', owedSettledAt: AT, ...over })
  const excludedIn = (over: Partial<IncomeEvent> = {}) => inn({ exclusion: 'pass_through', ...over })

  it('lists each excluded pair', () => {
    const pairs = excludedPassThroughPairs([excludedOut()], [excludedIn()])
    expect(pairs).toHaveLength(1)
    expect(pairs[0].expense?.id).toBe('out')
    expect(pairs[0].income.id).toBe('in')
  })

  it('lists a credit alone when its expense leg is gone, and it can be counted', () => {
    useFinanceStore.setState({ expenses: [], incomeEvents: [excludedIn()] })
    const pairs = excludedPassThroughPairs([], useFinanceStore.getState().incomeEvents)
    expect(pairs).toHaveLength(1)
    expect(pairs[0]?.expense).toBeUndefined()
    countPassThroughCredit('in')
    const row = useFinanceStore.getState().incomeEvents[0]
    expect(row.exclusion ?? null).toBeNull()
    expect(row.smsFlagsAck).toContain(PASS_THROUGH_COUNTED)
    expect(excludedPassThroughPairs([], useFinanceStore.getState().incomeEvents)).toEqual([])
  })

  it('is empty for a user with none, or once the pair is counted', () => {
    expect(excludedPassThroughPairs([out()], [inn()])).toEqual([])
    expect(excludedPassThroughPairs([excludedOut({ smsFlagsAck: [PASS_THROUGH_COUNTED] })], [excludedIn({ smsFlagsAck: [PASS_THROUGH_COUNTED] })])).toEqual([])
  })
})
