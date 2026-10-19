import type { Expense, FinanceStore, IncomeEvent, RecurringExpense, Currency } from '@/lib/store/types'
import type { BudgetFacts, EverydayKey, FactBill, KnownFact, StudioPriority } from '@/lib/budget/facts'
import { cycleKeyOf } from '@/lib/budget/activations'
import { shiftMonth } from '@/lib/budget/lineSpend'
import {
  goalIconKey,
  liquidSavings,
  liveDebts,
  liveGoals,
  subscriptionsLive,
} from '@/lib/budget/liveLinks'
import { fundingBasis } from '@/lib/goals/fundingBasis'
import { buildGoalProgressContext } from '@/lib/goals/computeGoalProgress'
import { isNonSpendCategory } from '@/lib/constants/categoryMeta'
import { calculateCategorySpending, filterExpensesByMonth, projectedIncomeForMonth } from '@/lib/utils/calculations'
import { convertCurrency } from '@/lib/utils/currency'

export type FactsSlice = Pick<
  FinanceStore,
  | 'profile' | 'settings' | 'incomeSources' | 'incomeEvents' | 'expenses' | 'recurringExpenses'
  | 'subscriptions' | 'debts' | 'debtPayments' | 'goals' | 'savingsAccounts' | 'exchangeRates'
  | 'budgetCategories' | 'budgetPlans' | 'activeBudgetPlanId' | 'goldPricePerGram' | 'goldPriceAvailable'
>

/** Ledger category to the everyday slot its average feeds. */
export const EVERYDAY_KEY_OF: Readonly<Record<string, EverydayKey>> = {
  Groceries: 'groceries',
  Food: 'dining',
  Transport: 'transport',
  Fuel: 'transport',
  Health: 'health',
  Shopping: 'shopping',
  Enjoyment: 'fun',
  Education: 'family',
  Remittance: 'family',
  Other: 'other',
}

const PRIORITIES: readonly StudioPriority[] = ['safety', 'debt', 'goals', 'invest', 'enjoy', 'family']
const AVERAGE_CYCLES = 3
const INCOME_MONTHS = 6
/** Coefficient of variation of monthly income above which it reads as variable / mixed. */
const VARIABLE_CV = 0.2
const MIXED_CV = 0.08
const MIN_MONTHS_FOR_VARIANCE = 3
const DEFAULT_TARGET_MONTHS = 3

const BILL_ICON: Record<string, string> = {
  Rent: 'house', Utilities: 'zap', Education: 'graduation-cap', Health: 'heart-pulse', Transport: 'car', Fuel: 'fuel',
}
const ESSENTIAL_BILL_CATEGORIES = new Set(['Rent', 'Utilities', 'Health', 'Education', 'Transport', 'Fuel'])
const NOT_A_BILL = new Set(['Subscription', 'Debt', 'Savings'])

/** Confirmed income per calendar month for the months before this one, oldest first, empty months dropped. */
export function monthlyIncomeHistory(events: IncomeEvent[], base: Currency, rates: Record<string, number>, now: Date): number[] {
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return Array.from({ length: INCOME_MONTHS }, (_, n) => shiftMonth(current, -(INCOME_MONTHS - n)))
    .map((key) =>
      events
        .filter((e) => e.status === 'confirmed' && e.receivedDate.startsWith(key))
        .reduce((s, e) => s + convertCurrency(e.amount, e.currency, base, rates), 0)
    )
    .filter((total) => total > 0)
}

export function incomeStabilityOf(history: number[]): BudgetFacts['incomeStability'] {
  if (history.length < MIN_MONTHS_FOR_VARIANCE) return 'fixed'
  const mean = history.reduce((s, x) => s + x, 0) / history.length
  const sd = Math.sqrt(history.reduce((s, x) => s + (x - mean) ** 2, 0) / history.length)
  const cv = mean > 0 ? sd / mean : 0
  return cv > VARIABLE_CV ? 'variable' : cv > MIXED_CV ? 'mixed' : 'fixed'
}

/** Mean spend per everyday slot over the last three cycles that have ledger activity. */
export function everydayAverages(
  expenses: Expense[],
  monthKey: string,
  monthStartDay: number,
  base: Currency,
  rates: Record<string, number>
): BudgetFacts['averages'] {
  const totals: Partial<Record<EverydayKey, number>> = {}
  let active = 0
  for (let n = 1; n <= AVERAGE_CYCLES; n++) {
    const spending = calculateCategorySpending(filterExpensesByMonth(expenses, shiftMonth(monthKey, -n), monthStartDay), base, rates)
    if (Object.keys(spending).length === 0) continue
    active++
    for (const [category, amount] of Object.entries(spending)) {
      const key = EVERYDAY_KEY_OF[category]
      if (key) totals[key] = (totals[key] ?? 0) + amount
    }
  }
  if (active === 0) return {}
  return Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, v / active]))
}

