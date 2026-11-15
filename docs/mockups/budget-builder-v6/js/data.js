/* Fictional personas, what the app would already hold for each, and the simulated AI (reading words, reading "adjust" requests).
 * The simulated AI stands in for a server model; everything it returns is a proposal the engine and the person check. */
;(function (root) {
  'use strict'
  const E = root.Engine
  const clone = (x) => JSON.parse(JSON.stringify(x))
  const COUNTRIES = { EG: { cur: 'EGP', tz: 'Africa/Cairo', week: 6, locale: 'ar-EG' }, AE: { cur: 'AED', tz: 'Asia/Dubai', week: 1, locale: 'en-AE' }, SA: { cur: 'SAR', tz: 'Asia/Riyadh', week: 0, locale: 'ar-SA' }, OTHER: { cur: 'USD', tz: 'UTC', week: 1, locale: 'en' } }
  const SYMBOL = { EGP: 'E£', AED: 'Dh', SAR: 'SR', USD: '$', EUR: '€', GBP: '£' }

  const H = (months, avg) => ({ months, avg })
  const PERSONAS = {
    nour: { name: 'Nour', country: 'EG', cur: 'EGP', lang: 'en', level: 'none', title: 'Complete cold start', sub: 'Egypt. Name, language and country only.',
      story: ['I make 18,000 a month on a salary. I live with my parents and give them 2,500. I have about 6,000 saved and I want a laptop for 45,000 in 9 months.', 'راتبي ١٨ ألف في الشهر. أعيش مع أهلي وأعطيهم ٢٥٠٠. مدخراتي ٦٠٠٠ وأريد لابتوب بـ ٤٥ ألف خلال ٩ شهور.'],
      t: { sources: [{ name: 'Salary', amount: 18000 }], incomeVar: 'fixed', adults: 1, kids: 0, housing: 'family', housingCost: 2500, transport: 'public', lifestyle: 'balanced', eatOut: 'sometimes', savings: 6000, debts: [], goals: [{ id: 'laptop', name: 'Laptop', raw: true, target: 45000, saved: 0, months: 9 }], annual: 3000, support: 0, gameya: 0, zakat: false, aim: 'goals' } },
    karim: { name: 'Karim', country: 'EG', cur: 'EGP', lang: 'en', level: 'profile', title: 'Existing user, partial profile', sub: 'Egypt. Salary and household on file; rent last confirmed 14 months ago.',
      story: ['Married, my wife does not work. Rent went up to 9,500. I pay 1,400 a month on valU and I am in a gameya of 2,000. I have 22,000 saved and want to save more.', 'متزوج وزوجتي لا تعمل. الإيجار أصبح ٩٥٠٠. أدفع ١٤٠٠ شهريًا لفاليو وعندي جمعية ٢٠٠٠. مدخراتي ٢٢ ألف وأريد أن أدخر أكثر.'],
      onFile: { housingCost: 9000 }, at: { housingCost: '2025-09' },
      t: { sources: [{ name: 'Salary', amount: 28000 }], incomeVar: 'fixed', adults: 2, kids: 0, housing: 'rent', housingCost: 9500, utilIncl: false, transport: 'car', lifestyle: 'balanced', eatOut: 'sometimes', savings: 22000,
        debts: [{ id: 'valu', name: 'valU', raw: true, kind: 'bnpl', balance: 7000, min: 1400 }], goals: [], annual: 9000, support: 0, gameya: 2000, zakat: false, aim: 'safety' } },
    salma: { name: 'Salma', country: 'EG', cur: 'EGP', lang: 'en', level: 'full', title: 'Data-rich user', sub: 'Egypt. Six months of history, accounts, a card, a car loan and a goal.',
      story: ['I want to clear my credit card first and keep the Umrah goal on track.', 'أريد سداد بطاقتي الائتمانية أولًا والحفاظ على هدف العمرة.'],
      accounts: [{ name: 'CIB current', bal: 41000 }, { name: 'CIB savings', bal: 180000 }, { name: 'CIB credit card', bal: -23500 }],
      t: { sources: [{ name: 'Salary · CIB', amount: 85000 }], incomeVar: 'fixed', adults: 2, kids: 1, housing: 'rent', housingCost: 16000, utilIncl: true,
        bills: [{ name: 'Internet', kind: 'telecom', amount: 650, day: 5 }, { name: 'Electricity', kind: 'utility', amount: 900, day: 12 }, { name: 'Mobile', kind: 'telecom', amount: 400, day: 1 }], subs: 1150, subsCount: 5, school: 3500,
        transport: 'car', lifestyle: 'comfortable', eatOut: 'often', savings: 180000,
        debts: [{ id: 'cib', name: 'CIB credit card', raw: true, kind: 'card', balance: 23500, min: 2400, apr: 34 }, { id: 'car', name: 'Car loan', raw: true, kind: 'loan', balance: 310000, min: 9800, apr: 21 }],
        goals: [{ id: 'umrah', name: 'Umrah', raw: true, target: 90000, saved: 30000, months: 10 }],
        history: H(6, { groceries: 9500, dining: 4200, transport: 3800, health: 1200, shopping: 3500, fun: 2600, personal: 900 }), annual: 12000, support: 0, gameya: 0, zakat: true, aim: 'debt' } },
    omar: { name: 'Omar', country: 'EG', cur: 'EGP', lang: 'ar', level: 'none', title: 'Variable-income freelancer', sub: 'Egypt. Income swings, supports his parents, saving for a wedding.',
      story: ['I freelance. A normal month is about 45k but a slow month is 28k. Rent is 7,500. I send my parents 5,000 every month. I have 30,000 saved and I am saving for a wedding: 250,000 in 18 months.', 'أعمل عمل حر. الشهر العادي حوالي ٤٥ ألف والشهر الضعيف ٢٨ ألف. الإيجار ٧٥٠٠. أرسل لأهلي ٥٠٠٠ كل شهر. مدخراتي ٣٠ ألف وأدخر للزواج: ٢٥٠ ألف خلال ١٨ شهر.'],
      t: { sources: [{ name: 'Freelance clients', amount: 45000 }], incomeVar: 'variable', lowMonth: 28000, adults: 1, kids: 0, housing: 'rent', housingCost: 7500, utilIncl: false, transport: 'taxi', lifestyle: 'balanced', eatOut: 'often', savings: 30000, support: 5000,
        debts: [], goals: [{ id: 'wedding', name: 'Wedding', raw: true, target: 250000, saved: 40000, months: 18 }], annual: 0, gameya: 0, zakat: false, aim: 'goals' } },
    mona: { name: 'Mona', country: 'EG', cur: 'EGP', lang: 'en', level: 'none', title: 'Financially constrained', sub: 'Egypt. Fixed costs and debt payments are larger than income.',
      story: ['I earn 19,000. Rent is 8,000 and I have two kids in school, about 2,500 a month. I owe 60,000 on a credit card and pay 4,200 a month, plus a loan of 150,000 at 6,300 a month and 1,800 in instalments. I have 3,000 saved. I would like a car for 400,000 next year.', 'دخلي ١٩ ألف. الإيجار ٨٠٠٠ وعندي طفلين في المدرسة بحوالي ٢٥٠٠ في الشهر. عليّ ٦٠ ألف على بطاقة الائتمان وأدفع ٤٢٠٠ في الشهر، وقرض ١٥٠ ألف بقسط ٦٣٠٠ وأقساط ١٨٠٠. مدخراتي ٣٠٠٠. أريد سيارة بـ ٤٠٠ ألف السنة القادمة.'],
      t: { sources: [{ name: 'Salary', amount: 19000 }], incomeVar: 'fixed', adults: 1, kids: 2, housing: 'rent', housingCost: 8000, utilIncl: false, school: 2500, transport: 'public', lifestyle: 'minimal', eatOut: 'rarely', savings: 3000,
        debts: [{ id: 'card', name: 'Card', kind: 'card', balance: 60000, min: 4200, apr: 30 }, { id: 'loan', name: 'Loan', kind: 'loan', balance: 150000, min: 6300, apr: 22 }, { id: 'bnpl', name: 'Instalments', kind: 'bnpl', balance: 7200, min: 1800 }], arrears: 3000,
        goals: [{ id: 'car', name: 'Car', raw: true, target: 400000, saved: 0, months: 12 }], annual: 0, support: 0, gameya: 0, zakat: false, aim: 'debt' } },
    faisal: { name: 'Faisal and Reem', country: 'AE', cur: 'AED', lang: 'ar', level: 'full', title: 'Gulf household, multi-currency', sub: 'UAE. Two salaries, rent income in USD, three children, family support, Tabby, rent by cheque.',
      story: ['We want school fees and the rent cheques covered without surprises, and to keep saving for a home in Egypt.', 'نريد تغطية رسوم المدرسة وشيكات الإيجار بلا مفاجآت، ونستمر في الادخار لبيت في مصر.'],
      accounts: [{ name: 'Emirates NBD current', bal: 18000 }, { name: 'Emirates NBD savings', bal: 95000 }, { name: 'USD account', bal: 12000, cur: 'USD' }, { name: 'Tabby', bal: -4600 }],
      t: { sources: [{ name: 'Faisal salary', amount: 27000 }, { name: 'Reem salary', amount: 14000 }, { name: 'Flat rent, Cairo', amount: 600, cur: 'USD' }], incomeVar: 'fixed', adults: 2, kids: 3, housing: 'rent', housingCost: 9170, rentNote: 'cheque', utilIncl: false,
        bills: [{ name: 'DEWA', kind: 'utility', amount: 850, day: 15 }, { name: 'du', kind: 'telecom', amount: 620, day: 3 }], subs: 310, subsCount: 6, school: 6500, support: 2500, transport: 'car', lifestyle: 'balanced', eatOut: 'sometimes', savings: 139000,
        debts: [{ id: 'car', name: 'Car loan', raw: true, kind: 'loan', balance: 74000, min: 2900, apr: 4.5 }, { id: 'tabby', name: 'Tabby', raw: true, kind: 'bnpl', balance: 4600, min: 1150 }],
        goals: [{ id: 'home', name: 'Home in Egypt', raw: true, target: 300000, saved: 120000, months: 48 }, { id: 'flights', name: 'Summer flights', raw: true, target: 18000, saved: 4000, months: 8 }],
        history: H(6, { groceries: 3400, dining: 1500, transport: 1600, health: 500, shopping: 1400, fun: 1100, personal: 400 }), annual: 4200, gameya: 0, zakat: true, aim: 'balanced' } },
  }
  for (const [id, p] of Object.entries(PERSONAS)) p.id = id

  /* What the app holds at each data level. Profile = a few facts typed once; full = tracked records and history. */
  const PROFILE_KEYS = ['sources', 'adults', 'kids', 'housing', 'housingCost']
  const FULL_KEYS = [...PROFILE_KEYS, 'incomeVar', 'lowMonth', 'utilIncl', 'bills', 'subs', 'subsCount', 'school', 'support', 'transport', 'savings', 'debts', 'goals', 'history', 'annual', 'zakat', 'gameya']
  function known(p) {
    const input = { country: p.country, cur: p.cur, $src: { country: 'you', cur: 'you' } }
    if (p.level === 'none') return input
    for (const k of p.level === 'full' ? FULL_KEYS : PROFILE_KEYS) {
      const val = (p.onFile && p.onFile[k] !== undefined) ? p.onFile[k] : p.t[k]
      if (val === undefined) continue
      input[k] = clone(val)
      input.$src[k] = p.level === 'full' && !['adults', 'kids', 'housing'].includes(k) ? 'records' : 'profile'
    }
    if (input.debts) input.debts.forEach((d) => (d.src = 'records'))
    if (input.goals) input.goals.forEach((g) => (g.src = 'records'))
    if (p.at) input.$at = clone(p.at)
    if (p.conflict) input.$conflict = clone(p.conflict)
    return input
  }

  /** A persona with the lab's controls applied to both what is true and what is on file. */
  function variant(p0, c) {
    const p = clone(p0), t = p.t
    c = c || {}
    if (c.level) p.level = c.level
    if (c.conflict) p.conflict = { fact: 'housingCost', a: t.housingCost, b: c.conflict }
    if (c.cur && c.cur !== p.cur) {
      const k = (x) => E.r10(E.conv(x, p.cur, c.cur))
      for (const s of t.sources) if (!s.cur) s.amount = k(s.amount)
      for (const f of ['lowMonth', 'housingCost', 'school', 'support', 'savings', 'annual', 'gameya', 'subs', 'arrears']) if (typeof t[f] === 'number') t[f] = k(t[f])
      for (const b of t.bills || []) b.amount = k(b.amount)
      for (const d of t.debts) { d.balance = k(d.balance); d.min = k(d.min) }
      for (const g of t.goals) { g.target = k(g.target); g.saved = k(g.saved) }
      if (t.history) for (const key of Object.keys(t.history.avg)) t.history.avg[key] = k(t.history.avg[key])
      if (p.onFile) for (const key of Object.keys(p.onFile)) p.onFile[key] = k(p.onFile[key])
      p.cur = c.cur
    }
    if (c.country) p.country = c.country
    if (c.income != null) { const own = t.sources.filter((s) => !s.cur), tot = E.sum(own.map((s) => s.amount)) || 1, r = c.income / tot; own.forEach((s) => (s.amount = Math.round(s.amount * r))); if (t.lowMonth) t.lowMonth = Math.round(t.lowMonth * r) }
    if (c.stability === 'fixed') { t.incomeVar = 'fixed'; delete t.lowMonth }
    if (c.stability === 'variable') { t.incomeVar = 'variable'; t.lowMonth = c.lowMonth != null ? c.lowMonth : t.lowMonth || Math.round(E.incomeOf(t.sources, p.cur) * 0.55) }
    else if (c.lowMonth != null && t.lowMonth) t.lowMonth = c.lowMonth
    if (c.housingCost != null) { t.housingCost = c.housingCost; if (p.onFile) delete p.onFile.housingCost }
    if (c.adults != null) t.adults = c.adults
    if (c.kids != null) { t.kids = c.kids; if (!c.kids) delete t.school; else if (t.school == null) t.school = E.r10(E.incomeOf(t.sources, p.cur) * 0.06 * c.kids) }
    if (c.savings != null) t.savings = c.savings
    if (c.debtBalance != null) {
      const d = t.debts.find((x) => x.kind !== 'bnpl')
      if (c.debtBalance <= 0) t.debts = t.debts.filter((x) => x.kind === 'bnpl')
      else if (d) { d.balance = c.debtBalance; if (c.debtMin != null) d.min = c.debtMin; if (c.debtApr != null) d.apr = c.debtApr }
      else t.debts.push({ id: 'lab', name: 'Card', kind: 'card', balance: c.debtBalance, min: c.debtMin != null ? c.debtMin : E.r10(c.debtBalance * 0.05), apr: c.debtApr != null ? c.debtApr : 30 })
    }
    if (c.subs != null) { t.subs = c.subs; t.subsCount = c.subs > 0 ? t.subsCount || 3 : 0 }
    if (c.lifestyle) t.lifestyle = c.lifestyle
    if (c.goalTarget != null) {
      if (c.goalTarget <= 0) t.goals = []
      else if (t.goals[0]) t.goals[0].target = c.goalTarget
      else t.goals.push({ id: 'lab', name: 'Goal', target: c.goalTarget, saved: 0, months: c.goalMonths || 12 })
    }
    if (c.goalMonths != null && t.goals[0]) t.goals[0].months = c.goalMonths
    if (c.historyMonths != null) { if (c.historyMonths <= 0) delete t.history; else if (t.history) t.history.months = c.historyMonths }
    if (c.accounts != null && p.accounts) p.accounts = p.accounts.slice(0, Math.max(1, c.accounts))
    return p
  }

  /** Answers the persona would give to a card. */
  function truthFor(p, q) {
    if (q.fact === 'household') return { adults: p.t.adults, kids: p.t.kids || 0 }
    const v = p.t[q.fact]
    if (v !== undefined) return clone(v)
    return E.complete({ ...p.t, country: p.country, cur: p.cur }).v[q.fact]
  }
  /** Walks the cards as this person, most useful first, recording how much of the budget rests on their own numbers after each answer. */
  function walk(p, max) {
    let input = known(p)
    input.sources = input.sources || clone(p.t.sources); input.$src.sources = input.$src.sources || 'you'
    input.aim = p.t.aim; input.$src.aim = 'you'
    const steps = [{ id: 'start', own: E.metrics(E.settle(E.build(input))).own, impact: 0 }]
    for (let i = 0; i < (max || 25); i++) {
      const top = E.queue(input)[0]
      if (!top) break
      if (top.kind === 'stale' || top.kind === 'conflict') input = E.withFact(input, top.fact, p.t[top.fact])
      else input = E.withFact(input, top.q.fact, truthFor(p, top.q))
      steps.push({ id: top.id, kind: top.kind, fact: top.fact, core: top.core, impact: top.impact, own: E.metrics(E.settle(E.build(input))).own })
    }
    return { steps, input }
  }

  /* ---------------------------------------------------------------- simulated AI: reading a description. Handles the personas' own words in English and Arabic. */
  const toLatin = (s) => s.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/٬|،/g, ',')
  const NUM = '(\\d{1,3}(?:,\\d{3})+|\\d+(?:\\.\\d+)?)\\s*(k\\b|thousand|alf|ألف|الف|آلاف|m\\b|million|مليون)?'
  const toNum = (n, unit) => { let v = Number(n.replace(/,/g, '')); if (unit) v *= /^(m|million|مليون)$/i.test(unit) ? 1e6 : 1000; return Math.round(v) }
  function read(text0, cur) {
    const text = ' ' + toLatin(text0).toLowerCase() + ' ', f = {}
    const after = (kw, gap) => { const m = new RegExp('(?:' + kw + ')[^0-9]{0,' + (gap || 28) + '}' + NUM, 'i').exec(text); return m ? toNum(m[1], m[2]) : undefined }
    const before = (kw) => { const m = new RegExp(NUM + '[^0-9.]{0,14}(?:' + kw + ')', 'i').exec(text); return m ? toNum(m[1], m[2]) : undefined }
    const has = (kw) => new RegExp(kw, 'i').test(text)
    const put = (k, v) => { if (v !== undefined && v !== null) f[k] = v }
    put('income', after('i make|i earn|\\bearn|salary|take home|normal month|راتبي|مرتبي|دخلي|الشهر العادي'))
    if (has('freelanc|عمل حر|فريلانس|my own business')) f.incomeVar = 'variable'
    else if (has('salary|راتب|مرتب')) f.incomeVar = 'fixed'
    put('lowMonth', after('slow month|bad month|worst month|الشهر الضعيف|أسوأ شهر'))
    const rent = after('\\brent\\b|الإيجار|الايجار|إيجار', 22)
    if (rent !== undefined) { f.housing = 'rent'; f.housingCost = rent }
    else if (has('with my (parents|family)|with (parents|family)|مع أهلي|مع اهلي|مع العائلة')) { f.housing = 'family'; put('housingCost', after('give them|أعطيهم|اعطيهم')) }
    const kids = /(\d+|one|two|three|four)\s+(?:kids|children|child)/.exec(text) || /(\d+)\s*(?:أطفال|اولاد|أولاد)/.exec(text)
    if (kids) { f.kids = { one: 1, two: 2, three: 3, four: 4 }[kids[1]] || Number(kids[1]) } else if (has('طفلين|ولدين')) f.kids = 2
    if (has('married|my wife|my husband|متزوج|زوجتي|زوجي')) f.adults = 2
    else if (f.kids !== undefined || f.housing) f.adults = f.adults || 1
    if (f.kids && has('school|المدرسة|مدرسة')) put('school', after('school|المدرسة|مدرسة', 40))
    put('support', after('send (?:my )?(?:parents|family|mother|father)|support my (?:parents|family)|أرسل لأهلي|ارسل لاهلي|أساعد أهلي'))
    put('gameya', after('gameya|gam\'eya|جمعية', 14) || before('gameya|جمعية'))
    const debts = []
    const card = before('on (?:a |my )?(?:credit )?card|على بطاقة') || after('credit card|بطاقة الائتمان|بطاقتي', 30)
    if (card !== undefined) { const m = new RegExp('(?:card|بطاقة)[^.]*?(?:pay|paying|وأدفع|أدفع)[^0-9]{0,10}' + NUM, 'i').exec(text); debts.push({ id: 'ai-card', name: 'Card', kind: 'card', balance: card, min: m ? toNum(m[1], m[2]) : E.r10(card * 0.05), apr: null }) }
    const loan = after('loan of|a loan|قرض', 16)
    if (loan !== undefined) { const m = new RegExp('(?:loan|قرض)[^.]*?(?:\\bat\\b|pay|بقسط|قسط)[^0-9]{0,10}' + NUM, 'i').exec(text); debts.push({ id: 'ai-loan', name: 'Loan', kind: 'loan', balance: loan, min: m ? toNum(m[1], m[2]) : E.r10(loan / 36), apr: null }) }
    const bnpl = before('in instal?ments|on valu|on tabby|on tamara') || after('instal?ments of|valu|فاليو|tabby|tamara|أقساط|اقساط|لفاليو', 18)
    if (bnpl !== undefined && bnpl !== loan) debts.push({ id: 'ai-bnpl', name: 'Instalments', kind: 'bnpl', balance: bnpl * 5, min: bnpl })
    if (debts.length) f.debts = debts
    else if (has('no debts?|debt[- ]free|owe nothing|لا ديون|مفيش ديون')) f.debts = []
    const saved = before('saved|in savings') || after('savings of|saved up|مدخراتي|مدّخراتي', 16)
    if (saved !== undefined) f.savings = saved
    const GOALS = [['Car', 'car|سيارة|عربية'], ['Home', 'house|home|apartment|flat|بيت|شقة'], ['Wedding', 'wedding|زواج|فرح'], ['Trip', 'trip|vacation|travel|سفر|رحلة'], ['Umrah', 'umrah|hajj|عمرة|حج'], ['Laptop', 'laptop|لابتوب'], ['Phone', 'phone|هاتف']]
    for (const [name, kw] of GOALS) {
      const m = new RegExp('(?:want|would like|saving for|save for|buy|أريد|عايز|أدخر)[^.0-9]{0,24}(?:' + kw + ')[^0-9]{0,22}' + NUM, 'i').exec(text)
      if (!m) continue
      const tail = text.slice(m.index), mo = /(?:in|خلال)\s+(\d+)\s*(months?|years?|شهر|شهور|أشهر|سنة|سنين|سنوات)/.exec(tail)
      f.goals = [{ id: 'ai-goal', name, target: toNum(m[1], m[2]), saved: 0, months: mo ? Number(mo[1]) * (/year|سن/.test(mo[2]) ? 12 : 1) : /next year|السنة القادمة/.test(tail) ? 12 : 12 }]
      break
    }
    if (has('my car|i drive|سيارتي|عربيتي')) f.transport = 'car'
    const aim = has('pay off|clear my|debt first|سداد|أسدد') ? 'debt' : f.goals ? 'goals' : has('save more|ادخر أكثر|أدخر أكثر') ? 'safety' : null
    // A figure that cannot be a monthly income in this currency is flagged, never silently accepted ("5 alf" read as 5, not 5,000).
    const floor = { EGP: 2000, AED: 800, SAR: 800 }[cur] || 200
    const flags = f.income !== undefined && (f.income < floor || f.income > floor * 2000) ? ['income'] : []
    return { facts: f, aim, flags }
  }

  /* ---------------------------------------------------------------- simulated AI: "adjust" in words -> a proposal the engine prices before anything changes */
  const CATS = [['dining', 'dining|eating out|restaurants?|الأكل خارج|المطاعم'], ['fun', 'fun|entertainment|الترفيه'], ['shopping', 'shopping|التسوق'], ['groceries', 'grocer|البقالة'], ['transport', 'transport|المواصلات'], ['personal', 'personal|العناية']]
  function readAdjust(text0, st) {
    const text = toLatin(text0).toLowerCase()
    const m = new RegExp(NUM + '\\s*(%|٪)?').exec(text)
    const n = m ? toNum(m[1], m[2]) : undefined, pct = !!(m && m[3])
    const line = (k) => st.lines.find((l) => l.key === k)
    const cat = CATS.find(([, kw]) => new RegExp(kw, 'i').test(text))
    const down = /cut|reduce|lower|less|trim|قلل|خفض|أقل/.test(text), up = /raise|increase|more|زود|زيادة|أكثر|اكثر/.test(text)
    if (/debt|loan|card|ديون|القرض|البطاقة|سداد|الدين/.test(text) && (up || /faster|أسرع/.test(text))) return { kind: 'facts', facts: { aim: 'debt', lean: 20 }, say: 'debt' }
    if (/save|saving|ادخر|أدخر|وفّر|وفر/.test(text) && !down) {
      const s = line('safety'), cur = s ? s.amount : 0
      return { kind: 'pins', pins: { safety: cur + (n && !pct ? n : Math.round(st.basis * (pct ? n / 100 : 0.05))) }, say: 'save' }
    }
    if (cat && (down || up)) {
      const l = line(cat[0]); if (!l) return { kind: 'none', say: 'unknown' }
      const delta = n === undefined ? Math.round(l.amount * 0.2) : pct ? Math.round((l.amount * n) / 100) : n
      return { kind: 'pins', pins: { [l.key]: Math.max(0, l.amount + (down ? -delta : delta)) }, say: 'cat' }
    }
    if (/spending money|enjoy|مصروف|راحة/.test(text)) return { kind: 'facts', facts: { lean: 85 }, say: 'enjoy' }
    return { kind: 'none', say: 'unknown' }
  }

  root.Data = { PERSONAS, COUNTRIES, SYMBOL, known, variant, truthFor, walk, read, readAdjust, clone, toLatin }
})(typeof globalThis !== 'undefined' ? globalThis : this)
