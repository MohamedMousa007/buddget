import { applyMethodExclusion, isMethodExcluded } from '@/lib/spending/exclusion'
import { removePaymentMethod } from '@/lib/accounts/removePaymentMethod'
import { create } from 'zustand'
import { cycleKeyOf, prevKey, recordActivation } from '@/lib/budget/activations'
import { selectActivePlan } from '@/lib/budget/activePlan'
import { uniquePlanCategoryName } from '@/lib/budget/budgetPlans'
import { format } from 'date-fns'
import { findBrandByKey, plansForRegion, type CatalogRegion } from '@/lib/constants/subscriptionCatalog'
import { localTodayISO } from '@/lib/utils/localDate'
import { persist } from 'zustand/middleware'
import { createDebouncedJsonStorage } from './debouncedPersistStorage'
import { balanceEpsilon, settleBalance } from '@/lib/savings/balanceMath'
import { tryConvertCurrency, tryConvertWithGold, withoutGoldRates, type GoldQuote } from '@/lib/utils/currency'
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
  BudgetActivationUndo,
  BudgetPlanCategory,
  Currency,
  DebtCurrency,
  DebtPaymentSnapshot,
  DebtReceivedVia,
  Expense,
  FinanceStore,
  Goal,
  IncomeSource,
  IncomeEvent,
  IncomeSourceType,
  PaymentMethod,
  RecurringSavingsDeposit,
  SavingsAccount,
  SavingsHolding,
  SavingsTransaction,
  DeleteSavingsTxResult,
  SavingsType,
  Subscription,
} from './types'
import { computeNextBillingDate } from '@/lib/subscriptions/subscriptionDates'
import { chargeAmount, cycleState, isCharging, markPaidTarget } from '@/lib/subscriptions/subscriptionForecast'
import { trackingAction } from '@/lib/subscriptions/subscriptionTracking'
import { loggedChargesAdopted } from '@/lib/subscriptions/adoptLogged'
import { priceHistoryWith } from '@/lib/subscriptions/subscriptionPricing'
import {
  buildRecurringExpenseFromSubscription,
  patchRecurringFromSubscription,
  plannerRowActive,
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
import { clearIfFullyPaid, isDebtFullyPaid } from '@/lib/utils/calculations'
import { withGoalDefaults } from '@/lib/goals/goalDefaults'
import { resolveAccountLeg, incomeEventIdForTx } from '@/lib/savings/accountLeg'
import { dropExpenseReceipt, restoreExpenseReceipt } from '@/lib/receipt/receiptCascade'
import { migrateIdsToUuid } from '@/lib/store/migrations/v17_uuid_remap'
import { decomposePaymentMethodName, normalizePaymentMethodType } from '@/lib/payment/paymentMethodDefaults'
const PERSIST_VERSION = 22
const PERSIST_WRITE_DEBOUNCE_MS = 150

const persistStorage = createDebouncedJsonStorage<FinanceStore>(() => createSafeLocalStorage(), PERSIST_WRITE_DEBOUNCE_MS)

/** Drops any queued (not yet written) persist so a stale user's state can never flush after sign-out. */
export function cancelPendingFinancePersist(): void {
  persistStorage.cancelPending()
}

export const goldQuoteOf = (s: Pick<FinanceStore, 'goldPricePerGram' | 'goldPriceAvailable'>): GoldQuote => ({
  pricePerGram: s.goldPricePerGram,
  available: s.goldPriceAvailable !== false,
})

/** Event id -> the reversal deposit its delete created, so Undo removes exactly that row. */
const reversalDepositByEvent = new Map<string, string>()

export function reconcileGoalsForState(state: FinanceStore): Goal[] {
  const ctx = buildGoalProgressContext(state, useSettingsStore.getState().monthFilter)
  return reconcileAchievedGoals(state.goals, ctx).goals
}

/** Debts after a payment lands: the paid debt is cleared the moment it is covered. */
function settleDebt(state: FinanceStore, debtId: string) {
  return clearIfFullyPaid(
    state.debts,
    debtId,
    state.debtPayments,
    { expenses: state.expenses, exchangeRates: state.exchangeRates, allDebts: state.debts },
    localTodayISO()
  )
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
        isCashFlow: false, // Imported prior balance, not new cash.
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
/** Drops `undefined` values so a partial patch never overwrites a field with nothing. */
function definedOnly<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>
}

export const MEMORY_CAP = 40
export const MEMORY_MAX_CHARS = 280

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

/** Drops the ids that point at a deleted debt, and at the payments that went with it, keeping every expense and income row. */
function unlinkDebt(state: Pick<FinanceStore, 'expenses' | 'incomeEvents' | 'incomeSources' | 'debtPayments'>, debtId: string) {
  const gone = new Set(state.debtPayments.filter((p) => p.debtId === debtId).map((p) => p.id))
  const at = new Date().toISOString()
  const touchesExpense = (e: Expense) => e.linkedDebtId === debtId || (!!e.linkedDebtPaymentId && gone.has(e.linkedDebtPaymentId))
  return {
    expenses: state.expenses.map((e) => (touchesExpense(e) ? { ...e, linkedDebtId: undefined, linkedDebtPaymentId: undefined, updatedAt: at } : e)),
    incomeEvents: state.incomeEvents.map((e) => (e.linkedDebtId === debtId ? { ...e, linkedDebtId: undefined, updatedAt: at } : e)),
    incomeSources: state.incomeSources.map((i) => (i.linkedDebtId === debtId ? { ...i, linkedDebtId: undefined, updatedAt: at } : i)),
  }
}

/** Drops the ids that point at a deleted savings account from income rows. */
function unlinkSavingsAccount(state: Pick<FinanceStore, 'incomeEvents' | 'incomeSources'>, accountId: string) {
  const at = new Date().toISOString()
  return {
    incomeEvents: state.incomeEvents.map((e) => (e.linkedSavingsAccountId === accountId ? { ...e, linkedSavingsAccountId: undefined, updatedAt: at } : e)),
    incomeSources: state.incomeSources.map((i) => (i.linkedSavingsAccountId === accountId ? { ...i, linkedSavingsAccountId: undefined, updatedAt: at } : i)),
  }
}

export const useFinanceStore = create<FinanceStore>()(
  persist(
    (set, get) => ({
      profile: DEFAULT_PROFILE,
      settings: DEFAULT_SETTINGS,
      financialGoalsNotes: '',
      incomeSources: DEFAULT_INCOME,
      incomeEvents: [],
      expenses: [],
      receipts: [],
      recurringExpenses: [],
      subscriptions: [],
      budgetCategories: DEFAULT_BUDGET,
      budgetPlans: [],
      budgetPlanActivations: [],
      buddgyMemories: [],
      accountAdjustments: [],
      activeBudgetPlanId: null,
      savingsHoldings: [],
      investmentHoldings: [],
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
        // No rate path: 0, never the foreign amount as base. Totals recompute live once a rate loads.
        const amountInBaseCurrency = converted ?? 0

        set((state) => ({
          expenses: [
            ...state.expenses,
            {
              ...expense,
              spendExclusion: expense.spendExclusion ?? (isMethodExcluded(get().paymentMethods, expense.paymentMethodId) ? ('method' as const) : undefined),
              // Today's entries carry the exact time; back-dated ones stay day-level (read at noon).
              occurredAt: expense.occurredAt ?? (expense.date === localTodayISO() ? new Date().toISOString() : undefined),
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
          const adopted = new Set(loggedChargesAdopted(state.expenses, expense))
          const rest = adopted.size > 0 ? state.expenses.filter((e) => !adopted.has(e.id)) : state.expenses
          const i = rest.findIndex((e) => e.id === expense.id)
          if (i === -1) return { expenses: [...rest, expense] }
          const next = rest.slice()
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
          expenses: state.expenses.map((e) => {
            if (e.id !== id) return e
            // A moved date moves the instant too, or balances/ordering keep reading the old day.
            const movedDay = updates.date && updates.date !== e.date && !('occurredAt' in updates)
            return {
              ...e,
              ...updates,
              ...(movedDay ? { occurredAt: new Date(`${updates.date}T12:00:00`).toISOString() } : {}),
              updatedAt: new Date().toISOString(),
            }
          }),
        })),

      deleteExpense: (id) => {
        const removed = get().expenses.find((e) => e.id === id)
        set((state) => ({
          expenses: state.expenses.filter((e) => e.id !== id),
        }))
        if (removed?.receiptId) dropExpenseReceipt(removed.receiptId, get().receipts, get().deleteReceipt)
      },

      restoreExpense: (expense) => {
        const restored = expense.receiptId
          ? restoreExpenseReceipt(expense.receiptId, (r) => set((state) => (state.receipts.some((x) => x.id === r.id) ? state : { receipts: [...state.receipts, r] })))
          : false
        const dangling = !!expense.receiptId && !restored && !get().receipts.some((r) => r.id === expense.receiptId)
        const back = dangling ? { ...expense, receiptId: undefined } : expense
        set((state) =>
          state.expenses.some((e) => e.id === back.id)
            ? state
            : { expenses: [...state.expenses, back] },
        )
      },

      addIncomeSource: (source) =>
        set((state) => ({
          incomeSources: [
            ...state.incomeSources,
            {
              ...source,
              sourceType: source.sourceType ?? 'other',
              effectiveStart: source.effectiveStart ?? localTodayISO(),
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
          // Borrowed money is a received event (one-time), linked to the debt it created.
          incomeEvents: [
            ...state.incomeEvents,
            {
              id: incomeId,
              name: income.name,
              amount: income.amount,
              currency: cur,
              sourceType: 'debt' as IncomeSourceType,
              receivedDate: iso.slice(0, 10),
              status: 'confirmed' as const,
              paymentMethodId: income.paymentMethodId,
              linkedDebtId: debtId,
              notes: income.notes,
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
              incomeSources.length === 0 && !state.incomeEvents.some((e) => e.status === 'confirmed' || e.status === 'late' || e.status === 'partial')
                ? { ...state.settings, noIncomeDeclared: true }
                : state.settings,
          }
        }),

      restoreIncomeSource: (source) =>
        set((state) =>
          state.incomeSources.some((s) => s.id === source.id)
            ? state
            : {
                incomeSources: [...state.incomeSources, source],
                settings: { ...state.settings, noIncomeDeclared: false },
              },
        ),

      restoreIncomeEvent: (event) =>
        set((state) => {
          if (state.incomeEvents.some((e) => e.id === event.id)) return state
          const incomeEvents = [...state.incomeEvents, event]
          const settings = { ...state.settings, noIncomeDeclared: false }
          // Deleting a withdrawal-linked event put the money back as a reversal deposit: take that back.
          const reversalId = reversalDepositByEvent.get(event.id)
          reversalDepositByEvent.delete(event.id)
          const reversal = reversalId ? state.savingsTransactions.find((tx) => tx.id === reversalId) : undefined
          if (!reversal) return { incomeEvents, settings }
          const nextState: FinanceStore = {
            ...state,
            incomeEvents,
            savingsTransactions: state.savingsTransactions.filter((tx) => tx.id !== reversal.id),
            savingsAccounts: state.savingsAccounts.map((a) =>
              a.id === reversal.accountId ? { ...a, currentBalance: settleBalance(a.currentBalance - reversal.amount) } : a
            ),
          }
          return {
            incomeEvents,
            settings,
            savingsTransactions: nextState.savingsTransactions,
            savingsAccounts: nextState.savingsAccounts,
            goals: reconcileGoalsForState(nextState),
          }
        }),

      addIncomeEvent: (event) =>
        set((state) => {
          const now = new Date().toISOString()
          return {
            incomeEvents: [
              ...state.incomeEvents,
              { ...event, id: generateId(), createdAt: now, updatedAt: now },
            ],
            settings: { ...state.settings, noIncomeDeclared: false },
          }
        }),

      updateIncomeEvent: (id, updates) =>
        set((state) => ({
          incomeEvents: state.incomeEvents.map((e) =>
            e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e
          ),
        })),

      deleteIncomeEvent: (id, deleteLinkedDebt) =>
        set((state) => {
          const event = state.incomeEvents.find((e) => e.id === id)
          const incomeEvents = state.incomeEvents.filter((e) => e.id !== id)
          // Borrowed-money event: optionally cascade-delete the debt it created (mirrors deleteDebt).
          if (deleteLinkedDebt && event?.linkedDebtId) {
            const debtId = event.linkedDebtId
            const nextState: FinanceStore = {
              ...state,
              incomeEvents,
              debts: state.debts.filter((d) => d.id !== debtId),
              debtPayments: state.debtPayments.filter((p) => p.debtId !== debtId),
              recurringDebtPayments: state.recurringDebtPayments.filter((r) => r.debtId !== debtId),
              goals: state.goals.map((g) => ({
                ...g,
                linkedDebtIds: g.linkedDebtIds.filter((x) => x !== debtId),
              })),
            }
            return {
              incomeEvents,
              debts: nextState.debts,
              debtPayments: nextState.debtPayments,
              recurringDebtPayments: nextState.recurringDebtPayments,
              goals: reconcileGoalsForState(nextState),
            }
          }
          // Reconcile a savings/investment withdrawal: put the money back and log the reversal.
          if (event?.linkedSavingsAccountId) {
            const acc = state.savingsAccounts.find((a) => a.id === event.linkedSavingsAccountId)
            if (acc) {
              const back =
                event.currency === acc.currency
                  ? event.amount
                  : tryConvertWithGold(event.amount, event.currency, acc.currency, state.exchangeRates, state.settings.baseCurrency, goldQuoteOf(state)) ?? event.amount
              const tx: SavingsTransaction = {
                id: generateId(),
                accountId: acc.id,
                type: 'deposit',
                amount: back,
                currency: acc.currency,
                date: localTodayISO(),
                notes: `Reversed: ${event.name}`,
                // Undoing a withdrawal, not fresh cash into savings — the withdrawal's
                // income event is being removed in the same action, so this deposit must
                // NOT reduce left-to-spend / cash outflow (both count deposits where
                // isCashFlow !== false). Without this the undo double-subtracts the amount.
                isCashFlow: false,
              }
              reversalDepositByEvent.set(event.id, tx.id)
              const nextState: FinanceStore = {
                ...state,
                incomeEvents,
                savingsTransactions: [...state.savingsTransactions, tx],
                savingsAccounts: state.savingsAccounts.map((a) =>
                  a.id === acc.id ? { ...a, currentBalance: settleBalance(a.currentBalance + back) } : a
                ),
              }
              return { ...nextState, goals: reconcileGoalsForState(nextState) }
            }
          }
          return { incomeEvents }
        }),

      upsertServerIncomeEvent: (event) =>
        set((state) => {
          const i = state.incomeEvents.findIndex((e) => e.id === event.id)
          if (i === -1) {
            return {
              incomeEvents: [...state.incomeEvents, event],
              settings: { ...state.settings, noIncomeDeclared: false },
            }
          }
          const next = state.incomeEvents.slice()
          next[i] = event
          return { incomeEvents: next }
        }),

      addPaymentMethod: (method) => {
        const pmId = generateId()
        const nowIso = new Date().toISOString()
        const newMethod: PaymentMethod = { ...method, id: pmId, createdAt: nowIso, updatedAt: nowIso }
        set((state) => {
          // Demoting the old default is an edit too — stamp it, or the demotion tie-loses
          // to the server on the next merge and you end up with two default cards.
          const paymentMethods = method.isDefault
            ? [...state.paymentMethods.map((m) => (m.isDefault ? { ...m, isDefault: false, updatedAt: nowIso } : m)), newMethod]
            : [...state.paymentMethods, newMethod]
          if (method.type !== 'credit_card') {
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
        return pmId
      },

      updatePaymentMethod: (id, updates) =>
        set((state) => {
          const now = new Date().toISOString()
          const paymentMethods = state.paymentMethods.map((m) =>
            m.id === id
              ? { ...m, ...updates, updatedAt: now }
              : updates.isDefault && m.isDefault
                ? { ...m, isDefault: false, updatedAt: now } // demotion is an edit; stamp it or it tie-loses
                : m
          )
          return updates.excluded === undefined
            ? { paymentMethods }
            : { paymentMethods, expenses: applyMethodExclusion(state.expenses, paymentMethods, now) }
        }),

      deletePaymentMethod: (id) =>
        set((state) => {
          const removal = removePaymentMethod(state, id)
          if (!removal) return {}
          if (removal.closed) return { paymentMethods: removal.paymentMethods }
          const dropped = new Set(state.debts.filter((d) => d.linkedPaymentMethodId === id).map((d) => d.id))
          const nextState: FinanceStore = {
            ...state,
            paymentMethods: removal.paymentMethods,
            debts: state.debts.filter((d) => !dropped.has(d.id)),
            debtPayments: state.debtPayments.filter((p) => !dropped.has(p.debtId)),
            recurringDebtPayments: state.recurringDebtPayments.filter((r) => !dropped.has(r.debtId)),
            goals: state.goals.map((g) => ({ ...g, linkedDebtIds: g.linkedDebtIds.filter((x) => !dropped.has(x)) })),
          }
          return {
            paymentMethods: nextState.paymentMethods,
            debts: nextState.debts,
            debtPayments: nextState.debtPayments,
            recurringDebtPayments: nextState.recurringDebtPayments,
            goals: reconcileGoalsForState(nextState),
          }
        }),

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
        // Same card = same provider, and the last four agree whenever both sides know them.
        const providerOf = (name: string, last4?: string) =>
          decomposePaymentMethodName(name.trim(), last4).provider.toLowerCase()
        const matchPm = (pm: PaymentMethod) =>
          pm.type === 'credit_card' &&
          providerOf(pm.name, pm.last4) === providerOf(paymentMethodInfo.name, paymentMethodInfo.last4) &&
          (!pm.last4 || !paymentMethodInfo.last4 || pm.last4 === paymentMethodInfo.last4)

        const existingPm = st.paymentMethods.find(matchPm)
        const pmId = existingPm?.id ?? generateId()

        const existingDebt = st.debts.find(
          (d) => d.debtType === 'credit_card' && d.linkedPaymentMethodId === pmId
        )

        const merged = normalizeDebtIncoming({
          ...(existingDebt ?? {}),
          ...definedOnly(debtInput),
          name: debtInput.name ?? existingDebt?.name ?? '',
          debtType: 'credit_card',
          direction: 'i_owe',
          status: 'active',
          linkedPaymentMethodId: pmId,
          receivedVia: 'card',
          person: debtInput.person?.trim() || '',
        } as Parameters<typeof normalizeDebtIncoming>[0])

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
                    type: 'credit_card',
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
                  type: 'credit_card',
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
        set((state) => {
          const edited = state.debts.map((d) =>
            d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d
          )
          if (updates.startingBalance === undefined) return { debts: edited }
          // A new total can settle the debt or owe it again: keep status in step with the payments.
          const ctx = { expenses: state.expenses, exchangeRates: state.exchangeRates, allDebts: edited }
          const debts = clearIfFullyPaid(edited, id, state.debtPayments, ctx, localTodayISO()).map((d) =>
            d.id === id && d.status === 'cleared' && d.debtType !== 'credit_card' && !isDebtFullyPaid(d, state.debtPayments, ctx)
              ? { ...d, status: 'active' as const, clearedAt: undefined }
              : d
          )
          return { debts }
        }),

      clearDebt: (id, clearedAtIsoDate) =>
        set((state) => ({
          debts: state.debts.map((d) =>
            d.id === id
              ? {
                  ...d,
                  status: 'cleared',
                  clearedAt: clearedAtIsoDate ?? localTodayISO(),
                  updatedAt: new Date().toISOString(),
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
        // No rate path: 0, never the foreign amount as base. Totals recompute live once a rate loads.
        const amountInBaseCurrency = converted ?? 0

        const paymentId = generateId()
        set((state) => {
          const nextState: FinanceStore = {
            ...state,
            debtPayments: [
              ...state.debtPayments,
              { ...payment, id: paymentId, createdAt: new Date().toISOString() },
            ],
            expenses: [
              ...state.expenses,
              {
                ...expense,
                amountInBaseCurrency,
                linkedDebtPaymentId: paymentId,
                id: generateId(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
          }
          return {
            debtPayments: nextState.debtPayments,
            expenses: nextState.expenses,
            debts: settleDebt(nextState, payment.debtId),
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
            debts: settleDebt(nextState, payment.debtId),
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
            ...unlinkDebt(state, id),
            // A debt goal exists only to follow its debts: once the last one is deleted the goal goes too
            // (an achieved goal stays as history).
            goals: state.goals.flatMap((g) => {
              if (!g.linkedDebtIds.includes(id)) return [g]
              const linkedDebtIds = g.linkedDebtIds.filter((x) => x !== id)
              return g.category === 'debt_freedom' && g.status !== 'achieved' && linkedDebtIds.length === 0 ? [] : [{ ...g, linkedDebtIds }]
            }),
          }
          return {
            debts: nextState.debts,
            debtPayments: nextState.debtPayments,
            recurringDebtPayments: nextState.recurringDebtPayments,
            expenses: nextState.expenses,
            incomeEvents: nextState.incomeEvents,
            incomeSources: nextState.incomeSources,
            goals: reconcileGoalsForState(nextState),
          }
        }),

      deleteDebtPayment: (id) => {
        let snapshot: DebtPaymentSnapshot | null = null
        set((state) => {
          const payment = state.debtPayments.find((p) => p.id === id)
          if (!payment) return state
          const pairedExpenses = state.expenses.filter((e) => e.linkedDebtPaymentId === id)
          const remainingPayments = state.debtPayments.filter((p) => p.id !== id)
          const expenses = pairedExpenses.length
            ? state.expenses.filter((e) => e.linkedDebtPaymentId !== id)
            : state.expenses
          const debt = state.debts.find((d) => d.id === payment.debtId)
          // Removing a payment never deletes the parent debt. If it had cleared the debt, reopen it
          // (the balance is owed again) and wake the reminder that settling switched off.
          const reopens = debt?.status === 'cleared'
          const debts = state.debts.map((d) =>
            d.id === payment.debtId && d.status === 'cleared'
              ? { ...d, status: 'active' as const, clearedAt: undefined, updatedAt: new Date().toISOString() }
              : d
          )
          // Only an unambiguous case wakes anything: a debt with several schedules, or an active one
          // already running, never has a reminder resurrected (it may have been paused by hand).
          const ownSchedules = reopens ? state.recurringDebtPayments.filter((r) => r.debtId === payment.debtId) : []
          const dormant = ownSchedules.length === 1 && !ownSchedules[0].isActive ? ownSchedules[0] : undefined
          snapshot = {
            payment,
            expenses: pairedExpenses,
            debtWasCleared: reopens,
            schedule: dormant,
          }
          const recurringDebtPayments = dormant
            ? state.recurringDebtPayments.map((r) => (r.id === dormant.id ? { ...r, isActive: true } : r))
            : state.recurringDebtPayments
          const nextState: FinanceStore = { ...state, debts, debtPayments: remainingPayments, expenses }
          return {
            debts,
            debtPayments: remainingPayments,
            expenses,
            recurringDebtPayments,
            goals: reconcileGoalsForState(nextState),
          }
        })
        return snapshot
      },

      restoreDebtPayment: (snapshot) =>
        set((state) => {
          if (state.debtPayments.some((p) => p.id === snapshot.payment.id)) return state
          const debtPayments = [...state.debtPayments, snapshot.payment]
          const expenses = [
            ...state.expenses,
            ...snapshot.expenses.filter((x) => !state.expenses.some((e) => e.id === x.id)),
          ]
          const recurringDebtPayments = snapshot.schedule
            ? state.recurringDebtPayments.map((r) => (r.id === snapshot.schedule!.id ? snapshot.schedule! : r))
            : state.recurringDebtPayments
          const nextState: FinanceStore = { ...state, debtPayments, expenses, recurringDebtPayments }
          return {
            debtPayments,
            expenses,
            recurringDebtPayments,
            debts: settleDebt(nextState, snapshot.payment.debtId),
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
            { ...expense, id: generateId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
          ],
        })),

      updateRecurringExpense: (id, updates) =>
        set((state) => ({
          recurringExpenses: state.recurringExpenses.map((e) =>
            e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e
          ),
        })),

      deleteRecurringExpense: (id) =>
        set((state) => ({
          recurringExpenses: state.recurringExpenses.filter((e) => e.id !== id),
          subscriptions: state.subscriptions.map((sub) =>
            sub.linkedRecurringExpenseId === id ? { ...sub, linkedRecurringExpenseId: null, updatedAt: new Date().toISOString() } : sub),
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
          updatedAt: new Date().toISOString(),
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
          const merged: Subscription = { ...sub, ...updates, updatedAt: new Date().toISOString() }
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

      applyPendingPlanChange: (id) => {
        const sub = get().subscriptions.find((s) => s.id === id)
        if (!sub?.pendingPlanId) return
        const brand = findBrandByKey(sub.brandKey)
        const plan = brand && sub.catalogRegion
          ? plansForRegion(brand, sub.catalogRegion as CatalogRegion).find((p) => p.id === sub.pendingPlanId)
          : undefined
        // Adopt the tracked amount (what the user actually pays), the new plan id, and its
        // label; clear pending. Routed through updateSubscription so the linked recurring
        // expense's amount stays in sync.
        const amount = sub.pendingAmount ?? sub.amount
        get().updateSubscription(id, {
          planId: sub.pendingPlanId,
          planName: plan?.name ?? sub.planName,
          amount,
          priceHistory: priceHistoryWith(sub, amount, sub.pendingPlanFrom ?? localTodayISO()),
          pendingPlanId: null,
          pendingAmount: null,
          pendingPlanFrom: null,
        })
      },

      dismissPendingPlanChange: (id) =>
        set((state) => ({
          subscriptions: state.subscriptions.map((s) =>
            s.id === id
              ? { ...s, pendingPlanId: null, pendingAmount: null, pendingPlanFrom: null, updatedAt: new Date().toISOString() }
              : s
          ),
        })),

      cancelSubscription: (id, endsOn) =>
        set((state) => {
          const sub = state.subscriptions.find((s) => s.id === id)
          const cancelledAt = new Date().toISOString()
          const endDate = endsOn ?? localTodayISO()
          // A cancelled sub must not keep a plan-change prompt alive for its reactivation.
          const subs = state.subscriptions.map((s) =>
            s.id === id
              ? {
                  ...s,
                  status: 'cancelled' as const,
                  cancelledAt,
                  endsOn: endDate,
                  pendingPlanId: null,
                  pendingAmount: null,
                  pendingPlanFrom: null,
                  updatedAt: cancelledAt,
                }
              : s
          )
          let recurring = state.recurringExpenses
          if (sub?.linkedRecurringExpenseId) {
            recurring = state.recurringExpenses.map((re) =>
              re.id === sub.linkedRecurringExpenseId
                ? { ...re, isActive: plannerRowActive({ status: 'cancelled', endsOn: endDate }, localTodayISO()), updatedAt: new Date().toISOString() }
                : re
            )
          }
          return { subscriptions: subs, recurringExpenses: recurring }
        }),

      pauseSubscription: (id) =>
        get().updateSubscription(id, { status: 'paused', pausedAt: new Date().toISOString() }),

      resumeSubscription: (id) =>
        get().updateSubscription(id, { status: 'active', pausedAt: null, createdAt: new Date().toISOString() }),

      convertTrial: (id) => get().updateSubscription(id, { status: 'active', trialEnd: null }),

      markSubscriptionPaid: (id, charge) => {
        const { subscriptions, expenses, paymentMethods, addExpense } = get()
        const sub = subscriptions.find((s) => s.id === id)
        if (!sub) return
        // Paying ahead of the due date records the charge on that date, so it belongs to that cycle.
        const target = charge?.date ? null : markPaidTarget(sub, expenses)
        const date = charge?.date ?? (target ? format(target, 'yyyy-MM-dd') : null)
        if (!date) return
        addExpense({
          date,
          description: sub.planName ? `${sub.name} ${sub.planName}` : sub.name,
          category: 'Subscription',
          amount: charge?.amount ?? chargeAmount(sub),
          currency: sub.currency,
          paymentMethodId:
            sub.paymentMethodId || paymentMethods.find((m) => m.isDefault)?.id || paymentMethods[0]?.id || '',
          isRecurring: true,
          linkedSubscriptionId: id,
        })
      },

      linkSubscriptionCharges: (subId, expenseIds) =>
        set((state) => {
          const ids = new Set(expenseIds)
          return {
            expenses: state.expenses.map((e) =>
              ids.has(e.id) ? { ...e, linkedSubscriptionId: subId, updatedAt: new Date().toISOString() } : e
            ),
          }
        }),

      unlinkSubscriptionCharge: (expenseId) =>
        set((state) => ({
          expenses: state.expenses.map((e) =>
            e.id === expenseId ? { ...e, linkedSubscriptionId: undefined, updatedAt: new Date().toISOString() } : e
          ),
        })),

      adoptSubscriptionPrice: (id, amount) => {
        const sub = get().subscriptions.find((s) => s.id === id)
        if (!sub) return
        get().updateSubscription(id, { amount, priceHistory: priceHistoryWith(sub, amount, localTodayISO()) })
      },

      logDueSubscriptions: () => {
        const { subscriptions, expenses } = get()
        const today = new Date()
        const todayIso = localTodayISO()
        const lapsed = new Set(
          subscriptions
            .filter((s) => s.status === 'cancelled' && s.linkedRecurringExpenseId && !plannerRowActive(s, todayIso))
            .map((s) => s.linkedRecurringExpenseId)
        )
        if (get().recurringExpenses.some((r) => r.isActive && lapsed.has(r.id))) {
          set((state) => ({
            recurringExpenses: state.recurringExpenses.map((r) =>
              r.isActive && lapsed.has(r.id) ? { ...r, isActive: false, updatedAt: new Date().toISOString() } : r
            ),
          }))
        }
        for (const sub of subscriptions) {
          if (!isCharging(sub, today)) continue
          const state = cycleState(sub, expenses, today)
          if (trackingAction(sub.tracking, state) !== 'log') continue
          // A converted trial starts billing at trialEnd; cycles inside the trial were free.
          if (sub.trialEnd && format(state.due, 'yyyy-MM-dd') < sub.trialEnd.slice(0, 10)) continue
          get().markSubscriptionPaid(sub.id, { date: format(state.due, 'yyyy-MM-dd') })
        }
      },

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
            endsOn: null,
            pausedAt: null,
            // Cycles that opened while it was off were not tracked: charging resumes from today.
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
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

      addBudgetPlan: (name, options) => {
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
              status: options?.status ?? 'ready',
              intent: options?.intent ?? 'custom',
              origin: options?.origin ?? 'manual',
              rationale: options?.rationale ?? null,
              engineVersion: options?.engineVersion ?? null,
            },
          ],
          activeBudgetPlanId: options?.status === 'draft' ? state.activeBudgetPlanId : id,
        }))
        return id
      },

      updateBudgetPlan: (planId, updates) =>
        set((state) => ({
          budgetPlans: state.budgetPlans.map((p) => {
            if (p.id !== planId) return p
            const { name, buddgyFlow, ...rest } = updates
            return {
              ...p,
              ...definedOnly(rest),
              name: name !== undefined ? name.trim() || p.name : p.name,
              buddgyFlow:
                buddgyFlow === undefined
                  ? p.buddgyFlow
                  : buddgyFlow === null
                    ? null
                    : { ...(p.buddgyFlow ?? {}), ...buddgyFlow },
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
            spendingCategory: input.spendingCategory ?? null,
            notes: input.notes ?? null,
            targetDate: input.targetDate ?? null,
            monthlyContribution: input.monthlyContribution ?? null,
            fundingMode: input.fundingMode ?? 'manual',
            sharePct: input.sharePct ?? null,
            frequency: input.frequency ?? 'monthly',
            planStart: input.planStart ?? null,
            priority: input.priority ?? Math.max(0, ...state.goals.map((g) => g.priority)) + 1,
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
          let log = state.budgetPlanActivations.filter((a) => a.planId !== planId)
          if (active === planId) {
            active = selectActivePlan(next, null)?.id ?? null
            // The fallback plan must govern this cycle, or months would keep resolving to an older plan.
            if (active && log.length > 0) {
              log = recordActivation(log, active, cycleKeyOf(new Date(), state.settings.monthStartDay), generateId, new Date().toISOString())
            }
          }
          const memories = state.buddgyMemories.filter((m) => m.planId !== planId)
          return { budgetPlans: next, activeBudgetPlanId: active, budgetPlanActivations: log, buddgyMemories: memories }
        }),

      setActiveBudgetPlanId: (id) => set({ activeBudgetPlanId: id }),

      activateBudgetPlan: (planId, cycleKey) => {
        const undo: BudgetActivationUndo = {
          activeBudgetPlanId: get().activeBudgetPlanId,
          activations: get().budgetPlanActivations,
        }
        set((state) => {
          const now = new Date().toISOString()
          let log = state.budgetPlanActivations
          const previous = state.budgetPlans.find((p) => p.id === state.activeBudgetPlanId)
          // First recorded switch: the plan that has been active until now keeps the months before it.
          if (log.length === 0 && previous && previous.id !== planId) {
            // Never later than the cycle before the switch, so earlier months stay with the old plan.
            const created = cycleKeyOf(new Date(previous.createdAt), 1)
            const before = prevKey(cycleKey)
            log = recordActivation(log, previous.id, created < before ? created : before, generateId, now)
          }
          return {
            budgetPlanActivations: recordActivation(log, planId, cycleKey, generateId, now),
            activeBudgetPlanId: planId,
          }
        })
        return undo
      },

      restoreBudgetActivation: (undo) =>
        set({ activeBudgetPlanId: undo.activeBudgetPlanId, budgetPlanActivations: undo.activations }),

      addBuddgyMemory: (text, source, kind = 'fact', planId) => {
        const clean = text.replace(/\s+/g, ' ').trim().slice(0, MEMORY_MAX_CHARS)
        const existing = get().buddgyMemories
        if (!clean || existing.length >= MEMORY_CAP || existing.some((m) => m.text.toLowerCase() === clean.toLowerCase())) return null
        const now = new Date().toISOString()
        const id = generateId()
        set({ buddgyMemories: [...existing, { id, text: clean, kind, source, status: 'active', ...(planId ? { planId } : {}), createdAt: now, updatedAt: now }] })
        return id
      },

      addAccountAdjustment: (a) => {
        const id = generateId()
        const now = new Date().toISOString()
        set((state) => ({ accountAdjustments: [...state.accountAdjustments, { ...a, id, createdAt: now, updatedAt: now }] }))
        return id
      },

      removeBuddgyMemory: (id) => set((state) => ({ buddgyMemories: state.buddgyMemories.filter((m) => m.id !== id) })),

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
              ...definedOnly(category),
              id: catId,
              name: uniquePlanCategoryName(p.categories, category.name.trim() || 'Category'),
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
                        ...(s.icon ? { icon: s.icon } : {}),
                      }))
                    : c.subcategories
                const { amount, currency } = updates
                return {
                  ...c,
                  ...definedOnly(updates),
                  ...(amount !== undefined ? { amount: Number.isFinite(amount) ? amount : 0 } : {}),
                  ...(currency !== undefined ? { currency: clampFiatToAllowed(state.settings, currency) } : {}),
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

      addInvestmentHolding: (h) => {
        const id = generateId()
        const now = new Date().toISOString()
        set((state) => ({
          investmentHoldings: [...state.investmentHoldings, { ...h, id, createdAt: now, updatedAt: now }],
        }))
        return id
      },

      updateInvestmentHolding: (id, updates) =>
        set((state) => ({
          investmentHoldings: state.investmentHoldings.map((h) =>
            h.id === id ? { ...h, ...updates, updatedAt: new Date().toISOString() } : h
          ),
        })),

      deleteInvestmentHolding: (id) =>
        set((state) => ({
          investmentHoldings: state.investmentHoldings.filter((h) => h.id !== id),
        })),

      addSavingsAccount: (a) => {
        const input = a as Omit<SavingsAccount, 'id' | 'createdAt' | 'currentBalance'> & {
          openingBalance?: number
        }
        const { openingBalance: openingField, ...rest } = input
        const openingBalance = Math.max(0, Number(openingField) || 0)
        const id = generateId()
        const today = localTodayISO()
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
                    // Declaring what already exists — no cash moved, so it must not be
                    // netted out of monthlyFlow (that would zero out the account).
                    isCashFlow: false,
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
            ...unlinkSavingsAccount(state, id),
            goals: state.goals.map((g) => ({
              ...g,
              linkedSavingsAccountIds: g.linkedSavingsAccountIds.filter((x) => x !== id),
            })),
          }
          return {
            savingsAccounts: nextState.savingsAccounts,
            savingsTransactions: nextState.savingsTransactions,
            recurringSavingsDeposits: nextState.recurringSavingsDeposits,
            incomeEvents: nextState.incomeEvents,
            incomeSources: nextState.incomeSources,
            goals: reconcileGoalsForState(nextState),
            ...(state.profile.defaultCarryPocketId === id
              ? { profile: { ...state.profile, defaultCarryPocketId: null } }
              : {}),
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
        if (raw <= 0) return false
        let ok = false
        set((state) => {
          if (opts?.txId && state.savingsTransactions.some((t) => t.id === opts.txId)) {
            ok = true
            return state
          }
          const acc = state.savingsAccounts.find((a) => a.id === accountId)
          if (!acc) return state
          const cIn =
            currency === acc.currency ? acc.currency : clampFiatToAllowed(state.settings, currency)
          const amt =
            cIn === acc.currency
              ? raw
              : tryConvertWithGold(raw, cIn, acc.currency, state.exchangeRates, state.settings.baseCurrency, goldQuoteOf(state))
          if (amt === null || amt <= 0) return state
          // Only cash deposits get an account leg; an explicit paymentMethodId (set-aside) is kept as given.
          const legId =
            opts?.paymentMethodId ??
            (opts?.mode === 'declare' ? undefined : resolveAccountLeg(state.paymentMethods, acc, opts?.fromAccountId, acc.currency))
          const tx: SavingsTransaction = {
            id: opts?.txId ?? generateId(),
            accountId,
            type: 'deposit',
            amount: amt,
            currency: acc.currency,
            date: localTodayISO(),
            notes,
            source: opts?.source,
            isAutoSave: opts?.isAutoSave,
            // 'declare' = money from outside the budget: raise net worth without touching
            // this month's flow. 'allocate' (default) is real cash flow — left as undefined
            // so cashSavingsDepositsInBaseForMonth counts it against left-to-spend.
            ...(opts?.mode === 'declare' ? { isCashFlow: false } : {}),
            occurredAt: new Date().toISOString(),
            ...(legId ? { paymentMethodId: legId } : {}),
          }
          const nextState: FinanceStore = {
            ...state,
            savingsTransactions: [...state.savingsTransactions, tx],
            savingsAccounts: state.savingsAccounts.map((a) =>
              a.id === accountId ? { ...a, currentBalance: settleBalance(a.currentBalance + amt) } : a
            ),
          }
          ok = true
          return {
            ...nextState,
            goals: reconcileGoalsForState(nextState),
          }
        })
        return ok
      },

      transferBetweenPockets: (fromId, toId, amount, notes) => {
        const raw = Math.max(0, Number(amount) || 0)
        if (raw <= 0 || fromId === toId) return false
        let ok = false
        set((state) => {
          const from = state.savingsAccounts.find((a) => a.id === fromId)
          const to = state.savingsAccounts.find((a) => a.id === toId)
          if (!from || !to) return state
          if (from.currentBalance + balanceEpsilon(from.currency) < raw) return state // insufficient
          // Convert into the destination's unit; fails closed when there is no path or gold is unpriced.
          const toAmt =
            to.currency === from.currency
              ? raw
              : tryConvertWithGold(raw, from.currency, to.currency, state.exchangeRates, state.settings.baseCurrency, goldQuoteOf(state))
          if (toAmt === null || toAmt <= 0) return state
          const gid = generateId()
          const today = localTodayISO()
          // Both legs are non-cash-flow: money moved between pockets, so neither net worth
          // nor left-to-spend changes.
          const outTx: SavingsTransaction = {
            id: generateId(), accountId: fromId, type: 'withdrawal', amount: raw,
            currency: from.currency, date: today, notes, source: 'transfer',
            transferGroupId: gid, isCashFlow: false,
          }
          const inTx: SavingsTransaction = {
            id: generateId(), accountId: toId, type: 'deposit', amount: toAmt,
            currency: to.currency, date: today, notes, source: 'transfer',
            transferGroupId: gid, isCashFlow: false,
          }
          const nextState: FinanceStore = {
            ...state,
            savingsTransactions: [...state.savingsTransactions, outTx, inTx],
            savingsAccounts: state.savingsAccounts.map((a) =>
              a.id === fromId
                ? { ...a, currentBalance: settleBalance(Math.max(0, a.currentBalance - raw)) }
                : a.id === toId
                  ? { ...a, currentBalance: settleBalance(a.currentBalance + toAmt) }
                  : a
            ),
          }
          ok = true
          return { ...nextState, goals: reconcileGoalsForState(nextState) }
        })
        return ok
      },

      withdrawFromSavings: (accountId, amount, currency, notes, purpose = 'income', opts) => {
        const raw = Math.max(0, Number(amount) || 0)
        if (raw <= 0) return false
        let ok = false
        set((state) => {
          const acc = state.savingsAccounts.find((a) => a.id === accountId)
          if (!acc) return state
          const cIn =
            currency === acc.currency ? acc.currency : clampFiatToAllowed(state.settings, currency)
          const amt =
            cIn === acc.currency
              ? raw
              : tryConvertWithGold(raw, cIn, acc.currency, state.exchangeRates, state.settings.baseCurrency, goldQuoteOf(state))
          if (amt === null || amt <= 0 || acc.currentBalance + balanceEpsilon(acc.currency) < amt) return state
          const tx: SavingsTransaction = {
            id: generateId(),
            accountId,
            type: 'withdrawal',
            amount: amt,
            currency: acc.currency,
            date: localTodayISO(),
            notes,
          }
          // Only 'income' returns the money to this month's spendable income. A transfer,
          // debt payment or spend must NOT create an income event — that would inflate the
          // income KPI and (for a transfer) loop the money back into savings. F4.
          const isInvestment = acc.category === 'investment'
          const nowIso = new Date().toISOString()
          // Income events are money: a gold withdrawal is booked at today's gram price in base, never as grams.
          const eventCurrency = acc.currency === 'XAU' ? state.settings.baseCurrency : acc.currency
          const eventAmt =
            purpose === 'income'
              ? tryConvertWithGold(amt, acc.currency, eventCurrency, state.exchangeRates, state.settings.baseCurrency, goldQuoteOf(state))
              : null
          if (purpose === 'income' && (eventAmt === null || eventAmt <= 0)) return state
          // The account leg lives on the income event only (money currency), never also on the tx: one side, no double credit.
          const legId = purpose === 'income' ? resolveAccountLeg(state.paymentMethods, acc, opts?.toAccountId, eventCurrency) : undefined
          const incomeEvent: IncomeEvent | null =
            purpose === 'income' && eventAmt !== null
              ? {
                  id: incomeEventIdForTx(tx.id),
                  name: isInvestment ? `Return from ${acc.name}` : `Withdrawal from ${acc.name}`,
                  amount: eventAmt,
                  currency: eventCurrency,
                  sourceType: isInvestment ? 'investment' : 'savings',
                  // Local, to match the paired ledger row's `date` — the same movement must
                  // not straddle two calendar days in the Cairo-before-dawn window.
                  receivedDate: localTodayISO(),
                  status: 'confirmed',
                  linkedSavingsAccountId: accountId,
                  ...(legId ? { paymentMethodId: legId, occurredAt: nowIso } : {}),
                  notes: notes?.trim() || undefined,
                  createdAt: nowIso,
                  updatedAt: nowIso,
                }
              : null
          const nextState: FinanceStore = {
            ...state,
            savingsTransactions: [...state.savingsTransactions, tx],
            savingsAccounts: state.savingsAccounts.map((a) =>
              a.id === accountId ? { ...a, currentBalance: settleBalance(Math.max(0, a.currentBalance - amt)) } : a
            ),
            incomeEvents: incomeEvent ? [...state.incomeEvents, incomeEvent] : state.incomeEvents,
            settings: incomeEvent
              ? { ...state.settings, noIncomeDeclared: false }
              : state.settings,
          }
          ok = true
          return {
            ...nextState,
            goals: reconcileGoalsForState(nextState),
          }
        })
        return ok
      },

      deleteSavingsTransaction: (id) => {
        let result: DeleteSavingsTxResult = { ok: false, reason: 'not_found' }
        set((state) => {
          const tx = state.savingsTransactions.find((t) => t.id === id)
          if (!tx) return state
          // A transfer is two legs — remove both and reverse each.
          const ids = tx.transferGroupId
            ? state.savingsTransactions.filter((t) => t.transferGroupId === tx.transferGroupId).map((t) => t.id)
            : [id]
          const removed = state.savingsTransactions.filter((t) => ids.includes(t.id))
          const balanceDelta: Record<string, number> = {}
          for (const r of removed) {
            // Reverse: undo a deposit by subtracting, undo a withdrawal by adding back.
            balanceDelta[r.accountId] = (balanceDelta[r.accountId] ?? 0) + (r.type === 'deposit' ? -r.amount : r.amount)
          }
          // Never clamp: a delete that would drive a pocket negative is refused so ledger and balance stay equal.
          for (const a of state.savingsAccounts) {
            const next = a.currentBalance + (balanceDelta[a.id] ?? 0)
            if (balanceDelta[a.id] != null && next < -balanceEpsilon(a.currency)) {
              result = { ok: false, reason: 'would_go_negative', accountId: a.id, shortBy: -next }
              return state
            }
          }
          const pairedEventIds = new Set(removed.filter((r) => r.type === 'withdrawal').map((r) => incomeEventIdForTx(r.id)))
          const nextState: FinanceStore = {
            ...state,
            savingsTransactions: state.savingsTransactions.filter((t) => !ids.includes(t.id)),
            savingsAccounts: state.savingsAccounts.map((a) =>
              balanceDelta[a.id] != null ? { ...a, currentBalance: settleBalance(a.currentBalance + balanceDelta[a.id]) } : a
            ),
            incomeEvents: state.incomeEvents.filter((e) => !pairedEventIds.has(e.id)),
          }
          result = { ok: true }
          return { ...nextState, goals: reconcileGoalsForState(nextState) }
        })
        return result
      },

      correctSavingsBalance: (accountId, newBalance, notes) => {
        const nb = Math.max(0, Number(newBalance) || 0)
        set((state) => {
          const acc = state.savingsAccounts.find((a) => a.id === accountId)
          if (!acc) return state
          const diff = nb - acc.currentBalance
          if (Math.abs(diff) < balanceEpsilon(acc.currency)) return state
          const type: SavingsTransaction['type'] = diff > 0 ? 'deposit' : 'withdrawal'
          const tx: SavingsTransaction = {
            id: generateId(),
            accountId,
            type,
            amount: Math.abs(diff),
            currency: acc.currency,
            date: localTodayISO(),
            notes: notes?.trim() || 'Manual balance correction',
            // A revaluation (e.g. investment gains), not cash — netting it out of
            // monthlyFlow would cancel the gain. `type` still carries the direction.
            isCashFlow: false,
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
          exchangeRates: { ...state.exchangeRates, ...withoutGoldRates(rates) },
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

      importData: async (jsonString) => {
        let parsed: unknown
        try {
          parsed = JSON.parse(jsonString)
        } catch {
          throw new Error(
            'Invalid file: could not parse JSON. Make sure you exported a Buddget backup (.json).'
          )
        }

        const { importDataSchema } = await import('./financeImportSchema')
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
            budgetPlanActivations: data.budgetPlanActivations ?? state.budgetPlanActivations,
            buddgyMemories: data.buddgyMemories ?? state.buddgyMemories,
            accountAdjustments: data.accountAdjustments ?? state.accountAdjustments,
            activeBudgetPlanId:
              data.activeBudgetPlanId !== undefined ? data.activeBudgetPlanId : state.activeBudgetPlanId,
            financialGoalsNotes:
              data.financialGoalsNotes !== undefined ? data.financialGoalsNotes : state.financialGoalsNotes,
            savingsHoldings: data.savingsHoldings !== undefined ? savingsHoldingsOut : state.savingsHoldings,
            savingsAccounts,
            savingsTransactions,
            recurringSavingsDeposits: data.recurringSavingsDeposits ?? state.recurringSavingsDeposits,
            settings: data.settings
              ? { ...state.settings, ...data.settings, weekStartDay: data.settings.weekStartDay ?? state.settings.weekStartDay }
              : state.settings,
            goals: data.goals ? data.goals.map(withGoalDefaults) : state.goals,
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
          budgetPlanActivations: state.budgetPlanActivations,
          buddgyMemories: state.buddgyMemories,
          accountAdjustments: state.accountAdjustments,
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
          incomeEvents: [],
          expenses: [],
          receipts: [],
          recurringExpenses: [],
          budgetCategories: DEFAULT_BUDGET,
          budgetPlans: [],
          budgetPlanActivations: [],
          buddgyMemories: [],
          accountAdjustments: [],
          activeBudgetPlanId: null,
          financialGoalsNotes: '',
          savingsHoldings: [],
          investmentHoldings: [],
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
        // v22: cached rates may carry per-troy-ounce XAU keys; gold grams are priced from the gram price only.
        if (fromVersion < 22 && base.exchangeRates && typeof base.exchangeRates === 'object') {
          base.exchangeRates = withoutGoldRates(base.exchangeRates as Record<string, number>)
        }
        // v20-21: goals gain funding_mode / share_pct / frequency / plan_start.
        if (fromVersion < 21 && Array.isArray(base.goals)) {
          base.goals = (base.goals as Goal[]).map(withGoalDefaults)
        }
        // v19: payment method types moved to the 8-value model. Remap the legacy
        // enum strings on cached rows so they resolve to valid new types.
        if (fromVersion < 19 && Array.isArray(base.paymentMethods)) {
          base.paymentMethods = (base.paymentMethods as Record<string, unknown>[]).map((m) => ({
            ...m,
            type: normalizePaymentMethodType(m.type as string),
          }))
        }
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
            budgetPlanActivations: Array.isArray(p.budgetPlanActivations) ? p.budgetPlanActivations : [],
            buddgyMemories: Array.isArray(p.buddgyMemories) ? p.buddgyMemories : [],
            accountAdjustments: Array.isArray(p.accountAdjustments) ? p.accountAdjustments : [],
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
            budgetPlanActivations: Array.isArray(p.budgetPlanActivations) ? p.budgetPlanActivations : [],
            buddgyMemories: Array.isArray(p.buddgyMemories) ? p.buddgyMemories : [],
            accountAdjustments: Array.isArray(p.accountAdjustments) ? p.accountAdjustments : [],
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
          incomeEvents: [],
          expenses: [],
          recurringExpenses: [],
          budgetCategories: DEFAULT_BUDGET,
          savingsHoldings: [],
          investmentHoldings: [],
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
      storage: persistStorage,
      // dataReady is recomputed by `merge` on every boot and goldPriceStale is always reset there.
      partialize: (state) => {
        const rest: Partial<FinanceStore> = { ...state }
        delete rest.dataReady
        delete rest.goldPriceStale
        return rest as FinanceStore
      },
      merge: (persisted, current) => {
        const p = persisted as Partial<typeof current>
        return {
          ...current,
          ...p,
          // Cache-first boot: a returning user's persisted store IS renderable
          // data — don't blank it and force a network wait. Guests / fresh
          // installs (no real profile) still start false and gate on the pull.
          dataReady: !!(p.profile?.id && p.profile.id !== 'local'),
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
