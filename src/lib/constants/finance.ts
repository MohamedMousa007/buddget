import type { Currency, DebtCurrency, ExpenseCategory, PaymentMethodType } from '@/lib/store/types'

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
  'Enjoyment',
  'Savings',
  'Debt',
  'Remittance',
  'Other',
]

/**
 * Categories allowed when adding or normally editing an expense.
 * Savings is managed via the Savings page and dashboard card, not as spending.
 */
export const EXPENSE_ENTRY_CATEGORIES: ExpenseCategory[] = EXPENSE_CATEGORIES.filter((c) => c !== 'Savings')

/**
 * Chip list for add/edit forms. Includes Savings only when the row is already Savings (legacy), so users can reclassify.
 */
export function expenseCategoryOptionsForForm(currentCategory: ExpenseCategory): ExpenseCategory[] {
  return currentCategory === 'Savings' ? EXPENSE_CATEGORIES : EXPENSE_ENTRY_CATEGORIES
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
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'card_debit', label: 'Debit Card' },
  { value: 'card_credit', label: 'Credit Card' },
  { value: 'nol', label: 'Nol Card' },
  { value: 'other', label: 'Other' },
]

/** For AI coercion / validation (order matches PaymentMethodType union). */
export const PAYMENT_METHOD_TYPES: PaymentMethodType[] = [
  'cash',
  'bank_transfer',
  'card_debit',
  'card_credit',
  'nol',
  'other',
]
