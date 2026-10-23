import type { Expense, PaymentMethod } from '@/lib/store/types'

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
