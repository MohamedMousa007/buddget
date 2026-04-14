export type Currency =
  | 'AED'
  | 'USD'
  | 'EGP'
  | 'EUR'
  | 'GBP'
  | 'SAR'
  | 'KWD'
  | 'QAR'
  | 'BHD'
  | 'OMR'
  | 'MAD'
  | 'TND'
  | 'JOD'
  | 'XAU'
  /** Savings / ledger only — approximate USD peg for totals when crossing currencies. */
  | 'USDT'
  | 'USDC'
  /** Savings / ledger only — no built-in FX; same-code math only unless rates exist. */
  | 'BTC'
  | 'ETH'

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

export type IncomeSourceType =
  | 'salary'
  | 'bonus'
  | 'side_hustle'
  | 'investment'
  | 'savings'
  | 'debt'
  | 'gift'
  | 'refund'
  | 'other'

export interface IncomeSource {
  id: string
  name: string
  amount: number
  currency: Currency
  /** When set, income is attributed to this shared budget plan. */
  sharedPlanId?: string | null
  isRecurring: boolean
  /** When recurring: monthly = per month, biweekly = per paycheck, weekly = per week. Defaults to monthly if omitted. */
  recurringFrequency?: IncomeRecurringFrequency
  dayOfMonth?: number
  notes?: string
  createdAt: string
  /** Type/source of income. Defaults to `other` for legacy data. */
  sourceType?: IncomeSourceType
  /** When `sourceType` is savings or investment, links to the savings account row. */
  linkedSavingsAccountId?: string
  /** When `sourceType` is debt, links to the auto-created debt row. */
  linkedDebtId?: string
  /** Which of the user's payment methods received this income (optional). */
  paymentMethodId?: string
}

export interface Expense {
  id: string
  date: string
  description: string
  /** Category label — matches a budget plan category name or a legacy `ExpenseCategory` enum value. */
  category: string
  /** Optional subcategory from the active budget plan. */
  subcategory?: string
  amount: number
  currency: Currency
  amountInBaseCurrency: number
  paymentMethodId: string
  isRecurring: boolean
  recurringId?: string
  notes?: string
  tags?: string[]
  /** When set, this expense belongs to a shared household budget plan (`shared_budget_plans.id`). */
  sharedPlanId?: string | null
  /** When set, this expense was created from a debt payment flow. */
  linkedDebtId?: string
  isDebtPayment?: boolean
  createdAt: string
  updatedAt: string
}

export interface RecurringExpense {
  id: string
  description: string
  /** Category label — matches a budget plan category name or a legacy `ExpenseCategory` enum value. */
  category: string
  /** Optional subcategory from the active budget plan. */
  subcategory?: string
  amount: number
  currency: Currency
  paymentMethodId: string
  dayOfMonth: number
  isActive: boolean
  notes?: string
  sharedPlanId?: string | null
}

export interface BudgetCategory {
  category: string
  budgetedAmount: number
  currency: Currency
  /** When using % of income mode, 0–100 */
  percentOfIncome?: number | null
  notes?: string
  /** Optional emoji from Budget Planner when `category` is a custom label */
  icon?: string
}

/** Sub-row under a custom budget plan category (amounts in base currency). */
export interface BudgetPlanSubcategory {
  id: string
  name: string
  amount: number
  /** Optional emoji for custom subcategory rows */
  icon?: string
}

/** Custom category row inside a budget plan (fixed amounts only in the planner UI). */
export interface BudgetPlanCategory {
  id: string
  name: string
  icon: string
  amount: number
  /** Fiat for this row's amounts; omitted legacy rows use base currency. */
  currency?: Currency
  /** When true, this row is a savings allocation target — not counted as a planned expense. */
  isSavings?: boolean
  subcategories: BudgetPlanSubcategory[]
}

/** Who the budget is for (Buddgy Flow). */
export type BudgetHousehold = 'solo' | 'partner' | 'family'

