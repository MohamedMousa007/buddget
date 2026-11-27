/* ================= round 8: Income (was Paydays), Assign, weekly streak card ================= */
{
  /* ---------- sample data ---------- */
  const TX6 = { id: 't6', d: 26, time: '11:02', dir: 'in', title: 'ACME LLC', type: 'One-time', m: 'cib', amt: 4000, unlinked: true }
  const tx6 = (st) => st.tx.find((x) => x.id === 't6') || TX6
  const freeIn = (st) => !tx6(st).unlinked && tx6(st).type === 'Freelance'
  const SRC = {
    salary: { name: 'Salary', who: 'Nexta payroll', icon: 'briefcase', pm: 'payroll', freq: 'Monthly on the 25th', cad: 'Monthly · 25th', amt: 31500, day: 25, next: 'Nov 25', in: 'in 28 days' },
    free: { name: 'Freelance', who: 'ACME LLC', icon: 'laptop', pm: 'cib', freq: 'Irregular', cad: 'Irregular · about monthly', amt: 4000, irr: true },
    rent: { name: 'Rent', who: 'Flat in Nasr City', icon: 'building-2', pm: 'nbe', freq: 'Monthly on the 30th', cad: 'Monthly · 30th', amt: 6500, day: 30, next: 'Oct 30', in: 'in 2 days' },
    mom: { name: 'Family', who: 'From Mom', icon: 'gift', pm: 'cash', freq: 'Monthly on the 27th', cad: 'Monthly · 27th', amt: 2000, day: 27, next: 'Nov 27', in: 'in 30 days' },
  }
  const MONTHS = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']
  /* the state of one source this month: [tone, text] */
  const status = (st, id) => {
    if (id === 'free') return freeIn(st) ? ['ok', 'Received'] : ['wait', 'Nothing in yet']
    if (id === 'mom') return st.i8momOk ? ['ok', 'Received'] : ['due', 'Due Oct 27']
    if (id === 'rent') return ['soon', 'Due Oct 30']
    return ['ok', 'Received']
  }
  const timeline = (st, id) => {
    if (id === 'free') return [...['ok', 'none', 'ok', 'ok', 'none'].map((k, i) => [MONTHS[i], k]), ['Oct', freeIn(st) ? 'ok' : 'open']]
    if (id === 'mom') return [...MONTHS.slice(0, 5).map((m) => [m, 'ok']), ['Oct', st.i8momOk ? 'ok' : 'due'], ['Nov', 'next']]
    if (id === 'rent') return [...MONTHS.slice(0, 5).map((m) => [m, 'ok']), ['Oct', 'next']]
    return [...MONTHS.map((m) => [m, 'ok']), ['Nov', 'next']]
  }
  const HIST = {
    salary: [['October', 'Oct 25 · on time', 31500], ['September', 'Sep 25 · on time', 31500], ['August', 'Aug 25 · on time', 31500]],
    free: [['August', 'Aug 18', 3500], ['July', 'Jul 9', 5200], ['May', 'May 21', 4000]],
    rent: [['September', 'Sep 30 · on time', 6500], ['August', 'Aug 30 · on time', 6500], ['July', 'Jul 31 · 1 day after the payday', 6500]],
    mom: [['September', 'Sep 27 · on time', 2000], ['August', 'Aug 27 · on time', 2000], ['July', 'Jul 28 · 1 day after the payday', 2000]],
  }

  /* ---------- small pieces ---------- */
  const TINT = 'background:linear-gradient(120deg, var(--flow-band-a) 0%, var(--flow-band-b) 100%)'
  const tile = (ic, tone, size = 9) => `<span aria-hidden="true" class="flex size-${size} shrink-0 items-center justify-center rounded-[10px]" style="background:${tone[0]};color:${tone[1]}">${ic}</span>`
  /* source mark: the account it lands in, with the income type in the corner (like AMARK's alert dot) */
  const srcMark = (s, size = 44) => `<span class="relative inline-flex shrink-0">${brand(s.pm, size)}<span aria-hidden="true" class="absolute -bottom-1 -end-1 flex size-[20px] items-center justify-center rounded-full border-2 border-[var(--color-brand-card)] bg-[var(--color-brand-green-soft)] text-[var(--color-brand-green)]">${srcIcon(s.icon, 'size-3')}</span></span>`
  const srcIcon = (ic, cls) => ({ briefcase: ICON('briefcase', cls), laptop: ICON('laptop', cls), 'building-2': ICON('building-2', cls), gift: ICON('gift', cls), wallet: ICON('wallet', cls) })[ic]
  const statusLine = ([tone, text]) => tone === 'ok'
    ? `<span class="inline-flex items-center gap-1 whitespace-nowrap text-[0.75rem] font-semibold text-[var(--color-brand-green)]">${ICON('check', 'size-3.5')}${text}</span>`
    : tone === 'due'
      ? `<span class="inline-flex items-center gap-1 whitespace-nowrap text-[0.75rem] font-semibold text-[var(--color-brand-primary-ink)]">${ICON('calendar-check', 'size-3.5')}${text}</span>`
      : `<span class="block whitespace-nowrap text-[0.75rem] font-medium ${MUTED}">${text}</span>`

  /* ---------- Income page ---------- */
  const srcRow = (st, id) => {
    const s = SRC[id]
    const amt = `<span class="shrink-0 whitespace-nowrap font-mono-numbers text-base font-semibold tracking-[-0.02em] text-[var(--color-brand-text-primary)]">${s.irr ? '≈ ' : ''}${f0(s.amt)} <span class="text-[0.71875rem] font-normal ${MUTED}">EGP</span></span>`
    return `<button type="button" data-i8src="${id}" class="block w-full rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-4 py-3.5 text-start transition-[border-color,transform] duration-150 ease-out active:scale-[0.99]"><span class="flex items-center gap-3">${srcMark(s)}<span class="min-w-0 flex-1 ps-0.5"><span class="flex items-baseline justify-between gap-2"><span class="truncate text-base font-bold text-[var(--color-brand-text-primary)]">${s.name}</span>${amt}</span><span class="mt-1 flex items-center justify-between gap-2"><span class="truncate text-xs ${MUTED}">${s.irr ? 'Irregular · no fixed day' : status(st, id)[0] === 'ok' ? `${s.cad.split(' · ')[0]} · next ${id === 'mom' ? 'Nov 27' : s.next}` : s.cad}</span>${statusLine(status(st, id))}</span></span>${ICON('chevron-right', `size-4 shrink-0 ${MUTED}`)}</span></button>`
  }
  const asgRow = (st, wrap = 'mx-4 mt-3') => (tx6(st).unlinked ? `<div class="${wrap}"><button type="button" data-i8asgopen class="${CARD_ROW}">${tile(ICON('link', 'size-[18px]'), ['var(--color-brand-primary-soft)', 'var(--color-brand-primary-ink)'])}<span class="min-w-0 flex-1"><span class="block text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">Assign 4,000 from ACME LLC</span><span class="block text-xs ${SECOND}">Arrived Oct 26 · not part of a payday yet</span></span>${ICON('chevron-right', `size-4 shrink-0 ${SECOND}`)}</button></div>` : '')
  const incomeHome = (st) => {
    const exp = 44000
    const got = 31500 + (freeIn(st) ? 4000 : 0) + (st.i8momOk ? 2000 : 0)
    const n = 1 + (freeIn(st) ? 1 : 0) + (st.i8momOk ? 1 : 0)
    const hero = heroBand({ label: 'Income · October', big: fit8(got), n: got, unit: 'EGP received', right: [f0(exp), 'expected'], bar: { pct: (got / exp) * 100, lscale: [`${n} of 4 sources in`, got < exp ? `${f0(exp - got)} to come` : 'All in'] }, lnote: noteLine(`Next ${B('Rent')} on Oct 30`, tx6(st).unlinked ? `Plus ${B('4,000')} one-time` : `${B('Salary')} on Nov 25`) }, true)
    const head = secHead('Sources', 4, 'Add income', true).replace('data-toast="Opens add income"', 'data-i8add')
    return `${hero}${asgRow(st)}<div class="px-4 pb-6 pt-5"><section>${head}<div class="flex flex-col gap-2.5">${Object.keys(SRC).map((id) => srcRow(st, id)).join('')}</div><p class="mt-2.5 px-1 text-xs leading-[1.45] ${MUTED}">Irregular income has no fixed day, so it is never marked late.</p></section></div>`
  }

  /* ---------- Income source detail page ---------- */
  const cell = ([m, k]) => {
    const dot = {
      ok: `<span class="flex size-7 items-center justify-center rounded-full bg-[var(--flow-band-fg)]" style="color:var(--flow-band-b)">${ICON('check', 'size-4')}</span>`,
      none: `<span class="flex size-7 items-center justify-center rounded-full border border-[var(--flow-band-mix)] text-[var(--flow-band-fg-2)]">${ICON('minus', 'size-3.5')}</span>`,
      due: `<span class="flex size-7 items-center justify-center rounded-full border-2 border-[var(--flow-band-fg)]"><span class="size-2 rounded-full bg-[var(--flow-band-fg)]"></span></span>`,
      open: `<span class="flex size-7 items-center justify-center rounded-full border-2 border-dashed border-[var(--flow-band-fg)]"></span>`,
      next: `<span class="flex size-7 items-center justify-center rounded-full border-2 border-dashed border-[var(--flow-band-mix)]"></span>`,
    }[k]
    const lbl = { ok: m, none: m, due: 'Due', open: m, next: m }[k]
    return `<span class="flex flex-col items-center gap-1">${dot}<span class="text-[0.65625rem] font-semibold ${k === 'due' ? 'text-[var(--flow-band-fg)]' : 'text-[var(--flow-band-fg-2)]'}">${lbl}</span></span>`
  }
  const dueCard = (st, id) => {
    const s = SRC[id]
    if (id === 'mom' && !st.i8momOk) return `<div class="mx-4 mt-3 ${CARDBOX} p-4"><div class="flex items-center gap-3">${tile(ICON('calendar-check', 'size-[18px]'), ['var(--color-brand-primary-soft)', 'var(--color-brand-primary-ink)'])}<span class="min-w-0 flex-1"><span class="block text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">October payday · due Oct 27</span><span class="block text-xs ${SECOND}">Cash has no bank message, so tell buddget when it arrives</span></span></div><div class="mt-3">${btn('primary', 'block', 'Confirm received', 'data-i8confirm')}</div></div>`
    if (id === 'free' && tx6(st).unlinked) return `<div class="mx-4 mt-3 ${CARDBOX} p-4"><div class="flex items-center gap-3">${tile(ICON('link', 'size-[18px]'), ['var(--color-brand-primary-soft)', 'var(--color-brand-primary-ink)'])}<span class="min-w-0 flex-1"><span class="block text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">October · nothing assigned yet</span><span class="block text-xs ${SECOND}">4,000 from ACME LLC arrived Oct 26. Is it this one?</span></span></div><div class="mt-3">${btn('primary', 'block', 'Assign 4,000 here', 'data-i8asgopen')}</div></div>`
    const line = s.irr ? (freeIn(st) ? 'October is in · no fixed day for the next one' : 'No fixed day · expected about once a month') : `Next payday ${s.next} · ${s.in}`
    return `<div class="mx-4 mt-3 flex min-h-[56px] items-center gap-3 ${CARDBOX} px-4 py-3">${tile(ICON('calendar', 'size-[18px]'), ['var(--color-brand-elevated)', 'var(--color-brand-text-secondary)'])}<span class="text-[0.875rem] font-medium text-[var(--color-brand-text-primary)]">${line}</span></div>`
  }
  const sourceView = (st, id) => {
    const s = SRC[id]
    const back = `<button type="button" data-i8back class="-ms-2 mb-1 inline-flex h-11 items-center gap-1 px-2 text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${ICON('chevron-left', 'size-5')}Income</button>`
    const hero = `<section class="overflow-hidden rounded-3xl px-[18px] pb-4 pt-3 text-[var(--flow-band-fg)]" style="${TINT}"><div class="flex items-center gap-3">${brand(s.pm, 40)}<span class="min-w-0 flex-1"><span class="block truncate text-[1.0625rem] font-bold">${s.name} · ${s.who}</span><span class="block truncate text-[0.78125rem] text-[var(--flow-band-fg-2)]">${s.freq} → ${PM[s.pm].name}</span></span><button type="button" data-i8menu aria-label="More actions" class="-me-2 flex size-11 shrink-0 items-center justify-center rounded-full">${ICON('ellipsis', 'size-5')}</button></div><p class="mt-4 flex items-baseline gap-1.5"><span class="font-mono-numbers text-[32px] font-semibold leading-[34.5px] tracking-[-0.03em]">${s.irr ? '≈ ' : ''}${f0(s.amt)}</span><span class="text-[0.8125rem] text-[var(--flow-band-fg-2)]">EGP ${s.irr ? 'a month on average' : 'each month'}</span></p><div class="mt-4 flex items-start justify-between">${timeline(st, id).map(cell).join('')}</div>${s.irr ? `<p class="mt-3 text-xs text-[var(--flow-band-fg-2)]">A dash is a month with nothing in. Irregular income is never late.</p>` : `<p class="mt-3 text-xs text-[var(--flow-band-fg-2)]">On time <b class="font-mono-numbers text-[var(--flow-band-fg)]">${id === 'salary' ? '6 of 6' : '4 of 5'}</b> · ${id === 'salary' ? 'last 6 months' : 'last 5 paydays'}</p>`}</section>`
    const det = `<div class="mx-4 mt-5">${sectionHead('Details').replace('px-5', 'px-1')}<div class="${LISTCARD}">${row4('Amount', `<span class="font-mono-numbers">${s.irr ? 'About ' : ''}${f0(s.amt)} EGP</span>`)}${row4('How often', s.freq)}${row4('Paid into', pmV(s.pm))}</div></div>`
    const rows = HIST[id].map(([m, sub, n]) => ({ pm: s.pm, title: `${s.name} · ${m}`, sub, n, tap: 'Opens this payday in Flow' }))
    if (id === 'free' && freeIn(st)) rows.unshift({ pm: 'cib', title: 'Freelance · October', sub: 'Oct 26 · ACME LLC', n: 4000, tap: 'Opens this payday in Flow' })
    if (id === 'mom' && st.i8momOk) rows.unshift({ pm: 'cash', title: 'Family · October', sub: 'Oct 27 · on time', n: 2000, tap: 'Opens this payday in Flow' })
    return `<div class="mx-4 mt-2">${back}${hero}</div>${dueCard(st, id)}${det}${list('History', rows, true)}<div class="h-6"></div>`
  }
  P8.paydays = (st) => {
    const S = Object.values(screens).find((x) => x.st === st)
    const h = S && S.el.querySelector('header h1'); if (h) h.textContent = 'Income'
    return st.i8src ? sourceView(st, st.i8src) : incomeHome(st)
  }

  /* ---------- sheets: income transaction, assign, add income, source menu, confirm ---------- */
  F8.incometx = (S, t = tx6(S.st)) => {
    if (!t.unlinked) return AFTER.income(S, t)
    const tip = `<div class="mx-4 mt-3 ${CARDBOX} p-4"><div class="flex gap-3">${tile(ICON('repeat', 'size-[18px]'), ['var(--color-brand-primary-soft)', 'var(--color-brand-primary-ink)'])}<div class="min-w-0 flex-1"><p class="text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">One-time, or part of a payday?</p><p class="mt-0.5 text-[0.8125rem] leading-relaxed ${SECOND}">Assign links this money to a payday that repeats, like a salary or a regular client, so buddget expects it next time. Leave it and it stays one-time.</p></div></div><button type="button" data-i8asg class="${BTN_SOFT} ${SZ.block} mt-3">${ICON('link', 'size-[18px]')}Assign to a payday</button></div>`
    ltTx(S, { title: t.title, icon: ['wallet', ...IC.green], sign: '+', amt: f0(t.amt), cur: 'EGP', day: t.d, time: t.time, del: true, delTitle: 'Delete this income?', delText: 'It leaves Flow and your account balance.', line: 'One-time money in · not in expected', rows: [{ k: 'Type', v: 'One-time' }, { k: 'Received in', pm: t.m }, { k: 'Payday', v: `<span class="${MUTED}">Not assigned</span>`, fn: () => F8.assign(S, t) }, { k: 'Recorded from', v: `<span class="inline-flex items-center gap-1.5">${ICON('message-square', `size-4 ${MUTED}`)}Bank SMS · CIB</span>`, static: true }], extra: tip, cta: 'Save changes', done: 'Changes saved' })
  }
  T8.incometx = (S) => AFTER.income(S, tx6(S.st))

  const ASG = [['free', 'Freelance · ACME LLC', 'October · about 4,000 · irregular', 'Best match', 'laptop'], ['salary', 'Salary · Nexta payroll', 'Nov 25 · 31,500 · 87% off', '', 'briefcase'], ['none', 'None: keep it as one-time income', 'It stays a row in Flow', '', 'wallet']]
  F8.assign = (S, t = tx6(S.st)) => {
    let pick = 'free'
    const body = () => `<div role="radiogroup" aria-label="Payday" class="mx-4 flex flex-col gap-3">${ASG.map(([k, ti, sub, b, ic]) => `<button type="button" role="radio" aria-checked="${k === pick}" data-i8p="${k}" class="${k === pick ? CARD_SEL : CARD_UNSEL}">${tile(srcIcon(ic, 'size-4'), ['var(--color-brand-green-soft)', 'var(--color-brand-green)'])}<span class="min-w-0 flex-1"><span class="block text-[0.90625rem] font-bold text-[var(--color-brand-text-primary)]">${ti}</span><span class="block text-[0.78125rem] ${SECOND}">${sub}</span></span>${b ? badge('brand', b) : ''}</button>`).join('')}<button type="button" data-i8new class="flex min-h-[60px] w-full items-center gap-3 rounded-2xl border-[1.5px] border-dashed border-[var(--color-brand-border-strong)] p-3.5 text-start hover:bg-[var(--color-brand-elevated)]">${tile(ICON('plus', 'size-[18px]'), ['var(--color-brand-elevated)', 'var(--color-brand-primary-ink)'])}<span class="min-w-0 flex-1"><span class="block text-[0.90625rem] font-bold text-[var(--color-brand-text-primary)]">Add a payday</span><span class="block text-[0.78125rem] ${SECOND}">Create a new income and assign this to it</span></span></button></div>`
    const foot = () => btn('primary', 'block', pick === 'none' ? 'Keep as one-time' : `Assign to ${pick === 'free' ? 'Freelance' : 'Salary'}`, 'data-i8go')
    const sub = `<b class="font-mono-numbers text-[var(--color-brand-text-primary)]">${f0(t.amt)}</b> EGP from ${esc(t.title)} arrived on <b>Oct ${t.d}</b>. Assigning keeps that date and links it to a payday.`
    const sh = ltSheet(S, 'Which payday is this?', sub, body(), foot(), 140)
    const apply = (type) => { S.vp.querySelectorAll('[data-layer-root] [data-a="close"]').forEach((b) => b.click()); t.unlinked = false; if (type) { t.recurring = true; t.type = type } render(S) }
    sh.el.addEventListener('click', (e) => {
      const p = e.target.closest('[data-i8p]')
      if (p) { pick = p.dataset.i8p; sh.body.innerHTML = body(); sh.el.querySelector('[data-foot]').innerHTML = foot(); return }
      if (e.target.closest('[data-i8go]')) { sh.close(); apply(pick === 'none' ? null : pick === 'free' ? 'Freelance' : 'Salary'); toast(S, pick === 'none' ? 'Kept as one-time income' : `Assigned to ${pick === 'free' ? 'Freelance · October' : 'Salary · Nov 25'}`) }
      if (e.target.closest('[data-i8new]')) addIncome(S, { what: 'free', amt: f0(t.amt), name: t.title, freq: 'i', pm: t.m }, { z: 180, title: 'New income', cta: 'Add and assign', done: `Freelance added · ${f0(t.amt)} assigned to it`, onDone: () => { sh.close(); apply('Freelance') } })
    })
  }
  T8.assign = (S) => openAssign(S, tx6(S.st))

  const WHAT = [['salary', 'Salary', 'briefcase'], ['free', 'Freelance', 'laptop'], ['rent', 'Rent', 'building-2'], ['other', 'Other', 'wallet']]
  const WD = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
  const DIM = { Oct: 31, Nov: 30, Dec: 31, Jan: 31 }
  const preview = (st) => {
    if (st.freq === 'i') return `<p class="text-[0.8125rem] leading-relaxed ${SECOND}">No fixed day. buddget counts it when it lands and never marks it late.</p>`
    const dates = st.freq === 'm'
      ? (st.day > 28 ? ['Oct', 'Nov', 'Dec'] : ['Nov', 'Dec', 'Jan']).map((m) => `${m} ${Math.min(st.day, DIM[m])}`)
      : (st.freq === 'w' ? ['Oct 29', 'Nov 5', 'Nov 12'] : ['Oct 29', 'Nov 12', 'Nov 26']).map((d) => `${st.wd.slice(0, 3)}, ${d}`)
    return `<div class="flex flex-wrap gap-2">${dates.map((d) => pill4(d, 'calendar')).join('')}</div><p class="mt-2.5 text-xs leading-relaxed ${MUTED}">buddget expects it on these days and tells you when it lands.</p>`
  }
  const addIncome = (S, seed = {}, o = {}) => {
    const sh = form4(S, {
      title: o.title || 'Add income', z: o.z || 120,
      state: Object.assign({ what: 'salary', amt: '', freq: 'm', day: 25, wd: 'Thursday', pm: 'payroll', name: '' }, seed),
      body: (st) => {
        const w = WHAT.find((x) => x[0] === st.what)
        const tiles = `<div class="mx-4 mt-1 grid grid-cols-4 gap-2" role="radiogroup" aria-label="What is it">${WHAT.map(([k, l, ic]) => `<button type="button" role="radio" aria-checked="${k === st.what}" data-v="set:what:${k}" class="flex min-h-[64px] flex-col items-center justify-center gap-1.5 rounded-2xl border text-[0.8125rem] font-semibold transition-colors ${k === st.what ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)]' : 'border-[var(--color-brand-border)] bg-[var(--color-brand-card)] text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)]'}">${srcIcon(ic, 'size-5')}${l}</button>`).join('')}</div>`
        const when = st.freq === 'i' ? null : st.freq === 'm' ? pick4('Payday', `${ORD(st.day)} of each month`, 'day', 'calendar') : pick4('Payday', `Every ${st.wd}`, 'wd', 'calendar')
        return `${tiles}${hero4({ amt: st.amt, ctl: unit4('EGP'), line: st.freq === 'i' ? 'About how much a month' : 'Each payday' })}${seg4('freq', [['m', 'Monthly'], ['b', 'Biweekly'], ['w', 'Weekly'], ['i', 'Irregular']], st.freq)}${grp4([in4('name', 'Name', `e.g. ${w[0] === 'rent' ? 'Flat in Nasr City' : w[0] === 'free' ? 'ACME LLC' : 'Nexta payroll'}`, st.name), when, row4('Into', pmV(st.pm), 'pm')])}${sectionHead(st.freq === 'i' ? 'How it works' : 'Next paydays').replace('pt-1', 'pt-5')}<div class="mx-4 ${CARDBOX} p-4">${preview(st)}</div>`
      },
      foot: () => foot4(o.cta || 'Add income'), done: o.done || 'Income added',
      on: {
        day: (v, draw, st) => ltDayPicker(S, 'Payday', st.day, (d) => { st.day = d; draw() }),
        wd: (v, draw, st) => ltOptPicker(S, 'Payday', '', WD.map((d) => [d, d]), st.wd, (d) => { st.wd = d; draw() }),
        pm: (v, draw, st) => ltMethodPicker(S, st.pm, (m) => { st.pm = m; draw() }),
      },
    })
    if (o.onDone) sh.el.addEventListener('click', (e) => { if (e.target.closest('[data-done]')) o.onDone() })
    return sh
  }
  F8.addincome = (S) => addIncome(S)
  T8.addincome = (S) => AFTER.s_payday(S)

  const confirmMom = (S) => {
    const sh = form4(S, {
      title: 'Family · October', sub: 'From Mom · due Oct 27', state: { amt: '2,000', date: 'Oct 27' },
      body: (st) => `${hero4({ amt: st.amt, ctl: unit4('EGP'), top: TILE52('gift', IC.green), line: 'Expected 2,000 · full amount' })}${grp4([row4('Received in', pmV('cash')), date4('Received on', st.date)])}`,
      foot: () => foot4('Mark received'), done: 'October marked received',
    })
    sh.el.addEventListener('click', (e) => { if (e.target.closest('[data-done]')) { S.st.i8momOk = true; if (!S.st.tx.some((x) => x.id === 'i8mom')) S.st.tx.push({ id: 'i8mom', d: 27, time: '18:00', dir: 'in', title: 'From Mom', type: 'Family', m: 'cash', amt: 2000, recurring: true }); render(S) } })
  }
  const sourceMenu = (S, id) => {
    const s = SRC[id]
    const item = (k, ic, l, red) => `<button type="button" data-i8m="${k}" class="flex min-h-[52px] w-full items-center gap-3 px-4 text-start hover:bg-[var(--color-brand-elevated)] ${red ? 'text-[var(--color-brand-red)]' : 'text-[var(--color-brand-text-primary)]'}">${ic}<span class="text-[0.9375rem] font-medium">${l}</span></button>`
    const sh = ltSheet(S, `${s.name} · ${s.who}`, s.freq, `<div class="mx-4 ${LISTCARD}">${item('edit', ICON('pencil', `size-[18px] ${SECOND}`), 'Edit income')}${item('log', ICON('plus', `size-[18px] ${SECOND}`), 'Log a past payday')}${item('del', ICON('trash-2', 'size-[18px]'), 'Delete income', true)}</div>`, '', 160)
    sh.el.addEventListener('click', (e) => {
      const m = e.target.closest('[data-i8m]'); if (!m) return
      sh.close()
      const k = m.dataset.i8m
      if (k === 'edit') return addIncome(S, { what: id === 'mom' ? 'other' : id, amt: f0(s.amt), name: s.who, freq: s.irr ? 'i' : 'm', day: s.day || 25, pm: s.pm }, { title: 'Edit income', cta: 'Save changes', done: 'Changes saved' })
      if (k === 'log') return toast(S, 'Opens a past payday to fill in')
      ltAlert(S, 'Delete this income?', 'Its past paydays stay in Flow as one-time income.', [['solidDanger', 'Delete', () => { S.st.i8src = null; render(S); toast(S, `${s.name} deleted`) }], ['ghost', 'Cancel']])
    })
  }
  F8.source = (S) => { if (S.st.page !== 'paydays') setPage('paydays'); S.st.i8src = 'mom'; S.scroll.scrollTop = 0; render(S) }
  T8.source = (S) => { if (S.st.page !== 'paydays') setPage('paydays') }

  /* ---------- weekly streak (rules from src/lib/loyalty/rules.ts) ---------- */
  const WEEK = {
    progress: { one: '<b class="font-mono-numbers">2 of 3</b> · keep week 5 for <b class="font-mono-numbers">+15</b> points', rec: 2, dots: ['kept', 'kept', 'kept', 'now'], line: 'Keep week 5 for <b class="font-mono-numbers">+15</b> points', sub: '<b class="font-mono-numbers">2 of 3</b> records this week', more: '1 more record to keep it' },
    ready: { one: '<b class="font-mono-numbers">3 of 3</b> · keep week 5 now for <b class="font-mono-numbers">+15</b>', rec: 3, dots: ['kept', 'kept', 'kept', 'ready'], line: 'Week 5 is ready · <b class="font-mono-numbers">+15</b> points', sub: '<b class="font-mono-numbers">3 of 3</b> records · tap to keep it', more: '' },
    missed: { one: 'Last week missed · restart for <b class="font-mono-numbers">+10</b>', rec: 1, dots: ['kept', 'kept', 'missed', 'now'], line: 'Start again · <b class="font-mono-numbers">+10</b> this week', sub: 'Last week was missed · <b class="font-mono-numbers">1 of 3</b> records', more: '2 more records to keep it' },
  }
  let gid = 0
  /* TierBadge.tsx: the tier hexagon, metal stops copied from tiers.ts (badge art) */
  const METAL = { silver: ['#f4f7f8', '#a9b3b7', '#ffffff', '#7f898d', '#e3e9eb'], emerald: ['#0b3d2c', '#39d79a', '#0f6a49', '#8ff3c9', '#0a3a2a'], diamond: ['#e6f8ff', '#8fd3ff', '#ffffff', '#b9a9ff', '#7cc8f0'], elite: ['#4f0510', '#d0142f', '#ffc2c7', '#a80d24', '#3a030b'], founder: ['#6b4f16', '#edc463', '#fff1c4', '#0f6a49', '#39d79a'] }
  const tierBadge = (k, size) => { const id = `i8tb${gid++}`; return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" class="shrink-0"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">${METAL[k].map((c, i) => `<stop offset="${i / 4}" stop-color="${c}"/>`).join('')}</linearGradient></defs><path d="M12 2.6l7.8 4.5v9.8L12 21.4 4.2 16.9V7.1z" fill="url(#${id})" stroke="rgba(0,0,0,.35)" stroke-width=".6"/><path d="M12 2.6l7.8 4.5L12 11.6 4.2 7.1z" fill="#fff" opacity=".18"/></svg>` }
  /* HotStreakCard.tsx flame */
  const flame = (cls = 'size-5') => { const id = `i8fl${gid++}`; return `<svg viewBox="0 0 24 24" aria-hidden="true" class="${cls}"><defs><linearGradient id="${id}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff8a2a"/><stop offset=".55" stop-color="#f5b13c"/><stop offset="1" stop-color="#f5d98a"/></linearGradient></defs><path fill="url(#${id})" d="M12 2c.6 3.2-1.4 4.9-2.8 6.6C7.7 10.4 6.5 12.1 6.5 14.5A5.5 5.5 0 0 0 12 20a5.5 5.5 0 0 0 5.5-5.5c0-2.3-1.1-3.7-2-4.8-.2 1.4-.9 2.5-2 3 .4-2.9-.3-6.6-1.5-10.7z"/></svg>` }
  const DOT = {
    kept: 'bg-[var(--color-brand-primary)]',
    ready: 'bg-[var(--color-brand-primary)] ring-2 ring-[var(--color-brand-primary-soft)]',
    now: 'border-2 border-dashed border-[var(--color-brand-primary)]',
    missed: 'border border-[var(--color-brand-border-strong)] bg-[var(--color-brand-sunken)]',
  }
  const dots = (w) => `<span role="img" aria-label="Last 4 weeks: ${w.dots.map((d) => (d === 'now' ? 'this week open' : d === 'ready' ? 'this week ready' : d)).join(', ')}" dir="ltr" class="inline-flex items-center gap-[5px]">${w.dots.map((d) => `<span class="size-2.5 rounded-full ${DOT[d]}"></span>`).join('')}</span>`
  const tierChip = `<span class="inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-[var(--color-brand-elevated)] pe-2 ps-1 text-[0.71875rem] font-semibold ${SECOND}">${tierBadge('silver', 16)}Silver · <span class="font-mono-numbers">120</span> to Emerald</span>`
  const ring = (rec) => { const r = 23, C = 2 * Math.PI * r; return `<span class="relative flex size-[58px] shrink-0 items-center justify-center" role="img" aria-label="${rec} of 3 records this week"><svg viewBox="0 0 58 58" class="absolute inset-0 -rotate-90"><circle cx="29" cy="29" r="${r}" fill="none" stroke="var(--color-brand-sunken)" stroke-width="5"/><circle cx="29" cy="29" r="${r}" fill="none" stroke="var(--color-brand-primary)" stroke-width="5" stroke-linecap="round" stroke-dasharray="${(C * rec) / 3} ${C}"/></svg><span class="font-mono-numbers text-[0.9375rem] font-bold text-[var(--color-brand-text-primary)]">${rec}<span class="${MUTED}">/3</span></span></span>` }
  const streakCard = (st) => {
    const w = WEEK[st.i8wk || 'progress']
    if ((st.i8opt || 'A') === 'A') return `<div class="mx-4 mt-4"><button type="button" data-i8streak class="${CARD_ROW}">${tile(flame('size-5'), ['var(--color-brand-amber-soft)', 'var(--color-brand-amber)'])}<span class="min-w-0 flex-1"><span class="block truncate text-[0.875rem] font-semibold text-[var(--color-brand-text-primary)]">${w.one}</span><span class="mt-1.5 flex items-center justify-between gap-2">${dots(w)}${tierChip}</span></span>${ICON('chevron-right', `size-4 shrink-0 ${SECOND}`)}</button></div>`
    return `<div class="mx-4 mt-4"><button type="button" data-i8streak class="block w-full rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4 text-start transition-colors hover:bg-[var(--color-brand-elevated)]"><span class="flex items-center gap-3.5">${ring(w.rec)}<span class="min-w-0 flex-1"><span class="flex items-center gap-1.5 text-[0.6875rem] font-bold uppercase tracking-[0.08em] ${MUTED}">${flame('size-3.5')}${st.i8wk === 'missed' ? 'Weekly streak · restarts' : 'Weekly streak · 4 weeks'}</span><span class="mt-1 block text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${w.line}</span><span class="mt-0.5 block text-xs ${SECOND}">${w.more || 'Tap to keep this week'}</span></span>${ICON('chevron-right', `size-4 shrink-0 ${SECOND}`)}</span><span class="mt-3 flex items-center justify-between gap-2 border-t border-[var(--color-brand-border)] pt-3">${dots(w)}${tierChip}</span></button></div>`
  }
  const switches = (st) => {
    const chip = (attr, v, on, l) => `<button type="button" ${attr}="${v}" aria-pressed="${on}" class="${OPT_BASE} ${on ? OPT_ON : OPT_OFF}">${l}</button>`
    const o = st.i8opt || 'A', k = st.i8wk || 'progress'
    return `<div class="mx-4 mt-3 rounded-2xl border border-dashed border-[var(--color-brand-border-strong)] p-2.5"><p class="mb-2 px-1 text-[0.6875rem] font-bold uppercase tracking-[0.08em] ${MUTED}">Mockup · streak card</p><div class="flex flex-wrap gap-1.5">${chip('data-i8opt', 'A', o === 'A', 'A · slim')}${chip('data-i8opt', 'B', o === 'B', 'B · ring')}</div><div class="mt-1.5 flex flex-wrap gap-1.5">${[['progress', 'In progress'], ['ready', 'Ready'], ['missed', 'Missed'], ['kept', 'Kept']].map(([v, l]) => chip('data-i8wk', v, k === v, l)).join('')}</div></div>`
  }
  P8.flow = (st, today) => {
    const tail = pendingHTML(st, 'mx-4 mt-4') + ledgerM(st)
    const card = st.i8wk === 'kept' ? '' : streakCard(st)
    const h = today.endsWith(tail) ? today.slice(0, -tail.length) + card + tail : today + card
    return switches(st) + h.replace(/From SMS · Link to payday/g, 'From SMS · swipe to assign').replace(/>Not linked</g, '>Not assigned<')
  }

  const EARN = [['1–3', '10', 'x1'], ['4–7', '15', 'x1.5'], ['8 on', '20', 'x2']]
  const LADDER = [['silver', 'Silver', 'Everyone starts here. Your card, badge and streak.', '0'], ['emerald', 'Emerald', 'A freeze every 4 kept weeks, and 10 Sparks when you arrive.', '300'], ['diamond', 'Diamond', 'With Pro, 20% more Sparks in every pack. 20 Sparks when you arrive.', '800'], ['elite', 'Elite', 'The crimson card and 30 Sparks.', '1,500'], ['founder', 'Elite Founder', 'Founders who reach Elite. The highest tier there is.', 'Founder']]
  F8.streak = (S) => {
    const k = S.st.i8wk === 'kept' ? 'ready' : S.st.i8wk || 'progress'
    const w = WEEK[k]
    const missed = k === 'missed'
    const seg = (s) => `<span class="h-2 flex-1 rounded-full ${s === 'kept' ? 'bg-[linear-gradient(90deg,var(--color-brand-primary-hover),var(--member-mint))]' : s === 'now' ? 'border-2 border-dashed border-white/85' : 'bg-[var(--member-cell)]'}"></span>`
    const strip = (missed ? ['empty', 'empty', 'now', 'empty', 'empty', 'empty', 'empty', 'empty'] : ['kept', 'kept', 'kept', 'kept', 'now', 'empty', 'empty', 'empty']).map(seg).join('')
    const hero = `<div class="mx-4 rounded-[20px] bg-[image:var(--member-aurora)] p-4 text-[var(--member-fg)]"><div class="flex items-end justify-between gap-3"><div><p class="font-mono-numbers text-[2.75rem] font-semibold leading-none">${missed ? 0 : 4}</p><p class="mt-1 text-sm text-[var(--member-fg-2)]">${missed ? 'Streak restarts this week' : 'weeks in a row'}</p></div><div class="text-end"><p class="font-mono-numbers text-lg font-semibold">+${missed ? 10 : 15}</p><p class="text-xs text-[var(--member-fg-2)]">for week ${missed ? 1 : 5}</p></div></div><div class="mt-3 flex gap-[5px]" role="img" aria-label="${missed ? 'Starting again' : '4 weeks kept, week 5 open'}" dir="ltr">${strip}</div><p class="mt-2 text-xs text-[var(--member-fg-2)]">${missed ? 'x2 comes back at week 8 of the new streak' : 'x2 from week 8 · 3 more weeks'}</p></div>`
    const bar3 = `<div class="mt-2.5 flex gap-[5px]" dir="ltr">${[0, 1, 2].map((i) => `<span class="h-2 flex-1 rounded-full ${i < w.rec ? 'bg-[var(--color-brand-primary)]' : 'bg-[var(--color-brand-sunken)]'}"></span>`).join('')}</div>`
    const week = `<div class="mx-4 mt-3 ${CARDBOX} p-4"><div class="flex items-baseline justify-between"><p class="text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">This week</p><p class="font-mono-numbers text-[0.875rem] font-semibold ${SECOND}">${w.rec} of 3 records</p></div>${bar3}<p class="mt-2 text-xs ${SECOND}">${w.more || 'Ready. Keep it now, or in the first 3 days of next week.'}</p></div>`
    const counts = `${sectionHead('What counts').replace('pt-1', 'pt-5')}<div class="mx-4 ${LISTCARD}">${[[ICON('list-checks', 'size-[18px]'), '3 records in the week', 'Expenses or income, any mix'], [ICON('message-square', 'size-[18px]'), 'Bank messages checked', 'Held messages need a look first'], [ICON('calendar-check', 'size-[18px]'), 'Kept in time', 'Any day this week, or up to 3 days into the next']].map(([ic, t, s]) => `<div class="flex min-h-[56px] items-center gap-3 px-4 py-2.5">${tile(ic, ['var(--color-brand-primary-soft)', 'var(--color-brand-primary-ink)'])}<span class="min-w-0"><span class="block text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${t}</span><span class="block text-xs ${SECOND}">${s}</span></span></div>`).join('')}</div>`
    const cur = missed ? 0 : 1
    const earn = `${sectionHead('What it earns').replace('pt-1', 'pt-5')}<div class="mx-4 ${LISTCARD}">${EARN.map(([wk, pts, x], i) => `<div class="flex min-h-[52px] items-center gap-3 px-4 ${i === cur ? 'bg-[var(--color-brand-primary-soft)]' : ''}"><span class="min-w-0 flex-1 text-[0.9375rem] ${i === cur ? 'font-semibold text-[var(--color-brand-primary-ink)]' : 'text-[var(--color-brand-text-primary)]'}">Week ${wk}${i === cur ? ' · you’re here' : ''}</span><span class="font-mono-numbers text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${pts} pts</span><span class="w-11 text-end font-mono-numbers text-xs font-semibold ${MUTED}">${x}</span></div>`).join('')}</div><p class="mx-5 mt-2 text-xs leading-relaxed ${MUTED}">A missed week restarts the streak and drops one step, unless a freeze covers it. You earn a freeze every 8 kept weeks (every 4 from Emerald), up to 2. Streaks of 12, 26 and 52 weeks add 10, 20 and 40 Sparks.</p>`
    const ladder = `${sectionHead('Where it takes you').replace('pt-1', 'pt-5')}<div class="mx-4 ${LISTCARD}">${LADDER.map(([tk, n, d, th], i) => `<div class="flex items-start gap-3 px-4 py-3 ${i === 0 ? 'bg-[color-mix(in_oklab,var(--color-brand-gold)_12%,var(--color-brand-card))]' : ''}">${tierBadge(tk, 30)}<span class="min-w-0 flex-1"><span class="flex flex-wrap items-center gap-1.5 text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${n}${i > 2 ? badge('muted', 'with Pro') : ''}${i === 0 ? `<span class="text-[0.8125rem] font-semibold text-[var(--color-brand-primary-ink)]">· you’re here</span>` : ''}</span><span class="mt-0.5 block text-xs leading-relaxed ${SECOND}">${d}</span>${i === 0 ? `<span class="mt-2 block h-1.5 rounded-full bg-[var(--color-brand-sunken)]"><span class="block h-full rounded-full bg-[var(--color-brand-primary)]" style="width:60%"></span></span><span class="mt-1 block font-mono-numbers text-[0.71875rem] font-semibold ${SECOND}">180 points · 120 to Emerald</span>` : ''}</span><span class="shrink-0 font-mono-numbers text-[0.8125rem] font-semibold ${MUTED}">${th}</span></div>`).join('')}</div><div class="mt-2 flex justify-center"><button type="button" data-i8rw class="inline-flex h-11 items-center gap-1 px-3 text-[0.875rem] font-semibold text-[var(--color-brand-primary-ink)]">See Rewards${ICON('chevron-right', 'size-4')}</button></div>`
    const ready = k === 'ready'
    const foot = `${ready ? '' : `<p class="mb-2 text-center text-xs ${MUTED}">${w.more}</p>`}${btn('primary', 'block', 'Keep this week', `data-i8keep ${ready ? '' : 'disabled'}`)}`
    const sh = ltSheet(S, 'Your week', `Week ${missed ? 1 : 5} · Oct 24 to 30`, hero + week + counts + earn + ladder, foot, 130)
    sh.el.addEventListener('click', (e) => {
      if (e.target.closest('[data-i8rw]')) return toast(S, 'Opens Rewards')
      if (e.target.closest('[data-i8keep]')) { sh.close(); S.st.i8wk = 'kept'; render(S); toast(S, 'Week 5 kept · +15 points') }
    })
  }
  /* today: WeekCheckSheet, opened from the Flow pending row "Check your week" */
  T8.streak = (S) => {
    const seg = (s) => `<span class="h-2 flex-1 rounded-full ${s === 'kept' ? 'bg-[linear-gradient(90deg,var(--color-brand-primary-hover),var(--member-mint))]' : s === 'now' ? 'border-2 border-dashed border-white/85' : 'bg-[var(--member-cell)]'}"></span>`
    const body = `<div class="mx-4 rounded-[20px] bg-[image:var(--member-aurora)] p-4 text-[var(--member-fg)]"><p class="font-mono-numbers text-[2.75rem] font-semibold leading-none">4</p><p class="mt-1 text-sm text-[var(--member-fg-2)]">4 weeks in a row</p><div class="mt-3 flex gap-[5px]" dir="ltr">${['kept', 'kept', 'kept', 'kept', 'now', 'e', 'e', 'e'].map(seg).join('')}</div></div>`
    const sh = ltSheet(S, 'Your week', 'This week', body, btn('primary', 'block', 'Keep this week', 'data-i8keep'), 130)
    sh.el.addEventListener('click', (e) => { if (e.target.closest('[data-i8keep]')) { sh.close(); toast(S, 'Week kept · +10 points') } })
  }

  /* ---------- clicks on the final phone ---------- */
  document.addEventListener('click', (e) => {
    if (e.target.closest('#pz-page [data-page]')) { Object.values(screens).forEach((x) => { x.st.i8src = null }); return }
    const S = screenOf(e.target)
    if (!S || S.st.v7) return
    const t = e.target, st = S.st
    const hit = (a) => t.closest(`[${a}]`)
    const stop = () => { e.stopPropagation(); e.preventDefault() }
    if (hit('data-i8asg')) { stop(); return F8.assign(S, tx6(st)) }
    if (t.closest('[data-layer-root]') || S.suppressClick) return
    if (!st.page || st.page === 'flow') {
      const as = hit('data-assign'); if (as) { stop(); closeOpen(S); return F8.assign(S, st.tx.find((x) => x.id === as.dataset.assign)) }
      const op = hit('data-open')
      if (op && !st.open) { const x = st.tx.find((y) => y.id === op.dataset.open); if (x && x.dir === 'in') { stop(); return F8.incometx(S, x) } }
      const o = hit('data-i8opt'); if (o) { stop(); st.i8opt = o.dataset.i8opt; return render(S) }
      const w = hit('data-i8wk'); if (w) { stop(); st.i8wk = w.dataset.i8wk; return render(S) }
      if (hit('data-i8streak')) { stop(); return F8.streak(S) }
    }
    if (st.page === 'paydays') {
      const s = hit('data-i8src'); if (s) { stop(); st.i8src = s.dataset.i8src; S.scroll.scrollTop = 0; return render(S) }
      if (hit('data-i8back')) { stop(); st.i8src = null; S.scroll.scrollTop = 0; return render(S) }
      if (hit('data-i8add')) { stop(); return addIncome(S) }
      if (hit('data-i8asgopen')) { stop(); return F8.assign(S, tx6(st)) }
      if (hit('data-i8menu')) { stop(); return sourceMenu(S, st.i8src) }
      if (hit('data-i8confirm')) { stop(); return confirmMom(S) }
    }
  }, true)

  SHEETS8.push(['incometx', 'Money in: Assign'], ['assign', 'Assign sheet'], ['addincome', 'Add income'], ['source', 'Income source page'], ['streak', 'Streak sheet'])
  NOTES8.paydays = 'Paydays becomes Income: one hero for expected against received this month, every source as a provider-style row (account logo, cadence, next date, amount, status), and Add income as the section link. Tap a source for its page: the payday timeline, Confirm received inline when one is due, history, and a 3-dot menu. Irregular income never reads as late.'
  NOTES8.flow = 'The weekly check becomes a streak card where the pending row sits: the rule and the payoff in one line, the last 4 weeks as dots (a missed week is grey, never red), and the tier it leads to. It hides once the week is kept. Flip Option A (slim row) and Option B (ring) and the four states above the hero. Swipe or tap the ACME LLC income for Assign.'
}
