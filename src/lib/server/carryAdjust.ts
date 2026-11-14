import type { createServiceRoleClient } from '@/lib/supabase/service'
import { carryDrift } from '@/lib/savings/monthCarry'
import { convertCurrency } from '@/lib/utils/currency'
import { carryPostDate, closedCycleDrift, must, type CycleDriftItem } from '@/lib/server/carryCycle'
import { depositToPocket, groupIdFor, primaryTrackedAccountId } from '@/lib/server/pocketLedger'

type Service = ReturnType<typeof createServiceRoleClient>

const round2 = (n: number) => Math.round(n * 100) / 100

/** A month's `carry_adjustment` and `carry_settled_at` taken over from the values in `from` so nobody else settles it too. */
export interface CarryClaim { monthKey: string; adjustment: number; carrySettledAt: string | null; taken: number; takenAt: string }

/**
 * Compare-and-set on the summary row: it changes only while it still holds the adjustment and settle time that were read.
 * Returns the claim, or null when someone else settled the month first.
 */
export async function claimCarryAdjustment(service: Service, userId: string, item: Pick<CycleDriftItem, 'monthKey' | 'adjustment' | 'carrySettledAt'>, next: number): Promise<CarryClaim | null> {
  const takenAt = new Date().toISOString()
  const q = service.from('savings_month_summary').update({ carry_adjustment: next, carry_settled_at: takenAt })
    .eq('user_id', userId).eq('month_key', item.monthKey).eq('carry_adjustment', item.adjustment)
  const { data } = must(await (item.carrySettledAt === null ? q.is('carry_settled_at', null) : q.eq('carry_settled_at', item.carrySettledAt)).select('month_key'), 'claim')
  return (data?.length ?? 0) > 0 ? { monthKey: item.monthKey, adjustment: item.adjustment, carrySettledAt: item.carrySettledAt, taken: next, takenAt } : null
}

/** Puts a claim back (both values) while the row still holds what the claim wrote, so the month is as stale as before it. */
export async function releaseCarryClaim(service: Service, userId: string, claim: CarryClaim): Promise<void> {
  must(await service.from('savings_month_summary').update({ carry_adjustment: claim.adjustment, carry_settled_at: claim.carrySettledAt })
    .eq('user_id', userId).eq('month_key', claim.monthKey).eq('carry_adjustment', claim.taken).eq('carry_settled_at', claim.takenAt), 'release claim')
}

export interface CarryApplyResult {
  cycle: CycleDriftItem | null
  /** Part of the change that could not be booked (a withdrawal larger than the pocket holds, a pocket that is gone or cannot be priced), base currency. */
  unapplied: number
  /** applied: money or the summary moved. settled: nothing to do, or someone else settled it first. unapplied: the pocket could not take it. */
  outcome: 'applied' | 'settled' | 'unapplied'
}

/**
 * Brings one closed cycle's posted carry up to what its rows say now, only while it is still stale. The summary row is claimed
 * first (compare-and-set), then a rise is deposited and a fall withdrawn (capped at the pocket's balance) on the pocket the carry
 * went to; a failed post gives the claim back. A summary with no pocket is corrected alone. `carry` and `closed_at` are never
 * touched. The ledger key holds the settle time that was read, so a repeated call books nothing twice.
 */
export async function applyCarryDrift(service: Service, userId: string, monthKey: string, monthStartDay: number, rates: Record<string, number>): Promise<CarryApplyResult> {
  const [found] = await closedCycleDrift(service, userId, monthStartDay, rates, { monthKey })
  if (!found) return { cycle: null, unapplied: 0, outcome: 'settled' }
  const { item, ctx } = found
  if (!item.stale) return { cycle: item, unapplied: 0, outcome: 'settled' }
  const nothing = { cycle: item, unapplied: round2(Math.abs(item.delta)), outcome: 'unapplied' as const }

  const pocket = item.pocketId ? ctx.accounts.find((a) => a.id === item.pocketId) : undefined
  if (item.pocketId && !pocket) return nothing
  let applied = item.delta
  let wanted = 0
  let take = 0
  if (pocket) {
    wanted = convertCurrency(Math.abs(item.delta), ctx.base, pocket.currency, rates)
    if (!Number.isFinite(wanted) || wanted < 0.01) return nothing
    take = item.delta > 0 ? wanted : Math.min(wanted, Math.max(0, pocket.currentBalance))
    if (take < 0.01) return nothing
    applied = (item.delta > 0 ? 1 : -1) * round2(Math.abs(item.delta) * (take / wanted))
  }

  const adjustment = round2(item.adjustment + applied)
  const claim = await claimCarryAdjustment(service, userId, item, adjustment)
  if (!claim) {
    const [fresh] = await closedCycleDrift(service, userId, monthStartDay, rates, { monthKey })
    return { cycle: fresh?.item ?? item, unapplied: 0, outcome: 'settled' }
  }

  if (pocket) {
    try {
      const key = `carry-adjust|${userId}|${monthKey}|${item.settledAt}`
      const date = carryPostDate(ctx.end)
      const note = `Carry adjustment · ${monthKey}`
      const accountId = await primaryTrackedAccountId(service, userId)
      if (item.delta > 0) {
        await depositToPocket(service, { userId, pocketId: pocket.id, amount: take, date, source: 'carry', note, key, accountId })
      } else {
        const { error } = await service.rpc('adjust_pocket_balance', {
          p_user: userId, p_pocket: pocket.id, p_delta: -take, p_kind: 'withdrawal', p_group: groupIdFor(key),
          p_payment_method: accountId ?? undefined, p_date: date, p_note: note, p_source: 'carry',
        })
        if (error) throw new Error(`withdrawal failed: ${error.message}`)
      }
    } catch (e) {
      await releaseCarryClaim(service, userId, claim).catch((r) => console.error('[carry] release failed', r instanceof Error ? r.message : r))
      throw e
    }
  }

  const next = { ...carryDrift({ carry: item.carry, carry_adjustment: adjustment }, ctx.figures!, false), monthKey, currency: item.currency, carry: item.carry, adjustment, pocketId: item.pocketId, carrySettledAt: item.carrySettledAt, settledAt: item.settledAt }
  return { cycle: next, unapplied: round2(Math.abs(item.delta - applied)), outcome: 'applied' }
}
