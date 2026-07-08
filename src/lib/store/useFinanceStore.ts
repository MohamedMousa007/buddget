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
  Currency,
  DebtCurrency,
  DebtReceivedVia,
  FinanceStore,
  Goal,
  IncomeSource,
  IncomeSourceType,
  PaymentMethod,
  RecurringSavingsDeposit,
  SavingsAccount,
  SavingsHolding,
  SavingsTransaction,
  SavingsType,
  Subscription,
} from './types'
import { computeNextBillingDate } from '@/lib/subscriptions/subscriptionDates'
import {
  buildRecurringExpenseFromSubscription,
  patchRecurringFromSubscription,
} from '@/lib/subscriptions/subscriptionRecurring'
import { normalizeDebtIncoming } from '@/lib/debt/normalizeDebt'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import { SAVINGS_TYPE_ICONS } from '@/lib/constants/savingsIcons'
import { normalizeSavingsAccountsList } from '@/lib/savings/normalizeSavingsAccount'
import { defaultCategoryForSavingsType } from '@/lib/constants/savingsTypes'
import { createSafeLocalStorage } from '@/lib/store/safeLocalStorage'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { buildGoalProgressContext } from '@/lib/goals/computeGoalProgress'
import { reconcileAchievedGoals } from '@/lib/goals/reconcileAchievedGoals'
import { migrateIdsToUuid } from '@/lib/store/migrations/v17_uuid_remap'
const PERSIST_VERSION = 18

function reconcileGoalsForState(state: FinanceStore): Goal[] {
  const ctx = buildGoalProgressContext(state, useSettingsStore.getState().monthFilter)
  return reconcileAchievedGoals(state.goals, ctx).goals
}

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

/**
 * Every client-side id must be a valid v4 UUID so Supabase can accept it into
 * the `uuid`-typed primary-key columns (`income_sources.id`,
 * `payment_methods.id`, `debts.id`, `goals.id`, `expenses.id`, etc.). Prior to
 * this change we emitted `${Date.now()}_${rand}` strings which every list-
 * sync upsert silently rejected, leaving data only in the legacy JSONB blob.
 */
function generateId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  // Polyfill — vanishingly-rare older runtimes (Node < 14.17 / very old Safari).
  const rand = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0')
  return `${rand()}${rand()}-${rand()}-4${rand().slice(1)}-${((8 + Math.floor(Math.random() * 4)).toString(16)) + rand().slice(1)}-${rand()}${rand()}${rand()}`
}

