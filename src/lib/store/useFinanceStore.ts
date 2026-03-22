import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { tryConvertCurrency } from '@/lib/utils/currency'
import { importDataSchema } from './financeImportSchema'
import type {
  FinanceStore,
  PaymentMethod,
  Debt,
  BudgetCategory,
  IncomeSource,
  AppSettings,
  UserProfile,
} from './types'

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'pm_1', name: 'Silver Nol', type: 'nol', currency: 'AED', color: '#C0C0C0', isDefault: false },
  { id: 'pm_2', name: 'Gold Nol', type: 'nol', currency: 'AED', color: '#F5C842', isDefault: false },
  { id: 'pm_3', name: 'Bank Transfer', type: 'bank_transfer', currency: 'AED', color: '#1DB954', isDefault: true },
  { id: 'pm_4', name: 'Cash', type: 'cash', currency: 'AED', color: '#FFFFFF', isDefault: false },
]

const DEFAULT_DEBTS: Debt[] = [
  {
    id: 'debt_1',
    name: "Mom's Debt",
    person: 'Mom',
    startingBalance: 250000,
    currency: 'EGP',
    isGold: false,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'debt_2',
    name: "Dad's Gold Debt",
    person: 'Dad',
    startingBalance: 50,
    currency: 'XAU',
    isGold: true,
    goldKarat: 24,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
]

const DEFAULT_BUDGET: BudgetCategory[] = [
  { category: 'Rent', budgetedAmount: 3500, currency: 'AED' },
  { category: 'Transport', budgetedAmount: 800, currency: 'AED' },
  { category: 'Food', budgetedAmount: 1200, currency: 'AED' },
  { category: 'Enjoyment', budgetedAmount: 600, currency: 'AED' },
  { category: 'Savings', budgetedAmount: 1000, currency: 'AED' },
  { category: 'Debt', budgetedAmount: 500, currency: 'AED' },
]

const DEFAULT_INCOME: IncomeSource[] = [
  {
    id: 'inc_1',
    name: 'Bask Health',
    amount: 2000,
    currency: 'USD',
    isRecurring: true,
    dayOfMonth: 1,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'inc_2',
    name: 'Omnispay',
    amount: 3000,
    currency: 'AED',
    isRecurring: true,
    dayOfMonth: 1,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
]

const DEFAULT_SETTINGS: AppSettings = {
  baseCurrency: 'AED',
  secondaryCurrency: 'EGP',
  showSecondaryCurrency: true,
  theme: 'dark',
  language: 'en',
  showCentsInDashboard: true,
  monthStartDay: 1,
  budgetEntryMode: 'amount',
  enableAI: false,
  aiProvider: 'gemini',
}

const DEFAULT_PROFILE: UserProfile = {
  id: 'user_1',
  name: 'Mohamed',
  baseCurrency: 'AED',
  createdAt: new Date().toISOString(),
}

export const useFinanceStore = create<FinanceStore>()(
  persist(
    (set, get) => ({
      profile: DEFAULT_PROFILE,
      settings: DEFAULT_SETTINGS,
      incomeSources: DEFAULT_INCOME,
      expenses: [],
      recurringExpenses: [],
      budgetCategories: DEFAULT_BUDGET,
      savingsHoldings: [],
      paymentMethods: DEFAULT_PAYMENT_METHODS,
      debts: DEFAULT_DEBTS,
      debtPayments: [],
      exchangeRates: { USD_AED: 3.6725, EGP_AED: 0.0731, EUR_AED: 4.02, GBP_AED: 4.65, SAR_AED: 0.98 },
      goldPricePerGram: 349.80,
      lastRatesFetch: null,

      addExpense: (expense) => {
        const { exchangeRates, settings } = get()
        const converted = tryConvertCurrency(
          expense.amount,
          expense.currency,
          settings.baseCurrency,
          exchangeRates
        )
        const amountInBaseCurrency = converted ?? expense.amount

        set((state) => ({
          expenses: [
            ...state.expenses,
            {
              ...expense,
              amountInBaseCurrency,
              id: generateId(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }))
      },

      updateExpense: (id, updates) =>
        set((state) => ({
          expenses: state.expenses.map((e) =>
            e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e
          ),
        })),

      deleteExpense: (id) =>
        set((state) => ({
          expenses: state.expenses.filter((e) => e.id !== id),
        })),

      addIncomeSource: (source) =>
        set((state) => ({
          incomeSources: [
            ...state.incomeSources,
            { ...source, id: generateId(), createdAt: new Date().toISOString() },
          ],
        })),

      updateIncomeSource: (id, updates) =>
        set((state) => ({
          incomeSources: state.incomeSources.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        })),

      deleteIncomeSource: (id) =>
        set((state) => ({
          incomeSources: state.incomeSources.filter((s) => s.id !== id),
        })),

      addPaymentMethod: (method) =>
        set((state) => ({
          paymentMethods: method.isDefault
            ? [
                ...state.paymentMethods.map((m) => ({ ...m, isDefault: false })),
                { ...method, id: generateId() },
              ]
            : [
                ...state.paymentMethods,
                { ...method, id: generateId() },
              ],
        })),

      updatePaymentMethod: (id, updates) =>
        set((state) => ({
          paymentMethods: state.paymentMethods.map((m) =>
            m.id === id ? { ...m, ...updates } : m
          ),
        })),

      deletePaymentMethod: (id) =>
        set((state) => ({
          paymentMethods: state.paymentMethods.filter((m) => m.id !== id),
        })),

      addDebt: (debt) =>
        set((state) => ({
          debts: [
            ...state.debts,
            { ...debt, id: generateId(), createdAt: new Date().toISOString() },
          ],
        })),

      updateDebt: (id, updates) =>
        set((state) => ({
          debts: state.debts.map((d) =>
            d.id === id ? { ...d, ...updates } : d
          ),
        })),

      addDebtPayment: (payment) =>
        set((state) => ({
          debtPayments: [
            ...state.debtPayments,
            { ...payment, id: generateId(), createdAt: new Date().toISOString() },
          ],
        })),

      deleteDebt: (id) =>
        set((state) => ({
          debts: state.debts.filter((d) => d.id !== id),
          debtPayments: state.debtPayments.filter((p) => p.debtId !== id),
        })),

      deleteDebtPayment: (id) =>
        set((state) => ({
          debtPayments: state.debtPayments.filter((p) => p.id !== id),
        })),

      addRecurringExpense: (expense) =>
        set((state) => ({
          recurringExpenses: [
            ...state.recurringExpenses,
            { ...expense, id: generateId() },
          ],
        })),

      updateRecurringExpense: (id, updates) =>
        set((state) => ({
          recurringExpenses: state.recurringExpenses.map((e) =>
            e.id === id ? { ...e, ...updates } : e
          ),
        })),

      deleteRecurringExpense: (id) =>
        set((state) => ({
          recurringExpenses: state.recurringExpenses.filter((e) => e.id !== id),
        })),

      updateBudgetCategory: (category, amount, percentOfIncome) =>
        set((state) => ({
          budgetCategories: state.budgetCategories.map((b) =>
            b.category === category
              ? {
                  ...b,
                  budgetedAmount: amount,
                  ...(percentOfIncome !== undefined ? { percentOfIncome } : {}),
                }
              : b
          ),
        })),

      addSavingsHolding: (h) =>
        set((state) => ({
          savingsHoldings: [
            ...state.savingsHoldings,
            {
              ...h,
              id: generateId(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        })),

      updateSavingsHolding: (id, updates) =>
        set((state) => ({
          savingsHoldings: state.savingsHoldings.map((s) =>
            s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s
          ),
        })),

      deleteSavingsHolding: (id) =>
        set((state) => ({
          savingsHoldings: state.savingsHoldings.filter((s) => s.id !== id),
        })),

      updateSettings: (updates) =>
        set((state) => ({
          settings: { ...state.settings, ...updates },
        })),

      updateProfile: (updates) =>
        set((state) => ({
          profile: { ...state.profile, ...updates },
        })),

      updateRates: (rates) =>
        set((state) => ({
          exchangeRates: { ...state.exchangeRates, ...rates },
          lastRatesFetch: new Date().toISOString(),
        })),

      updateGoldPrice: (price) =>
        set(() => ({
          goldPricePerGram: price,
        })),

      importData: (jsonString) => {
        let parsed: unknown
        try {
          parsed = JSON.parse(jsonString)
        } catch {
          throw new Error(
            'Invalid file: could not parse JSON. Make sure you exported a Buddget backup (.json).'
          )
        }

        const result = importDataSchema.safeParse(parsed)
        if (!result.success) {
          const issues = result.error.issues
            .slice(0, 3)
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; ')
          throw new Error(
            issues
              ? `Import failed — invalid data: ${issues}`
              : 'Import failed — data format does not match Buddget export.'
          )
        }

        const data = result.data
        set((state) => ({
          ...state,
          ...data,
          settings: data.settings
            ? { ...state.settings, ...data.settings }
            : state.settings,
        }))
      },

      exportData: () => {
        const state = get()
        const data = {
          profile: state.profile,
          settings: state.settings,
          incomeSources: state.incomeSources,
          expenses: state.expenses,
          recurringExpenses: state.recurringExpenses,
          budgetCategories: state.budgetCategories,
          savingsHoldings: state.savingsHoldings,
          paymentMethods: state.paymentMethods,
          debts: state.debts,
          debtPayments: state.debtPayments,
        }
        return JSON.stringify(data, null, 2)
      },

      resetAllData: () =>
        set({
          profile: DEFAULT_PROFILE,
          settings: DEFAULT_SETTINGS,
          incomeSources: DEFAULT_INCOME,
          expenses: [],
          recurringExpenses: [],
          budgetCategories: DEFAULT_BUDGET,
          savingsHoldings: [],
          paymentMethods: DEFAULT_PAYMENT_METHODS,
          debts: DEFAULT_DEBTS,
          debtPayments: [],
          exchangeRates: { USD_AED: 3.6725, EGP_AED: 0.0731, EUR_AED: 4.02, GBP_AED: 4.65, SAR_AED: 0.98 },
          goldPricePerGram: 349.80,
          lastRatesFetch: null,
        }),
    }),
    {
      name: 'buddget-storage',
      storage: createJSONStorage(() => localStorage),
      merge: (persisted, current) => {
        const p = persisted as Partial<typeof current>
        return {
          ...current,
          ...p,
          savingsHoldings: p.savingsHoldings ?? current.savingsHoldings,
          settings: {
            ...current.settings,
            ...p.settings,
            budgetEntryMode: p.settings?.budgetEntryMode ?? current.settings.budgetEntryMode,
            enableAI: p.settings?.enableAI ?? current.settings.enableAI,
            aiProvider: p.settings?.aiProvider ?? current.settings.aiProvider,
          },
        }
      },
    }
  )
)
