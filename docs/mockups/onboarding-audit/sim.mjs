// Monte Carlo over the PRODUCTION question graph + engine (bundled by docs/mockups/budget-builder-v5/build.mjs).
// node sim.mjs <repo>  -> writes stats.json next to this file.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const repo = process.argv[2]
new Function(readFileSync(join(repo, 'docs/mockups/budget-builder-v5/js/real.js'), 'utf8'))()
const R = globalThis.Real
const here = dirname(fileURLToPath(import.meta.url))

let seed = 7
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
const U = (a, b) => a + (b - a) * rnd()
const pick = (w) => { let r = rnd() * Object.values(w).reduce((a, b) => a + b, 0); for (const [k, v] of Object.entries(w)) if ((r -= v) <= 0) return k; return Object.keys(w)[0] }
const yes = (p) => rnd() < p
const r10 = (n) => Math.round(n / 10) * 10
const some = (opts, p, max = 3) => opts.filter(() => yes(p)).slice(0, max)

const COUNTRY = { EG: { cur: 'EGP', inc: [9000, 60000] }, AE: { cur: 'AED', inc: [6000, 45000] }, SA: { cur: 'SAR', inc: [5000, 35000] } }

/** One person's true answer to every question (whether or not it is ever asked). */
function sampler(I) {
  return {
    income: () => I, incomeType: () => pick({ salary: 62, freelance: 12, business: 7, mixed: 7, seasonal: 3, benefits: 5, allowance: 4 }),
    incomeStability: () => pick({ fixed: 80, variable: 10, mixed: 10 }), jobSecurity: () => pick({ secure: 70, uncertain: 20, expecting_change: 10 }),
    lowMonth: () => r10(I * U(0.4, 0.85)), taxSetAside: () => pick({ already: 30, not_yet: 50, not_needed: 20 }), taxPct: () => Math.round(U(10, 25)),
    payFrequency: () => pick({ monthly: 90, biweekly: 5, weekly: 5 }), payday: () => +pick({ 1: 25, 25: 35, 28: 20, 15: 10, 10: 10 }),
    housing: () => pick({ rent: 45, own: 20, family: 28, company: 7 }), ownType: () => pick({ mortgage: 35, paid_off: 65 }),
    rentFreq: () => pick({ monthly: 70, quarterly: 15, yearly: 15 }), rentCheck: () => 'stated', rentIncludesUtilities: () => yes(0.3),
    mortgagePayment: () => r10(I * U(0.2, 0.4)), mortgageYears: () => Math.round(U(5, 25)), propertyCosts: () => r10(I * U(0.01, 0.05)),
    familyContribution: () => yes(0.55), familyContributionAmount: () => r10(I * U(0.05, 0.2)),
    household: () => pick({ solo: 40, couple: 20, family: 40 }), dependents: () => Math.round(U(1, 4)), youngestChild: () => pick({ under5: 30, school: 40, teen: 20, adult: 10 }),
    schoolFees: () => r10(I * U(0.05, 0.2)), childcare: () => r10(I * U(0.05, 0.15)), partnerRole: () => pick({ shares: 45, separate: 10, no_income: 40, no_partner: 5 }),
    partnerSharePct: () => Math.round(U(40, 80)), supportsOthers: () => yes(0.35), supportAmount: () => r10(I * U(0.05, 0.15)),
    confirmIncome: () => true, confirmBills: () => true, confirmDebts: () => true, confirmGoals: () => true,
    transportMode: () => pick({ public: 30, car: 45, taxi: 15, walk: 10 }), carOwnership: () => pick({ owned: 50, financed: 40, leased: 10 }),
    carOverlap: () => pick({ listed: 60, separate: 30, paid_off: 10 }), carPayment: () => r10(I * U(0.08, 0.2)),
    foodFrequency: () => pick({ everyday: 15, mostdays: 30, sometimes: 40, rarely: 15 }), lifestyle: () => pick({ minimal: 25, balanced: 55, comfortable: 20 }),
    healthCover: () => pick({ full: 35, partial: 45, none: 20 }), healthCost: () => r10(I * U(0.01, 0.05)), chronicMeds: () => yes(0.25), chronicAmount: () => r10(I * U(0.01, 0.04)),
    cashHeavy: () => yes(0.4), moreDebts: () => yes(0.2), hasDebts: () => yes(0.45),
    debtKinds: () => { const k = some(['card', 'loan', 'bnpl', 'family', 'student', 'tax'], 0.3); return k.length ? k : ['card'] },
    cardPayFull: () => yes(0.4), cardBalance: () => r10(I * U(0.5, 3)), cardMin: () => r10(I * U(0.03, 0.1)), cardApr: () => pick({ under15: 10, '15_25': 40, over25: 30, unknown: 20 }),
    loanBalance: () => r10(I * U(3, 20)), loanMin: () => r10(I * U(0.08, 0.2)), loanApr: () => pick({ under15: 40, '15_25': 30, over25: 10, unknown: 20 }),
    bnplMonthly: () => r10(I * U(0.03, 0.1)), bnplLeft: () => Math.round(U(3, 12)), familyOwed: () => r10(I * U(0.5, 3)), familyMonthly: () => (yes(0.5) ? r10(I * 0.05) : 0),
    studentBalance: () => r10(I * U(2, 10)), studentMin: () => r10(I * 0.05), taxOwed: () => r10(I * U(0.5, 2)), taxPlan: () => pick({ plan: 50, lump_sum: 20, none: 30 }),
    behind: () => yes(0.15), arrears: () => r10(I * U(0.2, 1)), debtStrategy: () => pick({ avalanche: 40, snowball: 30, balanced: 30 }), debtExtra: () => r10(I * 0.05),
    saveTarget: () => pick({ p10: 35, p20: 30, p30: 5, custom: 10, unsure: 20 }), saveCustom: () => r10(I * 0.15),
    saveObstacle: () => some(['dining', 'shopping', 'bills', 'irregular', 'debt', 'unplanned'], 0.3), savingsOnHand: () => (yes(0.25) ? 0 : r10(I * U(0.2, 4))),
    emergencyMonths: () => (yes(0.6) ? 3 : 6), lifeInsurance: () => yes(0.3), insurancePremium: () => r10(I * 0.02),
    retirement: () => pick({ employer: 40, self: 10, none: 50 }), retirementAmount: () => r10(I * 0.05), investing: () => pick({ already: 15, want_to: 30, not_now: 55 }),
    investMonthly: () => r10(I * 0.05), zakatMode: () => pick({ yes_auto: 30, yes_amount: 15, no: 55 }), zakatAmount: () => r10(I * 0.025),
    hasGoal: () => yes(0.55), goalKind: () => pick({ vacation: 20, house: 12, car: 15, education: 10, wedding: 10, pilgrimage: 8, business: 5, other: 20 }),
    houseScope: () => pick({ full_price: 30, down_payment: 70 }), educationFor: () => pick({ me: 40, child: 60 }), goalTarget: () => r10(I * U(2, 30)),
    goalSaved: () => r10(I * U(0, 2)), goalTiming: () => pick({ by_date: 70, by_amount: 30 }), goalMonths: () => Math.round(U(6, 36)), goalMonthly: () => r10(I * 0.1),
    anotherGoal: () => yes(0.3), goal2Target: () => r10(I * U(1, 10)), goal2Months: () => Math.round(U(6, 24)),
    annualKinds: () => (yes(0.7) ? [...new Set([...some(['car_yearly', 'school_start', 'travel', 'home_repairs', 'medical', 'renewals'], 0.3), 'festive'])] : []),
    bigSoon: () => (yes(0.3) ? [pick({ baby: 1, wedding: 1, move: 1, car: 1, medical: 1 })] : []), bigSoonAmount: () => r10(I * U(1, 6)), bigSoonMonths: () => Math.round(U(3, 24)),
    annualTotal: () => r10(I * U(0.5, 2)), priorities: () => { const p = some(['safety', 'debt', 'goals', 'invest', 'enjoy', 'family'], 0.35); return p.length ? p : ['safety'] },
    securityLean: () => Math.round(U(20, 80)), housingChange: () => pick({ stable: 60, lease_end: 15, can_reduce: 15, will_rise: 10 }),
    deficitPlan: () => { const d = some(['lower_rent', 'refinance', 'extra_income', 'pause_goals', 'family_help'], 0.3); return d.length ? d : ['none'] }, extraIncome: () => r10(I * 0.1),
    goalAdjust: () => pick({ extend: 50, lower: 20, keep: 30 }), goalMonthsNew: () => Math.round(U(18, 60)), goalTargetNew: () => r10(I * 3),
    goalVsSafety: () => pick({ goal_first: 25, balanced: 50, safety_first: 25 }), cutFirst: () => some(['dining', 'fun', 'shopping', 'subscriptions', 'transport'], 0.35),
  }
}

