/* ================= round 5: overrides on top of lt-v4 ================= */
const H5 = (t) => `<h3 class="text-[0.9375rem] font-bold text-[var(--color-brand-text-primary)]">${t}</h3>`
const CARD5 = `mx-4 mt-3 ${CARDBOX} p-4`

/* ---------- where the money comes from: an account, another pocket, or outside buddget ---------- */
const SRC_ACCTS = [['cib', '105,425 free', 'CIB Current'], ['nbe', '48,200 free', 'NBE Current'], ['voda', '1,850 free', 'Vodafone Cash']]
const srcV = (k) => (k === 'outside' ? pmV('outside') : k.startsWith('pk:') ? pocketV(k.slice(3)) : `${brand(k, 24)}<span class="truncate">${SRC_ACCTS.find((a) => a[0] === k)?.[2] || PM[k].name}</span>`)
const srcLine = (k, held) => (k === 'outside' ? 'Money you already had · your budget is untouched' : k.startsWith('pk:') ? `Moves from ${POCKET[k.slice(3)][1]} · stays inside your savings` : k === held ? `Set aside in ${SRC_ACCTS[0][2]} · nothing moves, net worth stays the same` : `Moves from ${SRC_ACCTS.find((a) => a[0] === k)?.[2]} · counts toward this month’s savings`)
function ltSourcePicker(S, on, done, o = {}) {
  const pick = (k, mark, t, s, extra = '') => `<button type="button" data-src="${k}" role="radio" aria-checked="${k === on}" class="flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-start">${mark}<span class="min-w-0 flex-1"><span class="flex items-center gap-2"><span class="truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${t}</span>${extra}</span><span class="block truncate text-xs ${MUTED}">${s}</span></span>${tick(k === on, false)}</button>`
  const pockets = POCKETS.map(([h, l]) => [h, l.filter((p) => p[0] !== o.target)]).filter(([, l]) => l.length)
  const body = `<div class="mx-4 overflow-hidden ${CARDBOX}">${pick('outside', `<span aria-hidden="true" class="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--color-brand-elevated)] ${SECOND}">${ICON('arrow-left-right', 'size-5')}</span>`, 'Outside buddget', 'Money you already had. Your budget is untouched.')}</div>
    ${sectionHead('Your accounts').replace('pt-1', 'pt-4')}<div class="mx-4 divide-y divide-[var(--color-brand-border)] overflow-hidden ${CARDBOX}">${SRC_ACCTS.map(([k, free, name]) => pick(k, brand(k, 40), name, `${free} · counts toward this month’s savings`, k === o.held ? badge('brand', 'Kept here') : '')).join('')}</div>
    ${o.pockets === false ? '' : `${sectionHead('Another pocket').replace('pt-1', 'pt-4')}<div class="mx-4 divide-y divide-[var(--color-brand-border)] overflow-hidden ${CARDBOX}">${pockets.flatMap(([, l]) => l).map((p) => pick(`pk:${p[0]}`, pocketMark(p, 40), p[1], `${p[4]}${p[5] ? ` ${p[5]}` : ''} · stays inside your savings`)).join('')}</div>`}
    <p class="mx-5 mt-3 text-xs ${MUTED}">${o.pockets === false ? 'An account you pick sets the money aside there, up to its free money.' : 'An account can give up to its free money. A pocket kept in an account adds from that account first.'}</p>`
  const sh = ltSheet(S, 'Where is the money from?', '', body, '', 220)
  sh.el.addEventListener('click', (e) => { const b = e.target.closest('[data-src]'); if (b) { sh.close(); done(b.dataset.src) } })
}
const srcRow = (S, c, held, target, line) => ({ k: 'From', v: srcV(held), src: held, fn: (S2, r, redraw) => ltSourcePicker(S, r.src, (k) => { r.src = k; r.v = srcV(k); c.src = k; redraw() }, { held, target }) })
AFTER.deposit = (S) => {
  const c = { title: 'Into CIB savings certificate', iconHTML: pocketMark(POCKET.cert, 52), sign: '+', amt: '5,000', cur: 'EGP', day: 28, time: '12:00', src: 'cib', cta: 'Add money', done: 'Money added' }
  c.line = (v) => `96,940 → ${f0(96940 + v)} · ${srcLine(c.src, 'cib')}`
  c.rows = [{ k: 'Into', v: pocketV('cert'), fn: (S2, r, redraw) => ltPocketPicker(S, r.pk || 'cert', (k) => { r.pk = k; r.v = pocketV(k); c.title = `Into ${POCKET[k][1]}`; c.iconHTML = pocketMark(POCKET[k], 52); redraw() }) }, srcRow(S, c, 'cib', 'cert')]
  ltTx(S, c)
}
AFTER.goal = (S) => {
  const c = { title: 'Umrah 2027', iconHTML: pocketMark(POCKET.umrah, 52), sign: '+', amt: '2,000', cur: 'EGP', day: 28, time: '12:00', src: 'nbe', note: false, cta: 'Add to goal', done: 'Added to Umrah 2027' }
  c.line = (v) => `${f0(Math.max(0, 48000 - 18000 - v))} left to reach 48,000 · ${srcLine(c.src, 'none')}`
  c.rows = [{ k: 'Goal', v: pocketV('umrah'), fn: (S2, r, redraw) => ltPocketPicker(S, r.pk || 'umrah', (k) => { r.pk = k; r.v = pocketV(k); c.title = POCKET[k][1]; c.iconHTML = pocketMark(POCKET[k], 52); redraw() }, ['Goals']) }, { ...srcRow(S, c, 'nbe', 'umrah'), v: srcV('nbe'), src: 'nbe' }]
  ltTx(S, c)
}

