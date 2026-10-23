const BALANCE_KEY = /^(bal|balance|balances|net_worth|networth|current_balance|currentBalance|free|held|total_savings|total_investments|accounts_total|opening_balance)$|_balance$/i
export const HIDDEN = '[hidden by the user]'

/** Replaces balance-bearing fields in a tool result before the model sees it. Spending and income are left alone. */
export function redactBalances<T>(value: T): T {
  if (Array.isArray(value)) return value.map(redactBalances) as unknown as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, BALANCE_KEY.test(k) && typeof v !== 'object' ? HIDDEN : redactBalances(v)]),
    ) as T
  }
  return value
}
