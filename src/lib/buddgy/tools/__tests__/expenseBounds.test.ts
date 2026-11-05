import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/navigation/navigate', () => ({ navigate: vi.fn() }))
vi.mock('@/lib/apiBase', () => ({ apiFetchAuth: vi.fn() }))

import { resetAutoSlots } from '@/lib/buddgy/tools/autoApplyGuard'
import { TOOLS } from '@/lib/buddgy/tools/exec'
import { resetSameTurnMemory } from '@/lib/buddgy/tools/exec/expenses'
import type { ToolContext } from '@/lib/buddgy/tools/types'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

const ctx: ToolContext = { now: new Date('2026-10-19T12:00:00'), locale: 'en' }
const add = (a: Record<string, unknown>, c: ToolContext = ctx) => TOOLS.get('add_expense')!.write!.propose({ category: 'Food', ...a }, c)

beforeEach(() => {
  resetAutoSlots()
  resetSameTurnMemory()
  useFinanceStore.setState({
    paymentMethods: [{ id: 'aaaaaaaa-0000-0000-0000-000000000001', name: 'Cash', type: 'cash', currency: 'EGP', isDefault: true } as never],
    expenses: [], incomeSources: [], incomeEvents: [], budgetPlans: [], activeBudgetPlanId: null, exchangeRates: {},
    settings: { ...useFinanceStore.getState().settings, baseCurrency: 'EGP' },
  })
})

describe('add_expense bounds', () => {
  it('rejects an absurd amount', () => {
    expect(add({ description: 'x', amount: 1e300 }).ok).toBe(false)
  })

  it('still accepts a normal amount', () => {
    expect(add({ description: 'x', amount: 250 }).ok).toBe(true)
  })

  it('editing a fresh card does not flag a duplicate against itself', () => {
    add({ description: 'Tea', amount: 20 })
    const revised = add({ description: 'Tea', amount: 20 }, { ...ctx, revising: true })
    expect(revised.ok && revised.proposal.preview.effect).toBeFalsy()
  })
})