/* ---------- month + year picker (Finish line) ---------- */
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const monV = (m) => `${MON[m.m]} ${m.y}`
function ltMonthPicker(S, title, sel, done) {
  const d = { ...sel }
  const body = () => `<div class="flex flex-col items-center pb-4"><p class="font-mono-numbers text-[2.5rem] font-semibold leading-none tracking-[-0.04em] text-[var(--color-brand-text-primary)]">${monV(d)}</p><p class="mt-2 text-[0.8125rem] ${SECOND}">${(d.y - 2026) * 12 + d.m - 9} months from now</p></div><div class="mx-4 flex gap-2">${[2026, 2027, 2028, 2029].map((y) => `<button type="button" data-yy="${y}" class="${OPT_BASE} ${y === d.y ? OPT_ON : OPT_OFF} flex-1 justify-center font-mono-numbers">${y}</button>`).join('')}</div><div class="mx-4 mt-3 grid grid-cols-4 gap-2 ${CARDBOX} p-2">${MON.map((m, i) => { const past = d.y === 2026 && i < 10; return `<button type="button" data-mm="${i}" ${past ? 'disabled' : ''} class="flex h-11 items-center justify-center rounded-xl text-[0.9375rem] font-medium ${i === d.m ? 'bg-[var(--color-brand-primary)] font-semibold text-[var(--color-brand-on-primary)]' : past ? MUTED + ' opacity-50' : 'text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-elevated)]'}">${m}</button>` }).join('')}</div>`
  const sh = ltSheet(S, title, '', body(), btn('primary', 'block', 'Done', 'data-dd'), 220)
  sh.el.addEventListener('click', (e) => {
    const y = e.target.closest('[data-yy]'); if (y) { d.y = +y.dataset.yy; if (d.y === 2026 && d.m < 10) d.m = 10; sh.body.innerHTML = body(); return }
    const m = e.target.closest('[data-mm]'); if (m) { d.m = +m.dataset.mm; sh.body.innerHTML = body(); return }
    if (e.target.closest('[data-dd]')) { sh.close(); done(d) }
  })
}
/* ---------- how a goal gets money each month ---------- */
const FUND = [['share', 'A share of what I save', 'Buddgy moves it on payday', ['piggy-bank', ...IC.teal]], ['fixed', 'A fixed amount', 'The same amount every month', ['repeat', ...IC.green]], ['self', 'I’ll add money myself', 'No monthly plan, Buddgy reminds you', ['user', 'var(--color-brand-elevated)', 'var(--color-brand-text-secondary)']]]
const fundV = (st) => (st.each === 'share' ? `${st.pct}% of savings` : st.each === 'fixed' ? `${st.fixed} a month` : 'I add it myself')
function pickFund(S, st, draw) {
  ltOptPicker(S, 'Each month', 'How this goal gets its money', FUND, st.each, (k) => {
    st.each = k
    if (k === 'share') return ltNumPicker(S, 'Share of savings', st.pct, [10, 15, 20, 25, 30, 40, 50, 75], () => '%', (n) => { st.pct = n; draw() })
    if (k === 'fixed') return ltNumPicker(S, 'Each month', 2, [1, 2, 3, 4, 5, 6, 8, 10], (n) => `thousand ${n > 1 ? '' : ''}EGP`, (n) => { st.fixed = f0(n * 1000); draw() })
    draw()
  })
}

/* ---------- goal detail: same look, its rows now use the shared pickers ---------- */
AFTER.s_goal = (S) => {
  const MS = [[25, 'Mar 26', true], [50, 'Jul 26', false], [75, 'Nov 26', false], [100, 'Mar 27', false]]
  form4(S, {
    title: 'Trip to Dahab', sub: `Save for · Travel ${badge('positive', 'On track')}`, head: H_DEL(), del: ['Delete Trip to Dahab?', 'Its 15,000 stays in your savings, no longer set for this goal. This can’t be undone.'],
    state: { fin: { m: 2, y: 2027 }, each: 'share', pct: 20, fixed: '2,000', pk: 'trip' },
    body: (st) => `<div class="px-5"><div class="flex items-baseline justify-between"><p><span class="font-mono-numbers text-[40px] font-semibold tracking-[-0.04em] text-[var(--color-brand-text-primary)]">15,000</span> <span class="text-sm ${MUTED}">of 50,000</span></p><b class="font-mono-numbers text-[var(--color-brand-text-primary)]">30%</b></div>
    <div class="relative mt-3 h-2.5 rounded-full bg-[var(--color-brand-sunken)]"><div class="h-full w-[30%] rounded-full bg-[var(--color-brand-primary)]"></div>${MS.slice(0, 3).map(([p, , done]) => `<span aria-hidden="true" class="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--color-brand-card)] ${done ? 'bg-[var(--color-brand-primary)]' : 'bg-[var(--color-brand-border-strong)]'}" style="left:${p}%"></span>`).join('')}</div>
    <div class="mt-3 grid grid-cols-4 gap-2 text-center">${MS.map(([p, d, done]) => `<div class="rounded-xl py-2 ${done ? 'bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)]' : 'bg-[var(--color-brand-elevated)]'}"><b class="flex items-center justify-center gap-1 font-mono-numbers text-sm ${done ? '' : 'text-[var(--color-brand-text-primary)]'}">${done ? ICON('check', 'size-3.5') : ''}${p}%</b><span class="text-[0.6875rem] ${done ? 'font-semibold' : MUTED}">${done ? 'Reached' : d}</span></div>`).join('')}</div>
    <p class="mt-3 text-sm ${SECOND}">Next checkpoint: 50% in about 4 months.</p>
    ${bCard(`<b class="block text-sm text-[var(--color-brand-text-primary)]">Behind for 2 months</b><p class="text-xs ${SECOND}">1,500 short of plan since Aug. Two ways back:</p><div class="mt-2 flex items-center justify-between text-sm text-[var(--color-brand-text-primary)]">Move the date to Jun 2027 ${btn('outline', 'sm', 'Move date', 'data-toast="Date moved to Jun 2027"')}</div><div class="mt-2 flex items-center justify-between text-sm text-[var(--color-brand-text-primary)]">Keep Mar 2027 ${btn('outline', 'sm', 'Raise', 'data-toast="Each month raised to 2,400"')}</div>`)}</div>
    ${grp4([pick4('Finish line', monV(st.fin), 'fin', 'calendar'), pick4('Each month', fundV(st), 'each', 'repeat'), row4('Pocket', pocketV(st.pk), 'pk')], '', 'The pocket holds the money in Wealth. Moving the goal to another pocket keeps every amount where it is.')}`,
    foot: () => foot4('Add money'), done: 'Opens Add money',
    on: { fin: (v, draw, st) => finPick(S, st, draw), each: (v, draw, st) => pickFund(S, st, draw), pk: (v, draw, st) => ltPocketPicker(S, st.pk, (k) => { st.pk = k; draw() }) },
  })
}

