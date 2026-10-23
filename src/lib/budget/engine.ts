import type { BudgetPlanIntent } from '@/lib/store/types'
import type { BudgetFacts, DraftLine, EverydayKey, FactDebt, PlanDraft } from '@/lib/budget/facts'
import { benchmarkEveryday, benchmarkUtilities, getBenchmark, type Benchmark } from '@/lib/budget/benchmarks'

export const ENGINE_VERSION = 'v1'

export const EVERYDAY_KEYS: readonly EverydayKey[] = [
  'groceries',
  'dining',
  'transport',
  'health',
  'shopping',
  'fun',
  'family',
  'other',
]

const PAYOFF_PACE_PRIORITY_MONTHS = 24
const PAYOFF_PACE_MONTHS = 36
const SPEND_CUSHION = 1.1
const FULL_EVIDENCE_CYCLES = 3
/** Cash spending is mostly untracked, so recorded history is trusted at half weight. */
const CASH_HEAVY_TRUST = 0.5
const ESSENTIAL_KEYS: readonly EverydayKey[] = ['groceries', 'health', 'transport']
/** Trim order when money runs short: wants go before needs. */
const CUT_ORDER: readonly EverydayKey[] = ['fun', 'shopping', 'dining', 'other', 'family', 'transport', 'health', 'groceries']
const ESSENTIAL_FLOOR = 0.7
const STARTER_MONTHS_TO_FUND = 6
const FULL_NET_MONTHS_TO_FUND = 12
const VARIABLE_INCOME_FALLBACK = 0.8

const EVERYDAY_META: Record<EverydayKey, { name: string; icon: string; categories: string[] }> = {
  groceries: { name: 'Groceries', icon: 'shopping-basket', categories: ['Groceries'] },
  dining: { name: 'Dining out', icon: 'utensils-crossed', categories: ['Food'] },
  transport: { name: 'Transport', icon: 'car', categories: ['Transport', 'Fuel'] },
  health: { name: 'Health', icon: 'heart-pulse', categories: ['Health'] },
  shopping: { name: 'Shopping', icon: 'shopping-bag', categories: ['Shopping'] },
  fun: { name: 'Fun', icon: 'clapperboard', categories: ['Enjoyment'] },
  family: { name: 'Family', icon: 'users', categories: ['Education'] },
  other: { name: 'Other', icon: 'layers', categories: ['Other'] },
}

function line(l: Partial<DraftLine> & Pick<DraftLine, 'block' | 'name' | 'icon' | 'amount' | 'rationale'>): DraftLine {
  return {
    linkType: 'none',
    linkIds: [],
    dueDay: null,
    essential: false,
    isSavings: false,
    expenseCategories: [],
    confidence: 'high',
    ...l,
  }
}

const sum = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0)

function incomeBasis(f: BudgetFacts): number {
  if (f.incomeStability === 'fixed') return Math.round(f.monthlyIncome)
  const floor = f.incomeFloor ?? VARIABLE_INCOME_FALLBACK * f.monthlyIncome
  return Math.round(Math.min(floor, f.monthlyIncome))
}

