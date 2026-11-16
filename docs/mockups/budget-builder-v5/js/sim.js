/* Prototype layer around the real engine (js/real.js): fictional personas, the fact registry view, the simulated AI,
 * draft edits, what-if scenarios and outcome metrics. Everything here is deterministic. Loaded by index.html and test.mjs. */
;(function (root) {
  'use strict'
  const R = root.Real
  const sum = (xs) => xs.reduce((s, x) => s + x, 0)
  const clone = (x) => JSON.parse(JSON.stringify(x))

  // Fictional fixed rates to USD, for the prototype only.
  const FX = { USD: 1, EUR: 1.08, GBP: 1.27, AED: 0.2723, SAR: 0.2667, EGP: 0.0204 }
  const convert = (amount, from, to) => (from === to ? amount : (amount * FX[from]) / FX[to])
  const COUNTRIES = { EG: { cur: 'EGP', tz: 'Africa/Cairo', week: 6 }, AE: { cur: 'AED', tz: 'Asia/Dubai', week: 1 }, SA: { cur: 'SAR', tz: 'Asia/Riyadh', week: 0 }, OTHER: { cur: 'USD', tz: 'UTC', week: 1 } }
  const SYMBOL = { EGP: 'E£', AED: 'Dh', SAR: 'SR', USD: '$', EUR: '€', GBP: '£' }

  const emptyFacts = (country, cur) => ({
    baseCurrency: cur, country: country === 'OTHER' ? null : country, monthlyIncome: 0, incomeStability: 'fixed', incomeFloor: null, household: 'solo', dependents: 0,
    supportsOthers: false, housing: null, rent: null, rentIncludesUtilities: true, lifestyle: 'balanced', foodFrequency: null, transportMode: null, hasCar: false,
    bills: [], subscriptionsMonthly: 0, subscriptionCount: 0, debts: [], goals: [], liquidSavings: 0, essentialsMonthly: null, emergencyTargetMonths: 3, zakatMonthly: 0,
    averages: {}, averageCycles: 0, priorities: [], securityLean: 50, investInterest: false,
  })

  /* ---------------------------------------------------------------- personas (all fictional)
   * t   = the answers this person would give (question ids from the real graph)
   * rec = what the app would already hold for them once they have history
   * level = how much of that the app holds today: none | profile | full */
  const PERSONAS = {
    nour: { id: 'nour', name: 'Nour', country: 'EG', cur: 'EGP', lang: 'en', level: 'none', intent: 'goal',
      title: 'Complete cold start', sub: 'Egypt. Name, language and country only.',
      story: ['I make 18,000 a month on a salary. I live with my parents and give them 2,500. I have about 6,000 saved and I want a laptop for 45,000 in 9 months.',
        'راتبي ١٨ ألف في الشهر. أعيش مع أهلي وأعطيهم ٢٥٠٠. مدخراتي ٦٠٠٠ وأريد لابتوب بـ ٤٥ ألف خلال ٩ شهور.'],
      t: { income: 18000, incomeType: 'salary', incomeStability: 'fixed', jobSecurity: 'secure', payFrequency: 'monthly', payday: 27, housing: 'family', familyContribution: true, familyContributionAmount: 2500,
        household: 'solo', supportsOthers: false, transportMode: 'public', foodFrequency: 'mostdays', lifestyle: 'balanced', healthCover: 'partial', hasDebts: false, savingsOnHand: 6000, emergencyMonths: 3,
        hasGoal: true, goalKind: 'other', goalTarget: 45000, goalSaved: 0, goalTiming: 'by_date', goalMonths: 9, priorities: ['safety', 'goals'], zakatMode: 'no', retirement: 'employer', goalVsSafety: 'balanced', goalAdjust: 'extend', goalMonthsNew: 14 },
      rec: {} },
    karim: { id: 'karim', name: 'Karim', country: 'EG', cur: 'EGP', lang: 'en', level: 'profile', intent: 'save',
      title: 'Existing user, partial profile', sub: 'Egypt. Salary and household on file; rent last confirmed 14 months ago.',
      story: ['Married, my wife does not work. Rent went up to 9,500. I pay 1,400 a month in instalments and have 22,000 saved. I want to save more.',
        'متزوج وزوجتي لا تعمل. الإيجار أصبح ٩٥٠٠. أدفع أقساط ١٤٠٠ في الشهر ومدخراتي ٢٢ ألف. أريد أن أدخر أكثر.'],
      stale: { rent: { v: 9000, at: '2025-09' } },
      t: { income: 28000, incomeType: 'salary', incomeStability: 'fixed', jobSecurity: 'secure', payFrequency: 'monthly', payday: 25, housing: 'rent', rent: 9500, rentFreq: 'monthly', rentIncludesUtilities: false,
        household: 'couple', partnerRole: 'no_income', supportsOthers: false, transportMode: 'car', carOwnership: 'owned', foodFrequency: 'sometimes', lifestyle: 'balanced', healthCover: 'full', hasDebts: true, debtKinds: ['bnpl'], bnplMonthly: 1400, bnplLeft: 5, behind: false,
        savingsOnHand: 22000, emergencyMonths: 4, saveTarget: 'p20', saveObstacle: ['dining', 'unplanned'], lifeInsurance: false, hasGoal: false, priorities: ['safety', 'enjoy'], zakatMode: 'no', retirement: 'employer', annualKinds: ['car_yearly'], annualTotal: 9000 },
      rec: {} },
    salma: { id: 'salma', name: 'Salma', country: 'EG', cur: 'EGP', lang: 'en', level: 'full', intent: 'debt',
      title: 'Data-rich user', sub: 'Egypt. Six months of history, accounts, cards, bills, a loan and a goal.',
      story: ['I want to clear my credit card first and keep the Umrah goal on track.', 'أريد سداد بطاقتي الائتمانية أولًا والحفاظ على هدف العمرة.'],
      t: { income: 85000, incomeType: 'salary', incomeStability: 'fixed', jobSecurity: 'secure', payFrequency: 'monthly', payday: 28, housing: 'rent', rent: 16000, rentFreq: 'monthly', rentIncludesUtilities: true,
        household: 'family', dependents: 1, youngestChild: 'school', schoolFees: 3500, partnerRole: 'separate', supportsOthers: false, transportMode: 'car', carOverlap: 'listed', foodFrequency: 'mostdays', lifestyle: 'comfortable', healthCover: 'full',
        hasDebts: true, debtKinds: ['card', 'loan'], cardPayFull: false, cardBalance: 23500, cardMin: 2400, cardApr: 'over25', loanBalance: 310000, loanMin: 9800, loanApr: '15_25', behind: false, debtStrategy: 'avalanche', moreDebts: false,
        savingsOnHand: 180000, emergencyMonths: 6, hasGoal: true, goalKind: 'pilgrimage', goalTarget: 90000, goalSaved: 30000, goalTiming: 'by_date', goalMonths: 10, priorities: ['debt', 'goals'], zakatMode: 'yes_auto', retirement: 'employer', lifeInsurance: true, insurancePremium: 900, cashHeavy: false },
      rec: { sources: [{ name: 'Salary, CIB', amount: 85000 }], accounts: [{ name: 'CIB current', bal: 41000 }, { name: 'CIB savings', bal: 180000 }, { name: 'CIB credit card', bal: -23500 }],
        bills: [{ name: 'Internet', amount: 650, dueDay: 5, icon: 'wifi', essential: true }, { name: 'Electricity', amount: 900, dueDay: 12, icon: 'zap', essential: true }, { name: 'Mobile', amount: 400, dueDay: 1, icon: 'smartphone', essential: true }],
        subs: { count: 5, monthly: 1150 }, averages: { groceries: 9500, dining: 4200, transport: 3800, health: 1200, shopping: 3500, fun: 2600, family: 2000, other: 900 },
        debts: [{ id: 'd-card', name: 'CIB credit card', kind: 'credit_card', balance: 23500, minimum: 2400, apr: 34 }, { id: 'd-car', name: 'Car loan', kind: 'loan', balance: 310000, minimum: 9800, apr: 21 }],
        goals: [{ id: 'g-umrah', name: 'Umrah', target: 90000, saved: 30000, months: 10 }] } },
    omar: { id: 'omar', name: 'Omar', country: 'EG', cur: 'EGP', lang: 'ar', level: 'none', intent: 'goal',
      title: 'Variable-income freelancer', sub: 'Egypt. Income swings, supports parents, saving for a wedding.',
      story: ['I freelance. A normal month is about 45k but a slow month is 28k. Rent is 7,500. I send my parents 5,000 every month. I have 30,000 saved and I am saving for a wedding: 250,000 in 18 months.',
        'أعمل عمل حر. الشهر العادي حوالي ٤٥ ألف والشهر الضعيف ٢٨ ألف. الإيجار ٧٥٠٠. أرسل لأهلي ٥٠٠٠ كل شهر. مدخراتي ٣٠ ألف وأدخر للزواج: ٢٥٠ ألف خلال ١٨ شهر.'],
      t: { income: 45000, incomeType: 'freelance', lowMonth: 28000, taxSetAside: 'not_yet', taxPct: 10, housing: 'rent', rent: 7500, rentFreq: 'monthly', rentIncludesUtilities: false, household: 'solo', supportsOthers: true, supportAmount: 5000,
        transportMode: 'taxi', foodFrequency: 'mostdays', lifestyle: 'balanced', healthCover: 'none', healthCost: 600, chronicMeds: false, hasDebts: false, savingsOnHand: 30000, emergencyMonths: 6,
        hasGoal: true, goalKind: 'wedding', goalTarget: 250000, goalSaved: 40000, goalTiming: 'by_date', goalMonths: 18, goalAdjust: 'extend', goalMonthsNew: 30, goalVsSafety: 'balanced', cutFirst: ['dining', 'fun'], priorities: ['safety', 'goals', 'family'], zakatMode: 'no', retirement: 'none' },
      rec: {} },
    mona: { id: 'mona', name: 'Mona', country: 'EG', cur: 'EGP', lang: 'en', level: 'none', intent: 'debt',
      title: 'Financially constrained', sub: 'Egypt. Fixed costs and debt payments are larger than income.',
      story: ['I earn 19,000. Rent is 8,000 and I have two kids in school, about 2,500 a month. I owe 60,000 on a credit card and pay 4,200 a month, plus a loan of 150,000 at 6,300 a month and 1,800 in instalments. I have 3,000 saved. I would like a car for 400,000 next year.',
        'دخلي ١٩ ألف. الإيجار ٨٠٠٠ وعندي طفلين في المدرسة بحوالي ٢٥٠٠ في الشهر. عليّ ٦٠ ألف على بطاقة الائتمان وأدفع ٤٢٠٠ في الشهر، وقرض ١٥٠ ألف بقسط ٦٣٠٠ وأقساط ١٨٠٠. مدخراتي ٣٠٠٠. أريد سيارة بـ ٤٠٠ ألف السنة القادمة.'],
      t: { income: 19000, incomeType: 'salary', incomeStability: 'fixed', jobSecurity: 'uncertain', payFrequency: 'monthly', payday: 30, housing: 'rent', rent: 8000, rentFreq: 'monthly', rentIncludesUtilities: false,
        household: 'family', dependents: 2, youngestChild: 'school', schoolFees: 2500, partnerRole: 'no_partner', supportsOthers: false, transportMode: 'public', foodFrequency: 'rarely', lifestyle: 'minimal', healthCover: 'none', healthCost: 400, chronicMeds: false,
        hasDebts: true, debtKinds: ['card', 'loan', 'bnpl'], cardPayFull: false, cardBalance: 60000, cardMin: 4200, cardApr: 'over25', loanBalance: 150000, loanMin: 6300, loanApr: '15_25', bnplMonthly: 1800, bnplLeft: 4, behind: true, arrears: 3000, debtStrategy: 'avalanche',
        savingsOnHand: 3000, emergencyMonths: 3, lifeInsurance: false, hasGoal: true, goalKind: 'car', goalTarget: 400000, goalSaved: 0, goalTiming: 'by_date', goalMonths: 12, deficitPlan: ['refinance', 'pause_goals'], housingChange: 'stable',
        goalAdjust: 'extend', goalMonthsNew: 60, goalVsSafety: 'safety_first', cutFirst: ['dining', 'fun', 'shopping'], priorities: ['debt', 'safety'], zakatMode: 'no', retirement: 'none' },
      rec: {} },
    faisal: { id: 'faisal', name: 'Faisal and Reem', country: 'AE', cur: 'AED', lang: 'ar', level: 'full', intent: 'mixed',
      title: 'Gulf household, multi-currency', sub: 'UAE. Two salaries, rent income in USD, three children, family support, Tabby, yearly costs.',
      story: ['We want the school fees and rent cheques covered without surprises, and to keep saving for a home in Egypt.', 'نريد تغطية رسوم المدرسة وشيكات الإيجار بلا مفاجآت، ونستمر في الادخار لبيت في مصر.'],
      t: { income: 43200, incomeType: 'mixed', lowMonth: 41000, taxSetAside: 'not_needed', payFrequency: 'monthly', payday: 26, housing: 'rent', rent: 9167, rentFreq: 'monthly', rentIncludesUtilities: true,
        household: 'family', dependents: 3, youngestChild: 'school', schoolFees: 6500, partnerRole: 'shares', partnerSharePct: 100, supportsOthers: true, supportAmount: 2500, transportMode: 'car', carOverlap: 'listed', foodFrequency: 'sometimes', lifestyle: 'balanced', healthCover: 'full',
        hasDebts: true, debtKinds: ['loan', 'bnpl'], loanBalance: 74000, loanMin: 2900, loanApr: 'under15', bnplMonthly: 1150, bnplLeft: 4, behind: false, debtStrategy: 'balanced', moreDebts: false,
        savingsOnHand: 139000, emergencyMonths: 6, lifeInsurance: true, insurancePremium: 450, hasGoal: true, goalKind: 'house', houseScope: 'down_payment', goalTarget: 300000, goalSaved: 120000, goalTiming: 'by_date', goalMonths: 48,
        annualKinds: ['car_yearly', 'travel'], annualTotal: 4200, priorities: ['family', 'goals', 'safety'], zakatMode: 'yes_auto', retirement: 'self', retirementAmount: 800, investing: 'want_to' },
      rec: { sources: [{ name: 'Faisal salary', amount: 27000 }, { name: 'Reem salary', amount: 14000 }, { name: 'Flat rent, Cairo', amount: 600, cur: 'USD' }],
        accounts: [{ name: 'Emirates NBD current', bal: 18000 }, { name: 'Emirates NBD savings', bal: 95000 }, { name: 'USD account', bal: 12000, cur: 'USD' }, { name: 'Tabby', bal: -4600 }],
        bills: [{ name: 'Rent (4 cheques a year)', amount: 9167, dueDay: 1, icon: 'house', essential: true, expenseCategories: ['Rent'] }, { name: 'DEWA', amount: 850, dueDay: 15, icon: 'zap', essential: true }, { name: 'du internet and mobile', amount: 620, dueDay: 3, icon: 'wifi', essential: true },
          { name: 'School fees (3 terms)', amount: 6500, dueDay: null, icon: 'graduation-cap', essential: true }, { name: 'Family support', amount: 2500, dueDay: 28, icon: 'hand-heart', essential: true }],
        billRent: true, subs: { count: 6, monthly: 310 }, averages: { groceries: 3400, dining: 1500, transport: 1600, health: 500, shopping: 1400, fun: 1100, family: 1500, other: 400 },
        debts: [{ id: 'd-car', name: 'Car loan', kind: 'loan', balance: 74000, minimum: 2900, apr: 4.5 }, { id: 'd-tabby', name: 'Tabby', kind: 'installment', balance: 4600, minimum: 1150, apr: 0 }],
        goals: [{ id: 'g-home', name: 'Home in Egypt', target: 300000, saved: 120000, months: 48 }, { id: 'g-flights', name: 'Summer flights', target: 18000, saved: 4000, months: 8 }],
        annualMonthly: 350, zakat: true } },
  }
  const MONEY_T = ['income', 'lowMonth', 'rent', 'mortgagePayment', 'propertyCosts', 'supportAmount', 'schoolFees', 'childcare', 'healthCost', 'cardBalance', 'cardMin', 'loanBalance', 'loanMin', 'bnplMonthly', 'familyOwed', 'familyMonthly', 'arrears', 'savingsOnHand', 'goalTarget', 'goalSaved', 'annualTotal', 'carPayment', 'zakatAmount', 'familyContributionAmount', 'insurancePremium', 'retirementAmount', 'saveCustom']

  /** A persona with the lab's controls applied. Controls are optional; anything left undefined keeps the persona's own value. */
  function tweak(p0, c) {
    const p = clone(p0)
    c = c || {}
    const rec = p.rec, t = p.t
    const set = (k, v) => { if (v !== undefined && v !== null && v !== '') t[k] = v }
    if (c.level) p.level = c.level
    if (c.conflictRent) p.conflictRent = c.conflictRent
    if (c.country && c.country !== p.country) p.country = c.country
    if (c.cur && c.cur !== p.cur) {
      const k = (x) => Math.round(convert(x, p.cur, c.cur) / 10) * 10
      for (const id of MONEY_T) if (typeof t[id] === 'number') t[id] = k(t[id])
      for (const b of rec.bills || []) b.amount = k(b.amount)
      if (rec.subs) rec.subs.monthly = k(rec.subs.monthly)
      for (const d of rec.debts || []) { d.balance = k(d.balance); d.minimum = k(d.minimum) }
      for (const g of rec.goals || []) { g.target = k(g.target); g.saved = k(g.saved) }
      for (const a of rec.accounts || []) if (!a.cur) a.bal = k(a.bal)
      for (const s of rec.sources || []) if (!s.cur) s.amount = k(s.amount)
      if (rec.averages) for (const key of Object.keys(rec.averages)) rec.averages[key] = k(rec.averages[key])
      if (rec.annualMonthly) rec.annualMonthly = k(rec.annualMonthly)
      if (p.stale) for (const s of Object.values(p.stale)) s.v = k(s.v)
      p.cur = c.cur
    }
    if (c.income !== undefined) { const ratio = t.income > 0 ? c.income / t.income : 1; t.income = c.income; if (t.lowMonth) t.lowMonth = Math.round(t.lowMonth * ratio); for (const s of rec.sources || []) s.amount = Math.round(s.amount * ratio) }
    if (c.stability === 'fixed') { t.incomeType = 'salary'; t.incomeStability = 'fixed'; delete t.lowMonth }
    if (c.stability === 'variable') { t.incomeType = 'freelance'; t.lowMonth = c.lowMonth !== undefined ? c.lowMonth : t.lowMonth || Math.round(t.income * 0.5); if (!t.taxSetAside) { t.taxSetAside = 'not_yet'; t.taxPct = 10 } }
    else if (c.lowMonth !== undefined && t.lowMonth) t.lowMonth = c.lowMonth
    if (c.housing !== undefined) {
      if (t.housing === 'rent') { t.rent = c.housing; const b = (rec.bills || []).find((x) => /^Rent/.test(x.name)); if (b) b.amount = c.housing }
      else if (t.housing === 'family') { t.familyContribution = c.housing > 0; t.familyContributionAmount = c.housing }
      else if (t.housing === 'own') t.mortgagePayment = c.housing
    }
    if (c.household) { t.household = c.household; if (c.household !== 'family') { delete t.dependents; delete t.youngestChild; delete t.schoolFees } }
    if (c.dependents !== undefined && t.household === 'family') { t.dependents = Math.max(1, c.dependents); if (!t.youngestChild) t.youngestChild = 'school' }
    set('savingsOnHand', c.savings)
    if (c.debtBalance !== undefined) {
      if (c.debtBalance <= 0) { t.hasDebts = false; delete t.debtKinds; rec.debts = [] }
      else {
        t.hasDebts = true
        const kinds = t.debtKinds && t.debtKinds.length ? t.debtKinds : (t.debtKinds = ['card'])
        const k = kinds.includes('card') ? 'card' : kinds.includes('loan') ? 'loan' : (kinds.push('card'), 'card')
        t[k + 'Balance'] = c.debtBalance
        if (k === 'card') t.cardPayFull = false
        if (c.debtMin !== undefined) t[k + 'Min'] = c.debtMin
        else if (!t[k + 'Min']) t[k + 'Min'] = Math.round(c.debtBalance * 0.05)
        if (c.debtApr !== undefined) t[k + 'Apr'] = c.debtApr < 15 ? 'under15' : c.debtApr <= 25 ? '15_25' : 'over25'
        const d = (rec.debts || [])[0]
        if (d) { d.balance = c.debtBalance; if (c.debtMin !== undefined) d.minimum = c.debtMin; if (c.debtApr !== undefined) d.apr = c.debtApr }
        else if (rec.debts) rec.debts.push({ id: 'd-lab', name: 'Card', kind: 'credit_card', balance: c.debtBalance, minimum: t[k + 'Min'], apr: c.debtApr === undefined ? 30 : c.debtApr })
      }
    }
    if (c.subs !== undefined) rec.subs = { count: c.subs > 0 ? Math.max(1, (rec.subs || {}).count || 3) : 0, monthly: c.subs }
    if (c.lifestyle) t.lifestyle = c.lifestyle
    if (c.spend !== undefined) rec.spend = c.spend
    if (c.goalTarget !== undefined) {
      if (c.goalTarget <= 0) { t.hasGoal = false; rec.goals = [] }
      else { t.hasGoal = true; t.goalKind = t.goalKind || 'other'; t.goalTarget = c.goalTarget; t.goalTiming = 'by_date'; if (!t.goalMonths) t.goalMonths = 12; if (rec.goals && rec.goals[0]) rec.goals[0].target = c.goalTarget; else if (rec.goals) rec.goals.push({ id: 'g-lab', name: 'Goal', target: c.goalTarget, saved: 0, months: t.goalMonths }) }
    }
    if (c.goalMonths !== undefined && t.hasGoal) { t.goalMonths = c.goalMonths; if (rec.goals && rec.goals[0]) rec.goals[0].months = c.goalMonths }
    if (c.accounts !== undefined && rec.accounts) rec.accounts = rec.accounts.slice(0, Math.max(1, c.accounts))
    return p
  }

  /** What the app holds for this person at their data level: base facts, remembered answers, and the `known` map the real graph reads. */
  function hydrate(p) {
    const f = emptyFacts(p.country, p.cur), t = p.t, rec = p.rec || {}, remembered = {}
    const meta = {} // id -> { src: 'records' | 'profile', at }
    const stale = p.level === 'none' ? {} : clone(p.stale || {})
    if (p.level !== 'none') {
      f.monthlyIncome = t.income; meta.income = { src: 'records', at: '2026-10' }
      f.household = t.household; f.dependents = t.dependents || 0; f.known = new Set(['household'])
      meta.household = { src: 'profile', at: '2026-08' }; if (f.dependents) meta.dependents = { src: 'profile', at: '2026-08' }
      f.housing = t.housing; meta.housing = { src: 'profile', at: '2026-08' }
      if (t.housing === 'rent' && !stale.rent && !rec.billRent) { f.rent = t.rent; meta.rent = { src: 'profile', at: '2026-08' } }
      for (const id of ['incomeType', 'payFrequency', 'payday']) if (t[id] !== undefined) { remembered[id] = t[id]; meta[id] = { src: 'profile', at: '2026-08' } }
      if (t.incomeType === 'salary') { f.known.add('incomeStability'); f.incomeStability = t.incomeStability || 'fixed'; meta.incomeStability = { src: 'profile', at: '2026-08' } }
    }
    if (p.level === 'full') {
      const bench = R.getBenchmark(f.country, f.baseCurrency)
      f.bills = clone(rec.bills || [])
      if (rec.billRent) { f.rent = null; remembered.rent = t.rent; remembered.rentFreq = 'monthly'; meta.rent = { src: 'records', at: '2026-11' } }
      f.rentIncludesUtilities = true; f.known.add('rentIncludesUtilities'); meta.rentIncludesUtilities = { src: 'records', at: '2026-11' }
      f.subscriptionsMonthly = (rec.subs || {}).monthly || 0; f.subscriptionCount = (rec.subs || {}).count || 0
      f.debts = clone(rec.debts || [])
      f.goals = (rec.goals || []).map((g, i) => ({ id: g.id, name: g.name, monthly: Math.round(Math.max(0, g.target - g.saved) / g.months), targetAmount: g.target, saved: g.saved, targetDate: null, priority: i + 1, icon: 'target' }))
      f.liquidSavings = t.savingsOnHand || 0; meta.savingsOnHand = { src: 'records', at: '2026-11' }
      f.transportMode = t.transportMode || null; f.hasCar = t.transportMode === 'car'; f.foodFrequency = t.foodFrequency || null
      f.lifestyle = t.lifestyle || 'balanced'; f.known.add('lifestyle'); f.supportsOthers = !!t.supportsOthers; f.known.add('supportsOthers'); f.cashHeavy = !!t.cashHeavy
      for (const id of ['transportMode', 'foodFrequency', 'lifestyle', 'supportsOthers', 'cashHeavy']) meta[id] = { src: 'records', at: '2026-11' }
      const typical = rec.averages || R.benchmarkEveryday(bench, f, f.monthlyIncome)
      f.averages = Object.fromEntries(Object.entries(typical).map(([k, v]) => [k, Math.round((v * (rec.spend || 1)) / 10) * 10]))
      f.averageCycles = 6; f.ledgerRent = t.rent
      if (rec.annualMonthly) f.annualMonthly = rec.annualMonthly
      if (rec.zakat) f.zakatMonthly = Math.round((f.liquidSavings * 0.025) / 12)
      if (t.incomeType !== 'salary' && t.lowMonth) { f.incomeStability = t.incomeType === 'mixed' ? 'mixed' : 'variable'; f.incomeFloor = t.lowMonth; meta.lowMonth = { src: 'records', at: '2026-11' } }
      for (const id of ['emergencyMonths', 'youngestChild', 'schoolFees', 'partnerRole', 'partnerSharePct', 'healthCover', 'lifeInsurance', 'insurancePremium', 'retirement', 'retirementAmount', 'zakatMode', 'taxSetAside', 'carOverlap', 'jobSecurity', 'annualKinds', 'annualTotal', 'supportAmount', 'investing'])
        if (t[id] !== undefined) { remembered[id] = t[id]; meta[id] = { src: 'profile', at: '2026-09' } }
      if (rec.bills && rec.bills.some((b) => /School/.test(b.name))) { delete remembered.schoolFees; remembered.schoolFees = 0 }
      if (rec.bills && rec.bills.some((b) => /support/i.test(b.name))) remembered.supportAmount = 0
    }
    if (p.conflictRent && p.level === 'full') { f.rent = t.rent; f.ledgerRent = p.conflictRent; meta.rent = { src: 'profile', at: '2026-08' } }
    const known = R.knownFromStore(f, { budgetProfile: remembered })
    return { base: f, remembered, known, meta, stale }
  }

  /** The real graph, walked with this person's own answers. Returns each screen asked and why the others never appeared. */
  function autoWalk(p, mode) {
    const h = hydrate(p)
    let s = R.createFlow(p.intent || 'mixed', h.known)
    const asked = []
    for (const [id, st] of Object.entries(h.stale)) { asked.push({ head: id, ids: [id], skipped: [], kind: 'stale' }); s = R.answer(s, id, p.t[id] !== undefined ? p.t[id] : st.v) }
    let guard = 0
    while (guard++ < 120) {
      const q = nextFor(s, mode)
      if (!q) break
      const ids = []
      for (const x of R.screenNodes(s, q, {}, [])) ids.push(x.id)
      let acc = s
      const local = [], skips = []
      for (let i = 0; i < 12; i++) {
        const open = R.screenNodes(acc === s ? s : s, q, Object.fromEntries(local), skips)
        const nxt = open.find((x) => !local.some(([k]) => k === x.id) && !skips.includes(x.id))
        if (!nxt) break
        const v = nxt.control === 'confirm' ? true : p.t[nxt.id]
        if (v === undefined) skips.push(nxt.id); else local.push([nxt.id, v])
      }
      for (const [k, v] of local) acc = R.answer(acc, k, v)
      for (const k of skips) acc = R.skip(acc, k)
      asked.push({ head: q.id, ids: [...local.map(([k]) => k), ...skips], skipped: skips, kind: q.control === 'confirm' ? 'confirm' : q.needs ? 'check' : q.tier })
      s = R.pruneInapplicable(acc)
    }
    return { flow: s, asked, hyd: h, knownIds: Object.keys(h.known).filter((k) => R.NODE_BY_ID.has(k)), readiness: R.flowReadiness(s) }
  }
  /**
   * The next screen for a mode. Guided walks the whole graph. "AI builds it" asks only what blocks a first draft:
   * confirmations of what the app found, a conflict in the records, then income and housing if they are still unknown.
   */
  function nextFor(s, mode) {
    const q = R.nextQuestion(s)
    if (mode !== 'ai') return q
    if (q && q.control === 'confirm') return q
    const open = (id) => s.a[id] === undefined && s.known[id] === undefined && !s.skipped.includes(id)
    if (s.known.rentConflict === true && open('rentCheck') && (s.a.housing || s.known.housing) === 'rent') return R.NODE_BY_ID.get('rentCheck')
    if (open('income')) return R.NODE_BY_ID.get('income')
    if (open('housing')) return R.NODE_BY_ID.get('housing')
    return undefined
  }

  /** Facts the engine runs on: what the app holds, overlaid with this run's answers. */
  function factsOf(h, flow) {
    const a = { ...h.remembered, ...flow.a }
    const base = { ...h.base }
    // applyAnswers only reads a rent when the housing answer travels with it; a person whose housing is on file answers rent alone.
    if (a.housing === undefined && base.housing && (flow.a.rent !== undefined || flow.a.rentCheck !== undefined)) a.housing = base.housing
    // "That's not right" on a confirmation card drops the records behind it, exactly as the graph drops what it knew.
    if (flow.a.confirmDebts === false) base.debts = []
    if (flow.a.confirmGoals === false) base.goals = []
    if (flow.a.confirmBills === false) { base.bills = []; base.subscriptionsMonthly = 0; base.subscriptionCount = 0 }
    if (flow.a.confirmIncome === false && flow.a.income === undefined) base.monthlyIncome = 0
    return R.applyAnswers(base, a, flow.intent)
  }

  const lineKey = (l) => `${l.block}:${l.name.trim().toLowerCase()}`
  const RULE_NAMES = ['Safety net', 'Buffer', 'Tax reserve', 'Investing', 'Retirement']
  /** Where a line's amount came from, for the source tag on every row. */
  function lineSource(l, h, flow) {
    if (l.custom) return 'you'
    if (/^Yearly/.test(l.name)) return h.base.annualMonthly > 0 ? 'records' : 'you'
    if (l.confidence === 'estimated' && !RULE_NAMES.includes(l.name)) return 'estimate'
    if (RULE_NAMES.includes(l.name) || /^Extra payoff/.test(l.name)) return l.name === 'Retirement' && /own retirement/.test(l.rationale) ? 'you' : 'rule'
    if ((l.linkIds || []).some((id) => !/^answered-/.test(id)) || l.linkType === 'subscriptions') return 'records'
    if (h.base.bills.some((b) => b.name === l.name)) return 'records'
    if (l.block === 'everyday') return 'records'
    if (l.name === 'Rent' && h.meta.rent && flow.a.rent === undefined) return h.meta.rent.src === 'records' ? 'records' : 'you'
    if (/^Zakat/.test(l.name) && h.base.zakatMonthly > 0) return 'records'
    return flow.ai && flow.ai.includes(l.name) ? 'ai' : 'you'
  }

  function plan(h, flow) {
    const f = factsOf(h, flow)
    const d = R.buildPlan(f)
    const lines = d.lines.map((l) => ({ ...l, key: lineKey(l), suggested: l.amount, src: lineSource(l, h, flow) }))
    return { ...d, lines, facts: f }
  }

  /* ---------------------------------------------------------------- draft edits (prototype stand-in for ops.applyOps + validate.repairDraft) */
  const WANT_ORDER = ['everyday:fun', 'everyday:shopping', 'everyday:dining out', 'everyday:other', 'everyday:family']
  const TRIM_ORDER = [...WANT_ORDER, 'grow:investing', 'grow:retirement', 'safety:safety net', 'grow:yearly costs', 'everyday:transport', 'everyday:health', 'everyday:groceries']
  const isBuffer = (l) => l.key === 'grow:buffer'

  /** The plan the person sees: engine lines with their edits, locks, removals and own lines. What is left is the buffer; more than income is "over". */
  function settle(p, d) {
    d = d || {}
    const ov = d.ov || {}, removed = d.removed || []
    const lines = p.lines.filter((l) => !isBuffer(l) && !removed.includes(l.key)).map((l) => {
      const o = ov[l.key]
      return o ? { ...l, amount: o.amount == null ? l.amount : o.amount, locked: !!o.locked, edited: o.amount != null && o.amount !== l.suggested } : l
    })
    for (const c of d.custom || []) { const o = ov[c.key] || {}; lines.push({ block: 'bills', icon: 'receipt', linkType: 'none', linkIds: [], essential: false, isSavings: false, confidence: 'high', rationale: 'A line you added', src: 'you', custom: true, suggested: c.amount, ...c, amount: o.amount == null ? c.amount : o.amount, locked: !!o.locked }) }
    const income = d.income != null ? d.income : p.income
    const left = income - sum(lines.map((l) => l.amount))
    if (left > 0) lines.push({ key: 'grow:buffer', block: 'grow', name: 'Buffer', icon: 'wallet', amount: left, suggested: left, linkType: 'none', linkIds: [], essential: false, isSavings: true, confidence: 'estimated', src: 'rule', rationale: 'What is left after every other job, so no money is unassigned', locked: !!(ov['grow:buffer'] || {}).locked })
    return { ...p, income, lines, over: Math.max(0, -left), buffer: Math.max(0, left), total: sum(lines.map((l) => l.amount)) }
  }
  const floorOf = (l) => (l.block === 'everyday' && l.essential ? Math.round(l.suggested * 0.7) : 0)
  /** Brings an over-income plan back to zero: wants, then growth and the safety net, then essentials down to 70%. Locked and linked lines are never touched. */
  function rebalance(st, d) {
    const ov = { ...(d.ov || {}) }
    let left = st.over
    const cut = (l, floor) => { if (left <= 0 || !l || l.locked) return; const c = Math.min(left, Math.max(0, l.amount - floor)); if (c > 0) { ov[l.key] = { ...(ov[l.key] || {}), amount: l.amount - c }; left -= c } }
    for (const key of TRIM_ORDER) cut(st.lines.find((x) => x.key === key), key.startsWith('everyday') ? floorOf(st.lines.find((x) => x.key === key) || {}) : 0)
    for (const l of st.lines.filter((x) => x.block === 'goals')) cut(l, 0)
    for (const l of st.lines.filter((x) => /^debts:extra payoff/.test(x.key))) cut(l, 0)
    return { ov, unresolved: Math.max(0, Math.round(left)) }
  }

  /* ---------------------------------------------------------------- outcome metrics */
  const ASSUMED_APR = { credit_card: 25, personal: 12, loan: 12, installment: 0 }
  const aprOf = (d) => (d.apr != null ? d.apr : ASSUMED_APR[d.kind] || 0)
  /** Month by month: every debt gets its payment, the extra (and payments freed as debts clear) roll onto the next target. */
  function simulatePayoff(debts, extra, strategy) {
    const ds = debts.filter((d) => d.balance > 0).map((d) => ({ ...d, bal: d.balance }))
    if (ds.length === 0) return { months: 0, interest: 0 }
    const order = (xs) => [...xs].sort((a, b) => (strategy === 'snowball' ? a.bal - b.bal : aprOf(b) - aprOf(a) || a.bal - b.bal))
    let months = 0, interest = 0
    while (ds.some((d) => d.bal > 0.5) && months < 600) {
      months++
      let pool = extra
      for (const d of ds) {
        if (d.bal <= 0.5) { pool += d.minimum; continue }
        const i = (d.bal * aprOf(d)) / 1200
        interest += i
        d.bal = d.bal + i - Math.min(d.minimum, d.bal + i)
      }
      for (const d of order(ds.filter((x) => x.bal > 0.5 && x.kind !== 'installment'))) { const pay = Math.min(pool, d.bal); d.bal -= pay; pool -= pay; if (pool <= 0) break }
    }
    return { months: months >= 600 ? null : months, interest: Math.round(interest) }
  }
  function metrics(st) {
    const f = st.facts, L = st.lines
    const amt = (pred) => sum(L.filter(pred).map((l) => l.amount))
    const essentials = amt((l) => l.essential && !l.isSavings)
    const mustPay = amt((l) => l.block === 'bills' || l.block === 'subscriptions' || l.block === 'debts')
    const bare = amt((l) => (l.block === 'bills' && l.essential) || (l.block === 'debts' && !/^Extra payoff/.test(l.name))) + sum(L.filter((l) => l.block === 'everyday' && l.essential).map((l) => Math.min(l.amount, Math.round(l.suggested * 0.7))))
    const extra = amt((l) => /^Extra payoff/.test(l.name) || l.key === 'debts:extra debt payment')
    const debts = f.debts.filter((d) => d.balance > 0)
    const pay = simulatePayoff(debts, extra, f.debtStrategy), payMin = simulatePayoff(debts, 0, f.debtStrategy)
    const goals = f.goals.map((g) => {
      const l = L.find((x) => (x.linkIds || []).includes(g.id)), funded = l ? l.amount : 0
      const left = Math.max(0, (g.targetAmount || 0) - g.saved), want = g.monthly > 0 ? Math.round(left / g.monthly) : null
      const months = left === 0 ? 0 : funded > 0 ? Math.ceil(left / funded) : null
      return { id: g.id, name: g.name, need: Math.round(g.monthly), funded, want, months, onTime: left === 0 || (months !== null && want !== null && months <= want) }
    })
    const g = { income: st.income, mustPay, essentials, bills: amt((l) => l.block === 'bills' || l.block === 'subscriptions'), everyday: amt((l) => l.block === 'everyday'), debt: amt((l) => l.block === 'debts'),
      safety: amt((l) => l.block === 'safety'), goals: amt((l) => l.block === 'goals'), aside: amt((l) => l.block === 'grow' && !isBuffer(l) && l.name !== 'Investing' && l.name !== 'Retirement'), grow: amt((l) => l.name === 'Investing' || l.name === 'Retirement'), buffer: st.buffer || 0 }
    return { ...g, saving: g.safety + g.goals + g.grow + g.buffer, monthsHeld: essentials > 0 ? f.liquidSavings / essentials : 0, runway: bare > 0 ? f.liquidSavings / bare : 0, bare, hasDebt: debts.length > 0,
      debtFree: pay.months, debtFreeMin: payMin.months, interest: pay.interest, interestMin: payMin.interest, extra, goalsOut: goals, over: st.over || 0, estimated: L.filter((l) => l.src === 'estimate').length }
  }

  /* ---------------------------------------------------------------- what-if scenarios: a copy of the facts with one thing changed */
  const SCENARIOS = ['incomeDrop', 'jobLoss', 'rentUp', 'newDebt', 'newGoal', 'debtFast', 'saveMore', 'moreFun', 'moveOut']
  function scenario(f0, id) {
    const f = { ...clone({ ...f0, known: undefined }), known: f0.known }
    const inc = f0.monthlyIncome || 0
    const up = (n) => { let hit = false; if (f.rent) { f.rent = Math.round(f.rent * n); hit = true } for (const b of f.bills) if (/^Rent/.test(b.name)) { b.amount = Math.round(b.amount * n); hit = true } for (const c of f.extraCommitments || []) if (/Household/.test(c.name)) { c.amount = Math.round(c.amount * n); hit = true } return hit }
    switch (id) {
      case 'incomeDrop': f.monthlyIncome = Math.round(inc * 0.8); if (f.incomeFloor) f.incomeFloor = Math.round(f.incomeFloor * 0.8); break
      case 'jobLoss': f.monthlyIncome = 0; f.incomeFloor = null; f.incomeStability = 'fixed'; break
      case 'rentUp': up(1.15); break
      case 'newDebt': { const bal = Math.round((inc * 2) / 100) * 100; f.debts.push({ id: 'whatif-debt', name: 'New loan', kind: 'loan', balance: bal, minimum: Math.round((bal / 24) * 1.13), apr: 24 }); break }
      case 'newGoal': { const target = Math.round((inc * 3) / 100) * 100; f.goals.push({ id: 'whatif-goal', name: 'New goal', monthly: Math.round(target / 12), targetAmount: target, saved: 0, targetDate: null, priority: 9, icon: 'target' }); break }
      case 'debtFast': { f.priorities = ['debt', ...f.priorities.filter((p) => p !== 'debt')]; f.debtStrategy = 'avalanche'; f.securityLean = 15; const open = f.debts.filter((d) => d.balance > 0 && d.kind !== 'installment'); if (open.length) f.debtExtra = Math.ceil(Math.max(...open.map((d) => d.balance)) / 12); break }
      case 'saveMore': f.saveTargetPct = 0.2; f.securityLean = 10; break
      case 'moreFun': f.securityLean = 100; f.lifestyle = f.lifestyle === 'minimal' ? 'balanced' : 'comfortable'; for (const k of ['dining', 'fun', 'shopping']) if (f.averages[k]) f.averages[k] = Math.round(f.averages[k] * 1.25); break
      case 'moveOut': { const paysNow = f.housing === 'rent' || f.housing === 'own' || f.bills.some((b) => /^Rent/.test(b.name)); const rent = f.rent || (f.bills.find((b) => /^Rent/.test(b.name)) || {}).amount || Math.round((inc * 0.28) / 100) * 100
        f.goals.push({ id: 'whatif-goal', name: 'Move-out fund', monthly: Math.round((rent * 3) / 6), targetAmount: rent * 3, saved: 0, targetDate: null, priority: 0, icon: 'house' }); f._after = { rent, paysNow }; break }
    }
    return f
  }
  /** After the six months of saving for the move: the same person in the new home. */
  function afterMove(f0) {
    const f = { ...clone({ ...f0, known: undefined }), known: f0.known }
    f.goals = f.goals.filter((g) => g.id !== 'whatif-goal')
    if (!f._after.paysNow) { f.housing = 'rent'; f.rent = f._after.rent; f.rentIncludesUtilities = false; f.extraCommitments = (f.extraCommitments || []).filter((c) => !/Household/.test(c.name)) }
    else if (f.rent) f.rent = Math.round(f.rent * 1.1)
    else for (const b of f.bills) if (/^Rent/.test(b.name)) b.amount = Math.round(b.amount * 1.1)
    return f
  }
  function runScenario(st, id, h, flow) {
    const f = scenario(st.facts, id)
    const d = R.buildPlan(f)
    const sc = settle({ ...d, lines: d.lines.map((l) => ({ ...l, key: lineKey(l), suggested: l.amount, src: lineSource(l, h, flow) })), facts: f }, {})
    const out = { id, base: metrics(st), sc: metrics(sc), plan: sc }
    if (id === 'jobLoss') { const burn = out.base.bare; out.job = { burn, after: Math.round(st.facts.liquidSavings - 2 * burn), runway: burn > 0 ? st.facts.liquidSavings / burn : 0 } }
    if (id === 'moveOut') { const f2 = afterMove(f), d2 = R.buildPlan(f2); out.after = metrics(settle({ ...d2, lines: d2.lines.map((l) => ({ ...l, key: lineKey(l), suggested: l.amount, src: 'you' })), facts: f2 }, {})); out.afterRent = f._after.paysNow ? Math.round(f._after.rent * 1.1) : f._after.rent }
    return out
  }

  /* ---------------------------------------------------------------- simulated AI: reading a description (stands in for Gemini; output goes through the real validator) */
  const toLatin = (s) => s.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/٬|،/g, ',')
  const NUM = '(\\d{1,3}(?:[,.]\\d{3})+|\\d+(?:\\.\\d+)?)\\s*(k\\b|thousand|alf|ألف|الف|آلاف|m\\b|million|مليون)?'
  const toNum = (n, unit) => { let v = Number(n.replace(/[,.](?=\d{3}\b)/g, '').replace(',', '')); if (unit) v *= /^(m|million|مليون)$/i.test(unit) ? 1e6 : 1000; return Math.round(v) }
  function readSituation(text0, cur) {
    const text = ' ' + toLatin(text0).toLowerCase() + ' '
    const raw = {}
    const after = (kw, gap) => { const m = new RegExp('(?:' + kw + ')[^0-9]{0,' + (gap || 28) + '}' + NUM, 'i').exec(text); return m ? toNum(m[1], m[2]) : undefined }
    const before = (kw) => { const m = new RegExp(NUM + '[^0-9.]{0,14}(?:' + kw + ')', 'i').exec(text); return m ? toNum(m[1], m[2]) : undefined }
    const has = (kw) => new RegExp(kw, 'i').test(text)
    const put = (k, v) => { if (v !== undefined) raw[k] = v }
    put('income', after('i make|i earn|earn|salary|take home|income of|normal month|راتبي|مرتبي|دخلي|الشهر العادي'))
    if (has('freelanc|عمل حر|فريلانس')) raw.incomeType = 'freelance'
    else if (has('my own business|i run a|نشاطي|شركتي')) raw.incomeType = 'business'
    else if (has('salary|راتب|مرتب')) raw.incomeType = 'salary'
    put('lowMonth', after('slow month|bad month|worst month|low month|الشهر الضعيف|أسوأ شهر'))
    const rent = after('\\brent\\b(?! income)|الإيجار|الايجار|إيجار', 22) || before('in rent|for rent')
    if (rent !== undefined) { raw.housing = 'rent'; raw.rent = rent }
    else if (has('with my (parents|family)|with (parents|family)|مع أهلي|مع اهلي|مع العائلة')) raw.housing = 'family'
    else if (has('mortgage|قسط عقاري')) { raw.housing = 'own'; raw.ownType = 'mortgage'; put('mortgagePayment', after('mortgage|قسط عقاري')) }
    else if (has('own my (home|house|flat|apartment)|بيتي ملك|شقتي ملك')) { raw.housing = 'own'; raw.ownType = 'paid_off' }
    const kids = /(\d+|one|two|three|four)\s+(?:kids|children|child)/.exec(text) || /(\d+)\s*(?:أطفال|اولاد|أولاد)/.exec(text)
    if (kids) { raw.household = 'family'; raw.dependents = { one: 1, two: 2, three: 3, four: 4 }[kids[1]] || Number(kids[1]) }
    else if (has('طفلين|ولدين')) { raw.household = 'family'; raw.dependents = 2 }
    else if (has('married|my wife|my husband|متزوج|زوجتي|زوجي')) raw.household = 'couple'
    if (raw.dependents && has('school|المدرسة|مدرسة')) { raw.youngestChild = 'school'; put('schoolFees', after('school|المدرسة|مدرسة', 40)) }
    const give = after('give them|send (?:my )?(?:parents|family|mother|father)[^0-9]{0,12}|support my (?:parents|family)|أرسل لأهلي|ارسل لاهلي|أعطيهم|اعطيهم|أساعد أهلي')
    if (give !== undefined) { if (raw.housing === 'family') { raw.familyContribution = true; raw.familyContributionAmount = give } else { raw.supportsOthers = true; raw.supportAmount = give } }
    const card = before('on (?:a |my )?(?:credit )?card|على بطاقة|على البطاقة|على بطاقتي') || after('credit card|on a card|on my card|بطاقة الائتمان|بطاقتي|الفيزا', 34)
    if (card !== undefined) { raw.cardBalance = card; raw.cardPayFull = false; const m = new RegExp('(?:credit card|card|بطاقة)[^.]*?(?:pay|paying|minimum|وأدفع|أدفع)[^0-9]{0,10}' + NUM, 'i').exec(text); if (m) raw.cardMin = toNum(m[1], m[2]) }
    const loan = after('loan of|a loan|loan|قرض', 22)
    if (loan !== undefined) { raw.loanBalance = loan; const m = new RegExp('(?:loan|قرض)[^.]*?(?:\\bat\\b|pay|paying|بقسط|قسط)[^0-9]{0,10}' + NUM, 'i').exec(text); if (m) raw.loanMin = toNum(m[1], m[2]) }
    const bnpl = before('in instal?ments|a month in instal?ments|on tabby|on tamara|on valu') || after('instal?ments of|tabby|tamara|valu|أقساط|اقساط', 18)
    if (bnpl !== undefined && bnpl !== loan) raw.bnplMonthly = bnpl
    if (has('no debts?|debt[- ]free|owe nothing|لا ديون|مفيش ديون|بلا ديون')) raw.hasDebts = false
    const saved = before('saved|in savings') || after('savings of|saved up|مدخراتي|مدّخراتي|ادخرت', 16)
    if (saved !== undefined) raw.savingsOnHand = saved
    else if (has('no savings|nothing saved|لا مدخرات')) raw.savingsOnHand = 0
    const GOALS = [['car', 'car|سيارة|عربية'], ['house', 'house|home|apartment|flat|بيت|شقة'], ['wedding', 'wedding|زواج|فرح'], ['vacation', 'trip|vacation|travel|holiday|سفر|رحلة'], ['pilgrimage', 'umrah|hajj|عمرة|حج'], ['education', 'degree|tuition|masters|دراسة'], ['business', 'start a business|مشروع'], ['other', 'laptop|phone|لابتوب|هاتف']]
    for (const [kind, kw] of GOALS) {
      const m = new RegExp('(?:want|would like|saving for|save for|buy|أريد|عايز|أدخر|هدفي)[^.0-9]{0,24}(?:' + kw + ')[^0-9]{0,22}' + NUM, 'i').exec(text)
      if (!m) continue
      raw.hasGoal = true; raw.goalKind = kind; raw.goalTarget = toNum(m[1], m[2])
      const tail = text.slice(m.index)
      const mo = /(?:in|خلال)\s+(\d+)\s*(months?|years?|شهر|شهور|أشهر|سنة|سنين|سنوات)/.exec(tail)
      if (mo) raw.goalMonths = Number(mo[1]) * (/year|سن/.test(mo[2]) ? 12 : 1)
      else if (/next year|السنة القادمة/.test(tail)) raw.goalMonths = 12
      break
    }
    if (has('my car|i drive|سيارتي|عربيتي')) raw.transportMode = 'car'
    const found = R.parseSituation(raw)
    const intent = has('pay off|clear my|debt first|سداد|أسدد') ? 'debt' : found.hasGoal ? 'goal' : has('save more|ادخر أكثر|أدخر أكثر') ? 'save' : null
    // A figure that cannot be a monthly income in this currency is flagged, never silently accepted.
    const floor = { EGP: 2000, AED: 800, SAR: 800, USD: 200, EUR: 200, GBP: 200 }[cur] || 200
    const flags = found.income !== undefined && (found.income < floor || found.income > floor * 2000) ? ['income'] : []
    return { found, intent, flags }
  }

  /* ---------------------------------------------------------------- simulated AI: "adjust my plan" in words -> proposed changes on known lines */
  const CATS = [['everyday:dining out', 'dining|eating out|restaurants?|الأكل خارج|المطاعم'], ['everyday:fun', 'fun|entertainment|الترفيه'], ['everyday:shopping', 'shopping|التسوق'], ['everyday:groceries', 'grocer|البقالة'], ['everyday:transport', 'transport|المواصلات'],
    ['subscriptions:subscriptions', 'subscriptions?|الاشتراكات'], ['safety:safety net', 'safety net|emergency|شبكة الأمان|الطوارئ'], ['grow:investing', 'invest|الاستثمار'], ['everyday:health', 'health|الصحة'], ['everyday:other', 'other|أخرى']]
  function readAdjust(text0, st) {
    const text = toLatin(text0).toLowerCase()
    const by = (key) => st.lines.find((l) => l.key === key)
    const numM = new RegExp(NUM + '\\s*(%|٪)?').exec(text)
    const n = numM ? toNum(numM[1], numM[2]) : undefined, pct = !!(numM && numM[3])
    const wants = WANT_ORDER.map(by).filter((l) => l && !l.locked && l.amount > 0)
    const wantsTotal = sum(wants.map((l) => l.amount))
    const ops = [], refused = []
    const move = (delta, to, sources) => {
      let left = delta
      for (const s of sources) { if (left <= 0) break; if (!s || s.key === to.key) continue; if (s.locked) { refused.push(s.name); continue } const c = Math.min(left, Math.max(0, s.amount - floorOf(s))); if (c > 0) { ops.push({ key: s.key, name: s.name, from: s.amount, to: s.amount - c }); left -= c } }
      const got = delta - left
      if (got > 0) ops.push({ key: to.key, name: to.name, from: to.amount, to: to.amount + got, add: to.add })
      return got
    }
    const buffer = by('grow:buffer')
    const cat = CATS.find(([, kw]) => new RegExp(kw, 'i').test(text))
    const target = cat && by(cat[0])
    const down = /cut|reduce|lower|less|trim|قلل|خفض|أقل/.test(text), upw = /raise|increase|more|add|زود|زيادة|أكثر|اكثر/.test(text)
    if (/debt|loan|card|ديون|القرض|البطاقة|سداد/.test(text) && (upw || /faster|aggressive|أسرع/.test(text))) {
      const to = st.lines.find((l) => /^Extra payoff/.test(l.name)) || st.lines.find((l) => l.key === 'debts:extra debt payment') || { key: 'debts:extra debt payment', name: 'Extra debt payment', amount: 0, add: { block: 'debts', icon: 'credit-card', essential: false } }
      if (!st.facts.debts.some((d) => d.balance > 0)) return { ops: [], say: 'nodebt' }
      move(n && !pct ? n : Math.round(wantsTotal * (pct ? n / 100 : 0.2)), to, [buffer, ...wants])
    } else if (/save|saving|ادخر|أدخر|وفّر|وفر/.test(text) && !down) {
      const to = by('safety:safety net') || { key: 'safety:safety net', name: 'Safety net', amount: 0, add: { block: 'safety', icon: 'shield-check', isSavings: true } }
      move(n && !pct ? n : Math.round(wantsTotal * (pct ? n / 100 : 0.15)), to, wants)
    } else if (target && down) {
      if (target.locked) refused.push(target.name)
      else { const c = Math.min(target.amount - floorOf(target), n === undefined ? Math.round(target.amount * 0.2) : pct ? Math.round((target.amount * n) / 100) : n); if (c > 0) ops.push({ key: target.key, name: target.name, from: target.amount, to: target.amount - c }) }
    } else if (target && upw) {
      if (target.locked) refused.push(target.name)
      else move(n === undefined ? Math.round(target.amount * 0.2) : pct ? Math.round((target.amount * n) / 100) : n, target, [buffer, ...wants, by('safety:safety net')])
    } else if (/spending money|pocket money|enjoy|مصروف/.test(text)) {
      const to = by('everyday:fun') || { key: 'everyday:fun', name: 'Fun', amount: 0 }
      move(n && !pct ? n : Math.round(st.income * 0.03), to, [buffer, by('safety:safety net')])
    } else return { ops: [], say: 'unknown', refused }
    return { ops, refused, say: ops.length ? 'ok' : refused.length ? 'locked' : 'noroom' }
  }

  root.Sim = { FX, convert, COUNTRIES, SYMBOL, PERSONAS, tweak, hydrate, autoWalk, factsOf, plan, settle, rebalance, metrics, SCENARIOS, runScenario, readSituation, readAdjust, lineKey, emptyFacts, simulatePayoff, sum, clone, nextFor }
})(typeof globalThis !== 'undefined' ? globalThis : this)