/* ---------- emergency fund: arrows kept, the number is typeable ---------- */
AFTER.s_ef = (S) => {
  const MONTH = 12000
  const covered = 16800
  const step = (n) => `<div class="flex min-h-[56px] items-center gap-3 px-4"><span class="min-w-0 flex-1 text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]">Months to cover</span><span class="flex items-center gap-1"><button type="button" data-v="dec" aria-label="One month less" class="flex size-11 items-center justify-center rounded-full border border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)]">${ICON('minus', 'size-4')}</button><input data-in="m" inputmode="numeric" maxlength="2" aria-label="Months to cover" value="${n}" class="h-11 w-12 rounded-xl bg-[var(--color-brand-elevated)] text-center font-mono-numbers text-[1.0625rem] font-semibold text-[var(--color-brand-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-brand-focus)]"><button type="button" data-v="inc" aria-label="One month more" class="flex size-11 items-center justify-center rounded-full border border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)]">${ICON('plus', 'size-4')}</button></span></div>`
  form4(S, {
    title: 'Emergency fund', sub: 'Months you could live on a simple version of your life', state: { m: '3' },
    body: (st) => { const m = Math.max(1, +st.m || 1); const tgt = MONTH * m; return `${heroAmt((covered / MONTH).toFixed(1), `of ${m} months`, `${f0(covered)} covered · <span data-togo>${f0(Math.max(0, tgt - covered))}</span> to go`, ['shield-check', 'var(--color-brand-primary-soft)', 'var(--color-brand-primary-ink)'])}${barLine(Math.min(100, (covered / tgt) * 100))}${grp4([step(st.m), row4('A simple month', '<span class="font-mono-numbers">12,000</span>', 'month'), `<div class="flex min-h-[52px] items-center px-4"><span class="flex-1 text-[0.84375rem] ${SECOND}">Target</span><span data-tgt class="font-mono-numbers text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${f0(tgt)}</span></div>`], 'Your fund', 'Tap the number to type it, or use − and +. Kept out of every goal; covered by your savings pockets.')}` },
    foot: () => foot4('Add money'), done: 'Opens Add money',
    onInput: (f, st, s) => { if (f.dataset.in !== 'm') return; f.value = f.value.replace(/\D/g, '').slice(0, 2); st.m = f.value; const m = Math.max(1, +f.value || 1); s.el.querySelector('[data-tgt]').textContent = f0(MONTH * m) },
    on: { dec: (v, draw, st) => { st.m = String(Math.max(1, (+st.m || 1) - 1)); draw() }, inc: (v, draw, st) => { st.m = String(Math.min(24, (+st.m || 0) + 1)); draw() }, month: () => toast(S, 'Opens what counts: rent, food, transport, bills, debt minimums') },
  })
}

/* ---------- Flow hero: Spent, the bar is the budget, per day stays ---------- */
function pageM(st) {
  const T = totals(st)
  const note = `<span class="flex gap-4"><span class="inline-flex items-center gap-1">${ICON('arrow-down', 'size-3.5')}<b class="font-mono-numbers font-semibold text-[var(--flow-band-fg)]">+${f0(T.inn)}</b> in</span><span class="inline-flex items-center gap-1">${ICON('arrow-up', 'size-3.5')}<b class="font-mono-numbers font-semibold text-[var(--flow-band-fg)]">${MINUS}${f0(T.out)}</b> out</span></span>`
  const band = bandHTML(st, { contained: true, cells: false, note, pb: 'pb-4' }).replace('Left to spend · October', 'Spent · October').replace(`>${f2(T.left)}</span>`, `>${f2(T.out)}</span>`).replace(`<span>spent ${f0(T.out)}</span>`, `<span>${f0(T.left)} left</span>`)
  return `${stickyHTML(st)}<div class="mx-4 mt-4">${band}</div><div class="mx-4 mt-4 flex items-center gap-2">${segHTML(st, ['All', 'In', 'Out'], 'min-w-0 flex-1')}${filterBtn(st)}</div>${resultsHTML(st, 'mx-4 mt-2 flex flex-col gap-1')}${pendingHTML(st, 'mx-4 mt-4')}${ledgerM(st)}`
}

/* ---------- Debts: today's tabs without All; payments are Flow rows with swipe to delete ---------- */
{
  const v4 = PAGES.debts
  const oldPay = list('Payments', [{ pm: 'cib', title: 'Car loan · October', sub: 'Oct 5 · CIB Debit ••1234', n: -3250 }, { icon: 'smartphone', tone: TONE.teal, title: 'valU · October', sub: 'Oct 12 · CIB Debit ••1234', n: -1400 }], true)
  const payRow = (id, lead, title, sub, amt, first) => `${first ? '' : '<div class="ms-[68px] h-px bg-[var(--color-brand-border)]"></div>'}<div class="relative"><div class="relative overflow-hidden"><div class="absolute inset-0" style="visibility:hidden" data-panels><div class="absolute inset-y-0 end-0 flex" style="width:112px"><button type="button" aria-label="Delete" data-del="${id}" class="flex w-full flex-col items-center justify-center gap-0.5 bg-[var(--color-brand-red)] text-[var(--color-brand-on-red)]">${ICON('trash-2', 'h-5 w-5')}<span class="text-[0.625rem] font-semibold">Delete</span></button></div></div><div class="relative pz-layer" data-layer="${id}" style="background:var(--color-brand-card)"><button type="button" data-open="${id}" class="flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-start hover:bg-[var(--color-brand-elevated)]">${lead}<span class="min-w-0 flex-1"><span class="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${title}</span><span class="mt-1.5 block truncate font-mono-numbers text-xs font-medium ${MUTED}">${sub}</span></span><span class="shrink-0 font-mono-numbers text-[0.9375rem] font-medium tabular-nums text-[var(--color-brand-text-primary)]">${MINUS}${amt}</span></button></div></div></div>`
  const newPay = `<div class="mx-5 mb-2 mt-6 flex items-baseline justify-between"><span class="text-[0.6875rem] font-bold uppercase tracking-[0.08em] ${MUTED}">Payments</span><span class="text-[0.6875rem] ${MUTED}">Swipe left to delete</span></div><div class="mx-4 overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] shadow-[var(--shadow-sm)]">${payRow('dp1', brand('cib', 40), 'Car loan · October', 'Oct 5 · CIB Debit ••1234', '3,250', true)}${payRow('dp2', `<span aria-hidden="true" class="flex size-10 shrink-0 items-center justify-center rounded-[11px]" style="background:${TONE.teal[0]};color:${TONE.teal[1]}">${ICON('smartphone', 'size-5')}</span>`, 'valU · October', 'Oct 12 · CIB Debit ••1234', '1,400')}</div>`
  PAGES.debts = (st, L) => { const h = v4(st, L); return L ? h.replace(oldPay, newPay) : h }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-open^="dp"], [data-del^="dp"]'); if (!b) return
    const S = Object.values(screens).find((x) => x.vp.contains(b)); if (!S) return
    e.stopPropagation()
    if (S.suppressClick) return
    if (b.dataset.del) { closeOpen(S); b.closest('.relative').parentElement.remove(); return toast(S, 'Payment deleted. What you owe goes back up') }
    if (S.st.open) return closeOpen(S)
    AFTER.debtpay(S)
  }, true)
}