/** Draft fields while running Buddgy Flow (persisted on the plan). */
export interface BuddgyFlowDraft {
  rentIncludesUtilities?: boolean
  dewaMonthly?: number
  transportMode?: 'car' | 'public' | 'walk' | 'mix'
  transportCarMonthly?: number
  transportPublicDaily?: number
  savingsPercent?: number
  /** Prefetched AI rows for step 6 */
  aiSuggestions?: Array<{ name: string; emoji: string; amount: number; currency: Currency }>
  /** User accepted AI rows in step 6 */
  aiFillAccepted?: boolean
  /** User finished summary step (Done) */
  flowFinished?: boolean
}

/** Named budget scenario with its own category tree (persists separately from legacy `budgetCategories`). */
export interface BudgetPlan {
  id: string
  name: string
  categories: BudgetPlanCategory[]
  createdAt: string
  /** Buddgy Flow: household size for AI and sliders. */
  household?: BudgetHousehold | null
  buddgyFlow?: BuddgyFlowDraft | null
  /** User finished Buddgy guided flow (Done). Cleared when rebuilding. */
  buddgyGuidedComplete?: boolean
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

/** High-level savings product; drives default Lucide icon in the UI. */
export type SavingsType =
  | 'bank'
  | 'cash'
  | 'gold'
  | 'stablecoin'
  | 'crypto'
  | 'stocks'
  | 'real_estate'
  | 'other'

/** Safe/liquid vs growth bucket (split in UI and net-worth rollups). */
export type SavingsAccountCategory = 'savings' | 'investment'

/** Savings bucket with ledger balance (transfers, not expenses). */
export interface SavingsAccount {
  id: string
  name: string
  /** Product grouping for net worth (defaults from `type` when omitted). */
  category: SavingsAccountCategory
  type: SavingsType
  /** Lucide icon component name; defaults from `type`, user-pickable when `type === 'other'`. */
  icon?: string
  /** @deprecated Legacy row marker; UI prefers `type` + `icon`. */
  emoji?: string
  /** Reserved for a future Goals feature — not shown in create/card UI. */
  targetAmount?: number
  currency: Currency
  currentBalance: number
  createdAt: string
  notes?: string
}

/** Template for monthly recurring deposits (user confirms amount in Add flow; scheduler posts on due date). */
export interface RecurringSavingsDeposit {
  id: string
  accountId: string
  amount: number
  currency: Currency
  frequency: 'monthly'
  /** Calendar day 1–28. */
  dayOfMonth: number
  /** Next run date YYYY-MM-DD. */
  nextDueDate: string
  isActive: boolean
  notes?: string
  createdAt: string
}

export interface SavingsTransaction {
  id: string
  accountId: string
  type: 'deposit' | 'withdrawal'
  amount: number
  currency: Currency
  date: string
  source?: string
  notes?: string
  isAutoSave?: boolean
}

export type DebtCurrency = 'EGP' | 'XAU' | Currency

export type GoldKarat = 24 | 22 | 21 | 18

/** High-level debt category for UI and fields (optional on legacy rows). */
export type DebtKind = 'personal' | 'installment' | 'general'

export type DebtLifecycleStatus = 'active' | 'cleared'

/** How borrowed money was received (replaces relying on `isGold` alone for channel). */
export type DebtReceivedVia = 'cash' | 'bank_transfer' | 'card' | 'crypto' | 'gold' | 'other'

export interface DebtGoal {
  targetDate: string
  paymentFrequency: 'weekly' | 'monthly' | 'quarterly' | 'annually'
  calculatedAmount: number
}

export interface Debt {
  id: string
  name: string
  person: string
  description?: string
  startingBalance: number
  currency: DebtCurrency
  isGold: boolean
  /** Receipt channel; kept in sync with `isGold` (gold ⇒ receivedVia gold). */
  receivedVia?: DebtReceivedVia
  goldKarat?: GoldKarat
  notes?: string
  sharedPlanId?: string | null
  createdAt: string
  /** Optional lifecycle; omitted legacy rows are treated as active until migrated. */
  status?: DebtLifecycleStatus
  /** ISO date (YYYY-MM-DD) when fully cleared. */
  clearedAt?: string
  emoji?: string
  debtType?: DebtKind
  /** Personal debt (optional; legacy uses `person`). */
  personName?: string
  relationship?: string
  direction?: 'i_owe' | 'they_owe'
  /** Installment plan */
  installmentCount?: number
  installmentFrequency?: 'weekly' | 'monthly' | 'quarterly' | 'annually'
  installmentAmount?: number
  startDate?: string
  interestFree?: boolean
  creditor?: string
  goal?: DebtGoal
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
  sharedPlanId?: string | null
  createdAt: string
}

export type DebtRecurringFrequency =
  | 'monthly'
  | 'biweekly'
  | 'weekly'
  | 'quarterly'
  | 'annually'

/** Template: due dates are surfaced in-app; user confirms before a payment + expense are posted. */
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
  /** Data URL or external image URL */
  avatar?: string
  /** Preset avatar id, e.g. `preset_piggy` — used when `avatar` is empty */
  avatarPresetId?: string
  country?: string
  city?: string
  phone?: string
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
  /**
   * When true, form amount dropdowns list every fiat. When false, only primary and—if enabled—secondary appear;
   * other currencies are omitted (Settings labels this “Disable other currencies”). Does not affect primary/secondary
   * selectors on this page or the sidebar. New installs default to true (switch off).
   */
  showAllCurrenciesInForms: boolean
  /** When true, the dashboard onboarding banner stays hidden until reset (e.g. after completing onboarding). */
  dismissOnboardingBanner: boolean
}