/** Guarded v4 UUID for non-store client ids (older Android WebViews lack crypto.randomUUID). */
export function newClientId(): string {
  return generateId()
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
      incomeSources: DEFAULT_INCOME,
      expenses: [],
      receipts: [],
      recurringExpenses: [],
      subscriptions: [],
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
      goals: [],
      exchangeRates: { ...DEFAULT_MARKET_RATES },
      goldPricePerGram: DEFAULT_GOLD_PRICE_PER_GRAM,
      lastGoldFetch: null,
      // No successful fetch yet — the default price is a placeholder, not a
      // trusted figure. A fetch under the splash flips this true.
      goldPriceAvailable: false,
      goldPriceStale: false,
      lastRatesFetch: null,
      dataReady: false,
      setDataReady: (v) => set({ dataReady: v }),

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

      upsertServerExpense: (expense) =>
        set((state) => {
          const i = state.expenses.findIndex((e) => e.id === expense.id)
          if (i === -1) return { expenses: [...state.expenses, expense] }
          const next = state.expenses.slice()
          next[i] = expense
          return { expenses: next }
        }),

      upsertServerDebtPayment: (payment) =>
        set((state) => {
          const i = state.debtPayments.findIndex((p) => p.id === payment.id)
          if (i === -1) return { debtPayments: [...state.debtPayments, payment] }
          const next = state.debtPayments.slice()
          next[i] = payment
          return { debtPayments: next }
        }),

      addReceipt: (receipt) => {
        const id = generateId()
        const now = new Date().toISOString()
        set((state) => ({
          receipts: [...state.receipts, { ...receipt, id, createdAt: now, updatedAt: now }],
        }))
        return id
      },

      deleteReceipt: (id) =>
        set((state) => ({
          receipts: state.receipts.filter((r) => r.id !== id),
        })),

      upsertServerReceipt: (receipt) =>
        set((state) => {
          const i = state.receipts.findIndex((r) => r.id === receipt.id)
          if (i === -1) return { receipts: [...state.receipts, receipt] }
          const next = state.receipts.slice()
          next[i] = receipt
          return { receipts: next }
        }),

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

      restoreExpense: (expense) =>
        set((state) =>
          state.expenses.some((e) => e.id === expense.id)
            ? state
            : { expenses: [...state.expenses, expense] },
        ),

      addIncomeSource: (source) =>
        set((state) => ({
          incomeSources: [
            ...state.incomeSources,
            {
              ...source,
              sourceType: source.sourceType ?? 'other',
              effectiveStart: source.effectiveStart ?? new Date().toISOString().slice(0, 10),
              id: generateId(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
          settings: { ...state.settings, noIncomeDeclared: false },
        })),

      upsertServerIncome: (source) =>
        set((state) => {
          const i = state.incomeSources.findIndex((s) => s.id === source.id)
          if (i === -1) {
            return {
              incomeSources: [...state.incomeSources, source],
              settings: { ...state.settings, noIncomeDeclared: false },
            }
          }
          const next = state.incomeSources.slice()
          next[i] = source
          return { incomeSources: next }
        }),

      addIncomeWithDebt: (income, debtRow) => {
        const incomeId = generateId()
        const debtId = generateId()
        const iso = new Date().toISOString()
        const cur = clampFiatToAllowed(get().settings, income.currency)
        const normalized = normalizeDebtIncoming(debtRow)
        set((state) => ({
          incomeSources: [
            ...state.incomeSources,
            {
              ...income,
              id: incomeId,
              currency: cur,
              sourceType: 'debt' as IncomeSourceType,
              linkedDebtId: debtId,
              effectiveStart: iso.slice(0, 10),
              createdAt: iso,
              updatedAt: iso,
            },
          ],
          debts: [
            ...state.debts,
            {
              ...normalized,
              id: debtId,
              createdAt: iso,
            },
          ],
          settings: { ...state.settings, noIncomeDeclared: false },
        }))
      },

      updateIncomeSource: (id, updates) =>
        set((state) => ({
          incomeSources: state.incomeSources.map((s) =>
            s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s
          ),
        })),

      deleteIncomeSource: (id) =>
        set((state) => {
          const incomeSources = state.incomeSources.filter((s) => s.id !== id)
          return {
            incomeSources,
            settings:
              incomeSources.length === 0
                ? { ...state.settings, noIncomeDeclared: true }
                : state.settings,
          }
        }),

      addPaymentMethod: (method) => {
        const pmId = generateId()
        const newMethod: PaymentMethod = { ...method, id: pmId }
        set((state) => {
          const paymentMethods = method.isDefault
            ? [...state.paymentMethods.map((m) => ({ ...m, isDefault: false })), newMethod]
            : [...state.paymentMethods, newMethod]
          if (method.type !== 'card_credit') {
            return { paymentMethods }
          }
          const hasDebtForPm = state.debts.some(
            (d) => d.debtType === 'credit_card' && d.linkedPaymentMethodId === pmId
          )
          if (hasDebtForPm) return { paymentMethods }
          const debtId = generateId()
          const ccRow = normalizeDebtIncoming({
            name: method.name,
            person: '',
            startingBalance: 0,
            currency: method.currency as DebtCurrency,
            isGold: false,
            receivedVia: 'card',
            debtType: 'credit_card',
            direction: 'i_owe',
            status: 'active',
            linkedPaymentMethodId: pmId,
            gracePeriodDays: 55,
            minimumPaymentPercent: 5,
            notes: undefined,
          })
          return {
            paymentMethods,
            debts: [...state.debts, { ...ccRow, id: debtId, createdAt: new Date().toISOString() }],
          }
        })
      },

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
        const row = normalizeDebtIncoming(debt)
        set((state) => ({
          debts: [
            ...state.debts,
            {
              ...row,
              id,
              createdAt: new Date().toISOString(),
            },
          ],
        }))
        return id
      },

      addCreditCardDebt: (debtInput, paymentMethodInfo) => {
        const st = get()
        const matchPm = (pm: PaymentMethod) =>
          pm.type === 'card_credit' &&
          (pm.name.toLowerCase() === paymentMethodInfo.name.trim().toLowerCase() ||
            (!!paymentMethodInfo.last4 && pm.last4 === paymentMethodInfo.last4))

        const existingPm = st.paymentMethods.find(matchPm)
        const pmId = existingPm?.id ?? generateId()

        const existingDebt = st.debts.find(
          (d) => d.debtType === 'credit_card' && d.linkedPaymentMethodId === pmId
        )

        const merged = normalizeDebtIncoming({
          ...debtInput,
          debtType: 'credit_card',
          direction: 'i_owe',
          status: 'active',
          linkedPaymentMethodId: pmId,
          receivedVia: 'card',
          person: debtInput.person?.trim() || '',
        })

        if (existingDebt) {
          set((state) => ({
            debts: state.debts.map((d) =>
              d.id === existingDebt.id
                ? {
                    ...d,
                    ...merged,
                    id: d.id,
                    createdAt: d.createdAt,
                    linkedPaymentMethodId: pmId,
                  }
                : d
            ),
            paymentMethods: existingPm
              ? state.paymentMethods
              : [
                  ...state.paymentMethods,
                  {
                    id: pmId,
                    name: paymentMethodInfo.name.trim(),
                    type: 'card_credit',
                    currency: merged.currency as Currency,
                    last4: paymentMethodInfo.last4,
                    isDefault: false,
                    color: paymentMethodInfo.color,
                  },
                ],
          }))
          return existingDebt.id
        }

        const debtId = generateId()
        set((state) => ({
          debts: [
            ...state.debts,
            {
              ...merged,
              id: debtId,
              createdAt: new Date().toISOString(),
              linkedPaymentMethodId: pmId,
            },
          ],
          paymentMethods: existingPm
            ? state.paymentMethods
            : [
                ...state.paymentMethods,
                {
                  id: pmId,
                  name: paymentMethodInfo.name.trim(),
                  type: 'card_credit',
                  currency: merged.currency as Currency,
                  last4: paymentMethodInfo.last4,
                  isDefault: false,
                  color: paymentMethodInfo.color,
                },
              ],
        }))
        return debtId
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

        set((state) => {
          const nextState: FinanceStore = {
            ...state,
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
          }
          return {
            debtPayments: nextState.debtPayments,
            expenses: nextState.expenses,
            goals: reconcileGoalsForState(nextState),
          }
        })
      },

      addDebtPayment: (payment) =>
        set((state) => {
          const nextState: FinanceStore = {
            ...state,
            debtPayments: [
              ...state.debtPayments,
              { ...payment, id: generateId(), createdAt: new Date().toISOString() },
            ],
          }
          return {
            debtPayments: nextState.debtPayments,
            goals: reconcileGoalsForState(nextState),
          }
        }),

      deleteDebt: (id) =>
        set((state) => {
          const nextState: FinanceStore = {
            ...state,
            debts: state.debts.filter((d) => d.id !== id),
            debtPayments: state.debtPayments.filter((p) => p.debtId !== id),
            recurringDebtPayments: state.recurringDebtPayments.filter((r) => r.debtId !== id),
            goals: state.goals.map((g) => ({
              ...g,
              linkedDebtIds: g.linkedDebtIds.filter((x) => x !== id),
            })),
          }
          return {
            debts: nextState.debts,
            debtPayments: nextState.debtPayments,
            recurringDebtPayments: nextState.recurringDebtPayments,
            goals: reconcileGoalsForState(nextState),
          }
        }),

      deleteDebtPayment: (id) =>
        set((state) => {
          const payment = state.debtPayments.find((p) => p.id === id)
          const remainingPayments = state.debtPayments.filter((p) => p.id !== id)
          if (!payment) return { debtPayments: remainingPayments }
          const debtStillHasPayments = remainingPayments.some((p) => p.debtId === payment.debtId)
          if (debtStillHasPayments) return { debtPayments: remainingPayments }
          // Last payment deleted — cascade-delete the parent debt
          const nextState: FinanceStore = {
            ...state,
            debts: state.debts.filter((d) => d.id !== payment.debtId),
            debtPayments: remainingPayments,
            recurringDebtPayments: state.recurringDebtPayments.filter((r) => r.debtId !== payment.debtId),
            goals: state.goals.map((g) => ({
              ...g,
              linkedDebtIds: g.linkedDebtIds.filter((x) => x !== payment.debtId),
            })),
          }
          return {
            debts: nextState.debts,
            debtPayments: nextState.debtPayments,
            recurringDebtPayments: nextState.recurringDebtPayments,
            goals: reconcileGoalsForState(nextState),
          }
        }),

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

      addSubscription: (input) => {
        const subId = generateId()
        const recurringExpenseId = generateId()
        const st = get()
        const nextBilling =
          input.nextBillingDate ??
          computeNextBillingDate(input.startDate, input.billingDay, input.billingCycle)
        const sub: Subscription = {
          ...input,
          id: subId,
          linkedRecurringExpenseId: recurringExpenseId,
          nextBillingDate: nextBilling,
          createdAt: new Date().toISOString(),
          cancelledAt: null,
        }
        const fallbackPm =
          st.paymentMethods.find((m) => m.isDefault)?.id || st.paymentMethods[0]?.id || ''
        const re = buildRecurringExpenseFromSubscription(sub, recurringExpenseId, fallbackPm)
        set((state) => ({
          subscriptions: [...state.subscriptions, sub],
          recurringExpenses: [...state.recurringExpenses, re],
        }))
        return subId
      },

      updateSubscription: (id, updates) =>
        set((state) => {
          const sub = state.subscriptions.find((s) => s.id === id)
          if (!sub) return state
          const merged: Subscription = { ...sub, ...updates }
          let nextBilling = merged.nextBillingDate
          if (
            updates.startDate !== undefined ||
            updates.billingDay !== undefined ||
            updates.billingCycle !== undefined
          ) {
            nextBilling = computeNextBillingDate(
              merged.startDate,
              merged.billingDay,
              merged.billingCycle
            )
          }
          const merged2: Subscription = { ...merged, nextBillingDate: nextBilling ?? merged.nextBillingDate }
          const updatedSubs = state.subscriptions.map((s) => (s.id === id ? merged2 : s))
          const fallbackPm =
            state.paymentMethods.find((m) => m.isDefault)?.id || state.paymentMethods[0]?.id || ''
          let recurring = state.recurringExpenses
          if (sub.linkedRecurringExpenseId) {
            recurring = state.recurringExpenses.map((re) =>
              re.id === sub.linkedRecurringExpenseId
                ? patchRecurringFromSubscription(re, merged2, fallbackPm)
                : re
            )
          }
          return { subscriptions: updatedSubs, recurringExpenses: recurring }
        }),

      cancelSubscription: (id) =>
        set((state) => {
          const sub = state.subscriptions.find((s) => s.id === id)
          const cancelledAt = new Date().toISOString()
          const subs = state.subscriptions.map((s) =>
            s.id === id ? { ...s, status: 'cancelled' as const, cancelledAt } : s
          )
          let recurring = state.recurringExpenses
          if (sub?.linkedRecurringExpenseId) {
            recurring = state.recurringExpenses.map((re) =>
              re.id === sub.linkedRecurringExpenseId ? { ...re, isActive: false } : re
            )
          }
          return { subscriptions: subs, recurringExpenses: recurring }
        }),

      deleteSubscription: (id) =>
        set((state) => {
          const sub = state.subscriptions.find((s) => s.id === id)
          return {
            subscriptions: state.subscriptions.filter((s) => s.id !== id),
            recurringExpenses: sub?.linkedRecurringExpenseId
              ? state.recurringExpenses.filter((re) => re.id !== sub.linkedRecurringExpenseId)
              : state.recurringExpenses,
          }
        }),

      reactivateSubscription: (id) =>
        set((state) => {
          const sub = state.subscriptions.find((s) => s.id === id)
          if (!sub) return state
          const merged: Subscription = {
            ...sub,
            status: 'active',
            cancelledAt: null,
          }
          const nextBilling =
            computeNextBillingDate(merged.startDate, merged.billingDay, merged.billingCycle) ??
            merged.nextBillingDate
          const merged2 = { ...merged, nextBillingDate: nextBilling ?? merged.nextBillingDate }
          const subs = state.subscriptions.map((s) => (s.id === id ? merged2 : s))
          const fallbackPm =
            state.paymentMethods.find((m) => m.isDefault)?.id || state.paymentMethods[0]?.id || ''
          let recurring = state.recurringExpenses
          if (sub.linkedRecurringExpenseId) {
            recurring = state.recurringExpenses.map((re) =>
              re.id === sub.linkedRecurringExpenseId
                ? patchRecurringFromSubscription(re, merged2, fallbackPm)
                : re
            )
          }
          return { subscriptions: subs, recurringExpenses: recurring }
        }),

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
              updatedAt: new Date().toISOString(),
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

      addGoal: (input) => {
        const id = generateId()
        const iso = new Date().toISOString()
        set((state) => {
          const row: Goal = {
            ...input,
            id,
            createdAt: iso,
            achievedAt: null,
            manualCurrentAmount: input.manualCurrentAmount ?? 0,
            linkedSavingsAccountIds: input.linkedSavingsAccountIds ?? [],
            linkedDebtIds: input.linkedDebtIds ?? [],
            monthlySpendingLimit: input.monthlySpendingLimit ?? null,
            notes: input.notes ?? null,
            targetDate: input.targetDate ?? null,
            monthlyContribution: input.monthlyContribution ?? null,
            priority: input.priority ?? state.goals.length,
          }
          const nextGoals = [...state.goals, row]
          const nextState: FinanceStore = { ...state, goals: nextGoals }
          return { goals: reconcileGoalsForState(nextState) }
        })
        return id
      },

      updateGoal: (id, updates) =>
        set((state) => {
          const nextGoals = state.goals.map((g) => (g.id === id ? { ...g, ...updates } : g))
          const nextState: FinanceStore = { ...state, goals: nextGoals }
          return { goals: reconcileGoalsForState(nextState) }
        }),

      deleteGoal: (id) =>
        set((state) => ({
          goals: state.goals.filter((g) => g.id !== id),
        })),

      achieveGoal: (id) =>
        set((state) => ({
          goals: state.goals.map((g) =>
            g.id === id
              ? { ...g, status: 'achieved', achievedAt: new Date().toISOString() }
              : g
          ),
        })),

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
            return { ...p, categories: [...p.categories, row], updatedAt: new Date().toISOString() }
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
              updatedAt: new Date().toISOString(),
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
              ? { ...p, categories: p.categories.filter((c) => c.id !== categoryId), updatedAt: new Date().toISOString() }
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
              updatedAt: new Date().toISOString(),
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
              updatedAt: new Date().toISOString(),
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
              updatedAt: new Date().toISOString(),
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
        set((state) => {
          const nextState: FinanceStore = {
            ...state,
            savingsAccounts: state.savingsAccounts.filter((a) => a.id !== id),
            savingsTransactions: state.savingsTransactions.filter((t) => t.accountId !== id),
            recurringSavingsDeposits: state.recurringSavingsDeposits.filter((r) => r.accountId !== id),
            goals: state.goals.map((g) => ({
              ...g,
              linkedSavingsAccountIds: g.linkedSavingsAccountIds.filter((x) => x !== id),
            })),
          }
          return {
            savingsAccounts: nextState.savingsAccounts,
            savingsTransactions: nextState.savingsTransactions,
            recurringSavingsDeposits: nextState.recurringSavingsDeposits,
            goals: reconcileGoalsForState(nextState),
          }
        }),

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
          const nextState: FinanceStore = {
            ...state,
            savingsTransactions: [...state.savingsTransactions, tx],
            savingsAccounts: state.savingsAccounts.map((a) =>
              a.id === accountId ? { ...a, currentBalance: a.currentBalance + amt } : a
            ),
          }
          return {
            ...nextState,
            goals: reconcileGoalsForState(nextState),
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
          const isInvestment = acc.category === 'investment'
          const incomeEntry: IncomeSource = {
            id: generateId(),
            name: isInvestment ? `Return from ${acc.name}` : `Withdrawal from ${acc.name}`,
            amount: amt,
            currency: acc.currency,
            isRecurring: false,
            sourceType: isInvestment ? 'investment' : 'savings',
            linkedSavingsAccountId: accountId,
            notes: notes?.trim() || undefined,
            effectiveStart: new Date().toISOString().slice(0, 10),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
          const nextState: FinanceStore = {
            ...state,
            savingsTransactions: [...state.savingsTransactions, tx],
            savingsAccounts: state.savingsAccounts.map((a) =>
              a.id === accountId ? { ...a, currentBalance: Math.max(0, a.currentBalance - amt) } : a
            ),
            incomeSources: [...state.incomeSources, incomeEntry],
            settings: { ...state.settings, noIncomeDeclared: false },
          }
          return {
            ...nextState,
            goals: reconcileGoalsForState(nextState),
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
          const nextState: FinanceStore = {
            ...state,
            savingsTransactions: [...state.savingsTransactions, tx],
            savingsAccounts: state.savingsAccounts.map((a) =>
              a.id === accountId ? { ...a, currentBalance: nb } : a
            ),
          }
          return {
            ...nextState,
            goals: reconcileGoalsForState(nextState),
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
          goldPriceStale: false,
        }),

      // Providers failed: keep the last good price and mark it stale so the UI can
      // warn "prices may be delayed". Only report hard-unavailable when we never
      // had a real price (still the default, no successful fetch yet).
      setGoldUnavailable: () =>
        set((state) =>
          state.lastGoldFetch
            ? { goldPriceStale: true }
            : { goldPriceAvailable: false, goldPriceStale: false }
        ),

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

        // Imports may carry legacy `${ts}_${rand}` ids from pre-v17 backups
        // or the legacy `user_finance` JSONB blob. Rewrite them to UUIDs so
        // every subsequent flush lands in the normalized tables.
        const data = migrateIdsToUuid(
          result.data as unknown as Record<string, unknown>,
        ) as unknown as typeof result.data
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
        set((state) => {
          const merged: FinanceStore = {
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
            goals: data.goals ?? state.goals,
            subscriptions: data.subscriptions ?? state.subscriptions,
          }
          return {
            ...merged,
            goals: reconcileGoalsForState(merged),
          }
        })
      },

      exportData: () => {
        const state = get()
        const data = {
          profile: state.profile,
          settings: state.settings,
          incomeSources: state.incomeSources,
          expenses: state.expenses,
          recurringExpenses: state.recurringExpenses,
          subscriptions: state.subscriptions,
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
          goals: state.goals,
        }
        return JSON.stringify(data, null, 2)
      },

      resetAllData: () =>
        set({
          profile: createFreshDefaultProfile(),
          settings: { ...DEFAULT_SETTINGS },
          incomeSources: DEFAULT_INCOME,
          expenses: [],
          receipts: [],
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
          goals: [],
          subscriptions: [],
          exchangeRates: { ...DEFAULT_MARKET_RATES },
          goldPricePerGram: DEFAULT_GOLD_PRICE_PER_GRAM,
          lastGoldFetch: null,
          goldPriceAvailable: false,
          goldPriceStale: false,
          lastRatesFetch: null,
          dataReady: false,
        }),

      /** Alias for `resetAllData` (logout / wipe client state). */
      reset: () => get().resetAllData(),
    }),
    {
      name: 'buddget-storage',
      version: PERSIST_VERSION,
      migrate: (persistedState, fromVersion) => {
        if (fromVersion >= PERSIST_VERSION) return persistedState as never
        const base =
          persistedState && typeof persistedState === 'object'
            ? (persistedState as Record<string, unknown>)
            : {}
        // v18: the onboarding gate is metadata-only (onboarding_version dropped)
        // and currency is settings-only (profile.baseCurrency removed). Strip both
        // dead keys from the persisted profile so they can't linger or mislead.
        if (fromVersion < 18 && base.profile && typeof base.profile === 'object') {
          const prof = base.profile as Record<string, unknown>
          delete prof.onboardingVersion
          delete prof.baseCurrency
        }
        // v17: all client-side row ids must be valid UUIDs so Supabase's
        // uuid-typed PK columns accept them on sync. Runs first so the rest
        // of the migration chain already sees UUID ids.
        const uuidFixed =
          fromVersion < 17 ? migrateIdsToUuid(base) : base
        let p: Record<string, unknown> =
          fromVersion < 12 && Array.isArray(uuidFixed.incomeSources)
            ? {
                ...uuidFixed,
                incomeSources: (uuidFixed.incomeSources as Record<string, unknown>[]).map((s) => ({
                  ...s,
                  sourceType: (s.sourceType as IncomeSourceType | undefined) ?? 'other',
                })),
              }
            : uuidFixed
        if (fromVersion < 13 && Array.isArray(p.debts)) {
          p = {
            ...p,
            debts: (p.debts as Record<string, unknown>[]).map((d) => ({
              ...d,
              receivedVia:
                (d.receivedVia as DebtReceivedVia | undefined) ??
                ((d.isGold as boolean | undefined) ? 'gold' : 'cash'),
            })),
          }
        }
        if (fromVersion < 14) {
          p = {
            ...p,
            goals: Array.isArray(p.goals) ? (p.goals as Goal[]) : [],
          }
        }
        if (fromVersion < 15) {
          p = {
            ...p,
            subscriptions: Array.isArray((p as Record<string, unknown>).subscriptions)
              ? ((p as { subscriptions: Subscription[] }).subscriptions)
              : [],
          }
        }
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
          goals: [],
          subscriptions: [],
          exchangeRates: { ...DEFAULT_MARKET_RATES },
          goldPricePerGram: DEFAULT_GOLD_PRICE_PER_GRAM,
          lastGoldFetch: null,
          goldPriceAvailable: false,
          goldPriceStale: false,
          lastRatesFetch: null,
        } as never
      },
      storage: createJSONStorage(() => createSafeLocalStorage()),
      merge: (persisted, current) => {
        const p = persisted as Partial<typeof current>
        return {
          ...current,
          ...p,
          dataReady: false,
          goals: p.goals ?? current.goals,
          subscriptions: p.subscriptions ?? current.subscriptions,
          lastGoldFetch: p.lastGoldFetch ?? current.lastGoldFetch,
          goldPriceAvailable: p.goldPriceAvailable ?? current.goldPriceAvailable,
          goldPriceStale: false,
          financialGoalsNotes: p.financialGoalsNotes ?? current.financialGoalsNotes,
          budgetPlans: p.budgetPlans ?? current.budgetPlans,
          activeBudgetPlanId:
            p.activeBudgetPlanId !== undefined ? p.activeBudgetPlanId : current.activeBudgetPlanId,
          savingsHoldings: p.savingsHoldings ?? current.savingsHoldings,
          savingsAccounts: p.savingsAccounts ?? current.savingsAccounts,
          savingsTransactions: p.savingsTransactions ?? current.savingsTransactions,
          recurringSavingsDeposits: p.recurringSavingsDeposits ?? current.recurringSavingsDeposits,
          recurringDebtPayments: p.recurringDebtPayments ?? current.recurringDebtPayments,
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
