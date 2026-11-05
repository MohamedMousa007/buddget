import type { BudgetPlanIntent } from '@/lib/store/types'
import type { BudgetFacts, DraftLine, EverydayKey, FactDebt, PlanDraft } from '@/lib/budget/facts'
import { benchmarkEveryday, benchmarkUtilities, getBenchmark, type Benchmark } from '@/lib/budget/benchmarks'
import { learnedMultiplier } from '@/lib/budget/learned'

export const ENGINE_VERSION = 'v2'

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
/** How far a person's own spending may pull the benchmark for categories they have no history in. */
const PERSONAL_SCALE_MIN = 0.5
const PERSONAL_SCALE_MAX = 2
const PERSONAL_SCALE_KEYS = 2
const PERSONAL_SCALE_VISIBLE = 0.1
const ESSENTIAL_KEYS: readonly EverydayKey[] = ['groceries', 'health', 'transport']
/** Trim order when money runs short: wants go before needs. */
const CUT_ORDER: readonly EverydayKey[] = ['fun', 'shopping', 'dining', 'other', 'family', 'transport', 'health', 'groceries']
const ESSENTIAL_FLOOR = 0.7
const STARTER_MONTHS_TO_FUND = 6
const SAFETY_FAST_MONTHS = 2
const FULL_NET_MONTHS_TO_FUND = 12
const VARIABLE_INCOME_FALLBACK = 0.8
/** Debt payments above this share of income are a warning (the 36% rule); above the hard share, a plan cannot fix it alone. */
const DEBT_SHARE_WARN = 0.36
const DEBT_SHARE_HARD = 0.5
/** Needs above this share squeeze the 50/30/20 split; the usual guide is 50%, flagged at 60% because rents differ by city. */
const NEEDS_SHARE_WARN = 0.6
/** A card or loan at or above this yearly rate costs more than any safe saving earns, so it comes before extra saving. */
const COSTLY_APR = 15
/** Rates assumed when the person did not know theirs. */
const ASSUMED_APR: Record<FactDebt['kind'], number> = { credit_card: 25, personal: 12, loan: 12, installment: 0 }
/** Overdue amounts are cleared over this many months. */
const ARREARS_MONTHS = 3
const RETIREMENT_TARGET = 0.05
/** Goals may take at most this share of income, however big they are: a goal that eats the budget gets stretched, not funded. */
const GOALS_SHARE_CAP = 0.35
const TAX_RESERVE_MAX = 0.4

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