function fixedLines(f: BudgetFacts, bench: Benchmark, income: number): DraftLine[] {
  const lines: DraftLine[] = []
  const owns = f.housing === 'rent' || f.housing === 'own'
  if (owns && f.rent !== null && f.rent > 0) {
    const share = income > 0 ? Math.round((f.rent / income) * 100) : 0
    lines.push(
      line({
        block: 'bills',
        name: f.housing === 'own' ? 'Mortgage' : 'Rent',
        icon: 'house',
        amount: Math.round(f.rent),
        essential: true,
        expenseCategories: ['Rent'],
        rationale: `Your housing cost, ${share}% of planned income`,
      })
    )
  }
  if (owns && !f.rentIncludesUtilities) {
    lines.push(
      line({
        block: 'bills',
        name: 'Utilities',
        icon: 'zap',
        amount: benchmarkUtilities(bench, f, income),
        essential: true,
        expenseCategories: ['Utilities'],
        rationale: `Typical ${bench.label} utilities for a ${f.household} household, since rent excludes them`,
        confidence: 'estimated',
      })
    )
  }
  for (const b of f.bills) {
    lines.push(
      line({
        block: 'bills',
        name: b.name,
        icon: b.icon,
        amount: Math.round(b.amount),
        dueDay: b.dueDay,
        essential: b.essential,
        expenseCategories: b.expenseCategories ?? [],
        rationale: b.dueDay ? `Your recurring bill, due on day ${b.dueDay}` : 'Your recurring bill',
      })
    )
  }
  if (f.subscriptionsMonthly > 0 || f.subscriptionCount > 0) {
    lines.push(
      line({
        block: 'subscriptions',
        name: 'Subscriptions',
        icon: 'rotate-cw-clock',
        amount: Math.round(f.subscriptionsMonthly),
        linkType: 'subscriptions',
        expenseCategories: ['Subscription'],
        rationale: `Follows your ${f.subscriptionCount} active subscription${f.subscriptionCount === 1 ? '' : 's'}`,
      })
    )
  }
  for (const d of f.debts) {
    lines.push(
      line({
        block: 'debts',
        name: d.name,
        icon: d.kind === 'credit_card' ? 'credit-card' : 'landmark',
        amount: Math.round(d.minimum),
        linkType: 'debts',
        linkIds: [d.id],
        essential: true,
        expenseCategories: ['Debt'],
        rationale: 'Monthly payment, always paid first',
      })
    )
  }
  return lines
}

interface EverydaySlot {
  key: EverydayKey
  target: number
  floor: number
  rationale: string
  confidence: DraftLine['confidence']
}

function sizeEveryday(
  f: BudgetFacts,
  bench: Benchmark,
  income: number,
  fixedTotal: number,
  money: (n: number) => string,
  capacity: number = income
): EverydaySlot[] {
  const trim = 0.85 + (f.securityLean / 100) * 0.2
  const trimPct = Math.round(trim * 100)
  const typical = benchmarkEveryday(bench, f, income)
  const cycles = f.averageCycles ?? FULL_EVIDENCE_CYCLES
  const weight = Math.min(1, cycles / FULL_EVIDENCE_CYCLES) * (f.cashHeavy ? CASH_HEAVY_TRUST : 1)
  const needsBench = weight < 1 ? EVERYDAY_KEYS : EVERYDAY_KEYS.filter((k) => f.averages[k] === undefined)
  const benchSum = sum(needsBench.map((k) => typical[k]))
  // Low incomes must not be handed a benchmark larger than they can pay.
  const scale = benchSum > 0 ? Math.min(1, (0.6 * Math.max(0, capacity - fixedTotal)) / benchSum) : 1

  const slots: EverydaySlot[] = []
  for (const key of EVERYDAY_KEYS) {
    const avg = f.averages[key]
    const typicalHere = typical[key] * scale
    const blended = avg === undefined ? typicalHere : typicalHere > 0 ? weight * avg + (1 - weight) * typicalHere : avg
    const target = Math.round(blended * trim)
    const floor = ESSENTIAL_KEYS.includes(key) ? Math.round(blended * ESSENTIAL_FLOOR) : 0
    if (target === 0) continue
    const name = EVERYDAY_META[key].name.toLowerCase()
    slots.push({
      key,
      target,
      floor,
      confidence: avg === undefined || weight < 1 ? 'estimated' : 'high',
      rationale:
        avg === undefined
          ? `Typical ${bench.label} ${name} for your household, no spending history yet`
          : weight < 1
            ? `Your ${name} average of ${money(avg)} so far, blended with typical ${bench.label} spending until you have ${FULL_EVIDENCE_CYCLES} months of history`
            : `Your 3-month average of ${money(avg)}, at ${trimPct}%`,
    })
  }
  return slots
}

/** Takes up to `deficit` out of the amounts in the given order, never below `floors`. Returns what was removed. */
function shave(amounts: number[], floors: number[], deficit: number): number {
  let left = deficit
  for (let i = 0; i < amounts.length && left > 0; i++) {
    const cut = Math.min(left, amounts[i] - floors[i])
    amounts[i] -= cut
    left -= cut
  }
  return deficit - left
}

