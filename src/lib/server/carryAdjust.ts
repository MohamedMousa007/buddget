import type { createServiceRoleClient } from '@/lib/supabase/service'
import { carryDrift } from '@/lib/savings/monthCarry'
import { convertCurrency } from '@/lib/utils/currency'
import { carryPostDate, closedCycleDrift, must, type CycleDriftItem } from '@/lib/server/carryCycle'
import { depositToPocket, groupIdFor, primaryTrackedAccountId } from '@/lib/server/pocketLedger'

type Service = ReturnType<typeof createServiceRoleClient>

const round2 = (n: number) => Math.round(n * 100) / 100

export interface CarryApplyResult {
  cycle: CycleDriftItem | null
  /** Part of the change that could not be booked (a withdrawal larger than the pocket holds), base currency. */
  unapplied: number
}

/**
 * Brings one closed cycle's posted carry up to what its rows say now, only while it is still stale. A rise is deposited
 * and a fall withdrawn (capped at the pocket's balance) on the pocket the carry went to; with no pocket the summary row
 * alone is corrected. `carry` and `closed_at` are never touched. The ledger key holds the month and the new total, and the
 * summary write is an absolute value, so a repeated call books nothing twice.
 */
export async function applyCarryDrift(service: Service, userId: string, monthKey: string, monthStartDay: number, rates: Record<string, number>): Promise<CarryApplyResult> {
  const [found] = await closedCycleDrift(service, userId, monthStartDay, rates, { monthKey })
  if (!found) return { cycle: null, unapplied: 0 }
  const { item, ctx } = found
  if (!item.stale) return { cycle: item, unapplied: 0 }

  const pocket = ctx.accounts.find((a) => a.id === (item.pocketId ?? ctx.defaultCarryPocketId))
  let applied = item.delta
  if (pocket) {
    const key = `carry-adjust|${userId}|${monthKey}|${Math.round(item.recomputed * 100)}`
    const date = carryPostDate(ctx.end)
    const note = `Carry adjustment · ${monthKey}`
    const accountId = await primaryTrackedAccountId(service, userId)
    const wanted = convertCurrency(Math.abs(item.delta), ctx.base, pocket.currency, rates)
    if (item.delta > 0) {
      await depositToPocket(service, { userId, pocketId: pocket.id, amount: wanted, date, source: 'carry', note, key, accountId })
    } else {
      const take = Math.min(wanted, Math.max(0, pocket.currentBalance))
      applied = take < 0.01 ? 0 : -round2(Math.abs(item.delta) * (take / wanted))
      if (applied !== 0) {
        const { error } = await service.rpc('adjust_pocket_balance', {
          p_user: userId, p_pocket: pocket.id, p_delta: -take, p_kind: 'withdrawal', p_group: groupIdFor(key),
          p_payment_method: accountId ?? undefined, p_date: date, p_note: note, p_source: 'carry',
        })
        if (error) throw new Error(`withdrawal failed: ${error.message}`)
      }
    }
  }

  const adjustment = round2(item.adjustment + applied)
  must(await service.from('savings_month_summary').update({ carry_adjustment: adjustment }).eq('user_id', userId).eq('month_key', monthKey), 'adjustment')
  const next = { ...carryDrift({ carry: item.carry, carry_adjustment: adjustment }, ctx.figures!, false), monthKey, currency: item.currency, carry: item.carry, adjustment, pocketId: item.pocketId }
  return { cycle: next, unapplied: round2(Math.abs(item.delta - applied)) }
}
