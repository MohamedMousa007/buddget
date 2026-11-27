import type { Goal, PaymentMethod, SavingsAccount, SavingsTransaction } from '@/lib/store/types'
import { minorUnit, type AccountBalance } from '@/lib/accounts/balance'
import { canHoldParts } from '@/lib/accounts/kinds'
import { partsOfGoal } from '@/lib/goals/computeGoalProgress'
import { partId } from '@/lib/savings/partId'

/**
 * Month-end placement (LOGIC_SPEC §4.4), pure and shared by the API route, the cron and the tests: caps per account,
 * the split, fill order, and the two apply passes. Every amount named `…Base` is in the base currency; `amount` and
 * `room` are in the account's (= the part's) currency.
 */

export interface SplitEntry {
  target_id: string
  pct: number
}

export type TargetRef = { kind: 'goal'; id: string } | { kind: 'pocket'; id: string } | { kind: 'ms' }

export interface PlanLine {
  target: TargetRef
  partId: string
  accountId: string
  currency: string
  amount: number
  amountBase: number
  /** No live part yet: apply creates it with `partId`. */
  isNew: boolean
}

export interface PlanAccount {
  id: string
  currency: string
  /** max(0, min(free at cycle end, free now)), account currency. */
  cap: number
}

export interface PlanContext {
  userId: string
  base: string
  /** At the rates in use (C.rates at propose, rates_apply at apply). */
  convert: (amount: number, from: string, to: string) => number | null
  accounts: readonly PlanAccount[]
  parts: readonly SavingsAccount[]
  goals: readonly Goal[]
  /** Goal progress in the goal's currency (§4.5). */
  progress: (goal: Goal) => number
}

export interface Cut {
  target: TargetRef
  accountId: string
  amountBase: number
}

const EPS = 0.01
const cents = (n: number) => Math.round(n * 100) / 100
const roundIn = (n: number, currency: string) => Math.round(n * minorUnit(currency)) / minorUnit(currency)
const sameTarget = (a: TargetRef, b: TargetRef) => a.kind === b.kind && (a.kind === 'ms' || (b.kind !== 'ms' && a.id === b.id))

// ---------------------------------------------------------------- the split

/** A stored split, read: entries kept as written while Σ ≤ 100; above, each is scaled down to 0.01 and `over` is set (T38). */
export function readSplit(raw: unknown): { entries: SplitEntry[]; over: boolean } {
  const entries = (Array.isArray(raw) ? raw : []).filter(
    (e): e is SplitEntry => !!e && typeof e.target_id === 'string' && typeof e.pct === 'number' && Number.isFinite(e.pct) && e.pct > 0,
  )
  const sum = entries.reduce((s, e) => s + e.pct, 0)
  if (sum <= 100 + 1e-9) return { entries: entries.map((e) => ({ target_id: e.target_id, pct: e.pct })), over: false }
  return { entries: entries.map((e) => ({ target_id: e.target_id, pct: Math.floor(((e.pct * 100) / sum) * 100 + 1e-9) / 100 })), over: true }
}

/** The one writer check: distinct targets, each 0 < pct ≤ 100 in steps of 0.01, Σ ≤ 100 (the rest goes to Monthly savings). */
export function validateSplit(raw: unknown): { ok: true; entries: SplitEntry[] } | { ok: false; reason: 'invalid' | 'over' } {
  if (!Array.isArray(raw) || raw.length > 50) return { ok: false, reason: 'invalid' }
  const seen = new Set<string>()
  const entries: SplitEntry[] = []
  for (const e of raw) {
    const id = e?.target_id
    const pct = e?.pct
    if (typeof id !== 'string' || !id || seen.has(id) || typeof pct !== 'number' || !Number.isFinite(pct) || pct <= 0 || pct > 100) return { ok: false, reason: 'invalid' }
    if (Math.abs(pct * 100 - Math.round(pct * 100)) > 1e-6) return { ok: false, reason: 'invalid' }
    seen.add(id)
    entries.push({ target_id: id, pct })
  }
  if (entries.reduce((s, e) => s + e.pct, 0) > 100 + 1e-9) return { ok: false, reason: 'over' }
  return { ok: true, entries }
}

