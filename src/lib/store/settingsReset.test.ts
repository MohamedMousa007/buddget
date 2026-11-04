import { describe, expect, it } from 'vitest'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { answer, createFlow } from '@/lib/budget/flow/flow'

describe('useSettingsStore.reset', () => {
  it('drops the budget Studio draft, closed cycles and Buddgy notes so the next account starts clean', () => {
    const s = useSettingsStore.getState()
    s.saveBudgetStudioDraft({ v: 3, intent: null, state: answer(createFlow('mixed'), 'income', 9000), savedAt: 1 })
    s.closeBudgetCycle('2026-09')
    useSettingsStore.setState({ buddgyNotes: ['has no car'] })
    useSettingsStore.getState().reset()
    const after = useSettingsStore.getState()
    expect(after.budgetStudioDraft).toBeNull()
    expect(after.budgetClosedCycles).toEqual([])
    expect(after.buddgyNotes).toEqual([])
  })
})
