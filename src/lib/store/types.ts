export type Currency = 'AED' | 'USD' | 'EGP' | 'EUR' | 'GBP' | 'SAR' | 'XAU'

export type ExpenseCategory =
  | 'Rent'
  | 'Transport'
  | 'Food'
  | 'Enjoyment'
  | 'Savings'
  | 'Debt'
  | 'Remittance'
  | 'Other'

export type PaymentMethodType = 'cash' | 'bank_transfer' | 'card_debit' | 'card_credit' | 'nol' | 'other'

export interface PaymentMethod {
  id: string
  name: string
  type: PaymentMethodType
  currency: Currency
  color?: string
  icon?: string
  last4?: string
  isDefault: boolean
}

/** How often recurring income is received; amount is per that period (e.g. weekly = per week). */
export type IncomeRecurringFrequency = 'monthly' | 'biweekly' | 'weekly'

export interface IncomeSource {
  id: string
  name: string
  amount: number
  currency: Currency
  isRecurring: boolean
  /** When recurring: monthly = per month, biweekly = per paycheck, weekly = per week. Defaults to monthly if omitted. */
  recurringFrequency?: IncomeRecurringFrequency
  dayOfMonth?: number
  notes?: string
  createdAt: string
}

export interface Expense {
  id: string
  date: string
  description: string
  category: ExpenseCategory
  amount: number
  currency: Currency
  amountInBaseCurrency: number
  paymentMethodId: string
  isRecurring: boolean
  recurringId?: string
  notes?: string
  tags?: string[]
  createdAt: string
  updatedAt: string
}

export interface RecurringExpense {
  id: string
  description: string
  category: ExpenseCategory
  amount: number
  currency: Currency
  paymentMethodId: string
  dayOfMonth: number
  isActive: boolean
  notes?: string
}

export interface BudgetCategory {
  category: ExpenseCategory
  budgetedAmount: number
  currency: Currency
  /** When using % of income mode, 0–100 */
  percentOfIncome?: number | null
  notes?: string
}

export type SavingsBucket = 'liquid' | 'investment'

export type SavingsSubtype =
  | 'bank'
  | 'cash'
  | 'gold'
  | 'stocks'
  | 'crypto'
  | 'real_estate'
  | 'other'

export interface SavingsHolding {
  id: string
  name: string
  bucket: SavingsBucket
  subtype: SavingsSubtype
  amount: number
  currency: Currency
  notes?: string
  asOfDate?: string
  createdAt: string
  updatedAt: string
}

export type DebtCurrency = 'EGP' | 'XAU' | Currency

export type GoldKarat = 24 | 22 | 21 | 18

export interface Debt {
  id: string
  name: string
  person: string
  description?: string
  startingBalance: number
  currency: DebtCurrency
  isGold: boolean
  goldKarat?: GoldKarat
  notes?: string
  createdAt: string
}

export interface DebtPayment {
  id: string
  debtId: string
  date: string
  amountPaid: number
  paymentCurrency?: string
  originalAmount?: number
  amountInPrimary?: number
  rateAtEntry?: number
  notes?: string
  createdAt: string
}

export type DebtRecurringFrequency = 'monthly' | 'biweekly' | 'weekly'

/** Template: when `nextDueDate` is on or before today, a payment + Debt expense are posted and the date advances. */
export interface RecurringDebtPayment {
  id: string
  debtId: string
  amount: number
  currency: Currency
  paymentMethodId: string
  frequency: DebtRecurringFrequency
  /** Next calendar due date (YYYY-MM-DD, local). */
  nextDueDate: string
  isActive: boolean
  notes?: string
  createdAt: string
}

export interface UserProfile {
  id: string
  name: string
  email?: string
  avatar?: string
  baseCurrency: Currency
  createdAt: string
}

export interface AppSettings {
  baseCurrency: Currency
  secondaryCurrency: Currency | null
  showSecondaryCurrency: boolean
  theme: 'dark' | 'light' | 'system'
  language: 'en' | 'ar'
  showCentsInDashboard: boolean
  monthStartDay: number
  /** Budget rows as fixed amounts in base currency vs % of monthly recurring income */
  budgetEntryMode: 'amount' | 'percent_of_income'
  /** AI chat / extraction (optional client preference; server may still gate by env) */
  enableAI: boolean
  /** Gemini is configured with server-side GEMINI_API_KEY only (never stored in the client). */
  aiProvider: 'gemini'
  /**
   * Set during onboarding when the user has no income yet. Income- and %-of-income budget
   * KPIs stay at 0 until they add an income source (which clears this flag).
   */
  noIncomeDeclared: boolean
}

export interface FinanceStore {
  profile: UserProfile
  settings: AppSettings
  incomeSources: IncomeSource[]
  expenses: Expense[]
  recurringExpenses: RecurringExpense[]
  budgetCategories: BudgetCategory[]
  savingsHoldings: SavingsHolding[]
  paymentMethods: PaymentMethod[]
  debts: Debt[]
  debtPayments: DebtPayment[]
  recurringDebtPayments: RecurringDebtPayment[]
  exchangeRates: Record<string, number>
  goldPricePerGram: number
  lastRatesFetch: string | null

  /** `amountInBaseCurrency` is computed in the store from rates + base currency. */
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'amountInBaseCurrency'>) => void
  updateExpense: (id: string, updates: Partial<Expense>) => void
  deleteExpense: (id: string) => void
  addIncomeSource: (source: Omit<IncomeSource, 'id' | 'createdAt'>) => void
  updateIncomeSource: (id: string, updates: Partial<IncomeSource>) => void
  deleteIncomeSource: (id: string) => void
  addPaymentMethod: (method: Omit<PaymentMethod, 'id'>) => void
  updatePaymentMethod: (id: string, updates: Partial<PaymentMethod>) => void
  deletePaymentMethod: (id: string) => void
  addDebt: (debt: Omit<Debt, 'id' | 'createdAt'>) => void
  updateDebt: (id: string, updates: Partial<Debt>) => void
  addDebtPayment: (payment: Omit<DebtPayment, 'id' | 'createdAt'>) => void
  deleteDebt: (id: string) => void
  deleteDebtPayment: (id: string) => void
  addRecurringDebtPayment: (r: Omit<RecurringDebtPayment, 'id' | 'createdAt'>) => void
  updateRecurringDebtPayment: (id: string, updates: Partial<RecurringDebtPayment>) => void
  deleteRecurringDebtPayment: (id: string) => void
  addRecurringExpense: (expense: Omit<RecurringExpense, 'id'>) => void
  updateRecurringExpense: (id: string, updates: Partial<RecurringExpense>) => void
  deleteRecurringExpense: (id: string) => void
  updateBudgetCategory: (category: ExpenseCategory, amount: number, percentOfIncome?: number | null) => void
  /** Replace all budget rows (e.g. onboarding preset). */
  setBudgetCategories: (categories: BudgetCategory[]) => void
  addSavingsHolding: (h: Omit<SavingsHolding, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateSavingsHolding: (id: string, updates: Partial<SavingsHolding>) => void
  deleteSavingsHolding: (id: string) => void
  updateSettings: (updates: Partial<AppSettings>) => void
  updateProfile: (updates: Partial<UserProfile>) => void
  updateRates: (rates: Record<string, number>) => void
  updateGoldPrice: (price: number) => void
  /** @throws Error on invalid JSON or failed Zod validation (message is user-facing). */
  importData: (data: string) => void
  exportData: () => string
  resetAllData: () => void
}
