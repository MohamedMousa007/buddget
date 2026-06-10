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
  notes?: string
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

export type SubscriptionBillingCycle = 'monthly' | 'quarterly' | 'yearly' | 'weekly'

export type SubscriptionStatus = 'active' | 'cancelled' | 'paused' | 'trial'

export interface Subscription {
  id: string

  /** Service name (e.g., "Netflix", "iCloud+", custom) */
  name: string

  /** Brand key from catalog, or null for custom subscriptions */
  brandKey: string | null

  /** Selected plan name (e.g., "Premium", "200GB") */
  planName: string | null

  amount: number
  currency: Currency

  billingCycle: SubscriptionBillingCycle

  /** Day of month the charge happens (1–31); for weekly, ignored for scheduling math but still shown */
  billingDay: number

  /** Date user started this subscription (YYYY-MM-DD) */
  startDate: string

  /** Next renewal / charge date (YYYY-MM-DD) */
  nextBillingDate: string | null

  /** Which payment method is charged */
  paymentMethodId: string | null

  /** Category for the auto-generated recurring expense */
  expenseCategory: string

  /** ID of the auto-created RecurringExpense (for sync) */
  linkedRecurringExpenseId: string | null

  status: SubscriptionStatus

  notes: string | null
  createdAt: string
  cancelledAt: string | null
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

/** Who the budget is for (planner / household). */
export type BudgetHousehold = 'solo' | 'partner' | 'family'

/** Draft fields during guided budget setup (persisted on the plan). */
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
  /** Guided setup: household size for AI and sliders. */
  household?: BudgetHousehold | null
  buddgyFlow?: BuddgyFlowDraft | null
  /** User finished guided plan builder (Done). Cleared when rebuilding. */
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
export type DebtKind = 'personal' | 'installment' | 'general' | 'credit_card'

/** BNPL or bank installment brand for installment-type debts. */
export type InstallmentProvider = 'credit_card' | 'tabby' | 'tamara' | 'other'

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

  /** Credit card revolving line — use with `debtType: 'credit_card'`. */
  creditLimit?: number
  paymentDueDay?: number
  gracePeriodDays?: number
  linkedPaymentMethodId?: string
  minimumPaymentPercent?: number

