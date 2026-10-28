import { beforeEach, describe, expect, it } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { IncomeEvent, IncomeSource } from '@/lib/store/types'

const st = () => useFinanceStore.getState()
const event: IncomeEvent = {
  id: 'ev1', templateId: 'src1', name: 'Salary', amount: 5000, currency: 'EGP', receivedDate: '2026-10-01',
  occurrenceDate: '2026-10-01', status: 'confirmed', smsLogId: 'sms9', notes: 'n', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
}
const source = { id: 'src1', name: 'Salary', amount: 5000, currency: 'EGP', isRecurring: true } as unknown as IncomeSource

beforeEach(() => {
  useFinanceStore.setState({ incomeEvents: [event], incomeSources: [source], savingsTransactions: [], savingsAccounts: [], goals: [] })
  useFinanceStore.setState({ settings: { ...st().settings, noIncomeDeclared: false } })
})

describe('income delete and undo', () => {
  it('deleting the last source keeps noIncomeDeclared off while received events exist', () => {
    st().deleteIncomeSource('src1')
    expect(st().settings.noIncomeDeclared).toBe(false)
  })

  it('deleting the last source with no received events still declares no income', () => {
    useFinanceStore.setState({ incomeEvents: [] })
    st().deleteIncomeSource('src1')
    expect(st().settings.noIncomeDeclared).toBe(true)
  })

  it('restoreIncomeEvent brings back the original row (same id and fields)', () => {
    st().deleteIncomeEvent('ev1')
    expect(st().incomeEvents).toHaveLength(0)
    st().restoreIncomeEvent(event)
    expect(st().incomeEvents[0]).toEqual(event)
  })

  it('restoreIncomeEvent removes exactly the reversal deposit its delete created, even after a rename', () => {
    const linked = { ...event, linkedSavingsAccountId: 'a1' }
    useFinanceStore.setState({
      incomeEvents: [linked],
      savingsAccounts: [{ id: 'a1', name: 'P', currency: 'EGP', currentBalance: 100 } as never],
      savingsTransactions: [{ id: 'old', accountId: 'a1', type: 'deposit', amount: 7, currency: 'EGP', date: '2026-10-01', notes: 'Reversed: Salary' } as never],
    })
    st().deleteIncomeEvent('ev1')
    expect(st().savingsTransactions).toHaveLength(2)
    st().restoreIncomeEvent({ ...linked, name: 'Renamed' })
    expect(st().savingsTransactions.map((t) => t.id)).toEqual(['old'])
    expect(st().savingsAccounts[0].currentBalance).toBe(100)
  })

  it('restoreIncomeSource brings the source back and clears noIncomeDeclared', () => {
    useFinanceStore.setState({ incomeEvents: [] })
    st().deleteIncomeSource('src1')
    st().restoreIncomeSource(source)
    expect(st().incomeSources).toHaveLength(1)
    expect(st().settings.noIncomeDeclared).toBe(false)
  })
})