/** True answers for every question that would apply to this person, settled over a few passes (later answers unlock earlier gates). */
function truthOf(intent, known, raw) {
  let s = R.createFlow(intent, known)
  for (let pass = 0; pass < 5; pass++) {
    for (const x of R.NODES) {
      if (x.id in s.a || (x.when && !x.when(s)) || !(x.id in raw)) continue
      s = { ...s, a: { ...s.a, [x.id]: raw[x.id] } }
    }
  }
  return R.pruneInapplicable(s).a
}

/** One run through the studio: what screens appear, what gets asked, what the person skips. */
function walk(intent, known, truth, o) {
  let s = R.createFlow(intent, known)
  const start = new Set(Object.keys(s.a))
  const opener = {}
  if (o.opener > 0) for (const id of R.ANSWERABLE) if (truth[id] !== undefined && yes(o.opener)) opener[id] = truth[id]
  if (Object.keys(opener).length) s = R.acceptDescribed(s, R.parseSituation(opener)).state
  const fromOpener = Object.keys(s.a).filter((k) => !start.has(k))
  const asked = [], screens = []
  let buildNowAt = null
  for (let guard = 0; guard < 80; guard++) {
    const head = R.nextQuestion(s)
    if (!head) break
    const values = {}, skips = []
    for (const x of R.NODES) if (x.group === head.group && truth[x.id] !== undefined) values[x.id] = truth[x.id]
    for (const x of R.screenNodes(s, head, values, skips)) if (x.skippable && yes(o.skip)) skips.push(x.id)
    const fields = R.screenNodes(s, head, values, skips)
    for (const x of fields) {
      s = skips.includes(x.id) ? R.skip(s, x.id) : R.answer(s, x.id, values[x.id] ?? R.defaultFor(x, s) ?? 0)
      asked.push(x.id)
    }
    screens.push({ group: head.group, mod: head.mod, n: fields.length })
    if (buildNowAt === null && R.flowReadiness(s).enough && R.nextQuestion(s)) buildNowAt = screens.length
  }
  return { s, asked, screens, buildNowAt, fromOpener }
}