/** Draft payment row from onboarding (applied to store on finish). */
export interface OnboardingPaymentDraft {
  preset: string
  type: PaymentMethodType
  nickname: string
}

export interface OnboardingAiPlan {
  id: string
  label: string
  personaId: string
  personaLabel: string
  personaTagline: string
  rationale: string
  costOfLivingNote?: string
  percents: Record<ExpenseCategory, number>
  assumptions: string[]
}

export interface OnboardingState {
  flowVersion: number
  answers: Record<string, unknown>
  currentStepIndex: number
  planAccepted: boolean
  selectedPlanIndex: number | null
  aiPlans: OnboardingAiPlan[] | null
  aiGeneratedAt: string | null
  lastValidationNotes: string[] | null
}

export type GoalStatus = 'active' | 'achieved' | 'paused' | 'cancelled'

export type GoalCategory =
  | 'emergency_fund'
  | 'house'
  | 'car'
  | 'vacation'
  | 'education'
  | 'wedding'
  | 'phone_device'
  | 'family_support'
  | 'sadaqah_charity'
  | 'gift'
  | 'investment'
  | 'debt_freedom'
  | 'quality_of_life'
  | 'spending_control'
  | 'retirement'
  | 'custom'

export interface Goal {
  id: string
  name: string
  emoji: string
  category: GoalCategory
  /** Target amount to save/accumulate (null for non-monetary goals like spending_control). */
  targetAmount: number | null
  currency: Currency
  /** Only used when not linked to savings or debts — for externally tracked goals. */
  manualCurrentAmount: number
  targetDate: string | null
  linkedSavingsAccountIds: string[]
  linkedDebtIds: string[]
  monthlySpendingLimit: number | null
  priority: number
  status: GoalStatus
  monthlyContribution: number | null
  notes: string | null
  createdAt: string
  achievedAt: string | null
}

