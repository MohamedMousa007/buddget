import type { createServiceRoleClient } from '@/lib/supabase/service'
import type { Json } from '@/lib/supabase/database.types'
import { canHoldParts } from '@/lib/accounts/kinds'
import { tryConvertCurrency } from '@/lib/utils/currency'
import { dueCycle, legacyCycle, localDay, startOfDayIn, type Cycle } from '@/lib/savings/carryDateLogic'
import { leftover, type LeftoverFigures, type SummaryWindow } from '@/lib/monthEnd/leftover'
import { heldByAccount, planContext, ratesConverter, type BaseRates } from '@/lib/monthEnd/context'
import { applyPasses, completedGoals, propose, readSplit, undoBlocked, validateSplit, type Cut, type PlanLine, type SplitEntry } from '@/lib/monthEnd/proposal'
import { dueUsers, loadMonthEndLedger, must, type DueUser, type MonthEndLedger, type SummaryRow } from './monthEndLedger'

/**
 * The month-end card's server side (LOGIC_SPEC §4.4): propose on the first open after a cycle ends (or the cron),
 * re-propose a pending card when the split or an account changed, apply on Confirm (or the cron after 72 h), undo.
 * Placement is the pure code in `@/lib/monthEnd`; every money write is one SQL transaction (0362).
 */

type Service = ReturnType<typeof createServiceRoleClient>

const AUTO_APPLY_MS = 72 * 3600 * 1000
const COLS = 'id, user_id, month_key, status, version, cycle_start, cycle_end, currency, rates, rates_apply, figures, lines, applied_lines, capped, held_snapshot, auto_apply_at, applied_at, applied_by, undone_at, achieved_by_proposal, created_at'

export interface MonthEndFigures extends LeftoverFigures {
  placeable: number
  notPlaced: number
  caps: { accountId: string; currency: string; cap: number }[]
  /** A closed month with nothing to show: a first partial month, or one that could not be figured. */
  reason?: 'first_partial' | 'unpriced' | 'truncated'
}

export interface MonthEndLineView {
  kind: 'goal' | 'pocket' | 'ms'
  targetId: string | null
  partId: string
  accountId: string
  currency: string
  amount: number
  amountBase: number
}

export interface MonthEndView {
  id: string
  version: number
  status: 'empty' | 'proposed' | 'applied' | 'undone'
  cycleStart: string
  cycleEnd: string
  currency: string
  figures: MonthEndFigures
  /** The proposal while proposed; what was set aside once applied. */
  lines: MonthEndLineView[]
  autoApplyAt: string | null
  appliedAt: string | null
  appliedBy: string | null
  /** N3: a shortfall answer used money this month-end set aside. */
  undoBlocked: boolean
}

// ---------------------------------------------------------------- rows

const lineJson = (l: PlanLine, completes = false) => ({
  kind: l.target.kind, target_id: l.target.kind === 'ms' ? null : l.target.id, part_id: l.partId, account_id: l.accountId,
  currency: l.currency, amount: l.amount, amount_base: l.amountBase, is_new: l.isNew, ...(completes ? { completes_goal: true } : {}),
})
const cutJson = (c: Cut) => ({ kind: c.target.kind, target_id: c.target.kind === 'ms' ? null : c.target.id, account_id: c.accountId, amount_base: c.amountBase })

type LineJson = ReturnType<typeof lineJson>
const linesOf = (j: unknown): PlanLine[] =>
  ((Array.isArray(j) ? j : []) as LineJson[]).map((x) => ({
    target: x.kind === 'ms' ? { kind: 'ms' } : { kind: x.kind, id: x.target_id! },
    partId: x.part_id, accountId: x.account_id, currency: x.currency, amount: Number(x.amount), amountBase: Number(x.amount_base), isNew: !!x.is_new,
  }))

