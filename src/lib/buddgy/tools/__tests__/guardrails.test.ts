import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/navigation/navigate', () => ({ navigate: vi.fn() }))
vi.mock('@/lib/apiBase', () => ({ apiFetchAuth: vi.fn() }))

import { resetAutoSlots } from '@/lib/buddgy/tools/autoApplyGuard'
import { executeCalls } from '@/lib/buddgy/client/runTurn'
import { TOOLS } from '@/lib/buddgy/tools/exec'
import { resetNavConsent } from '@/lib/buddgy/tools/navConsent'
import type { ToolContext } from '@/lib/buddgy/tools/types'
import { navigate } from '@/lib/navigation/navigate'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

const SALARY = { id: 'i1', name: 'Salary', amount: 1000000, currency: 'EGP', isRecurring: true, recurringFrequency: 'monthly', dayOfMonth: 1, paydayDays: [1], sourceType: 'salary', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' } as never
const ctx: ToolContext = { now: new Date('2026-10-19T12:00:00'), locale: 'en' }
const add = (args: Record<string, unknown>, c: ToolContext = ctx) => TOOLS.get('add_expense')!.write!.propose({ category: 'Food', ...args }, c)
const riskOf = (r: ReturnType<typeof add>) => (r.ok ? r.proposal.risk : 'error')

beforeEach(() => {
  resetAutoSlots()
  resetNavConsent()
  vi.mocked(navigate).mockClear()
  useFinanceStore.setState({
    paymentMethods: [{ id: 'aaaaaaaa-0000-0000-0000-000000000001', name: 'Cash', type: 'cash', currency: 'EGP', isDefault: true } as never],
    expenses: [],
    incomeSources: [SALARY],
    incomeEvents: [],
    budgetPlans: [],
    activeBudgetPlanId: null,
    exchangeRates: {},
    settings: { ...useFinanceStore.getState().settings, baseCurrency: 'EGP' },
  })
})

describe('add_expense auto-apply guardrails', () => {
  it('asks for a tap above the absolute amount cap even when under 5% of income', () => {
    expect(riskOf(add({ description: 'Sofa', amount: 40000 }))).toBe('approve')
    expect(riskOf(add({ description: 'Tea', amount: 20 }))).toBe('auto')
  })

  it('asks for a tap when the date is more than 7 days from today', () => {
    expect(riskOf(add({ description: 'Old lunch', amount: 50, date: '2026-10-11' }))).toBe('approve')
    expect(riskOf(add({ description: 'Late lunch', amount: 50, date: '2026-10-12' }))).toBe('auto')
    expect(riskOf(add({ description: 'Future', amount: 50, date: '2026-10-27' }))).toBe('approve')
    expect(riskOf(add({ description: 'Wrong year', amount: 50, date: '2025-10-19' }))).toBe('approve')
  })

  it('allows at most 5 auto-adds per minute, then asks', () => {
    const risks = Array.from({ length: 7 }, (_, i) => riskOf(add({ description: `Item ${i}`, amount: 10 + i })))
    expect(risks).toEqual(['auto', 'auto', 'auto', 'auto', 'auto', 'approve', 'approve'])
  })

  it('never auto-applies after a read tool hop', () => {
    expect(riskOf(add({ description: 'Tea', amount: 20 }, { ...ctx, afterRead: true }))).toBe('approve')
  })

  it('does not spend a slot when applying an already-proposed entry', () => {
    const w = TOOLS.get('add_expense')!.write!
    const p = add({ description: 'Tea', amount: 20 })
    if (!p.ok) throw new Error('x')
    for (let i = 0; i < 10; i++) w.apply(p.proposal, ctx)
    expect(riskOf(add({ description: 'Next', amount: 21 }))).toBe('auto')
  })
})

describe('navigation consent', () => {
  const call = { name: 'open_screen', args: { screen: 'budget' } }

  it('proposes a card first and does not navigate', () => {
    const r = executeCalls([call], ctx)
    expect(navigate).not.toHaveBeenCalled()
    expect(r.proposals).toHaveLength(1)
    expect(r.proposals[0]).toMatchObject({ tool: 'open_screen', risk: 'approve' })
    expect(r.needsModel).toBe(false)
  })

  it('navigates on accept, and then directly for the rest of the session', () => {
    const first = executeCalls([call], ctx).proposals[0]
    const applied = TOOLS.get('open_screen')!.write!.apply(first, ctx)
    expect(applied.ok).toBe(true)
    expect(navigate).toHaveBeenCalledTimes(1)
    const again = executeCalls([call], ctx)
    expect(again.proposals).toHaveLength(0)
    expect(navigate).toHaveBeenCalledTimes(2)
  })

  it('does not grant consent when the navigation itself is refused', () => {
    const bad = executeCalls([{ name: 'open_screen', args: { screen: 'admin' } }], ctx).proposals[0]
    expect(TOOLS.get('open_screen')!.write!.apply(bad, ctx).ok).toBe(false)
    expect(executeCalls([call], ctx).proposals).toHaveLength(1)
  })
})
