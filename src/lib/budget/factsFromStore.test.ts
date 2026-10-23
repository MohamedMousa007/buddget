import { describe, expect, it } from 'vitest'
import type { Expense, Goal, IncomeEvent } from '@/lib/store/types'
import { buildFactsFromStore, everydayEvidence, incomeStabilityOf, monthlyIncomeHistory, type FactsSlice } from '@/lib/budget/factsFromStore'

const NOW = new Date(2026, 9, 19)

const slice = (o: Record<string, unknown> = {}): FactsSlice =>
  ({
    profile: { id: 'u', name: 'U', createdAt: '' },
    settings: { baseCurrency: 'AED', monthStartDay: 1, noIncomeDeclared: false },
    incomeSources: [], incomeEvents: [], expenses: [], recurringExpenses: [], subscriptions: [],
    debts: [], debtPayments: [], goals: [], savingsAccounts: [], exchangeRates: {},
    budgetCategories: [], budgetPlans: [], activeBudgetPlanId: null, goldPricePerGram: 0, goldPriceAvailable: false,
    ...o,
  }) as unknown as FactsSlice

const withProfile = (p: Record<string, unknown>) => slice({ profile: { id: 'u', name: 'U', createdAt: '', ...p } })

const event = (receivedDate: string, amount: number): IncomeEvent =>
  ({ id: receivedDate, name: 'Pay', amount, currency: 'AED', receivedDate, status: 'confirmed', createdAt: '', updatedAt: '' }) as IncomeEvent

const expense = (date: string, category: string, amount: number): Expense =>
  ({ id: `${date}${category}`, date, description: '', category, amount, currency: 'AED', amountInBaseCurrency: amount, paymentMethodId: 'pm', isRecurring: false, createdAt: '', updatedAt: '' }) as Expense

describe('buildFactsFromStore defaults', () => {
  const f = buildFactsFromStore(slice(), NOW)
  it('falls back to neutral answers and knows nothing', () => {
    expect(f).toMatchObject({
      baseCurrency: 'AED', country: null, monthlyIncome: 0, incomeStability: 'fixed', incomeFloor: null,
      household: 'solo', dependents: 0, supportsOthers: false, housing: null, rent: null, lifestyle: 'balanced',
      foodFrequency: null, transportMode: null, hasCar: false, essentialsMonthly: null, emergencyTargetMonths: 3,
      zakatMonthly: 0, securityLean: 50, investInterest: false, priorities: [],
      liquidSavings: 0, subscriptionsMonthly: 0, subscriptionCount: 0,
    })
    expect(f.bills).toEqual([])
    expect(f.debts).toEqual([])
    expect(f.goals).toEqual([])
    expect(f.averages).toEqual({})
    expect(f.known?.size).toBe(0)
  })
})

describe('profile facts', () => {
  it('reads typed columns and the financial profile', () => {
    const f = buildFactsFromStore(withProfile({
      country: 'AE', household: 'family', lifestyleTier: 'comfortable', foodFrequency: 'mostdays', transportMode: 'car',
      monthlyRent: 6000, rentIncludesUtilities: true,
      financialProfile: { dependents: 2, supportsOthers: true, housing: 'rent', priorities: ['safety', 'bogus', 'debt'], securityLean: 20, investInterest: true, incomeStability: 'mixed' },
      emergencyFundConfig: { targetMonths: 6, monthlyEssentials: 9000 },
      zakatConfig: { nisabBasis: 'gold', holdsForTrading: false, manualAmount: 1200 },
    }), NOW)
    expect(f).toMatchObject({
      country: 'AE', household: 'family', lifestyle: 'comfortable', foodFrequency: 'mostdays', transportMode: 'car', hasCar: true,
      rent: 6000, rentIncludesUtilities: true, dependents: 2, supportsOthers: true, housing: 'rent', priorities: ['safety', 'debt'],
      securityLean: 20, investInterest: true, incomeStability: 'mixed',
      essentialsMonthly: 9000, emergencyTargetMonths: 6, zakatMonthly: 100,
    })
    expect([...f.known!].sort()).toEqual(['household', 'incomeStability', 'lifestyle', 'rentIncludesUtilities', 'supportsOthers'])
  })

  it('the stored hasCar beats the commute mode', () => {
    expect(buildFactsFromStore(withProfile({ transportMode: 'car', financialProfile: { hasCar: false } }), NOW).hasCar).toBe(false)
  })

  it('rentIncludesUtilities=false alone does not count as answered', () => {
    expect(buildFactsFromStore(withProfile({ rentIncludesUtilities: false }), NOW).known?.has('rentIncludesUtilities')).toBe(false)
  })
})

