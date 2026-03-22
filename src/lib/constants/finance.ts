import type { Currency, DebtCurrency, ExpenseCategory, PaymentMethodType } from '@/lib/store/types'

/** Fiat currencies only (expenses, income, savings, payment methods, sidebar base currency). */
export const FIAT_CURRENCIES: Currency[] = ['AED', 'USD', 'EGP', 'EUR', 'GBP', 'SAR']

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
