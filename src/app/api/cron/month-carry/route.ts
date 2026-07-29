/**
 * GET /api/cron/month-carry  (daily — NOT YET SCHEDULED)
 *
 * Sweeps each user's real month-end surplus into savings the day after their cycle closes (F2).
 * income − spend − allocated, floored at 0, posted as a normal deposit dated to the closed month's
 * last day, into the resolved destination pocket. Idempotent per (user, month_key) via
 * savings_month_summary. Push-only notification, no in-app card, no undo.
 *
 * ⚠️ WRITES LIVE MONEY. Deliberately absent from vercel.json — enable only after a preview-env dry
 * run and explicit sign-off. Auth: `Authorization: Bearer ${CRON_SECRET}`.
 */
import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { justClosedCycleKey, cycleRange } from '@/lib/savings/carryDateLogic'
import { computeMonthCarry, resolveCarryDestination } from '@/lib/savings/monthCarry'
import { savingsAccountFromRow } from '@/lib/supabase/remote/mappers/savingsAccountMapper'
import { goalFromRow } from '@/lib/supabase/remote/mappers/goalMapper'
import { convertCurrency } from '@/lib/utils/currency'
import { emitNotification } from '@/lib/server/emitNotification'
import type { Currency, SavingsAccount } from '@/lib/store/types'

export const maxDuration = 60
const PAGE = 500

