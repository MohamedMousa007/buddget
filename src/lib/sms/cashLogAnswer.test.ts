import { describe, expect, it } from 'vitest'
import { CASH_LOG_YES as CLIENT_YES, CASH_LOG_NO as CLIENT_NO } from '@/lib/spending/cashLog'
import { CASH_LOG_NO, CASH_LOG_YES, winningCashLogAnswer } from './cashLogAnswer'

describe('winningCashLogAnswer (cash switch, server half)', () => {
  const T1 = '2026-11-01T10:00:00.000Z'
  const T2 = '2026-11-02T10:00:00.000Z'
  it('yes only, no only, neither', () => {
    expect(winningCashLogAnswer({ [CASH_LOG_YES]: T1 })).toBe('yes')
    expect(winningCashLogAnswer({ [CASH_LOG_NO]: T1 })).toBe('no')
    expect(winningCashLogAnswer({})).toBeNull()
    expect(winningCashLogAnswer(undefined)).toBeNull()
  })
  it('both present: the later time wins', () => {
    expect(winningCashLogAnswer({ [CASH_LOG_YES]: T1, [CASH_LOG_NO]: T2 })).toBe('no')
    expect(winningCashLogAnswer({ [CASH_LOG_YES]: T2, [CASH_LOG_NO]: T1 })).toBe('yes')
  })
  it('garbage values count as unanswered', () => {
    expect(winningCashLogAnswer({ [CASH_LOG_NO]: 'not a date' })).toBeNull()
    expect(winningCashLogAnswer({ [CASH_LOG_NO]: 5, [CASH_LOG_YES]: null })).toBeNull()
    expect(winningCashLogAnswer('cashlog:no')).toBeNull()
    expect(winningCashLogAnswer([T1])).toBeNull()
    expect(winningCashLogAnswer({ [CASH_LOG_NO]: 'garbage', [CASH_LOG_YES]: T1 })).toBe('yes')
  })
  it('the key strings equal the client contract', () => {
    expect(CASH_LOG_YES).toBe(CLIENT_YES)
    expect(CASH_LOG_NO).toBe(CLIENT_NO)
  })
})