/* ---------- Goals page and Add goal ---------- */
const GOALS = [['umrah', 'Umrah 2027', 18000, 48000, 'Mar 2027', '2,000 a month', 'positive', 'On track'], ['trip', 'Trip to Dahab', 12000, 50000, 'Mar 2027', '20% of savings', 'warning', 'Behind'], ['car', 'New car', 64000, 400000, 'Dec 2029', '6,000 a month', 'positive', 'On track'], ['laptop', 'New laptop', 21000, 60000, 'Jun 2027', 'I add it myself', 'muted', 'No plan']]
PAGE_TITLE.goals = 'Goals'
PAGES.goals = (st, L) => {
  const saved = GOALS.reduce((s, g) => s + g[2], 0)
  const want = GOALS.reduce((s, g) => s + g[3], 0)
  const hero = heroBand({ label: 'Saved for goals', big: f0(saved), n: saved, right: [`${Math.round((saved / want) * 100)}% there`, `of ${f0(want)} in all`], bar: { pct: (saved / want) * 100, scale: [`of ${f0(want)} for ${GOALS.length} goals`, ''] }, cells: [['Each month', '≈ 12,000'], ['Next finish', 'Mar 2027'], ['Achieved', '1']], lnote: noteLine(`${B('≈ 12,000')} a month`, `Next finish ${B('Mar 2027')}`) }, L)
  if (!L) return hero + tabs(['All', 'Active', 'Paused'], L) + `<div class="mx-4 mt-3">${btn('primary', 'block', '+ New goal', 'data-toast="Opens the new goal steps"')}</div>` + list('Goals', GOALS.map(([k, t, s, w, d, e]) => ({ icon: POCKET[k][2], tone: POCKET[k][3], title: t, sub: `${d} · ${e}`, n: s, of: f0(w), sign: false, bar: (s / w) * 100, tap: `Opens ${t}` })), L)
  const card = ([k, t, s, w, d, e, tone, lab]) => { const p = Math.round((s / w) * 100); return `<button type="button" data-open4="s_goal" class="block w-full rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4 text-start shadow-[var(--shadow-sm)]"><span class="flex items-center gap-3">${pocketMark(POCKET[k], 40)}<span class="min-w-0 flex-1"><span class="flex items-center gap-2"><span class="truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${t}</span>${badge(tone, lab)}</span><span class="mt-0.5 block truncate text-xs ${MUTED}">${e} · by ${d}</span></span><b class="font-mono-numbers text-sm text-[var(--color-brand-text-primary)]">${p}%</b></span><span class="relative mt-3 block h-2 rounded-full bg-[var(--color-brand-sunken)]"><span class="block h-full rounded-full bg-[var(--color-brand-primary)]" style="width:${p}%"></span>${[25, 50, 75].map((m) => `<span aria-hidden="true" class="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--color-brand-card)] ${p >= m ? 'bg-[var(--color-brand-primary)]' : 'bg-[var(--color-brand-border-strong)]'}" style="left:${m}%"></span>`).join('')}</span><span class="mt-2 flex justify-between font-mono-numbers text-xs ${SECOND}"><span><b class="font-semibold text-[var(--color-brand-text-primary)]">${f0(s)}</b> saved</span><span>${f0(w - s)} to go</span></span></button>` }
  return hero + `<div class="mx-5 mb-2 mt-6 flex items-center"><span class="text-[0.8125rem] font-bold text-[var(--color-brand-text-primary)]">Goals</span><span class="ms-2 font-mono-numbers text-[0.8125rem] font-semibold ${MUTED}">${GOALS.length}</span><button type="button" data-open4="addgoal" class="ms-auto inline-flex h-11 items-center gap-1 px-1 text-[0.875rem] font-semibold text-[var(--color-brand-primary-ink)]">${ICON('plus', 'size-4')}New goal</button></div><div class="mx-4 flex flex-col gap-2">${GOALS.map(card).join('')}</div><button type="button" data-toast="Opens achieved goals" class="mx-4 mt-3 flex min-h-12 w-[calc(100%-2rem)] items-center gap-2.5 rounded-[14px] border border-dashed border-[var(--color-brand-border-strong)] px-4 text-start text-[0.8125rem] font-semibold ${SECOND}">${ICON('trophy', 'size-4')}<span class="flex-1">1 goal achieved · Wedding gift, 15,000</span>${CHEV}</button><div class="h-6"></div>`
}
LT_NOTES.goals = 'Goals in the new look: one hero for all goals, a card per goal with its milestone marks (the same bar as the goal sheet), a quiet New goal, and achieved goals behind a link. Tap a card for the goal sheet.'
const GCATS = [['travel', 'Travel', 'plane', IC.teal], ['car', 'Car', 'car', ['var(--cat-transport-bg)', 'var(--cat-transport-fg)']], ['home', 'Home', 'house', ['var(--cat-rent-bg)', 'var(--cat-rent-fg)']], ['umrah', 'Hajj & Umrah', 'moon-star', IC.amber], ['study', 'Education', 'graduation-cap', IC.green], ['gadget', 'Gadget', 'smartphone', IC.green], ['other', 'Other', 'target', ['var(--color-brand-elevated)', 'var(--color-brand-text-secondary)']]]
AFTER.addgoal = (S) => form4(S, {
  title: 'New goal', z: 130, state: { cat: 'travel', name: 'Trip to Dahab', amt: '50,000', cur: 'EGP', fin: { m: 2, y: 2027 }, each: 'share', pct: 20, fixed: '2,000', saved: '', src: 'cib' },
  body: (st) => { const c = GCATS.find((x) => x[0] === st.cat); const months = Math.max(1, (st.fin.y - 2026) * 12 + st.fin.m - 9); return `<div class="hide-scrollbar flex gap-2 overflow-x-auto px-4 pb-1">${GCATS.map(([k, l, ic]) => `<button type="button" data-v="set:cat:${k}" class="${OPT_BASE} ${k === st.cat ? OPT_ON : OPT_OFF} shrink-0">${ICON(ic, 'size-4')}${l}</button>`).join('')}</div>${hero4({ amt: st.amt, ctl: ctl4('cur', st.cur), top: `<div class="mt-2">${TILE52(c[2], c[3])}</div>`, label: 'Target', line: `≈ ${f0(num4(st.amt) / months)} a month to finish by ${monV(st.fin)}` })}<div class="mx-4 -mt-1 mb-1 flex justify-center"><button type="button" data-toast="Opens typical costs from Buddgy" class="inline-flex h-11 items-center gap-1.5 px-2 text-[0.8125rem] font-semibold text-[var(--color-brand-primary-ink)]">${ICON('sparkles', 'size-4')}Not sure? Ask Buddgy for typical costs</button></div>
    ${grp4([in4('name', 'Name', 'e.g. Trip to Dahab', st.name), pick4('Finish line', monV(st.fin), 'fin', 'calendar'), pick4('Each month', fundV(st), 'each', 'repeat')])}
    ${grp4([in4('saved', 'Already saved', '0', st.saved, 'decimal'), row4('Where is it?', srcV(st.src), 'src')], 'Money you already have', st.src === 'outside' ? 'Counted as new money, on top of your accounts.' : `Set aside in ${SRC_ACCTS.find((a) => a[0] === st.src)[2]}. Your net worth doesn’t change.`)}
    <p class="mx-5 mt-3 text-xs ${MUTED}">Buddgy makes a “${esc(st.name || 'Goal')}” pocket in Wealth to hold this goal’s money.</p>` },
  foot: () => foot4('Create goal'), done: 'Goal created',
  on: { fin: (v, draw, st) => finPick(S, st, draw), each: (v, draw, st) => pickFund(S, st, draw), src: (v, draw, st) => ltSourcePicker(S, st.src, (k) => { st.src = k; draw() }, { pockets: false }) },
})
BEFORE.addgoal = (S) => bOpen(S, 'Make it real', 'Step 2 of 3', `${bLabel('Name')}${bInput('', 'Trip to Dahab')}${bLabel('Target Date')}<div class="flex items-center justify-between rounded-xl border border-[var(--color-brand-border)] px-2 py-1">${btn('outline', 'sm', '−')}<b class="text-sm">Mar 2027</b>${btn('outline', 'sm', '+')}</div>${bLabel('Target Amount')}${bAmount('50,000', 'EGP')}<p class="mt-2 text-sm font-semibold text-[var(--color-brand-primary-ink)]">Not sure? Ask Buddgy for typical costs</p>${bLabel('Save')}${bSeg(['Every month', 'Every quarter'])}${bLabel('Already saved')}${bAmount('0', 'EGP')}`, `<button type="button" data-done class="${BTN.primary} ${SZ.block}">Next</button>`)

