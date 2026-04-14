import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { convertCurrency, tryConvertCurrency } from '@/lib/utils/currency'
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
import type {
  BudgetPlanCategory,
  FinanceStore,
  OnboardingState,
  RecurringSavingsDeposit,
  SavingsAccount,
  SavingsHolding,
  SavingsTransaction,
  SavingsType,
} from './types'
import { defaultOnboardingState } from '@/lib/onboarding/onboardingTypes'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import { SAVINGS_TYPE_ICONS } from '@/lib/constants/savingsIcons'
import { normalizeSavingsAccountsList } from '@/lib/savings/normalizeSavingsAccount'
import { defaultCategoryForSavingsType } from '@/lib/constants/savingsTypes'
import { createSafeLocalStorage } from '@/lib/store/safeLocalStorage'

const PERSIST_VERSION = 11

function holdingSubtypeToSavingsType(sub: SavingsHolding['subtype']): SavingsType {
  const m: Record<SavingsHolding['subtype'], SavingsType> = {
    bank: 'bank',
    cash: 'cash',
    gold: 'gold',
    stocks: 'stocks',
    crypto: 'crypto',
    real_estate: 'real_estate',
    other: 'other',
  }
  return m[sub]
}

function migrateSavingsHoldingsToLedger(
  holdings: SavingsHolding[],
  genId: () => string
): { accounts: SavingsAccount[]; transactions: SavingsTransaction[] } {
  const accounts: SavingsAccount[] = []
  const transactions: SavingsTransaction[] = []
  for (const h of holdings) {
    const st = holdingSubtypeToSavingsType(h.subtype)
    accounts.push({
      id: h.id,
      name: h.name,
      category: defaultCategoryForSavingsType(st),
      type: st,
      icon: SAVINGS_TYPE_ICONS[st],
      currency: h.currency,
      currentBalance: h.amount,
      createdAt: h.createdAt,
      notes: h.notes,
    })
    if (h.amount > 0.00001) {
      transactions.push({
        id: genId(),
        accountId: h.id,
        type: 'deposit',
        amount: h.amount,
        currency: h.currency,
        date: (h.asOfDate || h.createdAt).slice(0, 10),
        notes: 'Balance from previous savings record',
      })
    }
  }
  return { accounts, transactions }
}

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
      savingsAccounts: [],
      savingsTransactions: [],
      recurringSavingsDeposits: [],
      paymentMethods: DEFAULT_PAYMENT_METHODS,
      debts: DEFAULT_DEBTS,
      debtPayments: [],
      recurringDebtPayments: [],
      exchangeRates: { ...DEFAULT_MARKET_RATES },
      goldPricePerGram: DEFAULT_GOLD_PRICE_PER_GRAM,
      lastGoldFetch: null,
      goldPriceAvailable: true,
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

      addSavingsAccount: (a) => {
        const input = a as Omit<SavingsAccount, 'id' | 'createdAt' | 'currentBalance'> & {
          openingBalance?: number
        }
        const { openingBalance: openingField, ...rest } = input
        const openingBalance = Math.max(0, Number(openingField) || 0)
        const id = generateId()
        const today = new Date().toISOString().slice(0, 10)
        set((state) => {
          const row: SavingsAccount = {
            ...rest,
            category: rest.category ?? defaultCategoryForSavingsType(rest.type),
            id,
            currentBalance: openingBalance,
            createdAt: new Date().toISOString(),
          }
          const nextTx =
            openingBalance > 0.00001
              ? [
                  ...state.savingsTransactions,
                  {
                    id: generateId(),
                    accountId: id,
                    type: 'deposit' as const,
                    amount: openingBalance,
                    currency: row.currency,
                    date: today,
                    notes: 'Opening balance',
                  },
                ]
              : state.savingsTransactions
          return {
            savingsAccounts: [...state.savingsAccounts, row],
            savingsTransactions: nextTx,
          }
        })
        return id
      },

      updateSavingsAccount: (id, updates) =>
        set((state) => ({
          savingsAccounts: state.savingsAccounts.map((acc) =>
            acc.id === id ? { ...acc, ...updates } : acc
          ),
        })),

      deleteSavingsAccount: (id) =>
        set((state) => ({
          savingsAccounts: state.savingsAccounts.filter((a) => a.id !== id),
          savingsTransactions: state.savingsTransactions.filter((t) => t.accountId !== id),
          recurringSavingsDeposits: state.recurringSavingsDeposits.filter((r) => r.accountId !== id),
        })),

      addRecurringSavingsDeposit: (r) =>
        set((state) => {
          const row: RecurringSavingsDeposit = {
            ...r,
            id: generateId(),
            createdAt: new Date().toISOString(),
          }
          return { recurringSavingsDeposits: [...state.recurringSavingsDeposits, row] }
        }),

      updateRecurringSavingsDeposit: (id, updates) =>
        set((state) => ({
          recurringSavingsDeposits: state.recurringSavingsDeposits.map((x) =>
            x.id === id ? { ...x, ...updates } : x
          ),
        })),

      deleteRecurringSavingsDeposit: (id) =>
        set((state) => ({
          recurringSavingsDeposits: state.recurringSavingsDeposits.filter((x) => x.id !== id),
        })),

      depositToSavings: (accountId, amount, currency, notes, opts) => {
        const raw = Math.max(0, Number(amount) || 0)
        if (raw <= 0) return
        set((state) => {
          const acc = state.savingsAccounts.find((a) => a.id === accountId)
          if (!acc) return state
          const cIn =
            currency === acc.currency ? acc.currency : clampFiatToAllowed(state.settings, currency)
          const rates = state.exchangeRates
          const amt =
            cIn === acc.currency ? raw : convertCurrency(raw, cIn, acc.currency, rates)
          if (amt <= 0) return state
          const tx: SavingsTransaction = {
            id: generateId(),
            accountId,
            type: 'deposit',
            amount: amt,
            currency: acc.currency,
            date: new Date().toISOString().slice(0, 10),
            notes,
            source: opts?.source,
            isAutoSave: opts?.isAutoSave,
          }
          return {
            savingsTransactions: [...state.savingsTransactions, tx],
            savingsAccounts: state.savingsAccounts.map((a) =>
              a.id === accountId ? { ...a, currentBalance: a.currentBalance + amt } : a
            ),
          }
        })
      },

      withdrawFromSavings: (accountId, amount, currency, notes) => {
        const raw = Math.max(0, Number(amount) || 0)
        if (raw <= 0) return
        set((state) => {
          const acc = state.savingsAccounts.find((a) => a.id === accountId)
          if (!acc) return state
          const cIn =
            currency === acc.currency ? acc.currency : clampFiatToAllowed(state.settings, currency)
          const rates = state.exchangeRates
          const amt =
            cIn === acc.currency ? raw : convertCurrency(raw, cIn, acc.currency, rates)
          if (amt <= 0 || acc.currentBalance + 0.0001 < amt) return state
          const tx: SavingsTransaction = {
            id: generateId(),
            accountId,
            type: 'withdrawal',
            amount: amt,
            currency: acc.currency,
            date: new Date().toISOString().slice(0, 10),
            notes,
          }
          return {
            savingsTransactions: [...state.savingsTransactions, tx],
            savingsAccounts: state.savingsAccounts.map((a) =>
              a.id === accountId ? { ...a, currentBalance: Math.max(0, a.currentBalance - amt) } : a
            ),
          }
        })
      },

      correctSavingsBalance: (accountId, newBalance, notes) => {
        const nb = Math.max(0, Number(newBalance) || 0)
        set((state) => {
          const acc = state.savingsAccounts.find((a) => a.id === accountId)
          if (!acc) return state
          const diff = nb - acc.currentBalance
          if (Math.abs(diff) < 0.0001) return state
          const type: SavingsTransaction['type'] = diff > 0 ? 'deposit' : 'withdrawal'
          const tx: SavingsTransaction = {
            id: generateId(),
            accountId,
            type,
            amount: Math.abs(diff),
            currency: acc.currency,
            date: new Date().toISOString().slice(0, 10),
            notes: notes?.trim() || 'Manual balance correction',
          }
          return {
            savingsTransactions: [...state.savingsTransactions, tx],
            savingsAccounts: state.savingsAccounts.map((a) =>
              a.id === accountId ? { ...a, currentBalance: nb } : a
            ),
          }
        })
      },

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
        set({
          goldPricePerGram: price,
          lastGoldFetch: new Date().toISOString(),
          goldPriceAvailable: true,
        }),

      setGoldUnavailable: () => set({ goldPriceAvailable: false }),

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
        const holdings = data.savingsHoldings ?? []
        let savingsAccounts: SavingsAccount[] = normalizeSavingsAccountsList(
          (data.savingsAccounts ?? []) as unknown[]
        )
        let savingsTransactions: SavingsTransaction[] = (data.savingsTransactions ?? []) as SavingsTransaction[]
        let savingsHoldingsOut = holdings
        if (savingsAccounts.length === 0 && holdings.length > 0) {
          const migrated = migrateSavingsHoldingsToLedger(holdings, generateId)
          savingsAccounts = migrated.accounts
          savingsTransactions = migrated.transactions
          savingsHoldingsOut = []
        }
        set((state) => ({
          ...state,
          ...data,
          budgetPlans: data.budgetPlans ?? state.budgetPlans,
          activeBudgetPlanId:
            data.activeBudgetPlanId !== undefined ? data.activeBudgetPlanId : state.activeBudgetPlanId,
          financialGoalsNotes:
            data.financialGoalsNotes !== undefined ? data.financialGoalsNotes : state.financialGoalsNotes,
          savingsHoldings: data.savingsHoldings !== undefined ? savingsHoldingsOut : state.savingsHoldings,
          savingsAccounts,
          savingsTransactions,
          recurringSavingsDeposits: data.recurringSavingsDeposits ?? state.recurringSavingsDeposits,
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
          savingsAccounts: state.savingsAccounts,
          savingsTransactions: state.savingsTransactions,
          recurringSavingsDeposits: state.recurringSavingsDeposits,
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
          savingsAccounts: [],
          savingsTransactions: [],
          recurringSavingsDeposits: [],
          paymentMethods: DEFAULT_PAYMENT_METHODS,
          debts: DEFAULT_DEBTS,
          debtPayments: [],
          recurringDebtPayments: [],
          exchangeRates: { ...DEFAULT_MARKET_RATES },
          goldPricePerGram: DEFAULT_GOLD_PRICE_PER_GRAM,
          lastGoldFetch: null,
          goldPriceAvailable: true,
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
          const holdings = (Array.isArray(p.savingsHoldings) ? p.savingsHoldings : []) as SavingsHolding[]
          let savingsAccounts = (p.savingsAccounts as SavingsAccount[] | undefined) ?? []
          let savingsTransactions = (p.savingsTransactions as SavingsTransaction[] | undefined) ?? []
          let savingsHoldingsOut = holdings
          if (fromVersion < 8 && savingsAccounts.length === 0 && holdings.length > 0) {
            const gen = (): string =>
              `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
            const migrated = migrateSavingsHoldingsToLedger(holdings, gen)
            savingsAccounts = migrated.accounts
            savingsTransactions = migrated.transactions
            savingsHoldingsOut = []
          }
          if (fromVersion < 10) {
            savingsAccounts = normalizeSavingsAccountsList(savingsAccounts as unknown[])
          }
          return {
            ...p,
            lastGoldFetch: p.lastGoldFetch ?? null,
            goldPriceAvailable: typeof p.goldPriceAvailable === 'boolean' ? p.goldPriceAvailable : true,
            budgetPlans: Array.isArray(p.budgetPlans) ? p.budgetPlans : [],
            activeBudgetPlanId:
              typeof p.activeBudgetPlanId === 'string' || p.activeBudgetPlanId === null
                ? p.activeBudgetPlanId
                : null,
            onboardingState: (p.onboardingState as OnboardingState | undefined) ?? defaultOnboardingState(),
            recurringDebtPayments: Array.isArray(p.recurringDebtPayments)
              ? p.recurringDebtPayments
              : [],
            recurringSavingsDeposits: Array.isArray(p.recurringSavingsDeposits)
              ? (p.recurringSavingsDeposits as RecurringSavingsDeposit[])
              : [],
            savingsHoldings: savingsHoldingsOut,
            savingsAccounts,
            savingsTransactions,
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
          const savingsAccounts =
            fromVersion < 10
              ? normalizeSavingsAccountsList(
                  Array.isArray(p.savingsAccounts) ? (p.savingsAccounts as unknown[]) : []
                )
              : ((p.savingsAccounts as SavingsAccount[]) ?? [])
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
            recurringSavingsDeposits: [],
            savingsAccounts,
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
          const savingsAccounts =
            fromVersion < 10
              ? normalizeSavingsAccountsList(
                  Array.isArray(p.savingsAccounts) ? (p.savingsAccounts as unknown[]) : []
                )
              : ((p.savingsAccounts as SavingsAccount[]) ?? [])
          return {
            ...p,
            onboardingState: (p.onboardingState as OnboardingState | undefined) ?? defaultOnboardingState(),
            recurringDebtPayments: Array.isArray(p.recurringDebtPayments)
              ? p.recurringDebtPayments
              : [],
            recurringSavingsDeposits: [],
            savingsAccounts,
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
          const savingsAccounts =
            fromVersion < 10
              ? normalizeSavingsAccountsList(
                  Array.isArray(p.savingsAccounts) ? (p.savingsAccounts as unknown[]) : []
                )
              : ((p.savingsAccounts as SavingsAccount[]) ?? [])
          return {
            ...p,
            onboardingState: (p.onboardingState as OnboardingState | undefined) ?? defaultOnboardingState(),
            recurringDebtPayments: [],
            recurringSavingsDeposits: [],
            savingsAccounts,
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
          savingsAccounts: [],
          savingsTransactions: [],
          recurringSavingsDeposits: [],
          paymentMethods: DEFAULT_PAYMENT_METHODS,
          debts: [],
          debtPayments: [],
          recurringDebtPayments: [],
          exchangeRates: { ...DEFAULT_MARKET_RATES },
          goldPricePerGram: DEFAULT_GOLD_PRICE_PER_GRAM,
          lastGoldFetch: null,
          goldPriceAvailable: true,
          lastRatesFetch: null,
        } as never
      },
      storage: createJSONStorage(() => createSafeLocalStorage()),
      merge: (persisted, current) => {
        const p = persisted as Partial<typeof current>
        return {
          ...current,
          ...p,
          lastGoldFetch: p.lastGoldFetch ?? current.lastGoldFetch,
          goldPriceAvailable: p.goldPriceAvailable ?? current.goldPriceAvailable,
          financialGoalsNotes: p.financialGoalsNotes ?? current.financialGoalsNotes,
          budgetPlans: p.budgetPlans ?? current.budgetPlans,
          activeBudgetPlanId:
            p.activeBudgetPlanId !== undefined ? p.activeBudgetPlanId : current.activeBudgetPlanId,
          savingsHoldings: p.savingsHoldings ?? current.savingsHoldings,
          savingsAccounts: p.savingsAccounts ?? current.savingsAccounts,
          savingsTransactions: p.savingsTransactions ?? current.savingsTransactions,
          recurringSavingsDeposits: p.recurringSavingsDeposits ?? current.recurringSavingsDeposits,
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