function view(row: SummaryRow, blocked = false): MonthEndView {
  const status = row.status as MonthEndView['status']
  const lines = linesOf(status === 'applied' || status === 'undone' ? row.applied_lines : row.lines)
  return {
    id: row.id, version: row.version, status, cycleStart: row.cycle_start!, cycleEnd: row.cycle_end!, currency: row.currency,
    figures: row.figures as unknown as MonthEndFigures,
    lines: lines.map((l) => ({ kind: l.target.kind, targetId: l.target.kind === 'ms' ? null : l.target.id, partId: l.partId, accountId: l.accountId, currency: l.currency, amount: l.amount, amountBase: l.amountBase })),
    autoApplyAt: row.auto_apply_at, appliedAt: row.applied_at, appliedBy: row.applied_by,
    undoBlocked: status === 'applied' && blocked,
  }
}

/** N3 for an applied row: one narrow read (savings_transactions_account_id_idx), never the whole ledger. */
async function undoBlockedFor(service: Service, userId: string, row: SummaryRow): Promise<boolean> {
  const parts = linesOf(row.applied_lines).map((l) => l.partId)
  if (row.status !== 'applied' || !row.applied_at || parts.length === 0) return false
  const { data } = must(await service.from('savings_transactions').select('id, account_id, source, created_at, transaction_date')
    .eq('user_id', userId).in('account_id', parts).in('source', ['spent', 'move_out', 'close']).is('deleted_at', null)
    .gt('created_at', row.applied_at).limit(1), 'undo check')
  return undoBlocked(parts, row.applied_at, (data ?? []).map((t) => ({ id: t.id, accountId: t.account_id, source: t.source ?? undefined, createdAt: t.created_at, date: t.transaction_date, type: 'withdrawal', amount: 0, currency: 'EGP' })))
}

/** The card to show: the oldest pending proposal (so none auto-applies unseen), else the newest month-end row. */
async function latestRow(service: Service, userId: string): Promise<SummaryRow | null> {
  const { data: pending } = must(await service.from('savings_month_summary').select(COLS).eq('user_id', userId).eq('status', 'proposed')
    .not('cycle_end', 'is', null).order('cycle_end', { ascending: true }).limit(1).maybeSingle(), 'pending month end')
  if (pending) return pending as SummaryRow
  const { data } = must(await service.from('savings_month_summary').select(COLS).eq('user_id', userId).not('cycle_end', 'is', null)
    .order('cycle_end', { ascending: false }).limit(1).maybeSingle(), 'latest month end')
  return (data as SummaryRow | null) ?? null
}

async function rowById(service: Service, userId: string, id: string): Promise<SummaryRow | null> {
  const { data } = must(await service.from('savings_month_summary').select(COLS).eq('id', id).eq('user_id', userId).maybeSingle(), 'month end row')
  return (data as SummaryRow | null) ?? null
}

// ---------------------------------------------------------------- figures

/** Base-per-unit rates for the accounts and the cycle's own rows; null = one has no live rate. */
function baseRates(L: MonthEndLedger, live: Record<string, number>, cycle: Cycle): BaseRates | null {
  const needed = new Set<string>()
  const inCycle = (d: string) => cycle.start <= d.slice(0, 10) && d.slice(0, 10) < cycle.end
  for (const m of L.ledger.paymentMethods) if (canHoldParts(m)) needed.add(String(m.currency))
  for (const e of L.ledger.expenses) if (inCycle(e.date)) needed.add(e.currency)
  for (const e of L.ledger.incomeEvents) if (inCycle(e.receivedDate)) needed.add(e.currency)
  for (const g of L.goals) if (g.status === 'active') needed.add(g.currency)
  const out: BaseRates = {}
  for (const c of needed) {
    if (c === L.base || c === 'XAU') continue
    const v = tryConvertCurrency(1, c, L.base, live)
    if (v == null || !(v > 0)) return null
    out[c] = Math.round(v * 1e6) / 1e6
  }
  return out
}

