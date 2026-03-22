import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { tryConvertCurrency } from '@/lib/utils/currency'
import { importDataSchema } from './financeImportSchema'
import {
  DEFAULT_BUDGET,
  DEFAULT_DEBTS,
  DEFAULT_GOLD_PRICE_PER_GRAM,
  DEFAULT_INCOME,
  DEFAULT_MARKET_RATES,
  DEFAULT_PAYMENT_METHODS,
  DEFAULT_PROFILE,
  DEFAULT_SETTINGS,
} from './defaultFinanceData'
import type { FinanceStore } from './types'

const PERSIST_VERSION = 4

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
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
      recurringDebtPayments: [],
      exchangeRates: { ...DEFAULT_MARKET_RATES },
      goldPricePerGram: DEFAULT_GOLD_PRICE_PER_GRAM,
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
          settings: { ...state.settings, noIncomeDeclared: false },
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
          recurringDebtPayments: state.recurringDebtPayments.filter((r) => r.debtId !== id),
        })),

      deleteDebtPayment: (id) =>
        set((state) => ({
          debtPayments: state.debtPayments.filter((p) => p.id !== id),
        })),

      addRecurringDebtPayment: (r) =>
        set((state) => ({
          recurringDebtPayments: [
            ...state.recurringDebtPayments,
            { ...r, id: generateId(), createdAt: new Date().toISOString() },
          ],
        })),

      updateRecurringDebtPayment: (id, updates) =>
        set((state) => ({
          recurringDebtPayments: state.recurringDebtPayments.map((x) =>
            x.id === id ? { ...x, ...updates } : x
          ),
        })),

      deleteRecurringDebtPayment: (id) =>
        set((state) => ({
          recurringDebtPayments: state.recurringDebtPayments.filter((x) => x.id !== id),
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

      setBudgetCategories: (categories) => set({ budgetCategories: categories }),

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
          recurringDebtPayments: state.recurringDebtPayments,
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
          recurringDebtPayments: [],
          exchangeRates: { ...DEFAULT_MARKET_RATES },
          goldPricePerGram: DEFAULT_GOLD_PRICE_PER_GRAM,
          lastRatesFetch: null,
        }),
    }),
    {
      name: 'buddget-storage',
      version: PERSIST_VERSION,
      migrate: (persistedState, fromVersion) => {
        if (fromVersion >= PERSIST_VERSION) return persistedState as never
        const p =
          persistedState && typeof persistedState === 'object'
            ? (persistedState as Record<string, unknown>)
            : {}
        if (fromVersion >= 3) {
          const prevSettings = (p.settings as Record<string, unknown> | undefined) || {}
          return {
            ...p,
            recurringDebtPayments: Array.isArray(p.recurringDebtPayments)
              ? p.recurringDebtPayments
              : [],
            settings: {
              ...DEFAULT_SETTINGS,
              ...prevSettings,
              noIncomeDeclared: Boolean(prevSettings.noIncomeDeclared),
            },
          } as never
        }
        if (fromVersion >= 2) {
          const prevSettings = (p.settings as Record<string, unknown> | undefined) || {}
          return {
            ...p,
            recurringDebtPayments: [],
            settings: {
              ...DEFAULT_SETTINGS,
              ...prevSettings,
              noIncomeDeclared: Boolean(prevSettings.noIncomeDeclared),
            },
          } as never
        }
        return {
          ...p,
          profile: DEFAULT_PROFILE,
          settings: { ...DEFAULT_SETTINGS, noIncomeDeclared: false },
          incomeSources: [],
          expenses: [],
          recurringExpenses: [],
          budgetCategories: DEFAULT_BUDGET,
          savingsHoldings: [],
          paymentMethods: DEFAULT_PAYMENT_METHODS,
          debts: [],
          debtPayments: [],
          recurringDebtPayments: [],
          exchangeRates: { ...DEFAULT_MARKET_RATES },
          goldPricePerGram: DEFAULT_GOLD_PRICE_PER_GRAM,
          lastRatesFetch: null,
        } as never
      },
      storage: createJSONStorage(() => localStorage),
      merge: (persisted, current) => {
        const p = persisted as Partial<typeof current>
        return {
          ...current,
          ...p,
          savingsHoldings: p.savingsHoldings ?? current.savingsHoldings,
          recurringDebtPayments: p.recurringDebtPayments ?? current.recurringDebtPayments,
          settings: {
            ...current.settings,
            ...p.settings,
            budgetEntryMode: p.settings?.budgetEntryMode ?? current.settings.budgetEntryMode,
            enableAI: p.settings?.enableAI ?? current.settings.enableAI,
            aiProvider: p.settings?.aiProvider ?? current.settings.aiProvider,
            noIncomeDeclared: p.settings?.noIncomeDeclared ?? current.settings.noIncomeDeclared,
          },
        }
      },
    }
  )
)