function facts(c, known) {
  return {
    baseCurrency: COUNTRY[c].cur, country: c, monthlyIncome: known.income ?? 0, incomeStability: known.incomeStability ?? 'fixed', incomeFloor: null, household: 'solo', dependents: 0,
    supportsOthers: false, housing: known.housing ?? null, rent: known.rent ?? null, rentIncludesUtilities: true, lifestyle: 'balanced', foodFrequency: null, transportMode: null, hasCar: false,
    bills: [], subscriptionsMonthly: 0, subscriptionCount: 0, debts: [], goals: [], liquidSavings: 0, essentialsMonthly: null, emergencyTargetMonths: 3, zakatMonthly: 0,
    averages: {}, averageCycles: 0, priorities: [], securityLean: 50, investInterest: false,
  }
}
const key = (l) => `${l.block}:${l.name}`
const linesOf = (d) => { const m = {}; for (const l of d.lines) m[key(l)] = (m[key(l)] ?? 0) + l.amount; return m }

const cold = { knownBillCount: 0, knownSubCount: 0, knownDebtCount: 0, knownDebtMinimum: 0, knownGoalCount: 0 }
const fromOnboarding = (t) => ({ income: t.income, incomeStability: t.incomeStability === 'variable' || ['freelance', 'business', 'seasonal'].includes(t.incomeType) ? 'variable' : 'fixed', ...cold })
const SCEN = {
  onboarding: { label: 'From first-run onboarding (intent = mixed)', intent: 'mixed', opener: 0.45, skip: 0.15, known: fromOnboarding },
  light: { label: 'Onboarding, short opener (each fact 15%)', intent: 'mixed', opener: 0.15, skip: 0.15, known: fromOnboarding },
  offline: { label: 'Onboarding, offline or AI down (no opener)', intent: 'mixed', opener: 0, skip: 0.15, known: fromOnboarding },
  save: { label: 'Budget tab: Save more, cold', intent: 'save', opener: 0.45, skip: 0.15, known: () => cold },
  goal: { label: 'Budget tab: Reach a goal, cold', intent: 'goal', opener: 0.45, skip: 0.15, known: () => cold },
  debt: { label: 'Budget tab: Pay off debt, cold', intent: 'debt', opener: 0.45, skip: 0.15, known: () => cold },
  rich: { label: 'Data-rich account (months of history)', intent: 'mixed', opener: 0.45, skip: 0.15, known: (t) => ({ income: t.income, incomeStability: 'fixed', housing: t.housing, ...(t.housing === 'rent' ? { rent: t.rent } : {}), household: t.household, transportMode: t.transportMode, foodFrequency: t.foodFrequency, knownBillCount: 4, knownSubCount: 2, knownDebtCount: t.hasDebts ? 1 : 0, knownDebtMinimum: t.hasDebts ? r10(t.income * 0.1) : 0, knownGoalCount: 0, hasHistory: true }) },
}

