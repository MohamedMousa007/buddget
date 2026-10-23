import { describe, it, expect } from 'vitest'
import { buildPlan, ENGINE_VERSION, EVERYDAY_KEYS } from '@/lib/budget/engine'
import { getBenchmark } from '@/lib/budget/benchmarks'
import type { BudgetFacts, DraftLine, PlanDraft } from '@/lib/budget/facts'

const base: BudgetFacts = {
  baseCurrency: 'AED',
  country: 'UAE',
  monthlyIncome: 15000,
  incomeStability: 'fixed',
  incomeFloor: null,
  household: 'solo',
  dependents: 0,
  supportsOthers: false,
  housing: 'rent',
  rent: 4500,
  rentIncludesUtilities: false,
  lifestyle: 'balanced',
  foodFrequency: null,
  transportMode: 'public',
  hasCar: false,
  bills: [{ name: 'Phone', amount: 200, dueDay: 5, icon: 'smartphone', essential: true }],
  subscriptionsMonthly: 150,
  subscriptionCount: 4,
  debts: [],
  goals: [],
  liquidSavings: 0,
  essentialsMonthly: null,
  emergencyTargetMonths: 3,
  zakatMonthly: 0,
  averages: {},
  priorities: [],
  securityLean: 50,
  investInterest: false,
}

const total = (p: PlanDraft) => p.lines.reduce((s, l) => s + l.amount, 0)
const find = (p: PlanDraft, pred: (l: DraftLine) => boolean) => p.lines.find(pred)
const idx = (p: PlanDraft, pred: (l: DraftLine) => boolean) => p.lines.findIndex(pred)

function expectInvariants(p: PlanDraft) {
  for (const l of p.lines) {
    expect(l.amount).toBeGreaterThanOrEqual(0)
    expect(Number.isInteger(l.amount)).toBe(true)
    expect(l.rationale.length).toBeGreaterThan(0)
  }
  expect(p.reasons).toHaveLength(3)
  expect(p.name).toBe('Plan')
}

describe('benchmarks', () => {
  it('normalises country names and codes', () => {
    for (const c of ['UAE', 'uae', 'AE', 'ARE', 'United Arab Emirates']) {
      expect(getBenchmark(c, 'AED').id).toBe('AE')
    }
    for (const c of ['KSA', 'Saudi Arabia', 'sa']) expect(getBenchmark(c, 'SAR').id).toBe('SA')
    expect(getBenchmark('Egypt', 'EGP').id).toBe('EG')
    expect(getBenchmark('Narnia', 'USD').id).toBe('generic')
    expect(getBenchmark(null, 'USD').id).toBe('generic')
  })

  it('uses absolute tables only in the country currency', () => {
    expect(getBenchmark('UAE', 'AED').absolute).not.toBeNull()
    expect(getBenchmark('UAE', 'USD').absolute).toBeNull()
    expect(getBenchmark('UAE', 'USD').id).toBe('AE')
  })
})

