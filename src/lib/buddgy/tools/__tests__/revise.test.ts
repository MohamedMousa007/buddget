import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/navigation/navigate', () => ({ navigate: vi.fn() }))
vi.mock('@/lib/apiBase', () => ({ apiFetchAuth: vi.fn() }))
import { TOOLS } from '@/lib/buddgy/tools/exec'
import { resetAutoSlots } from '@/lib/buddgy/tools/autoApplyGuard'
import { resetSameTurnMemory } from '@/lib/buddgy/tools/exec/expenses'
import { reviseProposalArgs } from '@/lib/buddgy/tools/revise'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

const ctx = { now: new Date('2026-10-19T12:00:00'), locale: 'en' as const }

beforeEach(() => {
  resetAutoSlots()
  resetSameTurnMemory()
  useFinanceStore.setState({ expenses: [], incomeSources: [], incomeEvents: [], budgetPlans: [], activeBudgetPlanId: null, exchangeRates: {} })
})

describe('BAI-4 editing a proposed card', () => {
  it('does not flag the edited card as a duplicate of itself', () => {
    const write = TOOLS.get('add_expense')!.write!
    const first = write.propose({ description: 'Tea', amount: 20, category: 'Food' }, ctx)
    if (!first.ok) throw new Error(first.error)
    const revised = reviseProposalArgs(first.proposal, { amount: '25' }, ctx)
    expect(revised?.ok).toBe(true)
    expect(revised?.ok && revised.proposal.preview.effect).toBeFalsy()
  })
})
