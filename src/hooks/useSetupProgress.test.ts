import { describe, expect, it } from 'vitest'
import { computeSetupSteps } from './useSetupProgress'

const none = { hasAccount: false, smsArmed: false, hasPayday: false, hasBudget: false, hasTransaction: false }

describe('computeSetupSteps', () => {
  it('starts at zero with five steps in order, accounts first', () => {
    const r = computeSetupSteps(none)
    expect(r.steps.map((s) => s.id)).toEqual(['accounts', 'sms', 'payday', 'budget', 'expense'])
    expect(r).toMatchObject({ doneCount: 0, pct: 0 })
  })
  it('counts each finished step', () => {
    expect(computeSetupSteps({ ...none, hasAccount: true }).pct).toBe(20)
    expect(computeSetupSteps({ ...none, smsArmed: true, hasBudget: true }).pct).toBe(40)
    expect(computeSetupSteps({ ...none, hasPayday: true, hasBudget: true, hasTransaction: true }).pct).toBe(60)
  })
  it('reaches 100 when everything is done', () => {
    const r = computeSetupSteps({ hasAccount: true, smsArmed: true, hasPayday: true, hasBudget: true, hasTransaction: true })
    expect(r).toMatchObject({ doneCount: 5, pct: 100 })
  })
})
