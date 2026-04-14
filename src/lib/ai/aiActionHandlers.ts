import type { AIAction } from '@/lib/ai/gemini'
import { tryConvertCurrency } from '@/lib/utils/currency'
import {
  calculateMonthlyIncome,
  moneyToGoldGrams,
  calculateDebtRemainingRaw,
  isDebtFullyPaid,
} from '@/lib/utils/calculations'
import { EXPENSE_CATEGORIES, EXPENSE_ENTRY_CATEGORIES, PAYMENT_METHOD_TYPES } from '@/lib/constants/finance'
import { pushProfileFieldsToSupabase } from '@/lib/profile/pushProfileFieldsToSupabase'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import { SAVINGS_TYPE_ICONS } from '@/lib/constants/savingsIcons'
import { defaultCategoryForSavingsType } from '@/lib/constants/savingsTypes'
import { normalizeDebtIncoming } from '@/lib/debt/normalizeDebt'
import { GOAL_CATEGORIES } from '@/lib/constants/goalCategories'
import { defaultGoalName } from '@/lib/goals/defaultGoalCopy'
import { coerceGoalCategory } from '@/lib/goals/coerceGoalCategory'
import type {
  BudgetPlanCategory,
  Currency,
  ExpenseCategory,
  PaymentMethodType,
  SavingsBucket,
  SavingsSubtype,
  SavingsType,
  Debt,
  DebtPayment,
  Expense,
  Goal,
  IncomeSource,
  IncomeSourceType,
  PaymentMethod,
  AppSettings,
  FinanceStore,
  SavingsAccount,
  SavingsAccountCategory,
  UserProfile,
} from '@/lib/store/types'

function generateActionId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

export function getField(d: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (d[key] !== undefined && d[key] !== null && d[key] !== '') return d[key]
  }
  return undefined
}

export function coercePaymentMethodType(raw: unknown): PaymentMethodType {
  const x = String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
  if (PAYMENT_METHOD_TYPES.includes(x as PaymentMethodType)) return x as PaymentMethodType
  if (x.includes('credit')) return 'card_credit'
  if (x.includes('debit')) return 'card_debit'
  if (x.includes('nol')) return 'nol'
  if (x.includes('bank') || x.includes('transfer')) return 'bank_transfer'
  if (x.includes('cash')) return 'cash'
  return 'other'
}

export function coerceSavingsBucket(raw: unknown): SavingsBucket {
  const x = String(raw || '').toLowerCase()
  return x === 'investment' ? 'investment' : 'liquid'
}

