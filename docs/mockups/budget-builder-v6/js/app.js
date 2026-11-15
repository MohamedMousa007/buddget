/* The phone: every screen from sign-in to a live budget. Facts live in S.input, the person's edits in S.edits; every amount comes from the engine. */
;(function () {
  'use strict'
  const E = window.Engine, Dt = window.Data, I = window.I18N
  const el = document.getElementById('ph')
  let S = { sim: { ai: true, online: true, newDevice: false, slow: false }, theme: null, log: [] }
  let timers = []
  const later = (fn, ms) => timers.push(setTimeout(fn, ms))
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const t = (k, p) => I.t(S.lang, k, p)
  const cur = () => S.input.cur
  const money = (n, c) => { const s = Dt.SYMBOL[c || cur()]; return (n < 0 ? '-' : '') + s + (s.length > 1 ? ' ' : '') + Math.abs(Math.round(n)).toLocaleString('en-US') }
  const fm = (n, c) => `<bdi class="num">${money(n, c)}</bdi>`
  const ic = (n, cls) => `<i data-lucide="${n}"${cls ? ` class="${cls}"` : ''}></i>`
  const pn = (v) => { const s = Dt.toLatin(String(v)).replace(/[^0-9.]/g, ''); return s === '' ? undefined : Math.round(Number(s)) }
  const log = (msg, kind) => { S.log.unshift({ at: new Date().toTimeString().slice(0, 8), msg, kind: kind || '' }); S.log = S.log.slice(0, 50) }

  const FACES = { happy: ['gold', '<path d="M8.5 14a1.75 1.75 0 0 1 3 0"/><path d="M12.5 14a1.75 1.75 0 0 1 3 0"/>'], awake: ['pri-bright', '<path d="M9.75 12.5v1.75"/><path d="M14.25 12.5v1.75"/>'], curious: ['pri-bright', '<path d="M9.75 13v1.25"/><path d="M14.25 12v2.25"/><path d="M13.25 10.5l2-.5"/>'],
    thinking: ['pri-bright', '<path d="M9 13.5h.01"/><path d="M12 13.5h.01"/><path d="M15 13.5h.01"/>'], done: ['green', '<path d="M9.25 13.5 11 15.25l3.75-3.75"/>'], worried: ['amber', '<path d="M9.75 13v1"/><path d="M14.25 13v1"/><path d="M8.75 11.75 10.5 11"/><path d="M15.25 11.75 13.5 11"/><path d="M10.75 16.5a2 2 0 0 1 2.5 0"/>'] }
  const budSvg = (mood) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 12.5a8.5 8.5 0 0 1 17 0V16a5 5 0 0 1-5 5h-7a5 5 0 0 1-5-5z"/><path d="M10 8.5h4a3.5 3.5 0 0 1 3.5 3.5v2.5a3.5 3.5 0 0 1-3.5 3.5h-4a3.5 3.5 0 0 1-3.5-3.5V12a3.5 3.5 0 0 1 3.5-3.5z"/><path d="M20.5 12h.5a1.5 1.5 0 0 1 1.5 1.5v2a1.5 1.5 0 0 1-1.5 1.5h-.5"/><path d="M3.5 12H3a1.5 1.5 0 0 0-1.5 1.5v2A1.5 1.5 0 0 0 3 17h.5"/><path d="M16.3 5.2 17.5 2.5"/><g stroke="var(--${FACES[mood][0]})">${FACES[mood][1]}</g></svg>`
  const bud = (mood, size) => `<div class="bud ${size || ''}">${budSvg(mood)}</div>`
  window.budSvg = budSvg

  const BLOCKS = ['home', 'debt', 'living', 'life', 'safety', 'goals', 'future', 'free']
  const BCOL = { home: 'c4', debt: 'c3', living: 'c5', life: 'c6', safety: 'c1', goals: 'c2', future: 'c7', free: 'c0' }
  const BICON = { home: 'house', debt: 'landmark', living: 'shopping-basket', life: 'coffee', safety: 'shield-check', goals: 'target', future: 'calendar-clock', free: 'wallet' }
  const LICON = { housing: 'house', utilities: 'zap', phone: 'smartphone', subs: 'repeat', school: 'graduation-cap', support: 'hand-heart', gameya: 'users', arrears: 'triangle-alert', payoff: 'flame', groceries: 'shopping-basket', transport: 'bus', health: 'heart-pulse', dining: 'utensils', fun: 'ticket', shopping: 'shopping-bag', personal: 'sparkles', zakat: 'hand-coins', annual: 'calendar-clock', invest: 'trending-up', safety: 'shield-check', buffer: 'wallet' }
  const QUICK = { home: ['housing', 'utilities', 'phone', 'school', 'support'], debt: [], living: ['groceries', 'transport', 'health'], life: ['dining', 'fun', 'shopping', 'personal'], safety: ['safety'], goals: [], future: ['annual', 'zakat', 'invest'], free: [] }

  /* ------------------------------------------------------------ session */
  function start(pid, tw, keepLog) {
    timers.forEach(clearTimeout); timers = []
    const P = Dt.variant(Dt.PERSONAS[pid], tw)
    S = { sim: S.sim, theme: S.theme, log: keepLog ? S.log : [], pid, tw: tw || {}, P, lang: P.lang, name: P.level === 'none' ? '' : P.name.split(' ')[0],
      screen: 'welcome', input: { country: P.country, cur: P.cur, $src: {} }, edits: { pins: {}, removed: [], custom: [] }, mode: null, tab: 'plan', sheet: null, toast: null,
      heard: [], flags: [], text: '', words: false, srcRows: [{ amount: undefined, cur: P.cur }], declined: [], drafts: [], txns: [], perms: {}, prev: {}, building: false, hasDraft: false }
    if (!keepLog) log(`Started as ${P.name}: ${P.title.toLowerCase()}. All data is fictional.`)
    render()
  }
  const answeredInput = () => S.input
  function compute(input, edits) {
    input = input || S.input; edits = edits || S.edits
    let st
    if (S.mode === 'self' && input === S.input) {
      const c = E.complete(input)
      st = E.settle({ v: c.v, src: c.src, b: c.b, basis: c.v.income, basisKind: 'income', lines: [], shortfall: 0 }, edits)
    } else st = E.settle(E.build(input), edits)
    st.m = E.metrics(st); st.r = E.risks(st)
    return st
  }
  function persist() {
    S.hasDraft = true
    try { localStorage.setItem('bb6-draft', JSON.stringify({ pid: S.pid, tw: S.tw, lang: S.lang, name: S.name, input: S.input, edits: S.edits, mode: S.mode, heard: S.heard, own: compute().m.own, at: Date.now() })) } catch (e) { /* storage blocked; the in-memory draft still works */ }
    return S.sim.online ? 'saved and synced' : 'saved on this phone, syncs when back online'
  }
  const savedDraft = () => { try { const d = JSON.parse(localStorage.getItem('bb6-draft') || 'null'); return d && Dt.PERSONAS[d.pid] ? d : null } catch (e) { return null } }
  const clearSaved = () => { try { localStorage.removeItem('bb6-draft') } catch (e) { /* nothing to clear */ } }
  function restore() {
    const d = savedDraft(); if (!d) return false
    start(d.pid, d.tw, false)
    Object.assign(S, { lang: d.lang, name: d.name, input: d.input, edits: d.edits, mode: d.mode, heard: d.heard || [], hasDraft: true, screen: 'home0' })
    log('Draft restored from this browser at the exact point it was left.', 'ok')
    render(); return true
  }

  /* ------------------------------------------------------------ facts */
  function setFact(fact, value, how) {
    const before = compute()
    S.input = E.withFact(S.input, fact, value, how)
    if (how !== 'ai') S.heard = S.heard.filter((k) => k !== fact && !(fact === 'household' && (k === 'adults' || k === 'kids')))
    const after = compute()
    log(`${fact} = ${typeof value === 'object' ? JSON.stringify(value) : value} (${how || 'you'}), ${persist()}. Built from own numbers: ${before.m.own}% → ${after.m.own}%.`)
  }
  const skipQ = (id) => { S.input = { ...S.input, $skip: [...(S.input.$skip || []), id] }; log(`${id}: kept the estimate. It stays labelled as a typical cost.`) }

  /* ------------------------------------------------------------ pieces */
  const scr = (o) => `<div class="scr">${o.hd || ''}<div class="body${o.tight ? ' tight' : ''}">${o.body}</div>${o.dock || ''}${o.ft ? `<div class="ft">${o.ft}</div>` : ''}</div>`
  const hd = (o) => `<div class="hd">${o.back === false ? '<span class="ib"></span>' : `<button class="ib flip" data-act="${o.backAct || 'back'}" aria-label="${t('back')}">${ic('chevron-left')}</button>`}${o.mid || '<span style="flex:1"></span>'}${o.right || '<span class="ib"></span>'}</div>`
  const cta = (label, act, o) => `<button class="cta ${(o && o.cls) || ''}" data-act="${act}"${o && o.arg !== undefined ? ` data-arg="${esc(o.arg)}"` : ''}${o && o.off ? ' disabled' : ''}>${o && o.icon ? ic(o.icon) : ''}<span>${label}</span></button>`
  const chip = (label, act, arg, on, cls) => `<button class="chip ${cls || ''}" data-act="${act}" data-arg="${esc(arg)}" aria-pressed="${!!on}">${label}</button>`
  const opt = (label, act, arg, on, sub, icon) => `<button class="opt" data-act="${act}" data-arg="${esc(arg)}" aria-pressed="${!!on}">${icon ? `<span class="tile" style="--tc:var(--pri)">${ic(icon)}</span>` : ''}<span class="grow">${label}${sub ? `<small>${sub}</small>` : ''}</span><span class="ck">${ic('check')}</span></button>`
  const amt = (id, v, o) => `<div class="amt ${(o && o.cls) || ''}"><input id="in-${id}" data-in="${id}" inputmode="numeric" autocomplete="off" value="${v == null ? '' : v}" placeholder="${(o && o.ph) || '0'}" aria-label="${(o && o.label) || 'amount'}"><span>${Dt.SYMBOL[(o && o.cur) || cur()]}</span></div>`
  const note = (text, kind, icon) => `<div class="note ${kind || ''}">${ic(icon || ({ bad: 'triangle-alert', warn: 'info', ok: 'circle-check', ai: 'sparkles' }[kind] || 'info'))}<span>${text}</span></div>`
  const lname = (l) => (l.raw ? esc(I.raw(S.lang, l.name)) : l.key === 'payoff' ? t('n.payoff', { x: esc(l.argRaw ? I.raw(S.lang, l.arg) : I.raw(S.lang, l.arg)) }) : I.has('n.' + l.name) ? t('n.' + l.name) : esc(l.name))
  const why = (l) => { const [k, p] = l.why || ['w.custom', {}]; const q = { ...p }; for (const x of ['avg', 'typ', 'year', 'need']) if (q[x] != null) q[x] = fm(q[x]); return t(k, q) }
  const riskText = (r) => { const p = { ...r[2] }; for (const x of ['v', 'spend', 'floor', 'usual']) if (p[x] != null) p[x] = fm(p[x]); if (p.name) p.name = esc(p.raw ? I.raw(S.lang, p.name) : p.name); return t(r[1], p) }
  const srcTag = (l) => `<span class="tag ${l.conf === 'high' ? (l.src === 'rule' ? 'rule' : l.src === 'records' || l.src === 'profile' ? 'records' : 'you') : l.conf}">${l.conf === 'high' ? t('src.' + (l.src === 'profile' ? 'records' : l.src)) : t('conf.' + l.conf)}</span>`

  function ring(pct, size) {
    const r = 26, c = 2 * Math.PI * r, off = c * (1 - pct / 100)
    return `<div class="ring ${size || ''}" role="img" aria-label="${pct}% ${t('cv.own')}"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="${r}" class="trk"/><circle cx="32" cy="32" r="${r}" class="val" stroke-dasharray="${c}" stroke-dashoffset="${off}" data-off="${off}" data-c="${c}"/></svg><b class="num">${pct}%</b></div>`
  }
  function ribbon(st, cls) {
    const tot = Math.max(1, E.sum(st.lines.map((l) => l.amount)))
    return `<div class="ribbon ${cls || ''}">${BLOCKS.map((b) => {
      const ls = st.lines.filter((l) => l.block === b), a = E.sum(ls.map((l) => l.amount))
      if (a <= 0) return ''
      const soft = E.sum(ls.filter((l) => l.conf !== 'high').map((l) => l.amount))
      return `<i data-b="${b}" style="--w:${(a / tot) * 100}%;--soft:${(soft / a) * 100}%;background:var(--${BCOL[b]})" title="${t('b.' + b)}"></i>`
    }).join('')}</div>`
  }

  /* ------------------------------------------------------------ the sharpen dock: one card, the most useful question */
  function cardFor(item) {
    if (item.kind === 'stale') return `<div class="qq">${t('sh.stale')}</div><p class="sm mut">${t('sh.staleL', { v: fm(item.value), when: I.month(S.lang, item.at) })}</p><div class="row">${chip(t('sh.same'), 'staleSame', item.fact)}</div>${amt('stale', S.dock.v, { cls: 's' })}`
    if (item.kind === 'conflict') return `<div class="qq">${t('sh.conflict')}</div><p class="sm mut">${t('sh.conflictL', { a: fm(item.a), b: fm(item.b) })}</p><div class="g2">${opt(t('sh.useA', { v: fm(item.a) }), 'conflict', item.a)}${opt(t('sh.useB', { v: fm(item.b) }), 'conflict', item.b)}</div>`
    const q = item.q, v = E.complete(S.input).v, d = S.dock
    const label = t(q.id === 'housingCost' && v.housing === 'family' ? 'q.housingCost.qFamily' : `q.${q.id}.q`)
    let ctl = ''
    if (q.control === 'chips') ctl = `<div class="chips">${q.opts.map((o) => chip(t(`q.${q.id}.${o}`), 'pickQ', o, false)).join('')}</div>`
    else if (q.control === 'toggle') ctl = `<div class="g2">${opt(t('yes'), 'pickQ', 'true')}${opt(t('no'), 'pickQ', 'false')}</div>`
    else if (q.control === 'amount') ctl = `${I.has(`q.${q.id}.hint`) ? `<p class="xs mut">${t(`q.${q.id}.hint`)}</p>` : ''}<div class="row nowrap">${amt('dock', d.v, { cls: 's grow' })}<button class="btn pri" data-act="saveQ">${t('sh.answer')}</button></div>`
    else if (q.control === 'amountPeriod') ctl = `<div class="row nowrap">${amt('dock', d.v, { cls: 's grow' })}<button class="btn pri" data-act="saveQ">${t('sh.answer')}</button></div><div class="chips">${['month', 'quarter', 'year'].map((p) => chip(t('q.per.' + p), 'period', p, (d.per || 'month') === p, 's')).join('')}</div>`
    else if (q.control === 'household') ctl = `<div class="hh"><div><span>${t('q.household.adults')}</span><div class="stp s"><button data-act="hh" data-arg="adults|-1" aria-label="-">${ic('minus')}</button><b>${d.adults}</b><button data-act="hh" data-arg="adults|1" aria-label="+">${ic('plus')}</button></div></div><div><span>${t('q.household.kids')}</span><div class="stp s"><button data-act="hh" data-arg="kids|-1" aria-label="-">${ic('minus')}</button><b>${d.kids}</b><button data-act="hh" data-arg="kids|1" aria-label="+">${ic('plus')}</button></div></div><button class="btn pri" data-act="saveQ">${t('sh.answer')}</button></div>`
    else if (q.control === 'debts') ctl = `<div class="g2">${opt(t('q.debts.none'), 'pickQ', '[]')}${opt(t('q.debts.add'), 'sheet', 'debt')}</div>`
    else if (q.control === 'goals') ctl = `<div class="g2">${opt(t('q.goals.none'), 'pickQ', '[]')}${opt(t('q.goals.add'), 'sheet', 'goal')}</div>`
    return `<div class="qq">${label}</div>${ctl}`
  }
  function dock(st) {
    if (S.mode === 'self') return ''
    const Q = E.queue(S.input, S.edits)
    if (S.mode === 'auto') {
      if (!Q.length) return ''
      const top = Q.slice(0, 3)
      let x = S.input
      // If those three were answered with today's values, how much would rest on the person's own numbers.
      for (const it of top) { const cv = E.complete(x).v; x = it.kind === 'q' ? E.withFact(x, it.q.fact, it.q.fact === 'household' ? { adults: cv.adults, kids: cv.kids } : cv[it.q.fact]) : E.withFact(x, it.fact, it.kind === 'conflict' ? it.a : it.value) }
      const pct = E.metrics(E.settle(E.build(x), S.edits)).own
      return `<div class="dock slim"><span class="grow sm">${t('sh.auto', { n: top.length, pct: `<bdi class="num">${pct}%</bdi>` })}</span><button class="btn s" data-act="mode" data-arg="together">${t('sh.autoCta')}</button></div>`
    }
    if (!Q.length) return `<div class="dock slim">${ic('circle-check', 'ok')}<span class="grow sm">${t('sh.done')}</span></div>`
    const item = Q[0]
    if (!S.dock || S.dock.id !== item.id) { const v = E.complete(S.input).v; S.dock = { id: item.id, v: undefined, per: 'month', adults: v.adults || 1, kids: v.kids || 0 } }
    return `<div class="dock" data-id="${item.id}"><div class="row nowrap sb"><span class="eyebrow">${ic('sparkles')}${t(item.core ? 'sh.core' : 'sh.eyebrow')}</span><span class="imp">${t('sh.impact', { v: '±' + money(item.impact) })}</span></div>
      ${cardFor(item)}<div class="row nowrap sb">${item.kind === 'q' && !item.core ? `<button class="link" data-act="skipQ" data-arg="${item.id}">${t('sh.notsure')}</button>` : '<span></span>'}<button class="link" data-act="sheet" data-arg="queue">${Q.length > 1 ? t('sh.of', { a: Q.length - 1 }) : ''} ${ic('chevron-right', 'flip')}</button></div></div>`
  }

  /* ------------------------------------------------------------ canvas tabs */
  function planTab(st) {
    const m = st.m, structural = st.over > 0 && st.lines.every((l) => !l.pinned || l.essential)
    let h = ''
    if (S.heard.length) {
      const v = E.complete(S.input).v
      const shown = [...new Set(S.heard.map((k) => (k === 'adults' || k === 'kids' ? 'household' : k)))]
      const val = (k) => k === 'household' ? `${v.adults} + ${v.kids}` : k === 'debts' ? v.debts.map((d) => money(d.balance)).join(', ') : k === 'goals' ? v.goals.map((g) => esc(I.raw(S.lang, g.name)) + ' ' + money(g.target)).join(', ') : typeof v[k] === 'number' ? money(v[k]) : I.has(`q.${k}.${v[k]}`) ? t(`q.${k}.${v[k]}`) : esc(v[k])
      const lbl = (k) => (I.has(`q.${k}.q`) ? t(`q.${k}.q`) : k === 'income' ? t('h.income') : k)
      h += `<div class="heard"><div class="row sb nowrap"><b>${ic('sparkles')} ${t('cv.heard')}</b><button class="btn s" data-act="heardOk">${t('cv.heardOk')}</button></div><p class="xs mut">${t('cv.heardL')}</p><div class="hchips">${shown.map((k) => `<span class="hchip${S.flags.includes(k) ? ' flag' : ''}"><small>${lbl(k)}</small><b>${val(k)}</b><button data-act="unhear" data-arg="${k}" aria-label="${t('remove')}">${ic('x')}</button></span>`).join('')}</div>${S.flags.length ? note(t('cv.flagL'), 'warn') : ''}</div>`
    }
    if (st.over > 0 && structural) h += levers(st)
    if (st.r.length) h += `<div class="risks">${st.r.slice(0, 3).map((r) => note(riskText(r), r[0] === 'bad' ? 'bad' : r[0] === 'warn' ? 'warn' : '')).join('')}</div>`
    for (const b of BLOCKS) {
      const ls = st.lines.filter((l) => l.block === b)
      if (!ls.length && !(S.mode === 'self' && QUICK[b].length)) continue
      h += `<section class="blk"><div class="bh"><span class="tile" style="--tc:var(--${BCOL[b]})">${ic(BICON[b])}</span><b>${t('b.' + b)}</b><span class="num mut">${money(E.sum(ls.map((l) => l.amount)))}</span></div><div class="card">`
      for (const l of ls) {
        const ch = S.prev.lines && S.prev.lines[l.key] != null && S.prev.lines[l.key] !== l.amount
        h += `<button class="li conf-${l.conf}${ch ? ' chg' : ''}" data-act="line" data-arg="${esc(l.key)}"><span class="lic" style="--tc:var(--${BCOL[b]})">${ic(LICON[l.key] || LICON[l.name] || (l.goalId ? 'target' : l.debtId ? 'credit-card' : 'circle-dot'))}</span><span class="nm"><b>${lname(l)}</b>${srcTag(l)}</span>${l.pinned ? ic('pin', 'mut pin') : ''}<span class="am">${money(l.amount)}</span></button>`
      }
      if (S.mode === 'self') { const have = ls.map((l) => l.key), hint = E.settle(E.build(S.input)).lines; h += `<div class="li add">${QUICK[b].filter((k) => !have.includes(k)).map((k) => { const s = hint.find((x) => x.key === k); return `<button class="chip s" data-act="selfAdd" data-arg="${b}|${k}">${ic('plus')}${t('n.' + k)}${s ? `<small>${t('mn.typ', { v: money(s.amount) })}</small>` : ''}</button>` }).join('')}<button class="chip s" data-act="sheet" data-arg="add|${b}">${ic('plus')}${t('mn.other')}</button></div>` }
      h += `</div></section>`
    }
    if (S.mode !== 'self') h += `<button class="chip" data-act="sheet" data-arg="add|home" style="align-self:flex-start">${ic('plus')}${t('cv.add')}</button>`
    return h
  }
  function levers(st) {
    const L = S.levers || { refi: 0, extra: 0 }, debt = E.sum(st.lines.filter((l) => l.block === 'debt' && l.key !== 'payoff').map((l) => l.amount))
    const gap = st.over - L.extra - Math.round((debt * L.refi) / 100)
    return `<div class="card p lev"><b>${t('lv.short')}</b><p class="xs mut">${t('lv.shortL')}</p>
      <label class="fld"><span>${t('lv.refi')} <b class="num">${L.refi}%</b></span><input type="range" id="in-refi" data-in="refi" data-kind="range" min="0" max="50" step="5" value="${L.refi}"></label>
      <label class="fld"><span>${t('lv.extra')} ${fm(L.extra)}</span><input type="range" id="in-extra" data-in="extra" data-kind="range" min="0" max="${E.r10(st.basis * 0.6)}" step="${Math.max(50, E.r10(st.basis / 40))}" value="${L.extra}"></label>
      ${note(gap > 0 ? t('lv.still', { v: fm(gap) }) : t('lv.closed', { v: fm(-gap) }), gap > 0 ? 'warn' : 'ok')}</div>`
  }
  function payTab(st) {
    const order = ['home', 'debt', 'living', 'safety', 'goals', 'future', 'life', 'free']
    let left = st.basis, h = `<p class="sm mut">${t('pd.l', { v: fm(st.basis) })}</p><div class="pay">`
    for (const b of order) {
      const a = E.sum(st.lines.filter((l) => l.block === b).map((l) => l.amount)); if (a <= 0) continue
      left -= a
      h += `<div class="pstep"><span class="dot" style="background:var(--${BCOL[b]})"></span><div class="grow"><div class="row sb nowrap"><b>${t('b.' + b)}</b><span class="num">−${money(a)}</span></div><div class="pbar"><i style="width:${Math.max(0, (left / st.basis) * 100)}%"></i></div><small class="mut">${left < 0 ? `<span class="bad">${money(left)}</span>` : `${money(left)} ${t('pd.left')}`}</small></div></div>`
    }
    return h + '</div>'
  }
  function yearTab(st) {
    const m = st.m, now = 11, ev = Array.from({ length: 12 }, () => [])
    const put = (mo, html) => { if (mo != null && mo >= 1 && mo <= 12) ev[mo - 1].push(html); else if (mo != null && mo > 12) ev.after = (ev.after || []).concat(html + ` <span class="mut">(${I.dur(S.lang, mo)})</span>`) }
    put(m.safetyFull === 0 ? null : m.safetyFull, `${ic('shield-check')} ${t('yr.safety', { n: m.targetMonths })}`)
    for (const g of m.goalsOut) put(g.months === 0 ? null : g.months, `${ic('target')} ${t('yr.goal', { name: esc(g.raw ? I.raw(S.lang, g.name) : g.name) })}`)
    for (const d of st.v.debts.filter((x) => x.balance > 0)) put(m.cleared && m.cleared[d.id], `${ic('landmark')} ${t('yr.debtOne', { name: esc(d.raw ? I.raw(S.lang, d.name) : I.raw(S.lang, d.name)) })}`)
    if (m.hasDebt && m.debtFree) put(m.debtFree, `${ic('party-popper')} <b>${t('yr.debt')}</b>`)
    const an = st.lines.find((l) => l.key === 'annual'); if (an) put(12, `${ic('calendar-clock')} ${t('yr.annual', { v: money(an.amount * 12) })}`)
    return `<p class="sm mut">${t('yr.l')}</p><div class="year">${ev.map((e, i) => `<div class="ym${e.length ? ' has' : ''}"><span class="mn">${I.monthName(S.lang, now + i)}</span><div class="grow">${e.length ? e.map((x) => `<div class="yev">${x}</div>`).join('') : `<span class="xs mut">${t('yr.none')}</span>`}</div></div>`).join('')}${ev.after ? `<div class="ym has"><span class="mn">${ic('chevrons-right')}</span><div class="grow"><b class="xs">${t('yr.after')}</b>${ev.after.map((x) => `<div class="yev">${x}</div>`).join('')}</div></div>` : ''}</div>`
  }

  /* ------------------------------------------------------------ screens */
  const V = {
    welcome: () => scr({ body: `<div class="hero-w"><div class="ribbon demo">${['c4', 'c3', 'c5', 'c6', 'c1', 'c2', 'c0'].map((c, i) => `<i style="--w:${[24, 10, 22, 14, 12, 12, 6][i]}%;background:var(--${c})"></i>`).join('')}</div>${bud('happy', 'l')}</div><h1 class="ttl">${t('w.t')}</h1><p class="lead">${t('w.l')}</p><div class="grow"></div>`,
      ft: cta(t('w.apple'), 'signin', { icon: 'apple' }) + cta(t('w.google'), 'signin', { cls: 'alt' }) + cta(t('w.email'), 'signin', { cls: 'alt', icon: 'mail' }) + `<p class="xs mut center">${t('w.sim')}</p>` }),
    gate: () => { const off = !S.sim.online; return scr({ body: `<div class="grow"></div>${bud(off ? 'worried' : 'thinking', 'l')}<h1 class="ttl">${t(off ? 'g.off.t' : 'g.t')}</h1><p class="lead">${t(off ? 'g.off.l' : S.sim.slow ? 'g.slow' : 'g.l')}</p><div class="grow"></div>`, ft: off ? cta(t('retry'), 'retryGate', { icon: 'refresh-cw' }) : '' }) },
    setup: () => {
      const c = S.input.country, info = Dt.COUNTRIES[c]
      return scr({ hd: hd({ back: false }), body: `${bud('happy')}<h1 class="ttl">${t('s.t')}</h1><p class="lead">${t('s.l')}</p>
        <div class="card setup">
          <div class="srow"><span>${t('s.lang')}</span><span class="seg">${[['en', 'English'], ['ar', 'العربية']].map(([k, l]) => `<button data-act="setLang" data-arg="${k}" aria-pressed="${S.lang === k}">${l}</button>`).join('')}</span></div>
          <div class="srow col"><span>${t('s.country')}</span><div class="chips">${['EG', 'AE', 'SA', 'OTHER'].map((k) => chip(t('c.' + k), 'setCountry', k, c === k, 's')).join('')}</div></div>
          <div class="srow col"><span>${t('s.cur')}</span><div class="chips">${Object.keys(Dt.SYMBOL).map((k) => chip(`<bdi class="num">${k}</bdi>`, 'setCur', k, cur() === k, 's')).join('')}</div><small class="mut">${t('s.curNote')}</small></div>
          <div class="srow col"><span>${t('s.name')} <small class="mut">${t('s.nameHint')}</small></span><input class="txt-in" id="in-name" data-in="name" data-kind="text" value="${esc(S.name)}" autocomplete="off" aria-label="${t('s.name')}"></div>
        </div><p class="xs mut">${ic('smartphone')} ${t('s.device', { tz: info.tz, day: t('day.' + info.week) })}</p>`, ft: cta(t('s.cta'), 'setupDone', { icon: 'check' }) })
    },
    home0: () => {
      const P = S.P, k = Dt.known(P), v = E.complete(k).v, d = savedDraft()
      const rows = [[t('h.income'), v.income > 0 ? fm(v.income) : null], [t('h.bills'), k.bills ? k.bills.length + (k.subsCount ? ` + ${k.subsCount}` : '') : null], [t('h.debts'), k.debts ? k.debts.length : null], [t('h.goals'), k.goals ? k.goals.length : null], [t('h.accounts'), P.accounts && P.level === 'full' ? P.accounts.length : null], [t('h.months'), k.history ? k.history.months : null]].filter((r) => r[1] != null)
      return scr({ body: `<div class="row nowrap" style="margin-top:6px">${bud('happy', 's')}<div><div class="eyebrow">${t('h.welcome')}</div><b class="h2">${t('h.hi', { name: esc(S.name || P.name) })}</b></div></div>
        ${S.sim.newDevice ? note(t('h.newdev'), 'ok', 'smartphone') : ''}
        ${d ? `<div class="card p"><div class="row sb"><b>${t('h.draft')}</b>${ring(d.own, 's')}</div><p class="sm mut">${t('h.draftL')}</p><div class="g2">${cta(t('h.resume'), 'resume', { icon: 'play' })}${cta(t('h.fresh'), 'freshDraft', { cls: 'alt' })}</div></div>` : ''}
        <div class="card"><div class="li static"><b>${t('h.knows')}</b></div>${rows.map(([a, b]) => `<div class="li static"><span class="nm sm">${a}</span><span class="am">${b}</span></div>`).join('')}</div><p class="sm mut">${t('h.instant')}</p>`, ft: d ? '' : cta(t('h.build'), 'buildKnown', { icon: 'sparkles' }) })
    },
    start: () => {
      const rows = S.srcRows, total = Math.round(E.sum(rows.map((r) => E.conv(r.amount || 0, r.cur, cur())))), multi = rows.some((r) => r.cur !== cur())
      if (S.words) return scr({ hd: hd({ backAct: 'wordsOff' }), body: `${bud('curious')}<h1 class="ttl m">${t('st.wordsT')}</h1><p class="lead">${t('st.wordsL')}</p>
        ${S.sim.ai ? `<textarea class="txt-in" id="in-text" data-in="text" data-kind="text" placeholder="${t('st.ph')}" aria-label="${t('st.wordsT')}">${esc(S.text)}</textarea><div class="chips">${chip(ic('sparkles') + t('st.sample', { name: esc(S.P.name.split(' ')[0]) }), 'sample', '1', false, 's')}${chip(ic('mic') + t('st.voice'), 'voice', '1', false, 's')}</div><p class="xs mut">${t('st.simAI')}</p>` : note(t('st.aiOff'), 'warn', 'cloud-off')}`,
        ft: (S.sim.ai ? cta(t('st.read'), 'readWords', { icon: 'sparkles' }) : '') + cta(t('st.number'), 'wordsOff', { cls: 'txt' }) })
      return scr({ hd: hd({ backAct: S.P.level === 'none' ? 'toSetup' : 'toHome' }), body: `${bud('happy')}<p class="eyebrow">${S.name ? t('st.hi', { name: esc(S.name) }) : t('st.hiAnon')}</p><h1 class="ttl m">${t('st.q')}</h1><p class="why">${t('st.hint')}</p>
        <div class="srcs">${rows.map((r, i) => `<div class="srcrow">${amt('src' + i, r.amount, { cur: r.cur, label: t('st.source') })}<div class="curpick">${[cur(), ...['USD', 'EUR', 'GBP', 'EGP', 'AED', 'SAR'].filter((c) => c !== cur())].slice(0, 4).map((c) => `<button data-act="srcCur" data-arg="${i}|${c}" aria-pressed="${r.cur === c}" class="num">${c}</button>`).join('')}</div>${i ? `<button class="ib s" data-act="srcDel" data-arg="${i}" aria-label="${t('remove')}">${ic('x')}</button>` : ''}</div>`).join('')}</div>
        <div class="row sb"><button class="chip s" data-act="srcAdd">${ic('plus')}${t('st.addSource')}</button>${rows.length > 1 || multi ? `<span class="sm">${t('st.total', { cur: cur() })} <b>${fm(total)}</b></span>` : ''}</div>${multi ? `<p class="xs mut">${t('st.fx')}</p>` : ''}
        <div class="or"><span>${S.lang === 'ar' ? 'أو' : 'or'}</span></div>
        <button class="opt" data-act="wordsOn"><span class="tile" style="--tc:var(--c6)">${ic('message-square-text')}</span><span class="grow">${t('st.words')}</span>${ic('chevron-right', 'flip mut')}</button>
        <button class="link center" data-act="noIncome">${t('st.none')}</button>`, ft: cta(t('st.cta'), 'fromNumber', { off: !(total > 0), icon: 'sparkles' }) })
    },
    building: () => scr({ body: `<div class="grow"></div>${bud('thinking', 'l')}<div class="ribbon build">${['c4', 'c3', 'c5', 'c6', 'c1', 'c2', 'c0'].map((c, i) => `<i style="--w:${[24, 10, 22, 14, 12, 12, 6][i]}%;--d:${i * 120}ms;background:var(--${c})"></i>`).join('')}</div><div class="grow"></div>`, ft: `<button class="cta txt" data-act="buildAgain">${t('toast.dup')}</button>` }),
    canvas: () => {
      const st = compute(), m = st.m, self = S.mode === 'self'
      const lbl = st.over > 0 ? `<span class="bad">${t('cv.short', { v: money(st.over) })}</span>` : st.basisKind === 'spend' ? t('cv.spend') : st.basisKind === 'floor' ? t('cv.floor') : t('cv.every')
      const hero = self
        ? `<div class="cvhero"><div class="grow"><div class="lbl">${t(st.over > 0 ? 'mn.over' : 'mn.left')}</div><div class="big num" style="color:${st.over > 0 ? 'var(--red)' : ''}">${money(st.over > 0 ? st.over : m.buffer)}</div><div class="sm mut">${t('h.income')} ${fm(st.basis)}</div></div></div>${ribbon(st)}`
        : `<div class="cvhero">${ring(m.own)}<div class="grow"><div class="big num" data-count="${st.basis}">${money(st.basis)}</div><div class="sm">${lbl}</div></div><button class="ib" data-act="sheet" data-arg="own" aria-label="${t('cv.own')}">${ic('info')}</button></div>${ribbon(st)}<div class="xs mut">${t('cv.ownL', { a: m.ownLines, b: m.lines })}</div>`
      const tabs = `<div class="seg wide">${['plan', 'pay', 'year'].map((k) => `<button data-act="tab" data-arg="${k}" aria-pressed="${S.tab === k}">${t('cv.tab.' + k)}</button>`).join('')}</div>`
      const body = `<div class="cvtop">${hero}</div>${S.moved ? `<div class="moved">${ic('arrow-left-right')} ${S.moved}</div>` : ''}${tabs}${S.tab === 'pay' ? payTab(st) : S.tab === 'year' ? yearTab(st) : planTab(st)}`
      return scr({ hd: hd({ backAct: 'toStart', mid: `<b class="grow h3">${t(self ? 'mn.t' : 'cv.title')} <span class="tag">${t('cv.draft')}</span></b>`, right: `<button class="ib" data-act="sheet" data-arg="menu" aria-label="${t('more')}">${ic('ellipsis')}</button>` }), body,
        dock: dock(st), ft: `<div class="row nowrap">${self ? '' : `<button class="btn grow" data-act="sheet" data-arg="adjust">${ic('sparkles')}${t('cv.ask')}</button>`}<button class="btn grow" data-act="sheet" data-arg="whatif">${ic('git-compare-arrows')}${t('cv.whatif')}</button><button class="btn pri grow2" data-act="go" data-arg="activate">${t('cv.activate')}</button></div>` })
    },
    shapes: () => {
      const sh = E.shapes(S.input, S.edits)
      const dur = (n) => (n === 0 ? t('sp.now') : n == null ? t('sp.never') : I.dur(S.lang, n))
      return scr({ hd: hd({ backAct: 'toCanvas' }), body: `${bud('happy', 's')}<h1 class="ttl m">${t('sp.t')}</h1><p class="why">${t('sp.l')}</p>
        ${sh.map((s) => { const m = s.m, g = m.goalsOut[0]; return `<button class="shape" data-act="pickShape" data-arg="${s.id}|${s.aim}|${s.lean}"><div class="row sb nowrap"><b>${t('sp.' + s.id)}</b>${ic('chevron-right', 'flip mut')}</div>${ribbon(s.st, 'thin')}
          <div class="sgrid"><div><small>${t('sp.everyday')}</small><b class="num">${money(m.life)}</b></div><div><small>${t('sp.safetyIn')}</small><b>${dur(m.safetyFull)}</b></div>${m.hasDebt ? `<div><small>${t('sp.debtFree')}</small><b>${dur(m.debtFree)}</b></div>` : ''}${g ? `<div><small>${esc(g.raw ? I.raw(S.lang, g.name) : g.name)}</small><b>${dur(g.months)}</b></div>` : ''}</div></button>` }).join('')}` })
    },
    activate: () => {
      const st = compute(), v = st.v, mine = (x) => !x.src || x.src === 'you' || x.src === 'ai'
      const newD = v.debts.filter(mine), newG = v.goals.filter(mine), linked = v.debts.length - newD.length + v.goals.length - newG.length
      const day = S.startDay || 1
      return scr({ hd: hd({ backAct: 'toCanvas' }), body: `${bud('happy')}<h1 class="ttl m">${t('ac.t')}</h1>
        <label class="fld"><span>${t('ac.name')}</span><input class="txt-in" id="in-planName" data-in="planName" data-kind="text" value="${esc(S.planName || t('ac.default'))}"></label>
        <div class="fld"><span>${t('ac.day')}</span><div class="stp"><button data-act="day" data-arg="-1" aria-label="-">${ic('minus')}</button><b>${day}</b><button data-act="day" data-arg="1" aria-label="+">${ic('plus')}</button></div><small class="mut">${t('ac.dayL')}</small></div>
        ${S.heard.length ? `<div class="card p">${note(t('ac.ai'), 'ai')}<button class="btn s" data-act="heardOk" style="margin-top:8px">${t('cv.heardOk')}</button></div>` : ''}
        <div class="card"><div class="li static"><span class="nm"><b>${t('ac.creates')}</b><small class="mut">${t('ac.nothingYet')}</small></span></div><div class="li static">${ic('check', 'ok')}<span class="nm sm">${t('ac.budget')}</span></div>
          ${newD.map((d) => `<div class="li static">${ic('plus', 'mut')}<span class="nm sm">${t('ac.debt', { n: esc(I.raw(S.lang, d.name)) })}</span><span class="am">${money(d.balance)}</span></div>`).join('')}
          ${newG.map((g) => `<div class="li static">${ic('plus', 'mut')}<span class="nm sm">${t('ac.goal', { n: esc(I.raw(S.lang, g.name)) })}</span><span class="am">${money(g.target)}</span></div>`).join('')}
          ${linked ? `<div class="li static">${ic('link', 'mut')}<span class="nm sm">${t('ac.linked', { n: linked })}</span></div>` : ''}</div>
        ${st.m.guesses + st.m.shaped ? note(t('ac.est', { n: st.m.guesses + st.m.shaped }), '', 'scale') : ''}${st.over > 0 ? note(t('ac.short', { v: fm(st.over) }), 'warn') : ''}${!S.sim.online ? note(t('ac.offline'), 'warn', 'cloud-off') : ''}`,
        ft: cta(t('ac.cta'), 'activate', { icon: 'check', off: S.heard.length > 0 }) + cta(t('ac.later'), 'saveLater', { cls: 'txt' }) })
    },
    live: () => scr({ body: `<div class="grow"></div><div class="confetti">${Array.from({ length: 14 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</div>${bud('done', 'l')}<h1 class="ttl">${t('lv.t')}</h1><p class="lead">${t('lv.l')}</p><div class="grow"></div>`, ft: cta(t('continue'), 'go', { arg: 'sms' }) }),
    sms: () => scr({ body: `<div class="grow"></div>${bud('curious', 'l')}<h1 class="ttl m">${t('sms.t')}</h1><p class="lead">${t('sms.l')}</p><div class="card"><div class="li static">${ic('arrow-left-right', 'mut')}<span class="nm sm">${t('sms.1')}</span></div><div class="li static">${ic('scale', 'mut')}<span class="nm sm">${t('sms.2')}</span></div></div><p class="xs mut">${t('sms.native')}</p><div class="grow"></div>`, ft: cta(t('sms.allow'), 'perm', { arg: 'sms|1' }) + cta(t('notnow'), 'perm', { arg: 'sms|0', cls: 'txt' }) }),
    push: () => scr({ body: `<div class="grow"></div>${bud('awake', 'l')}<h1 class="ttl m">${t('push.t')}</h1><p class="lead">${t('push.l')}</p><div class="grow"></div>`, ft: cta(t('push.allow'), 'perm', { arg: 'push|1' }) + cta(t('notnow'), 'perm', { arg: 'push|0', cls: 'txt' }) }),
    month: () => {
      const A = S.active, spent = {}
      for (const x of S.txns) if (x.counted && x.key) spent[x.key] = (spent[x.key] || 0) + x.amount
      const tot = E.sum(Object.values(spent)), pool = E.sum(A.lines.filter((l) => l.block === 'living' || l.block === 'life').map((l) => l.amount))
      const EV = [['groceries', 'shopping-basket'], ['atm', 'banknote'], ['repay', 'credit-card'], ['topup', 'wallet'], ['bnpl', 'shopping-bag'], ['salary', 'arrow-down-to-line']]
      return scr({ body: `<div class="row sb" style="margin-top:6px"><div><div class="eyebrow">${I.monthName(S.lang, 10)}</div><b class="h2">${esc(A.name)}</b></div><span class="tag you">${ic('circle-check')}</span></div>
        <div class="cvtop"><div class="lbl">${t('m.left')}</div><div class="big num">${money(pool - tot)}</div><div class="pbar"><i style="width:${Math.min(100, (tot / Math.max(1, pool)) * 100)}%"></i></div><small class="mut">${t('m.spent', { v: money(tot), of: money(pool) })}</small></div>
        <div class="card">${A.lines.filter((l) => l.block === 'living' || l.block === 'life').slice(0, 5).map((l) => `<div class="li static"><span class="nm"><b>${lname(l)}</b><div class="pbar s"><i style="width:${Math.min(100, ((spent[l.key] || 0) / Math.max(1, l.amount)) * 100)}%"></i></div></span><span class="am sm">${money(spent[l.key] || 0)} / ${money(l.amount)}</span></div>`).join('')}</div>
        <div class="bh"><b>${t('m.try')}</b></div><p class="xs mut">${t('m.tryL')}</p><div class="chips">${EV.map(([k, i]) => chip(ic(i) + t('ev.' + k), 'txn', k, false, 's')).join('')}</div>
        ${S.txns.length ? `<div class="card">${S.txns.slice(0, 5).map((x) => `<div class="li static"><span class="nm"><b>${t('ev.' + x.kind)}</b><small class="mut">${t('evw.' + x.kind)}</small></span><span class="end"><span class="am">${money(x.amount)}</span><span class="tag ${x.counted ? 'you' : ''}">${t(x.counted ? 'm.counted' : x.kind === 'salary' ? 'm.income' : 'm.notSpend')}</span></span></div>`).join('')}</div>` : ''}
        <div class="bh"><b>${t('m.next')}</b></div><div class="card"><div class="li static">${ic('scale', 'mut')}<span class="nm sm">${t('m.day3')}</span></div><div class="li static">${ic('calendar-check', 'mut')}<span class="nm sm">${t('m.close', { d: A.day })}</span></div></div>`, ft: cta(t('m.edit'), 'editActive', { cls: 'alt', icon: 'pencil' }) })
    },
  }

  /* ------------------------------------------------------------ sheets */
  const sheet = (title, body) => `<div class="sheet-bg" data-act="closeSheet"><div class="sheet" role="dialog" aria-label="${esc(title)}" data-stop="1"><div class="grab"></div><div class="sh-h"><b>${title}</b><button class="ib" data-act="closeSheet" aria-label="${t('close')}">${ic('x')}</button></div><div class="sh-b">${body}</div></div></div>`
  const SH = {
    menu: () => sheet(t('more'), `<div class="card">${['auto', 'together', 'self'].filter((m) => m !== S.mode).map((m) => `<button class="li" data-act="mode" data-arg="${m}">${ic({ auto: 'sparkles', together: 'messages-square', self: 'pencil-ruler' }[m])}<span class="nm"><b>${t('mu.switch', { m: t('md.' + m) })}</b><small class="mut">${t('md.switch')}</small></span></button>`).join('')}
      <button class="li" data-act="sheet" data-arg="known">${ic('database')}<span class="nm"><b>${t('kn.t')}</b></span></button><button class="li" data-act="saveLater">${ic('bookmark')}<span class="nm"><b>${t('mu.save')}</b></span></button><button class="li" data-act="restart">${ic('rotate-ccw')}<span class="nm"><b>${t('mu.restart')}</b></span></button></div>`),
    modes: () => {
      const st = compute(), aim = E.complete(S.input).v.aim
      return sheet(t('md.t'), `<p class="sm mut">${t('md.l', { pct: `<bdi class="num">${st.m.own}%</bdi>` })}</p><div class="fld"><span>${t('md.aim')}</span><div class="chips">${['balanced', 'safety', 'goals', 'debt'].map((k) => chip(t('aim.' + k), 'aim', k, aim === k, 's')).join('')}</div></div>
        <div class="g1">${opt(t('md.auto'), 'mode', 'auto', false, t('md.autoL'), 'sparkles')}${opt(t('md.together'), 'mode', 'together', false, t('md.togetherL'), 'messages-square')}${opt(t('md.self'), 'mode', 'self', false, t('md.selfL'), 'pencil-ruler')}</div><p class="xs mut">${t('md.switch')}</p>`)
    },
    own: () => { const m = compute().m; return sheet(t('cv.own'), `${ring(m.own, 'l')}<p>${t('cv.ownL', { a: m.ownLines, b: m.lines })}</p><div class="card">${[['high', m.ownLines], ['ai', m.aiLines], ['shaped', m.shaped], ['guess', m.guesses]].map(([k, n]) => `<div class="li static"><span class="tag ${k}">${t('conf.' + k)}</span><span class="am">${n}</span></div>`).join('')}</div>`) },
    queue: () => { const Q = E.queue(S.input, S.edits); return sheet(t('sh.allT'), `<p class="sm mut">${t('sh.allL')}</p><div class="card">${Q.map((it) => `<div class="li static"><span class="nm"><b>${it.kind === 'q' ? t(`q.${it.id}.q`) : it.kind === 'stale' ? t('sh.stale') : t('sh.conflict')}</b>${it.core ? `<small class="mut">${t('sh.core')}</small>` : ''}</span><span class="imp">±${money(it.impact)}</span></div>`).join('')}</div>`) },
    line: () => {
      const st = compute(), l = st.lines.find((x) => x.key === S.sheet.key); if (!l) return ''
      const linked = l.src === 'records' && (l.debtId || l.goalId || l.key.startsWith('bill:') || l.key === 'subs'), isBuf = l.key === 'buffer'
      const max = Math.max(l.suggested * 2, l.amount * 1.6, 500)
      const spread = l.conf === 'guess' ? 0.3 : l.conf === 'shaped' ? 0.15 : 0
      return sheet(lname(l), `<div class="row">${srcTag(l)}${l.pinned ? `<span class="tag">${ic('pin')}${t('cv.pinned')}</span>` : ''}</div>
        ${linked || isBuf ? `<div class="big num">${money(l.amount)}</div>${note(t(isBuf ? 'ln.buffer' : 'ln.linked'), '', isBuf ? 'wallet' : 'link')}` : `${amt('line', l.amount)}<input type="range" id="in-lineR" data-in="lineR" data-kind="range" min="0" max="${Math.round(max)}" step="${Math.max(10, E.r10(max / 150))}" value="${l.amount}" aria-label="${lname(l)}">
          <div class="row sb"><span class="sm mut">${t('ln.suggested', { v: fm(l.suggested) })}</span>${l.pinned && !l.custom ? `<button class="chip s" data-act="unpin">${ic('rotate-ccw')}${t('ln.reset')}</button>` : ''}</div><p class="xs mut">${t('ln.pinNote')}</p>`}
        <div class="fld"><span>${t('ln.why')}</span><p class="sm">${why(l)}</p></div>
        ${spread ? note(t('ln.range', { lo: fm(E.r10(l.amount * (1 - spread))), hi: fm(E.r10(l.amount * (1 + spread))) }) + '. ' + t('ln.bench', { place: esc(st.b.label), source: st.b.source, version: st.b.version }), 'warn', 'scale') : ''}
        ${!linked && !isBuf && !l.essential ? `<button class="btn" data-act="removeLine">${ic('trash-2')}${t('remove')}</button>` : ''}`)
    },
    add: () => sheet(t('cv.add'), `<label class="fld"><span>${t('add.name')}</span><input class="txt-in" id="in-addName" data-in="addName" data-kind="text" value="${esc(S.sheet.name || '')}"></label><div class="fld"><span>${t('add.amount')}</span>${amt('addAmt', S.sheet.amount)}</div>
      <div class="fld"><span>${t('add.block')}</span><div class="chips">${BLOCKS.filter((b) => b !== 'free').map((b) => chip(t('b.' + b), 'addBlock', b, S.sheet.block === b, 's')).join('')}</div></div>${cta(t('add'), 'addLine')}`),
    debt: () => { const d = S.sheet.d || (S.sheet.d = { kind: 'card', apr: 'unknown' }); return sheet(t('q.debts.add'), `<div class="fld"><span>${t('q.debt.kind')}</span><div class="chips">${['card', 'loan', 'bnpl', 'family'].map((k) => chip(t('k.' + k), 'debtKind', k, d.kind === k, 's')).join('')}</div></div>
      <div class="fld"><span>${t('q.debt.balance')}</span>${amt('dBal', d.balance)}</div><div class="fld"><span>${t('q.debt.min')}</span>${amt('dMin', d.min)}</div>${d.kind === 'card' || d.kind === 'loan' ? `<div class="fld"><span>${t('q.debt.apr')}</span><div class="chips">${['low', 'mid', 'high', 'unknown'].map((k) => chip(t('apr.' + k), 'debtApr', k, d.apr === k, 's')).join('')}</div></div>` : ''}
      ${(S.sheet.list || []).length ? `<div class="card">${S.sheet.list.map((x) => `<div class="li static"><span class="nm sm">${t('k.' + x.kind)}</span><span class="am">${money(x.balance)} · ${money(x.min)}</span></div>`).join('')}</div>` : ''}
      <div class="g2">${cta(t('add'), 'debtAdd', { cls: 'alt', icon: 'plus' })}${cta(t('done'), 'debtDone')}</div>`) },
    goal: () => { const g = S.sheet.g || (S.sheet.g = { months: 12 }); return sheet(t('q.goals.add'), `<label class="fld"><span>${t('q.goal.name')}</span><input class="txt-in" id="in-gName" data-in="gName" data-kind="text" value="${esc(g.name || '')}"></label><div class="fld"><span>${t('q.goal.target')}</span>${amt('gTarget', g.target)}</div>
      <div class="fld"><span>${t('q.goal.months')}</span><div class="stp"><button data-act="gMonths" data-arg="-1" aria-label="-">${ic('minus')}</button><b>${g.months}</b><button data-act="gMonths" data-arg="1" aria-label="+">${ic('plus')}</button></div></div>${cta(t('done'), 'goalDone')}`) },
    adjust: () => {
      if (!S.sim.ai) return sheet(t('cv.ask'), note(t('adj.aiOff'), 'warn', 'cloud-off'))
      const pr = S.sheet.pr
      return sheet(t('cv.ask'), `<p class="sm mut">${t('adj.l')}</p><textarea class="txt-in s" id="in-adj" data-in="adj" data-kind="text" placeholder="${t('adj.ph')}">${esc(S.sheet.text || '')}</textarea>
        <div class="chips">${['adj.e1', 'adj.e2', 'adj.e3', 'adj.e4'].map((k) => chip(t(k), 'adjEx', k, false, 's')).join('')}</div>
        ${!pr ? cta(t('adj.go'), 'adjGo', { icon: 'sparkles' }) : pr.say === 'unknown' ? note(t('adj.unknown'), 'warn') : !pr.diff.length ? note(t('adj.none'), '') : `${S.declined.includes(S.sheet.text) ? note(t('adj.declined'), '', 'history') : ''}<div class="card"><div class="li static"><span class="nm"><b>${t('adj.prop')}</b><small class="mut">${t('adj.sim')}</small></span></div>${pr.diff.map((d) => `<div class="li static"><span class="nm sm">${d.name}</span><span class="am sm">${money(d.from)} → <b class="${d.to > d.from ? 'up' : 'dn'}">${money(d.to)}</b></span></div>`).join('')}</div><div class="g2">${cta(t('adj.apply'), 'adjApply')}${cta(t('notnow'), 'adjDecline', { cls: 'alt' })}</div>`}`)
    },
    whatif: () => {
      const id = S.sheet.id
      if (!id) return sheet(t('cv.whatif'), `${note(t('wi.safe'), 'ok', 'shield-check')}<div class="g1">${E.SCENARIOS.map((s) => opt(t('wi.' + s), 'whatif', s, false)).join('')}</div>`)
      const r = E.runScenario(S.input, S.edits, id), b = r.base, s = r.sc
      const dlt = (x, y, good) => { const d = y - x; return d === 0 ? '<span class="mut">–</span>' : `<span class="${(d > 0) === good ? 'up' : 'dn'}">${d > 0 ? '+' : ''}${money(d)}</span>` }
      const rows = [['h.income', b.basis, s.basis, true], ['b.home', b.home, s.home, false], ['b.debt', b.debt, s.debt, false], ['b.living', b.living, s.living, true], ['b.life', b.life, s.life, true], ['b.safety', b.safetyAmt, s.safetyAmt, true], ['b.goals', b.goals, s.goals, true]].filter((x) => x[1] || x[2])
      const say = id === 'jobLoss' ? note(t('wi.job', { burn: fm(r.job.burn), run: r.job.runway.toFixed(1) }), r.job.runway >= 3 ? 'ok' : 'warn') : id === 'moveOut' ? note(t('wi.move', { rent: fm(r.rent), res: r.after.over > 0 ? t('wi.moveBad', { v: fm(r.after.over) }) : t('wi.moveOk') }), r.after.over > 0 ? 'bad' : 'ok') : note(s.over > 0 ? t('wi.short', { v: fm(s.over) }) : t('wi.fits', { v: fm(s.saving) }), s.over > 0 ? 'bad' : 'ok')
      return sheet(t('wi.' + id), `${note(t('wi.safe'), 'ok', 'shield-check')}${say}<div class="cmp-rib"><small>${t('wi.now')}</small>${ribbon(r.baseSt, 'thin')}<small>${t('wi.then')}</small>${ribbon(r.st, 'thin')}</div>
        <div class="scroll-x"><table class="cmp"><tr><th></th><th>${t('wi.now')}</th><th>${t('wi.then')}</th><th></th></tr>${rows.map(([k, x, y, g]) => `<tr><td>${t(k)}</td><td class="num">${money(x)}</td><td class="num">${money(y)}</td><td class="num">${dlt(x, y, g)}</td></tr>`).join('')}
        ${s.hasDebt ? `<tr><td>${t('sp.debtFree')}</td><td>${I.dur(S.lang, b.debtFree) || '–'}</td><td>${I.dur(S.lang, s.debtFree) || '–'}</td><td></td></tr>` : ''}${s.goalsOut.map((g) => { const g0 = b.goalsOut.find((x) => x.id === g.id); return `<tr><td>${esc(g.raw ? I.raw(S.lang, g.name) : I.raw(S.lang, g.name))}</td><td>${g0 ? I.dur(S.lang, g0.months) || '–' : '–'}</td><td>${I.dur(S.lang, g.months) || '–'}</td><td></td></tr>` }).join('')}</table></div>
        <div class="g2">${cta(t('wi.keep'), 'wiKeep', { cls: 'alt' })}${cta(t('wi.other'), 'sheet', { arg: 'whatif', cls: 'alt' })}</div>`)
    },
    known: () => {
      const c = E.complete(S.input), at = S.input.$at || {}
      const keys = ['income', 'incomeVar', 'lowMonth', 'adults', 'kids', 'housing', 'housingCost', 'utilIncl', 'school', 'support', 'gameya', 'transport', 'lifestyle', 'eatOut', 'savings', 'debts', 'goals', 'annual', 'zakat', 'aim']
      const val = (k) => { const x = c.v[k]; return Array.isArray(x) ? x.length : typeof x === 'number' ? money(x) : typeof x === 'boolean' ? t(x ? 'yes' : 'no') : I.has(`q.${k}.${x}`) ? t(`q.${k}.${x}`) : I.has('aim.' + x) && k === 'aim' ? t('aim.' + x) : esc(x) }
      return sheet(t('kn.t'), `<p class="sm mut">${t('kn.l')}</p><div class="card">${keys.filter((k) => c.v[k] != null && !(k === 'lowMonth' && c.v.incomeVar !== 'variable')).map((k) => { const s = c.src[k]; return `<div class="li static"><span class="nm"><small class="mut">${k}${at[k] ? ' · ' + at[k] : ''}</small><b>${val(k)}</b></span><span class="tag ${s === 'estimate' ? 'guess' : s === 'ai' ? 'ai' : s === 'you' ? 'you' : 'records'}">${s === 'estimate' ? t('conf.guess') : t('src.' + s)}</span></div>` }).join('')}</div>`)
    },
  }

  /* ------------------------------------------------------------ render */
  function render() {
    const act = document.activeElement, fid = act && el.contains(act) ? act.id : null, pos = fid && act.selectionStart != null ? [act.selectionStart, act.selectionEnd] : null
    const body = el.querySelector('.body'), sb = el.querySelector('.sh-b')
    const keep = body && S._scr === S.screen ? body.scrollTop : 0, keepSh = sb && S._sh === (S.sheet && S.sheet.type) ? sb.scrollTop : 0
    const prevRib = {}; for (const i of el.querySelectorAll('.cvtop .ribbon i')) prevRib[i.dataset.b] = i.style.getPropertyValue('--w')
    const prevRing = el.querySelector('.cvtop .ring .val'), prevOff = prevRing ? prevRing.dataset.off : null
    el.dir = S.lang === 'ar' ? 'rtl' : 'ltr'; el.lang = S.lang
    el.className = 'ph ' + (S.theme || '')
    el.innerHTML = `<div class="sbar"><span>9:41</span><span>${ic(S.sim.online ? 'wifi' : 'wifi-off')}${ic('battery-full')}</span></div>${!S.sim.online ? `<div class="banner">${t('offline')}</div>` : ''}${(V[S.screen] || V.welcome)()}${S.sheet && SH[S.sheet.type] ? SH[S.sheet.type]() : ''}${S.toast ? `<div class="toast" role="status">${S.toast}</div>` : ''}`
    if (window.lucide) window.lucide.createIcons()
    // Snap animation: the ribbon and ring start where they were and move to the new values.
    const ribs = el.querySelectorAll('.cvtop .ribbon i')
    if (ribs.length && Object.keys(prevRib).length) { for (const i of ribs) { const target = i.style.getPropertyValue('--w'); i.style.setProperty('--w', prevRib[i.dataset.b] || '0%'); requestAnimationFrame(() => requestAnimationFrame(() => i.style.setProperty('--w', target))) } }
    const ringV = el.querySelector('.cvtop .ring .val')
    if (ringV && prevOff != null) { const target = ringV.dataset.off; ringV.style.strokeDashoffset = prevOff; requestAnimationFrame(() => requestAnimationFrame(() => (ringV.style.strokeDashoffset = target))) }
    const nb = el.querySelector('.body'); if (nb) nb.scrollTop = keep
    const ns = el.querySelector('.sh-b'); if (ns) ns.scrollTop = keepSh
    S._scr = S.screen; S._sh = S.sheet && S.sheet.type
    if (S.screen === 'canvas') { const st = compute(); S.prev.lines = Object.fromEntries(st.lines.map((l) => [l.key, l.amount])) }
    if (fid) { const n = document.getElementById(fid); if (n) { n.focus({ preventScroll: true }); if (pos && n.setSelectionRange && n.type !== 'range') try { n.setSelectionRange(pos[0], pos[1]) } catch (e) { /* not a text input */ } } }
    if (S.toast) { const msg = S.toast; later(() => { if (S.toast === msg) { S.toast = null; render() } }, 2400) }
    if (window.Lab) window.Lab.sync()
  }
  let deb = null
  const soon = () => { clearTimeout(deb); deb = setTimeout(render, 450) }
  const toast = (m) => { S.toast = m }
  const movedText = (st) => (st.moved && st.moved.length ? t('cv.moved', { v: money(E.sum(st.moved.map((x) => x.by))), from: st.moved.slice(0, 3).map((x) => lname(x)).join(S.lang === 'ar' ? '، ' : ', ') }) : null)

  /* ------------------------------------------------------------ actions */
  function toCanvas(firstTime) {
    if (S.building) { log('Second build request ignored while one is running. One request, one draft.', 'warn'); toast(t('toast.dup')); return render() }
    S.building = true; S.screen = 'building'; render()
    later(() => { S.building = false; S.screen = 'canvas'; S.tab = 'plan'; if (firstTime && !S.mode) S.sheet = { type: 'modes' }; persist(); log(`Budget built on the phone by the engine. Built from own numbers: ${compute().m.own}%.`, 'ok'); render() }, 1300)
  }
  function answerTop(value) {
    const it = E.queue(S.input, S.edits)[0]; if (!it) return
    const before = compute()
    if (it.kind === 'q') setFact(it.q.fact, value)
    else setFact(it.fact, value)
    const after = compute()
    const changed = after.lines.filter((l) => (before.lines.find((x) => x.key === l.key) || {}).amount !== l.amount).length
    S.moved = null
    toast(`${ic('check')} ${changed} ${S.lang === 'ar' ? 'بنود تغيرت' : 'lines updated'} · ${after.m.own}% ${t('cv.own')}`)
    S.dock = null
    render()
  }
  const A = {
    back: () => render(),
    go: (to) => { S.sheet = null; S.screen = to; render() },
    signin: () => { S.screen = 'gate'; log(`Signed in (simulated). Local store is ${S.sim.newDevice || S.P.level === 'none' ? 'empty' : 'populated'}; nothing is decided until the account answers.`); render(); gate() },
    retryGate: () => { if (!S.sim.online) { toast(t('g.off.t')); return render() } gate() },
    setLang: (l) => { S.lang = l; render() },
    setCountry: (c) => { S.input.country = c; S.input.cur = Dt.COUNTRIES[c].cur; S.srcRows = S.srcRows.map((r) => ({ ...r, cur: S.input.cur })); render() },
    setCur: (c) => { S.input.cur = c; S.srcRows = S.srcRows.map((r, i) => (i === 0 ? { ...r, cur: c } : r)); render() },
    setupDone: () => { S.input.$src = { ...S.input.$src, country: 'you', cur: 'you' }; log(`Account set up in one screen: ${S.input.country}, ${S.input.cur}, ${S.name || 'no name'}. Nothing financial asked.`, 'ok'); S.screen = 'start'; render() },
    toSetup: () => { S.screen = 'setup'; render() }, toHome: () => { S.screen = 'home0'; render() },
    toStart: () => { S.sheet = null; S.screen = S.P.level === 'none' ? 'start' : 'home0'; render() },
    toCanvas: () => { S.screen = 'canvas'; render() },
    srcAdd: () => { S.srcRows.push({ amount: undefined, cur: 'USD' }); render() },
    srcDel: (i) => { S.srcRows.splice(Number(i), 1); render() },
    srcCur: (arg) => { const [i, c] = arg.split('|'); S.srcRows[Number(i)].cur = c; render() },
    wordsOn: () => { S.words = true; render() }, wordsOff: () => { S.words = false; render() },
    sample: () => { S.text = S.P.story[S.lang === 'ar' ? 1 : 0]; render() },
    voice: () => { const full = S.P.story[S.lang === 'ar' ? 1 : 0]; S.text = ''; toast(t('toast.voice')); render(); let i = 0; const step = () => { i += 7; S.text = full.slice(0, i); const n = document.getElementById('in-text'); if (n) n.value = S.text; if (i < full.length) later(step, 26) }; later(step, 500) },
    fromNumber: () => {
      const rows = S.srcRows.filter((r) => r.amount > 0)
      S.input = { ...S.input, sources: rows.map((r, i) => ({ name: i ? `Source ${i + 1}` : 'Income', amount: r.amount, cur: r.cur === S.input.cur ? undefined : r.cur })), $src: { ...S.input.$src, sources: 'you' } }
      delete S.input.income
      log(`Income from ${rows.length} source(s): ${money(E.complete(S.input).v.income)}.`)
      toCanvas(true)
    },
    noIncome: () => { S.input = { ...S.input, income: 0, $src: { ...S.input.$src, income: 'you' } }; log('No regular income declared. The plan will cover expected spending instead of failing.', 'warn'); toCanvas(true) },
    readWords: () => {
      if (!S.text.trim()) { toast(t('toast.empty')); return render() }
      const r = Dt.read(S.text, cur())
      let x = { ...S.input, $src: { ...S.input.$src } }
      for (const [k, v] of Object.entries(r.facts)) { x[k] = v; x.$src[k] = 'ai' }
      if (r.aim) { x.aim = r.aim; x.$src.aim = 'ai' }
      S.input = x; S.heard = Object.keys(r.facts); S.flags = r.flags
      log(`Simulated AI read ${S.heard.length} facts from ${S.text.length} characters. They are marked "Buddgy heard" until confirmed and block activation until then.`)
      if (!(x.income > 0) && !x.sources) { S.words = false; toast(t('toast.empty')); return render() }
      toCanvas(true)
    },
    heardOk: () => { const x = { ...S.input, $src: { ...S.input.$src } }; for (const k of Object.keys(x.$src)) if (x.$src[k] === 'ai') x.$src[k] = 'you'; S.input = x; log(`Confirmed ${S.heard.length} facts Buddgy heard. They now count as your own numbers.`, 'ok'); S.heard = []; S.flags = []; persist(); render() },
    unhear: (k) => {
      const x = { ...S.input, $src: { ...S.input.$src } }
      const ks = k === 'household' ? ['adults', 'kids'] : [k]
      for (const f of ks) { delete x[f]; delete x.$src[f] }
      S.input = x; S.heard = S.heard.filter((h) => !ks.includes(h)); S.flags = S.flags.filter((h) => h !== k)
      log(`Removed "${k}" that Buddgy heard. It goes back to a labelled estimate and will be asked if it matters.`); render()
    },
    buildKnown: () => { S.input = Dt.known(S.P); log(`Built from what the account already holds (${Object.keys(S.input).filter((k) => !k.startsWith('$')).length} facts). Nothing re-asked.`, 'ok'); toCanvas(true) },
    resume: () => { log('Resumed the draft at the exact point it stopped.', 'ok'); S.screen = 'canvas'; render() },
    freshDraft: () => { clearSaved(); S.hasDraft = false; S.screen = S.P.level === 'none' ? 'start' : 'home0'; render() },
    buildAgain: () => toCanvas(false),
    aim: (k) => { setFact('aim', k); render() },
    mode: (m) => {
      const was = S.mode
      if (m === 'self' && was !== 'self') {
        const st = compute()
        S.edits = { pins: {}, removed: [], custom: st.lines.filter((l) => l.key !== 'buffer').map((l) => ({ key: l.key, name: l.name, raw: l.raw, block: l.block, amount: l.amount, essential: l.essential })) }
        log(was ? `Switched to manual. ${S.edits.custom.length} lines came with you; nothing lost.` : 'Manual mode: your lines, no AI.', 'ok')
      } else if (was === 'self' && m !== 'self') {
        S.edits = { pins: Object.fromEntries(S.edits.custom.map((c) => [c.key, c.amount])), removed: [], custom: S.edits.custom.filter((c) => !E.build(S.input).lines.some((l) => l.key === c.key)) }
        log(`Left manual mode. Your ${Object.keys(S.edits.pins).length} amounts stay set; Buddgy fills in around them.`, 'ok')
      } else if (was) log(`Switched to ${m}. Every answer is kept.`, 'ok')
      S.mode = m; S.sheet = null; persist()
      if (m === 'auto') { S.screen = 'shapes'; log('Buddgy calculated three shapes on the same facts. You pick one.') } else S.screen = 'canvas'
      render()
    },
    pickShape: (arg) => { const [id, aim, lean] = arg.split('|'); S.input = E.withFact(E.withFact(S.input, 'aim', aim), 'lean', Number(lean)); log(`Shape "${id}" picked: aim ${aim}, lean ${lean}.`, 'ok'); persist(); S.screen = 'canvas'; render() },
    tab: (k) => { S.tab = k; render() },
    pickQ: (raw) => answerTop(raw === 'true' ? true : raw === 'false' ? false : raw === '[]' ? [] : raw),
    saveQ: () => {
      const it = E.queue(S.input, S.edits)[0], d = S.dock
      if (it.kind === 'q' && it.q.control === 'household') return answerTop({ adults: d.adults, kids: d.kids })
      if (d.v == null) return
      // A cheque paid four times a year covers three months; a yearly payment covers twelve.
      const div = { month: 1, quarter: 3, year: 12 }[d.per || 'month']
      answerTop(it.kind === 'q' && it.q.control === 'amountPeriod' ? Math.round(d.v / div) : d.v)
    },
    period: (p) => { S.dock.per = p; render() },
    hh: (arg) => { const [k, d] = arg.split('|'); S.dock[k] = Math.max(k === 'adults' ? 1 : 0, Math.min(k === 'adults' ? 4 : 8, S.dock[k] + Number(d))); render() },
    skipQ: (id) => { skipQ(id); S.dock = null; render() },
    staleSame: () => { const it = E.queue(S.input, S.edits)[0]; answerTop(it.value) },
    conflict: (v) => answerTop(Number(v)),
    sheet: (arg) => { const [type, extra] = String(arg).split('|'); S.sheet = { type, block: extra || 'home' }; render() },
    closeSheet: () => { S.sheet = null; render() },
    line: (key) => { S.sheet = { type: 'line', key }; render() },
    unpin: () => { delete S.edits.pins[S.sheet.key]; S.moved = null; render() },
    removeLine: () => { const k = S.sheet.key; if (S.edits.custom.some((c) => c.key === k)) S.edits.custom = S.edits.custom.filter((c) => c.key !== k); else S.edits.removed.push(k); delete S.edits.pins[k]; S.sheet = null; render() },
    addBlock: (b) => { S.sheet.block = b; render() },
    addLine: () => { const n = (S.sheet.name || '').trim(), a = S.sheet.amount; if (!n || !(a > 0)) { toast(t('add.need')); return render() } S.edits.custom.push({ key: 'own:' + n.toLowerCase(), name: n, raw: true, amount: a, block: S.sheet.block }); S.sheet = null; const st = compute(); S.moved = movedText(st); render() },
    selfAdd: (arg) => { const [b, k] = arg.split('|'); const hint = E.settle(E.build(S.input)).lines.find((l) => l.key === k); S.edits.custom.push({ key: k, name: k, block: b, amount: 0, essential: b === 'home' || b === 'living' }); render(); S.sheet = { type: 'line', key: k }; if (hint) log(`Added ${k}. Typical amount shown as a hint only: ${money(hint.amount)}.`); render() },
    debtKind: (k) => { S.sheet.d.kind = k; render() },
    debtApr: (k) => { S.sheet.d.apr = k; render() },
    debtAdd: () => { const d = S.sheet.d; if (!(d.balance > 0) || !(d.min >= 0)) return; S.sheet.list = [...(S.sheet.list || []), { ...d }]; S.sheet.d = { kind: 'card', apr: 'unknown' }; render() },
    debtDone: () => { const d = S.sheet.d, list = [...(S.sheet.list || [])]; if (d && d.balance > 0) list.push(d); const APR = { low: 8, mid: 20, high: 30, unknown: null }; S.sheet = null; answerTop(list.map((x, i) => ({ id: 'd' + i, name: { card: 'Card', loan: 'Loan', bnpl: 'Instalments', family: 'Family' }[x.kind], kind: x.kind, balance: x.balance, min: x.min || 0, apr: APR[x.apr] }))) },
    gMonths: (d) => { S.sheet.g.months = Math.max(1, Math.min(120, S.sheet.g.months + Number(d))); render() },
    goalDone: () => { const g = S.sheet.g; if (!(g.target > 0)) return; S.sheet = null; answerTop([{ id: 'g1', name: (g.name || 'Goal').trim(), raw: true, target: g.target, saved: 0, months: g.months }]) },
    adjEx: (k) => { S.sheet.text = t(k); S.sheet.pr = null; render() },
    adjGo: () => {
      const st = compute(), r = Dt.readAdjust(S.sheet.text || '', st)
      let inp = S.input, ed = S.edits
      if (r.kind === 'facts') for (const [k, v] of Object.entries(r.facts)) inp = E.withFact(inp, k, v)
      if (r.kind === 'pins') ed = { ...ed, pins: { ...ed.pins, ...r.pins } }
      const nx = compute(inp, ed)
      const diff = nx.lines.map((l) => ({ name: lname(l), from: (st.lines.find((x) => x.key === l.key) || {}).amount || 0, to: l.amount })).filter((d) => d.from !== d.to)
      S.sheet.pr = { ...r, inp, ed, diff }
      log(`Simulated AI read "${S.sheet.text}" as ${r.kind}; the engine priced it: ${diff.length} lines would change. Nothing applied yet.`); render()
    },
    adjApply: () => { const pr = S.sheet.pr; S.input = pr.inp; S.edits = pr.ed; S.sheet = null; S.moved = movedText(compute()); toast(t('toast.applied')); log('Proposal applied.', 'ok'); persist(); render() },
    adjDecline: () => { S.declined.push(S.sheet.text); log(`Declined and remembered: "${S.sheet.text}".`); S.sheet = null; render() },
    whatif: (id) => { S.sheet = { type: 'whatif', id }; log(`What-if "${id}" calculated on a copy of the facts. Budget untouched.`); render() },
    wiKeep: () => { S.drafts.push(S.sheet.id); toast(t('toast.kept')); log(`Scenario "${S.sheet.id}" kept as a separate draft. It writes no debts or goals.`, 'ok'); S.sheet = null; render() },
    saveLater: () => { persist(); S.sheet = null; S.screen = 'home0'; log('Draft saved. No debts, goals or settings outside the draft were written.', 'ok'); render() },
    restart: () => { clearSaved(); start(S.pid, S.tw) },
    day: (d) => { S.startDay = Math.max(1, Math.min(31, (S.startDay || 1) + Number(d))); render() },
    activate: () => {
      const st = compute(), mine = (x) => !x.src || x.src === 'you'
      S.active = { name: S.planName || t('ac.default'), lines: st.lines, day: S.startDay || 1 }
      log(`Activated${S.sim.online ? '' : ' on this phone, queued for sync'}. Created now, once: ${st.v.debts.filter(mine).length} debts, ${st.v.goals.filter(mine).length} goals. Idempotency key act-${Math.random().toString(36).slice(2, 7)}.`, 'ok')
      clearSaved(); S.hasDraft = false; S.screen = 'live'; render()
    },
    perm: (arg) => { const [k, v] = arg.split('|'); S.perms[k] = v === '1'; log(`${k === 'sms' ? 'SMS tracking' : 'Notifications'} ${v === '1' ? 'allowed' : 'declined; asked again no sooner than 30 days, never as a cold system dialog'}.`); S.screen = k === 'sms' ? 'push' : 'month'; render() },
    txn: (kind) => {
      const A0 = S.active, find = (k) => (A0.lines.find((l) => l.key === k) || A0.lines.find((l) => l.block === 'living') || {}).key
      const base = Math.max(50, E.r10(E.sum(A0.lines.map((l) => l.amount)) / 60))
      const map = { groceries: { amount: base * 2, counted: true, key: find('groceries') }, atm: { amount: base * 8, counted: false }, repay: { amount: base * 10, counted: false }, topup: { amount: base * 3, counted: false }, bnpl: { amount: base * 5, counted: true, key: find('shopping') }, salary: { amount: E.sum(A0.lines.map((l) => l.amount)), counted: false } }
      S.txns.unshift({ kind, ...map[kind] }); log(`${kind}: ${map[kind].counted ? 'counted as spending' : 'recognised, not counted as spending'}.`); render()
    },
    editActive: () => { S.screen = 'canvas'; render() },
  }
  const IN = {
    name: (v) => { S.name = v.trim().slice(0, 30); return false },
    text: (v) => { S.text = v; return false },
    planName: (v) => { S.planName = v; return false },
    addName: (v) => { S.sheet.name = v; return false }, addAmt: (v) => { S.sheet.amount = pn(v); return false },
    gName: (v) => { S.sheet.g.name = v; return false }, gTarget: (v) => { S.sheet.g.target = pn(v); return false },
    dBal: (v) => { S.sheet.d.balance = pn(v); return false }, dMin: (v) => { S.sheet.d.min = pn(v); return false },
    adj: (v) => { S.sheet.text = v; S.sheet.pr = null; return false },
    dock: (v) => { S.dock.v = pn(v); return false }, stale: (v) => { S.dock.v = pn(v); return false },
    line: (v) => { const a = pn(v); if (a == null) return false; if (S.edits.custom.some((c) => c.key === S.sheet.key)) S.edits.custom.find((c) => c.key === S.sheet.key).amount = a; else S.edits.pins[S.sheet.key] = a; S.moved = movedText(compute()) },
    lineR: (v) => { const a = Number(v); if (S.edits.custom.some((c) => c.key === S.sheet.key)) S.edits.custom.find((c) => c.key === S.sheet.key).amount = a; else S.edits.pins[S.sheet.key] = a; S.moved = movedText(compute()); return 'now' },
    refi: (v) => { S.levers = { ...(S.levers || { extra: 0 }), refi: Number(v) }; return 'now' },
    extra: (v) => { S.levers = { ...(S.levers || { refi: 0 }), extra: Number(v) }; return 'now' },
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
    const n = e.target.closest('[data-in]'); if (!n) return
    const name = n.dataset.in
    if (/^src\d+$/.test(name)) { S.srcRows[Number(name.slice(3))].amount = pn(n.value); return soon() }
    const r = IN[name] ? IN[name](n.value) : undefined
    if (r === false) return
    if (r === 'now') render(); else soon()
  })
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('.amt input')) { clearTimeout(deb); const btn = e.target.closest('.row, .fld, .sh-b, .body') && (el.querySelector('.dock [data-act=saveQ]') || el.querySelector('.ft .cta:not(.alt):not(.txt)')); render(); if (btn) { const again = el.querySelector(`[data-act="${btn.dataset.act}"]`); if (again && !again.disabled) again.click() } } })

  function gate() {
    if (!S.sim.online) { log('Account unreachable. With nothing local and no server answer, Buddget waits instead of starting a cold-start flow.', 'warn'); return render() }
    later(() => {
      if (S.P.level === 'none') { log('Account answered: it holds nothing. Only now is this a new user.', 'ok'); S.screen = 'setup' }
      else { log(`Account answered: it holds data. ${S.sim.newDevice ? 'The phone was empty (new device), and setup is still skipped.' : 'Setup skipped.'}`, 'ok'); S.screen = 'home0' }
      render()
    }, S.sim.slow ? 3500 : 1000)
  }

  /* ------------------------------------------------------------ helpers for the lab */
  function autoStep() {
    const P = S.P
    switch (S.screen) {
      case 'welcome': return A.signin()
      case 'setup': S.name = P.name.split(' ')[0]; return A.setupDone()
      case 'home0': return savedDraft() ? A.resume() : A.buildKnown()
      case 'start': S.srcRows = P.t.sources.map((s) => ({ amount: s.amount, cur: s.cur || P.cur })); return A.fromNumber()
      case 'shapes': { const s = E.shapes(S.input, S.edits)[0]; return A.pickShape(`${s.id}|${s.aim}|${s.lean}`) }
      case 'canvas': {
        if (S.sheet && S.sheet.type === 'modes') return A.mode('together')
        if (S.heard.length) return A.heardOk()
        const it = E.queue(S.input, S.edits)[0]
        if (!it || S.mode === 'self') return A.go('activate')
        if (it.kind === 'stale' || it.kind === 'conflict') return answerTop(P.t[it.fact])
        return answerTop(Dt.truthFor(P, it.q))
      }
      case 'activate': return A.activate()
      case 'live': return A.go('sms')
      case 'sms': return A.perm('sms|1')
      case 'push': return A.perm('push|1')
    }
  }
  function goto(target) {
    const { pid, tw } = S
    start(pid, tw, true)
    const P = S.P
    if (target === 'welcome') return
    if (target === 'gate') return A.signin()
    if (target === 'setup') { S.screen = 'setup'; return render() }
    S.name = P.name.split(' ')[0]
    if (target === 'home0') { S.screen = P.level === 'none' ? 'start' : 'home0'; return render() }
    if (target === 'start' || target === 'words') { S.screen = 'start'; S.words = target === 'words'; return render() }
    const base = P.level === 'none' ? { ...S.input, sources: Dt.clone(P.t.sources), $src: { country: 'you', cur: 'you', sources: 'you' } } : Dt.known(P)
    S.input = base
    if (target === 'heard') { S.text = P.story[S.lang === 'ar' ? 1 : 0]; S.input = { country: P.country, cur: P.cur, $src: { country: 'you', cur: 'you' } }; A.readWords(); return }
    if (target === 'modes') { S.screen = 'canvas'; S.sheet = { type: 'modes' }; return render() }
    if (target === 'shapes') { S.mode = 'auto'; S.screen = 'shapes'; return render() }
    if (target === 'self') { S.mode = null; S.screen = 'canvas'; return A.mode('self') }
    S.mode = 'together'; S.screen = 'canvas'
    if (target === 'sharpen') return render()
    const w = Dt.walk(P); S.input = w.input
    if (['line', 'adjust', 'whatif', 'known'].includes(target)) S.sheet = target === 'line' ? { type: 'line', key: (compute().lines.find((l) => l.block === 'living') || compute().lines[0]).key } : { type: target }
    if (target === 'pay' || target === 'year') S.tab = target
    if (target === 'activate') S.screen = 'activate'
    if (target === 'live' || target === 'month') { A.activate(); S.screen = target === 'live' ? 'sms' : 'month' }
    render()
  }
  const EDGE = {
    noIncome: () => { start('nour', {}, false); S.name = 'Nour'; A.noIncome() },
    missing: () => { start('nour', {}, false); S.name = 'Nour'; S.srcRows = [{ amount: 18000, cur: 'EGP' }]; log('Edge case: only income is known. Everything else is a labelled estimate.', 'warn'); A.fromNumber() },
    conflict: () => { start('salma', { conflict: 12500 }, false); S.name = 'Salma'; S.mode = 'together'; A.buildKnown(); log('Edge case: profile rent 16,000 vs 12,500 in six months of payments. Buddgy asks which; it never picks silently.', 'warn') },
    expired: () => { start('karim', {}, false); S.name = 'Karim'; S.mode = 'together'; A.buildKnown(); log('Edge case: rent was last confirmed 14 months ago. It comes back as a one-tap check.', 'warn') },
    aiDown: () => { S.sim.ai = false; start('nour', {}, false); S.name = 'Nour'; S.screen = 'start'; S.words = true; log('Edge case: AI unavailable. Words cannot be read; one number still builds the budget.', 'warn'); render() },
    offline: () => { start('omar', {}, false); S.sim.online = false; S.name = 'Omar'; S.srcRows = [{ amount: 45000, cur: 'EGP' }]; S.mode = 'together'; log('Edge case: offline. The engine runs on the phone; answers save locally.', 'warn'); A.fromNumber() },
    slow: () => { S.sim.slow = true; S.sim.online = true; start('salma', {}, false); A.signin() },
    newDevice: () => { S.sim.newDevice = true; S.sim.online = true; S.sim.slow = false; start('faisal', {}, false); A.signin() },
    abandon: () => { start('omar', {}, false); S.name = 'Omar'; S.input = { ...S.input, sources: Dt.clone(S.P.t.sources), $src: { country: 'you', cur: 'you', sources: 'you' } }; S.mode = 'together'; S.screen = 'canvas'; for (let i = 0; i < 3; i++) autoStep(); A.saveLater() },
    dupBuild: () => { start('nour', {}, false); S.name = 'Nour'; S.srcRows = [{ amount: 18000, cur: 'EGP' }]; A.fromNumber(); later(() => A.buildAgain(), 400) },
    badGoal: () => { start('nour', { goalTarget: 2000000, goalMonths: 6 }, false); S.name = 'Nour'; S.input = Dt.walk(S.P).input; S.mode = 'together'; S.screen = 'canvas'; log('Edge case: a goal of 2,000,000 in 6 months on 18,000 a month. The budget funds what fits and says how long it would really take.', 'warn'); render() },
    multiCur: () => { start('faisal', { level: 'none' }, false); S.name = 'Faisal'; S.screen = 'start'; S.srcRows = S.P.t.sources.map((s) => ({ amount: s.amount, cur: s.cur || 'AED' })); log('Edge case: three incomes, one in USD. Converted into the budget currency and shown.', 'warn'); render() },
  }

  window.App = { start, goto, autoStep, compute, restore, savedDraft, clearSaved, render, edge: (id) => { timers.forEach(clearTimeout); EDGE[id]() }, state: () => S, setTheme: (th) => { S.theme = th; render() }, setLang: (l) => { S.lang = l; render() }, money: (n) => money(n) }
  start('nour')
})()