const isSavingsGoal = (g: Goal) => g.category !== 'debt_freedom' && g.category !== 'spending_control'
const isPocket = (p: SavingsAccount) => p.category === 'savings' && !p.goalId && !p.isMonthlySavings

/** The live goal or pocket an entry points at; null = its share goes to Monthly savings (achieved, paused, deleted). */
export function splitTarget(id: string, ctx: Pick<PlanContext, 'goals' | 'parts'>): TargetRef | null {
  const g = ctx.goals.find((x) => x.id === id)
  if (g) return g.status === 'active' && isSavingsGoal(g) ? { kind: 'goal', id } : null
  const p = ctx.parts.find((x) => x.id === id)
  return p && isPocket(p) ? { kind: 'pocket', id } : null
}

/** split(amount): each live target's share, a goal's capped at what it still needs; the rest is Monthly savings'. */
export function splitWants(amountBase: number, entries: readonly SplitEntry[], ctx: PlanContext): { wants: { target: TargetRef; want: number }[]; rest: number } {
  const wants: { target: TargetRef; want: number }[] = []
  for (const e of entries) {
    const target = splitTarget(e.target_id, ctx)
    if (!target) continue
    let want = cents((amountBase * e.pct) / 100)
    if (target.kind === 'goal') {
      const g = ctx.goals.find((x) => x.id === target.id)!
      if (g.targetAmount != null) {
        const need = ctx.convert(Math.max(0, g.targetAmount - ctx.progress(g)), g.currency, ctx.base)
        if (need != null) want = Math.min(want, cents(need))
      }
    }
    if (want > 0) wants.push({ target, want })
  }
  return { wants, rest: cents(amountBase - wants.reduce((s, w) => s + w.want, 0)) }
}

// ---------------------------------------------------------------- fill

type Room = Map<string, { currency: string; room: number }>

const roomOf = (accounts: readonly PlanAccount[]): Room => new Map(accounts.map((a) => [a.id, { currency: a.currency, room: Math.max(0, a.cap) }]))

function ownedParts(target: TargetRef, ctx: PlanContext): SavingsAccount[] {
  if (target.kind === 'ms') return ctx.parts.filter((p) => p.isMonthlySavings)
  if (target.kind === 'pocket') return ctx.parts.filter((p) => p.id === target.id)
  const g = ctx.goals.find((x) => x.id === target.id)
  return g ? partsOfGoal(g, ctx.parts) : []
}

/**
 * fill(target, want): a pocket only into its home (the rest is returned as overflow for Monthly savings); a goal or
 * Monthly savings into its existing parts by remaining cap, largest first, then into the other accounts the same way.
 * `room` is drawn down. Returns the lines and what fitted nowhere (base).
 */
export function fill(target: TargetRef, wantBase: number, room: Room, ctx: PlanContext): { lines: PlanLine[]; left: number } {
  const lines: PlanLine[] = []
  let left = cents(wantBase)
  const owned = ownedParts(target, ctx)
  const roomBase = (id: string) => {
    const r = room.get(id)
    return r ? cents(ctx.convert(r.room, r.currency, ctx.base) ?? 0) : 0
  }
  const take = (accountId: string, existing: SavingsAccount | undefined) => {
    const r = room.get(accountId)
    const capBase = roomBase(accountId)
    if (!r || left <= 0 || capBase <= 0) return
    const takeBase = Math.min(left, capBase)
    const amount = takeBase === capBase ? r.room : Math.min(r.room, roundIn(ctx.convert(takeBase, ctx.base, r.currency) ?? 0, r.currency))
    if (!(amount > 0)) return
    r.room = roundIn(r.room - amount, r.currency)
    left = cents(left - takeBase)
    const owner = target.kind === 'goal' ? { goalId: target.id } : { monthlySavingsOf: ctx.userId }
    lines.push({
      target, accountId, currency: r.currency, amount, amountBase: cents(takeBase),
      partId: existing?.id ?? partId(owner, accountId), isNew: !existing,
    })
  }

  if (target.kind === 'pocket') {
    const home = owned[0]?.heldInPaymentMethodId
    if (home) take(home, owned[0])
    return { lines, left }
  }
  const byRoom = (ids: string[]) => ids.map((id, i) => ({ id, i, r: roomBase(id) })).sort((a, b) => b.r - a.r || a.i - b.i).map((x) => x.id)
  const homes = new Map(owned.filter((p) => p.heldInPaymentMethodId && room.has(p.heldInPaymentMethodId)).map((p) => [p.heldInPaymentMethodId!, p]))
  for (const id of byRoom([...homes.keys()])) take(id, homes.get(id))
  for (const id of byRoom([...room.keys()].filter((id) => !homes.has(id)))) take(id, undefined)
  return { lines, left }
}

