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
  currency: 'AED',
}))

/** One default method so “add expense” always has a valid payment method. */
export const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: 'pm_default_cash',
    name: 'Cash',
    type: 'cash',
    currency: 'AED',
    color: '#A3A3A3',
    isDefault: true,
  },
]

export const DEFAULT_INCOME: IncomeSource[] = []
export const DEFAULT_DEBTS: Debt[] = []

export const DEFAULT_SETTINGS: AppSettings = {
  baseCurrency: 'AED',
  secondaryCurrency: null,
  showSecondaryCurrency: false,
  theme: 'light',
  language: 'en',
  showCentsInDashboard: true,
  monthStartDay: 1,
  budgetEntryMode: 'amount',
  enableAI: true,
  aiProvider: 'gemini',
  noIncomeDeclared: false,
  showAllCurrenciesInForms: true,
  dismissOnboardingBanner: false,
  onboardingBannerRemindAt: null,
  twoFactorEmailEnabled: false,
}

export const DEFAULT_PROFILE: UserProfile = {
  id: 'local',
  name: '',
  baseCurrency: 'AED',
  createdAt: new Date().toISOString(),
}

/** New profile snapshot after logout / reset — no avatar, location, or cached URLs. */
export function createFreshDefaultProfile(): UserProfile {
  return {
    id: 'local',
    name: '',
    baseCurrency: 'AED',
    createdAt: new Date().toISOString(),
  }
}

/** FX / gold defaults for conversions and Settings display (not user-specific). */
export const DEFAULT_MARKET_RATES: Record<string, number> = {
  USD_AED: 3.6725,
  USD_EGP: 53.1,
  EGP_AED: 0.0692,
  AED_EGP: 14.45,
  EUR_AED: 4.15,
  GBP_AED: 4.78,
  SAR_AED: 0.98,
}

// Gold ~$4,760/oz ÷ 31.1035 × 3.6725 = ~562 AED/gram (Apr 2026)
export const DEFAULT_GOLD_PRICE_PER_GRAM = 562
