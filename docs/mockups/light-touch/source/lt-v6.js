/* ================= round 6: overrides on top of lt-v5 ================= */

/* ---------- From: a tab bar (Account · Pocket · Outside); each tab opens its own picker ---------- */
const SRC_TABS = [['acct', 'Account', 'wallet'], ['pocket', 'Pocket', 'piggy-bank'], ['outside', 'Outside', 'arrow-left-right']]
const srcTabs = (on, attr = 'data-pre') => `<div class="mx-4 mb-2"><p class="mb-1.5 ms-1 text-[0.75rem] font-semibold ${SECOND}">Where the money comes from</p><div role="tablist" class="inline-flex w-full gap-0.5 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-[3px]">${SRC_TABS.map(([k, l, ic]) => `<button type="button" role="tab" aria-selected="${k === on}" ${attr}="${k}" class="${k === on ? SEG_ON : SEG_OFF} gap-1.5">${ICON(ic, 'size-4')}${l}</button>`).join('')}</div></div>`
const OUTSIDE_V = `<span class="text-[0.875rem] ${SECOND}">Money you already had</span>`
/* one row that changes with the tab: the payment-method sheet, the pocket picker, or nothing to pick */
function srcRowFor(r, mode, S, onPick) {
  Object.assign(r, { pm: undefined, fn: undefined, static: false })
  if (mode === 'acct') { r.k = 'From'; r.pm = r.lastPm || 'cib' }
  if (mode === 'pocket') { r.k = 'From pocket'; r.v = pocketV(r.lastPk || 'trip'); r.fn = (S2, rr, redraw) => ltPocketPicker(S, rr.lastPk || 'trip', (k) => { rr.lastPk = k; rr.v = pocketV(k); onPick?.(); redraw() }) }
  if (mode === 'outside') { r.k = 'From'; r.v = OUTSIDE_V; r.static = true }
}
const srcLine6 = (mode, r, held) => (mode === 'outside' ? 'Money you already had · your budget is untouched' : mode === 'pocket' ? `Moves from ${POCKET[r.lastPk || 'trip'][1]} · stays inside your savings` : (r.pm || 'cib') === held ? 'Set aside where it’s kept · nothing moves, net worth stays the same' : `From ${PM[r.pm || 'cib'].name} · counts toward this month’s savings`)
function moneyIn(S, c, held) {
  c.mode = 'acct'
  const fromRow = { k: 'From', pm: held, lastPm: held }
  c.rows.push(fromRow)
  c.pre = () => srcTabs(c.mode)
  c.onPre = (k, rows) => { c.mode = k; const r = rows[rows.length - 1]; if (r.pm) r.lastPm = r.pm; srcRowFor(r, k, S); c.liveRow = r }
  c.liveRow = fromRow
  ltTx(S, c)
}
AFTER.deposit = (S) => {
  const c = { title: 'Into CIB savings certificate', iconHTML: pocketMark(POCKET.cert, 52), sign: '+', amt: '5,000', cur: 'EGP', day: 28, time: '12:00', cta: 'Add money', done: 'Money added' }
  c.line = (v) => `96,940 → ${f0(96940 + v)} · ${srcLine6(c.mode, c.liveRow, 'cib')}`
  c.rows = [{ k: 'Into', v: pocketV('cert'), fn: (S2, r, redraw) => ltPocketPicker(S, r.pk || 'cert', (k) => { r.pk = k; r.v = pocketV(k); c.title = `Into ${POCKET[k][1]}`; c.iconHTML = pocketMark(POCKET[k], 52); redraw() }) }]
  moneyIn(S, c, 'cib')
}
AFTER.goal = (S) => {
  const c = { title: 'Umrah 2027', iconHTML: pocketMark(POCKET.umrah, 52), sign: '+', amt: '2,000', cur: 'EGP', day: 28, time: '12:00', note: false, cta: 'Add to goal', done: 'Added to Umrah 2027' }
  c.line = (v) => `${f0(Math.max(0, 48000 - 18000 - v))} left to reach 48,000 · ${srcLine6(c.mode, c.liveRow, 'none')}`
  c.rows = [{ k: 'Goal', v: pocketV('umrah'), fn: (S2, r, redraw) => ltPocketPicker(S, r.pk || 'umrah', (k) => { r.pk = k; r.v = pocketV(k); c.title = POCKET[k][1]; c.iconHTML = pocketMark(POCKET[k], 52); redraw() }, ['Goals']) }]
  moneyIn(S, c, 'nbe')
}