describe('income', () => {
  const monthly = {
    id: 's', name: 'Salary', amount: 10000, currency: 'AED', isRecurring: true, recurringFrequency: 'monthly',
    dayOfMonth: 25, effectiveStart: '2026-01-01', createdAt: '2026-01-01', updatedAt: '',
  }

  it('projects the cycle in base currency', () => {
    expect(buildFactsFromStore(slice({ incomeSources: [monthly, { ...monthly, id: 'u', amount: 100, currency: 'USD' }] }), NOW).monthlyIncome)
      .toBeCloseTo(10000 + 100 * 3.6725)
  })

  it('is zero when the user declared no income', () => {
    const s = slice({ settings: { baseCurrency: 'AED', monthStartDay: 1, noIncomeDeclared: true } })
    expect(buildFactsFromStore(s, NOW).monthlyIncome).toBe(0)
  })

  it('steady pay is fixed with no floor', () => {
    const events = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'].map((m) => event(`${m}-25`, 10000))
    const f = buildFactsFromStore(slice({ incomeEvents: events }), NOW)
    expect(f.incomeStability).toBe('fixed')
    expect(f.incomeFloor).toBeNull()
  })

  it('swinging pay is variable and the floor is the lowest of the last six months', () => {
    const amounts = [4000, 12000, 7000, 15000, 3000, 9000]
    const events = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'].map((m, i) => event(`${m}-25`, amounts[i]))
    const f = buildFactsFromStore(slice({ incomeEvents: events }), NOW)
    expect(f.incomeStability).toBe('variable')
    expect(f.incomeFloor).toBe(3000)
  })

  it('a stored stability wins but a floor is still derived when not fixed', () => {
    const events = ['2026-08', '2026-09'].map((m, i) => event(`${m}-25`, [5000, 8000][i]))
    const f = buildFactsFromStore(slice({
      profile: { id: 'u', name: 'U', createdAt: '', financialProfile: { incomeStability: 'variable' } }, incomeEvents: events,
    }), NOW)
    expect(f.incomeStability).toBe('variable')
    expect(f.incomeFloor).toBe(5000)
  })

  it('history ignores the current month, projected events and empty months', () => {
    const events = [event('2026-10-05', 999), { ...event('2026-09-05', 500), status: 'projected' } as IncomeEvent, event('2026-08-05', 700)]
    expect(monthlyIncomeHistory(events, 'AED', {}, NOW)).toEqual([700])
  })

  it('needs three months before calling income variable', () => {
    expect(incomeStabilityOf([1000, 9000])).toBe('fixed')
    expect(incomeStabilityOf([1000, 9000, 1000])).toBe('variable')
    expect(incomeStabilityOf([1000, 1200, 1000, 1250])).toBe('mixed')
  })
})

describe('bills', () => {
  const rec = (o: Record<string, unknown>) => ({
    id: 'r', description: 'Bill', category: 'Utilities', amount: 100, currency: 'AED', paymentMethodId: 'pm', dayOfMonth: 5, isActive: true, ...o,
  })

  it('keeps active fixed bills with due day, icon and essential flag, in base currency', () => {
    const f = buildFactsFromStore(slice({ recurringExpenses: [rec({ id: 'a', description: 'DEWA', amount: 100, currency: 'USD' })] }), NOW)
    expect(f.bills).toEqual([
      { name: 'DEWA', amount: 100 * 3.6725, dueDay: 5, icon: 'zap', essential: true, expenseCategories: ['Utilities'] },
    ])
  })

  it('drops inactive, subscription, debt, savings and non-spend recurring rows', () => {
    const f = buildFactsFromStore(slice({
      subscriptions: [{ id: 's', linkedRecurringExpenseId: 'sub-rec', status: 'cancelled' }],
      recurringExpenses: [
        rec({ id: 'off', isActive: false }),
        rec({ id: 'sub-rec', category: 'Enjoyment' }),
        rec({ id: 'debt', category: 'Debt' }),
        rec({ id: 'sub', category: 'Subscription' }),
        rec({ id: 'sav', category: 'Savings' }),
        rec({ id: 'tr', category: 'Transfer' }),
        rec({ id: 'keep', description: 'Gym', category: 'Enjoyment' }),
      ],
    }), NOW)
    expect(f.bills.map((b) => b.name)).toEqual(['Gym'])
    expect(f.bills[0]).toMatchObject({ essential: false, icon: 'receipt' })
  })

  it('skips a recurring rent when the profile already has the rent', () => {
    const rows = [rec({ id: 'rent', description: 'Rent', category: 'Rent', amount: 5000 })]
    expect(buildFactsFromStore(slice({ recurringExpenses: rows }), NOW).bills).toHaveLength(1)
    expect(buildFactsFromStore(slice({ recurringExpenses: rows, profile: { id: 'u', name: 'U', createdAt: '', monthlyRent: 5000 } }), NOW).bills).toHaveLength(0)
  })
})