/** Fills each want in order; pocket overflow joins Monthly savings, which fills last. */
function fillAll(wants: { target: TargetRef; want: number }[], msWant: number, room: Room, ctx: PlanContext): { lines: PlanLine[]; unplaced: number } {
  const lines: PlanLine[] = []
  let ms = msWant
  let unplaced = 0
  for (const w of wants) {
    const r = fill(w.target, w.want, room, ctx)
    lines.push(...r.lines)
    if (w.target.kind === 'pocket') ms = cents(ms + r.left)
    else unplaced = cents(unplaced + r.left)
  }
  const r = fill({ kind: 'ms' }, ms, room, ctx)
  return { lines: [...lines, ...r.lines], unplaced: cents(unplaced + r.left) }
}

// ---------------------------------------------------------------- propose and apply

/** caps(A) = max(0, min(free(A, C.end), free(A, now))) for every account that can hold parts (I-7). */
export function capsOf(atEnd: ReadonlyMap<string, AccountBalance>, now: ReadonlyMap<string, AccountBalance>, methods: readonly PaymentMethod[]): PlanAccount[] {
  return methods.filter((m) => canHoldParts(m)).map((m) => {
    const end = atEnd.get(m.id)
    const cur = now.get(m.id)
    return { id: m.id, currency: String(m.currency), cap: end && cur ? Math.max(0, Math.min(end.free, cur.free)) : 0 }
  })
}

export interface Proposal {
  placeable: number
  notPlaced: number
  lines: PlanLine[]
}

/** placeable = min(leftover, Σ caps); lines = split(placeable) filled; not placed = the rest (§4.4). */
export function propose(leftoverBase: number, entries: readonly SplitEntry[], ctx: PlanContext): Proposal {
  if (!(leftoverBase > 0)) return { placeable: 0, notPlaced: 0, lines: [] }
  const capTotal = cents(ctx.accounts.reduce((s, a) => s + (ctx.convert(Math.max(0, a.cap), a.currency, ctx.base) ?? 0), 0))
  const placeable = cents(Math.min(leftoverBase, capTotal))
  const { wants, rest } = splitWants(placeable, entries, ctx)
  const { lines, unplaced } = fillAll(wants, rest, roomOf(ctx.accounts), ctx)
  return { placeable, notPlaced: cents(leftoverBase - placeable + unplaced), lines: mergeLines(lines) }
}

/**
 * apply (§4.4): each proposed line is re-converted from `amountBase` at the apply rates (amount_base wins, N1); pass 1
 * keeps what fits its account's cap now, in order (a line in an account that can no longer hold parts keeps nothing);
 * pass 2 re-fills the cuts with fill(). A line whose goal is no longer active, or whose pocket is gone, is cut whole and
 * its share goes to Monthly savings, as split() would send it. `capped` records every cut.
 */