/* ---------- Insights: the numbers, drawn ---------- */
{
  const base = PAGES.insights
  const CATS5 = [['Rent', 7000, 0], ['Food', 3680, 18], ['Groceries', 2140, -6], ['Utilities', 1320, 4], ['Transport', 980, -12], ['Shopping', 1133, 31]]
  const COL = { Rent: 'var(--color-brand-primary)', Food: 'var(--color-brand-amber)', Groceries: 'var(--color-brand-green)', Utilities: 'var(--cat-utilities-fg)', Transport: 'var(--cat-transport-fg)', Shopping: 'var(--cat-shopping-fg)' }
  const total = CATS5.reduce((s, c) => s + c[1], 0)
  const tip = (t) => `data-tip="${esc(t)}"`
  /* donut: 2px surface gaps between arcs, identity carried by the legend rows next to it */
  const donut = () => { const r = 46, C = 2 * Math.PI * r; let off = 0; return `<svg viewBox="0 0 120 120" class="size-[132px] shrink-0 -rotate-90" role="img" aria-label="Spending by category">${CATS5.map(([n, v]) => { const len = (v / total) * C; const seg = `<circle cx="60" cy="60" r="${r}" fill="none" stroke="${COL[n]}" stroke-width="14" stroke-dasharray="${Math.max(0, len - 2)} ${C}" stroke-dashoffset="${-off}" ${tip(`${n} · ${f0(v)} EGP · ${Math.round((v / total) * 100)}%`)} class="cursor-pointer"></circle>`; off += len; return seg }).join('')}</svg>` }
  /* cumulative spend vs the plan line, today marked, the rest projected */
  const pace = () => {
    const W = 320, H = 132, days = 31, today = 19, plan = 24500
    const act = Array.from({ length: today + 1 }, (_, d) => (d === 0 ? 0 : 16253 * Math.pow(d / today, 1.08)))
    const x = (d) => 8 + (d / days) * (W - 16), y = (v) => H - 18 - (v / 27000) * (H - 30)
    const path = act.map((v, d) => `${d ? 'L' : 'M'}${x(d).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
    const proj = `M${x(today)} ${y(16253)} L${x(days)} ${y(26520)}`
    const cols = Array.from({ length: days }, (_, i) => { const d = i + 1; const v = d <= today ? act[d] : 16253 + (d - today) * 855; return `<rect x="${x(d) - 5}" y="0" width="10" height="${H}" fill="transparent" data-cx="${x(d).toFixed(1)}" ${tip(`Oct ${d} · ${d <= today ? 'spent' : 'at this pace'} ${f0(v)} · plan ${f0((plan * d) / days)}`)}></rect>` }).join('')
    return `<svg viewBox="0 0 ${W} ${H}" class="mt-3 w-full" role="img" aria-label="Spending so far against the plan" data-xhair><line x1="8" x2="${W - 8}" y1="${y(0)}" y2="${y(0)}" stroke="var(--color-brand-border)" stroke-width="1"/><line x1="8" x2="${W - 8}" y1="${y(plan)}" y2="${y(plan)}" stroke="var(--color-brand-border-strong)" stroke-width="1" stroke-dasharray="3 3"/><text x="${W - 8}" y="${y(plan) - 5}" text-anchor="end" font-size="10" fill="var(--color-brand-text-muted)">Budget 24,500</text><path d="M${x(0)} ${y(0)} L${x(days)} ${y(plan)}" fill="none" stroke="var(--color-brand-text-muted)" stroke-width="1.5" stroke-dasharray="4 4"/><path d="${path} L${x(today)} ${y(0)} L${x(0)} ${y(0)} Z" fill="var(--color-brand-primary)" opacity=".1"/><path d="${path}" fill="none" stroke="var(--color-brand-primary)" stroke-width="2" stroke-linejoin="round"/><path d="${proj}" fill="none" stroke="var(--color-brand-amber)" stroke-width="2" stroke-dasharray="2 4" stroke-linecap="round"/><circle cx="${x(today)}" cy="${y(16253)}" r="4.5" fill="var(--color-brand-primary)" stroke="var(--color-brand-card)" stroke-width="2"/><text x="8" y="${H - 3}" font-size="10" fill="var(--color-brand-text-muted)">Oct 1</text><text x="${x(today)}" y="${H - 3}" text-anchor="middle" font-size="10" font-weight="600" fill="var(--color-brand-text-secondary)">Today</text><text x="${W - 8}" y="${H - 3}" text-anchor="end" font-size="10" fill="var(--color-brand-text-muted)">Oct 31</text><line data-xl x1="0" x2="0" y1="6" y2="${y(0)}" stroke="var(--color-brand-text-muted)" stroke-width="1" opacity="0"/>${cols}</svg>`
  }
  const MONTHS = [['May', 21900], ['Jun', 23100], ['Jul', 26800], ['Aug', 22400], ['Sep', 23880], ['Oct', 16253]]
  const bars = () => `<div class="relative mt-4 flex h-[128px] items-end gap-3 border-b border-[var(--color-brand-border)] px-1"><span aria-hidden="true" class="absolute inset-x-0 border-t border-dashed border-[var(--color-brand-border-strong)]" style="bottom:${(24500 / 28000) * 100}%"></span>${MONTHS.map(([m, v], i) => `<span class="flex h-full flex-1 flex-col items-center justify-end" ${tip(`${m} · ${f0(v)} spent${i === 5 ? ' so far' : v > 24500 ? ' · over budget' : ''}`)}><span class="block w-full max-w-7 rounded-t-[4px] ${i === 5 ? 'bg-[var(--color-brand-primary)]' : v > 24500 ? 'bg-[var(--color-brand-amber)]' : 'bg-[color-mix(in_oklab,var(--color-brand-primary)_45%,var(--color-brand-card))]'}" style="height:${(v / 28000) * 100}%"></span></span>`).join('')}</div><div class="mt-1.5 flex gap-3 px-1">${MONTHS.map(([m]) => `<span class="flex-1 text-center text-[0.6875rem] font-semibold ${MUTED}">${m}</span>`).join('')}</div>`
  const WD = [['Sat', 620], ['Sun', 540], ['Mon', 480], ['Tue', 510], ['Wed', 690], ['Thu', 1240], ['Fri', 980]]
  const week = () => `<div class="mt-3 flex h-14 items-end gap-1.5">${WD.map(([d, v]) => `<span class="flex h-full flex-1 flex-col justify-end" ${tip(`${d} · ${f0(v)} on average`)}><span class="block rounded-t-[3px] ${d === 'Thu' ? 'bg-[var(--color-brand-primary)]' : 'bg-[var(--color-brand-sunken)]'}" style="height:${(v / 1240) * 100}%"></span></span>`).join('')}</div><div class="mt-1 flex gap-1.5">${WD.map(([d]) => `<span class="flex-1 text-center text-[0.625rem] font-semibold ${MUTED}">${d[0]}</span>`).join('')}</div>`
  const nw = () => { const pts = [96200, 97100, 98900, 99400, 101500, 103907]; const x = (i) => 4 + i * 26, y = (v) => 44 - ((v - 95000) / 10000) * 38; const p = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i)} ${y(v).toFixed(1)}`).join(' '); return `<svg viewBox="0 0 138 48" class="mt-2 h-12 w-full" role="img" aria-label="Net worth, last 6 months"><path d="${p} L${x(5)} 48 L${x(0)} 48 Z" fill="var(--color-brand-green)" opacity=".12"/><path d="${p}" fill="none" stroke="var(--color-brand-green)" stroke-width="2" stroke-linejoin="round"/><circle cx="${x(5)}" cy="${y(103907)}" r="3.5" fill="var(--color-brand-green)"/></svg>` }
  const delta = (d) => (d ? `<span class="inline-flex items-center gap-0.5 font-mono-numbers text-xs font-semibold ${d > 0 ? 'text-[var(--color-brand-amber)]' : 'text-[var(--color-brand-green)]'}">${ICON(d > 0 ? 'trending-up' : 'trending-down', 'size-3.5')}${Math.abs(d)}%</span>` : `<span class="text-xs ${MUTED}">same</span>`)
  window.INS5 = { donut, pace, bars, week, nw, delta, CATS5, COL, total, tip, base }
  PAGES.insights = (st, L) => {
    if (!L) return base(st, L)
    return heroBand({ label: 'You can spend', big: '687', n: 687, unit: 'EGP a day', contained: true, lnote: noteLine(`${B('16,253')} spent so far`, `Lasts to ${B('Nov 8')}`) }, L)
      + `<div class="mx-4 mt-3 rounded-2xl p-[1.5px]" style="background:linear-gradient(120deg, var(--color-brand-primary), color-mix(in oklab, var(--color-brand-primary) 30%, var(--color-brand-amber)))"><div class="rounded-[15px] bg-[var(--color-brand-card)] p-4"><p class="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-[var(--color-brand-primary-ink)]">${ICON('sparkles', 'size-4')}Buddgy’s read on October</p><p class="mt-2 text-[0.9375rem] leading-relaxed text-[var(--color-brand-text-primary)]">You’re spending <b>855 a day</b>, a bit above plan, so the month ends about <b>2,000 over</b>. Most of it is food delivery: 6 Talabat orders this week. Skip two and you land on budget.</p><div class="mt-3 flex flex-wrap gap-2"><button type="button" data-toast="Opens Buddgy with this question" class="${OPT_BASE} ${OPT_OFF}">Why is food up?</button><button type="button" data-toast="Opens Buddgy with this question" class="${OPT_BASE} ${OPT_OFF}">Make me a plan</button></div></div></div>`
      + `<section class="${CARD5}"><div class="flex items-start justify-between gap-3">${H5('Spending pace')}<span class="text-end"><b class="block font-mono-numbers text-[0.9375rem] text-[var(--color-brand-text-primary)]">≈ 26,520</b><span class="text-xs ${MUTED}">by Oct 31 at this pace</span></span></div><div class="mt-2 flex gap-4 text-xs ${SECOND}"><span class="inline-flex items-center gap-1.5"><span class="h-0.5 w-4 rounded bg-[var(--color-brand-primary)]"></span>You</span><span class="inline-flex items-center gap-1.5"><span class="h-0 w-4 border-t-2 border-dashed border-[var(--color-brand-text-muted)]"></span>Plan</span><span class="inline-flex items-center gap-1.5"><span class="h-0 w-4 border-t-2 border-dotted border-[var(--color-brand-amber)]"></span>Where it’s heading</span></div>${pace()}</section>`
      + `<section class="${CARD5}"><div class="flex items-baseline justify-between">${H5('Where it went')}<span class="text-xs ${MUTED}">vs September</span></div><div class="mt-3 flex items-center gap-4"><div class="relative">${donut()}<span class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><b class="font-mono-numbers text-[1.0625rem] text-[var(--color-brand-text-primary)]">${f0(total)}</b><span class="text-[0.6875rem] ${MUTED}">EGP spent</span></span></div><ul class="min-w-0 flex-1 space-y-1.5">${CATS5.map(([n, v, d]) => `<li class="flex items-center gap-2 text-[0.8125rem]"><span aria-hidden="true" class="size-2.5 shrink-0 rounded-full" style="background:${COL[n]}"></span><span class="min-w-0 flex-1 truncate text-[var(--color-brand-text-primary)]">${n}</span><span class="font-mono-numbers ${SECOND}">${Math.round((v / total) * 100)}%</span></li>`).join('')}</ul></div><div class="mt-4 divide-y divide-[var(--color-brand-border)] border-t border-[var(--color-brand-border)]">${CATS5.map(([n, v, d]) => `<button type="button" data-toast="Opens ${n} in Flow" class="flex min-h-12 w-full items-center gap-3 text-start"><span aria-hidden="true" class="flex size-8 shrink-0 items-center justify-center rounded-[10px]" style="background:var(--cat-${CAT[n].v}-bg);color:var(--cat-${CAT[n].v}-fg)">${ICON(CAT[n].icon, 'size-4')}</span><span class="min-w-0 flex-1 truncate text-[0.875rem] font-medium text-[var(--color-brand-text-primary)]">${n}</span>${delta(d)}<span class="w-16 text-end font-mono-numbers text-[0.875rem] font-medium text-[var(--color-brand-text-primary)]">${f0(v)}</span></button>`).join('')}</div></section>`
      + `<section class="${CARD5}"><div class="flex items-baseline justify-between">${H5('Month by month')}<span class="text-xs ${MUTED}">dashed line = budget</span></div>${bars()}<p class="mt-3 text-[0.8125rem] ${SECOND}">July went over by 2,300. Since then you’ve stayed under, saving <b class="font-mono-numbers text-[var(--color-brand-text-primary)]">18%</b> of income on average.</p></section>`
      + `<div class="mx-4 mt-3 grid grid-cols-2 gap-3"><section class="${CARDBOX} p-4"><p class="text-xs font-semibold ${SECOND}">Your big day</p><p class="mt-1 text-[0.9375rem] font-bold text-[var(--color-brand-text-primary)]">Thursday</p><p class="font-mono-numbers text-xs ${MUTED}">1,240 on average</p>${week()}</section><section class="${CARDBOX} p-4"><p class="text-xs font-semibold ${SECOND}">Net worth</p><p class="mt-1 font-mono-numbers text-[0.9375rem] font-bold text-[var(--color-brand-text-primary)]">103,907</p><p class="inline-flex items-center gap-1 font-mono-numbers text-xs font-semibold text-[var(--color-brand-green)]">${ICON('trending-up', 'size-3.5')}2.4% this month</p>${nw()}</section></div>`
      + list('What changed', [{ icon: 'trending-up', tone: TONE.amber, title: 'Food is up 18% on September', sub: 'Mostly Talabat, 6 orders · 1,060 more', tap: 'Opens the insight' }, { icon: 'receipt', tone: TONE.teal, title: '38 small buys added up to 2,140', sub: 'Coffee and snacks under 100 each', tap: 'Opens the insight' }, { icon: 'repeat', tone: TONE.teal, title: 'Subscriptions cost 2,062 a month', sub: '24,744 a year · Netflix is charged in USD', tap: 'Opens the insight' }, { icon: 'piggy-bank', tone: TONE.green, title: 'You saved 18% of income', sub: 'Above your 15% plan', tap: 'Opens the insight' }], L)
      + `<section class="${CARD5}">${H5('September in one look')}<div class="mt-3 grid grid-cols-3 gap-2 text-center">${[['Spent', '23,880', -4], ['Saved', '18%', 0], ['Biggest buy', 'IKEA 3,400', 0]].map(([l, v, d]) => `<div class="rounded-xl bg-[var(--color-brand-elevated)] px-2 py-2.5"><p class="text-[0.6875rem] font-semibold ${MUTED}">${l}</p><p class="mt-0.5 truncate font-mono-numbers text-[0.875rem] font-semibold text-[var(--color-brand-text-primary)]">${v}</p>${d ? `<p class="mt-0.5">${delta(d)}</p>` : ''}</div>`).join('')}</div></section><div class="h-6"></div>`
  }
  LT_NOTES.insights = 'Insights redrawn: the same hero, Buddgy’s read in plain words with two questions to ask, a pace chart (you, the plan, where it’s heading), where the money went with a donut and change vs last month, month-by-month bars against the budget, your big spending day, net worth trend, what changed, and last month in one look. Hover or tap a chart for the numbers.'
  /* chart tooltips: one floating label, a crosshair on the pace chart */
  const tipEl = document.createElement('div')
  tipEl.className = 'pointer-events-none fixed z-[999] rounded-lg bg-[var(--color-brand-text-primary)] px-2.5 py-1.5 text-xs font-semibold text-[var(--color-brand-card)] shadow-lg'
  tipEl.style.display = 'none'
  document.body.appendChild(tipEl)
  document.addEventListener('pointermove', (e) => {
    const t = e.target.closest?.('[data-tip]')
    const svg = e.target.closest?.('[data-xhair]')
    if (svg) { const xl = svg.querySelector('[data-xl]'); const cx = t?.dataset.cx; xl.setAttribute('x1', cx || 0); xl.setAttribute('x2', cx || 0); xl.setAttribute('opacity', cx ? 1 : 0) }
    if (!t) { tipEl.style.display = 'none'; return }
    tipEl.textContent = t.dataset.tip; tipEl.style.display = 'block'
    tipEl.style.left = `${Math.min(e.clientX + 12, innerWidth - tipEl.offsetWidth - 8)}px`; tipEl.style.top = `${e.clientY - 36}px`
  })
}