const N = 3000
const out = { n: N, scenarios: {}, nodes: {} }
const blank = () => Object.fromEntries(R.NODES.map((x) => [x.id, { applicable: 0, asked: 0, fromOpener: 0, missed: 0, known: 0 }]))
for (const x of R.NODES) out.nodes[x.id] = { tier: x.tier, mod: x.mod, stake: x.stake, group: x.group, control: x.control, skippable: !!x.skippable, gated: !!x.when, check: !!x.needs, by: {} }
for (const [sid, sc] of Object.entries(SCEN)) {
  const per = blank()
  const lineErr = {}
  const acc = { screens: [], questions: [], err: [], buildNow: [], readinessEnd: [], missedAmt: 0, overBudget: 0, missedTop: {}, paths: {}, opener: [], modScreens: {} }
  for (let i = 0; i < N; i++) {
    const c = pick({ EG: 50, AE: 25, SA: 25 })
    const I = r10(Math.exp(U(Math.log(COUNTRY[c].inc[0]), Math.log(COUNTRY[c].inc[1]))))
    const sm = sampler(I), raw = {}
    for (const [k, f] of Object.entries(sm)) raw[k] = f()
    raw.rent = r10(I * U(0.18, 0.45) * { monthly: 1, quarterly: 3, yearly: 12 }[raw.rentFreq])
    const known = sc.known({ ...raw, income: I })
    const truth = truthOf(sc.intent, known, raw)
    const { s, asked, screens, buildNowAt, fromOpener } = walk(sc.intent, known, truth, sc)
    const base = facts(c, known)
    const dTruth = R.buildPlan(R.applyAnswers(base, truth, sc.intent))
    const dRun = R.buildPlan(R.applyAnswers(base, s.a, sc.intent))
    const lt = linesOf(dTruth), lr = linesOf(dRun)
    let diff = 0
    for (const k of new Set([...Object.keys(lt), ...Object.keys(lr)])) { const d = Math.abs((lt[k] ?? 0) - (lr[k] ?? 0)); diff += d; lineErr[k] = (lineErr[k] ?? 0) + d / I }
    acc.err.push(diff / 2 / I)
    acc.screens.push(screens.length)
    acc.questions.push(asked.length)
    acc.opener.push(fromOpener.length)
    acc.readinessEnd.push(R.flowReadiness(s).percent)
    for (const x of screens) acc.modScreens[x.mod] = (acc.modScreens[x.mod] ?? 0) + 1
    if (buildNowAt) acc.buildNow.push(buildNowAt)
    if (dRun.free < 0) acc.overBudget++
    const path = screens.map((x) => x.group).join(' > ')
    acc.paths[path] = (acc.paths[path] ?? 0) + 1
    let missedAmt = false
    for (const [id, v] of Object.entries(truth)) {
      const st = per[id]; if (!st) continue
      const node = R.NODE_BY_ID.get(id)
      if (node.control === 'confirm') continue
      st.applicable++
      if (asked.includes(id)) st.asked++
      else if (fromOpener.includes(id)) st.fromOpener++
      else if (known[id] !== undefined) st.known++
      else if (!(id in s.a)) {
        st.missed++
        acc.missedTop[id] = (acc.missedTop[id] ?? 0) + 1
        if (node.control === 'amount' && typeof v === 'number' && v > 0) missedAmt = true
      }
    }
    if (missedAmt) acc.missedAmt++
  }
  for (const [id, st] of Object.entries(per)) out.nodes[id].by[sid] = st
  const q = (xs, p) => { const a = [...xs].sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : null }
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
  const hist = (xs) => { const h = {}; for (const x of xs) h[x] = (h[x] ?? 0) + 1; return h }
  out.scenarios[sid] = {
    label: sc.label, intent: sc.intent, opener: sc.opener, skip: sc.skip,
    screens: { mean: mean(acc.screens), p10: q(acc.screens, 0.1), p50: q(acc.screens, 0.5), p90: q(acc.screens, 0.9), max: Math.max(...acc.screens), hist: hist(acc.screens) },
    questions: { mean: mean(acc.questions), p50: q(acc.questions, 0.5), p90: q(acc.questions, 0.9), max: Math.max(...acc.questions) },
    openerAnswered: mean(acc.opener),
    misallocation: { mean: mean(acc.err), p50: q(acc.err, 0.5), p90: q(acc.err, 0.9), over10: acc.err.filter((e) => e > 0.1).length / N, over20: acc.err.filter((e) => e > 0.2).length / N, hist: hist(acc.err.map((e) => Math.min(95, Math.floor(e * 100 / 5) * 5))) },
    buildNowOffered: acc.buildNow.length / N, buildNowAt: mean(acc.buildNow),
    readinessEnd: mean(acc.readinessEnd), missedAmountShare: acc.missedAmt / N, overBudgetShare: acc.overBudget / N,
    modScreens: Object.fromEntries(Object.entries(acc.modScreens).map(([k, v]) => [k, v / N])),
    missedTop: Object.entries(acc.missedTop).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([id, n]) => [id, n / N]),
    distinctPaths: Object.keys(acc.paths).length,
    lineErr: Object.entries(lineErr).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => [k, v / N / 2]),
    topPaths: Object.entries(acc.paths).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([p, n]) => [p, n / N]),
  }
}
writeFileSync(join(here, 'stats.json'), JSON.stringify(out))
for (const [k, v] of Object.entries(out.scenarios)) console.log(k, 'screens p50/p90/max', v.screens.p50, v.screens.p90, v.screens.max, '| q p50', v.questions.p50, '| opener', v.openerAnswered.toFixed(1), '| err mean/p90', v.misallocation.mean.toFixed(3), v.misallocation.p90.toFixed(3), '>10%', v.misallocation.over10.toFixed(2), '| missedAmt', v.missedAmountShare.toFixed(2), '| paths', v.distinctPaths, '| buildNow', v.buildNowOffered.toFixed(2), '| over', v.overBudgetShare.toFixed(2))
console.log('missed onboarding', JSON.stringify(out.scenarios.onboarding.missedTop))
console.log('missed offline', JSON.stringify(out.scenarios.offline.missedTop))
console.log('lineErr offline', JSON.stringify(out.scenarios.offline.lineErr))
console.log('lineErr onboarding', JSON.stringify(out.scenarios.onboarding.lineErr))
console.log('missed rich', JSON.stringify(out.scenarios.rich.missedTop))