function billsOf(s: FactsSlice, base: Currency): FactBill[] {
  const subscriptionRecurring = new Set(s.subscriptions.map((x) => x.linkedRecurringExpenseId).filter(Boolean))
  const rentKnown = (s.profile.monthlyRent ?? 0) > 0
  const isBill = (r: RecurringExpense) =>
    r.isActive &&
    !subscriptionRecurring.has(r.id) &&
    !NOT_A_BILL.has(r.category) &&
    !isNonSpendCategory(r.category) &&
    // The engine builds the rent line from the profile; a recurring rent would repeat it.
    !(rentKnown && r.category === 'Rent')
  return s.recurringExpenses.filter(isBill).map((r) => ({
    name: r.description,
    amount: convertCurrency(r.amount, r.currency, base, s.exchangeRates),
    dueDay: r.dayOfMonth,
    icon: BILL_ICON[r.category] ?? 'receipt',
    essential: ESSENTIAL_BILL_CATEGORIES.has(r.category),
    expenseCategories: [r.category],
  }))
}

function knownFacts(s: FactsSlice): ReadonlySet<KnownFact> {
  const { profile } = s
  const fp = profile.financialProfile
  const known = new Set<KnownFact>()
  if (profile.household != null) known.add('household')
  if (profile.lifestyleTier != null) known.add('lifestyle')
  // The column defaults to false, so only `true` or a stored rent proves the question was answered.
  if (profile.rentIncludesUtilities === true || (profile.monthlyRent ?? 0) > 0) known.add('rentIncludesUtilities')
  if (fp?.supportsOthers !== undefined) known.add('supportsOthers')
  if (fp?.incomeStability !== undefined) known.add('incomeStability')
  return known
}

/** Everything the budget engine and the studio know about the user, from the store, in base currency. */
export function buildFactsFromStore(s: FactsSlice, now: Date): BudgetFacts {
  const { profile, settings, exchangeRates: rates } = s
  const base = settings.baseCurrency
  const fp = profile.financialProfile ?? {}
  const monthKey = cycleKeyOf(now, settings.monthStartDay)

  const incomeBlocked = settings.noIncomeDeclared === true && s.incomeSources.length === 0 && s.incomeEvents.length === 0
  const monthlyIncome = incomeBlocked ? 0 : projectedIncomeForMonth(s.incomeSources, base, rates, monthKey, settings.monthStartDay)
  const history = monthlyIncomeHistory(s.incomeEvents, base, rates, now)
  const incomeStability = fp.incomeStability ?? incomeStabilityOf(history)

  const debtCtx = {
    debtPayments: s.debtPayments, expenses: s.expenses, base, rates,
    goldPricePerGram: s.goldPricePerGram, goldPriceAvailable: s.goldPriceAvailable,
  }
  const subs = subscriptionsLive(s.subscriptions, base, rates, now)
  const usualKeep = fundingBasis(s, now).usualKeep
  const zakatAnnual = profile.zakatConfig?.manualAmount ?? 0
  const transportMode = profile.transportMode ?? null

  return {
    baseCurrency: base,
    country: profile.country ?? null,
    monthlyIncome,
    incomeStability,
    incomeFloor: incomeStability !== 'fixed' && history.length > 0 ? Math.min(...history) : null,
    household: profile.household ?? 'solo',
    dependents: fp.dependents ?? 0,
    supportsOthers: fp.supportsOthers ?? false,
    // A stored rent is the strongest signal the user rents, even before the studio asks.
    housing: fp.housing ?? ((profile.monthlyRent ?? 0) > 0 ? 'rent' : null),
    rent: profile.monthlyRent ?? null,
    rentIncludesUtilities: profile.rentIncludesUtilities ?? false,
    lifestyle: profile.lifestyleTier ?? 'balanced',
    foodFrequency: profile.foodFrequency ?? null,
    transportMode,
    hasCar: fp.hasCar ?? transportMode === 'car',
    bills: billsOf(s, base),
    subscriptionsMonthly: subs.monthly,
    subscriptionCount: subs.count,
    debts: liveDebts(s.debts, debtCtx).map((d) => ({
      id: d.debt.id, name: d.debt.name, minimum: d.minimum, balance: d.balance, apr: null, kind: d.kind,
    })),
    goals: liveGoals(s.goals, buildGoalProgressContext(s, monthKey), usualKeep).map((g) => ({
      id: g.goal.id,
      name: g.goal.name,
      monthly: g.monthly,
      targetAmount: g.target,
      saved: g.saved,
      targetDate: g.goal.targetDate,
      priority: g.goal.priority,
      icon: goalIconKey(g.goal.category),
    })),
    liquidSavings: liquidSavings(s.savingsAccounts, base, rates, s.goldPricePerGram, s.goldPriceAvailable),
    essentialsMonthly: profile.emergencyFundConfig?.monthlyEssentials ?? null,
    emergencyTargetMonths: profile.emergencyFundConfig?.targetMonths ?? DEFAULT_TARGET_MONTHS,
    zakatMonthly: zakatAnnual > 0 ? zakatAnnual / 12 : 0,
    averages: everydayAverages(s.expenses, monthKey, settings.monthStartDay, base, rates),
    priorities: (fp.priorities ?? []).filter((p): p is StudioPriority => (PRIORITIES as readonly string[]).includes(p)),
    known: knownFacts(s),
    securityLean: fp.securityLean ?? 50,
    payoffStrategy: fp.payoffStrategy ?? 'avalanche',
    investInterest: fp.investInterest ?? false,
  }
}
