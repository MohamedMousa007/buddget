/* buddget Budget Builder v6: proposed deterministic engine (written fresh for this prototype, not the production engine).
 * Facts in, a balanced budget out. Every line carries a source, a confidence and a keyed reason. No AI, no randomness.
 * Also answers "which question is worth asking next" by measuring how far each unknown fact could move the budget. */
;(function (root) {
  'use strict'
  const sum = (xs) => xs.reduce((s, x) => s + x, 0)
  const r10 = (x) => Math.max(0, Math.round(x / 10) * 10)
  const TODAY = '2026-11'
  const monthsSince = (ym) => { const [y, m] = ym.split('-').map(Number), [ty, tm] = TODAY.split('-').map(Number); return (ty - y) * 12 + (tm - m) }

  // Fictional fixed rates to USD, for the prototype only.
  const FX = { USD: 1, EUR: 1.08, GBP: 1.27, AED: 0.2723, SAR: 0.2667, EGP: 0.0204 }
  const conv = (a, from, to) => (from === to ? a : (a * FX[from]) / FX[to])

  /* Typical monthly costs. Every figure is an internal heuristic with no outside source yet, and the app says so wherever one is used.
   * Index [0,1,2] = minimal, balanced, comfortable. rent by household: [one adult, two adults, family]; util[2] is per child. */
  const META = { source: 'buddget heuristic table (not externally sourced)', version: 'h-2026.11', updated: '2026-11-01', confidence: 'low', method: 'Monthly cost per adult by lifestyle tier; a child counts as 0.6 of an adult' }
  const TABLE = {
    EG: { cur: 'EGP', label: 'Egypt', housingCap: 0.3, rent: [5000, 7000, 9000], util: [1200, 1700, 300], phone: 600, groceries: [2500, 3500, 5500], groceriesMin: 1800,
      transport: { public: 900, car: 3500, taxi: 2500, walk: 200 }, health: 500, dining: [500, 1500, 3500], fun: [400, 1000, 2500], shopping: [400, 1200, 3000], personal: [200, 400, 800] },
    AE: { cur: 'AED', label: 'UAE', housingCap: 0.35, rent: [5500, 7500, 10000], util: [450, 650, 120], phone: 300, groceries: [600, 900, 1300], groceriesMin: 450,
      transport: { public: 300, car: 1000, taxi: 800, walk: 60 }, health: 200, dining: [150, 450, 1100], fun: [150, 400, 1000], shopping: [200, 550, 1300], personal: [80, 150, 300] },
    SA: { cur: 'SAR', label: 'Saudi Arabia', housingCap: 0.33, rent: [3500, 4500, 6000], util: [350, 500, 100], phone: 250, groceries: [550, 850, 1300], groceriesMin: 400,
      transport: { public: 250, car: 900, taxi: 750, walk: 50 }, health: 150, dining: [150, 400, 1000], fun: [150, 400, 900], shopping: [250, 600, 1300], personal: [70, 130, 250] },
  }
  const scale = (o, k) => (Array.isArray(o) ? o.map((x) => scale(x, k)) : typeof o === 'number' ? Math.round(o * k) : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([a, b]) => [a, a === 'housingCap' ? b : scale(b, k)])) : o)
  function bench(country, cur) {
    const own = TABLE[country], base = own || TABLE.AE
    const t = base.cur === cur ? base : scale(base, conv(1, base.cur, cur))
    return { ...t, ...META, label: own ? base.label : 'general', converted: base.cur !== cur }
  }

  /* ------------------------------------------------------------ facts: what the person said, what records hold, and labelled defaults for the rest */
  const HH = (v) => (v.adults >= 2 ? (v.kids > 0 ? 2 : 1) : v.kids > 0 ? 1 : 0)
  const incomeOf = (sources, cur) => Math.round(sum((sources || []).map((s) => conv(s.amount || 0, s.cur || cur, cur))))
  function complete(input) {
    const v = {}, src = {}, S = input.$src || {}
    const set = (k, d) => { if (input[k] !== undefined && input[k] !== null) { v[k] = input[k]; src[k] = S[k] || 'you' } else { v[k] = typeof d === 'function' ? d() : d; src[k] = 'estimate' } }
    set('country', 'EG'); set('cur', 'EGP')
    // Income is the sum of its sources, each converted from its own currency.
    v.sources = input.sources || []; src.sources = S.sources || 'you'
    if (input.income == null && v.sources.length) { v.income = incomeOf(v.sources, v.cur); src.income = S.sources || 'you' } else set('income', 0)
    set('incomeVar', 'fixed'); set('lowMonth', () => Math.round(v.income * 0.7))
    set('adults', 1); set('kids', 0); set('share', 1)
    set('housing', 'rent')
    const b = bench(v.country, v.cur)
    set('housingCost', () => (v.housing === 'family' || v.housing === 'owned' ? 0 : r10(v.income > 0 ? Math.min(b.rent[HH(v)], v.income * 0.35) : b.rent[HH(v)])))
    set('utilIncl', false); set('school', () => (v.kids > 0 ? r10(v.income * 0.06 * v.kids) : 0)); set('support', 0); set('gameya', 0)
    set('transport', 'public'); set('lifestyle', 'balanced'); set('eatOut', 'sometimes')
    set('savings', () => r10(v.income * 0.5)); set('debts', []); set('goals', []); set('annual', 0); set('zakat', false)
    set('aim', 'balanced'); set('lean', 50); set('cash', false)
    for (const [k, d] of [['bills', []], ['subs', 0], ['subsCount', 0], ['arrears', 0], ['history', null]]) { v[k] = input[k] != null ? input[k] : d; src[k] = S[k] || (input[k] != null ? 'records' : 'estimate') }
    return { v, src, b }
  }

  const APR = { card: 28, loan: 14, car: 10, family: 0, bnpl: 0 }
  const aprOf = (d) => (d.apr != null ? d.apr : APR[d.kind] || 0)
  const COSTLY = 15
  const EAT = { rarely: 0.4, sometimes: 0.9, often: 1.6 }
  const safetyTarget = (v) => Math.max(3, v.incomeVar === 'variable' || v.kids > 0 ? 6 : 3, v.incomeVar === 'variable' && v.kids > 0 ? 9 : 0)

  /* ------------------------------------------------------------ the budget */
  function build(input) {
    const { v, src, b } = complete(input)
    const tier = Math.max(0, ['minimal', 'balanced', 'comfortable'].indexOf(v.lifestyle))
    const people = v.adults + v.kids * 0.6
    const lines = []
    /** src: you | records | profile | ai | estimate | rule. conf: high (stated or tracked), shaped (typical cost sized by your answers), guess (typical cost on assumed facts), ai (read by Buddgy, not yet confirmed). */
    const add = (o) => {
      const from = o.from || []
      const assumed = from.some((k) => src[k] === 'estimate')
      let s = o.src
      if (!s) s = assumed ? 'estimate' : from.some((k) => src[k] === 'ai') ? 'ai' : from.some((k) => src[k] === 'records' || src[k] === 'profile') ? 'records' : 'you'
      const conf = s === 'estimate' ? (assumed ? 'guess' : 'shaped') : s === 'rule' ? (src.savings === 'estimate' || src.income === 'ai' ? 'shaped' : 'high') : s === 'ai' ? 'ai' : 'high'
      const l = { essential: false, ...o, src: s, conf, amount: Math.max(0, Math.round(o.amount)) }
      lines.push(l)
      return l
    }
    const noIncome = !(v.income > 0)
    const variable = !noIncome && v.incomeVar === 'variable'
    let basis = noIncome ? 0 : variable ? Math.min(v.income, v.lowMonth > 0 ? v.lowMonth : Math.round(v.income * 0.7)) : v.income
    const sh = v.share
    const left = () => basis - sum(lines.map((l) => l.amount))

    // 1. Must-pay: fixed costs, family duties and debt payments, exactly as stated or tracked.
    if ((v.housing === 'rent' || v.housing === 'mortgage') && v.housingCost > 0) add({ key: 'housing', block: 'home', name: v.housing, amount: v.housingCost * sh, from: ['housing', 'housingCost'], essential: true, why: ['w.housing', {}] })
    if (v.housing === 'family' && v.housingCost > 0) add({ key: 'housing', block: 'home', name: 'homeShare', amount: v.housingCost, from: ['housing', 'housingCost'], essential: true, why: ['w.homeShare', {}] })
    const tracked = (k) => v.bills.some((x) => x.kind === k)
    // Utilities are estimated only when rent excludes them and none are tracked as bills, so they are never counted twice.
    if (v.housing !== 'family' && !v.utilIncl && !tracked('utility')) add({ key: 'utilities', block: 'home', name: 'utilities', amount: r10((b.util[0] + (v.adults > 1 ? b.util[1] - b.util[0] : 0) + v.kids * b.util[2]) * sh), src: 'estimate', from: ['utilIncl', 'housing', 'adults'], essential: true, why: ['w.util', { place: b.label }] })
    for (const x of v.bills) add({ key: 'bill:' + x.name, block: 'home', name: x.name, raw: true, amount: x.amount, src: 'records', essential: x.kind !== 'other', why: ['w.bill', { day: x.day || 0 }] })
    if (!tracked('telecom')) add({ key: 'phone', block: 'home', name: 'phone', amount: r10(b.phone * (v.adults > 1 ? 1.4 : 1)), src: 'estimate', from: ['adults'], essential: true, why: ['w.phone', { place: b.label }] })
    if (v.subs > 0) add({ key: 'subs', block: 'home', name: 'subs', amount: v.subs, src: src.subs === 'estimate' ? 'you' : src.subs, why: ['w.subs', { n: v.subsCount }] })
    if (v.school > 0) add({ key: 'school', block: 'home', name: 'school', amount: v.school, from: ['school'], essential: true, why: ['w.school', {}] })
    if (v.support > 0) add({ key: 'support', block: 'home', name: 'support', amount: v.support, from: ['support'], essential: true, why: ['w.support', {}] })
    if (v.gameya > 0) add({ key: 'gameya', block: 'home', name: 'gameya', amount: v.gameya, from: ['gameya'], essential: true, why: ['w.gameya', {}] })
    for (const d of v.debts) if (d.min > 0) add({ key: 'debt:' + d.id, block: 'debt', name: d.name, raw: !!d.raw, amount: d.min, src: d.src || (src.debts === 'estimate' ? 'estimate' : src.debts), essential: true, debtId: d.id, why: ['w.min', { apr: aprOf(d), assumed: d.apr == null ? 1 : 0 }] })
    if (v.arrears > 0) add({ key: 'arrears', block: 'debt', name: 'arrears', amount: Math.ceil(v.arrears / 3), src: 'you', essential: true, why: ['w.arrears', {}] })
    const mustTotal = sum(lines.map((l) => l.amount))

    // 2. Everyday: own history where it exists (half weight if mostly cash), typical local costs where it does not.
    const h = v.history
    const wt = h ? Math.min(1, (h.months || 0) / 3) * (v.cash ? 0.5 : 1) : 0
    const blend = (k, bv) => (h && h.avg && h.avg[k] != null && wt > 0 ? { typ: wt * h.avg[k] + (1 - wt) * bv, rec: true, avg: h.avg[k] } : { typ: bv, rec: false })
    const ess = [
      ['groceries', b.groceries[tier] * people, (t) => Math.min(t, Math.max(b.groceriesMin * people, t * 0.75)), ['lifestyle', 'adults']],
      ['transport', b.transport[v.transport] * (v.adults > 1 ? 1.5 : 1), (t) => t * 0.6, ['transport']],
      ['health', b.health * people, (t) => t * 0.5, ['adults']],
    ].map(([k, bv, fl, from]) => { const x = blend(k, bv); return { k, typ: Math.round(x.typ), floor: Math.round(fl(x.typ)), rec: x.rec, avg: x.avg, from } })
    const wants = [
      ['dining', b.dining[tier] * v.adults * EAT[v.eatOut], ['lifestyle', 'eatOut']],
      ['fun', b.fun[tier] * (v.adults + v.kids * 0.3), ['lifestyle']],
      ['shopping', b.shopping[tier] * (v.adults + v.kids * 0.5), ['lifestyle']],
      ['personal', b.personal[tier] * v.adults, ['lifestyle']],
    ].map(([k, bv, from]) => { const x = blend(k, bv); return { k, typ: Math.round(x.typ), rec: x.rec, avg: x.avg, from } })
    const everyday = (e, amount, block, essential) => add({ key: e.k, block, name: e.k, amount, essential, floor: e.floor, typ: e.typ, ...(e.rec ? { src: 'records' } : { src: 'estimate', from: e.from }),
      why: e.rec ? [wt < 1 ? 'w.histBlend' : 'w.hist', { avg: Math.round(e.avg), place: b.label }] : amount < e.typ ? ['w.trimmed', { typ: e.typ, place: b.label }] : ['w.bench', { place: b.label }] })

    let shortfall = 0
    let safety = 0
    if (noIncome) {
      // No income yet: the plan covers expected spending so it still balances, and says so. Saving waits.
      for (const e of ess) everyday(e, e.typ, 'living', true)
      for (const w of wants) if (w.typ > 0) everyday(w, Math.round(w.typ * 0.5), 'life', false)
      basis = sum(lines.map((l) => l.amount))
    } else {
      const floors = sum(ess.map((e) => e.floor))
      if (basis - mustTotal - floors < 0) {
        // Fixed costs leave less than the lowest safe everyday spending. Essentials stay in the plan at their floor; the gap is reported, never hidden.
        shortfall = mustTotal + floors - basis
        for (const e of ess) everyday(e, e.floor, 'living', true)
      } else {
        // Essentials top up toward typical with at most 60% of the room, so the safety net and goals are never starved by a benchmark.
        const gapEss = sum(ess.map((e) => e.typ - e.floor)), give = Math.min(Math.floor((left() - floors) * 0.6), gapEss)
        for (const e of ess) everyday(e, e.floor + (gapEss > 0 ? Math.floor(((e.typ - e.floor) * give) / gapEss) : 0), 'living', true)
        if (v.zakat) { const z = Math.min(left(), Math.round((v.savings * 0.025) / 12)); if (z > 0) add({ key: 'zakat', block: 'future', name: 'zakat', amount: z, src: 'rule', from: ['savings'], why: ['w.zakat', {}] }) }
        if (v.annual > 0) { const a = Math.min(left(), Math.round(v.annual / 12)); if (a > 0) add({ key: 'annual', block: 'future', name: 'annual', amount: a, from: ['annual'], why: ['w.annual', { year: v.annual }] }) }
        const essMonth = sum(lines.filter((l) => l.essential).map((l) => l.amount))
        const held = essMonth > 0 ? v.savings / essMonth : 0
        const free = () => left() - safety
        // 3. A starter safety net comes first when less than a month of essentials is saved.
        if (held < 1) safety += Math.max(0, Math.min(Math.floor(free() * 0.3), Math.ceil((essMonth - v.savings) / 4)))
        // 4. Costly debt (15% a year or more) gets extra, highest rate first, paced by the aim.
        const costly = v.debts.filter((d) => d.balance > 0 && d.kind !== 'bnpl' && aprOf(d) >= COSTLY)
        if (costly.length) {
          const target = costly.reduce((a, d) => (aprOf(d) > aprOf(a) || (aprOf(d) === aprOf(a) && d.balance < a.balance) ? d : a))
          const share = { debt: 0.55, balanced: 0.3, safety: 0.15, goals: 0.15 }[v.aim]
          const extra = Math.max(0, Math.min(Math.floor(free() * share), Math.ceil(target.balance / (v.aim === 'debt' ? 12 : 24))))
          if (extra > 0) add({ key: 'payoff', block: 'debt', name: 'payoff', arg: target.name, argRaw: !!target.raw, amount: extra, src: 'rule', debtId: target.id, why: ['w.payoff', { apr: aprOf(target) }] })
        }
        // 5. Goals: what each needs to arrive on time, capped together by the aim so one goal never eats the plan.
        if (v.goals.length) {
          const needs = v.goals.map((g) => Math.max(0, g.target - (g.saved || 0)) / Math.max(1, g.months || 12))
          const cap = Math.floor(free() * { goals: 0.65, balanced: 0.4, safety: 0.25, debt: 0.2 }[v.aim]), want = sum(needs), k = want > cap ? cap / want : 1
          v.goals.forEach((g, i) => add({ key: 'goal:' + g.id, block: 'goals', name: g.name, raw: !!g.raw, amount: Math.floor(needs[i] * k), src: g.src || (src.goals === 'estimate' ? 'estimate' : src.goals), keep: true, goalId: g.id, why: [k < 1 ? 'w.goalShort' : 'w.goal', { need: Math.round(needs[i]) }] }))
        }
        // 6. The safety net grows toward its target: 3 months of essentials, 6 with children or changing pay, 9 with both.
        const tm = safetyTarget(v), gap = Math.max(0, tm * essMonth - v.savings)
        const share = 0.25 + (1 - v.lean / 100) * 0.35 + (v.aim === 'safety' ? 0.15 : 0)
        safety += Math.max(0, Math.min(Math.floor(free() * share), Math.ceil(gap / (v.aim === 'safety' ? 8 : 15)) - safety))
        // 7. Lifestyle: typical spending for this household, scaled to what is left and how the person leans.
        const wantTyp = sum(wants.map((w) => w.typ)), budget = Math.floor(free() * (0.45 + (v.lean / 100) * 0.45)), sc = wantTyp > 0 ? Math.min(1, budget / wantTyp) : 0
        for (const w of wants) { const a = Math.floor(w.typ * sc); if (a > 0) everyday(w, a, 'life', false) }
        // 8. Investing only with no costly debt and three months saved.
        if (!costly.length && held >= 3) { const a = Math.floor(free() * (v.aim === 'safety' || v.aim === 'debt' ? 0.3 : 0.5)); if (a > 0) add({ key: 'invest', block: 'future', name: 'invest', amount: a, src: 'rule', from: ['savings'], why: ['w.invest', { held: held.toFixed(1) }] }) }
        // 9. A large unassigned surplus finishes the safety net before sitting idle.
        if (gap > 0) safety += Math.max(0, Math.min(free() - Math.round(basis * 0.05), Math.ceil(gap / 4) - safety))
        if (safety > 0) add({ key: 'safety', block: 'safety', name: 'safety', amount: safety, src: 'rule', from: ['savings'], why: ['w.safety', { held: held.toFixed(1), target: tm }] })
        if (left() > 0) add({ key: 'buffer', block: 'free', name: 'buffer', amount: left(), src: 'rule', from: ['savings'], why: ['w.buffer', {}] })
      }
    }
    return { v, src, b, basis, basisKind: noIncome ? 'spend' : variable ? 'floor' : 'income', lines, shortfall, mustTotal }
  }

  /* ------------------------------------------------------------ the person's edits on top: pinned amounts, own lines, removals. The budget always rebalances, from wants first. */
  const TRIM = ['buffer', 'dining', 'fun', 'shopping', 'personal', 'invest', 'payoff', 'safety', 'goal:']
  function settle(p, e) {
    e = e || {}
    const pins = e.pins || {}, removed = e.removed || []
    const lines = p.lines.filter((l) => !removed.includes(l.key)).map((l) => (pins[l.key] != null ? { ...l, amount: pins[l.key], pinned: true, suggested: l.amount } : { ...l, suggested: l.amount }))
    for (const c of e.custom || []) if (!lines.some((l) => l.key === c.key)) lines.push({ src: 'you', conf: 'high', essential: !!c.essential, why: ['w.custom', {}], raw: true, ...c, amount: pins[c.key] != null ? pins[c.key] : c.amount, pinned: true, custom: true, suggested: c.amount })
    const moved = []
    let over = sum(lines.map((l) => l.amount)) - p.basis
    // Never trims a commitment, a debt payment or an essential: only wants, growth, the safety net and goals.
    for (const pre of TRIM) {
      if (over <= 0) break
      for (const l of lines.filter((x) => (pre.endsWith(':') ? x.key.startsWith(pre) : x.key === pre) && !x.pinned)) {
        if (over <= 0) break
        const cut = Math.min(over, l.amount)
        if (cut > 0) { l.amount -= cut; over -= cut; if (l.key !== 'buffer') moved.push({ key: l.key, name: l.name, raw: l.raw, by: cut }) }
      }
    }
    const kept = lines.filter((l) => l.amount > 0 || l.keep || l.pinned)
    const gap = p.basis - sum(kept.map((l) => l.amount))
    const buf = kept.find((l) => l.key === 'buffer')
    if (gap > 0) { if (buf) buf.amount += gap; else kept.push({ key: 'buffer', block: 'free', name: 'buffer', amount: gap, suggested: 0, src: 'rule', conf: 'high', essential: false, why: ['w.buffer', {}] }) }
    return { ...p, lines: kept, over: Math.max(0, -gap), moved }
  }

  /* ------------------------------------------------------------ outcomes */
  function payoff(debts, extra) {
    const ds = debts.filter((d) => d.balance > 0).map((d) => ({ ...d, bal: d.balance }))
    if (!ds.length) return { months: 0, interest: 0, cleared: {} }
    let months = 0, interest = 0
    const cleared = {}
    while (ds.some((d) => d.bal > 0.5) && months < 600) {
      months++
      for (const d of ds) if (d.bal <= 0.5 && cleared[d.id] == null) cleared[d.id] = months - 1
      let pool = extra
      for (const d of ds) { if (d.bal <= 0.5) { pool += d.min; continue } const i = (d.bal * aprOf(d)) / 1200; interest += i; d.bal = d.bal + i - Math.min(d.min, d.bal + i) }
      for (const d of ds.filter((x) => x.bal > 0.5 && x.kind !== 'bnpl').sort((a, b) => aprOf(b) - aprOf(a) || a.bal - b.bal)) { const pay = Math.min(pool, d.bal); d.bal -= pay; pool -= pay; if (pool <= 0) break }
    }
    for (const d of ds) if (d.bal <= 0.5 && cleared[d.id] == null) cleared[d.id] = months
    return { months: months >= 600 ? null : months, interest: Math.round(interest), cleared }
  }
  function metrics(st) {
    const v = st.v, L = st.lines, amt = (f) => sum(L.filter(f).map((l) => l.amount))
    const by = (b) => amt((l) => l.block === b)
    const essMonth = amt((l) => l.essential)
    const bare = amt((l) => l.essential && l.block !== 'living') + sum(L.filter((l) => l.block === 'living').map((l) => Math.min(l.amount, l.floor != null ? l.floor : l.amount)))
    const safety = amt((l) => l.key === 'safety')
    const held = essMonth > 0 ? v.savings / essMonth : 0
    const tm = safetyTarget(v), gap = Math.max(0, tm * essMonth - v.savings)
    const extra = amt((l) => l.key === 'payoff')
    const debts = v.debts.filter((d) => d.balance > 0)
    const pay = payoff(debts, extra), payMin = payoff(debts, 0)
    const goals = v.goals.map((g) => {
      const l = L.find((x) => x.goalId === g.id), funded = l ? l.amount : 0, left = Math.max(0, g.target - (g.saved || 0))
      const months = left === 0 ? 0 : funded > 0 ? Math.ceil(left / funded) : null
      return { id: g.id, name: g.name, raw: !!g.raw, funded, need: Math.round(left / Math.max(1, g.months)), want: g.months, months, onTime: months !== null && months <= g.months }
    })
    // "Built from your numbers": the share of the money in this budget that rests on things you said or your records show. Not a probability.
    const total = Math.max(1, amt(() => true))
    const own = st.basisKind === 'spend' ? 0 : Math.round((100 * amt((l) => l.conf === 'high')) / total)
    return { basis: st.basis, home: by('home'), debt: by('debt'), living: by('living'), life: by('life'), safetyAmt: by('safety'), goals: by('goals'), future: by('future'), buffer: by('free'),
      saving: by('safety') + by('goals') + amt((l) => l.key === 'invest') + by('free'), essMonth, bare, held, runway: bare > 0 ? v.savings / bare : 0, targetMonths: tm, safetyFull: gap === 0 ? 0 : safety > 0 ? Math.ceil(gap / safety) : null,
      hasDebt: debts.length > 0, cleared: pay.cleared, debtFree: pay.months, debtFreeMin: payMin.months, interest: pay.interest, interestMin: payMin.interest, extra, goalsOut: goals, own, over: st.over || 0,
      lines: L.length, ownLines: L.filter((l) => l.conf === 'high').length, guesses: L.filter((l) => l.conf === 'guess').length, shaped: L.filter((l) => l.conf === 'shaped').length, aiLines: L.filter((l) => l.conf === 'ai').length }
  }
  function risks(st) {
    const v = st.v, m = metrics(st), out = []
    if (st.basisKind === 'spend') out.push(['info', 'r.noIncome', { spend: st.basis }])
    if (st.over > 0) out.push(['bad', 'r.short', { v: st.over }])
    if (st.basisKind === 'floor') out.push(['info', 'r.var', { floor: st.basis, usual: v.income }])
    const hl = st.lines.find((l) => l.key === 'housing')
    if (hl && st.basis > 0 && hl.amount / st.basis > st.b.housingCap) out.push(['warn', 'r.housing', { pct: Math.round((hl.amount / st.basis) * 100), cap: Math.round(st.b.housingCap * 100) }])
    if (m.held < 1 && m.essMonth > 0 && st.basisKind !== 'spend') out.push(['warn', 'r.thin', { held: m.held.toFixed(1) }])
    const mins = sum(st.lines.filter((l) => l.block === 'debt' && l.key !== 'payoff').map((l) => l.amount))
    if (st.basis > 0 && mins / st.basis > 0.5) out.push(['bad', 'r.debtHard', { pct: Math.round((mins / st.basis) * 100) }])
    else if (st.basis > 0 && mins / st.basis > 0.36) out.push(['warn', 'r.debtWarn', { pct: Math.round((mins / st.basis) * 100) }])
    if (v.arrears > 0) out.push(['bad', 'r.arrears', {}])
    for (const g of m.goalsOut) if (!g.onTime) out.push(['warn', 'r.goalLate', { name: g.name, raw: g.raw, months: g.months, want: g.want }])
    return out
  }

  /* ------------------------------------------------------------ which question is worth asking: value of information, above a floor of core questions */
  const Q = (id, fact, control, opts, alts, when, core) => ({ id, fact, control, opts, alts, when, core: !!core })
  const QUESTIONS = [
    Q('household', 'household', 'household', null, () => [{ adults: 1, kids: 0 }, { adults: 2, kids: 2 }], null, true),
    Q('housing', 'housing', 'chips', ['rent', 'mortgage', 'owned', 'family'], () => ['family', 'rent'], null, true),
    Q('housingCost', 'housingCost', 'amountPeriod', null, (v) => (v.housing === 'family' ? [0, r10(v.income * 0.15)] : [r10(v.housingCost * 0.6), r10(v.housingCost * 1.4)]), (v) => ['rent', 'mortgage', 'family'].includes(v.housing)),
    Q('incomeVar', 'incomeVar', 'chips', ['fixed', 'variable'], () => ['fixed', 'variable'], (v) => v.income > 0, true),
    Q('lowMonth', 'lowMonth', 'amount', null, (v) => [r10(v.income * 0.4), r10(v.income * 0.9)], (v) => v.incomeVar === 'variable', true),
    Q('debts', 'debts', 'debts', null, (v) => [[], [{ id: 'q', name: 'Card', kind: 'card', balance: r10(v.income * 1.5), min: r10(v.income * 0.075), apr: null }]], null, true),
    Q('savings', 'savings', 'amount', null, (v) => [0, r10(v.income * 4)]),
    Q('support', 'support', 'amount', null, (v) => [0, r10(v.income * 0.12)]),
    Q('goals', 'goals', 'goals', null, (v) => [[], [{ id: 'q', name: 'Goal', target: r10(v.income * 4), saved: 0, months: 18 }]]),
    Q('school', 'school', 'amount', null, (v) => [0, r10(v.income * 0.08 * v.kids)], (v) => v.kids > 0),
    Q('utilIncl', 'utilIncl', 'toggle', null, () => [true, false], (v) => v.housing === 'rent' && !v.bills.some((b) => b.kind === 'utility')),
    Q('transport', 'transport', 'chips', ['public', 'car', 'taxi', 'walk'], () => ['walk', 'car']),
    Q('annual', 'annual', 'amount', null, (v) => [0, r10(v.income)]),
    Q('gameya', 'gameya', 'amount', null, (v) => [0, r10(v.income * 0.1)]),
    Q('lifestyle', 'lifestyle', 'chips', ['minimal', 'balanced', 'comfortable'], () => ['minimal', 'comfortable']),
    Q('eatOut', 'eatOut', 'chips', ['rarely', 'sometimes', 'often'], () => ['rarely', 'often']),
    Q('zakat', 'zakat', 'toggle', null, () => [false, true]),
    Q('cash', 'cash', 'toggle', null, () => [false, true], (v) => !!v.history),
  ]
  const QBY = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]))
  function withFact(input, fact, val, how) {
    const x = { ...input, $src: { ...(input.$src || {}) } }
    if (fact === 'household') { x.adults = val.adults; x.kids = val.kids; x.$src.adults = x.$src.kids = how || 'you' } else { x[fact] = val; x.$src[fact] = how || 'you' }
    return x
  }
  function diff(A, B) {
    const keys = new Set([...A.lines, ...B.lines].map((l) => l.key))
    let d = Math.abs(A.over - B.over)
    for (const k of keys) d += Math.abs(((A.lines.find((l) => l.key === k) || {}).amount || 0) - ((B.lines.find((l) => l.key === k) || {}).amount || 0))
    return d / 2
  }
  /** How much the budget could move if this fact turned out low versus high. The low and high values are assumptions too, and are shown as such. */
  function impact(input, q, edits) {
    const { v } = complete(input)
    const [a, b] = q.alts(v)
    return r10(diff(settle(build(withFact(input, q.fact, a)), edits), settle(build(withFact(input, q.fact, b)), edits)))
  }
  const isKnown = (src, q) => (q.fact === 'household' ? src.adults !== 'estimate' : src[q.fact] !== 'estimate')
  /** Cards still worth showing: re-checks first, then the core questions everyone is asked, then the rest by how much they could move the budget. */
  function queue(input, edits) {
    const { v, src } = complete(input), skip = input.$skip || [], first = [], core = [], rest = []
    for (const [k, at] of Object.entries(input.$at || {})) if (monthsSince(at) >= 12 && src[k] !== 'you') first.push({ id: 'stale:' + k, kind: 'stale', fact: k, at, value: v[k], impact: r10(Math.abs(v[k]) * 0.15) })
    const c = input.$conflict
    if (c && src[c.fact] !== 'you') first.push({ id: 'conflict', kind: 'conflict', fact: c.fact, a: c.a, b: c.b, impact: r10(Math.abs(c.a - c.b)) })
    for (const q of QUESTIONS) {
      if (skip.includes(q.id) || (q.when && !q.when(v)) || isKnown(src, q)) continue
      const imp = impact(input, q, edits)
      if (q.core) core.push({ id: q.id, kind: 'q', q, impact: imp, core: true })
      else if (imp > 0) rest.push({ id: q.id, kind: 'q', q, impact: imp })
    }
    return [...first, ...core.sort((a, b) => b.impact - a.impact), ...rest.sort((a, b) => b.impact - a.impact)]
  }

  /* ------------------------------------------------------------ alternative shapes and what-ifs */
  function shapes(input, edits) {
    const { v } = complete(input)
    const costly = v.debts.some((d) => d.balance > 0 && d.kind !== 'bnpl' && aprOf(d) >= COSTLY)
    const third = costly ? { id: 'debt', aim: 'debt', lean: 35 } : v.goals.length ? { id: 'goals', aim: 'goals', lean: 45 } : { id: 'enjoy', aim: 'balanced', lean: 85 }
    return [{ id: 'balanced', aim: 'balanced', lean: 50 }, { id: 'safety', aim: 'safety', lean: 25 }, third].map((s) => {
      const inp = { ...input, aim: s.aim, lean: s.lean, $src: { ...(input.$src || {}), aim: 'you', lean: 'you' } }
      const st = settle(build(inp), edits)
      return { id: s.id, aim: s.aim, lean: s.lean, st, m: metrics(st) }
    })
  }
  const SCENARIOS = ['incomeDrop', 'jobLoss', 'rentUp', 'newDebt', 'newGoal', 'debtFast', 'saveMore', 'moreFun', 'moveOut']
  function scenario(input, id) {
    const x = JSON.parse(JSON.stringify(input)), { v, b } = complete(input), inc = v.income || 0
    x.$src = x.$src || {}
    const set = (k, val) => { x[k] = val; x.$src[k] = x.$src[k] || 'you' }
    switch (id) {
      case 'incomeDrop': set('income', Math.round(inc * 0.8)); if (v.incomeVar === 'variable') set('lowMonth', Math.round(v.lowMonth * 0.8)); break
      case 'jobLoss': set('income', 0); break
      case 'rentUp': set('housingCost', r10(v.housingCost * 1.15)); break
      case 'newDebt': { const bal = r10(inc * 2); set('debts', [...v.debts, { id: 'whatif', name: 'New loan', kind: 'loan', balance: bal, min: r10((bal / 24) * 1.13), apr: 24 }]); break }
      case 'newGoal': set('goals', [...v.goals, { id: 'whatif', name: 'New goal', target: r10(inc * 3), saved: 0, months: 12 }]); break
      case 'debtFast': set('aim', 'debt'); set('lean', 15); break
      case 'saveMore': set('aim', 'safety'); set('lean', 0); break
      case 'moreFun': set('lean', 100); if (v.lifestyle !== 'comfortable') set('lifestyle', v.lifestyle === 'minimal' ? 'balanced' : 'comfortable'); break
      case 'moveOut': { const rent = v.housing === 'rent' || v.housing === 'mortgage' ? r10(v.housingCost * 1.1) : r10(Math.min(b.rent[HH(v)], inc * 0.35)); set('goals', [...v.goals, { id: 'whatif', name: 'Move-out fund', target: rent * 3, saved: 0, months: 6 }]); x.$after = { rent }; break }
    }
    return x
  }
  function afterMove(x) {
    const y = JSON.parse(JSON.stringify(x))
    y.goals = (y.goals || []).filter((g) => g.id !== 'whatif'); y.housing = 'rent'; y.housingCost = y.$after.rent; y.utilIncl = false
    y.$src = { ...y.$src, housing: 'you', housingCost: 'you', utilIncl: 'you', goals: y.$src.goals || 'you' }
    return y
  }
  function runScenario(input, edits, id) {
    const base = settle(build(input), edits), x = scenario(input, id), sc = settle(build(x), edits)
    const out = { id, base: metrics(base), sc: metrics(sc), st: sc, baseSt: base }
    if (id === 'jobLoss') { const burn = out.base.bare, sav = base.v.savings; out.job = { burn, after: Math.round(sav - 2 * burn), runway: burn > 0 ? sav / burn : 0 } }
    if (id === 'moveOut') { const a = settle(build(afterMove(x)), {}); out.after = metrics(a); out.rent = x.$after.rent }
    return out
  }

  root.Engine = { FX, conv, bench, complete, build, settle, metrics, risks, payoff, impact, queue, QUESTIONS, QBY, withFact, shapes, SCENARIOS, runScenario, aprOf, sum, r10, monthsSince, safetyTarget, incomeOf, META }
})(typeof globalThis !== 'undefined' ? globalThis : this)
