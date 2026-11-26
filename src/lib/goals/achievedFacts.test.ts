import { describe, expect, it } from 'vitest'
import type { Goal, SavingsTransaction } from '@/lib/store/types'
import { achievedFacts, monthsTaken } from './achievedFacts'

const goal = (id: string, pockets: string[], createdAt: string, achievedAt: string): Goal => ({
  id, name: id, emoji: '', category: 'vacation', targetAmount: 1000, currency: 'EGP', manualCurrentAmount: 0, targetDate: null,
  linkedSavingsAccountIds: pockets, linkedDebtIds: [], monthlySpendingLimit: null, priority: 0, status: 'achieved',
  monthlyContribution: null, fundingMode: 'manual', sharePct: null, frequency: 'monthly', planStart: null, notes: null,
  createdAt, achievedAt,
})
const tx = (accountId: string, date: string, type: SavingsTransaction['type'] = 'deposit'): SavingsTransaction =>
  ({ id: `${accountId}-${date}-${type}`, accountId, type, amount: 100, currency: 'EGP', date })

describe('achievedFacts', () => {
  const goals = [goal('a', ['pa'], '2026-01-10', '2026-08-01'), goal('b', ['pb'], '2026-03-01', '2026-06-20')]
  const txs = [
    tx('pa', '2026-01-15'), tx('pa', '2026-02-15'), tx('pa', '2026-03-15'), tx('pa', '2026-05-15'), tx('pa', '2026-05-20'),
    tx('pa', '2026-06-01', 'withdrawal'),
    tx('pb', '2026-03-05'), tx('pb', '2026-04-05'),
    tx('other', '2026-04-05'),
  ]

  it('counts deposits into the finished goals’ pockets only', () => {
    const f = achievedFacts(goals, txs)
    expect(f.deposits).toBe(7)
    expect(f.depositsByGoal).toEqual({ a: 5, b: 2 })
  })

  it('the fastest goal is the fewest whole months from start to finish', () => {
    expect(monthsTaken(goals[1])).toBe(3)
    expect(achievedFacts(goals, txs).fastestMonths).toBe(3)
  })

  it('the best streak is the longest run of months in a row with a deposit', () => {
    expect(achievedFacts(goals, txs).bestStreak).toBe(3)
  })

  it('nothing finished reads as zeros', () => {
    expect(achievedFacts([], txs)).toEqual({ deposits: 0, fastestMonths: 0, bestStreak: 0, depositsByGoal: {} })
  })
})
