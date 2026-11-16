/* The owner's tools around the phone: persona picker, inspector, flow map, simulation lab and the decision record. English only by design. */
;(function () {
  'use strict'
  const R = window.Real, X = window.Sim, P = window.Phone
  const $ = (id) => document.getElementById(id)
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const ic = (n) => `<i data-lucide="${n}"></i>`
  const mny = (n, cur) => { const s = X.SYMBOL[cur]; return (n < 0 ? '-' : '') + s + (s.length > 1 ? ' ' : '') + Math.abs(Math.round(n)).toLocaleString('en-US') }
  const icons = () => window.lucide && window.lucide.createIcons()
  let tab = 'exp'
  const L = { pid: 'nour', c: {}, sc: null, mod: 'all' }

  /* ------------------------------------------------------------ tabs */
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

  /* ------------------------------------------------------------ left rail */
  function renderLeft() {
    const S = P.state(), d = P.savedDraft()
    $('plist').innerHTML = Object.values(X.PERSONAS).map((p) => `<button class="pcard" data-p="${p.id}" aria-pressed="${S.pid === p.id}"><span class="ava">${p.name[0]}</span><span><b>${p.name}</b><span>${p.title}</span></span></button>`).join('')
    $('simctl').innerHTML = `<div class="eyebrow">Conditions</div>
      ${[['ai', 'AI available'], ['online', 'Online'], ['newDevice', 'New device (empty local store)'], ['slow', 'Slow account load']].map(([k, l]) => `<label class="sw">${l}<input type="checkbox" data-sim="${k}" ${S.sim[k] ? 'checked' : ''}></label>`).join('')}
      <div class="sw">Phone language<span class="seg"><button data-lang="en" aria-pressed="${S.lang === 'en'}">English</button><button data-lang="ar" aria-pressed="${S.lang === 'ar'}">العربية</button></span></div>
      <div class="sw">Phone theme<span class="seg"><button data-th="" aria-pressed="${!S.theme}">Auto</button><button data-th="light" aria-pressed="${S.theme === 'light'}">Light</button><button data-th="dark" aria-pressed="${S.theme === 'dark'}">Dark</button></span></div>
      <div class="row" style="margin-top:8px"><button class="btn s" data-do="restart">${ic('rotate-ccw')}Restart</button>${d ? `<button class="btn s" data-do="restore">${ic('bookmark')}Resume saved draft (${X.PERSONAS[d.pid].name}, ${d.pct}%)</button>` : ''}</div>
      <p class="xs mut" style="margin:8px 0 0">New-device and slow-load apply at sign-in. Conditions stay on until you switch them off.</p>`
  }
  document.querySelector('.left').addEventListener('click', (e) => {
    const p = e.target.closest('[data-p]'), l = e.target.closest('[data-lang]'), th = e.target.closest('[data-th]'), d = e.target.closest('[data-do]')
    if (p) P.start(p.dataset.p)
    if (l) P.setLang(l.dataset.lang)
    if (th) P.setTheme(th.dataset.th || null)
    if (d && d.dataset.do === 'restart') { P.clearSaved(); P.start(P.state().pid, P.state().tw) }
    if (d && d.dataset.do === 'restore') P.restore()
  })
  document.querySelector('.left').addEventListener('change', (e) => { const s = e.target.closest('[data-sim]'); if (s) { P.state().sim[s.dataset.sim] = s.checked; P.render() } })

  /* ------------------------------------------------------------ inspector */
  const INFO = {
    signin: ['Sign in', 'Account creation. Native sign-in is token-only in production; here it is one tap.', ['user']],
    hydrate: ['Hydration gate', 'The app waits for the account to load before deciding whether this is a new user. An empty local store is never treated as "new".', ['det']],
    lang: ['Account setup 1 of 3', 'Language. Sets direction (RTL or LTR) immediately.', ['user']], country: ['Account setup 2 of 3', 'Country suggests the currency; time zone and week start come from the device and are not asked.', ['user', 'det']],
    name: ['Account setup 3 of 3', 'Optional name. Nothing financial is asked in setup.', ['user']], home0: ['Home, no budget yet', 'A returning user lands here, never in account setup. Also where a saved draft waits.', ['det']],
    opener: ['Opener', 'Free text or voice. The reader fills answers to existing questions; it cannot invent a question or a number the person did not say.', ['user', 'ai']],
    understood: ['Confirm what was read', 'AI-read facts are shown before anything is saved. Each one can be fixed or removed. Implausible amounts are flagged.', ['ai', 'user']],
    modes: ['Aim and mode', 'One fact base, three ways to finish. The aim reorders the question modules; it does not change the engine.', ['user']],
    stale: ['Still right?', 'A fact older than its shelf life is re-confirmed instead of trusted or re-asked from scratch. New in this design.', ['det', 'user']],
    q: ['Adaptive question', 'Chosen by the production graph (nextQuestion). Fields that belong together share one screen and appear as their parent is answered.', ['det', 'user']],
    building: ['Build', 'The production engine (buildPlan) runs on the device. A second request while one is running is ignored.', ['det']],
    manual: ['Manual builder', 'No AI and no engine suggestions. Lines the person adds are theirs; switching mode later keeps them as locked amounts.', ['user']],
    review: ['Review', 'Every line shows amount, source and reason. Edits flow to the buffer; over-income plans cannot be activated unless the shortfall is unavoidable.', ['det', 'user']],
    activate: ['Activate', 'The only step that writes outside the budget: new debts and goals are created here, once.', ['user', 'det']], activated: ['Activated', 'Value has been shown. Only now are permissions offered.', ['det']],
    permSms: ['SMS permission', 'Asked after the first budget exists, native only, with a plain reason. Declining changes nothing else.', ['user']], permPush: ['Notification permission', 'An in-app ask first, never a cold system dialog.', ['user']],
    home: ['Active budget', 'Tracking against the plan. Transfers, top-ups and card repayments are recognised and not counted as spending.', ['det']],
  }
  const WHO = { user: ['you', 'User decides'], det: ['rule', 'Deterministic'], ai: ['ai', 'Simulated AI'] }
  const stageOf = (S) => (S.sheet ? { line: 'line', adjust: 'adjust', whatif: 'whatif', add: 'line', known: 'q', menu: S.screen }[S.sheet.type] : S.screen === 'q' ? (R.NODE_BY_ID.get(S.q.head).control === 'confirm' ? 'found' : R.NODE_BY_ID.get(S.q.head).needs ? 'checks' : 'q') : S.screen === 'permPush' || S.screen === 'permSms' || S.screen === 'activated' ? 'perms' : S.screen)
  const whenSrc = (x) => (x.when ? esc(String(x.when).replace(/^\(?s\)?\s*=>\s*/, '').replace(/\(0, derive_1\.(\w+)\)/g, '$1').replace(/derive_1\./g, '').slice(0, 170)) : 'always')

  function renderInsp() {
    const S = P.state(), info = INFO[S.screen] || ['', '', []]
    const rd = S.flow ? R.flowReadiness(S.flow) : null
    let why = ''
    if (S.screen === 'q') {
      const head = R.NODE_BY_ID.get(S.q.head)
      const nodes = R.screenNodes(S.flow, head, S.q.values, S.q.skips, S.q.reopen)
      why = `<div class="panel"><h3>Why this screen</h3><div class="scroll-x"><table><tr><th>Field</th><th>Tier</th><th class="r">Stake</th><th>Asked when</th></tr>${nodes.map((x) => `<tr><td><code>${x.id}</code></td><td>${x.needs ? 'check' : x.tier}</td><td class="r">${x.stake}</td><td><code>${whenSrc(x)}</code></td></tr>`).join('')}</table></div>
        <p class="xs mut" style="margin:8px 0 0">Module <code>${head.mod}</code>, screen group <code>${head.group}</code>. Core questions are always asked when needed; standard ones compete for 4 slots per run by stake; follow-ups appear only after their parent; checks fire once the modules they need are complete.</p></div>`
    }
    const reg = P.registry()
    let eng = ''
    if (S.flow && (rd.canBuild || S.mode === 'manual') && ['q', 'review', 'activate', 'manual'].includes(S.screen)) {
      const st = P.compute()
      eng = `<div class="panel"><h3>Engine output right now</h3><dl class="kv"><dt>Income basis</dt><dd class="num">${mny(st.income, S.profile.cur)}${st.basis === 'spend' ? ' (spend-based)' : ''}</dd><dt>Lines</dt><dd>${st.lines.length}, of which ${st.m.estimated} estimated</dd><dt>Reconciles</dt><dd>${st.over > 0 ? `<span class="tag bad">over by ${mny(st.over, S.profile.cur)}</span>` : '<span class="tag ok">income = sum of lines</span>'}</dd><dt>Risks raised</dt><dd>${st.risks.length}</dd></dl></div>`
    }
    $('insp').innerHTML = `<div class="panel"><div class="row" style="justify-content:space-between"><div class="eyebrow">Under the hood</div><span class="who">${info[2].map((w) => `<span class="tag ${WHO[w][0]}">${WHO[w][1]}</span>`).join('')}</span></div>
        <h2 style="margin-top:4px">${info[0]}</h2><p class="sm mut">${info[1]}</p>
        ${rd ? `<dl class="kv"><dt>Mode</dt><dd>${S.mode || 'not chosen'}</dd><dt>Aim</dt><dd>${S.flow.intent}</dd><dt>Ready</dt><dd>${rd.percent}%${rd.canBuild ? ', can build' : ', needs income and housing'}</dd></dl><div class="meter" style="margin-top:8px"><i style="width:${rd.percent}%"></i></div>` : ''}
        <div class="row" style="margin-top:10px"><button class="btn s pri" data-do="auto">${ic('play')}Auto-play this step as ${esc(S.P.name)}</button><button class="btn s" data-do="map">${ic('workflow')}Show on flow map</button></div></div>
      ${why}${eng}
      <div class="panel"><div class="row" style="justify-content:space-between"><h3 style="margin:0">Fact registry</h3><span class="xs mut">${reg.length} facts</span></div>
        <div class="reg scroll-x">${reg.length ? `<table><tr><th>Field</th><th>Value</th><th>Source</th><th>Status</th><th>Scope</th></tr>${reg.map((r) => `<tr><td><code>${r.id}</code></td><td class="num">${esc(Array.isArray(r.v) ? r.v.join(', ') : typeof r.v === 'number' ? r.v.toLocaleString('en-US') : String(r.v))}</td><td>${r.src}${r.at && r.at !== 'now' ? ` <span class="mut xs">${r.at}</span>` : ''}</td><td><span class="tag ${r.cls}">${r.status}</span></td><td class="xs mut">${r.scope}</td></tr>`).join('')}</table>` : '<p class="sm mut" style="margin:8px 0 0">Empty. Nothing is known about this person yet.</p>'}</div>
        <p class="xs mut" style="margin:8px 0 0">Merge rule: user beats records, records beat AI, AI beats defaults. A newer but weaker source never overwrites a confirmed fact; it raises a conflict.</p></div>
      <div class="panel"><h3>Event log</h3><div class="log">${S.log.map((l) => `<div><time>${l.at}</time>${l.kind === 'ok' ? '<span class="tag ok">ok</span> ' : l.kind === 'warn' ? '<span class="tag estimate">note</span> ' : ''}${esc(l.msg)}</div>`).join('')}</div></div>`
  }
  $('insp').addEventListener('click', (e) => { const d = e.target.closest('[data-do]'); if (!d) return; if (d.dataset.do === 'auto') P.autoStep(); if (d.dataset.do === 'map') setTab('map') })

  /* ------------------------------------------------------------ flow map */
  const LANES = [
    ['Account setup', 'About 30 seconds. Belongs to the account, asked once, never financial.', [
      ['signin', 'Sign in', ['user'], ['Apple, Google or email', 'Exit: none'], []],
      ['hydrate', 'Hydration gate', ['det'], ['Wait for the first account load', 'Has data: skip setup, go to Home', 'Empty account: start setup', 'Offline with nothing local: wait, never guess'], []],
      ['lang', 'Language', ['user'], ['English or Arabic, direction flips at once'], ['language · account']],
      ['country', 'Country and currency', ['user', 'det'], ['Country suggests currency (changeable)', 'Time zone and week start from the device'], ['country · account', 'currency · account', 'timezone · account', 'weekStart · account']],
      ['name', 'Name', ['user'], ['Optional, skippable'], ['name · account']],
    ]],
    ['Entry into the builder', 'The natural next screen after setup; for a returning user, the Budget tab.', [
      ['home0', 'Home, no budget', ['det'], ['Returning users land here', 'Shows what is already on file', 'A saved draft resumes from here'], []],
      ['opener', 'Tell Buddgy', ['user', 'ai'], ['Text, voice, or skip', 'AI down: goes straight to questions', 'Shows how much is already known'], []],
      ['understood', 'Confirm what was read', ['ai', 'user'], ['Every read fact can be fixed or removed', 'Out-of-scale amounts flagged', 'Facts already on file are not overwritten'], ['any of 49 answerable fields · account']],
      ['modes', 'Aim and mode', ['user'], ['Aim: save, goal, debt, mixed', 'Buddgy builds it / with Buddgy / myself', 'Switch later without losing anything'], ['intent · plan']],
    ]],
    ['Collecting what is missing', 'The production question graph. Anything known is skipped; anything skipped is estimated and labelled.', [
      ['stale', 'Still right?', ['det', 'user'], ['Only for facts past their shelf life', 'Confirm keeps the value, new date', 'Changed: one amount field'], ['re-confirmed fact · account']],
      ['found', 'Here is what I found', ['det', 'user'], ['Income, bills, debts, goals from records', '"Not right" drops them and asks instead'], ['confirmIncome/Bills/Debts/Goals · plan']],
      ['q', 'Adaptive questions', ['det', 'user'], ['Core: always when needed', 'Standard: best 4 by stake', 'Follow-ups: only after their parent', '"Not sure" gives a labelled estimate', 'AI mode asks only income and housing', 'Build now from 60% ready'], ['income, housing, household, life, debts, security, goals, annual · account', 'priorities, lean, strategy · plan']],
      ['checks', 'Whole-picture checks', ['det', 'user'], ['Deficit: what could change?', 'Goal too big: extend, lower or keep', 'Goal versus safety', 'What to trim first'], ['deficitPlan, goalAdjust, goalVsSafety, cutFirst · plan']],
      ['manual', 'Manual builder', ['user'], ['Income, then lines by block', 'Left to assign always visible', 'No AI, no suggestions'], ['lines · plan']],
    ]],
    ['The budget', 'Deterministic engine, then the person in control.', [
      ['building', 'Build', ['det'], ['Fixed costs, everyday, safety net, goals and debt, balance to zero', 'Duplicate requests ignored'], []],
      ['review', 'Review', ['det', 'user'], ['Income, bar by block, three outcomes', 'Risks said plainly', 'Goal and debt timelines', 'Deficit: levers, not blame'], []],
      ['line', 'Edit, lock, add, remove', ['user'], ['Amount, reason, source, confidence', 'Lock: never changed by Buddgy', 'Linked lines follow their records'], ['line amount, lock · plan']],
      ['adjust', 'Ask Buddgy', ['ai', 'user'], ['Words become proposed changes', 'Preview, then apply or decline', 'Declines are remembered', 'Locked lines refused'], []],
      ['whatif', 'What if', ['det', 'user'], ['Nine scenarios on a copy of the facts', 'Before and after, runway, timelines', 'Never changes the budget'], []],
    ]],
    ['Going live', 'The first and only point where records outside the budget are written.', [
      ['activate', 'Activate', ['user', 'det'], ['Name and month start day', 'Lists exactly what will be created', 'Works offline, syncs later', 'Or save as a draft'], ['plan name, start day · plan']],
      ['perms', 'Permissions', ['user'], ['SMS tracking (native only)', 'Notifications', 'Both declinable'], ['smsTracking, push · account']],
      ['home', 'Active budget', ['det'], ['Spending against lines', 'Transfers and repayments not counted', 'Month review proposes changes'], []],
      ['draft', 'Save and resume', ['det'], ['Every answer saved as given', 'Resume at the exact question', 'A draft writes no debts or goals'], []],
    ]],
  ]
  function renderMap() {
    const S = P.state(), cur = stageOf(S)
    const f = S.flow
    const status = (x) => !f ? '' : x.id in f.a ? 'asked' : f.known[x.id] !== undefined && x.control !== 'confirm' ? 'known' : f.skipped.includes(x.id) ? 'est' : x.when && !x.when(f) ? 'na' : 'open'
    const mods = ['all', ...new Set(R.NODES.map((x) => x.mod))]
    const rows = R.NODES.filter((x) => L.mod === 'all' || x.mod === L.mod)
    const counts = { asked: 0, known: 0, est: 0, na: 0, open: 0 }
    for (const x of R.NODES) counts[status(x)]++
    let n = 0
    $('tab-map').innerHTML = `<h1>The journey, stage by stage</h1><p class="mut">Each card is a real stage of the prototype. The highlighted one is where the phone is now. "Open" jumps the phone there as ${esc(S.P.name)}, answering on the way.</p>
      <div class="row" style="margin:8px 0">${Object.values(WHO).map(([c, l]) => `<span class="tag ${c}">${l}</span>`).join('')}<span class="tag">account = reused across budgets</span><span class="tag">plan = asked again for each budget</span></div>
      ${LANES.map(([name, sub, stages]) => `<div class="lane"><h2 style="margin:0">${name}</h2><span class="sm mut">${sub}</span></div><div class="flow">${stages.map(([id, title, who, bullets, fields]) => `<div class="st ${cur === id ? 'cur' : ''}"><h3><span class="n">${++n}</span>${title}</h3><div class="who">${who.map((w) => `<span class="tag ${WHO[w][0]}">${WHO[w][1]}</span>`).join('')}</div><ul>${bullets.map((b) => `<li>${b}</li>`).join('')}</ul>${fields.length ? `<div class="xs mut">Collects: ${fields.join('; ')}</div>` : ''}<div style="margin-top:auto"><button class="btn s" data-goto="${id}">${ic('smartphone')}Open in prototype</button></div></div>`).join('')}</div>`).join('')}
      <div class="lane"><h2 style="margin:0">The question graph</h2><span class="sm mut">All ${R.NODES.length} production questions, with their live status for ${esc(S.P.name)} on the phone.</span></div>
      <div class="panel"><div class="row" style="margin-bottom:8px"><span class="tag you">${counts.asked} answered</span><span class="tag records">${counts.known} known, not asked</span><span class="tag estimate">${counts.est} estimated</span><span class="tag">${counts.na} do not apply</span><span class="tag">${counts.open} not reached or cut by stake</span></div>
        <div class="row" style="margin-bottom:8px">${mods.map((m) => `<button class="btn s" data-mod="${m}" style="${L.mod === m ? 'border-color:var(--pri);color:var(--pri-ink)' : ''}">${m}</button>`).join('')}</div>
        <div class="scroll-x" style="max-height:520px;overflow-y:auto"><table class="gq"><tr><th>Field</th><th>Question</th><th>Control</th><th>Tier</th><th class="r">Stake</th><th>Asked when</th><th>Now</th></tr>
        ${rows.map((x) => { const st = status(x); return `<tr class="${st}"><td><code>${x.id}</code><div class="xs mut">${x.mod}</div></td><td>${esc(x.q)}</td><td>${x.control}</td><td>${x.needs ? 'check' : x.tier}</td><td class="r num">${x.stake}</td><td><code>${whenSrc(x)}</code>${x.needs ? `<div class="xs mut">after: ${x.needs.join(', ')}</div>` : ''}</td><td>${st ? `<span class="tag ${{ asked: 'you', known: 'records', est: 'estimate', na: '', open: '' }[st]}">${{ asked: 'answered', known: 'known', est: 'estimated', na: 'n/a', open: 'open' }[st]}</span>` : ''}</td></tr>` }).join('')}</table></div></div>`
    icons()
  }
  $('tab-map').addEventListener('click', (e) => {
    const g = e.target.closest('[data-goto]'), m = e.target.closest('[data-mod]')
    if (g) { const id = g.dataset.goto; P.goto(id === 'checks' ? 'q' : id === 'perms' ? 'perms' : id); if (id === 'checks') for (let i = 0; i < 30; i++) { const s = P.state(); if (s.screen !== 'q' || R.NODE_BY_ID.get(s.q.head).needs) break; P.autoStep() } setTab('exp') }
    if (m) { L.mod = m.dataset.mod; renderMap() }
  })

  /* ------------------------------------------------------------ simulation lab */
  const EDGES = [
    ['noIncome', 'No income', 'Income answered as zero. The engine switches to a spend-based plan with a cushion and says so; goals and saving wait.'],
    ['missing', 'Missing information', 'Only income and "I rent" are known. Every unknown line is a labelled estimate and the review offers to sharpen them.'],
    ['conflict', 'Conflicting data', 'Profile rent and six months of records disagree by more than 20%. Buddgy asks which is right; it never picks silently.'],
    ['expired', 'Expired information', 'Rent was confirmed 14 months ago. It is re-confirmed in one tap rather than trusted or asked from scratch.'],
    ['aiDown', 'AI unavailable', 'The opener says so and goes straight to questions. Build, review, edit and activate do not need AI at all.'],
    ['offline', 'Offline', 'A banner, answers saved on the device, activation queued. Nothing is blocked except reading free text.'],
    ['slow', 'Delayed hydration', 'The gate keeps waiting and says why. No cold-start screens appear while the account is still loading.'],
    ['newDevice', 'Returning user, new device', 'Local store is empty, the server is not. The user lands on Home with their data, not in account setup.'],
    ['abandon', 'Abandoned midway', 'Four answers in, then "save and finish later". Home shows the draft and resumes at the exact question.'],
    ['dupBuild', 'Duplicate build requests', 'Two build taps 450 ms apart. The second is ignored; one draft exists.'],
    ['badGoal', 'Unrealistic goal', 'A goal of 2,000,000 in 6 months on an income of 18,000. A check offers to extend, lower or keep it, before any plan is built.'],
  ]
  const SC_NAME = { incomeDrop: 'Income drops 20%', jobLoss: 'No income for 2 months', rentUp: 'Rent up 15%', newDebt: 'New loan', newGoal: 'New goal', debtFast: 'Pay debt aggressively', saveMore: 'Save 20% of income', moreFun: 'More spending money', moveOut: 'Move out in 6 months' }
  function labData() {
    const p = X.tweak(X.PERSONAS[L.pid], L.c)
    const g = X.autoWalk(p, 'guided'), a = X.autoWalk(p, 'ai')
    const st = X.settle(X.plan(g.hyd, g.flow), {}), stA = X.settle(X.plan(a.hyd, a.flow), {})
    return { p, g, a, st, m: X.metrics(st), mA: X.metrics(stA), stA }
  }
  function slider(key, label, v, max, step, cur) { return `<label><span>${label}<em>${cur ? mny(v, cur) : v}</em></span><input type="range" data-c="${key}" min="0" max="${Math.max(max, v)}" step="${step}" value="${v}"></label>` }
  function renderLab() {
    const base = X.PERSONAS[L.pid], d = labData(), p = d.p, t = p.t, cur = p.cur, m = d.m, st = d.st
    const inc = Math.max(t.income, 1000), stp = Math.max(10, Math.round(inc / 100 / 10) * 10)
    const debtK = (t.debtKinds || []).includes('card') ? 'card' : (t.debtKinds || []).includes('loan') ? 'loan' : null
    const debtBal = debtK ? t[debtK + 'Balance'] || 0 : 0, debtMin = debtK ? t[debtK + 'Min'] || 0 : 0
    const apr = L.c.debtApr !== undefined ? L.c.debtApr : debtK ? { under15: 10, '15_25': 20, over25: 34 }[t[debtK + 'Apr']] || 25 : 25
    const housing = t.housing === 'rent' ? t.rent : t.housing === 'family' ? t.familyContributionAmount || 0 : t.mortgagePayment || 0
    const variable = t.incomeType !== 'salary'
    const blocks = ['bills', 'subscriptions', 'debts', 'everyday', 'safety', 'goals', 'grow'], col = { bills: 'c4', subscriptions: 'c6', debts: 'c3', everyday: 'c5', safety: 'c1', goals: 'c2', grow: 'c0' }
    const tot = (b) => X.sum(st.lines.filter((l) => l.block === b).map((l) => l.amount))
    const path = (w) => w.asked.map((q) => `<span class="${q.kind}" title="${q.ids.join(', ')}">${q.head}${q.skipped.length ? ' ~' : ''}</span>`).join('') || '<span>nothing to ask</span>'
    const scn = X.SCENARIOS.map((id) => X.runScenario(st, id, d.g.hyd, d.g.flow))
    const sel = L.sc ? scn.find((r) => r.id === L.sc) : null
    const mo = (v) => (v === null ? 'never at this pace' : v + ' mo')
    $('tab-lab').innerHTML = `<h1>Simulation lab</h1><p class="mut">Pick a person, change their circumstances, and watch which questions appear and what the production engine builds. Each person answers the graph with their own (fictional) answers.</p>
      <div class="tabs" style="margin:10px 0 14px">${Object.values(X.PERSONAS).map((x) => `<button data-lp="${x.id}" aria-selected="${L.pid === x.id}">${x.name}</button>`).join('')}</div>
      <div class="grid2"><div>
        <div class="panel"><b>${base.title}</b><p class="sm mut">${base.sub}</p><div class="ctl">
          <label><span>What buddget already holds</span><select data-c="level"><option value="none" ${p.level === 'none' ? 'selected' : ''}>Nothing (new account)</option><option value="profile" ${p.level === 'profile' ? 'selected' : ''}>Profile: income, household, housing</option><option value="full" ${p.level === 'full' ? 'selected' : ''}>Full history: transactions, bills, debts, goals</option></select></label>
          <div class="row"><label style="flex:1"><span>Country</span><select data-c="country">${['EG', 'AE', 'SA', 'OTHER'].map((k) => `<option ${p.country === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label><label style="flex:1"><span>Currency</span><select data-c="cur">${Object.keys(X.SYMBOL).map((k) => `<option ${cur === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label></div>
          ${slider('income', 'Monthly income', t.income, inc * 3, stp, cur)}
          <label><span>Income stability</span><select data-c="stability"><option value="fixed" ${!variable ? 'selected' : ''}>Fixed salary</option><option value="variable" ${variable ? 'selected' : ''}>Variable</option></select></label>
          ${variable ? slider('lowMonth', 'Slow-month income', t.lowMonth || 0, t.income, stp, cur) : ''}
          ${slider('housing', t.housing === 'rent' ? 'Rent' : t.housing === 'family' ? 'Contribution at home' : 'Mortgage', housing, inc, stp, cur)}
          <div class="row"><label style="flex:1"><span>Household</span><select data-c="household">${['solo', 'couple', 'family'].map((k) => `<option ${t.household === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label>${t.household === 'family' ? `<label style="flex:1"><span>Dependants</span><input type="number" data-c="dependents" min="1" max="8" value="${t.dependents || 1}"></label>` : ''}</div>
          ${slider('savings', 'Savings', t.savingsOnHand || 0, inc * 12, stp * 5, cur)}
          ${slider('debtBalance', 'Debt balance', debtBal, inc * 12, stp * 5, cur)}
          ${debtBal > 0 ? slider('debtMin', 'Monthly debt payment', debtMin, inc, stp, cur) + slider('debtApr', 'Interest rate (% a year)', apr, 45, 1) : ''}
          ${p.level === 'full' ? slider('subs', 'Subscriptions a month', (p.rec.subs || {}).monthly || 0, Math.round(inc * 0.1), Math.max(5, stp / 2), cur) + slider('spendPct', 'Everyday spending (% of their usual)', Math.round((p.rec.spend || 1) * 100), 180, 5) : `<label><span>Lifestyle</span><select data-c="lifestyle">${['minimal', 'balanced', 'comfortable'].map((k) => `<option ${t.lifestyle === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label>`}
          ${slider('goalTarget', 'Goal target', t.hasGoal ? t.goalTarget || 0 : 0, Math.max(inc * 30, t.goalTarget || 0), stp * 10, cur)}
          ${t.hasGoal ? slider('goalMonths', 'Goal deadline (months)', t.goalMonthsNew && !L.c.goalMonths ? t.goalMonths : t.goalMonths || 12, 72, 1) : ''}
          ${(base.rec.accounts || []).length ? `<label><span>Accounts on file</span><input type="number" data-c="accounts" min="1" max="${base.rec.accounts.length}" value="${(p.rec.accounts || []).length}"></label>` : ''}
          <div class="row"><button class="btn s" data-lab="reset">${ic('rotate-ccw')}Reset</button><button class="btn s pri" data-lab="open">${ic('smartphone')}Play this person on the phone</button></div></div></div>
      </div><div>
        <div class="cards" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr))">
          ${[[d.g.asked.length, 'screens, guided'], [d.a.asked.length, 'screens, Buddgy builds it'], [d.g.knownIds.length, 'questions not asked because known'], [`${m.estimated} / ${d.mA.estimated}`, 'estimated lines, guided / AI mode']].map(([v, l]) => `<div class="sc"><b class="num" style="font-size:20px">${v}</b><span class="sm mut">${l}</span></div>`).join('')}</div>
        <div class="panel" style="margin-top:12px"><h3>Question path</h3><div class="sm mut">Guided</div><div class="path" style="margin:4px 0 10px">${path(d.g)}</div><div class="sm mut">Buddgy builds it</div><div class="path" style="margin-top:4px">${path(d.a)}</div>
          <p class="xs mut" style="margin:8px 0 0">One chip per screen, named by its first field. <span class="tag you">core</span> <span class="tag estimate">check</span> <span class="tag records">found or re-confirm</span> ~ means a field on it was left to estimate. Known and skipped: <code>${d.g.knownIds.join('</code> <code>') || 'none'}</code></p></div>
        <div class="panel"><div class="row" style="justify-content:space-between"><h3 style="margin:0">Budget from the engine</h3>${st.over > 0 ? `<span class="tag bad">short by ${mny(st.over, cur)}</span>` : '<span class="tag ok">balanced to zero</span>'}</div>
          <div class="wbar" style="margin:10px 0 6px">${blocks.map((b) => `<i style="width:${(tot(b) / (st.total || 1)) * 100}%;background:var(--${col[b]})" title="${b}"></i>`).join('')}</div>
          <div class="scroll-x"><table><tr><th>Income basis</th>${blocks.map((b) => `<th class="r"><span style="color:var(--${col[b]})">●</span> ${b}</th>`).join('')}</tr><tr><td class="num">${mny(st.income, cur)}${st.basis === 'spend' ? '<div class="xs mut">spend-based</div>' : st.facts.monthlyIncome > st.income ? `<div class="xs mut">floor of ${mny(st.facts.monthlyIncome, cur)}</div>` : ''}</td>${blocks.map((b) => `<td class="r num">${mny(tot(b), cur)}</td>`).join('')}</tr></table></div>
          <dl class="kv" style="margin-top:10px"><dt>Safety net today</dt><dd>${m.monthsHeld.toFixed(1)} months of essentials; savings last ${m.runway.toFixed(1)} months on bare costs</dd>${m.hasDebt ? `<dt>Debt-free</dt><dd>${mo(m.debtFree)}${m.extra > 0 ? `, ${Math.max(0, (m.debtFreeMin || 0) - (m.debtFree || 0))} mo sooner than minimums` : ''}</dd>` : ''}${m.goalsOut.map((g) => `<dt>${esc(g.name)}</dt><dd>${mny(g.funded, cur)} of ${mny(g.need, cur)} a month: ${g.months === null ? 'not funded' : g.months + ' mo'}${g.want ? ` (wanted ${g.want})` : ''} ${g.onTime ? '<span class="tag ok">on time</span>' : '<span class="tag estimate">later</span>'}</dd>`).join('')}</dl>
          ${st.risks.length ? `<ul class="sm" style="margin:10px 0 0;padding-inline-start:18px">${st.risks.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
          <details style="margin-top:10px"><summary class="sm" style="cursor:pointer;font-weight:600">All ${st.lines.length} lines with source and reason</summary><div class="scroll-x"><table><tr><th>Line</th><th class="r">Amount</th><th>Source</th><th>Reason (engine)</th></tr>${st.lines.map((l) => `<tr><td>${esc(l.name)}<div class="xs mut">${l.block}</div></td><td class="r num">${mny(l.amount, cur)}</td><td><span class="tag ${l.src}">${l.src}</span></td><td class="sm">${esc(l.rationale)}</td></tr>`).join('')}</table></div></details></div>
        <div class="panel"><h3>What if</h3><p class="sm mut">Each card re-runs the engine on a copy of this person's facts. Select one for the full before and after.</p>
          <div class="cards">${scn.map((r) => { const dv = r.sc.saving - r.base.saving; return `<button class="sc" data-sc="${r.id}" aria-pressed="${L.sc === r.id}"><b>${SC_NAME[r.id]}</b><span class="d ${r.sc.over > r.base.over ? 'dn' : dv >= 0 ? 'up' : 'dn'}">${r.sc.over > 0 ? 'short ' + mny(r.sc.over, cur) : (dv >= 0 ? '+' : '') + mny(dv, cur) + ' set aside'}</span><span class="xs mut">${r.id === 'jobLoss' ? `savings last ${r.job.runway.toFixed(1)} mo` : r.sc.hasDebt ? `debt-free ${mo(r.sc.debtFree)}` : `runway ${r.sc.runway.toFixed(1)} mo`}</span></button>` }).join('')}</div>
          ${sel ? `<div class="scroll-x" style="margin-top:12px"><table><tr><th>${SC_NAME[sel.id]}</th><th class="r">Now</th><th class="r">What if</th><th class="r">Change</th></tr>${[['Income basis', 'income'], ['Bills and subscriptions', 'bills'], ['Debt payments', 'debt'], ['Everyday', 'everyday'], ['Safety net', 'safety'], ['Goals', 'goals'], ['Buffer', 'buffer'], ['Shortfall', 'over']].map(([l, k]) => `<tr><td>${l}</td><td class="r num">${mny(sel.base[k], cur)}</td><td class="r num">${mny(sel.sc[k], cur)}</td><td class="r num">${sel.sc[k] === sel.base[k] ? '–' : (sel.sc[k] > sel.base[k] ? '+' : '') + mny(sel.sc[k] - sel.base[k], cur)}</td></tr>`).join('')}
            <tr><td>Months savings last</td><td class="r num">${sel.base.runway.toFixed(1)}</td><td class="r num">${sel.sc.runway.toFixed(1)}</td><td></td></tr>${sel.sc.hasDebt ? `<tr><td>Debt-free</td><td class="r">${sel.base.hasDebt ? mo(sel.base.debtFree) : '–'}</td><td class="r">${mo(sel.sc.debtFree)}</td><td></td></tr>` : ''}
            ${sel.sc.goalsOut.map((g) => { const g0 = sel.base.goalsOut.find((x) => x.id === g.id); return `<tr><td>${esc(g.name)}</td><td class="r">${g0 ? (g0.months === null ? 'not funded' : g0.months + ' mo') : '–'}</td><td class="r">${g.months === null ? 'not funded' : g.months + ' mo'}</td><td></td></tr>` }).join('')}</table></div>
            ${sel.job ? `<p class="sm" style="margin:8px 0 0">Bare costs are ${mny(sel.job.burn, cur)} a month. After two months without income: ${sel.job.after >= 0 ? mny(sel.job.after, cur) + ' left' : mny(-sel.job.after, cur) + ' short'}.</p>` : ''}${sel.after ? `<p class="sm" style="margin:8px 0 0">From month 7, paying rent of ${mny(sel.afterRent, cur)}: ${sel.after.over > 0 ? 'short by ' + mny(sel.after.over, cur) : 'balanced, setting aside ' + mny(sel.after.saving, cur)} a month.</p>` : ''}` : ''}</div>
      </div></div>
      <div class="lane"><h2 style="margin:0">Edge cases</h2><span class="sm mut">Each one plays on the phone, with the event log explaining what happened.</span></div>
      <div class="cards">${EDGES.map(([id, name, what]) => `<div class="sc"><b>${name}</b><span class="sm mut">${what}</span><div style="margin-top:auto;padding-top:6px"><button class="btn s" data-edge="${id}">${ic('play')}Play on the phone</button></div></div>`).join('')}</div>`
    icons()
  }
  $('tab-lab').addEventListener('click', (e) => {
    const lp = e.target.closest('[data-lp]'), sc = e.target.closest('[data-sc]'), ed = e.target.closest('[data-edge]'), lb = e.target.closest('[data-lab]')
    if (lp) { L.pid = lp.dataset.lp; L.c = {}; L.sc = null; renderLab() }
    if (sc) { L.sc = L.sc === sc.dataset.sc ? null : sc.dataset.sc; renderLab() }
    if (ed) { P.edge(ed.dataset.edge); setTab('exp') }
    if (lb && lb.dataset.lab === 'reset') { L.c = {}; renderLab() }
    if (lb && lb.dataset.lab === 'open') { const c = { ...L.c }; P.start(L.pid, c); setTab('exp') }
  })
  const onCtl = (e) => {
    const n = e.target.closest('[data-c]')
    if (!n) return
    const k = n.dataset.c, num = n.type === 'range' || n.type === 'number'
    if (k === 'spendPct') L.c.spend = Number(n.value) / 100
    else L.c[k] = num ? Number(n.value) : n.value
    if (k === 'country') L.c.cur = X.COUNTRIES[n.value].cur
    const id = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.c : null
    renderLab()
    if (id) { const f = document.querySelector(`#tab-lab [data-c="${id}"]`); if (f) f.focus() }
  }
  $('tab-lab').addEventListener('change', onCtl)
  $('tab-lab').addEventListener('input', (e) => { if (e.target.type === 'range') onCtl(e) })

  /* ------------------------------------------------------------ decisions */
  function renderDec() {
    const v = (a, s, p, c) => `<div class="voices"><div class="voice"><b>Architect (Fable)</b>${a}</div><div class="voice"><b>Skeptic (Sonnet)</b>${s}</div><div class="voice"><b>Pragmatist (Sonnet)</b>${p}</div><div class="voice"><b>Critic (Opus)</b>${c}</div></div>`
    $('tab-dec').innerHTML = `<h1>Decisions, findings and what needs your call</h1>
      <p class="mut">Discovery found that most of what the brief asks for already exists in the repository and is tested: a declarative question graph of ${R.NODES.length} questions, a free-text reader with a validator, and a deterministic engine (${R.ENGINE_VERSION}). This prototype runs that code unchanged. The gaps are the entry experience, provenance on facts, and several engine behaviours listed below.</p>

      <div class="panel"><h2>A. Flow architecture</h2>
        ${v('Keep the declarative graph. Add provenance on answers. No flow-builder.', 'Keep it. "Hybrid" is what it already is. A full registry solves problems that do not exist yet.', 'Graph plus a thin sidecar of source, time and status. Build TTL when a stale fact is actually seen.', 'AI may fill answers, never create questions: a generated question has no id, so it cannot be validated, translated or tested.')}
        <p class="verdict" style="margin-top:10px"><b>Decision:</b> declarative adaptive graph (the existing one), no AI-generated questions, no generic flow-builder. The "field registry" becomes one record per question id: value, source, time, status, with a source-priority merge (user, then records, then AI, then default) so last-write-wins sync cannot let a weaker source overwrite a confirmed fact. <b>Dissent kept:</b> two voices would drop shelf life entirely; it is kept only for income and housing cost (12 months), because those two move every line.</p></div>

      <div class="panel"><h2>B. Where onboarding ends</h2>
        ${v('Three screens, nothing financial. The builder is the first financial moment.', 'Agreed, but first-run must run straight into the builder, not an empty dashboard.', 'Delete the six-step journey; it competes with the graph for the same data.', 'Shorter setup makes a wrong "new user" call faster, not rarer. The decision must come from the server.')}
        <p class="verdict" style="margin-top:10px"><b>Decision:</b> account setup is language, country and currency, optional name. Time zone and week start come from the device. Everything financial belongs to the builder; accounts, SMS and notifications come after the first budget. "New user" is decided only after the account answers. Later changes to facts go through the same registry ("What Buddgy knows").</p></div>

      <div class="panel"><h2>C. What AI controls</h2>
        ${v('AI reads, words and proposes. The engine owns every amount.', 'Language only. Drop the licence to nudge amounts by 25%.', 'Same. Fix "generic" plans with better tables and the person\'s own history, not looser numbers.', 'Offline-first means AI is often absent: engine-only is the main path, not the fallback.')}
        <p class="verdict" style="margin-top:10px"><b>Decision:</b> AI extracts answers from words (through the existing validator, plus a scale check), writes explanations, and turns "adjust" requests into proposed changes on known lines. It never sets an amount, never touches a locked line, and nothing it reads is saved before the person confirms. All three voices recommend removing today's 25% amount nudge in the AI build step.</p></div>

      <div class="panel"><h2>D. How this prototype proves it</h2>
        ${v('Run the production engine and graph in the page. Simulate only the AI and the backend.', 'A re-implemented engine proves nothing. Bundle the real one.', 'Real code, canned AI, an inspector that stays visible.', 'Show every fallback openly, and do not let a polished demo become the spec.')}
        <p class="verdict" style="margin-top:10px"><b>Decision, changed by the council:</b> the first draft of this prototype re-implemented the engine. That was thrown away. <code>js/real.js</code> is generated from <code>src/lib/budget</code> (engine, benchmarks, question graph, answers-to-facts, reader validator, English and Arabic question copy). <code>node test.mjs</code> checks that all six people, both question modes and all nine scenarios reconcile exactly.</p></div>

      <div class="panel"><h2>What running the real engine showed</h2><p class="sm mut">Found while building the personas. None are fixed in the app; the prototype works around the first one and shows the others as they are.</p><ol class="q">
        <li><b>A rent answered on its own is dropped.</b> When housing is already on the profile and only the rent is asked, <code>applyAnswers</code> ignores it (<code>flow/toFacts.ts</code>, housing block): the budget has no rent line. Reproduced with Karim.</li>
        <li><b>Utilities can be counted twice.</b> The engine adds an estimated Utilities line whenever rent excludes utilities, even when electricity and water are already tracked as bills (<code>engine.ts</code>, fixedLines).</li>
        <li><b>A low income floor crushes essentials.</b> Everyday lines are scaled to 60% of what is left after fixed costs. With Omar's slow month set to 18,000 the plan gives Groceries E£ 604. Try it in the lab.</li>
        <li><b>In a deficit, everyday lines vanish.</b> When fixed costs exceed income (Mona), the plan contains no groceries line at all, so the stated shortfall understates the real one.</li>
        <li><b>Reasons and risks are English only.</b> The engine writes its explanations as English sentences. The Arabic here comes from pattern translation in the prototype; production needs keyed reasons.</li>
        <li><b>Benchmarks have no source, version or date,</b> and the "comfortable" tier is larger than many incomes (Egypt groceries: 8,000 per person). Every estimate in the prototype is labelled as an internal estimate.</li>
        <li><b>Onboarding today:</b> a failed first sync means a brand-new user is offered no journey that session; the "holds nothing" check ignores some data; answering the push pre-prompt can mark onboarding done.</li></ol></div>

      <div class="panel"><h2>Known limits of this prototype</h2><ul class="q" style="padding-inline-start:18px">
        <li>AI is simulated by pattern matching. It handles the personas' own words in English and Arabic (including Arabic-Indic digits and "alf"), not arbitrary text. Its output does pass through the production validator.</li>
        <li>No backend: sign-in, sync, hydration timing, SMS and notification prompts are staged. Drafts persist in this browser only.</li>
        <li>Editing, locking, "fix it", debt-free dates, goal timelines and what-if comparisons are prototype code around the engine. Production has <code>ops.applyOps</code>, <code>validate.repairDraft</code> and <code>debtPayoff.ts</code> for the same jobs.</li>
        <li>Exchange rates are fixed sample values. All people and figures are fictional.</li>
        <li>The workbench panels are in English; the phone is fully bilingual. The question graph covers one goal and one debt of each kind per run, as production does.</li>
        <li>Not verified on a device. iOS, Android, screen readers and real Arabic review are production-phase work.</li></ul></div>

      <div class="panel"><h2>Decisions that need you before production starts</h2><ol class="q">
        <li><b>Extend, do not rebuild.</b> Keep the existing graph and engine; build the entry experience, the provenance record and the review on top. The brief says "rethink from first principles"; the code says the foundations are sound. Recommended: extend.</li>
        <li><b>Replace the six-step onboarding</b> (about, goals, accounts, income, automate, budget) with the three-screen setup shown here. Accounts and SMS move to after the first budget.</li>
        <li><b>Remove the AI amount nudge</b> (up to 25%) so every number is reproducible.</li>
        <li><b>Records are created only at activation.</b> Today the builder creates debts and goals as you answer. Drafts and what-ifs would otherwise leave phantom debts behind when discarded.</li>
        <li><b>What-if scenarios.</b> The stress test was archived as unused two weeks ago. This design brings the idea back as a sheet on the review. Keep all nine, keep three (income drop, job loss, new goal), or leave it out?</li>
        <li><b>Activating with a shortfall.</b> When must-pay costs exceed income, allow a "stabilising" budget that tracks the gap (shown here), or block activation until it balances?</li>
        <li><b>Drafts follow the account.</b> Today an unfinished run lives on one device for 7 days. Syncing it needs a small schema change.</li>
        <li><b>Shelf life on facts:</b> only income and housing cost, 12 months. Agree, or none at all?</li>
        <li><b>"Buddgy builds it" asks only income and housing</b> and estimates the rest. Fast (two screens for a new user) but the first draft is mostly estimates. Acceptable?</li>
        <li><b>Benchmarks:</b> who sources and maintains them? Until then they stay labelled as internal estimates.</li>
        <li><b>Fix the four engine issues above</b> as part of this work, or separately first?</li></ol></div>`
    icons()
  }

  window.Lab = { sync: () => { renderLeft(); renderInsp(); if (tab === 'map') renderMap(); icons() }, setTab }
  window.Lab.sync()
})()
