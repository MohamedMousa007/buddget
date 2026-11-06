const BALANCE_KEY = /^(bal|balance|balances|net_worth|networth|current_balance|currentBalance|free|held|total_savings|total_investments|accounts_total|opening_balance|savings_total|debt_remaining|value|savings|investments|debt|month_flow|owe|owedToYou|owed_to_you|left|left_to_spend|paid|each|limit|target|saved|need_mo|outstanding)$|_balance$/i
/** Spending and income figures the NOW context also hides; masked in tool results only when `withFlow` is set (the Buddgy mask). */
const FLOW_KEY = /^(income|spent|budget|cap|net_cash_flow|safe_daily|projected_spend)$/i
export const HIDDEN = '[hidden by the user]'

/** Replaces numeric balance-bearing fields (booleans and text such as paid:true stay readable) in a tool result before the model sees it. Spending and income are left alone unless `withFlow` is set. */
export function redactBalances<T>(value: T, withFlow = false): T {
  if (Array.isArray(value)) return value.map((v) => redactBalances(v, withFlow)) as unknown as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, (BALANCE_KEY.test(k) || (withFlow && FLOW_KEY.test(k))) && typeof v === 'number' ? HIDDEN : redactBalances(v, withFlow)]),
    ) as T
  }
  return value
}