function windows(rows: readonly SummaryRow[], startDay: number): SummaryWindow[] {
  return rows.map((r) => ({ ...(r.cycle_start && r.cycle_end ? { start: r.cycle_start, end: r.cycle_end } : legacyCycle(r.month_key, startDay)), createdAt: r.created_at }))
}

function contextFor(L: MonthEndLedger, userId: string, cycle: Cycle, rates: BaseRates, tz: string, now: number) {
  return planContext({ userId, base: L.base, rates, ledger: { ...L.ledger, convert: ratesConverter(rates, L.base) }, goals: L.goals, cycleEnd: startOfDayIn(cycle.end, tz) - 1, now })
}

const capsView = (ctx: ReturnType<typeof contextFor>) => ctx.accounts.map((a) => ({ accountId: a.id, currency: a.currency, cap: a.cap }))

/** The new row for a cycle that just ended: 'empty' (first partial month, or nothing left over) or 'proposed'. */
function draftRow(L: MonthEndLedger, u: DueUser, cycle: Cycle, live: Record<string, number>, now: number) {
  const rates = L.truncated ? null : baseRates(L, live, cycle)
  const common = { user_id: u.userId, month_key: cycle.start, currency: L.base as SummaryRow['currency'], cycle_start: cycle.start, cycle_end: cycle.end, rates: (rates ?? {}) as Json, closed_at: new Date(now).toISOString() }
  const zero = { income: 0, spending: 0, savedNet: 0, unexplainedOut: 0, leftover: 0, placeable: 0, notPlaced: 0, caps: [] }
  // A cycle that cannot be figured is closed as it is (logged), so it never holds the cron's queue; nothing moves.
  if (!rates) {
    console.error('[month-end] cycle not figured', L.truncated ? 'truncated' : 'unpriced', u.userId)
    return { ...common, status: 'empty', figures: { ...zero, reason: L.truncated ? 'truncated' : 'unpriced' } as unknown as Json }
  }
  // An account opened during the cycle has no full month to set aside.
  if (L.profileCreatedAt && localDay(new Date(L.profileCreatedAt), u.timezone) > cycle.start) {
    return { ...common, status: 'empty', figures: { ...zero, reason: 'first_partial' } as unknown as Json }
  }
  const convert = ratesConverter(rates, L.base)
  const figs = leftover({
    cycle, base: L.base, convert, dayOf: (s) => localDay(new Date(s), u.timezone),
    summaries: windows(L.summaries, u.monthStartDay), ledger: { ...L.ledger, convert },
  })
  if (figs.leftover <= 0) return { ...common, status: 'empty', allocated: figs.savedNet, figures: { ...zero, ...figs } as unknown as Json }
  const ctx = contextFor(L, u.userId, cycle, rates, u.timezone, now)
  const plan = propose(figs.leftover, readSplit(L.savingsSplit).entries, ctx)
  return {
    ...common, status: 'proposed', version: 1, allocated: figs.savedNet,
    figures: { ...figs, placeable: plan.placeable, notPlaced: plan.notPlaced, caps: capsView(ctx) } as unknown as Json,
    lines: plan.lines.map((l) => lineJson(l)) as unknown as Json,
    held_snapshot: heldByAccount(L.ledger.savingsAccounts) as Json,
    auto_apply_at: new Date(now + AUTO_APPLY_MS).toISOString(),
  }
}

