import type { Goal, SavingsAccount, SavingsTransaction } from '@/lib/store/types'
import { LABEL_SOURCES } from '@/lib/accounts/balance'
import { partId, type PartOwner } from './partId'

/**
 * Labels (LOGIC_SPEC §3.3, I-4): savings rows that change a part and never an account. Every label has no
 * `paymentMethodId`, no `transferGroupId`, `isCashFlow: false` and an `idempotencyKey`; its id IS that key, so a sync
 * upsert retried after a lost response writes the same row again instead of tripping the (user, part, key) index.
 */
export type LabelSource = 'set_aside' | 'opening' | 'move_in' | 'move_out' | 'month_end' | 'month_end_undo' | 'release' | 'spent' | 'close'

const DEPOSIT_SOURCES: ReadonlySet<LabelSource> = new Set(['set_aside', 'opening', 'move_in', 'month_end'])

export const isLabel = (t: Pick<SavingsTransaction, 'source'>): boolean => !!t.source && LABEL_SOURCES.has(t.source)

/**
 * Rows that count as this month's saving (or un-saving) for the flow readers: real cash-flow rows, plus `set_aside`
 * and `spent` labels (savedNet, §4.3). Release, opening, moves, month-end and close are never counted.
 */
export const isCountedSavingsFlow = (t: Pick<SavingsTransaction, 'isCashFlow' | 'source'>): boolean =>
  t.source === 'set_aside' || t.source === 'spent' || (t.isCashFlow !== false && !isLabel(t))

export interface LabelOpts {
  /** The write's idempotency key, which is also the row id. A fresh one per user action. */
  key: string
  date: string
  occurredAt: string
  notes?: string
  pairId?: string
  isAutoSave?: boolean
}

export function labelRow(part: Pick<SavingsAccount, 'id' | 'currency'>, source: LabelSource, amount: number, o: LabelOpts): SavingsTransaction {
  return {
    id: o.key,
    idempotencyKey: o.key,
    accountId: part.id,
    type: DEPOSIT_SOURCES.has(source) ? 'deposit' : 'withdrawal',
    amount,
    currency: part.currency,
    date: o.date,
    occurredAt: o.occurredAt,
    source,
    isCashFlow: false,
    ...(o.notes ? { notes: o.notes } : {}),
    ...(o.pairId ? { pairId: o.pairId } : {}),
    ...(o.isAutoSave ? { isAutoSave: true } : {}),
  }
}

/** A withdrawal label is refused above the part's balance (the 0356 clamp is only the server's backstop). */
const fits = (part: Pick<SavingsAccount, 'currentBalance'>, amount: number, eps = 0.005) => amount > 0 && amount <= part.currentBalance + eps

export const setAside = (part: Pick<SavingsAccount, 'id' | 'currency'>, amount: number, o: LabelOpts) => labelRow(part, 'set_aside', amount, o)
export const opening = (part: Pick<SavingsAccount, 'id' | 'currency'>, amount: number, o: LabelOpts) => labelRow(part, 'opening', amount, o)

/** Release (§4.6): back to Free to spend, in the same account. Not counted in savedNet. Null when it does not fit. */
export function release(part: Pick<SavingsAccount, 'id' | 'currency' | 'currentBalance'>, amount: number, o: LabelOpts): SavingsTransaction | null {
  return fits(part, amount) ? labelRow(part, 'release', amount, o) : null
}

/** I spent it (§4.6): the money already left; counted −savedNet. Null when it does not fit. */
export function spent(part: Pick<SavingsAccount, 'id' | 'currency' | 'currentBalance'>, amount: number, o: LabelOpts): SavingsTransaction | null {
  return fits(part, amount) ? labelRow(part, 'spent', amount, o) : null
}

/** The owner of a goal or Monthly savings part; null for a pocket (which moves whole, {@link movePocket}). */
export function ownerOf(part: Pick<SavingsAccount, 'goalId' | 'isMonthlySavings'>, userId: string): PartOwner | null {
  if (part.goalId) return { goalId: part.goalId }
  if (part.isMonthlySavings) return { monthlySavingsOf: userId }
  return null
}

/** The owner's live part in `accountId`, whatever its id (legacy parts predate {@link partId}). */
export function ownerPartIn(parts: readonly SavingsAccount[], owner: PartOwner, accountId: string): SavingsAccount | undefined {
  return parts.find((p) => p.heldInPaymentMethodId === accountId && ('goalId' in owner ? p.goalId === owner.goalId : !!p.isMonthlySavings))
}

