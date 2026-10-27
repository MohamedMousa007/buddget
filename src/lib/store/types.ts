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
  | 'Instapay'
  | 'Other'
  // Added spend categories (Egypt/Gulf coverage)
  | 'Groceries'
  | 'Fuel'
  | 'Health'
  | 'Shopping'
  | 'Education'
  | 'Utilities'
  | 'Subscription'
  // Non-spend money-movement categories (excluded from spend/budgets via categoryMeta)
  | 'ATM Cash Withdrawal'
  | 'Transfer'
  | 'Currency Exchange'
  | 'CC Payoff'
  | 'Top up'
  | 'Installment'

export type PaymentMethodType =
  | 'cash'
  | 'bank_account'
  | 'debit_card'
  | 'credit_card'
  | 'prepaid_card'
  | 'wallet'
  | 'bnpl'
  | 'other'

export interface PaymentMethod {
  /** Cards hang under an account (cash / bank_account / wallet). Absent = standalone. */
  parentId?: string
  /** Account balance at `openingAt`; undefined = not set yet (excluded from totals). */
  openingBalance?: number
  openingAt?: string
  /** Closed accounts keep their history but leave lists and totals. */
  closedAt?: string
  /** Compare SMS balance reports against the ledger. Default on. */
  trackSms?: boolean
  /** Not the user's money (a card someone else uses): its spending and balance stay out of totals. The ledger stays true. */
  excluded?: boolean
  id: string
  name: string
  type: PaymentMethodType
  currency: Currency
  color?: string
  icon?: string
  last4?: string
  /** A name the user gave the account, shown where the last four digits would be. `last4` stays stored for SMS matching. */
  label?: string
  isDefault: boolean
  /** Last local edit (ISO). Powers the offline-merge tiebreak — without it an
   *  offline edit to this row loses to the server on every sign-in. */
  updatedAt?: string
  createdAt?: string
}

/** How often recurring income is received; amount is per that period (e.g. weekly = per week). */
export type IncomeRecurringFrequency = 'monthly' | 'biweekly' | 'weekly'
/** Employer weekend: Sat+Sun (default) or Fri+Sat (Egypt). */
export type PaydayWeekend = 'sat_sun' | 'fri_sat'

export type IncomeSourceType =
  | 'salary'
  | 'bonus'
  | 'side_hustle'
  | 'rental'
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
  /**
   * Sorted 1–31 days of month the paychecks land on: monthly 1, biweekly 2,
   * weekly 4 (max). Legacy rows omit it → derived from {@link dayOfMonth}.
   */
  paydayDays?: number[]
  /**
   * Days a paycheck may drift from its scheduled payday and still be that payday.
   * Drives how far an SMS credit looks for the payday it fulfils, and how long an
   * unpaid payday stays "late" before it reads as "missed".
   * Undefined/null = app default (7 matching, {@link MISSED_AFTER_DAYS} before missed).
   */
  paydayDriftDays?: number | null
  /** Employer weekend for payday shifting: Sat+Sun (default; US/remote) or Fri+Sat (Egypt). */
  paydayWeekend?: PaydayWeekend
  /** `YYYY-MM-DD` the source starts counting for a month (defaults to creation date). */
  effectiveStart: string
  /** `YYYY-MM-DD` the source stops counting (inclusive); null/undefined = ongoing. */
  effectiveEnd?: string | null
  notes?: string
  createdAt: string
  /** Last-modified timestamp; drives merge last-write-wins in {@link mergeById}. */
  updatedAt: string
  /** Type/source of income. Defaults to `other` for legacy data. */
  sourceType?: IncomeSourceType
  /** When `sourceType` is savings or investment, links to the savings account row. */
  linkedSavingsAccountId?: string
  /** When `sourceType` is debt, links to the auto-created debt row. */
  linkedDebtId?: string
  /** Which of the user's payment methods received this income (optional). */
  paymentMethodId?: string
  /** Position on Paydays (and in Flow's In chips); lower first. Unset sorts as 0, then by creation. */
  sortOrder?: number
}

/** Lifecycle of an actual income event vs. its projected template occurrence. */
export type IncomeEventStatus = 'confirmed' | 'projected' | 'late' | 'missed' | 'partial'

/**
 * An actual received-income event (the postable ledger). Recurring templates in
 * {@link IncomeSource} project expected events; confirming/editing one persists a row here.
 */
