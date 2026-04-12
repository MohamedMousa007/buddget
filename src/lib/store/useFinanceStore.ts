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
  createFreshDefaultProfile,
} from './defaultFinanceData'
import type { BudgetPlanCategory, FinanceStore, OnboardingState } from './types'
import { defaultOnboardingState } from '@/lib/onboarding/onboardingTypes'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'

const PERSIST_VERSION = 7

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

function migrateShowAllCurrenciesInForms(prevSettings: Record<string, unknown>): boolean {
  if (typeof prevSettings.showAllCurrenciesInForms === 'boolean') return prevSettings.showAllCurrenciesInForms
  if (prevSettings.currencyDropdownScope === 'all') return true
  if (
    prevSettings.currencyDropdownScope === 'primary_only' ||
    prevSettings.currencyDropdownScope === 'primary_and_secondary'
  ) {
    return false
  }
  return DEFAULT_SETTINGS.showAllCurrenciesInForms
}

export const useFinanceStore = create<FinanceStore>()(
  persist(
    (set, get) => ({
      profile: DEFAULT_PROFILE,
      settings: DEFAULT_SETTINGS,
      financialGoalsNotes: '',
      onboardingState: defaultOnboardingState(),
      incomeSources: DEFAULT_INCOME,
      expenses: [],
      recurringExpenses: [],
      budgetCategories: DEFAULT_BUDGET,
      budgetPlans: [],
      activeBudgetPlanId: null,
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
            {
              ...source,
              id: generateId(),
              createdAt: new Date().toISOString(),
            },
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

      addDebt: (debt) => {
        const id = generateId()
        set((state) => ({
          debts: [
            ...state.debts,
            {
              ...debt,
              id,
              createdAt: new Date().toISOString(),
            },
          ],
        }))
        return id
      },

      updateDebt: (id, updates) =>
        set((state) => ({
          debts: state.debts.map((d) =>
            d.id === id ? { ...d, ...updates } : d
          ),
        })),

      clearDebt: (id, clearedAtIsoDate) =>
        set((state) => ({
          debts: state.debts.map((d) =>
            d.id === id
              ? {
                  ...d,
                  status: 'cleared',
                  clearedAt: clearedAtIsoDate ?? new Date().toISOString().slice(0, 10),
                }
              : d
          ),
        })),

      addDebtPaymentWithExpense: (payment, expense) => {
        const { exchangeRates, settings } = get()
        const converted = tryConvertCurrency(
          expense.amount,
          expense.currency,
          settings.baseCurrency,
          exchangeRates
        )
        const amountInBaseCurrency = converted ?? expense.amount

        set((state) => ({
          debtPayments: [
            ...state.debtPayments,
            { ...payment, id: generateId(), createdAt: new Date().toISOString() },
          ],
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

      addBudgetPlan: (name) => {
        const id = generateId()
        const trimmed = name.trim() || 'New plan'
        set((state) => ({
          budgetPlans: [
            ...state.budgetPlans,
            {
              id,
              name: trimmed,
              categories: [],
              createdAt: new Date().toISOString(),
              household: null,
              buddgyFlow: null,
            },
          ],
          activeBudgetPlanId: id,
        }))
        return id
      },

      updateBudgetPlan: (planId, updates) =>
        set((state) => ({
          budgetPlans: state.budgetPlans.map((p) => {
            if (p.id !== planId) return p
            const nextName =
              updates.name !== undefined ? updates.name.trim() || p.name : p.name
            const nextCategories =
              updates.categories !== undefined ? updates.categories : p.categories
            const nextHousehold =
              updates.household !== undefined ? updates.household : p.household
            const nextBuddgyGuidedComplete =
              updates.buddgyGuidedComplete !== undefined ? updates.buddgyGuidedComplete : p.buddgyGuidedComplete
            let nextBuddgyFlow = p.buddgyFlow
            if (updates.buddgyFlow !== undefined) {
              nextBuddgyFlow =
                updates.buddgyFlow === null ?
                  null
                : { ...(p.buddgyFlow ?? {}), ...updates.buddgyFlow }
            }
            return {
              ...p,
              name: nextName,
              categories: nextCategories,
              household: nextHousehold,
              buddgyGuidedComplete: nextBuddgyGuidedComplete,
              buddgyFlow: nextBuddgyFlow,
            }
          }),
        })),

      updateBudgetMeta: (planId, updates) => {
        get().updateBudgetPlan(planId, updates)
      },

      replaceBudgetPlanCategories: (planId, categories) => {
        get().updateBudgetPlan(planId, { categories })
      },

      setFinancialGoalsNotes: (notes) => set({ financialGoalsNotes: notes }),

      deleteBudgetPlan: (planId) =>
        set((state) => {
          const next = state.budgetPlans.filter((p) => p.id !== planId)
          let active = state.activeBudgetPlanId
          if (active === planId) {
            active = next[0]?.id ?? null
          }
          return { budgetPlans: next, activeBudgetPlanId: active }
        }),

      setActiveBudgetPlanId: (id) => set({ activeBudgetPlanId: id }),

      addPlanCategory: (planId, category) => {
        const catId = generateId()
        set((state) => ({
          budgetPlans: state.budgetPlans.map((p) => {
            if (p.id !== planId) return p
            const rowCurrency = clampFiatToAllowed(
              state.settings,
              category.currency ?? state.settings.baseCurrency
            )
            const row: BudgetPlanCategory = {
              id: catId,
              name: category.name.trim() || 'Category',
              icon: category.icon || '📦',
              amount: Number.isFinite(category.amount) ? category.amount : 0,
              currency: rowCurrency,
              subcategories: (category.subcategories ?? []).map((s) => ({
                ...s,
                id: s.id || generateId(),
                name: s.name.trim() || 'Subcategory',
                amount: Number.isFinite(s.amount) ? s.amount : 0,
              })),
            }
            return { ...p, categories: [...p.categories, row] }
          }),
        }))
        return catId
      },

      updatePlanCategory: (planId, categoryId, updates) =>
        set((state) => ({
          budgetPlans: state.budgetPlans.map((p) => {
            if (p.id !== planId) return p
            return {
              ...p,
              categories: p.categories.map((c) => {
                if (c.id !== categoryId) return c
                const nextSubs =
                  updates.subcategories !== undefined
                    ? updates.subcategories.map((s) => ({
                        id: s.id || generateId(),
                        name: (s.name || '').trim() || 'Subcategory',
                        amount: Number.isFinite(s.amount) ? s.amount : 0,
                      }))
                    : c.subcategories
                return {
                  ...c,
                  ...(updates.name !== undefined ? { name: updates.name } : {}),
                  ...(updates.icon !== undefined ? { icon: updates.icon } : {}),
                  ...(updates.amount !== undefined
                    ? { amount: Number.isFinite(updates.amount) ? updates.amount : 0 }
                    : {}),
                  ...(updates.currency !== undefined
                    ? {
                        currency: clampFiatToAllowed(state.settings, updates.currency),
                      }
                    : {}),
                  subcategories: nextSubs,
                }
              }),
            }
          }),
        })),

      deletePlanCategory: (planId, categoryId) =>
        set((state) => ({
          budgetPlans: state.budgetPlans.map((p) =>
            p.id === planId
              ? { ...p, categories: p.categories.filter((c) => c.id !== categoryId) }
              : p
          ),
        })),

      addPlanSubcategory: (planId, categoryId, sub) => {
        const sid = generateId()
        set((state) => ({
          budgetPlans: state.budgetPlans.map((p) => {
            if (p.id !== planId) return p
            return {
              ...p,
              categories: p.categories.map((c) => {
                if (c.id !== categoryId) return c
                return {
                  ...c,
                  subcategories: [
                    ...c.subcategories,
                    {
                      id: sid,
                      name: sub.name,
                      amount: Number.isFinite(sub.amount) ? sub.amount : 0,
                      ...(sub.icon !== undefined ? { icon: sub.icon } : {}),
                    },
                  ],
                }
              }),
            }
          }),
        }))
        return sid
      },

      updatePlanSubcategory: (planId, categoryId, subId, updates) =>
        set((state) => ({
          budgetPlans: state.budgetPlans.map((p) => {
            if (p.id !== planId) return p
            return {
              ...p,
              categories: p.categories.map((c) => {
                if (c.id !== categoryId) return c
                return {
                  ...c,
                  subcategories: c.subcategories.map((s) =>
                    s.id === subId
                      ? {
                          ...s,
                          ...(updates.name !== undefined ? { name: updates.name } : {}),
                          ...(updates.amount !== undefined
                            ? { amount: Number.isFinite(updates.amount) ? updates.amount : 0 }
                            : {}),
                          ...(updates.icon !== undefined ? { icon: updates.icon } : {}),
                        }
                      : s
                  ),
                }
              }),
            }
          }),
        })),

      deletePlanSubcategory: (planId, categoryId, subId) =>
        set((state) => ({
          budgetPlans: state.budgetPlans.map((p) => {
            if (p.id !== planId) return p
            return {
              ...p,
              categories: p.categories.map((c) =>
                c.id === categoryId
                  ? { ...c, subcategories: c.subcategories.filter((s) => s.id !== subId) }
                  : c
              ),
            }
          }),
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


      setOnboardingState: (updates) =>
        set((state) => {
          const next =
            typeof updates === 'function'
              ? updates(state.onboardingState)
              : { ...state.onboardingState, ...updates }
          return { onboardingState: next }
        }),

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
          budgetPlans: data.budgetPlans ?? state.budgetPlans,
          activeBudgetPlanId:
            data.activeBudgetPlanId !== undefined ? data.activeBudgetPlanId : state.activeBudgetPlanId,
          financialGoalsNotes:
            data.financialGoalsNotes !== undefined ? data.financialGoalsNotes : state.financialGoalsNotes,
          settings: data.settings
            ? { ...state.settings, ...data.settings }
            : state.settings,
          onboardingState: data.onboardingState
            ? { ...defaultOnboardingState(), ...data.onboardingState }
            : state.onboardingState,
        }))
      },

      exportData: () => {
        const state = get()
        const data = {
          profile: state.profile,
          settings: state.settings,
          onboardingState: state.onboardingState,
          incomeSources: state.incomeSources,
          expenses: state.expenses,
          recurringExpenses: state.recurringExpenses,
          budgetCategories: state.budgetCategories,
          budgetPlans: state.budgetPlans,
          activeBudgetPlanId: state.activeBudgetPlanId,
          financialGoalsNotes: state.financialGoalsNotes,
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
          profile: createFreshDefaultProfile(),
          settings: { ...DEFAULT_SETTINGS },
          onboardingState: defaultOnboardingState(),
          incomeSources: DEFAULT_INCOME,
          expenses: [],
          recurringExpenses: [],
          budgetCategories: DEFAULT_BUDGET,
          budgetPlans: [],
          activeBudgetPlanId: null,
          financialGoalsNotes: '',
          savingsHoldings: [],
          paymentMethods: DEFAULT_PAYMENT_METHODS,
          debts: DEFAULT_DEBTS,
          debtPayments: [],
          recurringDebtPayments: [],
          exchangeRates: { ...DEFAULT_MARKET_RATES },
          goldPricePerGram: DEFAULT_GOLD_PRICE_PER_GRAM,
          lastRatesFetch: null,
        }),

      /** Alias for `resetAllData` (logout / wipe client state). */
      reset: () => get().resetAllData(),
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
        if (fromVersion >= 6) {
          const prevSettings = (p.settings as Record<string, unknown> | undefined) || {}
          return {
            ...p,
            budgetPlans: Array.isArray(p.budgetPlans) ? p.budgetPlans : [],
            activeBudgetPlanId:
              typeof p.activeBudgetPlanId === 'string' || p.activeBudgetPlanId === null
                ? p.activeBudgetPlanId
                : null,
            onboardingState: (p.onboardingState as OnboardingState | undefined) ?? defaultOnboardingState(),
            recurringDebtPayments: Array.isArray(p.recurringDebtPayments)
              ? p.recurringDebtPayments
              : [],
            settings: {
              ...DEFAULT_SETTINGS,
              ...prevSettings,
              noIncomeDeclared: Boolean(prevSettings.noIncomeDeclared),
              showAllCurrenciesInForms: migrateShowAllCurrenciesInForms(prevSettings),
            },
          } as never
        }
        if (fromVersion >= 5) {
          const prevSettings = (p.settings as Record<string, unknown> | undefined) || {}
          return {
            ...p,
            budgetPlans: Array.isArray(p.budgetPlans) ? p.budgetPlans : [],
            activeBudgetPlanId:
              typeof p.activeBudgetPlanId === 'string' || p.activeBudgetPlanId === null
                ? p.activeBudgetPlanId
                : null,
            onboardingState: (p.onboardingState as OnboardingState | undefined) ?? defaultOnboardingState(),
            recurringDebtPayments: Array.isArray(p.recurringDebtPayments)
              ? p.recurringDebtPayments
              : [],
            settings: {
              ...DEFAULT_SETTINGS,
              ...prevSettings,
              noIncomeDeclared: Boolean(prevSettings.noIncomeDeclared),
              showAllCurrenciesInForms: migrateShowAllCurrenciesInForms(prevSettings),
            },
          } as never
        }
        if (fromVersion >= 3) {
          const prevSettings = (p.settings as Record<string, unknown> | undefined) || {}
          return {
            ...p,
            onboardingState: (p.onboardingState as OnboardingState | undefined) ?? defaultOnboardingState(),
            recurringDebtPayments: Array.isArray(p.recurringDebtPayments)
              ? p.recurringDebtPayments
              : [],
            settings: {
              ...DEFAULT_SETTINGS,
              ...prevSettings,
              noIncomeDeclared: Boolean(prevSettings.noIncomeDeclared),
              showAllCurrenciesInForms: migrateShowAllCurrenciesInForms(prevSettings),
            },
          } as never
        }
        if (fromVersion >= 2) {
          const prevSettings = (p.settings as Record<string, unknown> | undefined) || {}
          return {
            ...p,
            onboardingState: (p.onboardingState as OnboardingState | undefined) ?? defaultOnboardingState(),
            recurringDebtPayments: [],
            settings: {
              ...DEFAULT_SETTINGS,
              ...prevSettings,
              noIncomeDeclared: Boolean(prevSettings.noIncomeDeclared),
              showAllCurrenciesInForms: migrateShowAllCurrenciesInForms(prevSettings),
            },
          } as never
        }
        return {
          ...p,
          profile: DEFAULT_PROFILE,
          settings: { ...DEFAULT_SETTINGS, noIncomeDeclared: false },
          onboardingState: defaultOnboardingState(),
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
          financialGoalsNotes: p.financialGoalsNotes ?? current.financialGoalsNotes,
          budgetPlans: p.budgetPlans ?? current.budgetPlans,
          activeBudgetPlanId:
            p.activeBudgetPlanId !== undefined ? p.activeBudgetPlanId : current.activeBudgetPlanId,
          savingsHoldings: p.savingsHoldings ?? current.savingsHoldings,
          recurringDebtPayments: p.recurringDebtPayments ?? current.recurringDebtPayments,
          onboardingState: p.onboardingState
            ? { ...current.onboardingState, ...p.onboardingState }
            : current.onboardingState,
          settings: {
            ...current.settings,
            ...p.settings,
            budgetEntryMode: p.settings?.budgetEntryMode ?? current.settings.budgetEntryMode,
            enableAI: p.settings?.enableAI ?? current.settings.enableAI,
            aiProvider: p.settings?.aiProvider ?? current.settings.aiProvider,
            noIncomeDeclared: p.settings?.noIncomeDeclared ?? current.settings.noIncomeDeclared,
            showAllCurrenciesInForms: (() => {
              const ps = p.settings as
                | (typeof p.settings & {
                    currencyDropdownScope?: 'all' | 'primary_only' | 'primary_and_secondary'
                  })
                | undefined
              if (typeof ps?.showAllCurrenciesInForms === 'boolean') return ps.showAllCurrenciesInForms
              if (ps?.currencyDropdownScope === 'all') return true
              if (
                ps?.currencyDropdownScope === 'primary_only' ||
                ps?.currencyDropdownScope === 'primary_and_secondary'
              )
                return false
              return current.settings.showAllCurrenciesInForms
            })(),
          },
        }
      },
    }
  )
)
