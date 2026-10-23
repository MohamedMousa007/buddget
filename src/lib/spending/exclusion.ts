import type { Debt, Expense, PaymentMethod } from '@/lib/store/types'

type Methods = readonly Pick<PaymentMethod, 'id' | 'parentId' | 'excluded'>[]

/** A method is left out when it, or the account it hangs under, is. */
export function isMethodExcluded(methods: Methods, id: string | undefined): boolean {
  const m = methods.find((x) => x.id === id)
  if (!m) return false
  if (m.excluded) return true
  return Boolean(m.parentId && methods.find((x) => x.id === m.parentId)?.excluded)
}

/**
 * Re-derives `spendExclusion` for the expenses of every method whose exclusion may have changed. Only what the
 * method itself caused is touched: a row the user left out (`manual`) or paid for someone stays as it is, and a
 * row on a method that is still excluded keeps its flag.
 */
export function applyMethodExclusion(expenses: Expense[], methods: Methods, now: string): Expense[] {
  let changed = false
  const next = expenses.map((e) => {
    const excluded = isMethodExcluded(methods, e.paymentMethodId)
    if (excluded && !e.spendExclusion) {
      changed = true
      return { ...e, spendExclusion: 'method' as const, updatedAt: now }
    }
    if (!excluded && e.spendExclusion === 'method') {
      changed = true
      const { spendExclusion: _drop, ...rest } = e
      return { ...rest, updatedAt: now }
    }
    return e
  })
  return changed ? next : expenses
}

type DebtLike = Pick<Debt, 'id' | 'debtType' | 'linkedPaymentMethodId'>

/** A credit card marked as not counted takes its debt with it. */
const isDebtExcluded = (d: DebtLike, methods: Methods): boolean =>
  d.debtType === 'credit_card' && Boolean(d.linkedPaymentMethodId) && isMethodExcluded(methods, d.linkedPaymentMethodId)

/**
 * One-entry memos keep the result referentially stable between store updates, so a `useShallow` selector that
 * calls these does not re-render on every unrelated change.
 */
let debtsMemo: { debts: readonly unknown[]; methods: Methods; out: unknown[] } | null = null
export function countedDebts<T extends DebtLike>(debts: T[], methods: Methods): T[] {
  if (debtsMemo && debtsMemo.debts === debts && debtsMemo.methods === methods) return debtsMemo.out as T[]
  const out = methods.some((m) => m.excluded) ? debts.filter((d) => !isDebtExcluded(d, methods)) : debts
  debtsMemo = { debts, methods, out }
  return out
}

let paymentsMemo: { payments: readonly unknown[]; debts: readonly unknown[]; methods: Methods; out: unknown[] } | null = null
export function countedDebtPayments<P extends { debtId: string }>(payments: P[], debts: DebtLike[], methods: Methods): P[] {
  if (paymentsMemo && paymentsMemo.payments === payments && paymentsMemo.debts === debts && paymentsMemo.methods === methods) return paymentsMemo.out as P[]
  let out = payments
  if (methods.some((m) => m.excluded)) {
    const hidden = new Set(debts.filter((d) => isDebtExcluded(d, methods)).map((d) => d.id))
    if (hidden.size > 0) out = payments.filter((p) => !hidden.has(p.debtId))
  }
  paymentsMemo = { payments, debts, methods, out }
  return out
}
