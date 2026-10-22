import type { PaymentMethod } from '@/lib/store/types'
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