/** A pending card follows the split and the accounts as they are now (N9, N10); the leftover and auto_apply_at stay. */
async function repropose(service: Service, row: SummaryRow, L: MonthEndLedger, u: DueUser, now: number): Promise<SummaryRow> {
  if (row.status !== 'proposed' || !row.cycle_start || !row.cycle_end) return row
  const rates = (row.rates ?? {}) as BaseRates
  const figs = row.figures as unknown as MonthEndFigures
  const ctx = contextFor(L, u.userId, { start: row.cycle_start, end: row.cycle_end }, rates, u.timezone, now)
  const plan = propose(figs.leftover, readSplit(L.savingsSplit).entries, ctx)
  const lines = plan.lines.map((l) => lineJson(l))
  if (JSON.stringify(lines) === JSON.stringify(row.lines) && plan.notPlaced === figs.notPlaced) return row
  const { data } = must(await service.from('savings_month_summary').update({
    lines: lines as unknown as Json, version: row.version + 1, held_snapshot: heldByAccount(L.ledger.savingsAccounts) as Json,
    figures: { ...figs, placeable: plan.placeable, notPlaced: plan.notPlaced, caps: capsView(ctx) } as unknown as Json,
  }).eq('id', row.id).eq('user_id', u.userId).eq('status', 'proposed').eq('version', row.version).select(COLS).maybeSingle(), 're-propose')
  // Lost the compare-and-set (a confirm or another re-propose won): read what is there now.
  return (data as SummaryRow | null) ?? (await rowById(service, u.userId, row.id)) ?? row
}

// ---------------------------------------------------------------- operations

/**
 * propose (§4.4): creates the card for a cycle that just ended, re-proposes a pending one, and returns the latest. The
 * ledger is read only when a card is created or re-proposed; an applied, empty or undone card is returned as it is.
 */
export async function proposeMonthEnd(service: Service, userId: string, live: Record<string, number>, now = Date.now(), known?: DueUser): Promise<MonthEndView | null> {
  const u = known ?? (await dueUsers(service, { user: userId })).users[0]
  if (!u) return null
  const cycle = !u.due ? null : u.latestEnd ? dueCycle(u.latestEnd, u.monthStartDay, u.today) : u.dueStart && u.dueEnd ? { start: u.dueStart, end: u.dueEnd } : null
  // With no live rates a new card is not drafted (it would close unpriced); a pending one still follows the split.
  if (cycle && Object.keys(live).length > 0) {
    const row = draftRow(await loadMonthEndLedger(service, userId, cycle.start), u, cycle, live, now)
    const { error } = await service.from('savings_month_summary').insert(row)
    // 23505: the cron or another tab wrote this cycle first; the read below returns it.
    if (error && error.code !== '23505') throw new Error(`month end insert: ${error.message}`)
    if (!error) {
      const created = await latestRow(service, userId)
      return created ? view(created) : null
    }
  }
  const latest = await latestRow(service, userId)
  if (!latest || !latest.cycle_start) return null
  if (latest.status === 'proposed') {
    const L = await loadMonthEndLedger(service, userId, latest.cycle_start)
    return view(L.truncated ? latest : await repropose(service, latest, L, u, now))
  }
  return view(latest, await undoBlockedFor(service, userId, latest))
}

/** The same caller's apply already landed (a lost response, a retry); Confirm against the auto-apply stays a conflict (T33). */
const isReplay = (row: SummaryRow, version: number, by: string) => row.status === 'applied' && row.version === version + 1 && row.applied_by === by

export type ApplyOutcome = 'applied' | 'conflict' | 'stale' | 'not_found' | 'no_rates' | 'truncated'