/* ---------- Goals: today's All · Active · Paused bar with the trophy chip; the trophy room, refined ---------- */
const ACHIEVED = [['Wedding gift', 15000, 'Sep 2026', 'heart-pulse', ['var(--cat-shopping-bg)', 'var(--cat-shopping-fg)'], 8, 11], ['Emergency fund, first month', 12000, 'Jun 2026', 'shield-check', IC.teal, 5, 7], ['New phone', 18500, 'Feb 2026', 'smartphone', IC.green, 6, 9]]
const trophyChip = (on) => `<button type="button" data-trophy aria-pressed="${on}" aria-label="Achieved goals, 3" class="${OPT_BASE} ${on ? OPT_ON : OPT_OFF} shrink-0 !h-[42px]">${ICON('trophy', 'size-[18px]')}<span class="font-mono-numbers">3</span></button>`
const goalsBar = (view) => `<div class="mx-4 mt-4 flex items-center gap-2"><div class="inline-flex min-w-0 flex-1 gap-0.5 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-[3px]">${['All', 'Active', 'Paused'].map((l, i) => `<button type="button" data-toast="Shows ${l.toLowerCase()} goals" class="${i || view === 'achieved' ? SEG_OFF : SEG_ON}">${l}</button>`).join('')}</div>${trophyChip(view === 'achieved')}</div>`
const achievedView = () => {
  const total = ACHIEVED.reduce((s, g) => s + g[1], 0)
  const hero = `<section class="relative mx-4 mt-4 overflow-hidden rounded-3xl px-5 pb-5 pt-4 text-[var(--flow-band-fg)]" style="background:linear-gradient(120deg, var(--flow-band-a) 0%, var(--flow-band-b) 100%)"><span aria-hidden="true" class="pointer-events-none absolute -end-10 -top-12 size-44 rounded-full" style="background:radial-gradient(circle, rgba(255,255,255,.16), transparent 65%)"></span><div class="relative flex items-center gap-4"><span aria-hidden="true" class="flex size-14 shrink-0 items-center justify-center rounded-full bg-[var(--flow-band-fg)] text-[var(--flow-band-b)] shadow-[0_8px_24px_-8px_rgba(0,0,0,.45)]">${ICON('trophy', 'size-7')}</span><div><p class="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[var(--flow-band-fg-2)]">Goals achieved</p><p class="font-mono-numbers text-[2rem] font-semibold leading-tight tracking-[-0.03em]">3</p></div><div class="ms-auto text-end"><p class="font-mono-numbers text-[1.0625rem] font-semibold">${f0(total)}</p><p class="text-[0.71875rem] text-[var(--flow-band-fg-2)]">EGP saved for them</p></div></div><div class="relative mt-4 grid grid-cols-3 gap-2">${[['19', 'deposits'], ['7 mo', 'fastest goal'], ['4 mo', 'best streak']].map(([v, l]) => `<div class="rounded-2xl px-3 py-2.5 text-center" style="background:var(--flow-band-mix)"><p class="font-mono-numbers text-[0.9375rem] font-semibold">${v}</p><p class="text-[0.6875rem] text-[var(--flow-band-fg-2)]">${l}</p></div>`).join('')}</div></section>`
  const row = ([t, a, d, ic, tone, mo, dep], i) => `<div class="relative flex items-center gap-3 px-4 py-3.5"><span class="relative">${`<span aria-hidden="true" class="flex size-11 items-center justify-center rounded-[13px]" style="background:${tone[0]};color:${tone[1]}">${ICON(ic, 'size-5')}</span>`}<span aria-hidden="true" class="absolute -bottom-1 -end-1 flex size-5 items-center justify-center rounded-full border-2 border-[var(--color-brand-card)] bg-[var(--color-brand-green)] text-white">${ICON('check', 'size-3')}</span></span><span class="min-w-0 flex-1"><span class="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${t}</span><span class="block text-xs ${MUTED}">Reached ${d} · ${mo} months · ${dep} deposits</span></span><span class="font-mono-numbers text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${f0(a)}</span></div>`
  const nudge = `<button type="button" data-open4="s_goal" class="mx-4 mt-3 flex w-[calc(100%-2rem)] items-center gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4 text-start">${pocketMark(POCKET.umrah, 44)}<span class="min-w-0 flex-1"><span class="block text-xs font-semibold text-[var(--color-brand-primary-ink)]">Next to finish</span><span class="block text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">Umrah 2027 · 38% there</span><span class="mt-1.5 block h-1.5 rounded-full bg-[var(--color-brand-sunken)]"><span class="block h-full w-[38%] rounded-full bg-[var(--color-brand-primary)]"></span></span></span>${CHEV}</button>`
  return goalsBar('achieved') + hero + `<div class="mx-5 mb-2 mt-6 text-[0.6875rem] font-bold uppercase tracking-[0.08em] ${MUTED}">Finished, newest first</div><div class="mx-4 divide-y divide-[var(--color-brand-border)] overflow-hidden ${CARDBOX}">${ACHIEVED.map(row).join('')}</div>` + nudge + '<div class="h-6"></div>'
}
{
  const v5 = PAGES.goals
  PAGES.goals = (st, L) => {
    const h = v5(st, L)
    if (!L) return h
    if (st.goalsView === 'achieved') return achievedView()
    const i = h.indexOf('<div class="mx-5 mb-2 mt-6 flex items-center">')
    return h.slice(0, i) + goalsBar('all') + h.slice(i).replace(/<button type="button" data-toast="Opens achieved goals"[\s\S]*?<\/button>/, '')
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-trophy]'); if (!b) return
    const S = Object.values(screens).find((x) => x.vp.contains(b)); if (!S) return
    e.stopPropagation()
    S.st.goalsView = S.st.goalsView === 'achieved' ? null : 'achieved'
    render(S)
  }, true)
  /* the full-screen "You did it" stays exactly as in the app */
  AFTER.celebrate = (S) => {
    const el = document.createElement('div')
    el.className = 'fixed inset-0 z-[300] flex flex-col items-center justify-center overflow-hidden bg-[var(--color-brand-primary)] px-6 text-center text-white'
    el.innerHTML = `${Array.from({ length: 18 }, (_, i) => `<span aria-hidden="true" class="absolute h-3 w-1.5 rounded-sm" style="left:${(i * 37) % 100}%;top:${(i * 53) % 60}%;background:${['#fbe7a2', '#ffffff', '#7fe0d0'][i % 3]};transform:rotate(${i * 29}deg)"></span>`).join('')}<span class="relative flex size-28 items-center justify-center rounded-full bg-white text-[var(--color-brand-primary)] shadow-[0_0_0_14px_rgba(255,255,255,.14),0_0_0_30px_rgba(255,255,255,.07)]">${ICON('trophy', 'size-12')}</span><p class="mt-8 text-xs font-bold uppercase tracking-[0.12em] opacity-80">Goal achieved</p><p class="mt-1 text-[38px] font-bold leading-tight">You did it</p><p class="mt-2 max-w-[280px] text-[0.9375rem] opacity-85">Wedding gift is fully saved. That’s 8 months of steady saving.</p><p class="mt-4 font-mono-numbers text-4xl font-semibold">15,000</p><div class="mt-6 grid w-full max-w-[320px] grid-cols-3 gap-2">${[['8', 'months'], ['11', 'deposits'], ['4', 'streak']].map(([v, l]) => `<div class="rounded-2xl bg-white/12 py-2.5"><p class="font-mono-numbers text-lg font-semibold">${v}</p><p class="text-[0.6875rem] opacity-80">${l}</p></div>`).join('')}</div><button type="button" data-cx class="mt-8 h-12 w-full max-w-[320px] rounded-xl bg-white text-[0.9375rem] font-semibold text-[var(--color-brand-primary)]">See your goals</button>`
    S.vp.querySelector('[data-layer-root]').append(el)
    el.querySelector('[data-cx]').onclick = () => el.remove()
  }
  BEFORE.celebrate = AFTER.celebrate
}

/* ---------- Add card: the preview floats over the sheet exactly as in the app (280 wide, halo, 64% sheet) ---------- */
function floatCard(S, sh, html) {
  if (!sh.float) {
    const H = S.vp.clientHeight || 844
    sh.float = document.createElement('div')
    sh.float.setAttribute('aria-hidden', 'true')
    sh.float.className = 'pointer-events-none fixed left-1/2 w-[280px]'
    sh.float.style.cssText = `top:${Math.max(46, H * 0.21 - 88)}px;margin-left:-140px;z-index:${(+sh.el.style.zIndex || 140) + 5};opacity:0;transform:scale(.97);transition:opacity .22s cubic-bezier(.22,1,.36,1), transform .22s cubic-bezier(.22,1,.36,1)`
    sh.el.style.setProperty('height', `${Math.round(H * 0.64)}px`, 'important')
    sh.el.style.setProperty('max-height', `${Math.round(H * 0.64)}px`, 'important')
    sh.el.after(sh.float)
    requestAnimationFrame(() => requestAnimationFrame(() => { sh.float.style.opacity = '1'; sh.float.style.transform = 'none' }))
    setTimeout(() => { const t = setInterval(() => { if (!sh.el.isConnected || (sh.el.style.transform && sh.el.style.transform !== 'none')) { sh.float.remove(); clearInterval(t) } }, 60) }, 400)
  }
  const th = THEMES[(html.match(/data-theme="(\w+)"/) || [])[1]] || THEMES.teal
  sh.float.innerHTML = `<div class="relative"><div aria-hidden="true" class="absolute" style="inset:-34px;border-radius:46px;background:radial-gradient(closest-side, ${th[0]}88, transparent);filter:blur(36px)"></div><div class="relative">${html}</div></div>`
}

/* ---------- Flow hero: "Spent", no "of", the month at the bar start and the budget at its end ---------- */
function pageM(st) {
  const T = totals(st)
  const note = `<span class="flex gap-4"><span class="inline-flex items-center gap-1">${ICON('arrow-down', 'size-3.5')}<b class="font-mono-numbers font-semibold text-[var(--flow-band-fg)]">+${f0(T.inn)}</b> in</span><span class="inline-flex items-center gap-1">${ICON('arrow-up', 'size-3.5')}<b class="font-mono-numbers font-semibold text-[var(--flow-band-fg)]">${MINUS}${f0(T.out)}</b> out</span></span>`
  const band = bandHTML(st, { contained: true, cells: false, note, pb: 'pb-4' })
    .replace('Left to spend · October', 'Spent')
    .replace(`>${f2(T.left)}</span>`, `>${f2(T.out)}</span>`)
    .replace(/<span class="min-w-0 truncate whitespace-nowrap text-\[0\.8125rem\] text-\[var\(--flow-band-fg-2\)\]">of 24,500<\/span>/, '')
    .replace('until Nov 8', 'until Oct 31')
    .replace('<span>Oct 9</span>', '<span>October</span>')
    .replace(`<span>spent ${f0(T.out)}</span>`, `<span>${f0(T.left)} left</span>`)
    .replace('<span>Nov 8</span>', '<span>24,500</span>')
  return `${stickyHTML(st)}<div class="mx-4 mt-4">${band}</div><div class="mx-4 mt-4 flex items-center gap-2">${segHTML(st, ['All', 'In', 'Out'], 'min-w-0 flex-1')}${filterBtn(st)}</div>${resultsHTML(st, 'mx-4 mt-2 flex flex-col gap-1')}${pendingHTML(st, 'mx-4 mt-4')}${ledgerM(st)}`
}
LT_NOTES.flow = LT_NOTES.flow.replace(/ Round 5:.*$/, '') + ' The hero reads Spent; the bar runs from October (the 1st, the app default) to the budget, 24,500, with what is left in the middle. Someone on a payday cycle sees its start date (e.g. Oct 25) instead of the month name. The per-day figure until the end of the month stays.'

