import type { Database } from '@/lib/supabase/database.types'

/** Convenience row-type aliases for every public table. Insert / Row / Update all imported here. */

type Tables = Database['public']['Tables']

export type ProfileRow = Tables['profiles']['Row']
export type ProfileInsert = Tables['profiles']['Insert']
export type ProfileUpdate = Tables['profiles']['Update']

export type UserSettingsRow = Tables['user_settings']['Row']
export type UserSettingsInsert = Tables['user_settings']['Insert']

export type PaymentMethodRow = Tables['payment_methods']['Row']
export type PaymentMethodInsert = Tables['payment_methods']['Insert']

export type IncomeSourceRow = Tables['income_sources']['Row']
export type IncomeSourceInsert = Tables['income_sources']['Insert']

export type IncomeEventRow = Tables['income_events']['Row']
export type IncomeEventInsert = Tables['income_events']['Insert']

export type ExpenseRow = Tables['expenses']['Row']
export type ExpenseInsert = Tables['expenses']['Insert']

export type ReceiptRow = Tables['receipts']['Row']
export type ReceiptInsert = Tables['receipts']['Insert']

export type RecurringExpenseRow = Tables['recurring_expenses']['Row']
export type RecurringExpenseInsert = Tables['recurring_expenses']['Insert']

export type SubscriptionRow = Tables['subscriptions']['Row']
export type SubscriptionInsert = Tables['subscriptions']['Insert']

export type DebtRow = Tables['debts']['Row']
export type DebtInsert = Tables['debts']['Insert']

export type DebtPaymentRow = Tables['debt_payments']['Row']
export type DebtPaymentInsert = Tables['debt_payments']['Insert']

export type RecurringDebtPaymentRow = Tables['recurring_debt_payments']['Row']
export type RecurringDebtPaymentInsert = Tables['recurring_debt_payments']['Insert']

export type SavingsAccountRow = Tables['savings_accounts']['Row']
export type SavingsAccountInsert = Tables['savings_accounts']['Insert']

export type SavingsHoldingRow = Tables['savings_holdings']['Row']
export type SavingsHoldingInsert = Tables['savings_holdings']['Insert']

export type SavingsTransactionRow = Tables['savings_transactions']['Row']
export type SavingsTransactionInsert = Tables['savings_transactions']['Insert']

export type RecurringSavingsDepositRow = Tables['recurring_savings_deposits']['Row']
export type RecurringSavingsDepositInsert = Tables['recurring_savings_deposits']['Insert']

export type GoalRow = Tables['goals']['Row']
export type GoalInsert = Tables['goals']['Insert']

export type BudgetPlanRow = Tables['budget_plans']['Row']
export type BudgetPlanInsert = Tables['budget_plans']['Insert']

export type BudgetCategoryRow = Tables['budget_categories']['Row']
export type BudgetCategoryInsert = Tables['budget_categories']['Insert']

export type BudgetSubcategoryRow = Tables['budget_subcategories']['Row']
export type BudgetSubcategoryInsert = Tables['budget_subcategories']['Insert']

export type NotificationRow = Tables['notifications']['Row']
export type NotificationInsert = Tables['notifications']['Insert']

/** Any domain item we sync has a stable id. */
export interface HasId {
  id: string
}