export interface FinanceStore {
  profile: UserProfile
  settings: AppSettings
  /** Free-text financial goals from Buddgy plan builder; synced in finance payload. */
  financialGoalsNotes: string
  /** Expert onboarding progress, answers, and cached AI plans (synced in user_finance payload). */
  onboardingState: OnboardingState
  incomeSources: IncomeSource[]
  expenses: Expense[]
  recurringExpenses: RecurringExpense[]
  budgetCategories: BudgetCategory[]
  /** Optional multi-plan budget planner; when empty, dashboard uses `budgetCategories`. */
  budgetPlans: BudgetPlan[]
  /** Selected plan for dashboard caps and planner UI; ignored when `budgetPlans` is empty. */
  activeBudgetPlanId: string | null
  savingsHoldings: SavingsHolding[]
  /** Multi-account savings with transfer ledger (deposits / withdrawals). */
  savingsAccounts: SavingsAccount[]
  savingsTransactions: SavingsTransaction[]
  /** Monthly deposit schedules (not expenses). */
  recurringSavingsDeposits: RecurringSavingsDeposit[]
  paymentMethods: PaymentMethod[]
  debts: Debt[]
  debtPayments: DebtPayment[]
  recurringDebtPayments: RecurringDebtPayment[]
  goals: Goal[]
  exchangeRates: Record<string, number>
  goldPricePerGram: number
  /** ISO time of last successful `/api/gold` fetch (client). */
  lastGoldFetch: string | null
  /** When false, live gold failed — UI must not show a trusted AED/gram figure. */
  goldPriceAvailable: boolean
  lastRatesFetch: string | null

