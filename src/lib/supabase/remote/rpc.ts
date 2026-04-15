import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type {
  Subscription,
  RecurringExpense,
  IncomeSource,
  Debt,
  DebtPayment,
  Expense,
  Currency,
} from '@/lib/store/types'

import { subscriptionToRow } from './mappers/subscriptionMapper'
import { recurringExpenseToRow } from './mappers/recurringExpenseMapper'
import { incomeSourceToRow } from './mappers/incomeSourceMapper'
import { debtToRow } from './mappers/debtMapper'
import { debtPaymentToRow } from './mappers/debtPaymentMapper'
import { expenseToRow } from './mappers/expenseMapper'

type Client = SupabaseClient<Database>

function unwrap<T>(res: { data: T | null; error: { message: string } | null }, label: string): T {
  if (res.error) throw new Error(`${label}: ${res.error.message}`)
  if (res.data == null) throw new Error(`${label}: no data returned`)
  return res.data
}

// ─────────────────────────────────────────────────────────────────
// Savings: deposit / withdraw / correct
// ─────────────────────────────────────────────────────────────────
export async function depositToSavingsRpc(
  client: Client,
  params: {
    account_id: string
    amount: number
    currency: Currency
    notes?: string | null
    date?: string | null
    transaction_id?: string | null
  }
): Promise<string> {
  const res = await client.rpc('deposit_to_savings', {
    p_account_id: params.account_id,
    p_amount: params.amount,
    p_currency: params.currency,
    p_notes: params.notes ?? undefined,
    p_date: params.date ?? undefined,
    p_transaction_id: params.transaction_id ?? undefined,
  })
  return unwrap(res, 'deposit_to_savings') as string
}

export async function withdrawFromSavingsRpc(
  client: Client,
  params: {
    account_id: string
    amount: number
    currency: Currency
    notes?: string | null
    date?: string | null
    transaction_id?: string | null
  }
): Promise<string> {
  const res = await client.rpc('withdraw_from_savings', {
    p_account_id: params.account_id,
    p_amount: params.amount,
    p_currency: params.currency,
    p_notes: params.notes ?? undefined,
    p_date: params.date ?? undefined,
    p_transaction_id: params.transaction_id ?? undefined,
  })
  return unwrap(res, 'withdraw_from_savings') as string
}

export async function correctSavingsBalanceRpc(
  client: Client,
  params: { account_id: string; new_balance: number; notes?: string | null; transaction_id?: string | null }
): Promise<string> {
  const res = await client.rpc('correct_savings_balance', {
    p_account_id: params.account_id,
    p_new_balance: params.new_balance,
    p_notes: params.notes ?? undefined,
    p_transaction_id: params.transaction_id ?? undefined,
  })
  return unwrap(res, 'correct_savings_balance') as string
}

// ─────────────────────────────────────────────────────────────────
// Subscriptions: add / cancel / reactivate / update
// ─────────────────────────────────────────────────────────────────
export async function addSubscriptionWithRecurringExpenseRpc(
  client: Client,
  userId: string,
  sub: Subscription,
  re: RecurringExpense
): Promise<{ subscription_id: string; recurring_expense_id: string }> {
  const res = await client.rpc('add_subscription_with_recurring_expense', {
    p_subscription: subscriptionToRow(sub, userId) as unknown as Database['public']['Functions']['add_subscription_with_recurring_expense']['Args']['p_subscription'],
    p_recurring_expense: recurringExpenseToRow(re, userId) as unknown as Database['public']['Functions']['add_subscription_with_recurring_expense']['Args']['p_recurring_expense'],
  })
  return unwrap(res, 'add_subscription_with_recurring_expense') as { subscription_id: string; recurring_expense_id: string }
}

export async function cancelSubscriptionRpc(client: Client, subscriptionId: string): Promise<void> {
  const res = await client.rpc('cancel_subscription', { p_subscription_id: subscriptionId })
  if (res.error) throw new Error(`cancel_subscription: ${res.error.message}`)
}

export async function reactivateSubscriptionRpc(client: Client, subscriptionId: string): Promise<void> {
  const res = await client.rpc('reactivate_subscription', { p_subscription_id: subscriptionId })
  if (res.error) throw new Error(`reactivate_subscription: ${res.error.message}`)
}

export async function updateSubscriptionAndReRpc(
  client: Client,
  subscriptionId: string,
  subUpdates: Record<string, unknown>,
  reUpdates: Record<string, unknown>
): Promise<void> {
  const res = await client.rpc('update_subscription_and_re', {
    p_subscription_id: subscriptionId,
    p_subscription_updates: subUpdates as unknown as Database['public']['Functions']['update_subscription_and_re']['Args']['p_subscription_updates'],
    p_recurring_expense_updates: reUpdates as unknown as Database['public']['Functions']['update_subscription_and_re']['Args']['p_recurring_expense_updates'],
  })
  if (res.error) throw new Error(`update_subscription_and_re: ${res.error.message}`)
}

// ─────────────────────────────────────────────────────────────────
// Income + debt atomic
// ─────────────────────────────────────────────────────────────────
export async function addIncomeWithDebtRpc(
  client: Client,
  userId: string,
  income: IncomeSource,
  debt: Debt
): Promise<{ income_id: string; debt_id: string }> {
  const res = await client.rpc('add_income_with_debt', {
    p_income: incomeSourceToRow(income, userId) as unknown as Database['public']['Functions']['add_income_with_debt']['Args']['p_income'],
    p_debt: debtToRow(debt, userId) as unknown as Database['public']['Functions']['add_income_with_debt']['Args']['p_debt'],
  })
  return unwrap(res, 'add_income_with_debt') as { income_id: string; debt_id: string }
}

export async function addDebtPaymentWithExpenseRpc(
  client: Client,
  userId: string,
  payment: DebtPayment,
  expense: Expense
): Promise<{ debt_payment_id: string; expense_id: string }> {
  const res = await client.rpc('add_debt_payment_with_expense', {
    p_payment: debtPaymentToRow(payment, userId) as unknown as Database['public']['Functions']['add_debt_payment_with_expense']['Args']['p_payment'],
    p_expense: expenseToRow(expense, userId) as unknown as Database['public']['Functions']['add_debt_payment_with_expense']['Args']['p_expense'],
  })
  return unwrap(res, 'add_debt_payment_with_expense') as { debt_payment_id: string; expense_id: string }
}