export function applyPasses(proposed: readonly PlanLine[], ctx: PlanContext): { lines: PlanLine[]; capped: Cut[]; notPlaced: number } {
  const room = roomOf(ctx.accounts)
  const kept: PlanLine[] = []
  const capped: Cut[] = []
  for (const line of proposed) {
    // A gone target, or a pocket that moved to another account since the proposal: its share goes to Monthly savings.
    const pocketMoved = line.target.kind === 'pocket' && ctx.parts.find((p) => p.id === line.partId)?.heldInPaymentMethodId !== line.accountId
    if (line.target.kind !== 'ms' && (!splitTarget(line.target.id, ctx) || pocketMoved)) {
      capped.push({ target: { kind: 'ms' }, accountId: line.accountId, amountBase: line.amountBase })
      continue
    }
    const r = room.get(line.accountId)
    const amount = r ? roundIn(ctx.convert(line.amountBase, ctx.base, r.currency) ?? 0, r.currency) : 0
    const keep = r ? Math.min(amount, r.room) : 0
    const keepBase = keep === amount ? line.amountBase : cents(ctx.convert(keep, r!.currency, ctx.base) ?? 0)
    if (keep > 0) {
      r!.room = roundIn(r!.room - keep, r!.currency)
      kept.push({ ...line, amount: keep, amountBase: keepBase })
    }
    const cut = cents(line.amountBase - (keep > 0 ? keepBase : 0))
    if (cut > 0) capped.push({ target: line.target, accountId: line.accountId, amountBase: cut })
  }
  const wants: { target: TargetRef; want: number }[] = []
  let ms = 0
  for (const c of capped) {
    if (c.target.kind === 'ms') { ms = cents(ms + c.amountBase); continue }
    const w = wants.find((x) => sameTarget(x.target, c.target))
    if (w) w.want = cents(w.want + c.amountBase)
    else wants.push({ target: c.target, want: c.amountBase })
  }
  const refill = capped.length ? fillAll(wants, ms, room, ctx) : { lines: [], unplaced: 0 }
  return { lines: mergeLines([...kept, ...refill.lines]), capped, notPlaced: refill.unplaced }
}

/** One line per part (one month-end label per part: its key is md5(summary id : part id)). */
export function mergeLines(lines: readonly PlanLine[]): PlanLine[] {
  const out: PlanLine[] = []
  for (const l of lines) {
    const same = out.find((x) => x.partId === l.partId)
    if (same) {
      same.amount = roundIn(same.amount + l.amount, same.currency)
      same.amountBase = cents(same.amountBase + l.amountBase)
    } else out.push({ ...l })
  }
  return out
}

/** Goals the lines bring to their target (apply marks them achieved and lists them in `achieved_by_proposal`). */
export function completedGoals(lines: readonly PlanLine[], ctx: PlanContext): string[] {
  const ids = [...new Set(lines.flatMap((l) => (l.target.kind === 'goal' ? [l.target.id] : [])))]
  return ids.filter((id) => {
    const g = ctx.goals.find((x) => x.id === id)
    if (!g || g.status !== 'active' || g.targetAmount == null || g.targetAmount <= 0) return false
    const addBase = lines.filter((l) => l.target.kind === 'goal' && l.target.id === id).reduce((s, l) => s + l.amountBase, 0)
    const add = ctx.convert(addBase, ctx.base, g.currency)
    return add != null && ctx.progress(g) + add + EPS >= g.targetAmount
  })
}

// ---------------------------------------------------------------- undo

/** Undo takes back min(line amount, part balance) per line; the rest is reported "not undone (already released)" (T34). */
export function undoAmounts(applied: readonly Pick<PlanLine, 'partId' | 'amount' | 'currency'>[], balances: ReadonlyMap<string, number>): { partId: string; withdraw: number; notUndone: number }[] {
  const left = new Map(balances)
  return applied.map((l) => {
    const bal = Math.max(0, left.get(l.partId) ?? 0)
    const withdraw = roundIn(Math.min(l.amount, bal), l.currency)
    left.set(l.partId, roundIn(bal - withdraw, l.currency))
    return { partId: l.partId, withdraw, notUndone: roundIn(l.amount - withdraw, l.currency) }
  })
}

/** Undo is disabled once a shortfall or closing answer (`spent`, `move_out`, `close`) touched an applied part after the apply (N3). */
export function undoBlocked(appliedPartIds: readonly string[], appliedAt: string, txs: readonly SavingsTransaction[]): boolean {
  const parts = new Set(appliedPartIds)
  const after = Date.parse(appliedAt)
  return txs.some((t) => parts.has(t.accountId) && (t.source === 'spent' || t.source === 'move_out' || t.source === 'close') && Date.parse(t.createdAt ?? t.occurredAt ?? t.date) > after)
}
