import { describe, expect, it } from 'vitest'
import { onboardingState, type EligibilityInput } from './eligibility'

const empty: EligibilityInput = {
  flagOn: true, profileLoaded: true, record: undefined, openAccounts: 0, incomeSources: 0, incomeEvents: 0, expenses: 0, plans: 0, others: 0,
}
const record = { v: 1 as const, step: 2, startedAt: '2026-10-23T10:00:00Z' }

describe('onboardingState', () => {
  it('offers the journey to an account that holds nothing', () => {
    expect(onboardingState(empty)).toBe('new')
  })
  it('never offers it to an account that already has data, so a returning user lands in the app', () => {
    for (const k of ['openAccounts', 'incomeSources', 'incomeEvents', 'expenses', 'plans', 'others'] as const) {
      expect(onboardingState({ ...empty, [k]: 1 })).toBe('hidden')
    }
  })
  it('waits for the flag and for the profile to load, so an empty store is not mistaken for a new user', () => {
    expect(onboardingState({ ...empty, flagOn: null })).toBe('hidden')
    expect(onboardingState({ ...empty, flagOn: false })).toBe('hidden')
    expect(onboardingState({ ...empty, profileLoaded: false })).toBe('hidden')
  })
  it('resumes a started journey even though the earlier steps created data', () => {
    expect(onboardingState({ ...empty, record, openAccounts: 2, incomeSources: 1 })).toBe('resume')
  })
  it('is hidden once finished or skipped, on any device', () => {
    expect(onboardingState({ ...empty, record: { ...record, doneAt: '2026-10-23T10:05:00Z' } })).toBe('hidden')
    expect(onboardingState({ ...empty, record: { ...record, skippedAt: '2026-10-23T10:05:00Z' } })).toBe('hidden')
  })
  it('a kill-switched flag hides even a started journey', () => {
    expect(onboardingState({ ...empty, record, flagOn: false })).toBe('hidden')
  })
})