/** The everyday line a plan row name belongs to, for learning from edits and month closes. */
export function everydayKeyOfName(name: string): EverydayKey | null {
  const n = name.trim().toLowerCase()
  return EVERYDAY_KEYS.find((k) => EVERYDAY_META[k].name.toLowerCase() === n) ?? null
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
  // A worst month of 0 is a real answer but not a plan: it must not turn a known income into "no income".
  const floor = f.incomeFloor != null && f.incomeFloor > 0 ? f.incomeFloor : VARIABLE_INCOME_FALLBACK * f.monthlyIncome
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
  for (const c of f.extraCommitments ?? []) {
    lines.push(
      line({ block: 'bills', name: c.name, icon: 'receipt', amount: Math.round(c.amount), essential: true, rationale: 'A monthly cost you told Buddgy about' })
    )
  }
  const stated = (name: string, icon: string, amount: number | undefined, why: string, categories: string[] = []) => {
    if (amount && amount > 0) lines.push(line({ block: 'bills', name, icon, amount: Math.round(amount), essential: true, expenseCategories: categories, rationale: why }))
  }
  stated('Home upkeep', 'wrench', f.propertyMonthly, 'Building fees, maintenance and property tax you told Buddgy about')
  stated('School', 'graduation-cap', f.schoolMonthly, 'School costs you told Buddgy about, your share', ['Education'])
  stated('Childcare', 'baby', f.childcareMonthly, 'Childcare you told Buddgy about, your share')
  stated('Health costs', 'heart-pulse', f.healthMonthly, 'Health costs your insurance does not cover', ['Health'])
  stated('Insurance', 'shield', f.insuranceMonthly, 'Premiums you told Buddgy about')
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
  if (f.arrears && f.arrears > 0) {
    lines.push(
      line({
        block: 'debts',
        name: 'Catch up overdue',
        icon: 'triangle-alert',
        amount: Math.ceil(f.arrears / ARREARS_MONTHS),
        linkType: 'none',
        essential: true,
        expenseCategories: ['Debt'],
        rationale: `Clears the overdue amount in ${ARREARS_MONTHS} months, before any extra saving`,
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

/**
 * How this person spends compared with the benchmark, from the categories where we know. Someone who spends 30% above
 * typical on groceries and dining likely does on a category we have not seen yet, so the benchmark for those is scaled.
 */
export function personalScale(averages: BudgetFacts['averages'], typical: Record<EverydayKey, number>): number {
  const ratios = EVERYDAY_KEYS.filter((k) => (averages[k] ?? 0) > 0 && typical[k] > 0)
    .map((k) => (averages[k] as number) / typical[k])
    .sort((a, b) => a - b)
  if (ratios.length < PERSONAL_SCALE_KEYS) return 1
  const mid = ratios.length % 2 ? ratios[(ratios.length - 1) / 2] : (ratios[ratios.length / 2 - 1] + ratios[ratios.length / 2]) / 2
  return Math.min(PERSONAL_SCALE_MAX, Math.max(PERSONAL_SCALE_MIN, mid))
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
  const evidence = Math.min(1, cycles / FULL_EVIDENCE_CYCLES)
  const weight = evidence * (f.cashHeavy ? CASH_HEAVY_TRUST : 1)
  // Unseen categories follow how this person spends elsewhere; the pull fades as evidence thins.
  const personal = 1 + (personalScale(f.averages, typical) - 1) * weight
  const benchFor = (k: EverydayKey) => typical[k] * (f.averages[k] === undefined ? personal : 1)
  const needsBench = weight < 1 ? EVERYDAY_KEYS : EVERYDAY_KEYS.filter((k) => f.averages[k] === undefined)
  const benchSum = sum(needsBench.map(benchFor))
  // Low incomes must not be handed a benchmark larger than they can pay.
  const scale = benchSum > 0 ? Math.min(1, (0.6 * Math.max(0, capacity - fixedTotal)) / benchSum) : 1

  const slots: EverydaySlot[] = []
  for (const key of EVERYDAY_KEYS) {
    const avg = f.averages[key]
    const typicalHere = benchFor(key) * scale
    const blended = avg === undefined ? typicalHere : typicalHere > 0 ? weight * avg + (1 - weight) * typicalHere : avg
    const target = Math.round(blended * learnedMultiplier(f.learned?.everyday?.[key]) * trim)
    const floor = ESSENTIAL_KEYS.includes(key) ? Math.round(blended * ESSENTIAL_FLOOR) : 0
    if (target === 0) continue
    const name = EVERYDAY_META[key].name.toLowerCase()
    slots.push({
      key,
      target,
      floor,
      // Cash habits lower how much the history counts, not how sure we are of the figures we do have.
      confidence: avg === undefined || evidence < 1 ? 'estimated' : 'high',
      rationale:
        avg === undefined
          ? Math.abs(personal - 1) >= PERSONAL_SCALE_VISIBLE
            ? `Typical ${bench.label} ${name}, adjusted to your usual spending (${Math.round(personal * 100)}% of typical)`
            : `Typical ${bench.label} ${name} for your household, no spending history yet`
          : weight < 1
            ? evidence >= 1
              ? `Your ${name} average of ${money(avg)}, blended with typical ${bench.label} spending because you pay mostly in cash`
              : `Your ${name} average of ${money(avg)} so far, blended with typical ${bench.label} spending until you have ${FULL_EVIDENCE_CYCLES} months of history`
            : `Your 3-month average of ${money(avg)}, at ${trimPct}%`,
    })
  }
  return slots
}

/** Takes up to `deficit` out of the amounts in the given order, never below `floors`. Returns what was removed. */
function shave(amounts: number[], floors: number[], deficit: number): number {
  let left = deficit
  for (let i = 0; i < amounts.length && left > 0; i++) {
    const cut = Math.min(left, Math.max(0, amounts[i] - floors[i]))
    amounts[i] -= cut
    left -= cut
  }
  return deficit - left
}

const aprOf = (d: FactDebt) => d.apr ?? ASSUMED_APR[d.kind]

/**
 * Where the extra payment goes. Highest interest first (the avalanche) saves the most money; smallest balance first
 * (the snowball) wins motivation. Installments follow a fixed schedule, so extra money never goes to them. With no
 * stated choice, any known rate decides; without one, cards and then the smallest balance.
 */
function pickPayoffTarget(debts: FactDebt[], strategy: BudgetFacts['debtStrategy']): FactDebt | null {
  const open = debts.filter((d) => d.balance > 0 && d.kind !== 'installment')
  if (open.length === 0) return null
  const smallest = (xs: FactDebt[]) => xs.reduce((a, b) => (b.balance < a.balance ? b : a))
  const costliest = (xs: FactDebt[]) => xs.reduce((a, b) => (aprOf(b) > aprOf(a) || (aprOf(b) === aprOf(a) && b.balance < a.balance) ? b : a))
  if (strategy === 'snowball') return smallest(open)
  if (strategy === 'avalanche' || open.some((d) => d.apr != null)) return costliest(open)
  const cards = open.filter((d) => d.kind === 'credit_card')
  return smallest(cards.length > 0 ? cards : open)
}

export function buildPlan(f: BudgetFacts): PlanDraft {
  const bench = getBenchmark(f.country, f.baseCurrency)
  const money = (n: number) => `${f.baseCurrency} ${Math.round(n).toLocaleString('en-US')}`
  const statedIncome = incomeBasis(f)
  const spendBased = statedIncome <= 0
  const risks: string[] = []

  // The person's own trim order goes first, the rest keep the default order.
  const cutOrder = [...(f.cutFirst ?? []), ...CUT_ORDER.filter((k) => !(f.cutFirst ?? []).includes(k))]
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
  const goalsWanted = sum(goalAmounts)
  const goalsCap = Math.round(income * GOALS_SHARE_CAP)
  if (goalsWanted > goalsCap && goalsWanted > 0) {
    // Scale every goal down together so priorities keep their proportions.
    goalAmounts.forEach((g, i) => (goalAmounts[i] = Math.floor((g * goalsCap) / goalsWanted)))
    risks.push(`Your goals need ${money(goalsWanted)} a month, more than ${Math.round(GOALS_SHARE_CAP * 100)}% of income. The plan funds ${money(sum(goalAmounts))}, so they will take longer than you asked.`)
  }
  const zakat = spendBased ? 0 : Math.round(f.zakatMonthly)

  // Waterfall wants: fixed, then everyday targets, goals, starter net, zakat. Short of money, trim in the stated order.
  const everydayAmounts = cutOrder.map((k) => slots.find((s) => s.key === k)?.target ?? 0)
  const everydayFloors = cutOrder.map((k) => slots.find((s) => s.key === k)?.floor ?? 0)
  // Tax is owed whether or not the plan has room, so it is reserved first and never trimmed. Yearly costs are trimmed last.
  const taxReserve = spendBased ? 0 : Math.round(income * Math.min(TAX_RESERVE_MAX, Math.max(0, f.taxReservePct ?? 0)))
  const yearly = spendBased ? 0 : Math.round(f.annualMonthly ?? 0)
  const ownRetirement = spendBased ? 0 : Math.round(f.retirementMonthly ?? 0)
  let safetyAmount = starter
  let yearlyAmount = yearly
  // A person who put safety first gets the goal at half pace until one month of essentials is held.
  if (f.goalVsSafety === 'safety_first' && essentials > 0 && f.liquidSavings < essentials) goalAmounts.forEach((g, i) => (goalAmounts[i] = Math.round(g * 0.5)))
  const planned = () => fixedTotal + taxReserve + sum(everydayAmounts) + sum(goalAmounts) + safetyAmount + yearlyAmount + ownRetirement + zakat
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
    const yearlyCut = Math.min(deficit, yearlyAmount)
    yearlyAmount -= yearlyCut
    deficit -= yearlyCut
  }

  let slack = Math.max(0, income - planned())
  const takeSlack = (share: number, cap: number) => {
    const amount = Math.max(0, Math.min(Math.round(slack * share), cap))
    slack -= amount
    return amount
  }

  const wantsDebt = f.priorities.includes('debt')
  const hasCardDebt = f.debts.some((d) => d.kind === 'credit_card' && d.balance > 0)
  const costlyDebt = f.debts.some((d) => d.balance > 0 && d.kind !== 'installment' && aprOf(d) >= COSTLY_APR)
  const payoffTarget = wantsDebt || hasCardDebt || costlyDebt ? pickPayoffTarget(f.debts, f.debtStrategy) : null
  // Extra payoff is paced, not maximal: enough to clear the target in about two to three years on top of
  // its minimum, so the rest of the slack still builds the safety net and goals. Costly debt outranks low-yield saving,
  // so it takes most of the slack; a stated extra amount replaces the pace.
  const targetCostly = payoffTarget !== null && aprOf(payoffTarget) >= COSTLY_APR
  const paceCap = payoffTarget
    ? f.debtExtra && f.debtExtra > 0
      ? Math.min(Math.round(f.debtExtra), payoffTarget.balance)
      : Math.ceil(payoffTarget.balance / (wantsDebt || targetCostly ? PAYOFF_PACE_PRIORITY_MONTHS : PAYOFF_PACE_MONTHS))
    : 0
  const extraPayoff = payoffTarget ? takeSlack(targetCostly ? 0.7 : wantsDebt ? 0.6 : 0.4, paceCap) : 0

  // Three months of essentials for a steady single income; six with dependants or varying pay; nine when both apply and the work is self-employed.
  const selfEmployed = f.incomeType === 'freelance' || f.incomeType === 'business'
  const targetMonths = Math.min(
    12,
    Math.max(f.emergencyTargetMonths, f.incomeStability !== 'fixed' || f.dependents >= 1 || f.jobUncertain ? 6 : 0, selfEmployed && f.dependents >= 1 ? 9 : 0),
  )
  const gap = Math.max(0, targetMonths * essentials - f.liquidSavings)
  // Pay yourself first. With under a month of essentials held, the net is filled fast (in about two months of slack);
  // after that it grows at the pace the person leans toward saving, and the rest of the slack is free for other jobs.
  const thin = essentials > 0 && f.liquidSavings < essentials
  const horizon = thin ? SAFETY_FAST_MONTHS : f.goalVsSafety === 'safety_first' ? FULL_NET_MONTHS_TO_FUND / 4 : FULL_NET_MONTHS_TO_FUND / 2
  const fullNetCap = Math.max(0, Math.ceil(gap / horizon) - starter)
  const safetyShare = thin ? 1 : Math.min(0.8, 0.35 + (1 - f.securityLean / 100) * 0.35 + (f.priorities.includes('safety') ? 0.1 : 0))
  const fullNet = takeSlack(safetyShare, fullNetCap)
  safetyAmount += fullNet
  // A big surplus with almost nothing saved should not sit in a buffer: finish the net now, keeping a third of income flexible.
  if (thin && slack > income * 0.3) {
    const extra = Math.max(0, Math.min(gap - starter - fullNet, Math.round(slack - income * 0.3)))
    safetyAmount += extra
    slack -= extra
  }

  const canInvest = f.investInterest && !hasCardDebt && !costlyDebt && monthsHeld >= 1
  const invest = canInvest ? takeSlack(f.priorities.includes('invest') ? 0.6 : 0.35, f.investMonthly && f.investMonthly > 0 ? f.investMonthly : Infinity) : 0
  // No retirement saving at all, and the basics are in place: start a small line rather than leave it at zero.
  const startRetirement = f.retirement === 'none' && !costlyDebt && monthsHeld >= 1 ? takeSlack(0.25, Math.round(income * RETIREMENT_TARGET)) : 0

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
  if (taxReserve > 0) {
    lines.push(
      line({
        block: 'grow',
        name: 'Tax reserve',
        icon: 'landmark',
        amount: taxReserve,
        isSavings: true,
        essential: true,
        rationale: `${Math.round((taxReserve / income) * 100)}% of income held back for tax, so it is never spent by mistake`,
        confidence: 'estimated',
      })
    )
  }
  if (yearlyAmount > 0) {
    lines.push(
      line({
        block: 'grow',
        name: 'Yearly costs',
        icon: 'calendar-clock',
        amount: yearlyAmount,
        isSavings: true,
        rationale: 'Costs that come once or twice a year, set aside a month at a time so they never hit at once',
        confidence: 'estimated',
      })
    )
  }
  const retirementTotal = ownRetirement + startRetirement
  if (retirementTotal > 0) {
    lines.push(
      line({
        block: 'grow',
        name: 'Retirement',
        icon: 'sunset',
        amount: retirementTotal,
        isSavings: true,
        rationale: ownRetirement > 0 ? 'Your own retirement contribution' : 'You have no retirement saving yet, so a small start',
        confidence: ownRetirement > 0 ? 'high' : 'estimated',
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
        rationale:
          f.debtStrategy === 'snowball'
            ? `Smallest balance first (${money(payoffTarget.balance)}), your chosen order, so a debt clears sooner`
            : payoffTarget.apr != null || f.debtStrategy === 'avalanche'
              ? `Highest interest first (${payoffTarget.apr != null ? `${payoffTarget.apr}%` : 'about ' + aprOf(payoffTarget) + '%'}), which saves the most money`
              : `Smallest ${hasCardDebt ? 'card ' : ''}balance first (${money(payoffTarget.balance)}) so a debt clears sooner`,
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
  // The saving target the person set: lean on everyday spending, never below the essential floors, until it is met.
  if (!spendBased && f.saveTargetPct && f.saveTargetPct > 0) {
    const savedNow = sum(lines.filter((l) => l.isSavings && l.name !== 'Tax reserve').map((l) => l.amount)) + Math.max(0, income - sum(lines.map((l) => l.amount)) - sum(everydayAmounts))
    const shortfall = Math.round(income * f.saveTargetPct) - savedNow
    if (shortfall > 0) {
      const moved = shave(everydayAmounts, everydayFloors, shortfall)
      if (moved < shortfall) risks.push(`Your ${Math.round(f.saveTargetPct * 100)}% saving target needs ${money(shortfall - moved)} more than the plan can free without cutting essentials.`)
    }
  }
  const everydayByKey = new Map(cutOrder.map((k, i) => [k, everydayAmounts[i]]))
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
  const debtMinimums = sum(f.debts.map((d) => d.minimum))
  if (!spendBased && income > 0 && debtMinimums / income > DEBT_SHARE_WARN) {
    const share = Math.round((debtMinimums / income) * 100)
    risks.push(
      debtMinimums / income > DEBT_SHARE_HARD
        ? `Debt payments take ${share}% of income. A budget alone cannot fix that: ask your lenders about lower payments or a longer term, and avoid new debt.`
        : `Debt payments take ${share}% of income, above the 36% guide, so extra saving waits until they come down.`
    )
  }
  if (f.arrears && f.arrears > 0) risks.push('You are behind on payments. Contact the lender before the next due date: most will agree a plan, and late fees compound.')
  const needs = sum(planLines.filter((l) => l.essential && !l.isSavings).map((l) => l.amount))
  if (!spendBased && income > 0 && needs / income > NEEDS_SHARE_WARN) {
    risks.push(`Essentials take ${Math.round((needs / income) * 100)}% of income. The 50/30/20 guide is 50%, so there is little room for saving until a big fixed cost comes down.`)
  }
  if (selfEmployed && taxReserve === 0 && !spendBased) risks.push('Self-employed income has no tax reserve yet. Set a percentage aside before you spend what comes in.')

  const intent: BudgetPlanIntent = payoffTarget && (wantsDebt || targetCostly) ? 'debt_crusher' : f.securityLean < 35 ? 'saver' : 'balanced'

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