/* ---------- Emergency fund: inline number, the old small − / +, and the simple-month breakdown ---------- */
const SIMPLE = [['rent', 'Rent', 'house', 'rent', 7000, 'From your profile'], ['food', 'Food', 'utensils-crossed', 'food', 2800, 'Your Food and Groceries budget'], ['transport', 'Transport', 'car', 'transport', 900, 'Your Transport budget'], ['bills', 'Bills', 'plug', 'utilities', 1300, 'Electricity, internet, phone'], ['debt', 'Debt minimums', 'landmark', 'rent', 4650, 'Car loan 3,250 · valU 1,400']]
AFTER.s_ef = (S) => {
  const covered = 16800
  const step = (n) => `<div class="flex min-h-[56px] items-center gap-3 px-4"><span class="min-w-0 flex-1 text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]">Months to cover</span><span class="flex items-center gap-1"><button type="button" data-v="dec" aria-label="One month less" class="${CLOSE_BTN}">${ICON('minus', 'size-4')}</button><input data-in="m" inputmode="numeric" maxlength="2" aria-label="Months to cover" value="${n}" class="w-10 bg-transparent text-center font-mono-numbers text-[1.25rem] font-bold text-[var(--color-brand-text-primary)] outline-none"><button type="button" data-v="inc" aria-label="One month more" class="${CLOSE_BTN}">${ICON('plus', 'size-4')}</button></span></div>`
  form4(S, {
    title: 'Emergency fund', sub: 'Months you could live on a simple version of your life', state: { m: '3', month: 12000 },
    body: (st) => { const m = Math.max(1, +st.m || 1); const tgt = st.month * m; return `${heroAmt((covered / st.month).toFixed(1), `of ${m} months`, `${f0(covered)} covered · ${f0(Math.max(0, tgt - covered))} to go`, ['shield-check', 'var(--color-brand-primary-soft)', 'var(--color-brand-primary-ink)'])}${barLine(Math.min(100, (covered / tgt) * 100))}${grp4([step(st.m), row4('A simple month', `<span class="font-mono-numbers">${f0(st.month)}</span>`, 'month'), `<div class="flex min-h-[52px] items-center px-4"><span class="flex-1 text-[0.84375rem] ${SECOND}">Target</span><span data-tgt class="font-mono-numbers text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${f0(tgt)}</span></div>`], 'Your fund', 'Tap the number to type it, or use − and +. Kept out of every goal; covered by your savings pockets.')}` },
    foot: () => foot4('Add money'), done: 'Opens Add money',
    onInput: (f, st, s) => { if (f.dataset.in !== 'm') return; f.value = f.value.replace(/\D/g, '').slice(0, 2); st.m = f.value; s.el.querySelector('[data-tgt]').textContent = f0(st.month * Math.max(1, +f.value || 1)) },
    on: { dec: (v, draw, st) => { st.m = String(Math.max(1, (+st.m || 1) - 1)); draw() }, inc: (v, draw, st) => { st.m = String(Math.min(24, (+st.m || 0) + 1)); draw() }, month: (v, draw, st) => ltSimpleMonth(S, (n) => { st.month = n; draw() }) },
  })
}
function ltSimpleMonth(S, done) {
  return form4(S, {
    title: 'A simple month', sub: 'What you’d still pay if money got tight', z: 220, state: { on: new Set(['rent', 'food', 'transport', 'bills']), own: '' },
    body: (st) => { const sum = SIMPLE.filter((x) => st.on.has(x[0])).reduce((s, x) => s + x[4], 0); const max = Math.max(...SIMPLE.map((x) => x[4])); return `<div class="flex flex-col items-center px-5 pb-4 pt-1 text-center"><p class="font-mono-numbers text-[2.5rem] font-semibold leading-none tracking-[-0.04em] ${st.own ? `${MUTED} line-through decoration-2` : 'text-[var(--color-brand-text-primary)]'}">${f0(sum)}</p><p class="mt-2 text-[0.8125rem] ${SECOND}">${st.own ? `Your figure, ${esc(st.own)}, is used instead` : 'a month · tap a line to count it or not'}</p></div>
      <div class="mx-4 divide-y divide-[var(--color-brand-border)] overflow-hidden ${CARDBOX}">${SIMPLE.map(([k, l, ic, cv, n, why]) => { const on = st.on.has(k); return `<button type="button" data-v="tg:${k}" role="checkbox" aria-checked="${on}" class="flex min-h-[64px] w-full items-center gap-3 px-4 py-2.5 text-start ${on ? '' : 'opacity-55'}"><span aria-hidden="true" class="flex size-10 shrink-0 items-center justify-center rounded-[11px]" style="background:var(--cat-${cv}-bg);color:var(--cat-${cv}-fg)">${ICON(ic, 'size-5')}</span><span class="min-w-0 flex-1"><span class="flex items-baseline justify-between gap-2"><span class="text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${l}</span><span class="font-mono-numbers text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${f0(n)}</span></span><span class="mt-1 block h-1 rounded-full bg-[var(--color-brand-sunken)]"><span class="block h-full rounded-full ${on ? 'bg-[var(--color-brand-primary)]' : 'bg-[var(--color-brand-border-strong)]'}" style="width:${(n / max) * 100}%"></span></span><span class="mt-1 block truncate text-xs ${MUTED}">${why}</span></span>${tick(on, true)}</button>` }).join('')}</div>
      ${grp4([in4('own', 'Or set it yourself', 'e.g. 15,000', st.own, 'decimal')], '', 'Your figure wins over the sum above.')}
      <div class="mx-4 mt-3"><button type="button" data-toast="Buddgy estimates a simple month from your last 3 months" class="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[0.875rem] font-semibold text-[var(--color-brand-primary-ink)] hover:bg-[var(--color-brand-primary-soft)]">${ICON('sparkles', 'size-4')}Estimate it with Buddgy</button></div>` },
    foot: () => foot4('Use this amount'), done: 'Simple month updated',
    onInput: (f, st) => { if (f.dataset.in === 'own') st.own = f.value },
    on: { tg: (v, draw, st) => { const k = v.dataset.v.split(':')[1]; st.on.has(k) ? st.on.delete(k) : st.on.add(k); draw() } },
  })
}
AFTER.efmonth = (S) => ltSimpleMonth(S, () => {})
BEFORE.efmonth = (S) => bOpen(S, 'Emergency fund', '', `<p class="text-xs font-bold uppercase ${MUTED}">A simple month · tap what counts</p><div class="mt-2 flex flex-wrap gap-2">${SIMPLE.map(([, l, , , n]) => `<span class="${OPT_BASE} ${OPT_ON}">${l} ${f0(n)}</span>`).join('')}</div><div class="mt-3 rounded-2xl bg-[var(--color-brand-elevated)] p-4"><b>A simple month</b><p class="text-sm ${SECOND}">Rent, food, transport, bills, debt minimums</p><p class="mt-1 font-mono-numbers text-xl font-bold">12,000</p></div>${bLabel('Or set it yourself')}${bAmount('', 'EGP')}`, '')
const finPick = (S, st, draw) => ltDate(S, { day: 28, time: '12:00' }, (d) => { st.fin = { m: 2, y: 2027 }; draw() })

/* ================= Add goal: shared parts, then three versions ================= */
const GC6 = [['vacation', 'Vacation', 'plane', IC.teal], ['house', 'House', 'house', ['var(--cat-rent-bg)', 'var(--cat-rent-fg)']], ['car', 'Car', 'car', ['var(--cat-transport-bg)', 'var(--cat-transport-fg)']], ['education', 'Education', 'graduation-cap', IC.green], ['wedding', 'Wedding', 'heart-pulse', ['var(--cat-shopping-bg)', 'var(--cat-shopping-fg)']], ['phone', 'Phone', 'smartphone', IC.green], ['umrah', 'Hajj & Umrah', 'moon-star', IC.amber], ['emergency', 'Emergency', 'shield-check', IC.teal], ['family', 'Family', 'user', IC.amber], ['invest', 'Investments', 'trending-up', IC.green], ['business', 'Business', 'briefcase', IC.teal], ['custom', 'Other', 'target', ['var(--color-brand-elevated)', 'var(--color-brand-text-secondary)']]]
const ICONSET = ['target', 'plane', 'house', 'car', 'graduation-cap', 'heart-pulse', 'smartphone', 'moon-star', 'shield-check', 'user', 'trending-up', 'briefcase', 'gem', 'trophy', 'award', 'coins', 'wallet', 'landmark', 'shopping-bag', 'utensils-crossed', 'sparkles', 'zap', 'scale', 'bell', 'image']
const gcat = (st) => GC6.find((c) => c[0] === st.cat)
const gIcon = (st) => (st.cat === 'custom' && st.icon ? st.icon : gcat(st)[2])
const gTile = (st, s = 64) => `<button type="button" data-v="icon" aria-label="Goal icon${st.cat === 'custom' ? ', tap to change' : ''}" class="relative flex shrink-0 items-center justify-center" style="width:${s}px;height:${s}px;border-radius:${s * 0.3}px;background:${gcat(st)[3][0]};color:${gcat(st)[3][1]}">${ICON(gIcon(st), s > 56 ? 'size-7' : 'size-6')}${st.cat === 'custom' ? `<span aria-hidden="true" class="absolute -bottom-1 -end-1 flex size-6 items-center justify-center rounded-full border-2 border-[var(--color-brand-card)] bg-[var(--color-brand-primary)] text-[var(--color-brand-on-primary)]">${ICON('pencil', 'size-3')}</span>` : ''}</button>`
function ltIconPicker(S, on, done) {
  const body = `<div class="mx-4 grid grid-cols-5 gap-2 ${CARDBOX} p-3">${ICONSET.map((ic) => `<button type="button" data-ic="${ic}" aria-label="${ic}" aria-pressed="${ic === on}" class="flex h-14 items-center justify-center rounded-xl ${ic === on ? 'bg-[var(--color-brand-primary)] text-[var(--color-brand-on-primary)]' : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)]'}">${ICON(ic, 'size-6')}</button>`).join('')}</div><p class="mx-5 mt-3 text-xs ${MUTED}">The same icons used across buddget, so your goal looks at home everywhere.</p>`
  const sh = ltSheet(S, 'Pick an icon', 'For a goal of your own', body, '', 230)
  sh.el.addEventListener('click', (e) => { const b = e.target.closest('[data-ic]'); if (b) { sh.close(); done(b.dataset.ic) } })
}
const askBar = (big) => `<div class="mx-4 rounded-2xl bg-[var(--color-brand-primary-soft)] p-3"><p class="mb-2 flex items-center gap-2 text-[0.8125rem] font-semibold text-[var(--color-brand-primary-ink)]">${ICON('sparkles', 'size-4')}${big ? 'Describe it and Buddgy fills in the rest' : 'Or tell Buddgy'}</p><div class="flex items-center gap-2"><input aria-label="Describe your goal" placeholder="e.g. A week in Dahab next summer" class="h-11 min-w-0 flex-1 rounded-full bg-[var(--color-brand-card)] px-4 text-[0.9375rem] text-[var(--color-brand-text-primary)] outline-none placeholder:text-[var(--color-brand-text-muted)]"><button type="button" data-toast="Buddgy estimates the cost, date and pace, then opens a chat" aria-label="Send to Buddgy" class="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-primary)] text-[var(--color-brand-on-primary)]">${ICON('arrow-up', 'size-5')}</button></div></div>`
const catChips = (st) => `<div class="hide-scrollbar flex gap-2 overflow-x-auto px-4 pb-1">${GC6.map(([k, l, ic]) => `<button type="button" data-v="set:cat:${k}" class="${OPT_BASE} ${k === st.cat ? OPT_ON : OPT_OFF} shrink-0">${ICON(k === 'custom' && st.icon ? st.icon : ic, 'size-4')}${l}</button>`).join('')}</div>`
const SAVINGS_MO = 10000
/* the three ways to fund it; the share keeps the old slider, refined */
const fundCards = (st) => {
  const card = (k, t, s, right, extra) => { const on = st.each === k; return `<div class="rounded-2xl border-[1.5px] ${on ? 'border-[var(--color-brand-primary)] bg-[color-mix(in_oklab,var(--color-brand-primary)_5%,var(--color-brand-card))]' : 'border-[var(--color-brand-border)] bg-[var(--color-brand-card)]'}"><button type="button" data-v="set:each:${k}" role="radio" aria-checked="${on}" class="flex min-h-[60px] w-full items-center gap-3 px-4 py-3 text-start"><span aria-hidden="true" class="flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-[var(--color-brand-primary)]' : 'border-[var(--color-brand-border-strong)]'}">${on ? '<span class="size-2.5 rounded-full bg-[var(--color-brand-primary)]"></span>' : ''}</span><span class="min-w-0 flex-1"><span class="block text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${t}</span><span class="block text-xs ${SECOND}">${s}</span></span>${right || ''}</button>${on && extra ? `<div class="px-4 pb-4">${extra}</div>` : ''}</div>` }
  const per = Math.round((SAVINGS_MO * st.pct) / 100)
  return `<div class="mx-4 flex flex-col gap-2" role="radiogroup">${card('share', 'A share of what I save', 'Adapts to each month. No fixed amount.', `<span data-pct class="font-mono-numbers text-[1.375rem] font-semibold tracking-[-0.03em] ${st.each === 'share' ? 'text-[var(--color-brand-primary-ink)]' : MUTED}">${st.pct}%</span>`, `<input data-in="pct" type="range" min="5" max="100" step="5" value="${st.pct}" aria-label="Share of savings" class="h-11 w-full accent-[var(--color-brand-primary)]"><div class="flex justify-between font-mono-numbers text-[0.6875rem] ${MUTED}"><span>5%</span><span>50%</span><span>100%</span></div><p class="mt-2 text-[0.8125rem] ${SECOND}">of <b class="font-mono-numbers text-[var(--color-brand-text-primary)]">${f0(SAVINGS_MO)}</b> you save a month (income minus budget)</p><p class="mt-0.5 text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">≈ <span data-per class="font-mono-numbers">${f0(per)}</span> a month</p><p class="mt-1 text-xs ${MUTED}">With your other goals, <span data-tot>${25 + st.pct}</span>% of savings is taken</p>`)}${card('fixed', 'A fixed amount', 'The same amount each time', st.each === 'fixed' ? '' : `<span class="font-mono-numbers text-[0.9375rem] ${MUTED}">${st.fixed}</span>`, `<label class="flex h-12 items-center gap-2 rounded-xl bg-[var(--color-brand-elevated)] px-4"><input data-in="fixed" inputmode="decimal" value="${esc(st.fixed)}" aria-label="Amount each month" class="min-w-0 flex-1 bg-transparent font-mono-numbers text-[1.0625rem] font-semibold text-[var(--color-brand-text-primary)] outline-none"><span class="font-mono-numbers text-sm font-semibold ${MUTED}">EGP</span></label><p class="mt-3 text-[0.75rem] font-semibold ${SECOND}">How often</p><div class="mt-1.5 flex gap-2">${GFREQ.map(([k, l]) => `<button type="button" data-v="set:freq:${k}" class="${OPT_BASE} ${st.freq === k ? OPT_ON : OPT_OFF} flex-1 justify-center">${l}</button>`).join('')}</div><p class="mt-2 text-xs ${MUTED}">${st.freq === 'm' ? 'Checked each month.' : `Checked on each due date, so the months between never show you as behind. Counts as about ${f0(num4(st.fixed) / (st.freq === 'q' ? 3 : 12))} a month in your budget.`}</p>`)}${card('self', 'I’ll add money myself', 'No automatic transfers. Tap Add money anytime.', '')}</div>`
}
/* already saved + where it is: the same Account · Pocket · Outside tabs */
const savedBlock = (st) => {
  const tabs = `<div class="px-4 pb-3 pt-1"><div role="tablist" class="inline-flex w-full gap-0.5 rounded-xl bg-[var(--color-brand-elevated)] p-[3px]">${SRC_TABS.map(([k, l, ic]) => `<button type="button" role="tab" aria-selected="${k === st.where}" data-v="set:where:${k}" class="${k === st.where ? SEG_ON : SEG_OFF} gap-1.5">${ICON(ic, 'size-4')}${l}</button>`).join('')}</div></div>`
  const pickRow = st.where === 'acct' ? row4('Kept in', pmV(st.wpm), 'wpm') : st.where === 'pocket' ? row4('Kept in', pocketV(st.wpk), 'wpk') : ''
  const note = st.where === 'outside' ? 'Counted as new money, on top of your accounts.' : st.where === 'pocket' ? `Moved from ${POCKET[st.wpk][1]}. Your net worth doesn’t change.` : `Set aside in ${PM[st.wpm].name}. Your net worth doesn’t change.`
  return grp4([in4('saved', 'Already saved', '0 · optional', st.saved, 'decimal'), `<div><p class="px-4 pt-3 text-[0.75rem] font-semibold ${SECOND}">Where is it?</p>${tabs}</div>`, pickRow], 'Money you already have', note)
}
const GFREQ = [['m', 'Every month'], ['q', '3 months'], ['y', 'Every year']]
const goalState = () => ({ freq: 'm', step: 1, cat: 'vacation', icon: '', name: 'Trip to Dahab', amt: '50,000', cur: 'EGP', fin: { m: 2, y: 2027 }, each: 'share', pct: 20, fixed: '2,000', saved: '', where: 'acct', wpm: 'cib', wpk: 'trip' })
const goalOn = (S) => ({
  icon: (v, draw, st) => (st.cat === 'custom' ? ltIconPicker(S, st.icon || 'target', (ic) => { st.icon = ic; draw() }) : toast(S, 'Pick Other to choose your own icon')),
  fin: (v, draw, st) => finPick(S, st, draw),
  wpm: (v, draw, st) => ltMethodPicker(S, st.wpm, (m) => { st.wpm = m; draw() }),
  wpk: (v, draw, st) => ltPocketPicker(S, st.wpk, (k) => { st.wpk = k; draw() }),
})
const goalInput = (f, st, s) => {
  if (f.dataset.in === 'pct') { st.pct = +f.value; s.el.querySelector('[data-pct]').textContent = `${st.pct}%`; s.el.querySelector('[data-per]').textContent = f0(Math.round((SAVINGS_MO * st.pct) / 100)); s.el.querySelector('[data-tot]').textContent = 25 + st.pct }
}
const heroGoal = (st) => { const months = Math.max(1, (st.fin.y - 2026) * 12 + st.fin.m - 9); return hero4({ amt: st.amt, ctl: ctl4('cur', st.cur), top: `<div class="mt-1 flex flex-col items-center">${gTile(st)}<input data-in="name" aria-label="Goal name" value="${esc(st.name)}" placeholder="Name your goal" class="mt-3 w-full bg-transparent text-center text-[1.0625rem] font-semibold text-[var(--color-brand-text-primary)] outline-none placeholder:text-[var(--color-brand-text-muted)]"></div>`, line: `≈ ${f0(num4(st.amt) / months)} a month to finish by ${monV(st.fin)}` }) }
const costLink = `<div class="-mt-2 mb-1 flex justify-center"><button type="button" data-toast="Opens typical costs from Buddgy" class="inline-flex h-11 items-center gap-1.5 px-2 text-[0.8125rem] font-semibold text-[var(--color-brand-primary-ink)]">${ICON('sparkles', 'size-4')}Not sure? Ask Buddgy for typical costs</button></div>`
const pocketNote = (st) => `<div class="mx-4 mt-3 flex items-center gap-3 rounded-2xl border border-[var(--color-brand-border)] px-4 py-3 text-[0.8125rem] ${SECOND}">${ICON('coins', 'size-4 shrink-0')}A “${esc(st.name || 'Goal')}” pocket is made in Wealth to hold this money.</div>`

/* A · redesigned, everything in one sheet */
AFTER.addgoalA = (S) => form4(S, {
  title: 'New goal', z: 130, state: goalState(),
  body: (st) => `${askBar(false)}<div class="h-3"></div>${catChips(st)}${heroGoal(st)}${costLink}${grp4([pick4('Finish line', monV(st.fin), 'fin', 'calendar')])}${sectionHead('Fund it').replace('pt-1', 'pt-5')}${fundCards(st)}${savedBlock(st)}${pocketNote(st)}`,
  foot: () => foot4('Create goal'), done: 'Goal created', on: goalOn(S), onInput: goalInput,
})
/* B · the old three steps, refined with the new pickers */
AFTER.addgoalB = (S) => form4(S, {
  title: 'New goal', z: 130, state: goalState(),
  body: (st) => `<div class="mx-4 mb-4 flex gap-1.5">${[1, 2, 3].map((i) => `<span class="h-1 flex-1 rounded-full ${i <= st.step ? 'bg-[var(--color-brand-primary)]' : 'bg-[var(--color-brand-sunken)]'}"></span>`).join('')}</div>${st.step === 1
    ? `<p class="mx-5 text-[1.0625rem] font-bold text-[var(--color-brand-text-primary)]">What are you working toward?</p><p class="mx-5 mb-3 text-[0.8125rem] ${SECOND}">Describe it and Buddgy fills in the rest, or pick one below.</p>${askBar(true)}${sectionHead('Save for').replace('pt-1', 'pt-5')}<div class="mx-4 grid grid-cols-4 gap-2">${GC6.map(([k, l, ic, tone]) => `<button type="button" data-v="pickcat:${k}" class="flex flex-col items-center gap-1.5 rounded-2xl border ${k === st.cat ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-soft)]' : 'border-[var(--color-brand-border)] bg-[var(--color-brand-card)]'} px-1 py-3"><span aria-hidden="true" class="flex size-10 items-center justify-center rounded-[12px]" style="background:${tone[0]};color:${tone[1]}">${ICON(ic, 'size-5')}</span><span class="w-full truncate text-center text-[0.6875rem] font-semibold text-[var(--color-brand-text-primary)]">${l}</span></button>`).join('')}</div>`
    : st.step === 2
      ? `${heroGoal(st)}${costLink}${grp4([pick4('Finish line', monV(st.fin), 'fin', 'calendar')])}${savedBlock(st)}`
      : `<p class="mx-5 text-[1.0625rem] font-bold text-[var(--color-brand-text-primary)]">Fund it</p><p class="mx-5 mb-3 text-[0.8125rem] ${SECOND}">How ${esc(st.name)} gets money each month.</p>${fundCards(st)}${pocketNote(st)}${gNote(`At ${st.pct}% of your savings, you reach 50,000 around <b class="font-semibold">Apr 2027</b>, a month after your date.`)}`}`,
  foot: (st) => (st.step === 1 ? foot4('Next') : `<div class="grid grid-cols-2 gap-2">${btn('outline', 'block', 'Back', 'data-v="back"')}${st.step === 3 ? `<button type="button" data-done class="${BTN.primary} ${SZ.block}">Create goal</button>` : `<button type="button" data-v="next" class="${BTN.primary} ${SZ.block}">Next</button>`}</div>`),
  done: 'Goal created',
  on: { ...goalOn(S), next: (v, draw, st) => { st.step++; draw() }, back: (v, draw, st) => { st.step--; draw() }, pickcat: (v, draw, st) => { st.cat = v.dataset.v.split(':')[1]; st.name = st.cat === 'vacation' ? 'Trip to Dahab' : st.cat === 'custom' ? '' : `New ${gcat(st)[1].toLowerCase()}`; st.step = 2; draw() } },
  onInput: goalInput,
})
/* C · one page; Fund it opens its own sheet with the three options and the money already saved */
function ltFundIt(S, st, back) {
  return form4(S, { title: 'Fund it', sub: `How ${st.name} gets money`, z: 220, state: st, body: (s) => `${fundCards(s)}${savedBlock(s)}${pocketNote(s)}`, foot: () => btn('primary', 'block', 'Done', 'data-v="ok"'), on: { ...goalOn(S), ok: (v, draw, s, sh) => { sh.close(); back() } }, onInput: goalInput })
}
const fundSum = (st) => `${st.each === 'fixed' ? `${st.fixed} ${{ m: 'a month', q: 'every 3 months', y: 'a year' }[st.freq]}` : fundV(st)}${num4(st.saved) ? ` · ${st.saved} saved` : ''}`
AFTER.addgoalC = (S) => form4(S, {
  title: 'New goal', z: 130, state: goalState(),
  body: (st) => `${askBar(false)}<div class="h-3"></div>${catChips(st)}${heroGoal(st)}${costLink}${grp4([pick4('Finish line', monV(st.fin), 'fin', 'calendar'), row4('Fund it', `<span class="truncate">${fundSum(st)}</span>`, 'fund')])}${pocketNote(st)}`,
  foot: () => foot4('Create goal'), done: 'Goal created',
  on: { ...goalOn(S), fund: (v, draw, st) => ltFundIt(S, st, draw) }, onInput: goalInput,
})
AFTER.addgoal = AFTER.addgoalA
BEFORE.addgoalA = BEFORE.addgoalB = BEFORE.addgoalC = BEFORE.addgoal

/* ================= Insights: an analysis hero, and every section planned for Free, Pro, learning and no income ================= */
{
  const I = window.INS5
  const LOCKPILL = '<span class="mx-0.5 inline-block rounded-md bg-[var(--color-brand-sunken)] px-1.5 align-middle font-mono-numbers text-[0.75rem] leading-5 text-transparent" style="text-shadow:0 0 0 var(--color-brand-text-muted)">••••</span>'
  const UNLOCK = (what) => `<button type="button" data-open4="locked" data-what="${what}" class="inline-flex h-11 items-center gap-1 text-[0.8125rem] font-semibold text-[var(--color-brand-gold)]">${ICON('sparkles', 'size-4')}Unlock with Pro ${ICON('chevron-right', 'size-4')}</button>`
  const PROTAG = `<span class="rounded-full bg-[color-mix(in_oklab,var(--color-brand-gold)_18%,transparent)] px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-[0.08em] text-[var(--color-brand-gold)]">Pro</span>`
  const band = (inner) => `<section class="mx-4 mt-4 overflow-hidden rounded-3xl text-[var(--flow-band-fg)]" style="background:linear-gradient(120deg, var(--flow-band-a) 0%, var(--flow-band-b) 100%)">${inner}</section>`
  const stat = (k, v, sub, lock) => `<div class="rounded-2xl px-3.5 py-3" style="background:var(--flow-band-mix)"><p class="text-[0.6875rem] font-bold uppercase tracking-[0.06em] text-[var(--flow-band-fg-2)]">${k}</p><p class="mt-1 font-mono-numbers text-[1.0625rem] font-semibold leading-tight">${lock ? '<span class="rounded bg-[var(--flow-band-deep)] px-2 text-transparent">••••</span>' : v}</p><p class="mt-0.5 text-[0.71875rem] leading-snug text-[var(--flow-band-fg-2)]">${sub}</p></div>`
  /* the hero answers "how am I doing and why", not just sums */
  const hero = (plan) => band(`<div class="px-[18px] pb-4 pt-3"><div class="flex items-center justify-between gap-2"><span class="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[var(--flow-band-fg-2)]">October · day 19 of 31</span><span class="inline-flex h-[22px] items-center gap-1 rounded-full bg-[var(--flow-band-fg)] px-2 text-[0.71875rem] font-bold" style="color:var(--flow-chip-warn)">${ICON('clock', 'size-[13px]')}Over pace</span></div>
    <p class="mt-2 text-[0.8125rem] text-[var(--flow-band-fg-2)]">At this pace you finish October</p><p class="mt-0.5 flex items-baseline gap-2"><span class="font-mono-numbers text-[32px] font-semibold tracking-[-0.03em]">2,020 over</span><span class="text-[0.8125rem] text-[var(--flow-band-fg-2)]">your 24,500 budget</span></p>
    <p class="mt-1 text-[0.8125rem]">Spend <b class="font-mono-numbers">687 a day</b> from now to land on budget, instead of 855.</p>
    <div class="mt-3 grid grid-cols-2 gap-2">${stat('Main reason', 'Food +18%', '1,060 more than Sep, mostly Talabat')}${stat('Before payday', '3,400 due', 'Rent and 2 bills in the next 6 days')}${stat('Unusual buy', 'IKEA 3,400', '3× your usual Shopping buy', plan === 'free')}${stat('Your big day', 'Thursday', 'You spend 2× on Thursdays', plan === 'free')}</div>
    ${plan === 'free' ? `<div class="mt-3 flex items-center justify-between gap-2 rounded-2xl px-3.5 py-1" style="background:var(--flow-band-deep)"><span class="text-[0.75rem] text-[var(--flow-band-fg-2)]">2 more findings are in Pro</span><button type="button" data-open4="locked" class="h-11 text-[0.8125rem] font-semibold text-[var(--flow-band-fg)]">See Pro ›</button></div>` : ''}</div>`)
  const learning = () => band(`<div class="px-[18px] pb-4 pt-3"><span class="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[var(--flow-band-fg-2)]">Insights</span><p class="mt-2 flex items-center gap-2 text-[1.0625rem] font-semibold">${ICON('sparkles', 'size-5')}I’m learning your patterns</p><p class="mt-1 text-[0.8125rem] text-[var(--flow-band-fg-2)]">3 more days of spending, then I can show how you spend across the month.</p><div class="mt-3 h-1.5 rounded-full" style="background:var(--flow-band-mix)"><div class="h-full w-[40%] rounded-full bg-[var(--flow-band-fg)]"></div></div><p class="mt-1.5 font-mono-numbers text-[0.6875rem] text-[var(--flow-band-fg-2)]">2 of 5 days · 4 of 8 purchases</p></div>`)
  const noIncome = () => band(`<div class="px-[18px] pb-4 pt-3"><span class="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[var(--flow-band-fg-2)]">October · day 19 of 31</span><p class="mt-2 font-mono-numbers text-[32px] font-semibold">—</p><p class="text-[0.8125rem] text-[var(--flow-band-fg-2)]">Add your income to see if October ends on budget and what you can spend each day.</p><button type="button" data-toast="Opens Add income" class="mt-3 inline-flex h-11 items-center gap-1.5 rounded-full bg-[var(--flow-band-fg)] px-4 text-[0.875rem] font-semibold" style="color:var(--flow-band-b)">${ICON('plus', 'size-4')}Add income</button></div>`)
  const card = (head, body, right = '') => `<section class="mx-4 mt-3 ${CARDBOX} p-4"><div class="flex items-start justify-between gap-3"><h3 class="flex items-center gap-2 text-[0.9375rem] font-bold text-[var(--color-brand-text-primary)]">${head}</h3>${right}</div>${body}</section>`
  const locked = (head, what, teaser) => card(`${head} ${PROTAG}`, `<div class="relative mt-3"><div aria-hidden="true" class="pointer-events-none select-none opacity-40 blur-[3px]">${teaser}</div><div class="absolute inset-0 flex flex-col items-center justify-center text-center"><p class="max-w-[220px] text-[0.8125rem] font-medium text-[var(--color-brand-text-primary)]">${what}</p>${UNLOCK(head)}</div></div>`)
  const read = (plan) => (plan === 'free'
    ? card(`${ICON('sparkles', 'size-4 text-[var(--color-brand-primary-ink)]')}Explain my month`, `<p class="mt-1 text-[0.8125rem] ${SECOND}">Buddgy reads your month and tells you, in plain words, what changed and what to do next.</p><div class="mt-3">${btn('outline', 'block', 'See Pro', 'data-open4="locked"')}</div>`)
    : `<div class="mx-4 mt-3 rounded-2xl p-[1.5px]" style="background:linear-gradient(120deg, var(--color-brand-primary), color-mix(in oklab, var(--color-brand-primary) 30%, var(--color-brand-amber)))"><div class="rounded-[15px] bg-[var(--color-brand-card)] p-4"><p class="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-[var(--color-brand-primary-ink)]">${ICON('sparkles', 'size-4')}Buddgy’s read on October</p><p class="mt-2 text-[0.9375rem] leading-relaxed text-[var(--color-brand-text-primary)]">You’re spending <b>855 a day</b>, a bit above plan, so the month ends about <b>2,000 over</b>. Most of it is food delivery: 6 Talabat orders this week. Skip two and you land on budget.</p><div class="mt-3 flex flex-wrap gap-2"><button type="button" data-toast="Opens Buddgy with this question" class="${OPT_BASE} ${OPT_OFF}">Why is food up?</button><button type="button" data-toast="Opens Buddgy with this question" class="${OPT_BASE} ${OPT_OFF}">Make me a plan</button></div></div></div>`)
  const pace = () => card('Spending pace', `<div class="mt-2 flex gap-4 text-xs ${SECOND}"><span class="inline-flex items-center gap-1.5"><span class="h-0.5 w-4 rounded bg-[var(--color-brand-primary)]"></span>You</span><span class="inline-flex items-center gap-1.5"><span class="h-0 w-4 border-t-2 border-dashed border-[var(--color-brand-text-muted)]"></span>Plan</span><span class="inline-flex items-center gap-1.5"><span class="h-0 w-4 border-t-2 border-dotted border-[var(--color-brand-amber)]"></span>Where it’s heading</span></div>${I.pace()}`, `<span class="text-end"><b class="block font-mono-numbers text-[0.9375rem] text-[var(--color-brand-text-primary)]">≈ 26,520</b><span class="text-xs ${MUTED}">by Oct 31</span></span>`)
  const where = () => card('Where it went', `<div class="mt-3 flex items-center gap-4"><div class="relative">${I.donut()}<span class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><b class="font-mono-numbers text-[1.0625rem] text-[var(--color-brand-text-primary)]">${f0(I.total)}</b><span class="text-[0.6875rem] ${MUTED}">EGP spent</span></span></div><ul class="min-w-0 flex-1 space-y-1.5">${I.CATS5.map(([n, v]) => `<li class="flex items-center gap-2 text-[0.8125rem]"><span aria-hidden="true" class="size-2.5 shrink-0 rounded-full" style="background:${I.COL[n]}"></span><span class="min-w-0 flex-1 truncate text-[var(--color-brand-text-primary)]">${n}</span><span class="font-mono-numbers ${SECOND}">${Math.round((v / I.total) * 100)}%</span></li>`).join('')}</ul></div><div class="mt-4 divide-y divide-[var(--color-brand-border)] border-t border-[var(--color-brand-border)]">${I.CATS5.map(([n, v, d]) => `<button type="button" data-toast="Opens ${n} in Flow" class="flex min-h-12 w-full items-center gap-3 text-start"><span aria-hidden="true" class="flex size-8 shrink-0 items-center justify-center rounded-[10px]" style="background:var(--cat-${CAT[n].v}-bg);color:var(--cat-${CAT[n].v}-fg)">${ICON(CAT[n].icon, 'size-4')}</span><span class="min-w-0 flex-1 truncate text-[0.875rem] font-medium text-[var(--color-brand-text-primary)]">${n}</span>${I.delta(d)}<span class="w-16 text-end font-mono-numbers text-[0.875rem] font-medium text-[var(--color-brand-text-primary)]">${f0(v)}</span></button>`).join('')}</div>`, `<span class="text-xs ${MUTED}">vs September</span>`)
  const months = (plan) => card('Month by month', `${I.bars()}<p class="mt-3 text-[0.8125rem] ${SECOND}">July went over by 2,300. Since then you’ve stayed under, saving <b class="font-mono-numbers text-[var(--color-brand-text-primary)]">18%</b> of income on average.</p>`, `<span class="inline-flex gap-1"><span class="${OPT_BASE} ${OPT_ON} !h-8 !text-xs">6 months</span><button type="button" ${plan === 'free' ? 'data-open4="locked"' : 'data-toast="Shows the year"'} class="${OPT_BASE} ${OPT_OFF} !h-8 !text-xs">Year${plan === 'free' ? ` ${ICON('sparkles', 'size-3 text-[var(--color-brand-gold)]')}` : ''}</button></span>`)
  const tiles = (plan) => (plan === 'free'
    ? locked('Patterns', 'Your big spending day and where your net worth is heading', `<div class="grid grid-cols-2 gap-3"><div>${I.week()}</div><div>${I.nw()}</div></div>`)
    : `<div class="mx-4 mt-3 grid grid-cols-2 gap-3"><section class="${CARDBOX} p-4"><p class="text-xs font-semibold ${SECOND}">Your big day</p><p class="mt-1 text-[0.9375rem] font-bold text-[var(--color-brand-text-primary)]">Thursday</p><p class="font-mono-numbers text-xs ${MUTED}">1,240 on average</p>${I.week()}</section><section class="${CARDBOX} p-4"><p class="text-xs font-semibold ${SECOND}">Net worth path</p><p class="mt-1 font-mono-numbers text-[0.9375rem] font-bold text-[var(--color-brand-text-primary)]">103,907</p><p class="inline-flex items-center gap-1 font-mono-numbers text-xs font-semibold text-[var(--color-brand-green)]">${ICON('trending-up', 'size-3.5')}2.4% · ≈ 140k by Dec 2027</p>${I.nw()}</section></div>`)
  const finding = (ic, tone, title, sub, lock) => `<div class="flex items-start gap-3 px-4 py-3"><span aria-hidden="true" class="flex size-10 shrink-0 items-center justify-center rounded-[11px]" style="background:${tone[0]};color:${tone[1]}">${ICON(ic, 'size-5')}</span><span class="min-w-0 flex-1"><span class="block text-[0.9375rem] font-semibold leading-snug text-[var(--color-brand-text-primary)]">${title}</span>${lock ? UNLOCK('finding') : `<span class="mt-0.5 block text-xs ${MUTED}">${sub}</span>`}</span></div>`
  const changed = (plan) => `${sectionHead('What changed').replace('pt-1', 'pt-5')}<div class="mx-4 divide-y divide-[var(--color-brand-border)] overflow-hidden ${CARDBOX}">${finding('trending-up', TONE.amber, 'Food is up 18% on September', 'Mostly Talabat, 6 orders · 1,060 more')}${finding('repeat', TONE.teal, 'Subscriptions cost 2,062 a month', '24,744 a year · Netflix is charged in USD')}${finding('piggy-bank', TONE.green, 'You kept 18% of your income', 'Above your 15% plan')}${plan === 'free' ? finding('receipt', TONE.teal, `${LOCKPILL} small buys added up to ${LOCKPILL}`, '', true) + finding('scale', TONE.amber, `A price went up by ${LOCKPILL}`, '', true) : finding('receipt', TONE.teal, '38 small buys added up to 2,140', 'Coffee and snacks under 100 each') + finding('scale', TONE.amber, 'Vodafone went up by 50 a month', 'Since September · 600 a year')}</div>${plan === 'free' ? `<div class="mx-4 mt-3 rounded-2xl border border-[color-mix(in_oklab,var(--color-brand-gold)_35%,var(--color-brand-border))] bg-[color-mix(in_oklab,var(--color-brand-gold)_8%,var(--color-brand-card))] p-4"><p class="text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">5 more findings are waiting</p><p class="mt-0.5 text-[0.8125rem] ${SECOND}">Pro opens every finding, the year view, the what-if and your monthly recap.</p><div class="mt-3">${btn('primary', 'block', 'See Pro', 'data-open4="locked"')}</div></div>` : ''}`
  const recap = (plan) => (plan === 'free'
    ? locked('September in one look', 'Your month in 5 cards is part of Pro', '<div class="grid grid-cols-3 gap-2"><div class="h-16 rounded-xl bg-[var(--color-brand-elevated)]"></div><div class="h-16 rounded-xl bg-[var(--color-brand-elevated)]"></div><div class="h-16 rounded-xl bg-[var(--color-brand-elevated)]"></div></div>')
    : card('September in one look', `<div class="mt-3 grid grid-cols-3 gap-2 text-center">${[['Spent', '23,880', -4], ['Kept', '18%', 0], ['Biggest buy', 'IKEA 3,400', 0]].map(([l, v, d]) => `<div class="rounded-xl bg-[var(--color-brand-elevated)] px-2 py-2.5"><p class="text-[0.6875rem] font-semibold ${MUTED}">${l}</p><p class="mt-0.5 truncate font-mono-numbers text-[0.875rem] font-semibold text-[var(--color-brand-text-primary)]">${v}</p>${d ? `<p class="mt-0.5">${I.delta(d)}</p>` : ''}</div>`).join('')}</div>`))
  const examples = () => `${sectionHead('What I will show you').replace('pt-1', 'pt-5')}<div class="mx-4 flex flex-col gap-2">${[['trending-up', TONE.amber, 'Which category grew, and why', 'e.g. Food is up 18%, mostly delivery'], ['calendar', TONE.teal, 'If your money lasts to payday', 'e.g. Lasts to Nov 8 at this pace'], ['repeat', TONE.teal, 'What your bills and subscriptions cost', 'e.g. 2,062 a month, 24,744 a year']].map(([ic, tone, t, s]) => `<div class="flex items-center gap-3 rounded-2xl border border-dashed border-[var(--color-brand-border-strong)] px-4 py-3 opacity-80"><span aria-hidden="true" class="flex size-10 shrink-0 items-center justify-center rounded-[11px]" style="background:${tone[0]};color:${tone[1]}">${ICON(ic, 'size-5')}</span><span class="min-w-0 flex-1"><span class="flex items-center gap-2"><span class="text-[0.875rem] font-semibold text-[var(--color-brand-text-primary)]">${t}</span>${badge('muted', 'Example')}</span><span class="block text-xs ${MUTED}">${s}</span></span></div>`).join('')}</div><div class="h-6"></div>`
  const page = (plan) => {
    if (plan === 'learning') return learning() + examples()
    const top = plan === 'noincome' ? noIncome() : hero(plan)
    return top + read(plan) + pace() + where() + months(plan) + tiles(plan) + changed(plan) + recap(plan) + '<div class="h-6"></div>'
  }
  PAGES.insights = (st, L) => (L ? page(st.plan || 'pro') : I.base(st, L))
  STATES.insfree = (L) => PAGES.insights({ plan: 'free' }, L)
  STATES.inslearn = (L) => PAGES.insights({ plan: 'learning' }, L)
  STATES.insnoinc = (L) => PAGES.insights({ plan: 'noincome' }, L)
  AFTER.locked = (S) => ltSheet(S, 'This one is part of Pro', '', `<div class="flex flex-col items-center px-5 pb-2 text-center"><span aria-hidden="true" class="flex size-14 items-center justify-center rounded-2xl text-white" style="background:radial-gradient(circle at 30% 25%, #fbe7a2, #e0b44a 45%, #a87a1c)">${ICON('sparkles', 'size-7')}</span><p class="mt-3 text-[0.9375rem] text-[var(--color-brand-text-primary)]">Pro opens every pattern, the year view, the what-if and your monthly recap.</p><p class="mt-1 text-[0.8125rem] ${SECOND}">Your daily amount, bills and debts stay free.</p></div>`, `<div class="flex flex-col gap-1">${btn('primary', 'block', 'See Pro', 'data-x')}<button type="button" data-x class="h-11 text-[0.875rem] font-semibold ${SECOND}">Not now</button></div>`, 230)
  LT_NOTES.insights = 'Shown as a Pro user. The hero now answers how October ends and why: over or under budget at this pace, what to spend a day to land on it, and the four findings that explain it (main reason, bills before payday, unusual buy and big day; the last two are Pro). Use the States bar for Free (locked cards show •••• with Unlock with Pro, as in the app today), Learning (too little data) and No income.'
}

/* ---------- bar buttons and New badges for this round ---------- */
{
  const ag = document.querySelector('[data-sheet="addgoal"]')
  ag.outerHTML = '<button type="button" data-sheet="addgoalA">Add goal · A (redesign)</button><button type="button" data-sheet="addgoalB">Add goal · B (old steps, refined)</button><button type="button" data-sheet="addgoalC">Add goal · C (one page + Fund it)</button>'
  document.querySelector('[data-sheet="s_ef"]').insertAdjacentHTML('afterend', '<button type="button" data-sheet="efmonth">A simple month</button>')
  document.querySelector('[data-sheet="addgoalC"]').insertAdjacentHTML('afterend', '<button type="button" data-sheet="celebrate">Goal achieved screen</button>')
  document.querySelector('[data-state=""]').insertAdjacentHTML('beforebegin', '<button type="button" data-state="insfree">Insights · Free</button><button type="button" data-state="inslearn">Insights · learning</button><button type="button" data-state="insnoinc">Insights · no income</button>')
  document.querySelectorAll('.pz-new').forEach((b) => b.remove())
  const NEW6 = ['flow', 'insights', 'goals', 'deposit', 'goal', 'card', 'addcard', 's_goal', 's_ef', 'efmonth', 'addgoalA', 'addgoalB', 'addgoalC', 'insfree', 'inslearn', 'insnoinc']
  document.querySelectorAll('[data-sheet], [data-page], [data-state]').forEach((b) => { if (NEW6.includes(b.dataset.sheet || b.dataset.page || b.dataset.state)) b.insertAdjacentHTML('beforeend', '<span class="pz-new">New</span>') })
}
