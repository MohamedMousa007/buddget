import { describe, expect, it } from 'vitest'
import { computeSetupSteps } from './useSetupProgress'

const none = { smsArmed: false, hasPayday: false, hasBudget: false, hasTransaction: false }

describe('computeSetupSteps', () => {
  it('starts at zero with four steps in order', () => {
    const r = computeSetupSteps(none)
    expect(r.steps.map((s) => s.id)).toEqual(['sms', 'payday', 'budget', 'expense'])
    expect(r).toMatchObject({ doneCount: 0, pct: 0 })
  })
  it('counts each finished step', () => {
    expect(computeSetupSteps({ ...none, smsArmed: true }).pct).toBe(25)
    expect(computeSetupSteps({ ...none, smsArmed: true, hasBudget: true }).pct).toBe(50)
    expect(computeSetupSteps({ ...none, hasPayday: true, hasBudget: true, hasTransaction: true }).pct).toBe(75)
  })
  it('reaches 100 when everything is done', () => {
    const r = computeSetupSteps({ smsArmed: true, hasPayday: true, hasBudget: true, hasTransaction: true })
    expect(r).toMatchObject({ doneCount: 4, pct: 100 })
  })
})