export interface IncomeEvent {
  occurredAt?: string
  id: string
  /** The recurring {@link IncomeSource} this came from; null/undefined = one-time. */
  templateId?: string | null
  name: string
  amount: number
  currency: Currency
  sourceType?: IncomeSourceType
  /** `YYYY-MM-DD` the money was (or is expected to be) received. */
  receivedDate: string
  /** `YYYY-MM-DD` scheduled payday this event fulfills; null/undefined = legacy or one-time. */
  occurrenceDate?: string | null
  status: IncomeEventStatus
  paymentMethodId?: string
  linkedSavingsAccountId?: string
  linkedDebtId?: string
  sharedPlanId?: string | null
  /** Provenance when ingested from an SMS credit (`sms_parse_log.id`). */
  smsLogId?: string | null
  notes?: string
  createdAt: string
  updatedAt: string
}

/** `method` = its payment method is excluded; `manual` = the user left this one out; `for_someone` = paid on someone's behalf. */
export type SpendExclusion = 'method' | 'manual' | 'for_someone'

export interface Expense {
  /** Exact instant (ISO). `date` stays the day key; readers fall back to date@12:00 when absent. */
  occurredAt?: string
  /** Transfer target (Cash out, own transfer): credits this account, `paymentMethodId` is debited. */
  toPaymentMethodId?: string
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
  /** When set, this expense settles a credit-card debt via this debt payment (`debt_payments.id`). */
  linkedDebtPaymentId?: string
  /** When set, this expense is linked to a tracked subscription (`subscriptions.id`). */
  linkedSubscriptionId?: string
  /** When set, this expense was auto-created from a parsed bank SMS (`sms_parse_log.id`). */
  smsLogId?: string
  /** When set, this expense is the total of a scanned receipt (`receipts.id`); breakdown lives there. */
  receiptId?: string
  /** Set when a refund/decline SMS reversed this expense — excluded from spend, shown struck. */
  refundedAt?: string
  /** `refunded` = money returned; `declined` = charge blocked/reversed. Drives the card badge. */
  refundKind?: 'refunded' | 'declined'
  /** Why this expense is left out of spending (it is still logged and still moves the account balance). */
  spendExclusion?: SpendExclusion
  /** For `for_someone`: who owes this back, and when they paid it. */
  owedBy?: string
  owedSettledAt?: string
  createdAt: string
  updatedAt: string
}

/** A single line item on a scanned receipt. No per-item category/payment method (token economy). */
export interface ReceiptItem {
  name: string
  price: number
  qty?: number
}

export type ReceiptChargeType = 'tax' | 'service' | 'tip' | 'discount' | 'other'

/** A non-item charge on a receipt (tax, service, tip, discount). */
export interface ReceiptCharge {
  type: ReceiptChargeType
  label: string
  amount: number
}

/**
 * A scanned receipt's breakdown. The printed grand total is mirrored to one
 * {@link Expense} (carrying the single category + payment method); this row holds
 * the itemized breakdown surfaced behind "View receipt".
 */
export interface Receipt {
  id: string
  merchant: string
  /** Printed grand total — mirrored to the linked expense's amount. */
  amount: number
  currency: Currency
  receiptDate: string
  category: string
  paymentMethodId?: string
  confidence?: number
  items: ReceiptItem[]
  charges: ReceiptCharge[]
  notes?: string
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
  /** Last local edit (ISO). Powers the offline-merge tiebreak — without it an
   *  offline edit to this row loses to the server on every sign-in. */
  updatedAt?: string
  createdAt?: string
}

export type SubscriptionBillingCycle = 'monthly' | 'quarterly' | 'semiannual' | 'yearly' | 'weekly'

/** How a due charge reaches the ledger: matched from an SMS, asked on the due date, or logged automatically. */
export type SubscriptionTracking = 'sms' | 'ask' | 'log'

export type SubscriptionStatus = 'active' | 'cancelled' | 'paused' | 'trial'

export interface Subscription {
  id: string

  /** Service name (e.g., "Netflix", "iCloud+", custom) */
  name: string

  /** Brand key from catalog, or null for custom subscriptions */
  brandKey: string | null

  /** Selected plan name (e.g., "Premium", "200GB") */
  planName: string | null

  /**
   * Stable catalog plan id (e.g. `netflix_standard`), shared across regions. Null for a
   * custom subscription, or one created before plan ids existed.
   *
   * `planName` alone could not identify a plan: it is a label that can be edited, and
   * matching it meant string-comparing against whichever region the user is in NOW.
   */
  planId: string | null

  /** Catalog region this was priced against — so a later comparison uses the right column. */
  catalogRegion: string | null

