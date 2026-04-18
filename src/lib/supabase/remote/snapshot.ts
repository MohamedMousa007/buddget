import type { FinanceStore, UserProfile, AppSettings, OnboardingState, PaymentMethod, IncomeSource, Expense, RecurringExpense, Subscription, Debt, DebtPayment, RecurringDebtPayment, SavingsAccount, SavingsHolding, SavingsTransaction, RecurringSavingsDeposit, Goal, BudgetPlan } from '@/lib/store/types'

/**
 * Mirror of the finance store slices we persist to Supabase. Used to compute diffs
 * between last-flushed snapshot and current state.
 */
export interface Snapshot {
  profile: UserProfile
  settings: AppSettings
  onboardingState: OnboardingState
  financialGoalsNotes: string
  activeBudgetPlanId: string | null
  paymentMethods: PaymentMethod[]
  incomeSources: IncomeSource[]
  expenses: Expense[]
  recurringExpenses: RecurringExpense[]
  subscriptions: Subscription[]
  debts: Debt[]
  debtPayments: DebtPayment[]
  recurringDebtPayments: RecurringDebtPayment[]
  savingsAccounts: SavingsAccount[]
  savingsHoldings: SavingsHolding[]
  savingsTransactions: SavingsTransaction[]
  recurringSavingsDeposits: RecurringSavingsDeposit[]
  goals: Goal[]
  budgetPlans: BudgetPlan[]
}

/** Copy the parts of the Zustand store that map to DB rows. Plain JSON; safe to `deepEqual` on. */
export function snapshot(state: Pick<FinanceStore,
  | 'profile' | 'settings' | 'onboardingState' | 'financialGoalsNotes' | 'activeBudgetPlanId'
  | 'paymentMethods' | 'incomeSources' | 'expenses' | 'recurringExpenses'
  | 'subscriptions' | 'debts' | 'debtPayments' | 'recurringDebtPayments'
  | 'savingsAccounts' | 'savingsHoldings' | 'savingsTransactions' | 'recurringSavingsDeposits'
  | 'goals' | 'budgetPlans'
>): Snapshot {
  return {
    profile: state.profile,
    settings: state.settings,
    onboardingState: state.onboardingState,
    financialGoalsNotes: state.financialGoalsNotes,
    activeBudgetPlanId: state.activeBudgetPlanId,
    paymentMethods: state.paymentMethods,
    incomeSources: state.incomeSources,
    expenses: state.expenses,
    recurringExpenses: state.recurringExpenses,
    subscriptions: state.subscriptions,
    debts: state.debts,
    debtPayments: state.debtPayments,
    recurringDebtPayments: state.recurringDebtPayments,
    savingsAccounts: state.savingsAccounts,
    savingsHoldings: state.savingsHoldings,
    savingsTransactions: state.savingsTransactions,
    recurringSavingsDeposits: state.recurringSavingsDeposits,
    goals: state.goals,
    budgetPlans: state.budgetPlans,
  }
}

export function emptySnapshot(): Snapshot {
  return {
    profile: { id: 'local', name: '', baseCurrency: 'AED', createdAt: new Date().toISOString() },
    settings: {
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
      onboardingChecklistHidden: false,
      legacyOnboardingMigratedAt: null,
    },
    onboardingState: {
      flowVersion: 2,
      answers: {},
      currentStepIndex: 0,
      planAccepted: false,
      selectedPlanIndex: null,
      aiPlans: null,
      aiGeneratedAt: null,
      lastValidationNotes: null,
    },
    financialGoalsNotes: '',
    activeBudgetPlanId: null,
    paymentMethods: [],
    incomeSources: [],
    expenses: [],
    recurringExpenses: [],
    subscriptions: [],
    debts: [],
    debtPayments: [],
    recurringDebtPayments: [],
    savingsAccounts: [],
    savingsHoldings: [],
    savingsTransactions: [],
    recurringSavingsDeposits: [],
    goals: [],
    budgetPlans: [],
  }
}