/** Extra goes to the smallest open balance so a debt clears sooner; cards come first, installments follow a fixed schedule. */
function pickPayoffTarget(debts: FactDebt[]): FactDebt | null {
  const open = debts.filter((d) => d.balance > 0 && d.kind !== 'installment')
  const cards = open.filter((d) => d.kind === 'credit_card')
  const pool = cards.length > 0 ? cards : open
  return pool.length === 0 ? null : pool.reduce((a, b) => (b.balance < a.balance ? b : a))
}

export function buildPlan(f: BudgetFacts): PlanDraft {
  const bench = getBenchmark(f.country, f.baseCurrency)
  const money = (n: number) => `${f.baseCurrency} ${Math.round(n).toLocaleString('en-US')}`
  const statedIncome = incomeBasis(f)
  const spendBased = statedIncome <= 0
  const risks: string[] = []

  const fixed = fixedLines(f, bench, statedIncome)
  const fixedTotal = sum(fixed.map((l) => l.amount))
  const slots = sizeEveryday(f, bench, statedIncome, fixedTotal, money, spendBased ? Infinity : statedIncome)
  // Without income the plan covers what you are expected to spend, plus a cushion, so it still balances to zero.
  const income = spendBased ? Math.round(SPEND_CUSHION * (fixedTotal + sum(slots.map((s) => s.target)))) : statedIncome

  const essentials =
    f.essentialsMonthly ??
    sum(fixed.filter((l) => l.essential).map((l) => l.amount)) +
      sum(slots.filter((s) => ESSENTIAL_KEYS.includes(s.key)).map((s) => s.target))
  const monthsHeld = essentials > 0 ? f.liquidSavings / essentials : 0

  const starter =
    !spendBased && essentials > 0 && f.liquidSavings < essentials
      ? Math.min(Math.ceil((essentials - f.liquidSavings) / STARTER_MONTHS_TO_FUND), Math.round(income * 0.1))
      : 0

  const goalsByPriority = [...f.goals].sort((a, b) => a.priority - b.priority)
  const goalAmounts = goalsByPriority.map((g) => (spendBased ? 0 : Math.round(g.monthly)))
  const zakat = spendBased ? 0 : Math.round(f.zakatMonthly)

  // Waterfall wants: fixed, then everyday targets, goals, starter net, zakat. Short of money, trim in the stated order.
  const everydayAmounts = CUT_ORDER.map((k) => slots.find((s) => s.key === k)?.target ?? 0)
  const everydayFloors = CUT_ORDER.map((k) => slots.find((s) => s.key === k)?.floor ?? 0)
  let safetyAmount = starter
  const planned = () => fixedTotal + sum(everydayAmounts) + sum(goalAmounts) + safetyAmount + zakat
  let deficit = planned() - income
  if (deficit > 0) {
    deficit -= shave(everydayAmounts, everydayFloors, deficit)
    const goalsCut = [...goalAmounts].reverse()
    const cutFromGoals = shave(goalsCut, goalsCut.map(() => 0), deficit)
    goalsCut.reverse().forEach((a, i) => (goalAmounts[i] = a))
    deficit -= cutFromGoals
    if (cutFromGoals > 0) risks.push(`Goals were reduced by ${money(cutFromGoals)} a month to fit your income.`)
    const safetyCut = Math.min(deficit, safetyAmount)
    safetyAmount -= safetyCut
    deficit -= safetyCut
  }
  const everydayByKey = new Map(CUT_ORDER.map((k, i) => [k, everydayAmounts[i]]))

  let slack = Math.max(0, income - planned())
  const takeSlack = (share: number, cap: number) => {
    const amount = Math.max(0, Math.min(Math.round(slack * share), cap))
    slack -= amount
    return amount
  }

  const wantsDebt = f.priorities.includes('debt')
  const hasCardDebt = f.debts.some((d) => d.kind === 'credit_card' && d.balance > 0)
  const payoffTarget = wantsDebt || hasCardDebt ? pickPayoffTarget(f.debts) : null
  // Extra payoff is paced, not maximal: enough to clear the target in about two to three years on top of
  // its minimum, so the rest of the slack still builds the safety net and goals.
  const paceCap = payoffTarget ? Math.ceil(payoffTarget.balance / (wantsDebt ? PAYOFF_PACE_PRIORITY_MONTHS : PAYOFF_PACE_MONTHS)) : 0
  const extraPayoff = payoffTarget ? takeSlack(wantsDebt ? 0.6 : 0.4, paceCap) : 0

  const targetMonths = Math.max(f.emergencyTargetMonths, f.incomeStability !== 'fixed' || f.dependents >= 1 ? 6 : 0)
  const gap = Math.max(0, targetMonths * essentials - f.liquidSavings)
  const fullNetCap = Math.max(0, Math.ceil(gap / FULL_NET_MONTHS_TO_FUND) - starter)
  const fullNet = takeSlack(f.priorities.includes('safety') ? 0.5 : 0.35, fullNetCap)
  safetyAmount += fullNet

  const canInvest = f.investInterest && !hasCardDebt && monthsHeld >= 1
  const invest = canInvest ? takeSlack(f.priorities.includes('invest') ? 0.6 : 0.35, Infinity) : 0

  const lines: DraftLine[] = [...fixed]

  if (safetyAmount > 0) {
    lines.push(
      line({
        block: 'safety',
        name: 'Safety net',
        icon: 'shield-check',
        amount: safetyAmount,
        linkType: 'emergency',
        isSavings: true,
        rationale: `Covers ${monthsHeld.toFixed(1)} of ${targetMonths} months of essentials (${money(essentials)}) today`,
        confidence: f.essentialsMonthly === null ? 'estimated' : 'high',
      })
    )
  }
  if (payoffTarget && extraPayoff > 0) {
    lines.push(
      line({
        block: 'debts',
        name: `Extra payoff: ${payoffTarget.name}`,
        icon: 'credit-card',
        amount: extraPayoff,
        isSavings: false,
        expenseCategories: ['Debt'],
        rationale: `Smallest ${hasCardDebt ? 'card ' : ''}balance first (${money(payoffTarget.balance)}) so a debt clears sooner`,
      })
    )
  }
  goalsByPriority.forEach((g, i) => {
    lines.push(
      line({
        block: 'goals',
        name: g.name,
        icon: g.icon,
        amount: goalAmounts[i],
        linkType: 'goal',
        linkIds: [g.id],
        isSavings: true,
        rationale: `Planned monthly draw for this goal${g.targetDate ? `, target ${g.targetDate}` : ''}`,
      })
    )
  })
  if (zakat > 0) {
    lines.push(
      line({
        block: 'grow',
        name: 'Zakat',
        icon: 'hand-heart',
        amount: zakat,
        rationale: `Your monthly zakat set-aside of ${money(zakat)}`,
      })
    )
  }
  if (invest > 0) {
    lines.push(
      line({
        block: 'grow',
        name: 'Investing',
        icon: 'trending-up',
        amount: invest,
        isSavings: true,
        rationale: `No costly debt and ${monthsHeld.toFixed(1)} months of essentials saved, so surplus can start growing`,
      })
    )
  }
  for (const s of slots) {
    const meta = EVERYDAY_META[s.key]
    const trimmed = everydayByKey.get(s.key)!
    const icon = s.key === 'transport' ? (f.transportMode === 'public' ? 'bus' : 'car') : meta.icon
    lines.push(
      line({
        block: 'everyday',
        name: meta.name,
        icon,
        amount: trimmed,
        essential: ESSENTIAL_KEYS.includes(s.key),
        expenseCategories: meta.categories,
        rationale: trimmed < s.target ? `Cut to the lowest safe level to fit your income (was ${money(s.target)})` : s.rationale,
        confidence: s.confidence,
      })
    )
  }

  const remainder = income - sum(lines.map((l) => l.amount))
  if (remainder > 0) {
    lines.push(
      line({
        block: 'grow',
        name: 'Buffer',
        icon: 'wallet',
        amount: remainder,
        isSavings: true,
        rationale: 'What is left after every other job, so no money is unassigned',
        confidence: 'estimated',
      })
    )
  }

  const planLines = lines.filter((l) => l.amount > 0 || l.linkType !== 'none')
  const free = income - sum(planLines.map((l) => l.amount))

  if (spendBased) {
    risks.push(
      income > 0
        ? `No income is set, so the plan covers your expected spending of ${money(income)} with a small cushion. Add income to plan savings and goals.`
        : 'No income is set and there is nothing to base a plan on yet. Add income or a few expenses first.'
    )
  }
  if (!spendBased && f.incomeStability !== 'fixed' && f.monthlyIncome > income) {
    risks.push(
      `Income varies: the plan is sized on ${money(income)}, not the ${money(f.monthlyIncome)} you expect. Anything above it is unallocated surplus, so send it to your safety net.`
    )
  }
  if (free < 0) {
    risks.push(
      `Fixed costs and the lowest safe everyday spending exceed your income by ${money(-free)}. Review your bills and debts, or raise income, before relying on this plan.`
    )
  }
  if (owns(f) && f.rent !== null && income > 0 && f.rent / income > bench.ratios.housingCap) {
    risks.push(
      `Housing is ${Math.round((f.rent / income) * 100)}% of income, above the usual ${Math.round(bench.ratios.housingCap * 100)}% guide. That is common, but it leaves little room.`
    )
  }
  if (essentials > 0 && monthsHeld < 1) {
    risks.push(`Savings cover only ${monthsHeld.toFixed(1)} months of essentials, so an emergency would hit quickly.`)
  }

  const intent: BudgetPlanIntent = payoffTarget && wantsDebt ? 'debt_crusher' : f.securityLean < 35 ? 'saver' : 'balanced'

  return {
    name: 'Plan',
    intent,
    income,
    lines: planLines,
    reasons: buildReasons(f, { income, fixedTotal, monthsHeld, essentials, safetyAmount, extraPayoff, payoffTarget, trimPct: Math.round((0.85 + (f.securityLean / 100) * 0.2) * 100), money }),
    risks,
    free,
    basis: spendBased ? 'spend' : 'income',
  }
}

