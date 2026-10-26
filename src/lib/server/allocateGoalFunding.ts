import type { createServiceRoleClient } from '@/lib/supabase/service'
import { allocateMonth } from '@/lib/goals/allocateMonth'
import { crossedCheckpoints } from '@/lib/notifications/evaluateGoalAlerts'
import { isEligibleCarryPocket } from '@/lib/savings/monthCarry'
import { convertCurrency, tryConvertCurrency } from '@/lib/utils/currency'
import type { Currency, Goal, SavingsAccount } from '@/lib/store/types'
import { depositToPocket, primaryTrackedAccountId } from '@/lib/server/pocketLedger'

type Service = ReturnType<typeof createServiceRoleClient>

const cents = (n: number) => Math.round(n * 100) / 100

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
 * Every goal is funded each cycle (a quarterly goal only changes how its pace is shown); one run row
 * per (goal, cycle) is the idempotency key and the history behind "behind"/streak.
 *
 * Safe to re-run: a goal that already has its run row is not paid again and its amount is deducted from
 * what is left, so a cron that died half-way never sweeps the same money twice. A failed payment removes
 * its claim so the next run can retry it.
 * Returns the base amount left for the default destination.
 */
export async function allocateGoalFunding(c: Ctx): Promise<number> {
  const { service, userId, monthKey, base, rates } = c
  const conv = (n: number, from: string) => tryConvertCurrency(n, from, base, rates)

  // Goals this cron funds from real money are skipped, not guessed at 1:1, when an amount has no FX path.
  const current: Record<string, number> = {}
  const due = c.goals
    .filter((g) => g.status === 'active' && g.fundingMode !== 'manual')
    .flatMap((g) => {
      const target = g.targetAmount === null ? null : conv(g.targetAmount, g.currency)
      const fixed = g.monthlyContribution === null ? null : conv(g.monthlyContribution, g.currency)
      const manual = conv(g.manualCurrentAmount, g.currency)
      const linked = c.accounts
        .filter((a) => g.linkedSavingsAccountIds.includes(a.id))
        .map((a) => conv(a.currentBalance, a.currency))
      if ((g.targetAmount !== null && target === null) || (g.monthlyContribution !== null && fixed === null)) return []
      if (manual === null || linked.includes(null)) return []
      current[g.id] = manual + (linked as number[]).reduce((sum, n) => sum + n, 0)
      return [{
        ...g,
        targetAmount: target,
        // A quarterly goal's fixed amount is per quarter; it is funded monthly.
        monthlyContribution: fixed === null ? null : fixed / (g.frequency === 'quarterly' ? 3 : 1),
      }]
    })
  if (due.length === 0) return c.carry

  const { data: existing } = await service
    .from('goal_allocation_runs').select('goal_id, amount').eq('user_id', userId).eq('period', monthKey)
  const done = new Map((existing ?? []).map((r) => [r.goal_id as string, Number(r.amount)]))

  let left = c.carry
  for (const [goalId, amount] of done) if (due.some((g) => g.id === goalId)) left = cents(left - amount)

  const lines = allocateMonth({ goals: due, periodSavings: c.carry, current })
  const primaryId = await primaryTrackedAccountId(service, userId)
  for (const line of lines) {
    if (done.has(line.goalId)) continue
    const goal = due.find((g) => g.id === line.goalId)!
    const amount = Math.max(0, cents(Math.min(line.amount, left)))

    const { error: claimed } = await service.from('goal_allocation_runs').insert({
      user_id: userId, goal_id: goal.id, period: monthKey, planned: line.planned, amount,
    })
    if (claimed) continue
    if (amount <= 0) continue

    const release = async () => {
      await service.from('goal_allocation_runs').delete().eq('goal_id', goal.id).eq('period', monthKey)
    }
    try {
      let pocket = c.accounts.filter(isEligibleCarryPocket).find((a) => goal.linkedSavingsAccountIds.includes(a.id))
      if (!pocket) {
        const { data: created, error } = await service.from('savings_accounts').insert({
          user_id: userId, name: `${goal.name} pocket`, category: 'savings', type: 'vault', currency: base,
          current_balance: 0, opening_balance: 0, is_emergency_cover: false, held_in_payment_method_id: primaryId,
        }).select('id').single()
        if (error || !created) throw new Error('pocket create failed')
        const { error: linkErr } = await service.from('goals').update({ linked_savings_account_ids: [...goal.linkedSavingsAccountIds, created.id] }).eq('id', goal.id)
        if (linkErr) throw new Error('pocket link failed')
        pocket = { id: created.id, currency: base, currentBalance: 0 } as SavingsAccount
      }
      const inPocket = tryConvertCurrency(amount, base, pocket.currency, rates)
      if (inPocket === null) throw new Error('no FX path to pocket currency')
      await depositToPocket(service, {
        userId, pocketId: pocket.id, amount: inPocket, date: c.postDate, source: 'carry',
        note: `Goal funding · ${goal.name} · ${monthKey}`, key: `goal-funding|${goal.id}|${monthKey}`, accountId: primaryId,
      })
    } catch (e) {
      console.error('[allocateGoalFunding]', goal.id, monthKey, e)
      await release()
      continue
    }

    left = cents(left - amount)
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
