/**
 * GET /api/cron/month-carry  (daily — NOT YET SCHEDULED)
 *
 * Sweeps each user's real month-end surplus into savings once their cycle has closed (F2).
 * income − spend − allocated, floored at 0, posted as a normal deposit dated to the closed month's
 * last day, into the resolved destination pocket. Closed cycles with no savings_month_summary row are
 * caught up, so a missed run only delays the carry. Idempotent per (user, month_key). Fails closed:
 * with no live FX rates, or a currency that cannot be converted, nothing is posted. Push-only
 * notification, no in-app card, no undo.
 *
 * ⚠️ WRITES LIVE MONEY. Deliberately absent from vercel.json — enable only after a preview-env dry
 * run and explicit sign-off. Auth: `Authorization: Bearer ${CRON_SECRET}`.
 */
import { depositToPocket, primaryTrackedAccountId } from '@/lib/server/pocketLedger'
import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { isAuthorizedCron } from '@/lib/server/cronAuth'
import { DEFAULT_USER_TIME_ZONE, isValidTimeZone } from '@/lib/server/userTimeZone'
import { pendingCarryKeys, cycleRange } from '@/lib/savings/carryDateLogic'
import { computeMonthCarry, resolveCarryDestination } from '@/lib/savings/monthCarry'
import { cycleCarryFigures } from '@/lib/savings/cycleCarryFigures'
import { savingsAccountFromRow } from '@/lib/supabase/remote/mappers/savingsAccountMapper'
import { goalFromRow } from '@/lib/supabase/remote/mappers/goalMapper'
import { expenseFromRow } from '@/lib/supabase/remote/mappers/expenseMapper'
import { incomeEventFromRow } from '@/lib/supabase/remote/mappers/incomeEventMapper'
import { incomeSourceFromRow } from '@/lib/supabase/remote/mappers/incomeSourceMapper'
import { convertCurrency } from '@/lib/utils/currency'
import { allocateGoalFunding } from '@/lib/server/allocateGoalFunding'
import { emitNotification } from '@/lib/server/emitNotification'
import { getServerDictionary } from '@/lib/i18n/getServerDictionary'
import { renderServerCopy } from '@/lib/notifications/serverCopy'
import { goalMilestoneAlert, renderGoalAlert } from '@/lib/notifications/evaluateGoalAlerts'
import type { Currency, SavingsAccount } from '@/lib/store/types'

type Service = ReturnType<typeof createServiceRoleClient>
type Rates = Record<string, number>
interface UserSettingsRow { user_id: unknown; month_start_day: unknown; language: unknown; goal_progress_alerts: unknown; timezone: unknown }

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

const userZone = (tz: unknown) => (typeof tz === 'string' && isValidTimeZone(tz) ? tz : DEFAULT_USER_TIME_ZONE)

const ROWS_PER_REQUEST = 1000

/** Reads every row of a query: PostgREST caps one response at 1000 rows, so a long cycle would otherwise be summed short. */
async function allRows<Row>(
  build: () => { order: (col: string) => { range: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }> } },
  what: string,
): Promise<Row[]> {
  const out: Row[] = []
  for (let from = 0; ; from += ROWS_PER_REQUEST) {
    const { data, error } = await build().order('id').range(from, from + ROWS_PER_REQUEST - 1)
    if (error) throw new Error(`${what}: ${error.message}`)
    out.push(...(data ?? []))
    if ((data?.length ?? 0) < ROWS_PER_REQUEST) return out
  }
}