function owns(f: BudgetFacts): boolean {
  return f.housing === 'rent' || f.housing === 'own'
}

interface ReasonInput {
  income: number
  fixedTotal: number
  monthsHeld: number
  essentials: number
  safetyAmount: number
  extraPayoff: number
  payoffTarget: FactDebt | null
  trimPct: number
  money: (n: number) => string
}

function buildReasons(f: BudgetFacts, r: ReasonInput): [string, string, string] {
  const fixedShare = r.income > 0 ? Math.round((r.fixedTotal / r.income) * 100) : 0
  const first = `Bills, subscriptions and debt minimums take ${r.money(r.fixedTotal)} (${fixedShare}% of ${r.money(r.income)}), so they are covered before anything else.`
  const second =
    r.monthsHeld < 1
      ? `You hold ${r.monthsHeld.toFixed(1)} months of essentials (${r.money(f.liquidSavings)} of ${r.money(r.essentials)}), so ${r.money(r.safetyAmount)} a month goes to the safety net first.`
      : `You already hold ${r.monthsHeld.toFixed(1)} months of essentials, so the safety net gets ${r.money(r.safetyAmount)} a month toward ${Math.max(f.emergencyTargetMonths, 1)}+ months.`
  const third =
    r.payoffTarget && r.extraPayoff > 0
      ? `${r.payoffTarget.name} gets ${r.money(r.extraPayoff)} extra a month, the smallest balance to clear first.`
      : `Everyday spending follows your own averages at ${r.trimPct}%, with essentials never below ${Math.round(ESSENTIAL_FLOOR * 100)}% of what you spend now.`
  return [first, second, third]
}
