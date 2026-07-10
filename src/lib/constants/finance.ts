import type { Currency, DebtCurrency, ExpenseCategory, PaymentMethodType } from '@/lib/store/types'
import { isNonSpendCategory } from '@/lib/constants/categoryMeta'

/** Fiat currencies only (expenses, income, savings, payment methods, sidebar base currency). */
export const FIAT_CURRENCIES: Currency[] = [
  'AED',
  'USD',
  'EGP',
  'EUR',
  'GBP',
  'SAR',
  'KWD',
  'QAR',
  'BHD',
  'OMR',
  'MAD',
  'TND',
  'JOD',
]

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Rent',
  'Transport',
  'Food',
  'Groceries',
  'Fuel',
  'Enjoyment',
  'Shopping',
  'Health',
  'Education',
  'Utilities',
  'Subscription',
  'Debt',
  'Remittance',
  'Savings',
  'Other',
  // Non-spend money-movement categories (system-assigned, excluded from spend).
  'ATM Cash Withdrawal',
  'Transfer',
  'Currency Exchange',
  'CC Payoff',
  'Top up',
  'Installment',
]

/**
 * Categories allowed when adding or normally editing an expense.
 * Excludes Savings (managed via the Savings page) and the non-spend money-movement
 * categories (system-assigned by SMS tracking), per {@link isNonSpendCategory}.
 */
export const EXPENSE_ENTRY_CATEGORIES: ExpenseCategory[] = EXPENSE_CATEGORIES.filter(
  (c) => !isNonSpendCategory(c),
)

/**
 * Chip list for add/edit forms. Includes the row's current category when it is a
 * system/non-spend one (e.g. an SMS-classified Transfer), so users can reclassify.
 */
export function expenseCategoryOptionsForForm(currentCategory: ExpenseCategory): ExpenseCategory[] {
  return isNonSpendCategory(currentCategory)
    ? [currentCategory, ...EXPENSE_ENTRY_CATEGORIES]
    : EXPENSE_ENTRY_CATEGORIES
}

/** Filter dropdown: All + every expense category. */
export const EXPENSE_FILTER_CATEGORIES: (ExpenseCategory | 'All')[] = [
  'All',
  ...EXPENSE_CATEGORIES,
]

export const DEBT_CURRENCIES: DebtCurrency[] = ['EGP', 'AED', 'USD', 'EUR', 'XAU']

/** Non-gold debt currency options (fiat subset in debt order). */
export const DEBT_FIAT_CURRENCIES: DebtCurrency[] = DEBT_CURRENCIES.filter((c) => c !== 'XAU')

export const PAYMENT_METHOD_TYPE_OPTIONS: { value: PaymentMethodType; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_account', label: 'Bank account' },
  { value: 'debit_card', label: 'Debit card' },
  { value: 'credit_card', label: 'Credit card' },
  { value: 'prepaid_card', label: 'Prepaid card' },
  { value: 'wallet', label: 'Wallet' },
  { value: 'bnpl', label: 'BNPL' },
  { value: 'other', label: 'Other' },
]

/** For AI coercion / validation (order matches PaymentMethodType union). */
export const PAYMENT_METHOD_TYPES: PaymentMethodType[] = [
  'cash',
  'bank_account',
  'debit_card',
  'credit_card',
  'prepaid_card',
  'wallet',
  'bnpl',
  'other',
]