/* ---------- untracked Cash: a dimmed row on Accounts (council) ---------- */
STATES.cashoff = (L) => {
  const h = PAGES.accounts({ prov: null, page: 'accounts' }, L)
  const row = `<div class="flex min-h-[72px] w-full items-center gap-3.5 px-4 py-3"><span class="opacity-50">${CASHMARK()}</span><span class="min-w-0 flex-1"><span class="block truncate text-base font-semibold tracking-[-0.01em] ${SECOND}">Cash on hand</span><span class="mt-0.5 block truncate text-[0.8125rem] ${MUTED}">Not tracked</span></span><button type="button" data-open4="cashhand" class="${OPT_BASE} ${OPT_OFF} shrink-0 !text-[var(--color-brand-primary-ink)]">Start tracking</button></div>`
  return h.replace(/<button type="button" data-acct="cash"[\s\S]*?<\/button>/, row)
}

/* ---------- bar buttons for this round ---------- */
{
  document.querySelector('[data-page="insights"]').insertAdjacentHTML('afterend', '<button type="button" data-page="goals" aria-pressed="false">Goals</button>')
  document.querySelector('[data-sheet="s_goal"]').insertAdjacentHTML('afterend', '<button type="button" data-sheet="addgoal">Add goal</button>')
  document.querySelector('[data-state=""]').insertAdjacentHTML('beforebegin', '<button type="button" data-state="cashoff">Cash not tracked</button>')
}