const must = <T extends { error: { message: string } | null }>(r: T, what: string): T => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`)
  return r
}

/** Carries one closed cycle for one user. Returns true when money moved or the cycle was recorded as empty. */
async function carryCycle(service: Service, s: UserSettingsRow, monthKey: string, rates: Rates, now: Date): Promise<boolean> {
  const userId = s.user_id as string
  const monthStartDay = (s.month_start_day as number | null) ?? 1
  const { start, end } = cycleRange(monthKey, monthStartDay)
  const startISO = start.toISOString().slice(0, 10)
  const endISO = end.toISOString().slice(0, 10)
  const inWindow = (col: string) => `and(${col}.gte.${startISO},${col}.lt.${endISO})`

  const [profileR, accountRows, goalRows, expenseRows, eventRows, sourceRows, txRows] = await Promise.all([
    service.from('profiles').select('default_carry_pocket_id, created_at, base_currency').eq('id', userId).maybeSingle(),
    allRows(() => service.from('savings_accounts').select('*').eq('user_id', userId).is('deleted_at', null), 'accounts'),
    allRows(() => service.from('goals').select('*').eq('user_id', userId).is('deleted_at', null), 'goals'),
    allRows(() => service.from('expenses').select('*').eq('user_id', userId).gte('expense_date', startISO).lt('expense_date', endISO).is('deleted_at', null), 'expenses'),
    allRows(() => service.from('income_events').select('*').eq('user_id', userId).or(`${inWindow('received_date')},${inWindow('occurrence_date')}`).is('deleted_at', null), 'income events'),
    allRows(() => service.from('income_sources').select('*').eq('user_id', userId).is('deleted_at', null), 'income sources'),
    allRows(() => service.from('savings_transactions').select('id, amount, currency, kind, is_cash_flow, transaction_date, source').eq('user_id', userId).gte('transaction_date', startISO).lt('transaction_date', endISO).is('deleted_at', null), 'savings transactions'),
  ])
  must(profileR, 'profile')

  // First partial cycle: an account created after the cycle started shouldn't carry a full month.
  const createdAt = profileR.data?.created_at ? new Date(profileR.data.created_at as string) : null
  if (createdAt && createdAt > start) return false

  const base = ((profileR.data?.base_currency as string | null) ?? 'EGP') as Currency
  const accounts: SavingsAccount[] = accountRows.map(savingsAccountFromRow)
  const savingsPockets = accounts.filter((a) => a.category === 'savings')
  const goals = goalRows.map(goalFromRow)
  // Resolve destination (default fiat pocket → active goal's pocket → the vault).
  const dest = resolveCarryDestination(profileR.data?.default_carry_pocket_id as string | null, savingsPockets, goals.filter((g) => g.fundingMode === 'manual'))
  const destCurrency = dest.kind === 'pocket' ? (accounts.find((a) => a.id === dest.pocketId)?.currency ?? base) : base

  const figures = cycleCarryFigures({
    monthKey, monthStartDay, base, rates,
    expenses: expenseRows.map(expenseFromRow),
    incomeEvents: eventRows.map(incomeEventFromRow),
    incomeSources: sourceRows.map(incomeSourceFromRow),
    deposits: txRows.map((t) => ({
      amount: Number(t.amount) || 0, currency: t.currency as string, kind: t.kind as string, isCashFlow: t.is_cash_flow as boolean | null, source: t.source as string | null,
    })),
    extraCurrencies: [destCurrency],
  })
  if (!figures) {
    console.error('[cron/month-carry] no FX path, skipped', userId, monthKey)
    return false
  }
  const { income, spend, allocated } = figures
  const { carry, saved } = computeMonthCarry({ income, spend, allocated })

  const postDate = new Date(end.getTime() - 24 * 3600 * 1000).toISOString().slice(0, 10)
  // Funded goals draw first (priority order); the rest is unassigned and stays free.
  const dict = getServerDictionary(s.language as string | null)
  const celebrate = (s.goal_progress_alerts as boolean | null) ?? true
  const remainder = await allocateGoalFunding({
    service, userId, monthKey, carry, base, rates, goals, accounts, postDate,
    onCheckpoint: async (goal, pct, saved) => {
      if (pct >= 100) must(await service.from('goals').update({ status: 'achieved', achieved_at: now.toISOString() }).eq('id', goal.id), 'goal achieved')
      if (!celebrate) return
      const a = goalMilestoneAlert(goal, pct, saved)
      const { title, body } = renderGoalAlert(dict, a)
      await emitNotification(service, {
        userId, category: a.type, severity: a.severity, dedupeKey: a.dedupeKey, title, body, metadata: { goalId: goal.id },
        push: { data: { kind: 'notification', notifType: a.type }, collapseKey: a.dedupeKey.slice(0, 60) },
      })
    },
  })
  if (remainder < 0.01) {
    // Nothing to sweep, but record the closed cycle so it isn't reconsidered.
    must(await service.from('savings_month_summary').insert({ user_id: userId, month_key: monthKey, target: 0, allocated, carry, saved, currency: base, closed_at: now.toISOString() }), 'summary')
    return true
  }

  const primaryId = await primaryTrackedAccountId(service, userId)
  let pocketId: string
  if (dest.kind === 'pocket') {
    pocketId = dest.pocketId
  } else {
    const name = dest.kind === 'create-goal-pocket' ? dest.name : 'Monthly Savings'
    const { data: created } = must(await service.from('savings_accounts').insert({
      user_id: userId, name, category: 'savings', type: 'vault', currency: base, current_balance: 0, opening_balance: 0, is_emergency_cover: false, held_in_payment_method_id: primaryId,
    }).select('id').single(), 'create pocket')
    pocketId = created!.id as string
    if (dest.kind === 'create-vault') must(await service.from('profiles').update({ default_carry_pocket_id: pocketId }).eq('id', userId), 'default pocket')
  }

  // Post the carry: a real deposit dated to the closed month's last day.
  const carryInPocketCcy = convertCurrency(remainder, base, destCurrency, rates)
  // A rerun after a crash must not sweep twice: the deposit's note is unique per cycle.
  const alreadySwept = must(await service
    .from('savings_transactions').select('id').eq('user_id', userId).eq('source', 'carry')
    .eq('notes', `Month-end carry · ${monthKey}`).is('deleted_at', null).limit(1).maybeSingle(), 'dedupe check').data
  if (!alreadySwept) {
    await depositToPocket(service, {
      userId, pocketId, amount: carryInPocketCcy, date: postDate, source: 'carry',
      note: `Month-end carry · ${monthKey}`, key: `month-carry|${userId}|${monthKey}`, accountId: primaryId,
    })
  }

  must(await service.from('savings_month_summary').insert({
    user_id: userId, month_key: monthKey, target: 0, allocated, carry, saved, currency: base, pocket_id: pocketId, closed_at: now.toISOString(),
  }), 'summary')

  await emitNotification(service, {
    userId, category: 'savings_carry', severity: 'success', dedupeKey: `carry:${monthKey}`,
    ...renderServerCopy(dict, { kind: 'carry', amount: remainder, currency: base }),
    metadata: { monthKey, carry }, push: { data: { kind: 'notification', notifType: 'savings_carry' }, collapseKey: `carry:${monthKey}` },
  })
  return true
}

async function carryUser(service: Service, s: UserSettingsRow, rates: Rates, now: Date): Promise<number> {
  const userId = s.user_id as string
  const latest = must(await service
    .from('savings_month_summary').select('month_key').eq('user_id', userId).order('month_key', { ascending: false }).limit(1).maybeSingle(), 'latest summary').data
  const keys = pendingCarryKeys(now, (s.month_start_day as number | null) ?? 1, (latest?.month_key as string | undefined) ?? null, userZone(s.timezone))
  let carried = 0
  for (const key of keys) {
    if (await carryCycle(service, s, key, rates, now)) carried++
    else break // a skipped cycle blocks later ones, so they stay ordered
  }
  return carried
}

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rates = await fetchRates()
  if (Object.keys(rates).length === 0) {
    console.error('[cron/month-carry] FX rates unavailable, aborting')
    return NextResponse.json({ error: 'FX rates unavailable' }, { status: 503 })
  }

  const now = new Date()
  const service = createServiceRoleClient()
  let carried = 0
  let scanned = 0
  let failed = 0
  let cursor = ''

  for (;;) {
    let query = service
      .from('user_settings')
      .select('user_id, month_start_day, language, goal_progress_alerts, timezone')
      .order('user_id', { ascending: true })
      .limit(PAGE)
    if (cursor) query = query.gt('user_id', cursor)
    const { data: settings, error } = await query
    if (error) {
      console.error('[cron/month-carry] user_settings query failed', error)
      return NextResponse.json({ ok: false, scanned, carried, failed, error: 'user_settings query failed' }, { status: 500 })
    }
    if (!settings || settings.length === 0) break

    for (const s of settings) {
      scanned++
      try {
        carried += await carryUser(service, s, rates, now)
      } catch (e) {
        failed++
        console.error('[cron/month-carry] user failed', s.user_id, e instanceof Error ? e.message : e)
      }
    }
    cursor = settings[settings.length - 1]!.user_id as string
    if (settings.length < PAGE) break
  }

  return NextResponse.json({ ok: failed === 0, scanned, carried, failed })
}
