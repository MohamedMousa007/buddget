import { describe, expect, it } from 'vitest'
import { computeSetupSteps } from './useSetupProgress'

const none = { smsAvailable: true, hasAccount: false, smsArmed: false, hasPayday: false, hasBudget: false, hasTransaction: false }
const all = { smsAvailable: true, hasAccount: true, smsArmed: true, hasPayday: true, hasBudget: true, hasTransaction: true }

describe('computeSetupSteps', () => {
  it('starts at zero with five steps in order, accounts first, where SMS capture can run', () => {
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
    expect(computeSetupSteps(all)).toMatchObject({ doneCount: 5, pct: 100 })
  })
  it('leaves the SMS step out where capture cannot run, and counts over four', () => {
    const r = computeSetupSteps({ ...none, smsAvailable: false })
    expect(r.steps.map((s) => s.id)).toEqual(['accounts', 'payday', 'budget', 'expense'])
    expect(r).toMatchObject({ doneCount: 0, pct: 0 })
    expect(computeSetupSteps({ ...none, smsAvailable: false, hasAccount: true, hasPayday: true, hasBudget: true })).toMatchObject({ doneCount: 3, pct: 75 })
  })
  it('ignores a synced SMS intent where the step does not apply, and reaches 100 without it', () => {
    expect(computeSetupSteps({ ...none, smsAvailable: false, smsArmed: true })).toMatchObject({ doneCount: 0, pct: 0 })
    expect(computeSetupSteps({ ...all, smsAvailable: false, smsArmed: false })).toMatchObject({ doneCount: 4, pct: 100 })
  })
})
