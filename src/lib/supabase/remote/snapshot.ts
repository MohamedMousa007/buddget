import type {
  BudgetPlanActivation, BuddgyMemory, FinanceStore, UserProfile, AppSettings, PaymentMethod, IncomeSource, IncomeEvent, Expense, Receipt, RecurringExpense, Subscription, Debt, DebtPayment, RecurringDebtPayment, SavingsAccount, InvestmentHolding, SavingsTransaction, RecurringSavingsDeposit, Goal, BudgetPlan } from '@/lib/store/types'

/**
 * Mirror of the finance store slices we persist to Supabase. Used to compute diffs
 * between last-flushed snapshot and current state.
 */
export interface Snapshot {
  profile: UserProfile
  settings: AppSettings
  financialGoalsNotes: string
  activeBudgetPlanId: string | null
  paymentMethods: PaymentMethod[]
  incomeSources: IncomeSource[]
  incomeEvents: IncomeEvent[]
  expenses: Expense[]
  receipts: Receipt[]
  recurringExpenses: RecurringExpense[]
  subscriptions: Subscription[]
  debts: Debt[]
  debtPayments: DebtPayment[]
  recurringDebtPayments: RecurringDebtPayment[]
  savingsAccounts: SavingsAccount[]
  investmentHoldings: InvestmentHolding[]
  savingsTransactions: SavingsTransaction[]
  recurringSavingsDeposits: RecurringSavingsDeposit[]
  goals: Goal[]
  budgetPlans: BudgetPlan[]
  budgetPlanActivations: BudgetPlanActivation[]
  buddgyMemories: BuddgyMemory[]
}

/** Copy the parts of the Zustand store that map to DB rows. Plain JSON; safe to `deepEqual` on. */
export function snapshot(state: Pick<FinanceStore,
  | 'profile' | 'settings' | 'financialGoalsNotes' | 'activeBudgetPlanId'
  | 'paymentMethods' | 'incomeSources' | 'incomeEvents' | 'expenses' | 'receipts' | 'recurringExpenses'
  | 'subscriptions' | 'debts' | 'debtPayments' | 'recurringDebtPayments'
  | 'savingsAccounts' | 'investmentHoldings' | 'savingsTransactions' | 'recurringSavingsDeposits'
  | 'goals' | 'budgetPlans' | 'budgetPlanActivations' | 'buddgyMemories'
>): Snapshot {
  return {
    profile: state.profile,
    settings: state.settings,
    financialGoalsNotes: state.financialGoalsNotes,
    activeBudgetPlanId: state.activeBudgetPlanId,
    paymentMethods: state.paymentMethods,
    incomeSources: state.incomeSources,
    incomeEvents: state.incomeEvents,
    expenses: state.expenses,
    receipts: state.receipts,
    recurringExpenses: state.recurringExpenses,
    subscriptions: state.subscriptions,
    debts: state.debts,
    debtPayments: state.debtPayments,
    recurringDebtPayments: state.recurringDebtPayments,
    savingsAccounts: state.savingsAccounts,
    investmentHoldings: state.investmentHoldings,
    savingsTransactions: state.savingsTransactions,
    recurringSavingsDeposits: state.recurringSavingsDeposits,
    goals: state.goals,
    budgetPlans: state.budgetPlans,
    budgetPlanActivations: state.budgetPlanActivations,
    buddgyMemories: state.buddgyMemories,
  }
}

export function emptySnapshot(): Snapshot {
  return {
    profile: { id: 'local', name: '', createdAt: new Date().toISOString() },
    settings: {
      baseCurrency: 'AED',
      secondaryCurrency: null,
      showSecondaryCurrency: false,
      theme: 'dark',
      language: 'en',
      showCentsInDashboard: true,
      monthStartDay: 1,
      budgetEntryMode: 'amount',
      enableAI: true,
      aiProvider: 'gemini',
      noIncomeDeclared: false,
      showAllCurrenciesInForms: true,
      twoFactorEmailEnabled: false,
      legacyOnboardingMigratedAt: null,
      dashboardLayout: 'standard' as const,
      tutorialsCompleted: [] as string[],
      tutorialCurrentStep: null as string | null,
      smsTrackingEnabled: false,
        subDueReminders: true,
        subPriceAlerts: true,
        goalProgressAlerts: true,
        goalAlerts: true,
    },
    financialGoalsNotes: '',
    activeBudgetPlanId: null,
    paymentMethods: [],
    incomeSources: [],
    incomeEvents: [],
    expenses: [],
    receipts: [],
    recurringExpenses: [],
    subscriptions: [],
    debts: [],
    debtPayments: [],
    recurringDebtPayments: [],
    savingsAccounts: [],
    investmentHoldings: [],
    savingsTransactions: [],
    recurringSavingsDeposits: [],
    goals: [],
    budgetPlans: [],
    budgetPlanActivations: [],
    buddgyMemories: [],
  }
}
