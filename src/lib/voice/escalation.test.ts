import { describe, it, expect } from 'vitest'
import { needsEscalation, ADD_ACTIONS } from '@/lib/voice/escalation'
import type { AIResponse, AIActionItem } from '@/lib/ai/gemini'

function resp(actions: AIActionItem[], confidence = 1): AIResponse {
  return { actions, confidence, clarificationNeeded: null, message: '' }
}
const item = (action: string, data: Record<string, unknown> = {}): AIActionItem =>
  ({ action: action as AIActionItem['action'], data })

describe('needsEscalation', () => {
  it('keeps tier-1 when a single add action is confident', () => {
    expect(needsEscalation(resp([item('add_expense', { amount: 50 })]))).toBe(false)
  })

  it('keeps tier-1 for multiple add actions', () => {
    expect(
      needsEscalation(resp([item('add_debt_payment'), item('add_expense'), item('add_expense')])),
    ).toBe(false)
  })

  it('keeps tier-1 for every supported add-type', () => {
    for (const a of ADD_ACTIONS) {
      expect(needsEscalation(resp([item(a)]))).toBe(false)
    }
  })

  it('escalates when no add action was produced', () => {
    expect(needsEscalation(resp([]))).toBe(true)
    expect(needsEscalation(resp([item('update_expense')]))).toBe(true)
    expect(needsEscalation(resp([item('clear_debt')]))).toBe(true)
  })

  it('escalates on an explicit escalate / query / unclear action', () => {
    expect(needsEscalation(resp([item('escalate')]))).toBe(true)
    expect(needsEscalation(resp([item('query')]))).toBe(true)
    expect(needsEscalation(resp([item('unclear')]))).toBe(true)
  })

  it('escalates when an add is mixed with a query (let the brain handle it)', () => {
    expect(needsEscalation(resp([item('add_expense', { amount: 50 }), item('query')]))).toBe(true)
  })

  it('escalates on low confidence even with a valid add', () => {
    expect(needsEscalation(resp([item('add_expense', { amount: 50 })], 0.4))).toBe(true)
    expect(needsEscalation(resp([item('add_expense', { amount: 50 })], 0.5))).toBe(false)
  })
})
