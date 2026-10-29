import { beforeEach, describe, expect, it } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { memoryFromRow, memoryToRow } from '@/lib/supabase/remote/mappers/buddgyMemoryMapper'
import { migrateLegacyNotes } from '@/lib/ai/memoryActions'
import { useSettingsStore } from '@/lib/store/useSettingsStore'

describe('buddgy memories', () => {
  beforeEach(() => {
    useFinanceStore.setState({ buddgyMemories: [] })
    useSettingsStore.setState({ buddgyNotes: [], buddgyLearning: true })
  })

  it('saves, dedupes ignoring case, caps at 40, and forgets', () => {
    const s = useFinanceStore.getState()
    const id = s.addBuddgyMemory('  Has no car ', 'budget')
    expect(id).toBeTruthy()
    expect(useFinanceStore.getState().addBuddgyMemory('has no car', 'chat')).toBeNull()
    for (let i = 0; i < 39; i++) useFinanceStore.getState().addBuddgyMemory(`fact ${i}`, 'chat')
    expect(useFinanceStore.getState().buddgyMemories).toHaveLength(40)
    expect(useFinanceStore.getState().addBuddgyMemory('one too many', 'chat')).toBeNull()
    useFinanceStore.getState().removeBuddgyMemory(id!)
    expect(useFinanceStore.getState().buddgyMemories).toHaveLength(39)
  })

  it('round-trips through the row mapper', () => {
    const id = useFinanceStore.getState().addBuddgyMemory('salary lands on the 25th', 'chat', 'fact')!
    const m = useFinanceStore.getState().buddgyMemories.find((x) => x.id === id)!
    expect(memoryFromRow({ ...memoryToRow(m, 'u1'), deleted_at: null } as Parameters<typeof memoryFromRow>[0])).toEqual(m)
  })

  it('moves device-only notes over once', () => {
    useSettingsStore.setState({ buddgyNotes: ['lives in Dubai'] })
    migrateLegacyNotes()
    expect(useFinanceStore.getState().buddgyMemories.map((m) => m.text)).toEqual(['lives in Dubai'])
    expect(useSettingsStore.getState().buddgyNotes).toEqual([])
  })

  it('round-trips the plan link and deleting the plan removes only its notes', () => {
    const f = useFinanceStore.getState()
    const planId = f.addBudgetPlan('Plan A', { status: 'ready' })
    const tied = f.addBuddgyMemory('keep rent under 900', 'budget', 'fact', planId)!
    f.addBuddgyMemory('has no car', 'chat')
    const m = useFinanceStore.getState().buddgyMemories.find((x) => x.id === tied)!
    expect(memoryFromRow({ ...memoryToRow(m, 'u1'), deleted_at: null } as Parameters<typeof memoryFromRow>[0])).toEqual(m)
    useFinanceStore.getState().deleteBudgetPlan(planId)
    expect(useFinanceStore.getState().buddgyMemories.map((x) => x.text)).toEqual(['has no car'])
  })
})