  /**
   * A plan the user may have switched to, DETECTED from a tracked payment but not yet
   * confirmed. Drives the "looks like you moved to Premium — update?" prompt. Null when
   * there is nothing pending. Applied or dismissed clears both.
   */
  pendingPlanId: string | null
  /** The charged amount behind {@link pendingPlanId}, in this subscription's currency. */
  pendingAmount: number | null

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
  /** Last edit (ISO). Without it a local edit (cancel, price change) ties the server on
   *  `createdAt` and loses the offline-merge, so the server's stale copy wins. */
  updatedAt?: string

  /** How due charges are recorded. Absent (legacy rows) means `sms`. */
  tracking?: SubscriptionTracking
  /** Daily-digest reminders for this subscription. Absent means on. */
  reminder?: boolean
  /** Last day of the free trial (YYYY-MM-DD). Only meaningful while `status === 'trial'`. */
  trialEnd?: string | null
  /** Cancelled subscriptions keep access until this day (YYYY-MM-DD), then move to Ended. */
  endsOn?: string | null
  pausedAt?: string | null
  /** Every amount this plan has billed, newest last. `from` is the day it took effect. */
  priceHistory?: { amount: number; from: string }[]
  /** Day the detected plan change takes effect (pairs with pendingPlanId / pendingAmount). */
  pendingPlanFrom?: string | null
  /** Co-payers on a shared plan; `amount` is the full price, `myShare` what the user pays. */
  sharedWith?: string[] | null
  myShare?: number | null
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
  /** Which block of the plan the line lives in. Absent on pre-v2 rows (treated as `everyday`). */
  block?: BudgetBlock
  /** Where the amount comes from. `none` = typed by the user; anything else is derived live. */
  linkType?: BudgetLinkType
  /** Ids of the linked debts or goal (subscriptions and emergency link by type alone). */
  linkIds?: string[]
  /** Day of month the bill is due (bills block). */
  dueDay?: number | null
  /** Counts toward essentials (runway, essentials share). */
  essential?: boolean
  /** Buddgy's adjust-by-text never changes a locked line. */
  locked?: boolean
  /** One-line "why this amount" from the AI builder. */
  rationale?: string | null
  confidence?: BudgetLineConfidence | null
  /** Ledger categories that count against this line (replaces guessing from the name). */
  expenseCategories?: string[]
}

/** The seven blocks every plan is split into. */
export type BudgetBlock = 'bills' | 'subscriptions' | 'debts' | 'everyday' | 'safety' | 'goals' | 'grow'
export type BudgetLinkType = 'none' | 'subscriptions' | 'debts' | 'goal' | 'emergency'
export type BudgetLineConfidence = 'high' | 'estimated'
/** `draft` plans are invisible to stats and the switcher until confirmed. */
export type BudgetPlanStatus = 'draft' | 'ready' | 'archived'
export type BudgetPlanIntent = 'balanced' | 'saver' | 'debt_crusher' | 'custom'
export type BudgetPlanOrigin = 'ai' | 'manual' | 'template' | 'clone'

/** Why the AI built the plan the way it did (shown in review). */
export interface BudgetPlanRationale {
  reasons: string[]
  risks?: string[]
}

/** Which plan was active from which cycle; each month resolves to the latest row at or before it. */
/** One thing Buddgy remembers about the user. Written only after the user agrees; 'proposed' is reserved for pending suggestions. */
export interface BuddgyMemory {
  id: string
  text: string
  kind: 'fact' | 'preference' | 'constraint'
  source: 'budget' | 'chat' | 'settings'
  status: 'proposed' | 'active'
  /** The budget plan this note came from; deleting the plan deletes the note. */
  planId?: string
  createdAt: string
  updatedAt: string
}

export interface BudgetPlanActivation {
  id: string
  planId: string
  /** First day of the cycle (`YYYY-MM-DD`) the plan took over. */
  effectiveFrom: string
  createdAt: string
}

/** State to restore when the user undoes an activation. */
export interface BudgetActivationUndo {
  activeBudgetPlanId: string | null
  activations: BudgetPlanActivation[]
}

/** What the budget studio learns about the user, beyond the typed profile columns. */
/** What brings someone to the app; seeds the first budget priorities and the wording of the first card. */
export type OnboardingGoal = 'see' | 'runout' | 'save' | 'debt' | 'budget'