/** apply (§4.4): caps recomputed now, the two passes, then one SQL transaction (CAS on version, held recheck). */
export async function applyMonthEnd(service: Service, userId: string, id: string, version: number, by: 'user' | 'auto', live: Record<string, number>, now = Date.now()): Promise<{ outcome: ApplyOutcome; view: MonthEndView | null }> {
  const row = await rowById(service, userId, id)
  if (!row || !row.cycle_start || !row.cycle_end) return { outcome: 'not_found', view: null }
  if (isReplay(row, version, by)) return { outcome: 'applied', view: view(row) }
  if (row.status !== 'proposed' || row.version !== version) return { outcome: 'conflict', view: view(row) }
  const u = (await dueUsers(service, { user: userId })).users[0]
  const tz = u?.timezone ?? 'Africa/Cairo'
  const cycle = { start: row.cycle_start, end: row.cycle_end }
  let outcome: ApplyOutcome = 'stale'
  // A label that lands between the read and the transaction makes it 'stale': read once more and retry.
  for (let attempt = 0; attempt < 2 && outcome === 'stale'; attempt++) {
    const L = await loadMonthEndLedger(service, userId, row.cycle_start)
    if (L.truncated) return { outcome: 'truncated', view: view(row) }
    const rates = baseRates(L, live, cycle)
    if (!rates) return { outcome: 'no_rates', view: view(row) }
    const ctx = contextFor(L, userId, cycle, rates, tz, now)
    const passes = applyPasses(linesOf(row.lines), ctx)
    const achieved = new Set(completedGoals(passes.lines, ctx))
    const held = heldByAccount(L.ledger.savingsAccounts)
    const { data } = must(await service.rpc('apply_month_end', {
      p_user: userId, p_id: id, p_version: version,
      p_lines: passes.lines.map((l) => lineJson(l, l.target.kind === 'goal' && achieved.has(l.target.id))) as unknown as Json,
      p_held: Object.fromEntries(ctx.accounts.map((a) => [a.id, held[a.id] ?? 0])),
      p_rates: rates as Json, p_capped: passes.capped.map(cutJson) as unknown as Json, p_by: by,
    }), 'apply month end')
    outcome = ((data as { outcome?: ApplyOutcome } | null)?.outcome ?? 'conflict')
  }
  const after = await rowById(service, userId, id)
  if (outcome === 'conflict' && after && isReplay(after, version, by)) outcome = 'applied'
  return { outcome, view: after ? view(after) : null }
}

export interface UndoResult {
  outcome: 'undone' | 'blocked' | 'not_applied' | 'not_found'
  notUndone: { partId: string; amount: number; currency: string }[]
  reverted: string[]
  view: MonthEndView | null
}

/** undo (§4.4): one SQL transaction; a goal this month-end completed goes back to active (§0). */
export async function undoMonthEnd(service: Service, userId: string, id: string): Promise<UndoResult> {
  const { data } = must(await service.rpc('undo_month_end', { p_user: userId, p_id: id }), 'undo month end')
  const r = (data ?? {}) as { outcome?: UndoResult['outcome']; not_undone?: { part_id: string; amount: number; currency: string }[]; reverted?: string[] }
  const row = await rowById(service, userId, id)
  return {
    outcome: r.outcome ?? 'not_found',
    notUndone: (r.not_undone ?? []).map((x) => ({ partId: x.part_id, amount: Number(x.amount), currency: x.currency })),
    reverted: r.reverted ?? [],
    view: row ? view(row) : null,
  }
}

/** The split's only writer: Σ ≤ 100 and every target the user's own live goal or pocket; then the pending card follows it. */
export async function saveSplit(service: Service, userId: string, raw: unknown, live: Record<string, number>, now = Date.now()): Promise<{ ok: true; split: SplitEntry[]; view: MonthEndView | null } | { ok: false; reason: 'invalid' | 'over' }> {
  const v = validateSplit(raw)
  if (!v.ok) return v
  const ids = v.entries.map((e) => e.target_id)
  if (ids.length) {
    const [goals, pockets] = await Promise.all([
      service.from('goals').select('id').eq('user_id', userId).is('deleted_at', null).in('id', ids),
      service.from('savings_accounts').select('id').eq('user_id', userId).is('deleted_at', null).is('goal_id', null).eq('is_monthly_savings', false).eq('category', 'savings').in('id', ids),
    ])
    const known = new Set([...(must(goals, 'split goals').data ?? []), ...(must(pockets, 'split pockets').data ?? [])].map((r) => r.id as string))
    if (ids.some((id) => !known.has(id))) return { ok: false, reason: 'invalid' }
  }
  must(await service.from('profiles').update({ savings_split: v.entries as unknown as Json }).eq('id', userId), 'save split')
  return { ok: true, split: v.entries, view: await proposeMonthEnd(service, userId, live, now) }
}