  /** Installment / BNPL provider (Tabby, Tamara, bank card plan, etc.). */
  installmentProvider?: InstallmentProvider
  /** When provider is `credit_card`, links to the card debt row. */
  linkedCreditCardDebtId?: string
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
  /** Optional self-selected gender. Null (or missing) when unset. */
  gender?: 'male' | 'female' | 'prefer_not_to_say' | null
  baseCurrency: Currency
  /**
   * Set when the user ticks "I have no debts" on the first-run checklist so
   * the debt item flips to done without forcing them to add a fake entry.
   * Synced via `profiles.no_debts_declared`.
   */
  noDebtsDeclared?: boolean
  /**
   * Parallels `noDebtsDeclared` for the goals checklist row. Cross-device via
   * `profiles.no_goals_declared`.
   */
  noGoalsDeclared?: boolean
  /** True when user skipped income during onboarding. Tracking-only mode. */
  liteMode?: boolean
  /** 0 = never completed, 1 = old flow, 2 = new 2-step flow */
  onboardingVersion?: number
  /**
   * Household composition used by the budget-build AI (drives rent / food /
   * transport scaling factors). Synced via `profiles.household`.
   */
  household?: 'solo' | 'couple' | 'family' | null
  /** Lifestyle tier used by the budget-build AI. Synced via `profiles.lifestyle_tier`. */
  lifestyleTier?: 'minimal' | 'balanced' | 'comfortable' | null
  /** Food-out frequency signal for the AI. Synced via `profiles.food_frequency`. */
  foodFrequency?: 'everyday' | 'mostdays' | 'sometimes' | 'rarely' | null
  /** Primary commute mode for the AI. Synced via `profiles.transport_mode`. */
  transportMode?: 'public' | 'car' | 'taxi' | 'walk' | null
  /** Monthly rent in base currency. Synced via `profiles.monthly_rent`. */
  monthlyRent?: number | null
  /** Whether utilities are bundled into rent. Synced via `profiles.rent_includes_utilities`. */
  rentIncludesUtilities?: boolean
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
  /**
   * ISO timestamp: "Remind me later" snooze on the onboarding banner. Banner is hidden while `now < remindAt`.
   * Cleared automatically once the timestamp passes; null when no snooze is active.
   */
  onboardingBannerRemindAt: string | null
  /**
   * When true, sign-in on an untrusted device requires an email OTP step even after the password is
   * correct. Trusted devices (verified via OTP previously) skip the challenge until the HttpOnly
   * `buddget_device_id` cookie expires or is cleared.
   */
  twoFactorEmailEnabled: boolean
  /**
   * When true, the dashboard first-run checklist is hidden even if not yet
   * 100% complete. Re-enabled via the profile dropdown "Finish setup" entry.
   * Synced across devices via `user_settings.onboarding_checklist_hidden`.
   */
  onboardingChecklistHidden: boolean
  /**
   * ISO timestamp: set once the legacy-onboarding migrator has run (idempotent).
   * Client-only flag — excluded from Supabase round-trip on purpose.
   */
  legacyOnboardingMigratedAt: string | null
  /**
   * Which dashboard layout to render on `/`. `'standard'` = the navy-hero +
   * multi-card stack; `'minimal'` = the centred single-column stack shipped
   * alongside the "Minimal" theme option in Settings. Persisted in
   * `user_settings.dashboard_layout` so the choice survives sign-out.
   */
  dashboardLayout?: 'standard' | 'minimal'
  /**
   * Tours the user has finished, stored as versioned ids
   * (e.g. `'postOnboardingTour:v1'`). Re-firing a tour for every existing
   * user just requires bumping its version. Synced via
   * `user_settings.tutorials_completed`.
   */
  tutorialsCompleted: string[]
  /**
   * Resume marker if the user closed the app mid-tour. Format:
   * `<tourId>:<version>:<stepIndex>`. Null when no tour is in flight.
   * Synced via `user_settings.tutorial_current_step`.
   */
  tutorialCurrentStep: string | null
  /**
   * When true, the SMS auto-tracking feature is active. The iOS Shortcut / Android Bridge
   * will forward incoming bank SMS messages to the ingest webhook.
   * Synced via `user_settings.sms_tracking_enabled`.
   */
  smsTrackingEnabled: boolean
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
  /**
   * Half-filled modal drafts during onboarding, keyed by modal id
   * (e.g. `incomeDraft`, `pmDraft`). Debounced-written from the client;
   * cleared on successful save. Lets a mid-modal tab-close resume with
   * the in-progress entry instead of a blank form. Synced via
   * `onboarding_state.draft_entries`.
   */
  draftEntries: Record<string, unknown>
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
  /** Free-text financial goals from the plan builder; synced in finance payload. */
  financialGoalsNotes: string
  /** Journey progress, answers, and cached AI plans. Synced to
   *  `public.onboarding_state` via `flushDiff`. */
  onboardingState: OnboardingState
  incomeSources: IncomeSource[]
  expenses: Expense[]
  recurringExpenses: RecurringExpense[]
  subscriptions: Subscription[]
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
  /**
   * True once the initial server pull (pullAll or pullCore) for the current
   * userId has completed. Resets to false on sign-out and on userId change.
   * Not persisted — always starts false on app open so pages show skeletons
   * instead of stale localStorage data while the first pull is in flight.
   */
  dataReady: boolean
  setDataReady: (v: boolean) => void

  /** `amountInBaseCurrency` is computed in the store from rates + base currency. */
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'amountInBaseCurrency'>) => void
  updateExpense: (id: string, updates: Partial<Expense>) => void
  deleteExpense: (id: string) => void
  /**
   * Inserts/replaces an already-persisted server row VERBATIM by its real id —
   * no id/timestamp regeneration. Used to ingest SMS-created expenses from
   * realtime/push so the local copy matches the server PK (keeps `flushDiff`
   * upserts idempotent; prevents duplicates and soft-delete eviction).
   */
  upsertServerExpense: (expense: Expense) => void
  addIncomeSource: (source: Omit<IncomeSource, 'id' | 'createdAt'>) => void
  /** Server-row counterpart of {@link upsertServerExpense} for income. */
  upsertServerIncome: (source: IncomeSource) => void
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
  /**
   * Creates or updates a credit card debt and links a `card_credit` payment method (or reuses an existing match).
   */
  addCreditCardDebt: (
    debt: Omit<Debt, 'id' | 'createdAt' | 'debtType' | 'linkedPaymentMethodId'>,
    paymentMethodInfo: { name: string; last4?: string; color?: string }
  ) => string
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
  addSubscription: (
    sub: Omit<Subscription, 'id' | 'createdAt' | 'cancelledAt' | 'linkedRecurringExpenseId'>
  ) => string
  updateSubscription: (id: string, updates: Partial<Subscription>) => void
  cancelSubscription: (id: string) => void
  deleteSubscription: (id: string) => void
  reactivateSubscription: (id: string) => void
  updateBudgetCategory: (category: string, amount: number, percentOfIncome?: number | null) => void
  /** Replace all budget rows (e.g. onboarding preset). */
  setBudgetCategories: (categories: BudgetCategory[]) => void
  addBudgetPlan: (name: string) => string
  updateBudgetPlan: (
    planId: string,
    updates: Partial<Pick<BudgetPlan, 'name' | 'categories' | 'household' | 'buddgyFlow' | 'buddgyGuidedComplete'>>
  ) => void
    /** Merge household / buddgyFlow into the active plan (guided setup). */
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