describe('buildPlan', () => {
  it('exports version and everyday keys', () => {
    expect(ENGINE_VERSION).toBe('v1')
    expect(EVERYDAY_KEYS).toContain('groceries')
  })

  it('solo UAE renter with a 24% card: pays extra before investing, fills income exactly', () => {
    const p = buildPlan({
      ...base,
      debts: [{ id: 'd1', name: 'Visa', minimum: 300, balance: 8000, kind: 'credit_card' }],
      liquidSavings: 20000,
      investInterest: true,
      priorities: ['debt', 'invest'],
    })
    expectInvariants(p)
    expect(total(p)).toBe(p.income)
    expect(p.free).toBe(0)
    expect(p.intent).toBe('debt_crusher')
    const debt = find(p, (l) => l.linkType === 'debts')!
    expect(debt).toMatchObject({ block: 'debts', amount: 300, linkIds: ['d1'], expenseCategories: ['Debt'] })
    const extra = find(p, (l) => l.block === 'debts' && l.linkType === 'none')!
    expect(extra.amount).toBeGreaterThan(0)
    expect(find(p, (l) => l.name === 'Investing')).toBeUndefined()
    expect(find(p, (l) => l.name === 'Rent')!.amount).toBe(4500)
    expect(find(p, (l) => l.name === 'Utilities')!.confidence).toBe('estimated')
    const subs = find(p, (l) => l.linkType === 'subscriptions')!
    expect(subs).toMatchObject({ block: 'subscriptions', amount: 150, expenseCategories: ['Subscription'] })
    expect(find(p, (l) => l.name === 'Phone')).toMatchObject({ dueDay: 5, essential: true })
  })

  it('extra payoff precedes investing when both exist', () => {
    const p = buildPlan({
      ...base,
      liquidSavings: 30000,
      investInterest: true,
      debts: [{ id: 'd1', name: 'Loan', minimum: 200, balance: 5000, kind: 'loan' }],
    })
    expect(find(p, (l) => l.name === 'Investing')).toBeDefined()
    expect(find(p, (l) => l.block === 'debts' && l.linkType === 'none')).toBeUndefined()

    const q = buildPlan({
      ...base,
      liquidSavings: 30000,
      investInterest: true,
      debts: [{ id: 'd1', name: 'Card', minimum: 200, balance: 5000, kind: 'credit_card' }],
    })
    expect(find(q, (l) => l.name === 'Investing')).toBeUndefined()
    expect(idx(q, (l) => l.name.startsWith('Extra payoff'))).toBeGreaterThan(-1)
  })

  it('extra payoff goes to the smallest card, then the smallest other debt when debt is a priority', () => {
    const debts = [
      { id: 'a', name: 'Big', minimum: 100, balance: 9000, kind: 'loan' as const },
      { id: 'b', name: 'Small', minimum: 50, balance: 800, kind: 'personal' as const },
      { id: 'c', name: 'Card', minimum: 80, balance: 3000, kind: 'credit_card' as const },
      { id: 'd', name: 'Plan', minimum: 70, balance: 500, kind: 'installment' as const },
    ]
    const extra = (f: Partial<BudgetFacts>) => find(buildPlan({ ...base, ...f }), (l) => l.name.startsWith('Extra payoff'))
    expect(extra({ debts })!.name).toContain('Card')
    expect(extra({ debts: debts.filter((d) => d.kind !== 'credit_card'), priorities: ['debt'] })!.name).toContain('Small')
    expect(extra({ debts: debts.filter((d) => d.kind !== 'credit_card') })).toBeUndefined()
    expect(extra({ debts: [debts[3]], priorities: ['debt'] })).toBeUndefined()
  })

  it('no income: plans the expected spending with a cushion instead of failing', () => {
    const p = buildPlan({ ...base, monthlyIncome: 0, country: 'Egypt', baseCurrency: 'EGP', rent: 3000, averages: {} })
    expectInvariants(p)
    expect(p.basis).toBe('spend')
    expect(p.income).toBeGreaterThan(0)
    expect(total(p)).toBe(p.income)
    expect(p.risks.some((r) => r.includes('No income'))).toBe(true)
    expect(buildPlan(base).basis).toBe('income')
  })

  it('no income and nothing to go on yields an empty plan with a risk, not a crash', () => {
    const p = buildPlan({ ...base, country: null, monthlyIncome: 0, rent: null, housing: null, bills: [], subscriptionsMonthly: 0, subscriptionCount: 0, averages: {} })
    expect(p.income).toBe(0)
    expect(p.lines).toHaveLength(0)
    expect(p.risks.some((r) => r.includes('nothing to base'))).toBe(true)
  })

  it('blends a short spending history with the benchmark instead of trusting it alone', () => {
    const rich = { ...base, baseCurrency: 'EGP' as const, country: 'Egypt', monthlyIncome: 30000, averages: { groceries: 1000 } }
    const full = find(buildPlan({ ...rich, averageCycles: 3 }), (l) => l.name === 'Groceries')!
    const short = find(buildPlan({ ...rich, averageCycles: 1 }), (l) => l.name === 'Groceries')!
    expect(full.confidence).toBe('high')
    expect(short.confidence).toBe('estimated')
    expect(short.amount).toBeGreaterThan(full.amount)
  })

  it('couple with kids in Egypt, variable income: sized on the floor with a surplus risk', () => {
    const p = buildPlan({
      ...base,
      baseCurrency: 'EGP',
      country: 'Egypt',
      monthlyIncome: 80000,
      incomeStability: 'variable',
      incomeFloor: 65000,
      household: 'family',
      dependents: 2,
      rent: 15000,
      bills: [],
      subscriptionsMonthly: 0,
      subscriptionCount: 0,
      averages: { groceries: 9000, transport: 2500, dining: 3000 },
      goals: [
        { id: 'g1', name: 'School fees', monthly: 3000, targetAmount: 50000, saved: 0, targetDate: '2027-06-01', priority: 1, icon: 'graduation-cap' },
        { id: 'g2', name: 'Holiday', monthly: 1000, targetAmount: 10000, saved: 0, targetDate: null, priority: 2, icon: 'plane' },
      ],
    })
    expectInvariants(p)
    expect(p.income).toBe(65000)
    expect(total(p)).toBe(65000)
    expect(p.risks.some((r) => r.includes('varies'))).toBe(true)
    const goals = p.lines.filter((l) => l.linkType === 'goal')
    expect(goals.map((g) => [g.linkIds[0], g.amount])).toEqual([['g1', 3000], ['g2', 1000]])
    expect(find(p, (l) => l.name === 'Groceries')!.confidence).toBe('high')
    expect(find(p, (l) => l.name === 'Shopping')!.confidence).toBe('estimated')
    expect(find(p, (l) => l.linkType === 'emergency')!.amount).toBeGreaterThan(0)
  })

  it('variable income without a floor uses 80% of expected', () => {
    const p = buildPlan({ ...base, incomeStability: 'mixed', incomeFloor: null })
    expect(p.income).toBe(12000)
    expect(total(p)).toBe(12000)
  })

  it('Saudi high saver with no debt: low trim, invests, buffer closes the plan', () => {
    const p = buildPlan({
      ...base,
      baseCurrency: 'SAR',
      country: 'KSA',
      monthlyIncome: 30000,
      rent: 6000,
      liquidSavings: 90000,
      securityLean: 0,
      investInterest: true,
      priorities: ['invest'],
      averages: { groceries: 1000, dining: 600 },
      zakatMonthly: 250,
    })
    expectInvariants(p)
    expect(p.intent).toBe('saver')
    expect(total(p)).toBe(30000)
    expect(find(p, (l) => l.name === 'Groceries')!.amount).toBe(850)
    expect(find(p, (l) => l.name === 'Zakat')).toMatchObject({ amount: 250, isSavings: false, block: 'grow' })
    expect(find(p, (l) => l.name === 'Investing')!.amount).toBeGreaterThan(0)
    expect(find(p, (l) => l.name === 'Buffer')).toMatchObject({ block: 'grow', isSavings: true })
  })

  it('comfortable lean raises everyday above the average, essentials stay above the floor', () => {
    const p = buildPlan({ ...base, securityLean: 100, averages: { groceries: 1000, health: 400, transport: 500 } })
    expect(find(p, (l) => l.name === 'Groceries')!.amount).toBe(1050)
    const tight = buildPlan({ ...base, securityLean: 0, averages: { groceries: 1000 } })
    expect(find(tight, (l) => l.name === 'Groceries')!.amount).toBeGreaterThanOrEqual(700)
  })

  it('debt-heavy low income: fixed costs exceed income, plan reports negative free and a risk', () => {
    const p = buildPlan({
      ...base,
      baseCurrency: 'EGP',
      country: 'Egypt',
      monthlyIncome: 9000,
      rent: 4000,
      bills: [{ name: 'Electric', amount: 800, dueDay: 10, icon: 'zap', essential: true }],
      subscriptionsMonthly: 200,
      subscriptionCount: 2,
      debts: [
        { id: 'a', name: 'Card', minimum: 2500, balance: 30000, kind: 'credit_card' },
        { id: 'b', name: 'Loan', minimum: 1800, balance: 20000, kind: 'loan' },
      ],
      goals: [{ id: 'g', name: 'Trip', monthly: 500, targetAmount: null, saved: 0, targetDate: null, priority: 1, icon: 'plane' }],
      averages: { groceries: 2000, health: 300, transport: 500, fun: 400 },
    })
    expectInvariants(p)
    expect(p.free).toBeLessThan(0)
    expect(p.free).toBe(p.income - total(p))
    expect(p.risks.some((r) => r.includes('exceed your income'))).toBe(true)
    expect(find(p, (l) => l.name === 'Groceries')!.amount).toBe(1400)
    expect(find(p, (l) => l.linkType === 'goal')!.amount).toBe(0)
    expect(find(p, (l) => l.name === 'Fun')).toBeUndefined()
    expect(find(p, (l) => l.name === 'Buffer')).toBeUndefined()
    expect(p.lines.filter((l) => l.linkType === 'debts').map((l) => l.amount)).toEqual([2500, 1800])
  })

  it('trims everyday before goals, and goals from the lowest priority first', () => {
    const goals = [
      { id: 'g1', name: 'First', monthly: 2000, targetAmount: null, saved: 0, targetDate: null, priority: 1, icon: 'target' },
      { id: 'g2', name: 'Second', monthly: 2000, targetAmount: null, saved: 0, targetDate: null, priority: 2, icon: 'target' },
    ]
    const p = buildPlan({
      ...base,
      monthlyIncome: 9000,
      rent: 3000,
      goals,
      averages: { groceries: 1500, health: 200, transport: 300, dining: 300, fun: 200, shopping: 200 },
    })
    expect(total(p)).toBe(p.income)
    const g1 = find(p, (l) => l.linkIds[0] === 'g1')!.amount
    const g2 = find(p, (l) => l.linkIds[0] === 'g2')!.amount
    expect(g1).toBeGreaterThanOrEqual(g2)
    expect(p.risks.some((r) => r.includes('Goals were reduced'))).toBe(true)
  })

  it('income only: everything is estimated from benchmarks and still adds up', () => {
    const p = buildPlan({
      ...base,
      housing: null,
      rent: null,
      bills: [],
      subscriptionsMonthly: 0,
      subscriptionCount: 0,
      country: null,
      baseCurrency: 'USD',
      monthlyIncome: 4000,
    })
    expectInvariants(p)
    expect(total(p)).toBe(4000)
    const everyday = p.lines.filter((l) => l.block === 'everyday')
    expect(everyday.length).toBeGreaterThan(0)
    expect(everyday.every((l) => l.confidence === 'estimated')).toBe(true)
  })

  it('base currency different from country currency falls back to income ratios', () => {
    const usd = buildPlan({ ...base, baseCurrency: 'USD', monthlyIncome: 3000, rent: 900, rentIncludesUtilities: true, bills: [], averages: {} })
    expect(total(usd)).toBe(3000)
    // 12% groceries ratio at trim 1.0, not an AED-sized absolute figure
    expect(find(usd, (l) => l.name === 'Groceries')!.amount).toBeLessThan(400)
    expect(find(usd, (l) => l.name === 'Utilities')).toBeUndefined()
  })

  it('low income is not forced into an unaffordable benchmark', () => {
    const p = buildPlan({ ...base, baseCurrency: 'EGP', country: 'Egypt', monthlyIncome: 10000, rent: 3000, bills: [], averages: {} })
    expect(p.free).toBe(0)
    expect(find(p, (l) => l.name === 'Groceries')!.amount).toBeLessThan(5000)
  })

  it('is deterministic', () => {
    const facts: BudgetFacts = {
      ...base,
      debts: [{ id: 'd1', name: 'Visa', minimum: 300, balance: 8000, kind: 'credit_card' }],
      priorities: ['debt', 'safety'],
    }
    expect(buildPlan(facts)).toEqual(buildPlan(facts))
  })

  it('names the intent from debt priority, lean and default', () => {
    expect(buildPlan({ ...base, securityLean: 20 }).intent).toBe('saver')
    expect(buildPlan({ ...base, securityLean: 60 }).intent).toBe('balanced')
  })
})

describe('extra payoff pace', () => {
  const card = { id: 'c', name: 'Card', minimum: 500, balance: 14200, kind: 'credit_card' as const }
  const rich: BudgetFacts = { ...base, monthlyIncome: 18500, debts: [card] }

  it('is paced to clear the target in about two years when debt is a priority, not the whole slack', () => {
    const extra = find(buildPlan({ ...rich, priorities: ['debt'] }), (l) => l.name.startsWith('Extra payoff'))
    expect(extra?.amount).toBe(Math.ceil(14200 / 24))
  })
  it('is slower when debt is not a stated priority', () => {
    const extra = find(buildPlan({ ...rich, priorities: [] }), (l) => l.name.startsWith('Extra payoff'))
    expect(extra?.amount).toBeLessThanOrEqual(Math.ceil(14200 / 36))
  })
})