/* ---------- account sheet: cards right after the SMS box, currency tappable, default as a switch, short CTA pair ---------- */
function ltAcctSheet(S, id) {
  const a = acctData(id)
  let v = fa(a.bal)
  let cur = a.cur
  let def = !a.cash
  const cards = a.cash ? [] : ['cib', 'cibcc', 'usd', 'nbe', 'qnb']
  const el = document.createElement('div')
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', a.name)
  el.className = PANEL
  const sh = openSheet(S, el)
  const draw = () => {
    const diff = Math.round((num4(v) - a.bal) * 100) / 100
    const dirty = diff || cur !== a.cur
    const line = dirty
      ? `<span class="font-semibold text-[var(--color-brand-amber)]"><s class="font-normal ${MUTED}">${fa(a.bal)} ${a.cur}</s> → ${fa(num4(v))} ${cur}${diff ? ` · ${diff > 0 ? '+' : MINUS}${fa(Math.abs(diff))}` : ''}</span><span class="block text-xs ${MUTED}">Saved as a correction, never as spending</span>`
      : a.cash ? 'Tap the amount when you count your cash' : 'Tap the amount or the currency to correct it'
    const cardRow = a.cash ? '' : `<div class="mx-5 mb-1 mt-4 flex items-center justify-between"><span class="text-[0.6875rem] font-bold uppercase tracking-[0.08em] ${MUTED}">Cards · ${cards.length}</span><button type="button" data-a="allcards" class="h-11 px-1 text-[0.8125rem] font-semibold text-[var(--color-brand-primary-ink)]">See all</button></div><div class="relative"><div class="hide-scrollbar flex snap-x gap-2 overflow-x-auto scroll-px-5 px-5 py-1">${cards.map((k) => `<button type="button" data-ck="${k}" class="snap-start">${mini(k)}</button>`).join('')}<button type="button" data-a="addcard" aria-label="Add a card" class="flex h-14 w-[88px] shrink-0 snap-start items-center justify-center rounded-[7px] border-[1.5px] border-dashed border-[var(--color-brand-border-strong)] ${MUTED}">${ICON('plus', 'size-5')}</button></div><span aria-hidden="true" class="pointer-events-none absolute inset-y-0 end-0 w-8" style="background:linear-gradient(to left, var(--color-brand-card), transparent)"></span></div>`
    el.innerHTML = `${GRAB}<div class="flex shrink-0 items-center gap-3 px-4 pb-1">${a.cash ? CASHMARK(36) : brand('cib', 36)}<span class="min-w-0 flex-1"><span class="block truncate text-base font-bold text-[var(--color-brand-text-primary)]">${a.name}</span><span class="block truncate text-xs ${SECOND}">${a.sub}</span></span><button type="button" data-a="menu" aria-label="More actions" class="${CLOSE_BTN}">${ICON('ellipsis-vertical', 'size-4')}</button><button type="button" data-a="close" aria-label="Close sheet" class="${CLOSE_BTN}">${ICON('x', 'size-4')}</button></div>
    <div class="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pb-5">
      <div class="flex flex-col items-center px-5 pb-4 pt-4 text-center"><p class="text-[0.8125rem] font-medium ${SECOND}">${a.cash ? 'Cash, an estimate' : 'Balance'}</p><div class="mt-1.5 flex items-baseline justify-center gap-1.5"><label class="flex items-baseline font-mono-numbers text-[2.5rem] font-semibold leading-none tracking-[-0.04em] tabular-nums text-[var(--color-brand-text-primary)]"><input data-bal inputmode="decimal" aria-label="Balance" value="${esc(v)}" class="bg-transparent text-center outline-none" style="width:2ch"></label>${ctl4('cur', cur).replace('data-v="cur"', 'data-a="cur"')}</div><p class="mt-2 text-[0.8125rem] ${SECOND}">${line}</p>${a.aside ? `<div class="mt-4 w-full"><div class="h-1.5 rounded-full bg-[var(--color-brand-sunken)]"><div class="h-full rounded-full bg-[var(--color-brand-primary)]" style="width:88%"></div></div><div class="mt-2 flex justify-between text-xs ${SECOND}"><span><b class="font-mono-numbers font-semibold text-[var(--color-brand-text-primary)]">${f0(a.free)}</b> free</span><span><b class="font-mono-numbers font-semibold text-[var(--color-brand-text-primary)]">${f0(a.aside)}</b> set aside</span></div></div>` : ''}</div>
      <div class="mx-4 grid ${a.cash ? 'grid-cols-1' : 'grid-cols-3'} gap-2">${[['banknote', 'Cash out', 'cashout'], ['landmark', 'Set aside', 'aside'], ['wallet', 'Add card', 'addcard']].filter((x, j) => !a.cash || j === 1).map(([ic, l, k]) => `<button type="button" data-a="${k}" class="${BTN_CORE} h-11 gap-1.5 rounded-full border-[var(--color-brand-border)] bg-[var(--color-brand-card)] text-[0.84375rem] font-semibold text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-elevated)]">${ICON(ic, 'size-4')}${l}</button>`).join('')}</div>
      ${a.cash ? '' : `<div class="mx-4 mt-3 flex items-center gap-3 rounded-2xl bg-[var(--color-brand-elevated)] px-3.5 py-3"><span class="size-2 shrink-0 rounded-full bg-[var(--color-brand-green)]"></span><span class="min-w-0 flex-1"><span class="block text-sm font-semibold text-[var(--color-brand-text-primary)]">Matches your bank's last SMS</span><span class="block text-xs ${MUTED}">from 18:42 · SMS said <span class="font-mono-numbers">${fa(a.bal)}</span></span></span></div>`}
      ${cardRow}
      <div class="mx-4 mt-3 grid grid-cols-2 divide-x divide-[var(--color-brand-border)] rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)]"><div class="px-3.5 py-3"><p class="text-xs font-semibold ${SECOND}">In this month</p><p class="font-mono-numbers text-base font-semibold text-[var(--color-brand-green)]">+31,500</p></div><div class="px-3.5 py-3"><p class="text-xs font-semibold ${SECOND}">Out this month</p><p class="font-mono-numbers text-base font-semibold text-[var(--color-brand-text-primary)]">${MINUS}8,230</p></div></div>
      ${a.cash ? '' : `<div class="mx-4 mt-3 overflow-hidden ${CARDBOX}">${sw4('def', 'Default for new expenses', 'Picked first when you add an expense, and used for a bank message that matches no account', def).replace('data-v="sw:def"', 'data-a="def"')}</div>`}
      ${sectionHead('Recent').replace('pt-1', 'pt-5')}<div class="mx-4 overflow-hidden ${CARDBOX}">${miniTx(RECENT_TX)}</div>
    </div>${dirty ? `<div class="shrink-0 border-t border-[var(--color-brand-border)] px-4 pb-[22px] pt-3"><div class="grid grid-cols-2 gap-2">${btn('outline', 'block', 'Cancel', 'data-a="cancel"')}<button type="button" data-a="setbal" class="${BTN.primary} ${SZ.block}">Set balance</button></div></div>` : ''}`
    const i = el.querySelector('[data-bal]'); i.style.width = '0px'; i.style.width = `${Math.max(i.scrollWidth + 2, 28)}px`
  }
  draw()
  el.addEventListener('input', (e) => { if (!e.target.matches('[data-bal]')) return; v = e.target.value; const pos = e.target.selectionStart; draw(); const i = el.querySelector('[data-bal]'); i.focus(); i.setSelectionRange(pos, pos) })
  el.addEventListener('click', (e) => {
    const ck = e.target.closest('[data-ck]'); if (ck) return ltCardSheet(S, ck.dataset.ck)
    const b = e.target.closest('[data-a]'); if (!b) return
    const k = b.dataset.a
    if (k === 'close') return sh.attempt()
    if (k === 'menu') return toast(S, 'Edit name and Close account live here')
    if (k === 'cur') return ltCurrency(S, cur, (c) => { cur = c; draw() })
    if (k === 'def') { def = !def; draw(); return toast(S, def ? 'Default for new expenses' : 'No longer the default') }
    if (k === 'allcards') return toast(S, `Opens all ${cards.length} cards as a list`)
    if (k === 'cashout') return AFTER.cashout(S)
    if (k === 'aside') return AFTER.setaside(S)
    if (k === 'addcard') return ltAddCard(S, 'Debit')
    if (k === 'cancel') { v = fa(a.bal); cur = a.cur; return draw() }
    if (k === 'setbal') { sh.close(); toast(S, `Balance set to ${fa(num4(v))} ${cur}`) }
  })
}

LT_NOTES.debts = 'Kept as it was: today’s Borrowed / Installments / Cards tabs (no All), a quiet Add on Active (borrow, installment or credit card), Payments as Flow rows you can swipe left to delete, and a link to cleared debts.'
LT_NOTES.flow += ' Round 5: the hero now says Spent, with the bar as the budget filling up; the per-day figure until the end of the month stays.'

/* ---------- New badges: only what this round changed ---------- */
{
  const NEW5 = ['flow', 'accounts', 'debts', 'insights', 'goals', 'sub', 's_subadd', 's_subcancel', 'deposit', 'goal', 'account', 'card', 'addaccount', 'addcard', 's_line', 's_payday', 's_goal', 's_ef', 'addgoal', 'cashoff']
  document.querySelectorAll('[data-sheet], [data-page], [data-state]').forEach((b) => { if (NEW5.includes(b.dataset.sheet || b.dataset.page || b.dataset.state)) b.insertAdjacentHTML('beforeend', '<span class="pz-new">New</span>') })
}