describe('subscriptions', () => {
  const sub = (o: Record<string, unknown>) => ({
    id: 's', name: 'Netflix', brandKey: null, amount: 60, currency: 'AED', billingCycle: 'monthly', status: 'active', startDate: '2026-01-01', ...o,
  })
  it('sums charging subscriptions as monthly equivalents', () => {
    const f = buildFactsFromStore(slice({ subscriptions: [
      sub({}),
      sub({ id: 'y', billingCycle: 'yearly', amount: 1200 }),
      sub({ id: 'c', status: 'cancelled', endsOn: '2026-01-01' }),
      sub({ id: 'sh', amount: 100, myShare: 25 }),
    ] }), NOW)
    expect(f.subscriptionsMonthly).toBe(60 + 100 + 25)
    expect(f.subscriptionCount).toBe(3)
  })
})

describe('debts', () => {
  const debt = (o: Record<string, unknown>) => ({
    id: 'd', name: 'Debt', person: '', startingBalance: 1200, currency: 'AED', isGold: false, createdAt: '', ...o,
  })
  it('lists what is still owed with minimums and kinds', () => {
    const f = buildFactsFromStore(slice({
      debts: [
        debt({ id: 'tabby', name: 'Tabby', debtType: 'installment', installmentAmount: 300, installmentFrequency: 'monthly' }),
        debt({ id: 'cc', name: 'Visa', debtType: 'credit_card', startingBalance: 2000, minimumPaymentPercent: 5 }),
        debt({ id: 'weekly', name: 'Weekly', debtType: 'installment', installmentAmount: 12, installmentFrequency: 'weekly' }),
        debt({ id: 'friend', name: 'Friend', debtType: 'personal' }),
        debt({ id: 'done', status: 'cleared' }),
        debt({ id: 'owed', direction: 'they_owe' }),
      ],
      debtPayments: [{ id: 'p', debtId: 'tabby', date: '2026-09-01', amountPaid: 300, createdAt: '' }],
    }), NOW)
    expect(f.debts.map((d) => [d.id, d.kind, Math.round(d.minimum), d.balance])).toEqual([
      ['tabby', 'installment', 300, 900],
      ['cc', 'credit_card', 100, 2000],
      ['weekly', 'installment', 52, 1200],
      ['friend', 'personal', 0, 1200],
    ])
  })

  it('a minimum never exceeds what is left', () => {
    const f = buildFactsFromStore(slice({
      debts: [debt({ id: 'a', debtType: 'installment', installmentAmount: 500, startingBalance: 1000 })],
      debtPayments: [{ id: 'p', debtId: 'a', date: '2026-09-01', amountPaid: 700, createdAt: '' }],
    }), NOW)
    expect(f.debts[0]).toMatchObject({ balance: 300, minimum: 300 })
  })
})

