import { beforeEach, describe, expect, it } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { writeOnboardingRecord } from './useOnboarding'

const record = () => useFinanceStore.getState().profile.financialProfile?.onboarding

beforeEach(() => useFinanceStore.getState().resetAllData())

describe('writeOnboardingRecord', () => {
  it('creates the record on first use and keeps what the profile already learned', () => {
    useFinanceStore.getState().updateProfile({ financialProfile: { priorities: ['safety'], cashHeavy: true } })
    writeOnboardingRecord({ step: 2 })
    expect(record()).toMatchObject({ v: 1, step: 2 })
    expect(useFinanceStore.getState().profile.financialProfile).toMatchObject({ priorities: ['safety'], cashHeavy: true })
  })
  it('merges later changes without losing earlier ones', () => {
    writeOnboardingRecord({ step: 1, goals: ['save'] })
    writeOnboardingRecord({ step: 3, incomeSourceId: 'inc-1' })
    expect(record()).toMatchObject({ step: 3, goals: ['save'], incomeSourceId: 'inc-1' })
  })
  it('finishing and leaving are separate marks, and resuming clears the leave', () => {
    writeOnboardingRecord({ skippedAt: '2026-11-01T10:00:00Z' })
    expect(record()?.skippedAt).toBeDefined()
    writeOnboardingRecord({ skippedAt: undefined })
    expect(record()?.skippedAt).toBeUndefined()
    writeOnboardingRecord({ doneAt: '2026-11-01T11:00:00Z' })
    expect(record()?.doneAt).toBeDefined()
  })
})
