import type {
  AppSettings,
  BudgetCategory,
  Debt,
  IncomeSource,
  PaymentMethod,
  UserProfile,
  ExpenseCategory,
} from './types'

/** Standard category rows — amounts start at 0 until the user sets budgets in Settings. */
const BUDGET_CATEGORY_ORDER: ExpenseCategory[] = [
  'Rent',
  'Transport',
  'Food',
  'Enjoyment',
  'Savings',
  'Debt',
  'Remittance',
  'Other',
]

export const DEFAULT_BUDGET: BudgetCategory[] = BUDGET_CATEGORY_ORDER.map((category) => ({
  category,
  budgetedAmount: 0,
  currency: 'USD',
}))

/** One default method so “add expense” always has a valid payment method. */
export const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: 'pm_default_cash',
    name: 'Cash',
    type: 'cash',
    currency: 'USD',
    color: '#A3A3A3',
    isDefault: true,
  },
]

export const DEFAULT_INCOME: IncomeSource[] = []
export const DEFAULT_DEBTS: Debt[] = []

export const DEFAULT_SETTINGS: AppSettings = {
  baseCurrency: 'USD',
  secondaryCurrency: null,
  showSecondaryCurrency: false,
  theme: 'dark',
  language: 'en',
  showCentsInDashboard: true,
  monthStartDay: 1,
  budgetEntryMode: 'amount',
  enableAI: false,
  aiProvider: 'gemini',
  noIncomeDeclared: false,
  showAllCurrenciesInForms: true,
}

export const DEFAULT_PROFILE: UserProfile = {
  id: 'local',
  name: '',
  baseCurrency: 'USD',
  createdAt: new Date().toISOString(),
}

/** FX / gold defaults for conversions and Settings display (not user-specific). */
export const DEFAULT_MARKET_RATES: Record<string, number> = {
  USD_AED: 3.6725,
  EGP_AED: 0.0731,
  EUR_AED: 4.02,
  GBP_AED: 4.65,
  SAR_AED: 0.98,
}

export const DEFAULT_GOLD_PRICE_PER_GRAM = 349.8
