import type { createServiceRoleClient } from '@/lib/supabase/service'
import { allocateMonth } from '@/lib/goals/allocateMonth'
import { isEligibleCarryPocket } from '@/lib/savings/monthCarry'
import { crossedCheckpoints } from '@/lib/notifications/evaluateGoalAlerts'
import { convertCurrency } from '@/lib/utils/currency'
import type { Currency, Goal, SavingsAccount } from '@/lib/store/types'

type Service = ReturnType<typeof createServiceRoleClient>

const isQuarterEnd = (monthKey: string) => ['03', '06', '09', '12'].includes(monthKey.slice(5, 7))
const quarterKey = (monthKey: string) => `${monthKey.slice(0, 4)}-Q${Math.ceil(Number(monthKey.slice(5, 7)) / 3)}`

interface Ctx {
  service: Service
  userId: string
  monthKey: string
  /** Total base-currency sweep for the closed cycle; this is what goals can draw from. */
  carry: number
  base: Currency
  rates: Record<string, number>
  goals: Goal[]
  accounts: SavingsAccount[]
  postDate: string
  /** Called for each checkpoint a deposit crosses; 100 means the goal is complete. */
  onCheckpoint?: (goal: Goal, pct: number, saved: number) => Promise<void>
}

/**
 * Pays funded goals (share / fixed) from the cycle's savings, priority order, one deposit per goal.
 * Idempotent per (goal, period) via goal_allocation_runs: the run row is claimed before money moves.
 * Returns the base amount left for the default destination.
 */
export async function allocateGoalFunding(c: Ctx): Promise<number> {
  const { service, userId, monthKey, base, rates } = c
  const conv = (n: number, from: string) => convertCurrency(n, from, base, rates)

  const quarterly = isQuarterEnd(monthKey)
  let quarterSavings = c.carry
  if (quarterly) {
    const { data: prior } = await service
      .from('savings_month_summary').select('carry').eq('user_id', userId)
      .lt('month_key', monthKey).order('month_key', { ascending: false }).limit(2)
    quarterSavings += (prior ?? []).reduce((s, r) => s + Number(r.carry || 0), 0)
  }

  const due = c.goals
    .filter((g) => g.status === 'active' && g.fundingMode !== 'manual' && (g.frequency === 'monthly' || quarterly))
    .map((g) => ({
      ...g,
      targetAmount: g.targetAmount === null ? null : conv(g.targetAmount, g.currency),
      monthlyContribution: g.monthlyContribution === null ? null : conv(g.monthlyContribution, g.currency),
    }))
  if (due.length === 0) return c.carry

  const current: Record<string, number> = {}
  for (const g of due) {
    const linked = c.accounts.filter((a) => g.linkedSavingsAccountIds.includes(a.id))
    current[g.id] = conv(g.manualCurrentAmount, g.currency) + linked.reduce((s, a) => s + conv(a.currentBalance, a.currency), 0)
  }

  const monthly = due.filter((g) => g.frequency === 'monthly')
  const quarterlyGoals = due.filter((g) => g.frequency === 'quarterly')
  const lines = [
    ...allocateMonth({ goals: monthly, periodSavings: c.carry, current }),
    ...allocateMonth({ goals: quarterlyGoals, periodSavings: quarterSavings, current }),
  ]
  let left = c.carry

  for (const line of lines) {
    const goal = due.find((g) => g.id === line.goalId)!
    const period = goal.frequency === 'quarterly' ? quarterKey(monthKey) : monthKey
    const { error: claimed } = await service.from('goal_allocation_runs').insert({
      user_id: userId, goal_id: goal.id, period, planned: line.planned, amount: Math.min(line.amount, left),
    })
    if (claimed) continue // already run for this period (unique goal_id+period)
    const amount = Math.min(line.amount, left)
    if (amount <= 0) continue

    let pocket = c.accounts.filter(isEligibleCarryPocket).find((a) => goal.linkedSavingsAccountIds.includes(a.id))
    if (!pocket) {
      const { data: created } = await service.from('savings_accounts').insert({
        user_id: userId, name: `${goal.name} pocket`, category: 'savings', type: 'vault', currency: base,
        current_balance: 0, opening_balance: 0, is_emergency_cover: false,
      }).select('*').single()
      if (!created) continue
      await service.from('goals').update({ linked_savings_account_ids: [...goal.linkedSavingsAccountIds, created.id] }).eq('id', goal.id)
      pocket = { id: created.id, currency: base, currentBalance: 0 } as SavingsAccount
    }
    const inPocket = convertCurrency(amount, base, pocket.currency, rates)
    await service.from('savings_transactions').insert({
      user_id: userId, account_id: pocket.id, kind: 'deposit', amount: inPocket, currency: pocket.currency,
      transaction_date: c.postDate, is_cash_flow: true, source: 'carry', notes: `Goal funding · ${goal.name} · ${period}`,
    })
    const { data: bal } = await service.from('savings_accounts').select('current_balance').eq('id', pocket.id).single()
    await service.from('savings_accounts').update({ current_balance: Number(bal?.current_balance ?? 0) + inPocket }).eq('id', pocket.id)
    left -= amount
    const original = c.goals.find((g) => g.id === goal.id)
    if (original && goal.targetAmount) {
      const after = current[goal.id] + amount
      for (const pct of crossedCheckpoints(current[goal.id], after, goal.targetAmount)) {
        await c.onCheckpoint?.(original, pct, convertCurrency(after, base, original.currency, rates))
      }
      current[goal.id] = after
    }
  }
  return Math.max(0, left)
}