/** Where a new account is in the first-run journey. Lives on the profile so it resumes on any device. */
export interface OnboardingRecord {
  v: 1
  /** Index into the journey's steps. */
  step: number
  startedAt: string
  goals?: OnboardingGoal[]
  /** The income source the journey created, so going back edits it instead of adding another. */
  incomeSourceId?: string
  /** 'later' = asked and declined; do not ask again before `pushLaterAt` + 30 days. */
  push?: 'allowed' | 'later'
  pushLaterAt?: string
  doneAt?: string
  skippedAt?: string
}

/** Per budget line (`block:name`): the last close proposal and what the user did with it. */
export type CloseMemory = Record<string, { kind: 'raise' | 'lower'; cycle: string; outcome: 'applied' | 'passed' }>

export interface FinancialProfile {
  housing?: 'rent' | 'own' | 'family' | 'company'
  dependents?: number
  supportsOthers?: boolean
  incomeStability?: 'fixed' | 'variable' | 'mixed'
  hasCar?: boolean
  priorities?: string[]
  /** 0 = save hard, 100 = live comfortably. */
  securityLean?: number
  investInterest?: boolean
  /** Pays mostly in cash, so tracked spending understates real spending. */
  cashHeavy?: boolean
  /** What month-close proposals were applied or passed on, per line, so a declined change is not repeated. */
  closeMemory?: CloseMemory
  /** First-run journey progress; absent for accounts that predate it. */
  onboarding?: OnboardingRecord
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
  updatedAt?: string
  /** Guided setup: household size for AI and sliders. */
  household?: BudgetHousehold | null
  buddgyFlow?: BuddgyFlowDraft | null
  /** User finished guided plan builder (Done). Cleared when rebuilding. */
  buddgyGuidedComplete?: boolean
  /** Absent on pre-v2 rows (treated as `ready`). */
  status?: BudgetPlanStatus
  intent?: BudgetPlanIntent
  origin?: BudgetPlanOrigin
  /** Overrides income from sources when set. */
  incomeOverride?: number | null
  rationale?: BudgetPlanRationale | null
  engineVersion?: string | null
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

/** v3 investment position: a thing you own, valued at quantity × live price. Grouped by
 *  `assetType` on the Investment page (not inside a pocket). Backed by `savings_holdings`. */
export type InvestmentAssetType = 'gold' | 'crypto' | 'stock' | 'property'

export interface InvestmentHolding {
  id: string
  assetType: InvestmentAssetType
  /** Display name — "21k jewellery", "Bitcoin", "Apple", "Downtown flat". */
  name: string
  /** Grams (gold, normalised from the entered unit) · coins · shares · m² (property). */
  quantity: number
  /** Valuation currency for this row (EGP for most; USD for a US stock before Sagha conversion). */
  currency: Currency
  purchaseDate?: string
  /** Cost basis per unit (optional). */
  unitCost?: number
  costBasisCurrency?: Currency
  notes?: string
  // gold
  karat?: GoldKarat
  /** True on a backfilled gold row assumed 24k; prompts the user to confirm. */
  karatUnconfirmed?: boolean
  /** The unit the user entered gold in; `quantity` is always grams. */
  goldUnit?: 'grams' | 'pounds' | 'ounces'
  /** Coin symbol (BTC) or stock ticker (AAPL). */
  symbol?: string
  // property — value is user-typed. Size lives in `quantity` (m²).
  propertyValue?: number
  sharePercent?: number
  /** Where the gold sits · the crypto venue · the stock market. */
  location?: string
  createdAt: string
  updatedAt?: string
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
  /** System-created "Monthly Savings" vault: undeletable, base currency, default carry target. */
  | 'vault'

/** Safe/liquid vs growth bucket (split in UI and net-worth rollups). */
export type SavingsAccountCategory = 'savings' | 'investment'

/** Savings bucket with ledger balance (transfers, not expenses). */
export interface SavingsAccount {
  /** Earmark: this pocket sits inside that account; the account balance is unchanged, only "free" shrinks. */
  heldInPaymentMethodId?: string
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
  /** v3 pocket display colour token (see the design accents). */
  color?: string
  /** Counts toward emergency cover (claimed before any goal). */
  isEmergencyCover?: boolean
  /** Linked real payment method this pocket represents. */
  linkedPaymentMethodId?: string
  /** Account-identity sub-line bits (bank name, last 4, certificate maturity, yearly return). */
  institution?: string
  accountLast4?: string
  maturityDate?: string
  yearlyReturn?: number
}

/** Per-user emergency-fund settings (stored as jsonb on profiles). */
export interface EmergencyFundConfig {
  targetMonths: number
  /** Pockets explicitly counted as cover; when empty, the `isEmergencyCover` flag is used. */
  coverPocketIds?: string[]
  /** Manual simple-essentials override; when unset it is derived from rent/food/transport/bills/debt minimums. */
  monthlyEssentials?: number
}

/** Per-user zakat settings (stored as jsonb on profiles). */
export interface ZakatConfig {
  nisabBasis: 'silver' | 'gold'
  /**
   * The user explicitly picked `nisabBasis`. Absent on configs written before the Wealth v3
   * basis prompt: any existing config counts as chosen, see {@link zakatBasisChosen}.
   */
  nisabBasisChosen?: boolean
  holdsForTrading: boolean
  /** Master override — replaces the computed figure entirely. */
  manualAmount?: number | null
  /** Per-line edits in the "what counts" list, keyed by line id. */
  lineOverrides?: Record<string, number>
  lastPaidDate?: string
  /**
   * The user's own zakat-year anchor (ISO date) — when their wealth first passed
   * nisab, or the fixed Hijri date they keep. Without it the hawl falls back to
   * account creation, which is an install date and not a religious one; see
   * {@link deriveHawl}.
   */
  yearStartDate?: string | null
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

/** Where a savings withdrawal goes. Only 'income' creates an IncomeEvent. */
export type SavingsWithdrawalPurpose = 'income' | 'transfer' | 'debt' | 'spend'

export interface SavingsTransaction {
  occurredAt?: string
  /** Account the money came from / went to. */
  paymentMethodId?: string
  id: string
  accountId: string
  type: 'deposit' | 'withdrawal'
  amount: number
  currency: Currency
  date: string
  source?: string
  notes?: string
  isAutoSave?: boolean
  /**
   * False when the balance moved but cash did NOT: an account's opening balance, an
   * imported prior balance, or a correction/revaluation (e.g. investment gains). Only
   * true rows are netted out of net worth's `monthlyFlow` — subtracting an opening
   * balance would zero out a pre-existing account, and subtracting a revaluation would
   * cancel the gain. Defaults to true (a real deposit/withdrawal).
   *
   * Separate from `type` because `type` carries the DIRECTION, and a correction can go
   * either way — the two are independent axes.
   */
  isCashFlow?: boolean
  /** Both legs of a pocket-to-pocket transfer share this id; a plain deposit/withdrawal omits it. */
  transferGroupId?: string
  /** Last local edit (ISO). Powers the offline-merge tiebreak — without it an
   *  offline edit to this row loses to the server on every sign-in. */
  updatedAt?: string
  createdAt?: string
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
  /** Last local edit; drives offline last-writer-wins merge (falls back to createdAt). */
  updatedAt?: string
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