function subtypeToSavingsType(sub: SavingsSubtype): SavingsType {
  const m: Record<SavingsSubtype, SavingsType> = {
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

export function coerceSavingsSubtype(raw: unknown): SavingsSubtype {
  const x = String(raw || '').toLowerCase()
  const allowed: SavingsSubtype[] = [
    'bank',
    'cash',
    'gold',
    'stocks',
    'crypto',
    'real_estate',
    'other',
  ]
  if (x.includes('stock') || x === 'fund' || x.includes('equity')) return 'stocks'
  if (x.includes('crypto')) return 'crypto'
  if (x.includes('real')) return 'real_estate'
  if (x.includes('gold')) return 'gold'
  if (x.includes('cash')) return 'cash'
  if (allowed.includes(x as SavingsSubtype)) return x as SavingsSubtype
  return 'other'
}

function coerceIncomeSourceType(raw: unknown): IncomeSourceType {
  const x = String(raw || 'other')
    .toLowerCase()
    .trim()
    .replace(/-/g, '_')
  const allowed: IncomeSourceType[] = [
    'salary',
    'bonus',
    'side_hustle',
    'investment',
    'savings',
    'debt',
    'gift',
    'refund',
    'other',
  ]
  if (allowed.includes(x as IncomeSourceType)) return x as IncomeSourceType
  if (x.includes('salary')) return 'salary'
  if (x.includes('bonus')) return 'bonus'
  if (x.includes('side')) return 'side_hustle'
  if (x.includes('invest')) return 'investment'
  if (x.includes('saving')) return 'savings'
  if (x.includes('debt') || x.includes('borrow') || x.includes('loan')) return 'debt'
  if (x.includes('gift')) return 'gift'
  if (x.includes('refund')) return 'refund'
  return 'other'
}

function coerceAISavingsType(raw: unknown): SavingsType {
  const x = String(raw || 'bank').toLowerCase()
  if (x === 'stablecoin' || x === 'usdt' || x === 'usdc') return 'stablecoin'
  if (x.includes('stock') || x === 'fund') return 'stocks'
  if (x.includes('crypto') && !x.includes('stable')) return 'crypto'
  if (x.includes('real')) return 'real_estate'
  if (x.includes('gold')) return 'gold'
  if (x.includes('cash')) return 'cash'
  if (x.includes('bank')) return 'bank'
  const allowed: SavingsType[] = [
    'bank',
    'cash',
    'gold',
    'stablecoin',
    'crypto',
    'stocks',
    'real_estate',
    'other',
  ]
  if (allowed.includes(x as SavingsType)) return x as SavingsType
  return 'other'
}

function findExpenseByHint(ctx: AIActionHandlerContext, hint: string): Expense | undefined {
  const t = hint.trim().toLowerCase()
  if (!t) return undefined
  const sorted = [...ctx.expenses].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return sorted.find(
    (e) => e.description.toLowerCase().includes(t) || t.includes(e.description.toLowerCase())
  )
}

function findIncomeByHint(ctx: AIActionHandlerContext, hint: string): IncomeSource | undefined {
  const t = hint.trim().toLowerCase()
  if (!t) return undefined
  return ctx.incomeSources.find(
    (i) => i.name.toLowerCase().includes(t) || t.includes(i.name.toLowerCase())
  )
}

function findDebtByHint(ctx: AIActionHandlerContext, hint: string): Debt | undefined {
  const t = hint.trim().toLowerCase()
  if (!t) return undefined
  return ctx.debts.find(
    (x) =>
      x.name.toLowerCase().includes(t) ||
      (x.person && x.person.toLowerCase().includes(t)) ||
      t.includes(x.name.toLowerCase()) ||
      (x.person ? t.includes(x.person.toLowerCase()) : false)
  )
}

function findSavingsAccountByHint(
  ctx: AIActionHandlerContext,
  hint: string
): SavingsAccount | undefined {
  const t = hint.trim().toLowerCase()
  if (!t) return undefined
  return ctx.savingsAccounts.find(
    (a) => a.name.toLowerCase().includes(t) || t.includes(a.name.toLowerCase())
  )
}

export function buildAIActionHandlerContext(store: FinanceStore): AIActionHandlerContext {
  return {
    paymentMethods: store.paymentMethods,
    expenses: store.expenses,
    debts: store.debts,
    debtPayments: store.debtPayments,
    incomeSources: store.incomeSources,
    savingsAccounts: store.savingsAccounts,
    goals: store.goals,
    settings: store.settings,
    exchangeRates: store.exchangeRates,
    goldPricePerGram: store.goldPricePerGram,
    addExpense: store.addExpense,
    updateExpense: store.updateExpense,
    deleteExpense: store.deleteExpense,
    addDebtPayment: store.addDebtPayment,
    addDebt: store.addDebt,
    deleteDebt: store.deleteDebt,
    clearDebt: store.clearDebt,
    addIncomeSource: store.addIncomeSource,
    addIncomeWithDebt: store.addIncomeWithDebt,
    updateIncomeSource: store.updateIncomeSource,
    deleteIncomeSource: store.deleteIncomeSource,
    addPaymentMethod: store.addPaymentMethod,
    deletePaymentMethod: store.deletePaymentMethod,
    addSavingsHolding: store.addSavingsHolding,
    addSavingsAccount: store.addSavingsAccount,
    depositToSavings: store.depositToSavings,
    withdrawFromSavings: store.withdrawFromSavings,
    updateBudgetCategory: store.updateBudgetCategory,
    updatePlanCategory: store.updatePlanCategory,
    updateBudgetPlan: store.updateBudgetPlan,
    updateProfile: store.updateProfile,
    setFinancialGoalsNotes: store.setFinancialGoalsNotes,
    addGoal: store.addGoal,
    updateGoal: store.updateGoal,
  }
}

/** Context needed to validate/execute AI actions (mirrors finance store slices + actions). */
export interface AIActionHandlerContext {
  paymentMethods: PaymentMethod[]
  expenses: Expense[]
  debts: Debt[]
  debtPayments: DebtPayment[]
  incomeSources: IncomeSource[]
  savingsAccounts: SavingsAccount[]
  goals: Goal[]
  settings: AppSettings
  exchangeRates: Record<string, number>
  goldPricePerGram: number
  addExpense: FinanceStore['addExpense']
  updateExpense: FinanceStore['updateExpense']
  deleteExpense: FinanceStore['deleteExpense']
  addDebtPayment: FinanceStore['addDebtPayment']
  addDebt: FinanceStore['addDebt']
  deleteDebt: FinanceStore['deleteDebt']
  clearDebt: FinanceStore['clearDebt']
  addIncomeSource: FinanceStore['addIncomeSource']
  addIncomeWithDebt: FinanceStore['addIncomeWithDebt']
  updateIncomeSource: FinanceStore['updateIncomeSource']
  deleteIncomeSource: FinanceStore['deleteIncomeSource']
  addPaymentMethod: FinanceStore['addPaymentMethod']
  deletePaymentMethod: FinanceStore['deletePaymentMethod']
  addSavingsHolding: FinanceStore['addSavingsHolding']
  addSavingsAccount: FinanceStore['addSavingsAccount']
  depositToSavings: FinanceStore['depositToSavings']
  withdrawFromSavings: FinanceStore['withdrawFromSavings']
  updateBudgetCategory: FinanceStore['updateBudgetCategory']
  updatePlanCategory: FinanceStore['updatePlanCategory']
  updateBudgetPlan: FinanceStore['updateBudgetPlan']
  updateProfile: FinanceStore['updateProfile']
  setFinancialGoalsNotes: FinanceStore['setFinancialGoalsNotes']
  addGoal: FinanceStore['addGoal']
  updateGoal: FinanceStore['updateGoal']
}

export function findPaymentMethod(
  ctx: Pick<AIActionHandlerContext, 'paymentMethods'>,
  hint: unknown
): PaymentMethod | null {
  if (!hint) return ctx.paymentMethods[0] || null
  const name = String(hint).toLowerCase()
  return (
    ctx.paymentMethods.find((m) => m.name.toLowerCase() === name) ||
    ctx.paymentMethods.find((m) => m.name.toLowerCase().includes(name)) ||
    ctx.paymentMethods.find((m) => name.includes(m.name.toLowerCase())) ||
    ctx.paymentMethods[0] ||
    null
  )
}

export function validateActionItem(
  ctx: AIActionHandlerContext,
  action: AIAction,
  d: Record<string, unknown>
): string | null {
  if (action === 'add_expense') {
    const amount = Number(getField(d, 'amount')) || 0
    if (amount <= 0) return 'Each expense needs a positive amount.'
    const rawCat = String(getField(d, 'category') || 'Other')
    if (rawCat === 'Savings') {
      return 'Savings are not logged as expenses. Use add_savings_holding or the Savings page.'
    }
    const currency = String(getField(d, 'currency') || ctx.settings.baseCurrency)
    if (
      tryConvertCurrency(amount, currency, ctx.settings.baseCurrency, ctx.exchangeRates) === null
    ) {
      return `Could not convert ${currency} to ${ctx.settings.baseCurrency}. Add exchange rates in Settings.`
    }
    return null
  }
  if (action === 'add_debt_payment') {
    const originalAmount = Number(getField(d, 'amount', 'amountPaid')) || 0
    if (originalAmount <= 0) return 'Each debt payment needs a positive amount.'
    const personOrName = String(getField(d, 'debtName', 'debt_name', 'person', 'name') || '')
    const searchTerm = personOrName.toLowerCase()
    const debt = ctx.debts.find(
      (x) =>
        x.name.toLowerCase().includes(searchTerm) ||
        x.person.toLowerCase().includes(searchTerm) ||
        searchTerm.includes(x.person.toLowerCase()) ||
        searchTerm.includes(x.name.toLowerCase())
    )
    if (!debt) return `No debt matched for "${personOrName}". Check Debts or spelling.`
    if (isDebtFullyPaid(debt, ctx.debtPayments)) {
      return `The debt "${debt.name}" is already paid off.`
    }
    const rawCurrency = String(getField(d, 'currency') || ctx.settings.baseCurrency)
    const paymentCurrency = rawCurrency === 'XAU' ? ctx.settings.baseCurrency : rawCurrency
    const amountInBase = tryConvertCurrency(
      originalAmount,
      paymentCurrency,
      ctx.settings.baseCurrency,
      ctx.exchangeRates
    )
    if (amountInBase === null) {
      return `Could not convert ${paymentCurrency} to ${ctx.settings.baseCurrency}. Add exchange rates in Settings.`
    }
    let amountInDebtUnit: number
    if (debt.isGold) {
      amountInDebtUnit = moneyToGoldGrams(amountInBase, ctx.goldPricePerGram, debt.goldKarat)
    } else {
      const inDebtUnit = tryConvertCurrency(
        originalAmount,
        paymentCurrency,
        debt.currency,
        ctx.exchangeRates
      )
      if (inDebtUnit === null) {
        return `Could not convert ${paymentCurrency} to debt currency ${debt.currency}.`
      }
      amountInDebtUnit = inDebtUnit
    }
    const remaining = calculateDebtRemainingRaw(debt, ctx.debtPayments)
    if (amountInDebtUnit > remaining + 1e-6) {
      return `That payment is more than the remaining balance.`
    }
    return null
  }
  if (action === 'add_income') {
    if ((Number(getField(d, 'amount')) || 0) <= 0) return 'Income needs a positive amount.'
    return null
  }
  if (action === 'add_payment_method') {
    if (!String(getField(d, 'name') || '').trim()) return 'Payment method needs a name.'
    return null
  }
  if (action === 'add_savings_holding') {
    const name = String(getField(d, 'name') || '').trim()
    const amt = Number(getField(d, 'amount')) || 0
    if (!name || amt <= 0) return 'Savings holding needs a name and a positive amount.'
    return null
  }
  if (action === 'update_budget_category') {
    const cat = String(getField(d, 'category') || '')
    if (!EXPENSE_CATEGORIES.includes(cat as ExpenseCategory)) {
      return `Unknown budget category "${cat}".`
    }
    return null
  }
  if (action === 'update_budget_plan_row') {
    const planId = String(getField(d, 'planId', 'plan_id') || '')
    const categoryId = String(getField(d, 'categoryId', 'category_id') || '')
    const amt = Number(getField(d, 'newAmount', 'amount', 'budgetedAmount')) || 0
    if (!planId || !categoryId) return 'Budget plan update needs planId and categoryId.'
    if (amt < 0 || !Number.isFinite(amt)) return 'Amount must be a non-negative number.'
    return null
  }
  if (action === 'replace_budget_plan') {
    const planId = String(getField(d, 'planId', 'plan_id') || '')
    const rawCats = d.categories
    if (!planId.trim()) return 'Budget plan replace needs planId.'
    if (!Array.isArray(rawCats) || rawCats.length === 0) {
      return 'Budget plan replace needs a non-empty categories array.'
    }
    for (const c of rawCats) {
      if (!c || typeof c !== 'object') return 'Invalid category row in plan.'
      const row = c as Record<string, unknown>
      const name = String(row.name || '').trim()
      const amt = Number(row.amount)
      if (!name) return 'Each plan category needs a name.'
      if (!Number.isFinite(amt) || amt < 0) return 'Each plan category needs a non-negative amount.'
    }
    return null
  }
  if (action === 'delete_expense' || action === 'update_expense') {
    if (!String(getField(d, 'description') || '').trim()) {
      return `${action} needs data.description to find the expense.`
    }
    return null
  }
  if (action === 'add_debt') {
    if ((Number(getField(d, 'amount', 'startingBalance')) || 0) <= 0) return 'Debt needs a positive amount.'
    return null
  }
  if (action === 'delete_debt' || action === 'clear_debt') {
    if (!String(getField(d, 'name', 'person', 'debtName') || '').trim()) {
      return `${action} needs data.name or data.person to match a debt.`
    }
    return null
  }
  if (action === 'update_income') {
    if (!String(getField(d, 'name') || '').trim()) return 'update_income needs data.name.'
    if (
      getField(d, 'amount', 'newAmount') === undefined &&
      getField(d, 'currency') === undefined
    ) {
      return 'update_income needs data.amount or data.currency.'
    }
    return null
  }
  if (action === 'delete_income') {
    if (!String(getField(d, 'name') || '').trim()) return 'delete_income needs data.name.'
    return null
  }
  if (action === 'deposit_savings' || action === 'withdraw_savings') {
    if (!String(getField(d, 'account', 'name') || '').trim()) {
      return `${action} needs data.account (savings account name).`
    }
    if ((Number(getField(d, 'amount')) || 0) <= 0) return `${action} needs a positive data.amount.`
    return null
  }
  if (action === 'add_savings_account') {
    if (!String(getField(d, 'name') || '').trim()) return 'add_savings_account needs data.name.'
    return null
  }
  if (action === 'delete_payment_method') {
    if (!String(getField(d, 'name') || '').trim()) return 'delete_payment_method needs data.name.'
    return null
  }
  if (action === 'update_goal') {
    if (!String(getField(d, 'name', 'goalName') || '').trim()) {
      return 'update_goal needs data.name to match a goal.'
    }
    return null
  }
  return null
}

export function executeActionItem(
  ctx: AIActionHandlerContext,
  action: AIAction,
  d: Record<string, unknown>
): void {
  if (action === 'add_expense') {
    const amount = Number(getField(d, 'amount')) || 0
    const currency = String(getField(d, 'currency') || ctx.settings.baseCurrency)
    const pm = findPaymentMethod(ctx, getField(d, 'paymentMethod', 'payment_method'))
    const requestedCat = String(getField(d, 'category') || 'Other') as ExpenseCategory
    const category: ExpenseCategory =
      requestedCat === 'Savings' || !EXPENSE_ENTRY_CATEGORIES.includes(requestedCat)
        ? 'Other'
        : requestedCat
    ctx.addExpense({
      date: String(getField(d, 'date') || new Date().toISOString().slice(0, 10)),
      description: String(getField(d, 'description') || 'Expense'),
      category,
      amount,
      currency: currency as Currency,
      paymentMethodId: pm?.id || '',
      isRecurring: Boolean(getField(d, 'isRecurring', 'is_recurring')),
    })
    return
  }
  if (action === 'delete_expense') {
    const exp = findExpenseByHint(ctx, String(getField(d, 'description') || ''))
    if (exp) ctx.deleteExpense(exp.id)
    return
  }
  if (action === 'update_expense') {
    const exp = findExpenseByHint(ctx, String(getField(d, 'description') || ''))
    if (!exp) return
    const nextAmount = getField(d, 'newAmount', 'amount')
    const nextCat = getField(d, 'newCategory', 'category')
    const nextDesc = getField(d, 'newDescription', 'description')
    const patch: Partial<Expense> = {}
    if (nextDesc != null && String(nextDesc).trim()) patch.description = String(nextDesc).trim()
    if (nextCat != null && String(nextCat).trim()) patch.category = String(nextCat).trim()
    if (nextAmount !== undefined) {
      const na = Number(nextAmount)
      const ccy = String(getField(d, 'currency') || exp.currency) as Currency
      patch.amount = na
      patch.currency = ccy
      const cvt = tryConvertCurrency(na, ccy, ctx.settings.baseCurrency, ctx.exchangeRates)
      if (cvt != null) patch.amountInBaseCurrency = cvt
    }
    ctx.updateExpense(exp.id, patch)
    return
  }
  if (action === 'add_debt_payment') {
    const originalAmount = Number(getField(d, 'amount', 'amountPaid')) || 0
    const personOrName = String(getField(d, 'debtName', 'debt_name', 'person', 'name') || '')
    const searchTerm = personOrName.toLowerCase()
    const debt = ctx.debts.find(
      (x) =>
        x.name.toLowerCase().includes(searchTerm) ||
        x.person.toLowerCase().includes(searchTerm) ||
        searchTerm.includes(x.person.toLowerCase()) ||
        searchTerm.includes(x.name.toLowerCase())
    )
    if (!debt) return
    const rawCurrency = String(getField(d, 'currency') || ctx.settings.baseCurrency)
    const paymentCurrency = rawCurrency === 'XAU' ? ctx.settings.baseCurrency : rawCurrency
    const dateStr = String(getField(d, 'date') || new Date().toISOString().slice(0, 10))
    const amountInBase = tryConvertCurrency(
      originalAmount,
      paymentCurrency,
      ctx.settings.baseCurrency,
      ctx.exchangeRates
    )!
    const rateAtEntry = originalAmount > 0 ? amountInBase / originalAmount : 1
    let amountInDebtUnit: number
    if (debt.isGold) {
      amountInDebtUnit = moneyToGoldGrams(amountInBase, ctx.goldPricePerGram, debt.goldKarat)
    } else {
      amountInDebtUnit = tryConvertCurrency(
        originalAmount,
        paymentCurrency,
        debt.currency,
        ctx.exchangeRates
      )!
    }
    if (isDebtFullyPaid(debt, ctx.debtPayments)) return
    const remainingExec = calculateDebtRemainingRaw(debt, ctx.debtPayments)
    if (amountInDebtUnit > remainingExec + 1e-6) return
    ctx.addDebtPayment({
      debtId: debt.id,
      date: dateStr,
      amountPaid: amountInDebtUnit,
      paymentCurrency,
      originalAmount,
      amountInPrimary: amountInBase,
      rateAtEntry,
      notes: getField(d, 'notes') as string | undefined,
    })
    const pm = findPaymentMethod(ctx, getField(d, 'paymentMethod', 'payment_method'))
    ctx.addExpense({
      date: dateStr,
      description: `Debt payment – ${debt.person}`,
      category: 'Debt',
      amount: originalAmount,
      currency: paymentCurrency as Currency,
      paymentMethodId: pm?.id || ctx.paymentMethods[0]?.id || '',
      isRecurring: false,
    })
    return
  }
  if (action === 'add_debt') {
    const amount = Number(getField(d, 'amount', 'startingBalance')) || 0
    const currency = clampFiatToAllowed(
      ctx.settings,
      String(getField(d, 'currency') || ctx.settings.baseCurrency) as Currency
    )
    const person = String(getField(d, 'person', 'personName', 'from') || '')
    const direction = String(getField(d, 'direction') || 'i_owe') === 'they_owe' ? 'they_owe' : 'i_owe'
    ctx.addDebt(
      normalizeDebtIncoming({
        name: String(getField(d, 'name') || 'Debt'),
        person: person || '—',
        startingBalance: amount,
        currency,
        description: String(getField(d, 'description', 'notes') || ''),
        debtType: 'personal',
        direction,
        status: 'active',
        isGold: false,
        receivedVia: 'cash',
      })
    )
    return
  }
  if (action === 'delete_debt') {
    const debt = findDebtByHint(ctx, String(getField(d, 'name', 'person', 'debtName') || ''))
    if (debt) ctx.deleteDebt(debt.id)
    return
  }
  if (action === 'clear_debt') {
    const debt = findDebtByHint(ctx, String(getField(d, 'name', 'person', 'debtName') || ''))
    if (debt) ctx.clearDebt(debt.id)
    return
  }
  if (action === 'add_income') {
    const sourceType = coerceIncomeSourceType(getField(d, 'sourceType', 'source_type', 'type'))
    const amount = Number(getField(d, 'amount')) || 0
    const currency = clampFiatToAllowed(
      ctx.settings,
      String(getField(d, 'currency') || ctx.settings.baseCurrency) as Currency
    )
    const pmId = findPaymentMethod(ctx, getField(d, 'paymentMethod', 'payment_method'))?.id

    if (sourceType === 'debt') {
      const person = String(getField(d, 'person', 'from', 'personName') || '').trim()
      ctx.addIncomeWithDebt(
        {
          name: String(getField(d, 'name') || 'Income'),
          amount,
          currency,
          isRecurring: false,
          notes: getField(d, 'notes') as string | undefined,
          paymentMethodId: pmId,
        },
        normalizeDebtIncoming({
          name: String(getField(d, 'name') || 'Debt'),
          person: person || String(getField(d, 'name') || 'Unknown'),
          startingBalance: amount,
          currency,
          description: getField(d, 'description', 'notes') as string | undefined,
          debtType: 'personal',
          direction: 'i_owe',
          status: 'active',
          receivedVia: 'cash',
          isGold: false,
        })
      )
      return
    }

    const isRecurring =
      getField(d, 'isRecurring', 'is_recurring') === undefined ?
        sourceType === 'salary'
      : Boolean(getField(d, 'isRecurring', 'is_recurring'))
    const rawFreq = String(getField(d, 'recurringFrequency', 'recurring_frequency') || 'monthly')
    const recurringFrequency =
      rawFreq === 'weekly' || rawFreq === 'biweekly' ? rawFreq : 'monthly'
    const domRaw = getField(d, 'dayOfMonth', 'day_of_month')
    const dayOfMonth =
      typeof domRaw === 'number' && Number.isFinite(domRaw)
        ? Math.min(31, Math.max(1, Math.floor(domRaw)))
        : 1
    ctx.addIncomeSource({
      name: String(getField(d, 'name') || 'Income'),
      amount,
      currency,
      isRecurring,
      recurringFrequency: isRecurring ? recurringFrequency : undefined,
      dayOfMonth: isRecurring && recurringFrequency === 'monthly' ? dayOfMonth : undefined,
      notes: getField(d, 'notes') as string | undefined,
      sourceType,
      paymentMethodId: pmId,
    })
    return
  }
  if (action === 'update_income') {
    const inc = findIncomeByHint(ctx, String(getField(d, 'name') || ''))
    if (!inc) return
    const patch: Partial<IncomeSource> = {}
    const newAmt = getField(d, 'amount', 'newAmount')
    if (newAmt !== undefined) patch.amount = Number(newAmt)
    const newCur = getField(d, 'currency')
    if (newCur) patch.currency = String(newCur) as Currency
    ctx.updateIncomeSource(inc.id, patch)
    return
  }
  if (action === 'delete_income') {
    const inc = findIncomeByHint(ctx, String(getField(d, 'name') || ''))
    if (inc) ctx.deleteIncomeSource(inc.id)
    return
  }
  if (action === 'add_payment_method') {
    ctx.addPaymentMethod({
      name: String(getField(d, 'name') || '').trim(),
      type: coercePaymentMethodType(getField(d, 'type', 'methodType')),
      currency: ctx.settings.baseCurrency,
      color: '#C0C0C0',
      isDefault: false,
    })
    return
  }
  if (action === 'delete_payment_method') {
    const name = String(getField(d, 'name') || '').trim().toLowerCase()
    const pm = ctx.paymentMethods.find((m) => m.name.toLowerCase() === name || m.name.toLowerCase().includes(name))
    if (pm) ctx.deletePaymentMethod(pm.id)
    return
  }
  if (action === 'add_savings_holding') {
    const name = String(getField(d, 'name') || '').trim()
    const amount = Number(getField(d, 'amount')) || 0
    const currency = clampFiatToAllowed(
      ctx.settings,
      String(getField(d, 'currency') || ctx.settings.baseCurrency) as Currency
    )
    const sub = coerceSavingsSubtype(getField(d, 'subtype'))
    const st = subtypeToSavingsType(sub)
    const id = ctx.addSavingsAccount({
      name: name || 'Savings',
      category: defaultCategoryForSavingsType(st),
      type: st,
      icon: SAVINGS_TYPE_ICONS[st],
      currency,
      notes: getField(d, 'notes') as string | undefined,
    })
    if (amount > 0) {
      ctx.depositToSavings(id, amount, currency, getField(d, 'notes') as string | undefined)
    }
    return
  }
  if (action === 'add_savings_account') {
    const name = String(getField(d, 'name') || '').trim() || 'Savings'
    const catRaw = String(getField(d, 'category') || 'savings').toLowerCase()
    const category: SavingsAccountCategory = catRaw === 'investment' ? 'investment' : 'savings'
    const st = coerceAISavingsType(getField(d, 'type', 'subtype'))
    const currency = clampFiatToAllowed(
      ctx.settings,
      String(getField(d, 'currency') || ctx.settings.baseCurrency) as Currency
    )
    const opening = Number(getField(d, 'openingBalance', 'amount')) || 0
    ctx.addSavingsAccount({
      name,
      category,
      type: st,
      icon: SAVINGS_TYPE_ICONS[st],
      currency,
      openingBalance: opening,
      notes: getField(d, 'notes') as string | undefined,
    })
    return
  }
  if (action === 'deposit_savings') {
    const acc = findSavingsAccountByHint(ctx, String(getField(d, 'account', 'name') || ''))
    if (!acc) return
    const amount = Number(getField(d, 'amount')) || 0
    const currency = clampFiatToAllowed(
      ctx.settings,
      String(getField(d, 'currency') || acc.currency) as Currency
    )
    ctx.depositToSavings(acc.id, amount, currency, String(getField(d, 'notes') || ''))
    return
  }
  if (action === 'withdraw_savings') {
    const acc = findSavingsAccountByHint(ctx, String(getField(d, 'account', 'name') || ''))
    if (!acc) return
    const amount = Number(getField(d, 'amount')) || 0
    const currency = clampFiatToAllowed(
      ctx.settings,
      String(getField(d, 'currency') || acc.currency) as Currency
    )
    ctx.withdrawFromSavings(acc.id, amount, currency, String(getField(d, 'notes') || ''))
    return
  }
  if (action === 'update_budget_category') {
    const cat = String(getField(d, 'category') || '') as ExpenseCategory
    const monthlyIncome = calculateMonthlyIncome(
      ctx.incomeSources,
      ctx.settings.baseCurrency,
      ctx.exchangeRates
    )
    const pctRaw = getField(d, 'percentOfIncome', 'percent')
    if (pctRaw !== undefined && pctRaw !== null && pctRaw !== '') {
      const pct = Math.min(100, Math.max(0, Number(pctRaw)))
      const derived = monthlyIncome > 0 ? (pct / 100) * monthlyIncome : 0
      ctx.updateBudgetCategory(cat, derived, pct)
    } else {
      const raw = Number(getField(d, 'budgetedAmount', 'amount')) || 0
      ctx.updateBudgetCategory(cat, raw, null)
    }
    return
  }
  if (action === 'update_budget_plan_row') {
    const planId = String(getField(d, 'planId', 'plan_id') || '')
    const categoryId = String(getField(d, 'categoryId', 'category_id') || '')
    const newAmount = Math.max(0, Number(getField(d, 'newAmount', 'amount', 'budgetedAmount')) || 0)
    ctx.updatePlanCategory(planId, categoryId, {
      amount: newAmount,
      subcategories: [],
      currency: ctx.settings.baseCurrency,
    })
    return
  }
  if (action === 'replace_budget_plan') {
    const planId = String(getField(d, 'planId', 'plan_id') || '')
    const rawCats = d.categories as unknown[]
    const notes = String(getField(d, 'financialGoalsNotes') || '').trim()
    const profilePatch = d.profileUpdates as Record<string, unknown> | undefined

    const categories: BudgetPlanCategory[] = rawCats.map((raw) => {
      const row = raw as Record<string, unknown>
      const emoji = String(row.emoji || row.icon || '📦')
      const name = String(row.name || 'Category').trim() || 'Category'
      const amount = Math.max(0, Number(row.amount) || 0)
      const curRaw = String(row.currency || ctx.settings.baseCurrency)
      const currency = clampFiatToAllowed(ctx.settings, curRaw as Currency)
      const markSavings =
        row.isSavings === true ||
        (row.isSavings !== false && name.trim().toLowerCase() === 'savings')
      return {
        id: generateActionId(),
        name,
        icon: emoji,
        amount,
        currency,
        ...(markSavings ? { isSavings: true as const } : {}),
        subcategories: [],
      }
    })

    ctx.updateBudgetPlan(planId, { categories })

    if (notes) ctx.setFinancialGoalsNotes(notes)

    if (profilePatch && typeof profilePatch === 'object') {
      const patch: Partial<UserProfile> = {}
      const name = profilePatch.name != null ? String(profilePatch.name).trim() : ''
      const city = profilePatch.city != null ? String(profilePatch.city).trim() : ''
      const country = profilePatch.country != null ? String(profilePatch.country).trim() : ''
      if (name) patch.name = name
      if (city) patch.city = city
      if (country) patch.country = country
      if (Object.keys(patch).length > 0) {
        ctx.updateProfile(patch)
        if (patch.name) void pushProfileFieldsToSupabase({ name: patch.name })
      }
    }
    return
  }
  if (action === 'add_goal') {
    const cat = coerceGoalCategory(getField(d, 'category'))
    const currency = clampFiatToAllowed(
      ctx.settings,
      String(getField(d, 'currency') || ctx.settings.baseCurrency) as Currency
    )
    const taRaw = getField(d, 'targetAmount')
    const ta = taRaw !== undefined && taRaw !== null && taRaw !== '' ? Number(taRaw) : NaN
    const nameTrim = String(getField(d, 'name') || '').trim() || defaultGoalName(cat)
    const emoji = GOAL_CATEGORIES.find((x) => x.value === cat)?.emoji ?? '✏️'
    ctx.addGoal({
      name: nameTrim,
      emoji,
      category: cat,
      targetAmount: Number.isFinite(ta) && ta >= 0 ? ta : null,
      currency,
      targetDate: String(getField(d, 'targetDate') || '').trim() || null,
      monthlyContribution: (() => {
        const m = Number(getField(d, 'monthlyContribution'))
        return Number.isFinite(m) && m > 0 ? m : null
      })(),
      monthlySpendingLimit: null,
      linkedSavingsAccountIds: [],
      linkedDebtIds: [],
      manualCurrentAmount: 0,
      priority: ctx.goals.length,
      status: 'active',
      notes: null,
    })
    return
  }
  if (action === 'update_goal') {
    const hint = String(getField(d, 'name', 'goalName') || '')
      .trim()
      .toLowerCase()
    const g = ctx.goals.find(
      (x) =>
        x.name.toLowerCase().includes(hint) ||
        (hint.length > 0 && hint.includes(x.name.toLowerCase()))
    )
    if (!g) return
    const patch: Partial<Goal> = {}
    const ta = getField(d, 'targetAmount')
    if (ta !== undefined && ta !== null && ta !== '') {
      const n = Number(ta)
      if (Number.isFinite(n) && n >= 0) patch.targetAmount = n
    }
    const td = getField(d, 'targetDate')
    if (td !== undefined && td !== null) patch.targetDate = String(td).trim() || null
    const mc = getField(d, 'monthlyContribution')
    if (mc !== undefined && mc !== null && mc !== '') {
      const n = Number(mc)
      patch.monthlyContribution = Number.isFinite(n) && n > 0 ? n : null
    }
    const st = getField(d, 'status')
    if (st != null && st !== '') {
      const s = String(st).toLowerCase()
      if (s === 'active' || s === 'paused' || s === 'achieved' || s === 'cancelled') {
        patch.status = s
        if (s === 'achieved') patch.achievedAt = new Date().toISOString()
      }
    }
    ctx.updateGoal(g.id, patch)
    return
  }
}

/** Heuristic: user may have asked for multiple actions but the model returned one. */
export function looksLikeMultipleIntents(userText: string): boolean {
  const t = userText.trim()
  if (t.length < 24) return false
  const lower = t.toLowerCase()
  const andCount = (lower.match(/\band\b/g) || []).length
  const semiCount = (lower.match(/;/g) || []).length
  const numbered = /\b\d+\s*[\).]\s/m.test(lower) || /\n\s*\d+\s*[\).]\s/m.test(lower)
  return andCount >= 2 || semiCount >= 1 || numbered
}