describe('goals', () => {
  const goal = (o: Partial<Goal>): Goal => ({
    id: 'g', name: 'Goal', emoji: '', category: 'house', targetAmount: 10000, currency: 'AED', manualCurrentAmount: 2500,
    targetDate: '2028-01-01', linkedSavingsAccountIds: [], linkedDebtIds: [], monthlySpendingLimit: null, priority: 1, status: 'active',
    monthlyContribution: null, fundingMode: 'manual', sharePct: null, frequency: 'monthly', planStart: null, notes: null,
    createdAt: '', achievedAt: null, ...o,
  })

  it('plans the monthly draw from each funding mode', () => {
    const f = buildFactsFromStore(slice({
      goals: [
        goal({ id: 'fixed', priority: 2, fundingMode: 'fixed', monthlyContribution: 600 }),
        goal({ id: 'quarter', priority: 3, fundingMode: 'fixed', monthlyContribution: 900, frequency: 'quarterly' }),
        goal({ id: 'manual', priority: 4 }),
        goal({ id: 'paused', status: 'paused', fundingMode: 'fixed', monthlyContribution: 5 }),
        goal({ id: 'limit', category: 'spending_control', monthlySpendingLimit: 100 }),
      ],
    }), NOW)
    expect(f.goals.map((g) => [g.id, g.monthly])).toEqual([['fixed', 600], ['quarter', 300], ['manual', 0]])
    expect(f.goals[0]).toMatchObject({ targetAmount: 10000, saved: 2500, targetDate: '2028-01-01', priority: 2, icon: 'house' })
  })

  it('a share is a percent of what the user usually keeps', () => {
    const events = ['2026-07', '2026-08', '2026-09'].map((m) => event(`${m}-25`, 10000))
    const spend = ['2026-07', '2026-08', '2026-09'].map((m) => expense(`${m}-10`, 'Food', 7000))
    const f = buildFactsFromStore(slice({
      incomeEvents: events, expenses: spend,
      goals: [goal({ fundingMode: 'share', sharePct: 50 })],
    }), NOW)
    expect(f.goals[0].monthly).toBe(1500)
  })

  it('converts goal amounts to base', () => {
    const f = buildFactsFromStore(slice({ goals: [goal({ currency: 'USD', targetAmount: 1000, manualCurrentAmount: 100 })] }), NOW)
    expect(f.goals[0].targetAmount).toBeCloseTo(3672.5)
    expect(f.goals[0].saved).toBeCloseTo(367.25)
  })
})

describe('savings and spending history', () => {
  it('counts pockets, not investments', () => {
    const f = buildFactsFromStore(slice({ savingsAccounts: [
      { id: 'a', category: 'savings', type: 'bank', currency: 'AED', currentBalance: 5000 },
      { id: 'b', category: 'investment', type: 'stocks', currency: 'AED', currentBalance: 9000 },
      { id: 'c', category: 'savings', type: 'cash', currency: 'USD', currentBalance: 100 },
    ] }), NOW)
    expect(f.liquidSavings).toBeCloseTo(5000 + 367.25)
  })

  it('averages the three previous cycles that have activity', () => {
    const expenses = [
      expense('2026-09-03', 'Groceries', 900), expense('2026-08-03', 'Groceries', 600),
      expense('2026-09-04', 'Food', 300), expense('2026-08-04', 'Fuel', 200), expense('2026-08-05', 'Transport', 100),
      expense('2026-10-02', 'Groceries', 9999), expense('2026-05-02', 'Groceries', 9999),
      expense('2026-09-06', 'Transfer', 5000), expense('2026-09-07', 'Remittance', 400),
    ]
    expect(everydayEvidence(expenses, '2026-10', 1, 'AED', {}).averages).toEqual({
      groceries: 750, dining: 150, transport: 150, family: 200,
    })
  })

  it('has no averages without history', () => {
    expect(everydayEvidence([expense('2026-10-02', 'Groceries', 100)], '2026-10', 1, 'AED', {})).toEqual({ averages: {}, averageCycles: 0 })
  })

  it('ignores partial months and takes the median of three so one big purchase does not set the budget', () => {
    const month = (m: string, grocery: number) => [
      expense(`2026-${m}-02`, 'Groceries', grocery), expense(`2026-${m}-03`, 'Food', 50), expense(`2026-${m}-04`, 'Food', 50),
    ]
    const three = everydayEvidence([...month('09', 800), ...month('08', 900), ...month('07', 9000)], '2026-10', 1, 'AED', {})
    expect(three.averageCycles).toBe(3)
    expect(three.averages.groceries).toBe(900)
    const partial = everydayEvidence([...month('09', 800), expense('2026-08-20', 'Groceries', 100)], '2026-10', 1, 'AED', {})
    expect(partial.averageCycles).toBe(1)
    expect(partial.averages.groceries).toBe(800)
  })
})