/**
 * moveAmount (§4.7): `amt` of a goal or Monthly savings part `p` now sits in account B as `amtB` (B's currency).
 * `p` keeps its home (held_in is never updated) and stays at 0 if emptied. `q` is the owner's part in B, else a new one
 * with the deterministic {@link partId}. Null when `amt` does not fit `p` or `p` is a pocket.
 */
export function moveAmount(
  parts: readonly SavingsAccount[],
  p: SavingsAccount,
  b: { id: string; currency: SavingsAccount['currency'] },
  amt: number,
  amtB: number,
  userId: string,
  o: { outKey: string; inKey: string; pairId: string; date: string; occurredAt: string; createdAt: string },
): { newPart?: SavingsAccount; rows: [SavingsTransaction, SavingsTransaction] } | null {
  const owner = ownerOf(p, userId)
  if (!owner || !fits(p, amt) || !(amtB > 0) || p.heldInPaymentMethodId === b.id) return null
  const existing = ownerPartIn(parts, owner, b.id)
  const newPart: SavingsAccount | undefined = existing
    ? undefined
    : {
        id: partId(owner, b.id), name: p.name, category: p.category, type: p.type, icon: p.icon, color: p.color,
        currency: b.currency, currentBalance: 0, heldInPaymentMethodId: b.id, createdAt: o.createdAt,
        ...('goalId' in owner ? { goalId: owner.goalId } : { isMonthlySavings: true }),
      }
  const q = existing ?? newPart!
  const at = { date: o.date, occurredAt: o.occurredAt, pairId: o.pairId }
  return {
    ...(newPart ? { newPart } : {}),
    rows: [labelRow(p, 'move_out', amt, { ...at, key: o.outKey }), labelRow(q, 'move_in', amtB, { ...at, key: o.inKey })],
  }
}

/**
 * movePocket (§4.7): a pocket keeps one home, so it moves whole: a new row in B copying its look, with a `move_in` of
 * everything (converted to B's currency). The caller removes the old row the way a pocket delete does.
 */
export function movePocket(
  p: SavingsAccount,
  b: { id: string; currency: SavingsAccount['currency'] },
  amountInB: number,
  o: { newId: string; inKey: string; pairId: string; date: string; occurredAt: string; createdAt: string },
): { newPocket: SavingsAccount; row: SavingsTransaction } | null {
  if (p.goalId || p.isMonthlySavings || !(p.currentBalance > 0) || !(amountInB > 0)) return null
  const newPocket: SavingsAccount = {
    ...p, id: o.newId, currency: b.currency, currentBalance: amountInB, heldInPaymentMethodId: b.id, createdAt: o.createdAt, updatedAt: undefined,
  }
  return { newPocket, row: labelRow(newPocket, 'move_in', amountInB, { key: o.inKey, pairId: o.pairId, date: o.date, occurredAt: o.occurredAt }) }
}

/**
 * Shortfall uncover order in one account (§4.2): Monthly savings → pockets (newest first) → goal parts, least important
 * goal first (highest priority number) → achieved goals last.
 */
export function uncoverOrder(parts: readonly SavingsAccount[], accountId: string, goals: readonly Pick<Goal, 'id' | 'priority' | 'status'>[]): SavingsAccount[] {
  const goalOf = new Map(goals.map((g) => [g.id, g]))
  const rank = (p: SavingsAccount): [number, number] => {
    if (p.isMonthlySavings) return [0, 0]
    const g = p.goalId ? goalOf.get(p.goalId) : undefined
    if (!p.goalId || !g) return [1, -new Date(p.createdAt).getTime()]
    if (g.status === 'achieved') return [3, -g.priority]
    return [2, -g.priority]
  }
  return parts
    .filter((p) => p.heldInPaymentMethodId === accountId)
    .map((p) => ({ p, r: rank(p) }))
    .sort((x, y) => x.r[0] - y.r[0] || x.r[1] - y.r[1] || x.p.id.localeCompare(y.p.id))
    .map((x) => x.p)
}

/** covered(p) (§4.2): what of each part the account still holds, uncovering `short` in {@link uncoverOrder}. */
export function covered(ordered: readonly SavingsAccount[], short: number): Map<string, number> {
  let s = Math.max(0, short)
  const out = new Map<string, number>()
  for (const p of ordered) {
    const u = Math.min(s, Math.max(0, p.currentBalance))
    s -= u
    out.set(p.id, p.currentBalance - u)
  }
  return out
}