  /** `amountInBaseCurrency` is computed in the store from rates + base currency. */
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'amountInBaseCurrency'>) => void
  updateExpense: (id: string, updates: Partial<Expense>) => void
  deleteExpense: (id: string) => void
  addIncomeSource: (source: Omit<IncomeSource, 'id' | 'createdAt'>) => void
  /**
   * Adds income from borrowed money and creates a matching personal debt (`i_owe`) in one update.
   */
  addIncomeWithDebt: (
    income: Omit<IncomeSource, 'id' | 'createdAt' | 'linkedDebtId' | 'linkedSavingsAccountId' | 'sourceType'>,
    debt: Omit<Debt, 'id' | 'createdAt'>
  ) => void
  updateIncomeSource: (id: string, updates: Partial<IncomeSource>) => void
  deleteIncomeSource: (id: string) => void
  addPaymentMethod: (method: Omit<PaymentMethod, 'id'>) => void
  updatePaymentMethod: (id: string, updates: Partial<PaymentMethod>) => void
  deletePaymentMethod: (id: string) => void
  addDebt: (debt: Omit<Debt, 'id' | 'createdAt'>) => string
  updateDebt: (id: string, updates: Partial<Debt>) => void
  /** Marks a debt cleared (history); does not remove payments. */
  clearDebt: (id: string, clearedAtIsoDate?: string) => void
  addDebtPayment: (payment: Omit<DebtPayment, 'id' | 'createdAt'>) => void
  /**
   * Atomically records a debt payment and matching expense (e.g. debt payment → expense with `linkedDebtId`).
   * Does not auto-clear lifecycle status; the UI runs celebration then calls `clearDebt`.
   */
  addDebtPaymentWithExpense: (
    payment: Omit<DebtPayment, 'id' | 'createdAt'>,
    expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'amountInBaseCurrency'>
  ) => void
  deleteDebt: (id: string) => void
  deleteDebtPayment: (id: string) => void
  addRecurringDebtPayment: (r: Omit<RecurringDebtPayment, 'id' | 'createdAt'>) => void
  updateRecurringDebtPayment: (id: string, updates: Partial<RecurringDebtPayment>) => void
  deleteRecurringDebtPayment: (id: string) => void
  addRecurringExpense: (expense: Omit<RecurringExpense, 'id'>) => void
  updateRecurringExpense: (id: string, updates: Partial<RecurringExpense>) => void
  deleteRecurringExpense: (id: string) => void
  updateBudgetCategory: (category: string, amount: number, percentOfIncome?: number | null) => void
  /** Replace all budget rows (e.g. onboarding preset). */
  setBudgetCategories: (categories: BudgetCategory[]) => void
  addBudgetPlan: (name: string) => string
  updateBudgetPlan: (
    planId: string,
    updates: Partial<Pick<BudgetPlan, 'name' | 'categories' | 'household' | 'buddgyFlow' | 'buddgyGuidedComplete'>>
  ) => void
  /** Merge household / buddgyFlow into the active plan (Buddgy Flow). */
  updateBudgetMeta: (
    planId: string,
    updates: Partial<Pick<BudgetPlan, 'household' | 'buddgyFlow'>>
  ) => void
  /** Replace all category rows on a plan at once. */
  replaceBudgetPlanCategories: (planId: string, categories: BudgetPlanCategory[]) => void
  deleteBudgetPlan: (planId: string) => void
  setActiveBudgetPlanId: (id: string | null) => void
  addPlanCategory: (planId: string, category: Omit<BudgetPlanCategory, 'id' | 'subcategories'> & { subcategories?: BudgetPlanSubcategory[] }) => string
  updatePlanCategory: (planId: string, categoryId: string, updates: Partial<Omit<BudgetPlanCategory, 'id' | 'subcategories'>> & { subcategories?: BudgetPlanSubcategory[] }) => void
  deletePlanCategory: (planId: string, categoryId: string) => void
  addPlanSubcategory: (planId: string, categoryId: string, sub: Omit<BudgetPlanSubcategory, 'id'>) => string
  updatePlanSubcategory: (
    planId: string,
    categoryId: string,
    subId: string,
    updates: Partial<Pick<BudgetPlanSubcategory, 'name' | 'amount' | 'icon'>>
  ) => void
  deletePlanSubcategory: (planId: string, categoryId: string, subId: string) => void
  addSavingsHolding: (h: Omit<SavingsHolding, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateSavingsHolding: (id: string, updates: Partial<SavingsHolding>) => void
  deleteSavingsHolding: (id: string) => void
  addSavingsAccount: (
    a: Omit<SavingsAccount, 'id' | 'createdAt' | 'currentBalance'> & { openingBalance?: number }
  ) => string
  updateSavingsAccount: (id: string, updates: Partial<SavingsAccount>) => void
  deleteSavingsAccount: (id: string) => void
  addRecurringSavingsDeposit: (r: Omit<RecurringSavingsDeposit, 'id' | 'createdAt'>) => void
  updateRecurringSavingsDeposit: (id: string, updates: Partial<RecurringSavingsDeposit>) => void
  deleteRecurringSavingsDeposit: (id: string) => void
  depositToSavings: (
    accountId: string,
    amount: number,
    currency: Currency,
    notes?: string,
    opts?: { isAutoSave?: boolean; source?: string }
  ) => void
  withdrawFromSavings: (accountId: string, amount: number, currency: Currency, notes?: string) => void
  correctSavingsBalance: (accountId: string, newBalance: number, notes?: string) => void
  updateSettings: (updates: Partial<AppSettings>) => void
  updateProfile: (updates: Partial<UserProfile>) => void
  setFinancialGoalsNotes: (notes: string) => void
  addGoal: (
    goal: Omit<Goal, 'id' | 'createdAt' | 'achievedAt' | 'manualCurrentAmount'> & {
      manualCurrentAmount?: number
    }
  ) => string
  updateGoal: (id: string, updates: Partial<Goal>) => void
  deleteGoal: (id: string) => void
  achieveGoal: (id: string) => void
  setOnboardingState: (updates: Partial<OnboardingState> | ((prev: OnboardingState) => OnboardingState)) => void
  updateRates: (rates: Record<string, number>) => void
  updateGoldPrice: (price: number) => void
  setGoldUnavailable: () => void
  /** @throws Error on invalid JSON or failed Zod validation (message is user-facing). */
  importData: (data: string) => void
  exportData: () => string
  resetAllData: () => void
  /** Same as `resetAllData` (logout / full client wipe). */
  reset: () => void
}