  /** Installment / BNPL provider coarse category (Tabby, Tamara, bank card plan, etc.). */
  installmentProvider?: InstallmentProvider
  /** Free-text provider brand slug from the catalogue (valU, Sympl, Souhoola…); shown in UI. */
  installmentProviderName?: string
  /** When provider is `credit_card`, links to the card debt row. */
  linkedCreditCardDebtId?: string
}

export interface DebtPayment {
  occurredAt?: string
  id: string
  debtId: string
  date: string
  amountPaid: number
  /** Funding account for this payment (which method paid it). */
  paymentMethodId?: string
  paymentCurrency?: string
  originalAmount?: number
  amountInPrimary?: number
  rateAtEntry?: number
  notes?: string
  /** Paid from a savings pocket (balance-sheet move) — excluded from monthly cash outflow. */
  fundedFromSavings?: boolean
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
  /** Day of month the schedule is anchored to (1-31); lets a 31st schedule return to 31 after short months. */
  dueDay?: number
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
  /** Pocket that receives the automatic month-end carry. Synced via `profiles.default_carry_pocket_id`. */
  defaultCarryPocketId?: string | null
  /** v3 emergency-fund settings. Synced via `profiles.emergency_fund_config`. */
  emergencyFundConfig?: EmergencyFundConfig | null
  /** v3 zakat settings. Synced via `profiles.zakat_config`. */
  zakatConfig?: ZakatConfig | null
  /** Budget studio answers beyond the typed fields. Synced via `profiles.financial_profile`. */
  financialProfile?: FinancialProfile | null
  createdAt: string
}

export interface AppSettings {
  /** Per-surface balance hiding; undefined = everything visible. */
  privacy?: PrivacySettings
  baseCurrency: Currency
  secondaryCurrency: Currency | null
  showSecondaryCurrency: boolean
  theme: 'dark' | 'light' | 'system'
  language: 'en' | 'ar'
  showCentsInDashboard: boolean
  monthStartDay: number
  /** IANA zone of the user's device, synced so server crons judge dates in their local calendar. */
  timezone?: string | null
  /** Budget rows as fixed amounts in base currency vs % of monthly recurring income */
  budgetEntryMode: 'amount' | 'percent_of_income'
  /** AI chat / extraction (optional client preference; server may still gate by env) */
  enableAI: boolean
  /** Gemini is configured with server-side GEMINI_API_KEY only (never stored in the client). */
  aiProvider: 'gemini'
  /**
   * True when the user has no income yet. Income- and %-of-income budget
   * KPIs stay at 0 until they add an income source (which clears this flag).
   */
  noIncomeDeclared: boolean
  /**
   * When true, form amount dropdowns list every fiat. When false, only primary and—if enabled—secondary appear;
   * other currencies are omitted (Settings labels this “Disable other currencies”). Does not affect primary/secondary
   * selectors on this page or the sidebar. New installs default to true (switch off).
   */
  showAllCurrenciesInForms: boolean
  /**
   * When true, sign-in on an untrusted device requires an email OTP step even after the password is
   * correct. Trusted devices (verified via OTP previously) skip the challenge until the HttpOnly
   * `buddget_device_id` cookie expires or is cleared.
   */
  twoFactorEmailEnabled: boolean
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
  /** Wealth gold-price strip state; `user_settings.wealth_gold_strip` (synced). */
  wealthGoldStrip?: 'collapsed' | 'expanded' | 'hidden'
  /** Prompts the user has answered for good, by key, with when. Synced in `user_settings.prompt_state`. */
  promptState?: Record<string, string>
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
  /** Subscription due-date reminders (the daily digest). Synced via `user_settings.sub_due_reminders`. */
  subDueReminders: boolean
  /** Subscription price-rise and trial-ending alerts. Synced via `user_settings.sub_price_alerts`. */
  subPriceAlerts: boolean
  /** Milestone and achievement celebrations/pushes. Synced via `user_settings.goal_progress_alerts`. */
  goalProgressAlerts: boolean
  /** Behind-plan alerts. Synced via `user_settings.goal_alerts`. */
  goalAlerts: boolean
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
  | 'business'
  | 'custom'

export type GoalFundingMode = 'share' | 'fixed' | 'manual'
export type GoalFrequency = 'monthly' | 'quarterly'

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
  /** spending_control only: the category the limit applies to; null = all spending. */
  spendingCategory?: ExpenseCategory | null
  priority: number
  status: GoalStatus
  /** Fixed deposit per period when `fundingMode` is 'fixed'. */
  monthlyContribution: number | null
  /** How money reaches the goal each period. 'manual' = no automatic transfers. */
  fundingMode: GoalFundingMode
  /** Percent of period savings when `fundingMode` is 'share'. May total over 100 across goals; `priority` (asc) resolves shortfalls. */
  sharePct: number | null
  frequency: GoalFrequency
  /** `YYYY-MM-DD` the current plan began (set on replan); earlier cycles no longer count as behind. */
  planStart: string | null
  notes: string | null
  createdAt: string
  achievedAt: string | null
}

export interface FinanceStore {
  profile: UserProfile
  settings: AppSettings
  /** Free-text financial goals from the plan builder; synced in finance payload. */
  financialGoalsNotes: string
  incomeSources: IncomeSource[]
  /** Actual received-income ledger; projected occurrences are computed from templates. */
  incomeEvents: IncomeEvent[]
  expenses: Expense[]
  /** Scanned-receipt breakdowns (items + charges); each links to one total expense via `receiptId`. */
  receipts: Receipt[]
  recurringExpenses: RecurringExpense[]
  subscriptions: Subscription[]
  budgetCategories: BudgetCategory[]
  /** Optional multi-plan budget planner; when empty, dashboard uses `budgetCategories`. */
  budgetPlans: BudgetPlan[]
  /** Selected plan for dashboard caps and planner UI; ignored when `budgetPlans` is empty. */
  activeBudgetPlanId: string | null
  /** Which plan was active from which cycle (history log). */
  budgetPlanActivations: BudgetPlanActivation[]
  buddgyMemories: BuddgyMemory[]
  accountAdjustments: AccountAdjustment[]
  savingsHoldings: SavingsHolding[]
  /** v3 investment positions (gold/crypto/stock/property), valued at quantity × live price. */
  investmentHoldings: InvestmentHolding[]
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
  /** Live 24k gold spot, per gram, denominated in the user's base currency. */
  goldPricePerGram: number
  /** ISO time of last successful `/api/gold` fetch (client). */
  lastGoldFetch: string | null
  /** False only when live gold failed AND we never had a good price (no fallback). */
  goldPriceAvailable: boolean
  /** True when the last fetch failed but a prior good price is being shown (delayed). */
  goldPriceStale: boolean
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
  /** Re-inserts a just-deleted expense VERBATIM (same id/timestamps) — powers Undo. */
  restoreExpense: (expense: Expense) => void
  /**
   * Inserts/replaces an already-persisted server row VERBATIM by its real id —
   * no id/timestamp regeneration. Used to ingest SMS-created expenses from
   * realtime/push so the local copy matches the server PK (keeps `flushDiff`
   * upserts idempotent; prevents duplicates and soft-delete eviction).
   */
  upsertServerExpense: (expense: Expense) => void
  /** Inserts a scanned-receipt breakdown row; returns the generated id to link the total expense. */
  addReceipt: (receipt: Omit<Receipt, 'id' | 'createdAt' | 'updatedAt'>) => string
  deleteReceipt: (id: string) => void
  /** Server-row counterpart of {@link upsertServerExpense} for receipts. */
  upsertServerReceipt: (receipt: Receipt) => void
  /** Server-row counterpart of {@link upsertServerExpense} for debt payments (SMS CC payoff). */
  upsertServerDebtPayment: (payment: DebtPayment) => void
  addIncomeSource: (
    source: Omit<IncomeSource, 'id' | 'createdAt' | 'updatedAt' | 'effectiveStart'> & {
      effectiveStart?: string
    }
  ) => void
  /** Server-row counterpart of {@link upsertServerExpense} for income. */
  upsertServerIncome: (source: IncomeSource) => void
  /**
   * Adds income from borrowed money and creates a matching personal debt (`i_owe`) in one update.
   */
  addIncomeWithDebt: (
    income: Omit<
      IncomeSource,
      'id' | 'createdAt' | 'updatedAt' | 'effectiveStart' | 'linkedDebtId' | 'linkedSavingsAccountId' | 'sourceType'
    >,
    debt: Omit<Debt, 'id' | 'createdAt'>
  ) => void
  updateIncomeSource: (id: string, updates: Partial<IncomeSource>) => void
  deleteIncomeSource: (id: string) => void
  addIncomeEvent: (event: Omit<IncomeEvent, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateIncomeEvent: (id: string, updates: Partial<IncomeEvent>) => void
  deleteIncomeEvent: (id: string, deleteLinkedDebt?: boolean) => void
  /** Server-row counterpart for realtime/hydrate upserts. */
  upsertServerIncomeEvent: (event: IncomeEvent) => void
  addPaymentMethod: (method: Omit<PaymentMethod, 'id'>) => string
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
   * A non-card debt that this payment fully covers is cleared in the same update (see `clearIfFullyPaid`).
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
  /** Confirm a detected plan change: adopt pendingPlanId/pendingAmount, clear both. */
  applyPendingPlanChange: (id: string) => void
  /** Reject a detected plan change: clear the pending fields, change nothing else. */
  dismissPendingPlanChange: (id: string) => void
  /** Cancel; access (and the Ended move) lasts until `endsOn` (default: today). */
  cancelSubscription: (id: string, endsOn?: string) => void
  pauseSubscription: (id: string) => void
  resumeSubscription: (id: string) => void
  /** Trial -> active: it now bills from the day after the trial. */
  convertTrial: (id: string) => void
  /** Record the current cycle as paid by writing a linked expense. Idempotent per cycle. */
  markSubscriptionPaid: (id: string, charge?: { amount?: number; date?: string }) => void
  /** Attach existing expenses to a subscription (they become its matched charges). */
  linkSubscriptionCharges: (subId: string, expenseIds: string[]) => void
  /** Detach a charge from its subscription (the expense stays in Flow). */
  unlinkSubscriptionCharge: (expenseId: string) => void
  /** Adopt a new price: the old one goes to priceHistory. */
  adoptSubscriptionPrice: (id: string, amount: number) => void
  /** Create the linked expense for every `log`-mode subscription whose charge is due and unrecorded. */
  logDueSubscriptions: () => void
  deleteSubscription: (id: string) => void
  reactivateSubscription: (id: string) => void
  updateBudgetCategory: (category: string, amount: number, percentOfIncome?: number | null) => void
  /** Replace all budget rows (e.g. onboarding preset). */
  setBudgetCategories: (categories: BudgetCategory[]) => void
  /** Creates a plan and makes it active, unless it is a draft (drafts activate only on confirm). */
  addBudgetPlan: (
    name: string,
    options?: Partial<Pick<BudgetPlan, 'status' | 'intent' | 'origin' | 'rationale' | 'engineVersion'>>
  ) => string
  updateBudgetPlan: (
    planId: string,
    updates: Partial<
      Pick<
        BudgetPlan,
        | 'name' | 'categories' | 'household' | 'buddgyFlow' | 'buddgyGuidedComplete'
        | 'status' | 'intent' | 'origin' | 'incomeOverride' | 'rationale' | 'engineVersion'
      >
    >
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
  /** Makes a plan active from `cycleKey` (`YYYY-MM`) onward and logs it. Returns what Undo needs. */
  activateBudgetPlan: (planId: string, cycleKey: string) => BudgetActivationUndo
  restoreBudgetActivation: (undo: BudgetActivationUndo) => void
  /** Saves a remembered fact; null when it is a duplicate or the 40-fact cap is reached. */
  addBuddgyMemory: (text: string, source: BuddgyMemory['source'], kind?: BuddgyMemory['kind'], planId?: string) => string | null
  removeBuddgyMemory: (id: string) => void
  addAccountAdjustment: (a: Omit<AccountAdjustment, 'id' | 'createdAt' | 'updatedAt'>) => string
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
  addInvestmentHolding: (h: Omit<InvestmentHolding, 'id' | 'createdAt' | 'updatedAt'>) => string
  updateInvestmentHolding: (id: string, updates: Partial<InvestmentHolding>) => void
  deleteInvestmentHolding: (id: string) => void
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
    /** `mode` = where the money came from: 'allocate' (from this month's budget — reduces
     *  left-to-spend, net worth flat) or 'declare' (money from outside the budget — net worth
     *  rises, left-to-spend untouched). Defaults to 'allocate' (the historical behaviour). */
    opts?: { isAutoSave?: boolean; source?: string; mode?: 'allocate' | 'declare'; /** Account the money leaves; stamps the ledger leg so the account balance follows. */ paymentMethodId?: string }
  ) => boolean
  /** Only 'income' returns the money to this month's spendable income; the rest do not,
   *  so a transfer/debt/spend withdrawal never inflates the income KPI. Defaults to 'income'. */
  withdrawFromSavings: (
    accountId: string,
    amount: number,
    currency: Currency,
    notes?: string,
    purpose?: SavingsWithdrawalPurpose
  ) => boolean
  /** Move money between two pockets: two ledger legs sharing a transferGroupId, both
   *  non-cash-flow (net worth and left-to-spend unaffected). FX-converts fiat↔fiat; rejects
   *  a move with no conversion path (e.g. into a gold/crypto pocket — that's a buy, not a transfer). */
  transferBetweenPockets: (fromId: string, toId: string, amount: number, notes?: string) => boolean
  correctSavingsBalance: (accountId: string, newBalance: number, notes?: string) => void
  /** Delete a savings ledger row and reverse its balance effect (both legs for a transfer). */
  deleteSavingsTransaction: (id: string) => void
  updateSettings: (updates: Partial<AppSettings>) => void
  updateProfile: (updates: Partial<UserProfile>) => void
  setFinancialGoalsNotes: (notes: string) => void
  addGoal: (
    goal: Omit<Goal, 'id' | 'createdAt' | 'achievedAt' | 'manualCurrentAmount' | 'fundingMode' | 'sharePct' | 'frequency' | 'planStart'> & {
      manualCurrentAmount?: number
      fundingMode?: GoalFundingMode
      sharePct?: number | null
      frequency?: GoalFrequency
      planStart?: string | null
    }
  ) => string
  updateGoal: (id: string, updates: Partial<Goal>) => void
  deleteGoal: (id: string) => void
  achieveGoal: (id: string) => void
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

/** Where hidden balances are masked. `preset` is a shortcut; the per-surface flags win once edited. */
export interface PrivacySettings {
  preset?: 'off' | 'hero' | 'all' | 'custom'
  hero?: boolean
  lists?: boolean
  notifications?: boolean
  widgets?: boolean
  buddgy?: boolean
}

/** A signed correction on one account (manual balance update or an explained gap). Append-only. */
export interface AccountAdjustment {
  id: string
  paymentMethodId: string
  delta: number
  reason: 'manual_update' | 'gap' | 'opening_correction'
  occurredAt: string
  note?: string
  createdAt: string
  updatedAt: string
}
