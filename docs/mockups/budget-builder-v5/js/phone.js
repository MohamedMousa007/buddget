/* The phone: every screen from sign-in to an active budget. State lives in S; questions and numbers come from the real graph and engine. */
;(function () {
  'use strict'
  const R = window.Real, X = window.Sim, I = window.I18N
  const el = document.getElementById('ph')
  let S = { sim: { ai: true, online: true, slow: false, newDevice: false }, theme: null, log: [] }
  let timers = []
  const later = (fn, ms) => timers.push(setTimeout(fn, ms))
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const t = (k, p) => I.t(S.lang, k, p)
  const cur = () => S.profile.cur
  const money = (n) => { const s = X.SYMBOL[cur()]; return (n < 0 ? '-' : '') + s + (s.length > 1 ? ' ' : '') + Math.abs(Math.round(n)).toLocaleString('en-US') }
  const fm = (n) => `<bdi class="num">${money(n)}</bdi>`
  const ic = (n, cls) => `<i data-lucide="${n}"${cls ? ` class="${cls}"` : ''}></i>`
  const pn = (v) => { const s = String(v).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[^0-9.]/g, ''); return s === '' ? undefined : Math.round(Number(s)) }
  const log = (msg, kind) => { S.log.unshift({ at: new Date().toTimeString().slice(0, 8), msg, kind: kind || '' }); S.log = S.log.slice(0, 40) }

  const FACES = {
    happy: ['gold', '<path d="M8.5 14a1.75 1.75 0 0 1 3 0"/><path d="M12.5 14a1.75 1.75 0 0 1 3 0"/>'], awake: ['pri-bright', '<path d="M9.75 12.5v1.75"/><path d="M14.25 12.5v1.75"/>'],
    curious: ['pri-bright', '<path d="M9.75 13v1.25"/><path d="M14.25 12v2.25"/><path d="M13.25 10.5l2-.5"/>'], thinking: ['pri-bright', '<path d="M9 13.5h.01"/><path d="M12 13.5h.01"/><path d="M15 13.5h.01"/>'],
    done: ['green', '<path d="M9.25 13.5 11 15.25l3.75-3.75"/>'], worried: ['amber', '<path d="M9.75 13v1"/><path d="M14.25 13v1"/><path d="M8.75 11.75 10.5 11"/><path d="M15.25 11.75 13.5 11"/><path d="M10.75 16.5a2 2 0 0 1 2.5 0"/>'],
  }
  const budSvg = (mood) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 12.5a8.5 8.5 0 0 1 17 0V16a5 5 0 0 1-5 5h-7a5 5 0 0 1-5-5z"/><path d="M10 8.5h4a3.5 3.5 0 0 1 3.5 3.5v2.5a3.5 3.5 0 0 1-3.5 3.5h-4a3.5 3.5 0 0 1-3.5-3.5V12a3.5 3.5 0 0 1 3.5-3.5z"/><path d="M20.5 12h.5a1.5 1.5 0 0 1 1.5 1.5v2a1.5 1.5 0 0 1-1.5 1.5h-.5"/><path d="M3.5 12H3a1.5 1.5 0 0 0-1.5 1.5v2A1.5 1.5 0 0 0 3 17h.5"/><path d="M16.3 5.2 17.5 2.5"/><g stroke="var(--${FACES[mood][0]})">${FACES[mood][1]}</g></svg>`
  const bud = (mood, small) => `<div class="bud${small ? ' s' : ''}">${budSvg(mood)}</div>`
  window.budSvg = budSvg

  const BLOCKS = ['bills', 'subscriptions', 'debts', 'everyday', 'safety', 'goals', 'grow']
  const BCOL = { bills: 'c4', subscriptions: 'c6', debts: 'c3', everyday: 'c5', safety: 'c1', goals: 'c2', grow: 'c0' }
  const BICON = { bills: 'receipt', subscriptions: 'rotate-cw', debts: 'landmark', everyday: 'shopping-basket', safety: 'shield-check', goals: 'target', grow: 'sprout' }
  const QUICK = { bills: ['Rent', 'Utilities', 'Internet', 'Mobile', 'School'], subscriptions: ['Subscriptions'], debts: ['Card', 'Loan', 'Instalments'], everyday: ['Groceries', 'Dining out', 'Transport', 'Health', 'Shopping', 'Fun'], safety: ['Safety net'], goals: ['Savings goal'], grow: ['Yearly costs', 'Investing', 'Zakat'] }
  const MONEY_IDS = new Set(['income', 'lowMonth', 'rent', 'mortgagePayment', 'propertyCosts', 'supportAmount', 'schoolFees', 'childcare', 'carPayment', 'cardBalance', 'cardMin', 'loanBalance', 'loanMin', 'bnplMonthly', 'familyOwed', 'studentBalance', 'studentMin', 'taxOwed', 'arrears', 'savingsOnHand', 'goalTarget', 'goalSaved', 'familyContributionAmount'])

  /* ------------------------------------------------------------ session */
  function start(pid, tw, keep) {
    timers.forEach(clearTimeout); timers = []
    const P = X.tweak(X.PERSONAS[pid], tw)
    S = { sim: S.sim, theme: S.theme, log: keep ? S.log : [], pid, tw: tw || {}, P, lang: P.lang, profile: { lang: P.lang, country: P.country, cur: P.cur, name: P.level === 'none' ? '' : P.name },
      screen: 'signin', h: null, flow: null, mode: null, intent: null, draft: { ov: {}, removed: [], custom: [] }, pins: [], trail: [], staleLeft: [], declined: [], drafts: [], text: '', read: null, q: null, sheet: null, toast: null, txns: [], active: null, building: null, manualIncome: 0, hasDraft: false, perms: {} }
    if (!keep) log(`Session started as ${P.name}: ${P.title.toLowerCase()}`)
    render()
  }
  function ready() {
    S.P.country = S.profile.country; S.P.cur = S.profile.cur
    S.h = X.hydrate(S.P)
    S.staleLeft = Object.keys(S.h.stale)
    S.flow = R.createFlow(S.intent || 'mixed', S.h.known)
  }
  function setIntent(intent) {
    const old = S.flow
    S.intent = intent
    let f = R.createFlow(intent, S.h.known)
    for (const [k, v] of Object.entries(old.a)) f = R.answer(f, k, v)
    for (const k of old.skipped) f = R.skip(f, k)
    f.known = old.known
    S.flow = f
  }
  const groupIds = (head) => R.NODES.filter((x) => x.group === head.group).map((x) => x.id)
  function persist() {
    S.hasDraft = true
    const online = S.sim.online
    try { localStorage.setItem('bb5-draft', JSON.stringify({ pid: S.pid, tw: S.tw, profile: S.profile, lang: S.lang, intent: S.intent, mode: S.mode, a: S.flow.a, skipped: S.flow.skipped, cursor: S.flow.cursor, known: S.flow.known, draft: S.draft, pins: S.pins, manualIncome: S.manualIncome, trail: S.trail, pct: R.flowReadiness(S.flow).percent, at: Date.now() })) } catch (e) { /* storage blocked: the in-memory draft still works */ }
    return online ? 'Answer saved to the draft and synced' : 'Answer saved on this device. It syncs when you are back online'
  }
  function restore() {
    let d = null
    try { d = JSON.parse(localStorage.getItem('bb5-draft') || 'null') } catch (e) { d = null }
    if (!d || !X.PERSONAS[d.pid]) return false
    start(d.pid, d.tw, false)
    Object.assign(S, { profile: d.profile, lang: d.lang, intent: d.intent, mode: d.mode, draft: d.draft, pins: d.pins || [], manualIncome: d.manualIncome || 0, trail: d.trail || [] })
    ready()
    S.staleLeft = S.staleLeft.filter((k) => d.a[k] === undefined)
    S.flow = { ...S.flow, intent: d.intent || 'mixed', a: d.a, skipped: d.skipped, cursor: d.cursor, known: d.known }
    S.hasDraft = true; S.screen = 'home0'
    log('Draft restored from this browser. Nothing was asked twice.', 'ok')
    render()
    return true
  }
  const savedDraft = () => { try { const d = JSON.parse(localStorage.getItem('bb5-draft') || 'null'); return d && X.PERSONAS[d.pid] ? d : null } catch (e) { return null } }
  const clearSaved = () => { try { localStorage.removeItem('bb5-draft') } catch (e) { /* nothing to clear */ } }

  function effDraft(base) {
    const d = { ov: { ...S.draft.ov }, removed: S.draft.removed, custom: [...S.draft.custom], income: S.mode === 'manual' ? S.manualIncome : undefined }
    for (const p of S.pins) {
      if (base.lines.some((l) => l.key === p.key)) d.ov[p.key] = { amount: p.amount, locked: true, ...(S.draft.ov[p.key] || {}) }
      else if (!d.custom.some((c) => c.key === p.key)) { d.custom.push(p); d.ov[p.key] = { locked: true, ...(S.draft.ov[p.key] || {}) } }
    }
    return d
  }
  function compute() {
    const base = S.mode === 'manual'
      ? { income: S.manualIncome || 0, lines: [], risks: [], reasons: [], free: 0, basis: 'income', facts: { ...X.factsOf(S.h, S.flow), monthlyIncome: S.manualIncome || 0 } }
      : X.plan(S.h, S.flow)
    const st = X.settle(base, effDraft(base))
    st.m = X.metrics(st)
    return st
  }

  /* ------------------------------------------------------------ flow control */
  function next() {
    S.sheet = null
    if (S.staleLeft.length) { S.screen = 'stale'; S.q = { stale: S.staleLeft[0], changed: false, value: undefined }; return render() }
    if (S.mode === 'manual') { S.screen = 'manual'; return render() }
    const q = X.nextFor(S.flow, S.mode)
    if (!q) return build()
    S.q = { head: q.id, values: {}, skips: [], reopen: false }
    S.screen = 'q'
    render()
  }
  function openNodes() { return R.screenNodes(S.flow, R.NODE_BY_ID.get(S.q.head), S.q.values, S.q.skips, S.q.reopen) }
  function valueOf(x) { return S.q.values[x.id] !== undefined ? S.q.values[x.id] : R.defaultFor(x, S.flow) }
  function canContinue() { return openNodes().every((x) => S.q.skips.includes(x.id) || valueOf(x) !== undefined) }
  function commitQ() {
    if (!canContinue()) return
    const head = R.NODE_BY_ID.get(S.q.head), nodes = openNodes()
    let f = S.flow
    if (S.q.reopen) { const ids = groupIds(head); f = { ...f, a: Object.fromEntries(Object.entries(f.a).filter(([k]) => !ids.includes(k))), skipped: f.skipped.filter((k) => !ids.includes(k)) } }
    for (const x of nodes) f = S.q.skips.includes(x.id) ? R.skip(f, x.id) : R.answer(f, x.id, valueOf(x))
    S.flow = R.pruneInapplicable(f)
    S.trail.push(S.q.head)
    log(`${persist()}: ${nodes.map((x) => x.id).join(', ')}`)
    next()
  }
  function back() {
    S.sheet = null
    const sc = S.screen
    if (sc === 'q' || sc === 'stale') {
      const head = S.trail.pop()
      if (!head) { S.screen = 'modes'; return render() }
      const node = R.NODE_BY_ID.get(head), ids = groupIds(node)
      S.q = { head, values: Object.fromEntries(ids.filter((k) => S.flow.a[k] !== undefined).map((k) => [k, S.flow.a[k]])), skips: S.flow.skipped.filter((k) => ids.includes(k)), reopen: true }
      S.screen = 'q'
      log(`Went back to ${head}. Earlier answers are kept.`)
      return render()
    }
    const prev = { country: 'lang', name: 'country', understood: 'opener', modes: S.read && Object.keys(S.read.found).length ? 'understood' : 'opener', manual: 'modes', review: S.mode === 'manual' ? 'manual' : 'modes', activate: 'review', opener: S.P.level === 'none' ? 'name' : 'home0' }[sc]
    if (prev) { S.screen = prev; render() }
  }
  function build() {
    if (S.building) { log(`Second build request ignored: build ${S.building} is already running. One draft, not two.`, 'warn'); S.toast = t('toast.dup'); return render() }
    S.building = 'b-' + Math.random().toString(36).slice(2, 7)
    S.buildStep = 0
    S.screen = 'building'
    log(`Build ${S.building} started on the device (engine ${R.ENGINE_VERSION}). No AI is involved in the amounts.`)
    render()
    for (let i = 1; i <= 5; i++) later(() => { S.buildStep = i; render() }, i * 330)
    later(() => { S.building = null; S.screen = 'review'; persist(); render() }, 2050)
  }
  function chooseMode(mode) {
    const was = S.mode
    if (mode === 'manual' && was !== 'manual') {
      const hasPlan = R.flowReadiness(S.flow).canBuild || S.pins.length
      const lines = hasPlan ? compute().lines.filter((l) => l.key !== 'grow:buffer') : []
      S.manualIncome = hasPlan ? compute().income : Number(S.flow.a.income || S.flow.known.income || 0)
      S.draft = { ov: {}, removed: [], custom: lines.map((l) => ({ key: l.key, name: l.name, amount: l.amount, block: l.block, icon: l.icon, essential: l.essential, isSavings: l.isSavings })) }
      S.pins = []
      if (was) log(`Switched to manual. ${lines.length} lines came with you; nothing was lost.`, 'ok')
    } else if (was === 'manual' && mode !== 'manual') {
      S.pins = S.draft.custom.map((c) => ({ ...c }))
      S.draft = { ov: {}, removed: [], custom: [] }
      if (S.manualIncome > 0 && S.flow.a.income === undefined && S.flow.known.income === undefined) S.flow = R.answer(S.flow, 'income', S.manualIncome)
      log(`Switched from manual. Your ${S.pins.length} lines stay as locked amounts; Buddgy fills in around them.`, 'ok')
    } else if (was && was !== mode) log(`Switched to ${mode}. Every answer so far is kept.`, 'ok')
    S.mode = mode
    persist()
    next()
  }

  /* ------------------------------------------------------------ pieces */
  const scr = (o) => `<div class="scr">${o.hd || ''}<div class="body">${o.body}</div>${o.ft ? `<div class="ft">${o.ft}</div>` : ''}</div>`
  const hd = (o) => `<div class="hd">${o.back === false ? '<span class="ib"></span>' : `<button class="ib flip" data-act="back" aria-label="${t('back')}">${ic('chevron-left')}</button>`}${o.mid || '<span style="flex:1"></span>'}${o.right || '<span class="ib"></span>'}</div>`
  const pills = (n, on) => `<div class="pills">${Array.from({ length: n }, (_, i) => `<i class="${i <= on ? 'on' : ''}"></i>`).join('')}</div>`
  const cta = (label, act, o) => `<button class="cta ${o && o.cls ? o.cls : ''}" data-act="${act}"${o && o.arg !== undefined ? ` data-arg="${esc(o.arg)}"` : ''}${o && o.off ? ' disabled' : ''}>${o && o.icon ? ic(o.icon) : ''}${label}</button>`
  const opt = (label, act, arg, on, sub, icon) => `<button class="opt" data-act="${act}" data-arg="${esc(arg)}" aria-pressed="${!!on}">${icon ? `<span class="tile" style="--tc:var(--pri)">${ic(icon)}</span>` : ''}<span>${label}${sub ? `<small>${sub}</small>` : ''}</span><span class="ck">${ic('check')}</span></button>`
  const amt = (id, v, ph) => `<div class="amt"><input id="in-${id}" data-in="${id}" inputmode="numeric" autocomplete="off" value="${v === undefined || v === null ? '' : v}" placeholder="${ph || '0'}" aria-label="${t('amount')}"><span>${X.SYMBOL[cur()]}</span></div>`
  const note = (text, kind, icon) => `<div class="note ${kind || ''}">${ic(icon || (kind === 'bad' ? 'triangle-alert' : kind === 'warn' ? 'info' : kind === 'ok' ? 'circle-check' : 'info'))}<span>${text}</span></div>`
  const srcTag = (src) => `<span class="tag ${src}">${t('src.' + src)}</span>`
  const lineName = (l) => (l.raw || l.custom ? esc(I.name(S.lang, l.name)) : esc(I.name(S.lang, l.name)))
  const copyOf = (id) => (S.lang === 'ar' ? R.flowCopyAr : R.flowCopyEn)[id] || { label: id, why: '' }
  function qLabel(x) {
    const c = copyOf(x.id), v = x.variant ? x.variant(S.flow) : undefined
    const k = S.flow.known
    const n = { confirmBills: (k.knownBillCount || 0) + (k.knownSubCount || 0), confirmDebts: k.knownDebtCount, confirmGoals: k.knownGoalCount }[x.id]
    return esc((v && c.variants && c.variants[v]) || c.label).replace('{income}', fm(k.income || 0)).replace('{n}', n === undefined ? '' : n)
  }
  const optLabel = (id, o) => esc((copyOf(id).opts || {})[o] || o)
  function showVal(id, v) {
    const x = R.NODE_BY_ID.get(id)
    if (v === true) return t('yes'); if (v === false) return t('no')
    if (Array.isArray(v)) return v.map((o) => optLabel(id, o)).join(S.lang === 'ar' ? '، ' : ', ')
    if (typeof v === 'number') return MONEY_IDS.has(id) ? fm(v) : `<bdi class="num">${v}</bdi>`
    return x ? optLabel(id, v) : esc(v)
  }

  function control(x) {
    const v = valueOf(x), id = x.id
    if (S.q.skips.includes(id)) return `<button class="chip" data-act="unskip" data-arg="${id}" aria-pressed="true">${ic('sparkles')}${t('q.estimating')}</button>`
    let h = ''
    if (x.control === 'amount') h = amt(id, v)
    else if (x.control === 'toggle') h = `<div class="g2">${opt(t('yes'), 'pick', id + '|true', v === true)}${opt(t('no'), 'pick', id + '|false', v === false)}</div>`
    else if (x.control === 'chips') { const many = x.opts.length > 6; h = many ? `<div class="chips">${x.opts.map((o) => `<button class="chip" data-act="pick" data-arg="${id}|${o}" aria-pressed="${v === o}">${optLabel(id, o)}</button>`).join('')}</div>` : `<div class="${x.opts.some((o) => optLabel(id, o).length > 22) ? 'g1' : 'g2'}">${x.opts.map((o) => opt(optLabel(id, o), 'pick', id + '|' + o, v === o)).join('')}</div>` }
    else if (x.control === 'multi') h = `<div class="chips">${x.opts.map((o) => `<button class="chip" data-act="multi" data-arg="${id}|${o}" aria-pressed="${(v || []).includes(o)}">${optLabel(id, o)}</button>`).join('')}</div>`
    else if (x.control === 'stepper') h = `<div class="stp"><button data-act="step" data-arg="${id}|-1" aria-label="-">${ic('minus')}</button><b>${v}</b><button data-act="step" data-arg="${id}|1" aria-label="+">${ic('plus')}</button></div>`
    else if (x.control === 'slider') h = `<div><input type="range" id="in-${id}" data-in="${id}" data-kind="range" min="${x.min || 0}" max="${x.max || 100}" value="${v}" aria-label="${qLabel(x)}"><div class="row sm mut" style="justify-content:space-between"><span>${t(id === 'securityLean' ? 'lean.lo' : 'low')}</span><b class="num">${v}${id === 'securityLean' ? '' : '%'}</b><span>${t(id === 'securityLean' ? 'lean.hi' : 'high')}</span></div></div>`
    if (x.skippable && x.control !== 'confirm') h += `<div><button class="chip s" data-act="skipq" data-arg="${id}">${ic('sparkles')}${t('q.notsure')}</button></div>`
    return h
  }
  function foundDetail(id) {
    const b = S.h.base, rec = S.P.rec || {}
    const row = (n, a, c) => `<div class="li"><span class="nm"><b>${esc(n)}</b></span><span class="am">${c && c !== cur() ? `<bdi class="num">${c} ${a.toLocaleString('en-US')}</bdi>` : fm(a)}</span></div>`
    if (id === 'confirmIncome') return (rec.sources || [{ name: t('found.salary'), amount: b.monthlyIncome }]).map((s) => row(s.name, s.amount, s.cur)).join('') + ((rec.sources || []).some((s) => s.cur) ? `<div class="li sm mut">${t('found.fx')}</div>` : '')
    if (id === 'confirmBills') return b.bills.map((x) => row(x.name, x.amount)).join('') + (b.subscriptionCount ? row(t('found.subs', { n: b.subscriptionCount }), b.subscriptionsMonthly) : '')
    if (id === 'confirmDebts') return b.debts.map((d) => row(`${d.name} · ${t('found.left')} ${money(d.balance)}`, d.minimum)).join('')
    if (id === 'confirmGoals') return b.goals.map((g) => row(`${g.name} · ${money(g.saved)} / ${money(g.targetAmount)}`, g.monthly)).join('')
    return ''
  }
  function strip(st) {
    const tot = st.total || 1
    return BLOCKS.map((b) => { const a = X.sum(st.lines.filter((l) => l.block === b).map((l) => l.amount)); return a > 0 ? `<i style="width:${(a / tot) * 100}%;background:var(--${BCOL[b]})"></i>` : '' }).join('')
  }
  const menuBtn = () => `<button class="ib" data-act="sheet" data-arg="menu" aria-label="${t('menu')}">${ic('ellipsis')}</button>`

  /* ------------------------------------------------------------ screens */
  const V = {
    signin: () => scr({ body: `<div style="flex:1"></div>${bud('awake')}<h1 class="ttl">${t('signin.t')}</h1><p class="lead">${t('signin.l')}</p><div style="flex:1"></div>`,
      ft: cta(t('signin.apple'), 'signin', { icon: 'apple' }) + cta(t('signin.google'), 'signin', { cls: 'alt' }) + cta(t('signin.email'), 'signin', { cls: 'alt', icon: 'mail' }) + `<p class="xs mut" style="text-align:center;margin:4px 0 0">${t('signin.sim')}</p>` }),
    hydrate: () => {
      const stuck = !S.sim.online
      return scr({ body: `<div style="flex:1"></div>${bud(stuck ? 'worried' : 'thinking')}<h1 class="ttl">${t(stuck ? 'hyd.off.t' : 'hyd.t')}</h1><p class="lead">${t(stuck ? 'hyd.off.l' : S.sim.slow ? 'hyd.slow' : 'hyd.l')}</p>${note(t('hyd.rule'), '', 'shield-check')}<div style="flex:1"></div>`, ft: stuck ? cta(t('retry'), 'retryHydrate', { icon: 'refresh-cw' }) : '' })
    },
    lang: () => scr({ hd: hd({ back: false, mid: pills(3, 0) }), body: `${bud('awake')}<h1 class="ttl">Choose your language<br><span style="font-family:'IBM Plex Sans Arabic'">اختر لغتك</span></h1><div class="g1">${opt('English', 'setLang', 'en', S.lang === 'en')}${opt('<span style="font-family:\'IBM Plex Sans Arabic\'">العربية</span>', 'setLang', 'ar', S.lang === 'ar')}</div>`, ft: cta(t('continue'), 'go', { arg: 'country' }) }),
    country: () => {
      const c = S.profile.country, info = X.COUNTRIES[c]
      return scr({ hd: hd({ mid: pills(3, 1) }), body: `${bud('curious')}<h1 class="ttl">${t('country.t')}</h1><p class="lead">${t('country.l')}</p><div class="g2">${['EG', 'AE', 'SA', 'OTHER'].map((k) => opt(t('country.' + k), 'setCountry', k, c === k)).join('')}</div>
        <div class="fld"><div class="lb">${t('country.cur')}</div><div class="chips">${Object.keys(X.SYMBOL).map((k) => `<button class="chip s" data-act="setCur" data-arg="${k}" aria-pressed="${cur() === k}"><bdi class="num">${k}</bdi></button>`).join('')}</div><div class="hint">${t('country.curhint', { c: t('cur.' + cur()) })}</div></div>
        ${note(t('country.device', { tz: info.tz, day: t('day.' + info.week) }), '', 'smartphone')}`, ft: cta(t('continue'), 'go', { arg: 'name' }) })
    },
    name: () => scr({ hd: hd({ mid: pills(3, 2), right: `<button class="ghost" data-act="finishStub">${t('skip')}</button>` }), body: `${bud('happy')}<h1 class="ttl">${t('name.t')}</h1><p class="lead">${t('name.l')}</p><input class="txt-in" id="in-name" data-in="name" data-kind="text" value="${esc(S.profile.name)}" placeholder="${t('name.ph')}" autocomplete="off" aria-label="${t('name.t')}">`, ft: cta(t('continue'), 'finishStub') }),
    home0: () => {
      const b = S.h.base, k = S.h.known, d = S.hasDraft && S.flow ? R.flowReadiness(S.flow).percent : null
      const have = [k.income ? [t('h0.income'), fm(k.income)] : null, b.bills.length + b.subscriptionCount ? [t('h0.bills'), b.bills.length + b.subscriptionCount] : null, b.debts.length ? [t('h0.debts'), b.debts.length] : null, b.goals.length ? [t('h0.goals'), b.goals.length] : null, (S.P.rec.accounts || []).length ? [t('h0.accounts'), S.P.rec.accounts.length] : null].filter(Boolean)
      return scr({ body: `<div class="row" style="margin-top:8px">${bud('happy', true)}<div><div class="eyebrow">${t('h0.eyebrow')}</div><b style="font-size:19px">${t('h0.hi', { name: esc(S.profile.name || t('friend')) })}</b></div></div>
        ${S.sim.newDevice ? note(t('h0.newdevice'), 'ok', 'smartphone') : ''}
        ${d !== null ? `<div class="card p"><div class="row" style="justify-content:space-between"><b>${t('h0.draft')}</b><span class="tag">${t('h0.pct', { n: d })}</span></div><div class="prog"><i style="width:${d}%"></i></div><p class="sm mut" style="margin:8px 0 10px">${t('h0.draftl')}</p>${cta(t('h0.resume'), 'resume', { icon: 'play' })}</div>` : ''}
        <div class="card"><div class="li"><span class="nm"><b>${t('h0.nobudget')}</b><span class="sm mut">${t('h0.nobudgetl')}</span></span></div>${have.map(([n, v]) => `<div class="li"><span class="nm sm">${n}</span><span class="am">${v}</span></div>`).join('') || `<div class="li sm mut">${t('h0.nothing')}</div>`}</div>
        ${have.length ? note(t('h0.know'), '', 'database') : ''}`, ft: d !== null ? cta(t('h0.fresh'), 'freshBuild', { cls: 'alt' }) : cta(t('h0.build'), 'go', { arg: 'opener', icon: 'sparkles' }) })
    },
    opener: () => {
      const knows = Object.keys(S.flow.known).filter((k) => R.NODE_BY_ID.has(k)).length
      const body = `${bud('happy')}<h1 class="ttl">${t('op.t', { name: esc(S.profile.name || '') }).replace(/^[\s,،]+/, '')}</h1><p class="lead">${t('op.l')}</p>
        ${knows > 2 ? note(t('op.knows', { n: knows }), 'ok', 'database') : ''}
        ${S.sim.ai ? `<textarea class="txt-in" id="in-text" data-in="text" data-kind="text" placeholder="${t('op.ph')}" aria-label="${t('op.l')}">${esc(S.text)}</textarea>
        <div class="chips"><button class="chip s" data-act="sample">${ic('sparkles')}${t('op.sample', { name: esc(S.P.name) })}</button><button class="chip s" data-act="voice">${ic('mic')}${t('op.voice')}</button></div>
        <p class="xs mut" style="margin:-6px 0 0">${t('op.sim')}</p>` : note(t('op.aioff'), 'warn', 'cloud-off')}`
      return scr({ hd: hd({ back: S.P.level === 'none' ? undefined : undefined }), body, ft: (S.sim.ai ? cta(t('op.read'), 'readText', { icon: 'sparkles' }) : '') + cta(t(S.sim.ai ? 'op.skip' : 'op.ask'), 'skipOpener', { cls: S.sim.ai ? 'txt' : '' }) })
    },
    understood: () => {
      const f = S.read.found, ids = Object.keys(f).filter((k) => k !== 'commitments')
      return scr({ hd: hd({}), body: `${bud('curious')}<h1 class="ttl m">${t('und.t')}</h1>${note(t('und.sim'), 'ai', 'sparkles')}
        <div class="card">${ids.map((id) => `<div class="li"><span class="nm"><span class="sm mut">${esc(I.short(S.lang, id))}</span><b>${S.edit === id ? '' : showVal(id, f[id])}</b>${S.edit === id ? amt('und-' + id, f[id]) : ''}${S.read.flags.includes(id) ? `<span class="tag bad">${t('und.check')}</span>` : ''}</span>${typeof f[id] === 'number' ? `<button class="ib" data-act="undEdit" data-arg="${id}" aria-label="${t('edit')}">${ic(S.edit === id ? 'check' : 'pencil')}</button>` : ''}<button class="ib" data-act="undDrop" data-arg="${id}" aria-label="${t('remove')}">${ic('x')}</button></div>`).join('')}</div>
        ${S.read.flags.length ? note(t('und.flag'), 'warn') : ''}<p class="sm mut">${t('und.rest')}</p>`, ft: cta(t('und.ok'), 'acceptRead', { icon: 'check' }) + cta(t('und.redo'), 'back', { cls: 'txt' }) })
    },
    modes: () => {
      const can = R.flowReadiness(S.flow).canBuild
      let n = 0, f = S.flow
      for (let i = 0; i < 6; i++) { const q = X.nextFor(f, 'ai'); if (!q) break; n++; for (const x of R.screenNodes(f, q, {}, [])) f = R.skip(f, x.id) }
      n += S.staleLeft.length
      return scr({ hd: hd({ right: S.mode ? menuBtn() : undefined }), body: `${bud('happy')}<h1 class="ttl m">${t('modes.t')}</h1>
        ${S.note ? note(t(S.note), 'warn', 'cloud-off') : ''}
        <div class="fld"><div class="lb sm">${t('modes.aim')}</div><div class="chips">${['save', 'goal', 'debt', 'mixed'].map((k) => `<button class="chip s" data-act="aim" data-arg="${k}" aria-pressed="${(S.intent || 'mixed') === k}">${t('aim.' + k)}</button>`).join('')}</div></div>
        <div class="g1">${opt(t('modes.ai'), 'mode', 'ai', false, n === 0 && can ? t('modes.ai0') : t('modes.ain', { n }), 'sparkles')}${opt(t('modes.guided'), 'mode', 'guided', false, t('modes.guidedl'), 'messages-square')}${opt(t('modes.manual'), 'mode', 'manual', false, t('modes.manuall'), 'pencil-ruler')}</div>
        <p class="sm mut">${t('modes.same')}</p>` })
    },
    stale: () => {
      const id = S.q.stale, st = S.h.stale[id]
      return scr({ hd: hd({ right: menuBtn() }), body: `${bud('curious', true)}<div class="eyebrow">${t('stale.eyebrow')}</div><h1 class="ttl m">${t('stale.t', { what: esc(I.short(S.lang, id)), v: fm(st.v), when: I.month(S.lang, st.at) })}</h1><p class="why">${t('stale.why')}</p>
        <div class="g1">${opt(t('stale.same'), 'staleSame', '1', !S.q.changed && S.q.value === st.v)}${opt(t('stale.changed'), 'staleChanged', '1', S.q.changed)}</div>${S.q.changed ? amt('stale', S.q.value === st.v ? undefined : S.q.value) : ''}`, ft: cta(t('continue'), 'commitStale', { off: S.q.value === undefined }) })
    },
    q: () => {
      const head = R.NODE_BY_ID.get(S.q.head), nodes = openNodes(), rd = R.flowReadiness(S.flow)
      const stage = R.STAGES.indexOf(R.stageOf(head.mod)), isFound = head.control === 'confirm'
      let live = ''
      if (rd.canBuild && !isFound) { const st = compute(); live = `<div><div class="strip">${strip(st)}</div><div class="row xs mut" style="justify-content:space-between;margin-top:4px"><span>${t('q.live')}</span><span>${t('q.livesave', { v: fm(st.m.saving) })}</span></div></div>` }
      let body
      if (isFound) body = `${bud('happy', true)}<h1 class="ttl m">${t('found.t')}</h1><p class="why">${t('found.why')}</p>${nodes.map((x) => `<div class="card"><div class="li"><span class="nm"><b>${qLabel(x)}</b></span></div>${foundDetail(x.id)}<div class="li"><div class="g2" style="width:100%">${opt(t('found.right'), 'pick', x.id + '|true', valueOf(x) === true)}${opt(t('found.wrong'), 'pick', x.id + '|false', valueOf(x) === false)}</div></div></div>`).join('')}`
      else body = `${live}<div class="row" style="align-items:flex-end">${bud(head.needs ? 'worried' : 'curious', true)}<span class="eyebrow">${t(head.needs ? 'q.check' : 'q.asks')}</span></div>
        ${nodes.map((x, i) => i === 0 ? `<h1 class="ttl m">${qLabel(x)}</h1><p class="why">${t('q.why')} ${esc(copyOf(x.id).why)}</p>${control(x)}` : `<div class="fld"><div class="lb">${qLabel(x)}</div>${control(x)}</div>`).join('')}
        ${S.q.head === 'income' && !S.q.reopen ? `<button class="chip s" data-act="noIncome">${t('q.noincome')}</button>` : ''}`
      return scr({ hd: hd({ mid: `<div style="flex:1;padding:0 4px"><div class="row" style="justify-content:space-between"><span class="eyebrow">${t('stage.' + R.STAGES[stage])}</span><span class="num xs mut">${rd.percent}%</span></div><div class="pills" style="padding:0;margin-top:5px">${R.STAGES.map((_, i) => `<i class="${i <= stage ? 'on' : ''}"></i>`).join('')}</div></div>`, right: menuBtn() }), body,
        ft: cta(t('continue'), 'commitQ', { off: !canContinue() }) + (S.mode === 'guided' && rd.canBuild && rd.percent >= 60 ? cta(t('q.buildnow', { n: rd.percent }), 'build', { cls: 'txt' }) : '') })
    },
    building: () => scr({ body: `<div style="flex:1"></div>${bud('thinking')}<h1 class="ttl">${t('bld.t')}</h1><div class="steps">${[1, 2, 3, 4, 5].map((i) => `<div class="${S.buildStep >= i ? 'on' : ''}"><i>${ic('check')}</i>${t('bld.' + i)}</div>`).join('')}</div>${note(t('bld.note', { v: R.ENGINE_VERSION }), '', 'cpu')}<div style="flex:1"></div>`, ft: cta(t('bld.again'), 'build', { cls: 'txt' }) }),
    manual: () => {
      const st = compute(), left = st.income - X.sum(st.lines.filter((l) => l.key !== 'grow:buffer').map((l) => l.amount))
      return scr({ hd: hd({ mid: `<b style="flex:1;font-size:16px">${t('man.t')}</b>`, right: menuBtn() }), body: `<div class="sticky-sum"><div class="card p"><div class="fld"><div class="lb sm">${t('man.income')}</div>${amt('manualIncome', S.manualIncome || '')}</div><div class="row" style="justify-content:space-between;margin-top:10px"><span class="sm mut">${t(left < 0 ? 'man.over' : 'man.left')}</span><b class="am num" style="color:var(--${left < 0 ? 'red' : left === 0 ? 'green' : 'ink'})">${money(Math.abs(left))}</b></div><div class="strip" style="margin-top:8px">${strip(st)}</div></div></div>
        <p class="sm mut">${t('man.l')}</p>
        ${BLOCKS.map((b) => { const ls = S.draft.custom.filter((c) => c.block === b); return `<div><div class="sec-h"><span class="tile" style="--tc:var(--${BCOL[b]})">${ic(BICON[b])}</span><b>${I.block(S.lang, b)}</b><span class="am">${money(X.sum(ls.map((l) => l.amount)))}</span></div></div>
          <div class="card">${ls.map((l) => `<div class="li"><span class="nm"><b>${esc(I.name(S.lang, l.name))}</b></span><div class="amt" style="height:42px;width:132px"><input id="in-man-${esc(l.key)}" data-in="man" data-arg="${esc(l.key)}" inputmode="numeric" value="${l.amount || ''}" placeholder="0" style="font-size:16px" aria-label="${esc(l.name)}"></div><button class="ib" data-act="manDel" data-arg="${esc(l.key)}" aria-label="${t('remove')}">${ic('x')}</button></div>`).join('')}
          <div class="li"><div class="chips">${QUICK[b].filter((n) => !ls.some((l) => l.name === n)).map((n) => `<button class="chip s" data-act="manAdd" data-arg="${b}|${n}">${ic('plus')}${esc(I.name(S.lang, n))}</button>`).join('')}<button class="chip s" data-act="sheet" data-arg="add|${b}">${ic('plus')}${t('man.other')}</button></div></div></div>` }).join('')}`,
        ft: cta(t('man.review'), 'manReview', { off: !(S.manualIncome > 0) || S.draft.custom.length === 0 }) })
    },
    review: () => {
      const st = compute(), m = st.m, manual = S.mode === 'manual'
      const spend = st.basis === 'spend', variable = !spend && st.facts.incomeStability !== 'fixed' && st.facts.monthlyIncome > st.income
      const goalsOk = m.goalsOut.filter((g) => g.onTime).length
      const stats = [[`<bdi class="num">${m.monthsHeld.toFixed(1)}</bdi>`, t('rv.s.months')], m.hasDebt ? [m.debtFree === null ? '—' : I.dur(S.lang, m.debtFree), t('rv.s.debtfree')] : m.goalsOut.length ? [`${goalsOk}/${m.goalsOut.length}`, t('rv.s.goals')] : [fm(m.everyday), t('rv.s.everyday')], [fm(m.saving), t('rv.s.saving')]]
      const rem = S.mode !== 'manual' && S.modeWas !== 'done' ? (() => { let n = 0, f = S.flow; for (let i = 0; i < 30; i++) { const q = X.nextFor(f, 'guided'); if (!q) break; n++; for (const x of R.screenNodes(f, q, {}, [])) f = R.skip(f, x.id) } return n })() : 0
      const rows = [['income', st.income], ['mustpay', m.bills], ['essentials', m.essentials], ['everyday', m.everyday], ['debt', m.debt], ['safety', m.safety], ['goals', m.goals], ['aside', m.aside + m.grow], ['buffer', m.buffer]]
      const unavoidable = st.over > 0 && X.rebalance(st, effDraft(st)).unresolved >= st.over
      const body = `<div class="hero"><div class="lbl">${t(spend ? 'rv.spendplan' : variable ? 'rv.slowmonth' : 'rv.income')}</div><div class="big">${money(st.income)}</div>
          <div class="bar">${strip(st)}</div><div class="legend">${BLOCKS.map((b) => { const a = X.sum(st.lines.filter((l) => l.block === b).map((l) => l.amount)); return a > 0 ? `<span style="--d:var(--${BCOL[b]})">${I.block(S.lang, b)} ${Math.round((a / (st.total || 1)) * 100)}%</span>` : '' }).join('')}</div></div>
        ${st.over > 0 ? note(t(unavoidable ? 'rv.short' : 'rv.over', { v: fm(st.over) }), 'bad') : note(t('rv.balanced'), 'ok')}
        <div class="stats">${stats.map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('')}</div>
        ${variable ? note(t('rv.variable', { floor: fm(st.income), usual: fm(st.facts.monthlyIncome), extra: fm(st.facts.monthlyIncome - st.income) }), '', 'waves') : ''}
        ${st.over > 0 && unavoidable ? `<div class="card p"><b>${t('def.t')}</b><p class="sm mut" style="margin:4px 0 10px">${t('def.l')}</p>
          <div class="fld"><div class="lb sm">${t('def.refi')} <b class="num">${S.def && S.def.refi ? S.def.refi : 0}%</b></div><input type="range" data-in="defRefi" data-kind="range" id="in-defRefi" min="0" max="50" step="5" value="${S.def && S.def.refi ? S.def.refi : 0}" aria-label="${t('def.refi')}"></div>
          <div class="fld"><div class="lb sm">${t('def.extra')} ${fm(S.def && S.def.extra ? S.def.extra : 0)}</div><input type="range" data-in="defExtra" data-kind="range" id="in-defExtra" min="0" max="${Math.round(st.income * 0.6)}" step="${Math.max(50, Math.round(st.income / 40 / 50) * 50)}" value="${S.def && S.def.extra ? S.def.extra : 0}" aria-label="${t('def.extra')}"></div>
          ${(() => { const refi = (S.def && S.def.refi) || 0, extra = (S.def && S.def.extra) || 0; const gap = st.over - extra - Math.round((m.debt * refi) / 100); return note(gap > 0 ? t('def.still', { v: fm(gap) }) : t('def.closed', { v: fm(-gap) }), gap > 0 ? 'warn' : 'ok') })()}<p class="xs mut" style="margin:8px 0 0">${t('def.note')}</p></div>` : ''}
        ${st.risks.length ? `<div><div class="sec-h"><b>${t('rv.attention')}</b></div></div><div class="g1">${st.risks.slice(0, 5).map((r) => note(esc(I.risk(S.lang, r)), /exceed|behind|cannot fix/.test(r) ? 'bad' : 'warn')).join('')}</div>` : ''}
        ${m.goalsOut.length ? `<div class="card">${m.goalsOut.map((g) => `<div class="li"><span class="tile" style="--tc:var(--c2)">${ic('target')}</span><span class="nm"><b>${esc(I.name(S.lang, g.name))}</b><span class="sm mut">${g.months === null ? t('rv.goal.none') : g.onTime ? t('rv.goal.ok', { d: I.dur(S.lang, g.months) }) : t('rv.goal.late', { d: I.dur(S.lang, g.months), w: I.dur(S.lang, g.want) })}</span></span><span class="tag ${g.onTime ? 'ok' : 'estimate'}">${t(g.onTime ? 'rv.ontime' : 'rv.later')}</span></div>`).join('')}</div>` : ''}
        ${m.hasDebt && m.debtFree !== null ? note(t(m.extra > 0 && m.debtFreeMin ? 'rv.debt.fast' : 'rv.debt', { d: I.dur(S.lang, m.debtFree), sooner: I.dur(S.lang, Math.max(0, (m.debtFreeMin || m.debtFree) - m.debtFree)), i: fm(Math.max(0, m.interestMin - m.interest)) }), '', 'landmark') : ''}
        <div><div class="sec-h"><b>${t('rv.glance')}</b></div></div><div class="card">${rows.filter(([k, v]) => v > 0 || k === 'income').map(([k, v]) => `<div class="li" style="min-height:40px;padding-block:8px"><span class="nm sm">${t('rv.row.' + k)}</span><span class="am">${money(v)}</span></div>`).join('')}</div>
        ${BLOCKS.map((b) => { const ls = st.lines.filter((l) => l.block === b); if (!ls.length) return ''; return `<div><div class="sec-h"><span class="tile" style="--tc:var(--${BCOL[b]})">${ic(BICON[b])}</span><b>${I.block(S.lang, b)}</b><span class="am">${money(X.sum(ls.map((l) => l.amount)))}</span></div></div>
          <div class="card">${ls.map((l) => `<button class="li" data-act="line" data-arg="${esc(l.key)}"><span class="nm"><b>${lineName(l)}</b><span class="row" style="gap:5px;margin-top:3px">${srcTag(l.src)}${l.edited ? `<span class="tag">${t('rv.edited')}</span>` : ''}</span></span>${l.locked ? ic('lock', 'mut') : ''}<span class="am">${money(l.amount)}</span>${ic('chevron-right', 'mut flip')}</button>`).join('')}</div>` }).join('')}
        <button class="chip" data-act="sheet" data-arg="add|bills" style="align-self:flex-start">${ic('plus')}${t('rv.add')}</button>
        ${!manual && m.estimated > 0 && rem > 0 ? `<div class="card p"><b>${t('rv.sharpen.t', { n: m.estimated })}</b><p class="sm mut" style="margin:4px 0 10px">${t('rv.sharpen.l', { q: rem })}</p>${cta(t('rv.sharpen.cta'), 'sharpen', { cls: 'alt', icon: 'messages-square' })}</div>` : ''}
        <p class="xs mut">${t('rv.disclaimer')}</p>`
      return scr({ hd: hd({ mid: `<b style="flex:1;font-size:16px">${t('rv.t')} <span class="tag">${t('rv.draft')}</span></b>`, right: menuBtn() }), body,
        ft: `<div class="g2"><button class="cta alt" data-act="sheet" data-arg="adjust">${ic('sparkles')}${t('rv.ask')}</button><button class="cta alt" data-act="sheet" data-arg="whatif">${ic('git-compare-arrows')}${t('rv.whatif')}</button></div>` + (st.over > 0 && !unavoidable ? cta(t('rv.fix'), 'fixOver', { icon: 'wand-sparkles' }) : cta(t(st.over > 0 ? 'rv.cta.short' : 'rv.cta'), 'go', { arg: 'activate' })) })
    },
    activate: () => {
      const st = compute(), f = st.facts
      const newDebts = f.debts.filter((d) => /^answered-/.test(d.id)), newGoals = f.goals.filter((g) => /^answered-/.test(g.id))
      const day = S.startDay || Number(S.flow.a.payday || S.flow.known.payday || 1)
      return scr({ hd: hd({}), body: `${bud('happy')}<h1 class="ttl m">${t('act.t')}</h1>
        <div class="fld"><label for="in-planName">${t('act.name')}</label><input class="txt-in" id="in-planName" data-in="planName" data-kind="text" value="${esc(S.planName || t('act.default'))}"></div>
        <div class="fld"><div class="lb">${t('act.day')}</div><div class="stp"><button data-act="day" data-arg="-1" aria-label="-">${ic('minus')}</button><b>${day}</b><button data-act="day" data-arg="1" aria-label="+">${ic('plus')}</button></div><div class="hint">${t('act.dayl')}</div></div>
        <div class="card"><div class="li"><span class="nm"><b>${t('act.creates')}</b><span class="sm mut">${t('act.createsl')}</span></span></div>
          <div class="li"><span class="nm sm">${t('act.c.budget', { n: st.lines.length })}</span>${ic('check', 'mut')}</div>
          ${newDebts.map((d) => `<div class="li"><span class="nm sm">${t('act.c.debt', { n: esc(I.name(S.lang, d.name)) })}</span><span class="am">${money(d.balance)}</span></div>`).join('')}
          ${newGoals.map((g) => `<div class="li"><span class="nm sm">${t('act.c.goal', { n: esc(I.name(S.lang, g.name)) })}</span><span class="am">${money(g.targetAmount)}</span></div>`).join('')}
          ${f.debts.length - newDebts.length + f.goals.length - newGoals.length > 0 ? `<div class="li"><span class="nm sm mut">${t('act.c.linked', { n: f.debts.length - newDebts.length + f.goals.length - newGoals.length })}</span></div>` : ''}</div>
        ${st.over > 0 ? note(t('act.short', { v: fm(st.over) }), 'warn') : ''}${!S.sim.online ? note(t('act.offline'), 'warn', 'cloud-off') : ''}`,
        ft: cta(t('act.cta'), 'activate', { icon: 'check' }) + cta(t('act.draft'), 'saveLater', { cls: 'txt' }) })
    },
    activated: () => scr({ body: `<div style="flex:1"></div>${bud('done')}<h1 class="ttl">${t('done.t', { name: esc(S.profile.name || '') }).replace(/^[\s,،]+/, '')}</h1><p class="lead">${t('done.l', { name: esc(S.active.name) })}</p>${note(t('done.n'), 'ok')}<div style="flex:1"></div>`, ft: cta(t('continue'), 'go', { arg: 'permSms' }) }),
    permSms: () => scr({ body: `<div style="flex:1"></div>${bud('curious')}<h1 class="ttl m">${t('sms.t')}</h1><p class="lead">${t('sms.l')}</p><div class="card"><div class="li"><span class="tile" style="--tc:var(--c5)">${ic('message-square-text')}</span><span class="nm sm">${t('sms.1')}</span></div><div class="li"><span class="tile" style="--tc:var(--c1)">${ic('shield-check')}</span><span class="nm sm">${t('sms.2')}</span></div></div><p class="xs mut">${t('sms.native')}</p><div style="flex:1"></div>`, ft: cta(t('sms.allow'), 'perm', { arg: 'sms|1' }) + cta(t('notnow'), 'perm', { arg: 'sms|0', cls: 'txt' }) }),
    permPush: () => scr({ body: `<div style="flex:1"></div>${bud('awake')}<h1 class="ttl m">${t('push.t')}</h1><p class="lead">${t('push.l')}</p><div style="flex:1"></div>`, ft: cta(t('push.allow'), 'perm', { arg: 'push|1' }) + cta(t('notnow'), 'perm', { arg: 'push|0', cls: 'txt' }) }),
    home: () => {
      const A = S.active, spent = {}
      for (const x of S.txns) if (x.counted && x.key) spent[x.key] = (spent[x.key] || 0) + x.amount
      const totalSpent = X.sum(Object.values(spent)), ev = A.lines.filter((l) => l.block === 'everyday')
      const EV = [['groceries', 'shopping-basket'], ['atm', 'banknote'], ['repay', 'credit-card'], ['topup', 'wallet'], ['bnpl', 'shopping-bag'], ['salary', 'arrow-down-to-line']]
      return scr({ body: `<div class="row" style="margin-top:8px;justify-content:space-between"><div><div class="eyebrow">${t('home.eyebrow')}</div><b style="font-size:19px">${esc(A.name)}</b></div><span class="tag ok">${t('home.active')}</span></div>
        <div class="hero"><div class="lbl">${t('home.left')}</div><div class="big">${money(A.everyday - totalSpent)}</div><div class="bar"><i style="width:${Math.min(100, (totalSpent / (A.everyday || 1)) * 100)}%;background:#fff"></i></div><div class="legend"><span style="--d:#fff">${t('home.spent', { v: money(totalSpent), of: money(A.everyday) })}</span></div></div>
        <div class="card">${ev.slice(0, 5).map((l) => `<div class="li"><span class="nm"><b>${lineName(l)}</b><div class="prog" style="--tc:var(--c5)"><i style="width:${Math.min(100, ((spent[l.key] || 0) / (l.amount || 1)) * 100)}%"></i></div></span><span class="am sm">${money(spent[l.key] || 0)} / ${money(l.amount)}</span></div>`).join('')}</div>
        <div><div class="sec-h"><b>${t('home.try')}</b></div></div><p class="sm mut" style="margin-top:-8px">${t('home.tryl', { how: t(S.perms.sms ? 'home.viaSms' : 'home.viaManual') })}</p>
        <div class="chips">${EV.map(([k, i]) => `<button class="chip s" data-act="txn" data-arg="${k}">${ic(i)}${t('ev.' + k)}</button>`).join('')}</div>
        ${S.txns.length ? `<div class="card">${S.txns.slice(0, 6).map((x) => `<div class="li"><span class="nm"><b>${t('ev.' + x.kind)}</b><span class="sm mut">${t('evw.' + x.kind)}</span></span><span style="text-align:end"><span class="am">${money(x.amount)}</span><br><span class="tag ${x.counted ? 'you' : ''}">${t(x.counted ? 'home.counted' : x.kind === 'salary' ? 'home.incomein' : 'home.notcounted')}</span></span></div>`).join('')}</div>` : ''}
        <div class="card p"><div class="row">${bud('awake', true)}<div style="flex:1;min-width:0"><b>${t('home.close.t')}</b><p class="sm mut" style="margin:2px 0 0">${t('home.close.l', { day: A.day })}</p></div></div></div>
        ${note(t(S.perms.push ? 'home.push1' : 'home.push0'), '', S.perms.push ? 'bell-ring' : 'bell-off')}`, ft: cta(t('home.edit'), 'editActive', { cls: 'alt', icon: 'pencil' }) })
    },
  }

  /* ------------------------------------------------------------ sheets */
  const sheet = (title, body, foot) => `<div class="sheet-bg" data-act="closeSheet"><div class="sheet" role="dialog" aria-label="${esc(title)}" data-stop="1"><div class="grab"></div><div class="sh-h"><b>${title}</b><button class="ib" data-act="closeSheet" aria-label="${t('close')}">${ic('x')}</button></div><div class="sh-b">${body}${foot || ''}</div></div></div>`
  const SH = {
    menu: () => sheet(t('menu'), `<div class="card">
      ${S.mode ? ['ai', 'guided', 'manual'].filter((m) => m !== S.mode).map((m) => `<button class="li" data-act="mode" data-arg="${m}">${ic('repeat')}<span class="nm"><b>${t('menu.switch', { m: t('modes.' + m) })}</b><span class="sm mut">${t('menu.switchl')}</span></span></button>`).join('') : ''}
      <button class="li" data-act="sheet" data-arg="known">${ic('database')}<span class="nm"><b>${t('menu.known')}</b></span></button>
      <button class="li" data-act="saveLater">${ic('bookmark')}<span class="nm"><b>${t('menu.save')}</b><span class="sm mut">${t('menu.savel')}</span></span></button>
      <button class="li" data-act="restart">${ic('rotate-ccw')}<span class="nm"><b>${t('menu.restart')}</b></span></button></div>`),
    known: () => {
      const rows = registry()
      return sheet(t('menu.known'), `<p class="sm mut">${t('known.l')}</p><div class="card">${rows.map((r) => `<div class="li"><span class="nm"><span class="sm mut">${esc(I.short(S.lang, r.id))}</span><b>${showVal(r.id, r.v)}</b></span><span class="tag ${r.cls}">${t('reg.' + r.status)}</span></div>`).join('') || `<div class="li sm mut">${t('h0.nothing')}</div>`}</div>`)
    },
    line: () => {
      const st = compute(), l = st.lines.find((x) => x.key === S.sheet.key)
      if (!l) return ''
      const linked = l.src === 'records' && ((l.linkIds || []).length || l.linkType === 'subscriptions'), isBuf = l.key === 'grow:buffer'
      const max = Math.max(l.suggested * 2, l.amount * 1.5, 500)
      return sheet(lineName(l), `<div class="row">${srcTag(l.src)}<span class="tag">${t(l.confidence === 'estimated' ? 'conf.est' : 'conf.high')}</span>${l.locked ? `<span class="tag">${ic('lock')}${t('ln.locked')}</span>` : ''}</div>
        ${linked || isBuf ? `<div class="hero" style="padding:12px 16px"><div class="big">${money(l.amount)}</div></div>${note(t(isBuf ? 'ln.buffer' : 'ln.linked'), '', isBuf ? 'wallet' : 'link')}` : `${amt('line', l.amount)}<input type="range" id="in-lineR" data-in="lineR" data-kind="range" min="0" max="${Math.round(max)}" step="${Math.max(1, Math.round(max / 200))}" value="${l.amount}" aria-label="${t('amount')}">
        <div class="row" style="justify-content:space-between"><span class="sm mut">${t('ln.suggested')} ${fm(l.suggested)}</span>${l.edited ? `<button class="chip s" data-act="lineReset">${ic('rotate-ccw')}${t('ln.reset')}</button>` : ''}</div>`}
        <div class="fld"><div class="lb sm">${t('ln.why')}</div><p class="sm" style="margin:0">${esc(I.why(S.lang, l.rationale))}</p></div>
        ${l.src === 'estimate' ? note(t('ln.bench', { place: esc(R.getBenchmark(st.facts.country, st.facts.baseCurrency).label) }), 'warn', 'scale') : ''}
        ${linked || isBuf ? '' : `<div class="g2"><button class="cta alt" data-act="lineLock">${ic(l.locked ? 'lock-open' : 'lock')}${t(l.locked ? 'ln.unlock' : 'ln.lock')}</button><button class="cta alt" data-act="lineRemove">${ic('trash-2')}${t('remove')}</button></div><p class="xs mut" style="margin:0">${t('ln.lockl')}</p>`}`)
    },
    add: () => sheet(t('rv.add'), `<div class="fld"><label for="in-addName">${t('add.name')}</label><input class="txt-in" id="in-addName" data-in="addName" data-kind="text" value="${esc(S.sheet.name || '')}" autocomplete="off"></div>
      <div class="fld"><div class="lb">${t('add.amount')}</div>${amt('addAmt', S.sheet.amount)}</div>
      <div class="fld"><div class="lb">${t('add.block')}</div><div class="chips">${BLOCKS.map((b) => `<button class="chip s" data-act="addBlock" data-arg="${b}" aria-pressed="${S.sheet.block === b}">${I.block(S.lang, b)}</button>`).join('')}</div></div>${cta(t('add.cta'), 'addLine')}`),
    adjust: () => {
      const pr = S.sheet.pr
      if (!S.sim.ai) return sheet(t('rv.ask'), note(t('adj.aioff'), 'warn', 'cloud-off') + cta(t('close'), 'closeSheet', { cls: 'alt' }))
      return sheet(t('rv.ask'), `<p class="sm mut">${t('adj.l')}</p><textarea class="txt-in" style="min-height:76px" id="in-adj" data-in="adj" data-kind="text" placeholder="${t('adj.ph')}" aria-label="${t('rv.ask')}">${esc(S.sheet.text || '')}</textarea>
        <div class="chips">${['adj.e1', 'adj.e2', 'adj.e3', 'adj.e4'].map((k) => `<button class="chip s" data-act="adjEx" data-arg="${k}">${t(k)}</button>`).join('')}</div>
        ${!pr ? cta(t('adj.read'), 'adjRead', { icon: 'sparkles' }) : pr.ops.length ? `${S.declined.includes(S.sheet.text) ? note(t('adj.declined'), '', 'history') : ''}<div class="card"><div class="li"><span class="nm"><b>${t('adj.proposal')}</b><span class="sm mut">${t('adj.sim')}</span></span></div>${pr.ops.map((o) => `<div class="li"><span class="nm sm">${esc(I.name(S.lang, o.name))}</span><span class="am sm">${money(o.from)} → <b style="color:var(--${o.to > o.from ? 'green' : 'red'})">${money(o.to)}</b></span></div>`).join('')}</div>
          ${pr.refused.length ? note(t('adj.locked', { n: pr.refused.map((n) => esc(I.name(S.lang, n))).join(', ') }), '', 'lock') : ''}<div class="g2">${cta(t('adj.apply'), 'adjApply')}${cta(t('notnow'), 'adjDecline', { cls: 'alt' })}</div>` : note(t('adj.' + pr.say, { n: (pr.refused || []).map((n) => esc(I.name(S.lang, n))).join(', ') }), 'warn') + cta(t('adj.read'), 'adjRead', { icon: 'sparkles', cls: 'alt' })}`)
    },
    whatif: () => {
      const st = compute(), r = S.sheet.id ? X.runScenario(st, S.sheet.id, S.h, S.flow) : null
      if (!r) return sheet(t('rv.whatif'), `${note(t('wi.safe'), 'ok', 'shield-check')}<div class="g1">${X.SCENARIOS.map((id) => opt(t('wi.' + id), 'whatif', id, false, t('wi.' + id + '.l'))).join('')}</div>`)
      const b = r.base, s = r.sc
      const d = (x, y, goodUp) => { const v = y - x; return v === 0 ? '<span class="mut">–</span>' : `<span class="${(v > 0) === goodUp ? 'up' : 'dn'}">${v > 0 ? '+' : ''}${money(v)}</span>` }
      const rows = [['income', b.income, s.income, true], ['mustpay', b.bills, s.bills, false], ['debt', b.debt, s.debt, false], ['everyday', b.everyday, s.everyday, true], ['safety', b.safety, s.safety, true], ['goals', b.goals, s.goals, true], ['buffer', b.buffer, s.buffer, true]].filter(([, x, y]) => x > 0 || y > 0)
      const mo = (v) => (v === null ? '—' : I.dur(S.lang, v))
      const goalRows = s.goalsOut.map((g) => { const g0 = b.goalsOut.find((x) => x.id === g.id); return `<tr><td>${esc(I.name(S.lang, g.name))}</td><td class="r">${g0 ? mo(g0.months) : '—'}</td><td class="r">${mo(g.months)}</td><td></td></tr>` }).join('')
      let say = ''
      if (r.id === 'jobLoss') say = note(t(r.job.after >= 0 ? 'wi.job.ok' : 'wi.job.bad', { burn: fm(r.job.burn), after: fm(Math.abs(r.job.after)), run: r.job.runway.toFixed(1) }), r.job.after >= 0 ? 'ok' : 'bad')
      else if (r.id === 'moveOut') say = note(t(r.after.over > 0 ? 'wi.move.bad' : 'wi.move.ok', { rent: fm(r.afterRent), v: fm(r.after.over > 0 ? r.after.over : r.after.saving) }), r.after.over > 0 ? 'bad' : 'ok')
      else say = note(s.over > 0 ? t('wi.short', { v: fm(s.over) }) : t('wi.fits', { v: fm(s.saving) }), s.over > 0 ? 'bad' : 'ok')
      return sheet(t('wi.' + r.id), `${note(t('wi.safe'), 'ok', 'shield-check')}${say}
        <div class="card p scroll-x"><table class="cmp"><tr><th></th><th class="r">${t('wi.now')}</th><th class="r">${t('wi.then')}</th><th class="r">${t('wi.diff')}</th></tr>
          ${rows.map(([k, x, y, up]) => `<tr><td>${t('rv.row.' + k)}</td><td class="r">${money(x)}</td><td class="r">${money(y)}</td><td class="r">${d(x, y, up)}</td></tr>`).join('')}
          ${s.over > 0 || b.over > 0 ? `<tr><td>${t('wi.shortfall')}</td><td class="r">${money(b.over)}</td><td class="r">${money(s.over)}</td><td class="r">${d(b.over, s.over, false)}</td></tr>` : ''}
          <tr><td>${t('wi.runway')}</td><td class="r">${b.runway.toFixed(1)}</td><td class="r">${s.runway.toFixed(1)}</td><td></td></tr>
          ${s.hasDebt ? `<tr><td>${t('rv.s.debtfree')}</td><td class="r">${b.hasDebt ? mo(b.debtFree) : '—'}</td><td class="r">${mo(s.debtFree)}</td><td></td></tr>` : ''}${goalRows}</table></div>
        <div class="g2">${cta(t('wi.keep'), 'wiKeep', { cls: 'alt' })}${cta(t('wi.other'), 'sheet', { arg: 'whatif', cls: 'alt' })}</div><p class="xs mut" style="margin:0">${t('wi.note')}</p>`)
    },
  }

  /** The fact registry as the person would see it: every value with where it came from and how sure it is. */
  function registry() {
    if (!S.flow) return []
    const rows = [], seen = new Set()
    const PLAN = new Set(['priorities', 'securityLean', 'cutFirst', 'saveTarget', 'saveCustom', 'debtStrategy', 'goalVsSafety', 'goalAdjust', 'goalMonthsNew', 'goalTargetNew', 'deficitPlan', 'saveObstacle', 'debtExtra'])
    const push = (id, v, status, cls, src, at) => { if (seen.has(id) || !R.NODE_BY_ID.has(id) || /^confirm/.test(id)) return; seen.add(id); rows.push({ id, v, status, cls, src, at, scope: PLAN.has(id) ? 'plan' : 'account' }) }
    for (const id of S.staleLeft) push(id, S.h.stale[id].v, 'expired', 'bad', 'profile', S.h.stale[id].at)
    if (S.flow.known.rentConflict && S.flow.a.rentCheck === undefined) push('rent', S.flow.known.rent, 'conflict', 'bad', 'profile', (S.h.meta.rent || {}).at)
    for (const [id, v] of Object.entries(S.flow.a)) push(id, v, (S.aiIds || []).includes(id) ? 'ai' : 'you', (S.aiIds || []).includes(id) ? 'ai' : 'you', (S.aiIds || []).includes(id) ? 'ai' : 'user', 'now')
    for (const id of S.flow.skipped) push(id, t('reg.typical'), 'estimate', 'estimate', 'default', 'now')
    for (const [id, v] of Object.entries(S.flow.known)) { const m = S.h.meta[id] || { src: 'profile', at: '' }; push(id, v, m.src === 'records' ? 'records' : 'onfile', m.src === 'records' ? 'records' : 'you', m.src, m.at) }
    return rows
  }

  /* ------------------------------------------------------------ render */
  function render() {
    const act = document.activeElement, fid = act && el.contains(act) ? act.id : null, pos = fid && act.selectionStart != null ? [act.selectionStart, act.selectionEnd] : null
    const body = el.querySelector('.body'), sb = el.querySelector('.sh-b'), keepScroll = body && S._scr === S.screen ? body.scrollTop : 0, keepSheet = sb && S._sh === (S.sheet && S.sheet.type) ? sb.scrollTop : 0
    el.dir = S.lang === 'ar' ? 'rtl' : 'ltr'; el.lang = S.lang
    el.className = 'ph ' + (S.theme || '')
    const view = (V[S.screen] || V.signin)()
    el.innerHTML = `<div class="sb"><span>9:41</span><span>${ic(S.sim.online ? 'wifi' : 'wifi-off')}${ic('battery-full')}</span></div>${!S.sim.online ? `<div class="banner">${t('offline')}</div>` : ''}${view}${S.sheet ? SH[S.sheet.type]() : ''}${S.toast ? `<div class="toast" role="status">${esc(S.toast)}</div>` : ''}`
    if (S.toast) { const msg = S.toast; later(() => { if (S.toast === msg) { S.toast = null; render() } }, 2600) }
    if (window.lucide) window.lucide.createIcons()
    const nb = el.querySelector('.body'); if (nb) nb.scrollTop = keepScroll
    const ns = el.querySelector('.sh-b'); if (ns) ns.scrollTop = keepSheet
    S._scr = S.screen; S._sh = S.sheet && S.sheet.type
    if (fid) { const n = document.getElementById(fid); if (n) { n.focus({ preventScroll: true }); if (pos && n.setSelectionRange && n.type !== 'range') try { n.setSelectionRange(pos[0], pos[1]) } catch (e) { /* not a text field */ } } }
    if (window.Lab) window.Lab.sync()
  }
  let deb = null
  const soon = () => { clearTimeout(deb); deb = setTimeout(render, 420) }

  /* ------------------------------------------------------------ actions */
  const setOv = (key, patch) => { S.draft.ov[key] = { ...(S.draft.ov[key] || {}), ...patch } }
  const A = {
    back, build, commitQ,
    go: (to) => { S.screen = to; if (to === 'opener' && !S.flow) ready(); render() },
    signin: () => { S.screen = 'hydrate'; log('Signed in (simulated). Local store is ' + (S.sim.newDevice || S.P.level === 'none' ? 'empty' : 'populated') + '. Waiting for the server before deciding anything.'); render(); runHydrate() },
    retryHydrate: () => { if (!S.sim.online) { S.toast = t('toast.stilloff'); return render() } runHydrate() },
    setLang: (l) => { S.lang = l; S.profile.lang = l; log(`Language set to ${l === 'ar' ? 'Arabic, right to left' : 'English'}. Saved to the account.`); render() },
    setCountry: (c) => { S.profile.country = c; S.profile.cur = X.COUNTRIES[c].cur; render() },
    setCur: (c) => { S.profile.cur = c; render() },
    finishStub: () => { ready(); S.screen = 'opener'; log(`Account ready: ${S.profile.country}, ${S.profile.cur}, ${S.profile.name || 'no name'}. Three screens, nothing financial asked.`, 'ok'); render() },
    sample: () => { S.text = S.P.story[S.lang === 'ar' ? 1 : 0]; render() },
    voice: () => { const full = S.P.story[S.lang === 'ar' ? 1 : 0]; S.text = ''; S.toast = t('toast.voice'); render(); let i = 0; const step = () => { i += 6; S.text = full.slice(0, i); const n = document.getElementById('in-text'); if (n) n.value = S.text; if (i < full.length) later(step, 28) }; later(step, 500) },
    readText: () => {
      if (!S.text.trim()) { S.toast = t('toast.empty'); return render() }
      S.read = X.readSituation(S.text, cur())
      const n = Object.keys(S.read.found).length
      log(`Simulated AI read ${n} facts from ${S.text.length} characters. They passed the real validator (parseSituation) and wait for confirmation.`)
      if (!n) { S.note = 'modes.nothing'; S.screen = 'modes' } else { S.note = null; S.screen = 'understood' }
      render()
    },
    skipOpener: () => { S.read = null; S.note = S.sim.ai ? null : 'modes.aioff'; S.screen = 'modes'; render() },
    undEdit: (id) => { if (S.edit === id) { const n = document.getElementById('in-und-' + id); const v = n ? pn(n.value) : undefined; if (v !== undefined) S.read.found[id] = v; S.read.flags = S.read.flags.filter((x) => x !== id); S.edit = null } else S.edit = id; render() },
    undDrop: (id) => { delete S.read.found[id]; S.read.flags = S.read.flags.filter((x) => x !== id); render() },
    acceptRead: () => {
      S.edit = null
      if (S.read.intent) setIntent(S.read.intent)
      const r = R.acceptDescribed(S.flow, R.parseSituation(S.read.found))
      S.flow = r.state; S.aiIds = r.kept
      log(`Confirmed ${r.kept.length} facts. ${Object.keys(S.read.found).length - r.kept.length} were already on file or did not apply and were left alone.`, 'ok')
      persist(); S.screen = 'modes'; render()
    },
    aim: (k) => { setIntent(k); log(`Main aim: ${k}. The same questions, reordered so the first ones match it.`); render() },
    mode: (m) => chooseMode(m),
    pick: (arg) => { const [id, raw] = arg.split('|'); S.q.values[id] = raw === 'true' ? true : raw === 'false' ? false : raw; render() },
    multi: (arg) => { const [id, o] = arg.split('|'), x = R.NODE_BY_ID.get(id), v = [...(valueOf(x) || [])]; const i = v.indexOf(o); if (i >= 0) v.splice(i, 1); else if (!x.max || v.length < x.max) v.push(o); S.q.values[id] = v; render() },
    step: (arg) => { const [id, d] = arg.split('|'), x = R.NODE_BY_ID.get(id); S.q.values[id] = Math.min(x.max || 999, Math.max(x.min || 0, Number(valueOf(x) || 0) + Number(d))); render() },
    skipq: (id) => { S.q.skips.push(id); delete S.q.values[id]; render() },
    unskip: (id) => { S.q.skips = S.q.skips.filter((k) => k !== id); render() },
    noIncome: () => { S.flow = R.answer(S.flow, 'income', 0); for (const x of openNodes()) if (x.id !== 'income') S.flow = R.skip(S.flow, x.id); S.trail.push('income'); log('No income declared. The plan will cover expected spending with a cushion instead of failing.', 'warn'); persist(); next() },
    staleSame: () => { S.q.changed = false; S.q.value = S.h.stale[S.q.stale].v; render() },
    staleChanged: () => { S.q.changed = true; S.q.value = undefined; render() },
    commitStale: () => { const id = S.q.stale; if (S.q.value === undefined) return; S.flow = R.answer(S.flow, id, S.q.value); S.staleLeft = S.staleLeft.filter((k) => k !== id); log(`${id} re-confirmed (was ${S.h.stale[id].at}). Its timestamp is now today.`, 'ok'); persist(); next() },
    sheet: (arg) => { const [type, extra] = String(arg).split('|'); S.sheet = { type, block: extra || 'bills' }; render() },
    closeSheet: () => { S.sheet = null; render() },
    saveLater: () => { persist(); S.sheet = null; S.screen = 'home0'; log('Draft saved. Nothing was written to debts or goals: a draft creates no records.', 'ok'); render() },
    resume: () => { log('Draft resumed at the exact question it stopped on.', 'ok'); if (S.mode) next(); else { S.screen = 'modes'; render() } },
    freshBuild: () => { const { pid, tw } = S; clearSaved(); start(pid, tw, true); S.h = null; ready(); S.screen = 'opener'; S.profile.name = S.P.name; render() },
    restart: () => { clearSaved(); start(S.pid, S.tw) },
    manAdd: (arg) => { const [b, n] = arg.split('|'); S.draft.custom.push({ key: `${b}:${n.toLowerCase()}`, name: n, amount: 0, block: b, isSavings: ['safety', 'goals', 'grow'].includes(b), essential: b === 'bills' || b === 'debts' }); render(); const i = document.getElementById(`in-man-${b}:${n.toLowerCase()}`); if (i) i.focus() },
    manDel: (key) => { S.draft.custom = S.draft.custom.filter((c) => c.key !== key); render() },
    manReview: () => { S.screen = 'review'; persist(); log('Manual budget reviewed. No AI and no engine suggestions were used.'); render() },
    line: (key) => { S.sheet = { type: 'line', key }; render() },
    lineReset: () => { const k = S.sheet.key; if (S.draft.ov[k]) delete S.draft.ov[k].amount; S.pins = S.pins.filter((p) => p.key !== k); render() },
    lineLock: () => { const k = S.sheet.key, l = compute().lines.find((x) => x.key === k); setOv(k, { locked: !l.locked, amount: l.amount }); log(`${l.name} ${l.locked ? 'unlocked' : 'locked at ' + money(l.amount)}. Locked lines are never changed by Buddgy, a rebuild or "fix it".`); render() },
    lineRemove: () => { const k = S.sheet.key; if (S.draft.custom.some((c) => c.key === k)) S.draft.custom = S.draft.custom.filter((c) => c.key !== k); else S.draft.removed.push(k); S.pins = S.pins.filter((p) => p.key !== k); S.sheet = null; render() },
    addBlock: (b) => { S.sheet.block = b; render() },
    addLine: () => { const n = (S.sheet.name || '').trim(), a = S.sheet.amount; if (!n || !(a > 0)) { S.toast = t('toast.addneed'); return render() } const b = S.sheet.block; S.draft.custom.push({ key: `${b}:${n.toLowerCase()}`, name: n, amount: a, block: b, isSavings: ['safety', 'goals', 'grow'].includes(b), essential: false }); S.sheet = null; render() },
    fixOver: () => { const st = compute(), r = X.rebalance(st, effDraft(st)); S.draft.ov = r.ov; log(`Trimmed ${money(st.over - r.unresolved)} from unlocked lines: wants first, then growth, essentials never below 70%.`, 'ok'); render() },
    sharpen: () => { S.mode = 'guided'; log('Continuing with the remaining questions. The draft stays as it is until they are answered.'); next() },
    adjEx: (k) => { S.sheet.text = t(k); S.sheet.pr = null; render() },
    adjRead: () => { if (!(S.sheet.text || '').trim()) return; S.sheet.pr = X.readAdjust(S.sheet.text, compute()); log(`Simulated AI turned "${S.sheet.text}" into ${S.sheet.pr.ops.length} proposed changes on existing lines. Nothing is applied yet.`); render() },
    adjApply: () => { for (const o of S.sheet.pr.ops) { if (o.add && !compute().lines.some((l) => l.key === o.key)) { const [b] = o.key.split(':'); S.draft.custom.push({ key: o.key, name: o.name, amount: o.to, block: b, ...o.add }) } else setOv(o.key, { amount: o.to }) } log('Proposal applied. Each change is an edit you can reset line by line.', 'ok'); S.sheet = null; S.toast = t('toast.applied'); render() },
    adjDecline: () => { S.declined.push(S.sheet.text); log(`Proposal declined and remembered: "${S.sheet.text}". Buddgy will not push it again.`); S.sheet = null; render() },
    whatif: (id) => { S.sheet = { type: 'whatif', id }; log(`What-if "${id}" calculated on a copy of the facts. The draft is untouched.`); render() },
    wiKeep: () => { S.drafts.push(S.sheet.id); S.toast = t('toast.wikeep'); log(`Scenario "${S.sheet.id}" kept as a separate draft. It writes no debts or goals.`, 'ok'); S.sheet = null; render() },
    day: (d) => { const c = S.startDay || Number(S.flow.a.payday || S.flow.known.payday || 1); S.startDay = Math.min(31, Math.max(1, c + Number(d))); render() },
    activate: () => {
      const st = compute(), f = st.facts
      S.active = { name: S.planName || t('act.default'), lines: st.lines, everyday: st.m.everyday, day: S.startDay || Number(S.flow.a.payday || S.flow.known.payday || 1) }
      const nd = f.debts.filter((d) => /^answered-/.test(d.id)).length, ng = f.goals.filter((g) => /^answered-/.test(g.id)).length
      log(`Budget activated${S.sim.online ? '' : ' on this device (queued for sync)'}. Records created now, once: ${nd} debts, ${ng} goals. Idempotency key ${'act-' + Math.random().toString(36).slice(2, 7)}.`, 'ok')
      clearSaved(); S.hasDraft = false; S.screen = 'activated'; render()
    },
    perm: (arg) => { const [k, v] = arg.split('|'); S.perms[k] = v === '1'; log(`${k === 'sms' ? 'SMS tracking' : 'Notifications'}: ${v === '1' ? 'allowed (system prompt would show now)' : 'declined. Asked again no sooner than 30 days, and never as a cold system dialog'}.`); S.screen = k === 'sms' ? 'permPush' : 'home'; render() },
    txn: (kind) => {
      const A0 = S.active, find = (re) => A0.lines.find((l) => re.test(l.key)) || A0.lines.find((l) => l.block === 'everyday')
      const base = Math.max(50, Math.round((A0.everyday || 2000) / 40 / 10) * 10)
      const map = { groceries: { amount: base * 2, counted: true, key: (find(/groceries/) || {}).key }, atm: { amount: base * 8, counted: false }, repay: { amount: base * 10, counted: false }, topup: { amount: base * 3, counted: false }, bnpl: { amount: base * 5, counted: true, key: (find(/shopping/) || {}).key }, salary: { amount: A0.lines.reduce((s, l) => s + l.amount, 0), counted: false } }
      S.txns.unshift({ kind, ...map[kind] }); log(`${kind}: ${map[kind].counted ? 'counted against ' + map[kind].key : 'not counted as spending'}.`); render()
    },
    editActive: () => { S.screen = 'review'; render() },
  }
  const IN = {
    name: (v) => { S.profile.name = v.trim().slice(0, 30); return false },
    text: (v) => { S.text = v; return false },
    planName: (v) => { S.planName = v; return false },
    addName: (v) => { S.sheet.name = v; return false },
    adj: (v) => { S.sheet.text = v; S.sheet.pr = null; return false },
    addAmt: (v) => { S.sheet.amount = pn(v); return false },
    stale: (v) => { S.q.value = pn(v) },
    manualIncome: (v) => { S.manualIncome = pn(v) || 0 },
    man: (v, key) => { const c = S.draft.custom.find((x) => x.key === key); if (c) c.amount = pn(v) || 0 },
    line: (v) => { setOv(S.sheet.key, { amount: pn(v) || 0 }) },
    lineR: (v) => { setOv(S.sheet.key, { amount: Number(v) }); return 'now' },
    defRefi: (v) => { S.def = { ...(S.def || {}), refi: Number(v) }; return 'now' },
    defExtra: (v) => { S.def = { ...(S.def || {}), extra: Number(v) }; return 'now' },
  }
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]')
    if (!b || b.disabled) return
    if (b.dataset.act === 'closeSheet' && b.classList.contains('sheet-bg') && e.target.closest('[data-stop]')) return
    clearTimeout(deb)
    const fn = A[b.dataset.act]
    if (fn) fn(b.dataset.arg, b)
  })
  el.addEventListener('input', (e) => {
    const n = e.target.closest('[data-in]')
    if (!n) return
    const name = n.dataset.in
    let r
    if (IN[name]) r = IN[name](n.value, n.dataset.arg)
    else if (name.startsWith('und-')) return
    else if (S.screen === 'q') { if (n.dataset.kind === 'range') { S.q.values[name] = Number(n.value); r = 'now' } else { const v = pn(n.value); if (v === undefined) delete S.q.values[name]; else S.q.values[name] = v } }
    if (r === false) return
    if (r === 'now') render(); else soon()
  })
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('.amt input')) { clearTimeout(deb); render(); const c = el.querySelector('.ft .cta:not(.alt):not(.txt)'); if (c && !c.disabled) c.click() } })

  function runHydrate() {
    const P = S.P
    if (!S.sim.online) { log('Server unreachable. Buddget does not guess: with nothing local and no answer from the server it waits instead of starting a cold-start flow.', 'warn'); return render() }
    later(() => {
      ready()
      if (P.level === 'none') { log('Server answered: this account holds nothing. Only now is the user treated as new.', 'ok'); S.screen = 'lang' }
      else { log(`Server answered: account holds income${S.h.base.bills.length ? ', bills, debts, goals' : ' and a profile'}. ${S.sim.newDevice ? 'Local store was empty (new device) but the user is NOT sent to cold start.' : 'Account setup is skipped.'}`, 'ok'); S.screen = 'home0' }
      render()
    }, S.sim.slow ? 3600 : 1100)
  }

  /* ------------------------------------------------------------ helpers for the lab and flow map */
  function autoStep() {
    const P = S.P
    switch (S.screen) {
      case 'signin': return A.signin()
      case 'lang': return A.go('country')
      case 'country': return A.go('name')
      case 'name': S.profile.name = P.name; return A.finishStub()
      case 'home0': return S.hasDraft ? A.resume() : A.go('opener')
      case 'opener': if (!S.sim.ai) return A.skipOpener(); S.text = P.story[S.lang === 'ar' ? 1 : 0]; return A.readText()
      case 'understood': return A.acceptRead()
      case 'modes': return chooseMode('guided')
      case 'stale': S.q.changed = true; S.q.value = P.t[S.q.stale]; return A.commitStale()
      case 'q': { for (let i = 0; i < 12; i++) { const x = openNodes().find((n) => S.q.values[n.id] === undefined && !S.q.skips.includes(n.id) && (n.control === 'confirm' ? false : true)); if (!x) break; const v = P.t[x.id]; if (v === undefined) { if (R.defaultFor(x, S.flow) !== undefined && x.control !== 'multi') S.q.values[x.id] = R.defaultFor(x, S.flow); else S.q.skips.push(x.id) } else S.q.values[x.id] = v } return commitQ() }
      case 'review': return A.go('activate')
      case 'activate': return A.activate()
      case 'activated': return A.go('permSms')
      case 'permSms': return A.perm('sms|1')
      case 'permPush': return A.perm('push|1')
      case 'manual': if (!S.manualIncome) S.manualIncome = P.t.income; if (!S.draft.custom.length) for (const [b, n, a] of [['bills', 'Rent', P.t.rent || 0], ['everyday', 'Groceries', Math.round(P.t.income * 0.15)], ['safety', 'Safety net', Math.round(P.t.income * 0.1)]]) if (a > 0) S.draft.custom.push({ key: `${b}:${n.toLowerCase()}`, name: n, amount: a, block: b, isSavings: b === 'safety', essential: b === 'bills' }); return A.manReview()
    }
  }
  function playUntil(test, max) { for (let i = 0; i < (max || 40); i++) { if (test() || !['stale', 'q', 'modes', 'opener', 'understood', 'home0', 'name', 'country', 'lang'].includes(S.screen)) return; autoStep() } }
  /** Jumps the phone to a stage of the journey, answering as the current persona on the way. */
  function goto(target) {
    const { pid, tw } = S
    start(pid, tw, true)
    const P = S.P
    if (target === 'signin') return
    if (target === 'hydrate') return A.signin()
    S.profile.name = P.name
    if (['lang', 'country', 'name'].includes(target)) { S.screen = target; return render() }
    ready()
    if (target === 'home0') { S.screen = 'home0'; return render() }
    if (target === 'opener') { S.screen = 'opener'; return render() }
    if (target === 'understood') { S.text = P.story[S.lang === 'ar' ? 1 : 0]; S.read = X.readSituation(S.text, cur()); S.screen = Object.keys(S.read.found).length ? 'understood' : 'modes'; if (S.screen === 'modes') S.note = 'modes.nothing'; return render() }
    if (P.intent) setIntent(P.intent)
    if (target === 'modes') { S.screen = 'modes'; return render() }
    if (target === 'stale') { S.mode = 'guided'; return next() }
    if (target === 'manual') { S.mode = null; return chooseMode('manual') }
    if (target === 'q' || target === 'found') { S.mode = 'guided'; next(); if (target === 'q') playUntil(() => S.screen === 'q' && R.NODE_BY_ID.get(S.q.head).control !== 'confirm', 6); return }
    if (target === 'draft') { S.mode = 'guided'; next(); let n = 0; playUntil(() => ++n > 4, 6); return A.saveLater() }
    const w = X.autoWalk(P, 'guided')
    S.flow = w.flow; S.staleLeft = []; S.mode = 'guided'; S.aiIds = []
    if (target === 'building') return build()
    S.screen = 'review'
    if (target === 'line') S.sheet = { type: 'line', key: (compute().lines.find((l) => l.block === 'everyday') || compute().lines[0]).key }
    if (target === 'adjust') S.sheet = { type: 'adjust' }
    if (target === 'whatif') S.sheet = { type: 'whatif' }
    if (target === 'activate') S.screen = 'activate'
    if (['perms', 'home'].includes(target)) { A.activate(); S.screen = target === 'perms' ? 'permSms' : 'home' }
    render()
  }
  const EDGE = {
    noIncome: () => { start('nour', {}, false); S.profile.name = 'Nour'; ready(); S.mode = 'ai'; S.flow = R.answer(R.answer(S.flow, 'income', 0), 'housing', 'family'); log('Edge case: no income. Income answered as 0.', 'warn'); S.screen = 'review'; render() },
    missing: () => { start('nour', {}, false); S.profile.name = 'Nour'; ready(); S.mode = 'ai'; S.flow = R.answer(R.answer(S.flow, 'income', 18000), 'housing', 'rent'); for (const id of ['rent', 'rentFreq', 'rentIncludesUtilities']) S.flow = R.skip(S.flow, id); log('Edge case: only income and "I rent" are known. Rent itself was skipped, so it is estimated and labelled.', 'warn'); S.screen = 'review'; render() },
    conflict: () => { S.sim.ai = true; start('salma', { conflictRent: 12500 }, false); S.profile.name = 'Salma'; ready(); setIntent('debt'); S.mode = 'ai'; next(); playUntil(() => S.screen === 'q' && S.q.head === 'rentCheck', 5); log('Edge case: the profile says rent is 16,000 but the last six months of records average 12,500. Buddgy asks; it never silently picks one.', 'warn'); render() },
    expired: () => { start('karim', {}, false); S.profile.name = 'Karim'; ready(); setIntent('save'); S.mode = 'ai'; next() },
    aiDown: () => { S.sim.ai = false; start('nour', {}, false); S.profile.name = 'Nour'; ready(); S.screen = 'opener'; log('Edge case: the AI service is unavailable.', 'warn'); render() },
    offline: () => { start('karim', {}, false); S.sim.online = false; S.profile.name = 'Karim'; ready(); setIntent('save'); S.mode = 'guided'; log('Edge case: the phone is offline mid-build.', 'warn'); next() },
    slow: () => { S.sim.slow = true; S.sim.online = true; start('salma', {}, false); A.signin() },
    newDevice: () => { S.sim.newDevice = true; S.sim.online = true; S.sim.slow = false; start('salma', {}, false); A.signin() },
    abandon: () => { start('omar', {}, false); goto('draft') },
    dupBuild: () => { start('nour', {}, false); S.profile.name = 'Nour'; ready(); S.mode = 'ai'; S.flow = R.answer(R.answer(S.flow, 'income', 18000), 'housing', 'family'); build(); later(() => build(), 450) },
    badGoal: () => { start('nour', { goalTarget: 2000000, goalMonths: 6 }, false); S.profile.name = 'Nour'; ready(); setIntent('goal'); S.mode = 'guided'; next(); playUntil(() => S.screen === 'q' && S.q.head === 'goalAdjust', 30); log('Edge case: a goal of 2,000,000 in 6 months against an income of 18,000. The graph raises a check instead of building a plan that fails.', 'warn'); render() },
  }

  window.Phone = { start, goto, autoStep, registry, compute, restore, savedDraft, clearSaved, render, edge: (id) => { timers.forEach(clearTimeout); EDGE[id]() }, state: () => S, setTheme: (th) => { S.theme = th; render() }, setLang: (l) => { S.lang = l; render() }, money: (n) => money(n) }
  start('nour')
})()
