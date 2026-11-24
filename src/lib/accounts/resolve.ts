import type { Expense, PaymentMethod } from '@/lib/store/types'
import { DEFAULT_CASH_ID } from '@/lib/store/migrations/v17_uuid_remap'
import { drawsOnParent, holdsBalance } from './kinds'

/**
 * The Cash account: the oldest open real cash method, else the in-store sentinel (which has no opening
 * balance, so it stays untracked). Never use `is_default` — a card can be the default.
 */
export function cashAccountId(methods: readonly PaymentMethod[]): string | undefined {
  const real = methods
    .filter((m) => m.type === 'cash' && m.id !== DEFAULT_CASH_ID && !m.closedAt)
    .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))[0]
  if (real) return real.id
  return methods.some((m) => m.id === DEFAULT_CASH_ID) ? DEFAULT_CASH_ID : undefined
}

/** The id to store for a chosen method: the real Cash account when the choice is the in-store sentinel and one exists. */
export function storedMethodId(id: string, methods: readonly PaymentMethod[]): string {
  return id === DEFAULT_CASH_ID ? (cashAccountId(methods) ?? id) : id
}

/** How far back bank messages count when the default is read from them. */
const SMS_DEFAULT_WINDOW_DAYS = 60

/**
 * The method bank messages book to most (last 60 days; a tie goes to the latest message), among the ones a payment can
 * default to: open, the user's own, confirmed, not BNPL. Null when no message booked to any of them.
 */
function smsDefaultId(methods: readonly PaymentMethod[], expenses: readonly Pick<Expense, 'paymentMethodId' | 'smsLogId' | 'date'>[], now: number): string | null {
  const eligible = new Set(methods.filter((m) => !m.closedAt && !m.excluded && !m.provisional && m.type !== 'bnpl' && m.id !== DEFAULT_CASH_ID).map((m) => m.id))
  const since = new Date(now - SMS_DEFAULT_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10)
  const tally = new Map<string, { count: number; last: string }>()
  for (const e of expenses) {
    if (!e.smsLogId || !e.paymentMethodId || !eligible.has(e.paymentMethodId) || e.date < since) continue
    const t = tally.get(e.paymentMethodId) ?? { count: 0, last: '' }
    tally.set(e.paymentMethodId, { count: t.count + 1, last: e.date > t.last ? e.date : t.last })
  }
  let best: [string, { count: number; last: string }] | null = null
  for (const entry of tally) {
    if (!best || entry[1].count > best[1].count || (entry[1].count === best[1].count && entry[1].last > best[1].last)) best = entry
  }
  return best?.[0] ?? null
}

/**
 * The method a form preselects (BUD-87), never the sentinel once a real Cash exists:
 * 1. the user's choice: an open method marked default (the built-in Cash's seeded mark is not a choice);
 * 2. else the method bank messages book to most, when `expenses` are given;
 * 3. else Cash, tracked or not; 4. else the first open method.
 */
export function defaultMethodId(methods: readonly PaymentMethod[], expenses: readonly Pick<Expense, 'paymentMethodId' | 'smsLogId' | 'date'>[] = [], now = Date.now()): string {
  const open = methods.filter((m) => !m.closedAt)
  const chosen = open.find((m) => m.isDefault && m.id !== DEFAULT_CASH_ID)
  const pick = chosen?.id ?? smsDefaultId(open, expenses, now) ?? cashAccountId(open) ?? open[0]?.id
  return pick ? storedMethodId(pick, methods) : ''
}

/**
 * Which account's balance a payment method moves. null = it moves none
 * (credit card / BNPL / other accrue debt; a debit card with no parent is untracked).
 */
export function resolveAccountId(
  paymentMethodId: string | null | undefined,
  methods: readonly PaymentMethod[],
): string | null {
  if (!paymentMethodId || paymentMethodId === DEFAULT_CASH_ID) return cashAccountId(methods) ?? null
  const pm = methods.find((m) => m.id === paymentMethodId)
  if (!pm) return null
  if (holdsBalance(pm.type)) return pm.id
  if (drawsOnParent(pm.type) && pm.parentId) {
    const parent = methods.find((m) => m.id === pm.parentId)
    return parent && holdsBalance(parent.type) ? parent.id : null
  }
  return null
}
