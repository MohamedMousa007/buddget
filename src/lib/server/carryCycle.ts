import type { createServiceRoleClient } from '@/lib/supabase/service'
import { cycleRange } from '@/lib/savings/carryDateLogic'
import { carryDrift, resolveCarryDestination, type CarryDestination, type CarryDrift } from '@/lib/savings/monthCarry'
import { cycleCarryFigures, type CycleCarryFigures } from '@/lib/savings/cycleCarryFigures'
import { savingsAccountFromRow } from '@/lib/supabase/remote/mappers/savingsAccountMapper'
import { goalFromRow } from '@/lib/supabase/remote/mappers/goalMapper'
import { expenseFromRow } from '@/lib/supabase/remote/mappers/expenseMapper'
import { incomeEventFromRow } from '@/lib/supabase/remote/mappers/incomeEventMapper'
import { incomeSourceFromRow } from '@/lib/supabase/remote/mappers/incomeSourceMapper'
import type { Currency, Goal, SavingsAccount } from '@/lib/store/types'

type Service = ReturnType<typeof createServiceRoleClient>

const ROWS_PER_REQUEST = 1000
/** Closed cycles looked back at for drift. */
const DRIFT_CYCLES = 3

export async function fetchRates(): Promise<Record<string, number>> {
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

/** Reads every row of a query: PostgREST caps one response at 1000 rows, so a long cycle would otherwise be summed short. */
export async function allRows<Row>(
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

export const must = <T extends { error: { message: string } | null }>(r: T, what: string): T => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`)
  return r
}

export interface CycleContext {
  monthKey: string
  start: Date
  end: Date
  base: Currency
  profileCreatedAt: Date | null
  defaultCarryPocketId: string | null
  accounts: SavingsAccount[]
  savingsPockets: SavingsAccount[]
  goals: Goal[]
  dest: CarryDestination
  destCurrency: Currency
  figures: CycleCarryFigures | null
}

/** Loads one cycle's rows for one user and computes its carry figures: the single path the cron and the drift check share. */
export async function loadCycle(service: Service, userId: string, monthKey: string, monthStartDay: number, rates: Record<string, number>): Promise<CycleContext> {
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

  const createdAt = profileR.data?.created_at ? new Date(profileR.data.created_at as string) : null
  const base = ((profileR.data?.base_currency as string | null) ?? 'EGP') as Currency
  const defaultCarryPocketId = (profileR.data?.default_carry_pocket_id as string | null) ?? null
  const accounts: SavingsAccount[] = accountRows.map(savingsAccountFromRow)
  const savingsPockets = accounts.filter((a) => a.category === 'savings')
  const goals = goalRows.map(goalFromRow)
  // Resolve destination (default fiat pocket → active goal's pocket → the vault).
  const dest = resolveCarryDestination(defaultCarryPocketId, savingsPockets, goals)
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
  return { monthKey, start, end, base, profileCreatedAt: createdAt, defaultCarryPocketId, accounts, savingsPockets, goals, dest, destCurrency, figures }
}

export interface CycleDriftItem extends CarryDrift {
  monthKey: string
  currency: Currency
  carry: number
  adjustment: number
  pocketId: string | null
}

/** Date a cycle's carry (and any later adjustment of it) is booked on: the cycle's last day. */
export const carryPostDate = (end: Date) => new Date(end.getTime() - 24 * 3600 * 1000).toISOString().slice(0, 10)

/**
 * Was any money row of the cycle written after the carry was last settled? Deleted rows count (a delete is a change); the
 * summary's own updated_at moves when an adjustment is applied, so a settled month reads as unchanged.
 * ponytail: a row moved out of the cycle by a date edit is not seen here; upgrade path is a change log.
 */
async function rowsChangedSince(service: Service, userId: string, ctx: CycleContext, settledAt: string): Promise<boolean> {
  const startISO = ctx.start.toISOString().slice(0, 10)
  const endISO = ctx.end.toISOString().slice(0, 10)
  const inWindow = (col: string) => `and(${col}.gte.${startISO},${col}.lt.${endISO})`
  const expenses = must(await service.from('expenses').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('expense_date', startISO).lt('expense_date', endISO).gt('updated_at', settledAt), 'changed expenses')
  if ((expenses.count ?? 0) > 0) return true
  const events = must(await service.from('income_events').select('id', { count: 'exact', head: true }).eq('user_id', userId).or(`${inWindow('received_date')},${inWindow('occurrence_date')}`).gt('updated_at', settledAt), 'changed income events')
  return (events.count ?? 0) > 0
}

/**
 * Drift of a user's last closed cycles that have a summary row, newest first. A cycle is left out when its figures
 * cannot be priced or when the user's base currency changed since it closed (its amounts would not be comparable).
 * `before` limits it to cycles older than that key; `monthKey` to that one cycle.
 */
export async function closedCycleDrift(
  service: Service, userId: string, monthStartDay: number, rates: Record<string, number>, opts: { before?: string; monthKey?: string } = {},
): Promise<{ item: CycleDriftItem; ctx: CycleContext }[]> {
  let q = service.from('savings_month_summary').select('month_key, carry, carry_adjustment, pocket_id, currency, updated_at, closed_at').eq('user_id', userId)
  if (opts.monthKey) q = q.eq('month_key', opts.monthKey)
  if (opts.before) q = q.lt('month_key', opts.before)
  const rows = must(await q.order('month_key', { ascending: false }).limit(DRIFT_CYCLES), 'summaries').data ?? []
  const out: { item: CycleDriftItem; ctx: CycleContext }[] = []
  for (const r of rows) {
    const ctx = await loadCycle(service, userId, r.month_key as string, monthStartDay, rates)
    if (!ctx.figures || r.currency !== ctx.base) continue
    const carry = Number(r.carry) || 0
    const adjustment = Number(r.carry_adjustment) || 0
    let drift = carryDrift({ carry, carry_adjustment: adjustment }, ctx.figures)
    if (drift.stale && !(await rowsChangedSince(service, userId, ctx, (r.updated_at ?? r.closed_at) as string))) drift = carryDrift({ carry, carry_adjustment: adjustment }, ctx.figures, false)
    out.push({
      ctx,
      item: { ...drift, monthKey: r.month_key as string, currency: ctx.base, carry, adjustment, pocketId: (r.pocket_id as string | null) ?? null },
    })
  }
  return out
}
