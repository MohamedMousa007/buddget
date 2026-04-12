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
import type {
  BudgetPlanCategory,
  Currency,
  ExpenseCategory,
  PaymentMethodType,
  SavingsBucket,
  SavingsSubtype,
  Debt,
  DebtPayment,
  IncomeSource,
  PaymentMethod,
  AppSettings,
  FinanceStore,
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

export function buildAIActionHandlerContext(store: FinanceStore): AIActionHandlerContext {
  return {
    paymentMethods: store.paymentMethods,
    debts: store.debts,
    debtPayments: store.debtPayments,
    incomeSources: store.incomeSources,
    settings: store.settings,
    exchangeRates: store.exchangeRates,
    goldPricePerGram: store.goldPricePerGram,
    addExpense: store.addExpense,
    addDebtPayment: store.addDebtPayment,
    addIncomeSource: store.addIncomeSource,
    addPaymentMethod: store.addPaymentMethod,
    addSavingsHolding: store.addSavingsHolding,
    updateBudgetCategory: store.updateBudgetCategory,
    updatePlanCategory: store.updatePlanCategory,
    updateBudgetPlan: store.updateBudgetPlan,
    updateProfile: store.updateProfile,
    setFinancialGoalsNotes: store.setFinancialGoalsNotes,
  }
}

/** Context needed to validate/execute AI actions (mirrors finance store slices + actions). */
export interface AIActionHandlerContext {
  paymentMethods: PaymentMethod[]
  debts: Debt[]
  debtPayments: DebtPayment[]
  incomeSources: IncomeSource[]
  settings: AppSettings
  exchangeRates: Record<string, number>
  goldPricePerGram: number
  addExpense: FinanceStore['addExpense']
  addDebtPayment: FinanceStore['addDebtPayment']
  addIncomeSource: FinanceStore['addIncomeSource']
  addPaymentMethod: FinanceStore['addPaymentMethod']
  addSavingsHolding: FinanceStore['addSavingsHolding']
  updateBudgetCategory: FinanceStore['updateBudgetCategory']
  updatePlanCategory: FinanceStore['updatePlanCategory']
  updateBudgetPlan: FinanceStore['updateBudgetPlan']
  updateProfile: FinanceStore['updateProfile']
  setFinancialGoalsNotes: FinanceStore['setFinancialGoalsNotes']
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
  if (action === 'add_income') {
    const isRecurring =
      getField(d, 'isRecurring', 'is_recurring') === undefined
        ? true
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
      amount: Number(getField(d, 'amount')) || 0,
      currency: String(getField(d, 'currency') || ctx.settings.baseCurrency) as Currency,
      isRecurring,
      recurringFrequency: isRecurring ? recurringFrequency : undefined,
      dayOfMonth: isRecurring && recurringFrequency === 'monthly' ? dayOfMonth : undefined,
      notes: getField(d, 'notes') as string | undefined,
    })
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
  if (action === 'add_savings_holding') {
    ctx.addSavingsHolding({
      name: String(getField(d, 'name') || '').trim(),
      bucket: coerceSavingsBucket(getField(d, 'bucket')),
      subtype: coerceSavingsSubtype(getField(d, 'subtype')),
      amount: Number(getField(d, 'amount')) || 0,
      currency: String(getField(d, 'currency') || ctx.settings.baseCurrency) as Currency,
      notes: getField(d, 'notes') as string | undefined,
    })
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
      return {
        id: generateActionId(),
        name,
        icon: emoji,
        amount,
        currency,
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