async function fetchRates(): Promise<Record<string, number>> {
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(6000) })
    const d = (await r.json()) as { rates?: Record<string, number> }
    const out: Record<string, number> = {}
    for (const [c, v] of Object.entries(d.rates ?? {})) if (typeof v === 'number') out[`USD_${c}`] = v
    return out
  } catch {
    return {}
  }
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const service = createServiceRoleClient()
  const rates = await fetchRates()
  let carried = 0
  let scanned = 0

  for (let offset = 0; ; offset += PAGE) {
    const { data: settings, error } = await service
      .from('user_settings')
      .select('user_id, month_start_day')
      .range(offset, offset + PAGE - 1)
    if (error || !settings || settings.length === 0) break

    for (const s of settings) {
      scanned++
      const userId = s.user_id as string
      const monthStartDay = (s.month_start_day as number | null) ?? 1
      const monthKey = justClosedCycleKey(now, monthStartDay)
      if (!monthKey) continue

      // Idempotency — one carry per user per cycle.
      const { data: existing } = await service
        .from('savings_month_summary').select('id').eq('user_id', userId).eq('month_key', monthKey).maybeSingle()
      if (existing) continue

      const { start, end } = cycleRange(monthKey, monthStartDay)
      const startISO = start.toISOString().slice(0, 10)
      const endISO = end.toISOString().slice(0, 10)

      const [profileR, accountsR, goalsR, expensesR, incomeR, txR] = await Promise.all([
        service.from('profiles').select('default_carry_pocket_id, created_at, base_currency').eq('id', userId).maybeSingle(),
        service.from('savings_accounts').select('*').eq('user_id', userId).is('deleted_at', null),
        service.from('goals').select('*').eq('user_id', userId).is('deleted_at', null),
        service.from('expenses').select('category, amount, currency, expense_date').eq('user_id', userId).gte('expense_date', startISO).lt('expense_date', endISO).is('deleted_at', null),
        service.from('income_events').select('amount, currency, status, received_date').eq('user_id', userId).gte('received_date', startISO).lt('received_date', endISO).is('deleted_at', null),
        service.from('savings_transactions').select('amount, currency, kind, is_cash_flow, transaction_date').eq('user_id', userId).gte('transaction_date', startISO).lt('transaction_date', endISO).is('deleted_at', null),
      ])

      const base = ((profileR.data?.base_currency as string | null) ?? 'EGP') as Currency
      const toBase = (amt: number, cur: string) => convertCurrency(amt, cur, base, rates)

      const accounts: SavingsAccount[] = (accountsR.data ?? []).map(savingsAccountFromRow)
      const savingsPockets = accounts.filter((a) => a.category === 'savings')

      const income = (incomeR.data ?? [])
        .filter((e) => ['confirmed', 'late', 'partial'].includes((e.status as string) ?? ''))
        .reduce((sum, e) => sum + toBase(Number(e.amount) || 0, (e.currency as string) ?? base), 0)
      const spend = (expensesR.data ?? [])
        .filter((e) => (e.category as string) !== 'Savings')
        .reduce((sum, e) => sum + toBase(Number(e.amount) || 0, (e.currency as string) ?? base), 0)
      const savTagged = (expensesR.data ?? [])
        .filter((e) => (e.category as string) === 'Savings')
        .reduce((sum, e) => sum + toBase(Number(e.amount) || 0, (e.currency as string) ?? base), 0)
      const deposits = (txR.data ?? [])
        .filter((t) => (t.kind as string) === 'deposit' && t.is_cash_flow !== false)
        .reduce((sum, t) => sum + toBase(Number(t.amount) || 0, (t.currency as string) ?? base), 0)
      const allocated = savTagged + deposits

      const { carry, saved } = computeMonthCarry({ income, spend, allocated })

      // First partial cycle: an account created after the cycle started shouldn't carry a full month.
      const createdAt = profileR.data?.created_at ? new Date(profileR.data.created_at as string) : null
      if (createdAt && createdAt > start) continue
      if (carry <= 0) {
        // Nothing to sweep, but record the closed cycle so it isn't reconsidered.
        await service.from('savings_month_summary').insert({ user_id: userId, month_key: monthKey, target: 0, allocated, carry: 0, saved, currency: base, closed_at: now.toISOString() })
        continue
      }

      // Resolve destination (default fiat pocket → active goal's pocket → the vault).
      const goals = (goalsR.data ?? []).map(goalFromRow)
      const dest = resolveCarryDestination(profileR.data?.default_carry_pocket_id as string | null, savingsPockets, goals)
      let pocketId: string
      if (dest.kind === 'pocket') {
        pocketId = dest.pocketId
      } else {
        const name = dest.kind === 'create-goal-pocket' ? dest.name : 'Monthly Savings'
        const { data: created } = await service.from('savings_accounts').insert({
          user_id: userId, name, category: 'savings', type: 'vault', currency: base, current_balance: 0, opening_balance: 0, is_emergency_cover: false,
        }).select('id').single()
        pocketId = created!.id as string
        if (dest.kind === 'create-vault') await service.from('profiles').update({ default_carry_pocket_id: pocketId }).eq('id', userId)
      }

      // Post the carry: a real deposit dated to the closed month's last day.
      const postDate = new Date(end.getTime() - 24 * 3600 * 1000).toISOString().slice(0, 10)
      const carryInPocketCcy = convertCurrency(carry, base, accounts.find((a) => a.id === pocketId)?.currency ?? base, rates)
      await service.from('savings_transactions').insert({
        user_id: userId, account_id: pocketId, kind: 'deposit', amount: carryInPocketCcy,
        currency: accounts.find((a) => a.id === pocketId)?.currency ?? base, transaction_date: postDate,
        is_cash_flow: true, source: 'carry', notes: `Month-end carry · ${monthKey}`,
      })
      // Raise the destination balance. Freshly-created pockets start at 0.
      const destAcc = accounts.find((a) => a.id === pocketId)
      const { data: liveBal } = await service.from('savings_accounts').select('current_balance').eq('id', pocketId).single()
      const prevBal = Number(liveBal?.current_balance ?? destAcc?.currentBalance ?? 0)
      await service.from('savings_accounts').update({ current_balance: prevBal + carryInPocketCcy }).eq('id', pocketId)

      await service.from('savings_month_summary').insert({
        user_id: userId, month_key: monthKey, target: 0, allocated, carry, saved, currency: base, pocket_id: pocketId, closed_at: now.toISOString(),
      })

      await emitNotification(service, {
        userId, category: 'savings_carry', severity: 'success', dedupeKey: `carry:${monthKey}`,
        title: 'Money moved to savings', body: `We swept ${Math.round(carry).toLocaleString('en-US')} ${base} left over from last month into your savings.`,
        metadata: { monthKey, carry }, push: { data: { kind: 'notification', notifType: 'savings_carry' }, collapseKey: `carry:${monthKey}` },
      })
      carried++
    }
    if (settings.length < PAGE) break
  }

  return NextResponse.json({ ok: true, scanned, carried })
}
