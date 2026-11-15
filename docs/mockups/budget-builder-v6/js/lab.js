/* The owner's tools around the phone: persona rail, inspector, flow map, simulation lab and decisions. English only by design. */
;(function () {
  'use strict'
  const E = window.Engine, Dt = window.Data, App = window.App
  const $ = (id) => document.getElementById(id)
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const ic = (n) => `<i data-lucide="${n}"></i>`
  const mny = (n, cur) => { const s = Dt.SYMBOL[cur]; return (n < 0 ? '-' : '') + s + (s.length > 1 ? ' ' : '') + Math.abs(Math.round(n)).toLocaleString('en-US') }
  const icons = () => window.lucide && window.lucide.createIcons()
  const QL = { household: 'Who lives on this income', housing: 'Where you live', housingCost: 'Housing cost', incomeVar: 'Is income steady', lowMonth: 'Slow-month income', debts: 'Debts', savings: 'Savings', support: 'Money sent to family', goals: 'Goals', school: 'School or childcare', utilIncl: 'Rent includes utilities', transport: 'Getting around', annual: 'Yearly costs', gameya: "Gam'eya", lifestyle: 'Spending style', eatOut: 'Eating out', zakat: 'Zakat', cash: 'Mostly cash' }
  const qLabel = (it) => (it.kind === 'stale' ? `Re-check ${it.fact}` : it.kind === 'conflict' ? 'Which rent is right' : QL[it.id] || it.id)
  let tab = 'exp'
  const L = { pid: 'nour', c: {}, sc: null }

  function setTab(t) {
    tab = t
    for (const b of document.querySelectorAll('[data-tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === t))
    for (const k of ['exp', 'map', 'lab', 'dec']) $('tab-' + k).hidden = k !== t
    if (t === 'map') renderMap()
    if (t === 'lab') renderLab()
    if (t === 'dec') renderDec()
    window.scrollTo(0, 0)
  }
  document.querySelector('.tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab) })
  for (const n of document.querySelectorAll('[data-bud]')) n.innerHTML = window.budSvg(n.dataset.bud)

  /* ------------------------------------------------------------ rail */
  function renderLeft() {
    const S = App.state(), d = App.savedDraft()
    $('plist').innerHTML = Object.values(Dt.PERSONAS).map((p) => `<button class="pcard" data-p="${p.id}" aria-pressed="${S.pid === p.id}"><span class="ava">${p.name[0]}</span><span class="grow"><b>${p.name}</b><span>${p.title}</span></span></button>`).join('')
    $('simctl').innerHTML = `<div class="eyebrow">Conditions</div>
      ${[['ai', 'AI available'], ['online', 'Online'], ['newDevice', 'New device (empty phone)'], ['slow', 'Slow account load']].map(([k, l]) => `<label class="sw">${l}<input type="checkbox" data-sim="${k}" ${S.sim[k] ? 'checked' : ''}></label>`).join('')}
      <div class="sw">Language<span class="seg">${[['en', 'English'], ['ar', 'العربية']].map(([k, l]) => `<button data-lang="${k}" aria-pressed="${S.lang === k}">${l}</button>`).join('')}</span></div>
      <div class="sw">Theme<span class="seg">${[['', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].map(([k, l]) => `<button data-th="${k}" aria-pressed="${(S.theme || '') === k}">${l}</button>`).join('')}</span></div>
      <div class="row" style="margin-top:8px"><button class="btn s" data-do="restart">${ic('rotate-ccw')}Restart</button>${d ? `<button class="btn s" data-do="restore">${ic('bookmark')}Resume saved draft (${Dt.PERSONAS[d.pid].name})</button>` : ''}</div>`
  }
  document.querySelector('.left').addEventListener('click', (e) => {
    const p = e.target.closest('[data-p]'), l = e.target.closest('[data-lang]'), th = e.target.closest('[data-th]'), d = e.target.closest('[data-do]')
    if (p) App.start(p.dataset.p)
    if (l) App.setLang(l.dataset.lang)
    if (th) App.setTheme(th.dataset.th || null)
    if (d && d.dataset.do === 'restart') { App.clearSaved(); App.start(App.state().pid, App.state().tw) }
    if (d && d.dataset.do === 'restore') App.restore()
  })
  document.querySelector('.left').addEventListener('change', (e) => { const s = e.target.closest('[data-sim]'); if (s) { App.state().sim[s.dataset.sim] = s.checked; App.render() } })

  /* ------------------------------------------------------------ inspector */
  const INFO = {
    welcome: ['Sign in', 'Account creation. The ribbon previews what the person gets in a minute: a whole month, coloured by job.', ['user']],
    gate: ['Hydration gate', 'Waits for the account to answer before deciding "new user". An empty phone is never treated as a new person.', ['det']],
    setup: ['Account setup, one screen', 'Language and country come from the phone; the currency is asked explicitly because it becomes the budget currency. Name is optional. About ten seconds.', ['user', 'det']],
    home0: ['Returning user', 'Shows what the account already holds. The first budget is built from it immediately; nothing is re-asked.', ['det']],
    start: ['One number', 'Monthly take-home, as one or several sources in any currency. Or words and voice, read by the simulated AI. Or "no regular income".', ['user', 'ai']],
    building: ['Build', 'The engine runs on the phone. A second request while one runs is ignored.', ['det']],
    canvas: ['The budget canvas', 'The budget exists from the first second. Everything unknown is a labelled typical cost. The dock shows the single most useful question; answering it snaps lines from estimate to solid.', ['det', 'user']],
    shapes: ['Let Buddgy finish', 'Three shapes on identical facts, each calculated by the engine. The AI never invents amounts; it would only word the explanation.', ['det', 'user']],
    activate: ['Activate', 'The only step that writes outside the draft. AI-read facts must be confirmed first.', ['user', 'det']],
    live: ['Live', 'Value shown, then permissions.', ['det']], sms: ['SMS permission', 'After activation, native only, declinable.', ['user']], push: ['Notifications', 'In-app ask first, never a cold system dialog.', ['user']],
    month: ['First month', 'Tracking against the budget. Transfers and repayments are recognised and never counted twice. Day-3 check-in replaces estimates with real spending.', ['det']],
  }
  const WHO = { user: ['you', 'Person decides'], det: ['rule', 'Deterministic engine'], ai: ['ai', 'Simulated AI'] }
  function renderInsp() {
    const S = App.state(), info = INFO[S.screen] || ['', '', []]
    let mid = ''
    if (['canvas', 'activate', 'shapes'].includes(S.screen)) {
      const st = App.compute(), m = st.m, Q = E.queue(S.input, S.edits)
      mid = `<div class="panel"><div class="row sb"><h3>Question queue, live</h3><span class="xs mut">${Q.length} left</span></div>
        <p class="xs mut">Each candidate fact is priced by building the budget at a low and a high plausible value. Re-checks first, then the five core questions everyone gets, then the rest by impact. Anything under ${mny(10, S.input.cur)} never appears.</p>
        <div class="scroll-x"><table><tr><th>Card</th><th>Type</th><th class="r">Could move</th></tr>${Q.map((it, i) => `<tr${i === 0 ? ' class="hi"' : ''}><td>${qLabel(it)}</td><td>${it.kind === 'q' ? (it.core ? 'core' : 'impact') : it.kind}</td><td class="r num">±${mny(it.impact, S.input.cur)}</td></tr>`).join('') || '<tr><td colspan="3" class="mut">Nothing left worth asking.</td></tr>'}</table></div></div>
        <div class="panel"><h3>Engine output</h3><dl class="kv"><dt>Basis</dt><dd class="num">${mny(st.basis, S.input.cur)} (${st.basisKind})</dd><dt>Lines</dt><dd>${m.lines}: ${m.ownLines} solid, ${m.shaped} typical-from-answers, ${m.guesses} guesses, ${m.aiLines} heard</dd><dt>From own numbers</dt><dd>${m.own}% of the money</dd><dt>Reconciles</dt><dd>${st.over > 0 ? `<span class="tag bad">short by ${mny(st.over, S.input.cur)}</span>` : '<span class="tag ok">income = sum of lines</span>'}</dd>${st.moved && st.moved.length ? `<dt>Rebalanced</dt><dd>${st.moved.map((x) => `${x.name} −${x.by}`).join(', ')}</dd>` : ''}</dl></div>`
    }
    const c = E.complete(S.input), reg = Object.keys(c.src).filter((k) => !['country', 'cur', 'bills', 'subs', 'subsCount', 'arrears', 'history', 'sources', 'share', 'cash'].includes(k) || c.src[k] !== 'estimate')
    $('insp').innerHTML = `<div class="panel"><div class="row sb"><div class="eyebrow">Under the hood</div><span class="who">${info[2].map((w) => `<span class="tag ${WHO[w][0]}">${WHO[w][1]}</span>`).join('')}</span></div><h2>${info[0]}</h2><p class="sm mut">${info[1]}</p>
        <div class="row"><button class="btn s pri" data-do="auto">${ic('play')}Auto-play next step as ${esc(S.P.name)}</button><button class="btn s" data-do="map">${ic('workflow')}Flow map</button></div></div>${mid}
      <div class="panel"><h3>Facts and where they came from</h3><div class="reg scroll-x"><table><tr><th>Fact</th><th>Value</th><th>Source</th></tr>${reg.map((k) => { const v = c.v[k]; return `<tr><td><code>${k}</code></td><td class="num">${esc(Array.isArray(v) ? v.length + ' item(s)' : typeof v === 'number' ? v.toLocaleString('en-US') : String(v))}</td><td><span class="tag ${c.src[k] === 'estimate' ? 'guess' : c.src[k] === 'ai' ? 'ai' : c.src[k] === 'you' ? 'you' : 'records'}">${c.src[k]}${(S.input.$at || {})[k] ? ' ' + S.input.$at[k] : ''}</span></td></tr>` }).join('')}</table></div>
        <p class="xs mut">Merge rule: you &gt; records &gt; heard by AI &gt; default. A weaker source never overwrites a stronger one; a disagreement becomes a card.</p></div>
      <div class="panel"><h3>Event log</h3><div class="log">${S.log.map((l) => `<div><time>${l.at}</time>${l.kind === 'ok' ? '<span class="tag ok">ok</span> ' : l.kind === 'warn' ? '<span class="tag guess">note</span> ' : ''}${esc(l.msg)}</div>`).join('')}</div></div>`
  }
  $('insp').addEventListener('click', (e) => { const d = e.target.closest('[data-do]'); if (!d) return; if (d.dataset.do === 'auto') App.autoStep(); if (d.dataset.do === 'map') setTab('map') })

  /* ------------------------------------------------------------ flow map */
  const LANES = [
    ['1 · Account, about 10 seconds', 'Asked once, belongs to the account, nothing financial.', [
      ['welcome', 'Sign in', ['user'], ['Apple, Google, email']],
      ['gate', 'Hydration gate', ['det'], ['Has data → Home', 'Empty account → setup', 'Offline and empty phone → wait, never guess']],
      ['setup', 'One-screen setup', ['user', 'det'], ['Language, country prefilled from the phone', 'Currency asked explicitly', 'Name optional', 'Time zone and week from the phone']],
    ]],
    ['2 · A budget in one step', 'The budget exists before any question.', [
      ['home0', 'Returning: build from what is known', ['det'], ['Records, history, debts, goals reused', 'Draft resumes here']],
      ['start', 'One number', ['user'], ['Several sources, any currency', 'No regular income → spending plan']],
      ['words', 'Or in words or voice', ['ai', 'user'], ['Simulated AI reads facts', 'Out-of-scale figures flagged', 'AI down → number only']],
      ['heard', 'Buddgy heard', ['ai', 'user'], ['Each fact removable', 'Stays marked until confirmed', 'Blocks activation until confirmed']],
      ['modes', 'Aim and how to finish', ['user'], ['Aim: everything, safety, goal, debt', 'Let Buddgy finish / Together / Myself']],
    ]],
    ['3 · Finish it your way', 'One canvas, three ways to complete it, switchable without loss.', [
      ['shapes', 'Let Buddgy finish', ['det', 'user'], ['Three shapes on the same facts', 'Pick one, then edit anything', 'Offers the 3 answers worth giving']],
      ['sharpen', 'Sharpen together', ['det', 'user'], ['One card at a time, most useful first', 'Core five always asked', '"Not sure" keeps a labelled estimate', 'Lines snap from estimate to solid']],
      ['self', "I'll do it myself", ['user'], ['Own lines, own amounts', 'Typical costs as hints only', 'Left to assign always visible']],
    ]],
    ['4 · Understand and adjust', 'Every amount explained; the person stays in control.', [
      ['line', 'Line detail', ['user', 'det'], ['Reason, source, range for estimates', 'Edit pins the amount', 'Rebalance from wants, never essentials']],
      ['pay', 'Payday view', ['det'], ['The order each part of income goes']],
      ['year', '12-month view', ['det'], ['Safety net full, goals reached, debts cleared']],
      ['adjust', 'Ask Buddgy', ['ai', 'det', 'user'], ['Words → proposal, priced by the engine', 'Apply or decline; declines remembered']],
      ['whatif', 'What if', ['det'], ['Nine scenarios on a copy', 'Never changes the budget', 'Keep as a separate draft']],
    ]],
    ['5 · Live', 'Records are written only here.', [
      ['activate', 'Activate', ['user', 'det'], ['Lists what will be created', 'Works offline, syncs later', 'Or save as a draft']],
      ['live', 'Permissions after value', ['user'], ['SMS (native only)', 'Notifications', 'Both declinable']],
      ['month', 'First month', ['det'], ['Spending against lines', 'Day-3 check-in', 'Month review proposes changes']],
    ]],
  ]
  function renderMap() {
    const S = App.state()
    const cur = S.sheet && ['line', 'adjust', 'whatif'].includes(S.sheet.type) ? S.sheet.type : S.screen === 'canvas' ? (S.tab !== 'plan' ? S.tab : S.mode === 'self' ? 'self' : S.sheet && S.sheet.type === 'modes' ? 'modes' : S.heard.length ? 'heard' : 'sharpen') : S.screen === 'start' && S.words ? 'words' : ['sms', 'push'].includes(S.screen) ? 'live' : S.screen
    let n = 0
    $('tab-map').innerHTML = `<h1>The journey</h1><p class="mut">Every card is a real stage of the prototype; the highlighted one is where the phone is. "Open" jumps the phone there as ${esc(S.P.name)}.</p>
      <div class="row">${Object.values(WHO).map(([c, l]) => `<span class="tag ${c}">${l}</span>`).join('')}</div>
      <div class="panel" style="margin-top:12px"><h2>What is new in this design</h2><div class="cards">
        <div class="sc"><b>Budget first</b><span class="sm mut">One number gives a complete, balanced budget in about a second. Questions only refine it.</span></div>
        <div class="sc"><b>Questions earn their place</b><span class="sm mut">Each unknown is priced by how far it could move this person's budget. Five core facts are always asked.</span></div>
        <div class="sc"><b>Honest progress</b><span class="sm mut">The ring shows how much of the money rests on the person's own numbers, never a "% sure".</span></div>
        <div class="sc"><b>Edits that rebalance</b><span class="sm mut">Changing a line sets it; Buddgy funds it from wants and says exactly what moved.</span></div></div></div>
      ${LANES.map(([name, sub, stages]) => `<div class="lane"><h2>${name}</h2><span class="sm mut">${sub}</span></div><div class="flow">${stages.map(([id, title, who, bullets]) => `<div class="st${cur === id ? ' cur' : ''}"><h3><span class="n">${++n}</span>${title}</h3><div class="who">${who.map((w) => `<span class="tag ${WHO[w][0]}">${WHO[w][1]}</span>`).join('')}</div><ul>${bullets.map((b) => `<li>${b}</li>`).join('')}</ul><div class="push"><button class="btn s" data-goto="${id}">${ic('smartphone')}Open</button></div></div>`).join('')}</div>`).join('')}
      <div class="lane"><h2>All candidate questions</h2><span class="sm mut">Status for ${esc(S.P.name)} right now.</span></div>
      <div class="panel scroll-x"><table><tr><th>Question</th><th>Asked when</th><th>Low / high tested</th><th>Now</th></tr>${E.QUESTIONS.map((q) => {
        const c = E.complete(S.input), applies = !q.when || q.when(c.v), known = q.fact === 'household' ? c.src.adults !== 'estimate' : c.src[q.fact] !== 'estimate'
        const it = E.queue(S.input, S.edits).find((x) => x.id === q.id)
        const alts = q.alts(c.v).map((a) => (typeof a === 'object' ? (Array.isArray(a) ? (a.length ? 'one typical debt/goal' : 'none') : `${a.adults}+${a.kids}`) : typeof a === 'number' ? mny(a, S.input.cur) : String(a))).join(' / ')
        return `<tr class="${known ? '' : applies ? '' : 'na'}"><td>${QL[q.id]}${q.core ? ' <span class="tag you">core</span>' : ''}</td><td class="xs">${q.when ? esc(String(q.when).replace(/^\(?v\)?\s*=>\s*/, '').slice(0, 60)) : 'always'}</td><td class="xs">${esc(alts)}</td><td>${known ? `<span class="tag records">known</span>` : !applies ? '<span class="tag">does not apply</span>' : it ? `<span class="tag guess">±${mny(it.impact, S.input.cur)}</span>` : '<span class="tag">kept as estimate</span>'}</td></tr>` }).join('')}</table></div>`
    icons()
  }
  $('tab-map').addEventListener('click', (e) => { const g = e.target.closest('[data-goto]'); if (g) { App.goto(g.dataset.goto); setTab('exp') } })

  /* ------------------------------------------------------------ lab */
  const EDGES = [
    ['noIncome', 'No income', 'A spending plan with a cushion instead of failure; saving and goals wait, and it says so.'],
    ['missing', 'Missing information', 'Only income known. The budget is complete anyway; every unknown is a labelled typical cost.'],
    ['conflict', 'Conflicting data', 'Profile rent and six months of payments disagree. A card asks which; nothing is picked silently.'],
    ['expired', 'Expired information', 'Rent last confirmed 14 months ago comes back as a one-tap re-check, first in the queue.'],
    ['aiDown', 'AI unavailable', 'Words cannot be read; one number still builds the whole budget. Nothing else changes.'],
    ['offline', 'Offline', 'Banner, local saving, engine on the phone, activation queued.'],
    ['slow', 'Delayed hydration', 'The gate keeps waiting and says why. No setup screens while the account loads.'],
    ['newDevice', 'Returning user, new device', 'Empty phone, full account: lands on Home with data, not in setup.'],
    ['abandon', 'Abandoned midway', 'Three answers, then "save and finish later". Resumes at the same card.'],
    ['dupBuild', 'Duplicate build', 'A second build tap 400 ms later is ignored.'],
    ['badGoal', 'Unrealistic goal', 'A 2,000,000 goal in 6 months: funded at what fits, with the real time it would take.'],
    ['multiCur', 'Multi-currency income', 'Two AED salaries and USD rent income, converted into one budget currency on the first screen.'],
  ]
  const SCN = { incomeDrop: 'Income drops 20%', jobLoss: 'No income for a while', rentUp: 'Rent up 15%', newDebt: 'New loan', newGoal: 'New goal', debtFast: 'Pay debt aggressively', saveMore: 'Save as much as possible', moreFun: 'More breathing room', moveOut: 'Move out in 6 months' }
  const slider = (key, label, v, max, step, cur) => `<label><span>${label}<em>${cur ? mny(v, cur) : v}</em></span><input type="range" data-c="${key}" min="0" max="${Math.max(max, v)}" step="${step}" value="${v}"></label>`
  function renderLab() {
    const base = Dt.PERSONAS[L.pid], p = Dt.variant(base, L.c), t = p.t, cur = p.cur
    const w = Dt.walk(p), st = E.settle(E.build(w.input)), m = E.metrics(st), rk = E.risks(st)
    const inc = Math.max(E.incomeOf(t.sources, cur), 1000), stp = Math.max(10, E.r10(inc / 100))
    const d0 = t.debts.find((x) => x.kind !== 'bnpl')
    const shapes = E.shapes(w.input), scn = E.SCENARIOS.map((id) => E.runScenario(w.input, {}, id)), sel = L.sc && scn.find((r) => r.id === L.sc)
    const BL = ['home', 'debt', 'living', 'life', 'safety', 'goals', 'future', 'free'], COL = { home: 'c4', debt: 'c3', living: 'c5', life: 'c6', safety: 'c1', goals: 'c2', future: 'c7', free: 'c0' }
    const tot = (s, b) => E.sum(s.lines.filter((l) => l.block === b).map((l) => l.amount))
    const rib = (s) => `<div class="wbar">${BL.map((b) => `<i style="width:${(tot(s, b) / Math.max(1, E.sum(s.lines.map((l) => l.amount)))) * 100}%;background:var(--${COL[b]})"></i>`).join('')}</div>`
    const reach = w.steps.findIndex((s) => s.own >= 80)
    const mo = (v) => (v == null ? 'not at this pace' : v === 0 ? 'now' : v + ' mo')
    $('tab-lab').innerHTML = `<h1>Simulation lab</h1><p class="mut">Pick a person, change their circumstances, and watch which questions earn a place and what the engine builds. The person answers each card truthfully, most useful first.</p>
      <div class="tabs" style="margin:10px 0 14px">${Object.values(Dt.PERSONAS).map((x) => `<button data-lp="${x.id}" aria-selected="${L.pid === x.id}">${x.name}</button>`).join('')}</div>
      <div class="grid2"><div class="panel"><b>${base.title}</b><p class="sm mut">${base.sub}</p><div class="ctl">
        <label><span>What Buddget already holds</span><select data-c="level">${[['none', 'Nothing (new account)'], ['profile', 'A profile: income, household, home'], ['full', 'Full history: records, bills, debts, goals']].map(([k, l]) => `<option value="${k}" ${p.level === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <div class="row nowrap"><label class="grow"><span>Country</span><select data-c="country">${['EG', 'AE', 'SA', 'OTHER'].map((k) => `<option ${p.country === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label><label class="grow"><span>Currency</span><select data-c="cur">${Object.keys(Dt.SYMBOL).map((k) => `<option ${cur === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label></div>
        ${slider('income', 'Monthly income (own currency)', E.sum(t.sources.filter((s) => !s.cur).map((s) => s.amount)), inc * 3, stp, cur)}
        <label><span>Income stability</span><select data-c="stability"><option value="fixed" ${t.incomeVar !== 'variable' ? 'selected' : ''}>Steady</option><option value="variable" ${t.incomeVar === 'variable' ? 'selected' : ''}>Changes</option></select></label>
        ${t.incomeVar === 'variable' ? slider('lowMonth', 'Slow-month income', t.lowMonth || 0, inc, stp, cur) : ''}
        ${slider('housingCost', t.housing === 'family' ? 'Home contribution' : 'Housing cost a month', t.housingCost || 0, inc, stp, cur)}
        <div class="row nowrap"><label class="grow"><span>Adults</span><input type="number" data-c="adults" min="1" max="4" value="${t.adults}"></label><label class="grow"><span>Children</span><input type="number" data-c="kids" min="0" max="8" value="${t.kids || 0}"></label></div>
        ${slider('savings', 'Savings', t.savings || 0, inc * 12, stp * 5, cur)}
        ${slider('debtBalance', 'Main debt balance', d0 ? d0.balance : 0, inc * 15, stp * 5, cur)}
        ${d0 ? slider('debtMin', 'Its monthly payment', d0.min, inc, stp, cur) + slider('debtApr', 'Its interest, % a year', d0.apr != null ? d0.apr : 28, 45, 1) : ''}
        ${p.level === 'full' ? slider('subs', 'Subscriptions a month', t.subs || 0, E.r10(inc * 0.1), Math.max(5, stp / 2), cur) + slider('historyMonths', 'Months of transaction history', t.history ? t.history.months : 0, 12, 1) : ''}
        <label><span>Spending style</span><select data-c="lifestyle">${['minimal', 'balanced', 'comfortable'].map((k) => `<option ${t.lifestyle === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
        ${slider('goalTarget', 'Main goal target', t.goals[0] ? t.goals[0].target : 0, Math.max(inc * 30, t.goals[0] ? t.goals[0].target : 0), stp * 10, cur)}
        ${t.goals[0] ? slider('goalMonths', 'Goal deadline (months)', t.goals[0].months, 72, 1) : ''}
        ${base.accounts ? `<label><span>Accounts linked</span><input type="number" data-c="accounts" min="1" max="${base.accounts.length}" value="${(p.accounts || []).length}"></label>` : ''}
        <div class="row"><button class="btn s" data-lab="reset">${ic('rotate-ccw')}Reset</button><button class="btn s pri" data-lab="open">${ic('smartphone')}Play this person on the phone</button></div></div></div>
      <div>
        <div class="cards k4">${[[w.steps.length - 1, 'cards worth asking'], [`${w.steps[0].own}% → ${m.own}%`, 'of the money from own numbers'], [reach < 0 ? '–' : reach, 'answers to reach 80%'], [st.over > 0 ? mny(st.over, cur) : 'balanced', st.over > 0 ? 'monthly shortfall' : 'income = lines']].map(([v, l]) => `<div class="sc"><b class="num big2">${v}</b><span class="sm mut">${l}</span></div>`).join('')}</div>
        <div class="panel"><h3>The question path, and what each answer did</h3><div class="steps">${w.steps.slice(1).map((s) => `<div class="stp-row"><span class="tag ${s.kind !== 'q' ? 'records' : s.core ? 'you' : ''}">${s.kind !== 'q' ? s.kind : s.core ? 'core' : 'impact'}</span><span class="grow">${qLabel(s)}</span><span class="num xs mut">±${mny(s.impact, cur)}</span><span class="bar"><i style="width:${s.own}%"></i></span><span class="num xs">${s.own}%</span></div>`).join('') || '<p class="sm mut">Nothing to ask: everything that matters is already known.</p>'}</div>
          <p class="xs mut">Bars show the share of the budget's money resting on the person's own numbers after each answer. Lifestyle and everyday lines stay "typical cost" until there is real spending, which is honest: answers shape them but cannot confirm them.</p></div>
        <div class="panel"><div class="row sb"><h3>Budget</h3><span class="xs mut">${st.basisKind === 'floor' ? `planned on slow month of ${mny(st.basis, cur)}` : mny(st.basis, cur)}</span></div>${rib(st)}
          <div class="scroll-x"><table><tr>${BL.map((b) => `<th class="r"><span style="color:var(--${COL[b]})">●</span> ${b}</th>`).join('')}</tr><tr>${BL.map((b) => `<td class="r num">${mny(tot(st, b), cur)}</td>`).join('')}</tr></table></div>
          <dl class="kv"><dt>Safety net</dt><dd>${m.held.toFixed(1)} of ${m.targetMonths} months held; full in ${mo(m.safetyFull)}; savings last ${m.runway.toFixed(1)} months on bare costs</dd>${m.hasDebt ? `<dt>Debt-free</dt><dd>${mo(m.debtFree)}${m.extra ? `, ${Math.max(0, (m.debtFreeMin || 0) - (m.debtFree || 0))} mo sooner and ${mny(Math.max(0, m.interestMin - m.interest), cur)} less interest than minimums` : ''}</dd>` : ''}${m.goalsOut.map((g) => `<dt>${esc(g.name)}</dt><dd>${mny(g.funded, cur)} of ${mny(g.need, cur)} a month → ${mo(g.months)} (wanted ${g.want}) ${g.onTime ? '<span class="tag ok">on time</span>' : '<span class="tag guess">later</span>'}</dd>`).join('')}</dl>
          ${rk.length ? `<ul class="sm risks">${rk.map((r) => `<li class="${r[0]}">${r[1].replace('r.', '')}: ${esc(JSON.stringify(r[2]))}</li>`).join('')}</ul>` : ''}
          <details><summary class="sm">All ${st.lines.length} lines with source and confidence</summary><div class="scroll-x"><table><tr><th>Line</th><th class="r">Amount</th><th>Source</th><th>Confidence</th></tr>${st.lines.map((l) => `<tr><td>${esc(l.raw ? l.name : l.key)}<div class="xs mut">${l.block}</div></td><td class="r num">${mny(l.amount, cur)}</td><td>${l.src}</td><td><span class="tag ${l.conf === 'high' ? 'you' : l.conf}">${l.conf}</span></td></tr>`).join('')}</table></div></details></div>
        <div class="panel"><h3>Let Buddgy finish: three shapes on the same facts</h3><div class="cards">${shapes.map((s) => `<div class="sc"><b>${s.id}</b>${rib(s.st)}<span class="xs">Lifestyle ${mny(s.m.life, cur)} · safety full ${mo(s.m.safetyFull)}${s.m.hasDebt ? ` · debt-free ${mo(s.m.debtFree)}` : ''}${s.m.goalsOut[0] ? ` · goal ${mo(s.m.goalsOut[0].months)}` : ''}</span></div>`).join('')}</div></div>
        <div class="panel"><h3>What if</h3><div class="cards">${scn.map((r) => { const dv = r.sc.saving - r.base.saving; return `<button class="sc" data-sc="${r.id}" aria-pressed="${L.sc === r.id}"><b>${SCN[r.id]}</b><span class="num ${r.sc.over > r.base.over || dv < 0 ? 'dn' : 'up'}">${r.sc.over > 0 ? 'short ' + mny(r.sc.over, cur) : (dv >= 0 ? '+' : '') + mny(dv, cur) + ' set aside'}</span><span class="xs mut">${r.job ? `savings last ${r.job.runway.toFixed(1)} mo` : r.after ? `after the move: ${r.after.over > 0 ? 'short ' + mny(r.after.over, cur) : 'balanced'}` : r.sc.hasDebt ? `debt-free ${mo(r.sc.debtFree)}` : `runway ${r.sc.runway.toFixed(1)} mo`}</span></button>` }).join('')}</div>
          ${sel ? `<div class="scroll-x" style="margin-top:10px"><table><tr><th>${SCN[sel.id]}</th><th class="r">Now</th><th class="r">What if</th></tr>${[['Income basis', 'basis'], ['Home and bills', 'home'], ['Debt payments', 'debt'], ['Everyday', 'living'], ['Lifestyle', 'life'], ['Safety net', 'safetyAmt'], ['Goals', 'goals'], ['Shortfall', 'over']].map(([l, k]) => `<tr><td>${l}</td><td class="r num">${mny(sel.base[k], cur)}</td><td class="r num">${mny(sel.sc[k], cur)}</td></tr>`).join('')}<tr><td>Months savings last</td><td class="r">${sel.base.runway.toFixed(1)}</td><td class="r">${sel.sc.runway.toFixed(1)}</td></tr></table></div>` : ''}</div>
      </div></div>
      <div class="lane"><h2>Edge cases</h2><span class="sm mut">Each plays on the phone; the event log explains what happened.</span></div>
      <div class="cards">${EDGES.map(([id, n, d]) => `<div class="sc"><b>${n}</b><span class="sm mut">${d}</span><div class="push"><button class="btn s" data-edge="${id}">${ic('play')}Play</button></div></div>`).join('')}</div>`
    icons()
  }
  $('tab-lab').addEventListener('click', (e) => {
    const lp = e.target.closest('[data-lp]'), sc = e.target.closest('[data-sc]'), ed = e.target.closest('[data-edge]'), lb = e.target.closest('[data-lab]')
    if (lp) { L.pid = lp.dataset.lp; L.c = {}; L.sc = null; renderLab() }
    if (sc) { L.sc = L.sc === sc.dataset.sc ? null : sc.dataset.sc; renderLab() }
    if (ed) { App.edge(ed.dataset.edge); setTab('exp') }
    if (lb && lb.dataset.lab === 'reset') { L.c = {}; renderLab() }
    if (lb && lb.dataset.lab === 'open') { App.start(L.pid, { ...L.c }); setTab('exp') }
  })
  const onCtl = (e) => {
    const n = e.target.closest('[data-c]'); if (!n) return
    const k = n.dataset.c
    L.c[k] = n.type === 'range' || n.type === 'number' ? Number(n.value) : n.value
    if (k === 'country') L.c.cur = Dt.COUNTRIES[n.value].cur
    renderLab()
    const f = document.querySelector(`#tab-lab [data-c="${k}"]`); if (f && n.type !== 'range') f.focus()
  }
  $('tab-lab').addEventListener('change', onCtl)
  $('tab-lab').addEventListener('input', (e) => { if (e.target.type === 'range') { const k = e.target.dataset.c; L.c[k] = Number(e.target.value); clearTimeout(onCtl.t); onCtl.t = setTimeout(() => { renderLab(); const f = document.querySelector(`#tab-lab [data-c="${k}"]`); if (f) f.focus() }, 120) } })

  /* ------------------------------------------------------------ decisions */
  function renderDec() {
    const v = (a, s, p, c) => `<div class="voices"><div class="voice"><b>Architect (Fable, then Opus)</b>${a}</div><div class="voice"><b>Skeptic (Sonnet)</b>${s}</div><div class="voice"><b>Pragmatist (Sonnet)</b>${p}</div><div class="voice"><b>Critic (Opus)</b>${c}</div></div>`
    $('tab-dec').innerHTML = `<h1>Decisions and what needs your call</h1>
      <p class="mut">Built from scratch as you asked: new flow, new screens, and a new engine written for this prototype. Nothing here runs the current app's budget code. The previous prototype (v5) is untouched at its own link.</p>
      <div class="panel"><h2>The concept in one line</h2><p><b>Show the budget first, then let the person sharpen it.</b> One number produces a complete, balanced month of labelled estimates. Every question after that has to earn its place by how much it could change this person's budget.</p></div>
      <div class="panel"><h2>Council on the concept</h2>
        ${v('Budget first with ranked questions. The answer makes the estimate visibly solid, which is the reward for answering.', 'Ship the canvas, cut ranking and two of the modes: a fixed question order gets most of the value; three modes plus three views is six surfaces on day one.', 'Right concept, ship it in slices. Ranking is cheap: it is the engine run twice per fact. Warned that "41% sure" reads as a promise.', 'Go, after three fixes: what the ring means, floors under rebalance (family duties, gam\'eya, school terms, Eid), and multi-source income. Currency must be asked, not inferred.')}
        <p class="verdict"><b>What changed because of it:</b> the ring now shows the share of the money that rests on the person's own numbers, not a probability. Five core questions (household, home, steady pay, slow month, debts) are always asked, whatever the ranking says. Rebalance never touches essentials or commitments, and family support and gam'eya are commitments. Income takes several sources in any currency. Currency is an explicit choice on setup, with a warning that it becomes the budget currency. Rent can be entered per cheque (four a year) or per year.<br><b>Dissent kept:</b> the Skeptic would ship a fixed question order and one finish path. I kept ranking (cheap, and it is what makes questions disappear for data-rich users) and the three modes (your brief requires them), but production can launch "Sharpen together" first and add the other two behind it.</p></div>
      <div class="panel"><h2>Carried over from the first council</h2><ul class="q"><li>AI reads words and proposes; every amount comes from the deterministic engine. Nothing AI-read counts until confirmed, and activation is blocked until it is.</li><li>Records (debts, goals) are created only at activation. Drafts and what-ifs write nothing.</li><li>"New user" is decided only after the account answers, never from an empty phone.</li><li>Permissions are asked after the first budget is live.</li></ul></div>
      <div class="panel"><h2>How the engine works</h2><ol class="q">
        <li><b>Must-pay first,</b> exactly as stated or tracked: housing, bills, family support, gam'eya, school, debt payments, overdue catch-up. Utilities are estimated only when not included in rent and not tracked, so they are never counted twice.</li>
        <li><b>Everyday essentials</b> from the person's history where it exists (half weight if mostly cash), typical local costs otherwise. Each has a floor that is never cut; if fixed costs leave less than the floors, essentials stay in at the floor and the gap is shown.</li>
        <li><b>Then, in order:</b> zakat, yearly costs spread monthly, a starter safety net if under a month is saved, extra on debt over 15% a year (highest rate first), goals (capped together by the aim), safety net growth (3 months, 6 with children or changing pay, 9 with both), lifestyle scaled to what is left, investing only with no costly debt and 3 months saved, and a buffer so every unit has a job.</li>
        <li><b>Variable income</b> is planned on the slow month; anything above it goes to the safety net first.</li>
        <li><b>Edits</b> pin an amount; the rest rebalances from the buffer, then wants, investing, extra debt, safety, goals. The canvas says what moved.</li>
        <li><b>Question ranking:</b> for each unknown, the budget is built at a low and a high plausible value; the difference is the card's "could move by". Those low and high values are assumptions too, which is why the core five are asked regardless.</li></ol></div>
      <div class="panel"><h2>Known limits of this prototype</h2><ul class="q">
        <li>The engine is new prototype code, checked by <code>test.mjs</code> (every person, mode, shape and scenario reconciles exactly; pins never cut essentials). It has not been reviewed against real household data.</li>
        <li>Typical costs are internal heuristics with no outside source, version h-2026.11. Every estimate says so. Real regional data is the biggest open dependency.</li>
        <li>AI is simulated by pattern matching on the personas' own words (English and Arabic, Arabic digits, "alf"). No backend: sign-in, sync and permissions are staged. Drafts persist in this browser only.</li>
        <li>Exchange rates are fixed samples. All people and figures are fictional.</li>
        <li>The owner panels are in English; the phone is fully bilingual. Not tested on a device or with a screen reader.</li></ul></div>
      <div class="panel"><h2>Decisions that need you</h2><ol class="q">
        <li><b>Approve the concept:</b> budget first, then sharpen. Or ask for changes.</li>
        <li><b>The new engine.</b> This prototype replaces the current engine's logic rather than extending it. Production would port it into <code>src/lib/budget</code> with tests. Agree to replace, or port the fixes into the existing engine?</li>
        <li><b>The ring metric:</b> "share of the money from your own numbers". Keep it, show "lines confirmed" instead, or hide it until after the first month?</li>
        <li><b>Launch scope:</b> all three finishing modes and three views at once, or "Sharpen together" plus the Budget view first, then the rest?</li>
        <li><b>Core questions:</b> household, home, steady pay, slow month, debts. Add or remove any?</li>
        <li><b>Regional commitments</b> modelled so far: family support, gam'eya, school terms, yearly costs (Ramadan and Eid, residency, flights). Others to add as their own lines: domestic help, iqama, end-of-service?</li>
        <li><b>What-if:</b> keep all nine scenarios, a few, or drop (the earlier stress test was archived as unused)?</li>
        <li><b>Activating with a shortfall:</b> allow with the gap tracked (as shown), or block?</li>
        <li><b>Benchmarks:</b> who sources the typical costs per country and city before launch?</li></ol></div>`
    icons()
  }

  window.Lab = { sync: () => { renderLeft(); renderInsp(); if (tab === 'map') renderMap(); icons() }, setTab }
  window.Lab.sync()
})()
