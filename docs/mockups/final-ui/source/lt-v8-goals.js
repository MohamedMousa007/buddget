/* ================= round 9: Goals (final phone) ================= */
/* A goal holds its own money and may sit in several places (its homes). Each home is one isolated segment. */
{
  const USD = RATE.USD, GOLD = GRAM['21k']
  const HOME = {
    cib: (n) => ({ lead: brand('cib', 40), name: 'CIB Current', sub: 'Set aside · stays in CIB', amt: f0(n), egp: n, seg: `${f0(n)} in CIB` }),
    nbe: (n) => ({ lead: brand('nbe', 40), name: 'NBE Current', sub: 'Set aside · stays in NBE', amt: f0(n), egp: n, seg: `${f0(n)} in NBE` }),
    deel: (n) => ({ lead: brand('deel', 40), name: 'Deel · USD', sub: `Set aside · ≈ ${f0(n * USD)} EGP`, amt: `$${f0(n)}`, egp: n * USD, seg: `$${f0(n)} in Deel` }),
    gold: (g) => ({ lead: pocketMark(POCKET.gold, 40), name: 'Gold · 21k', sub: `Outside accounts · ≈ ${f0(g * GOLD)} EGP`, amt: `${g} g`, egp: g * GOLD, seg: `${g} g gold`, stale: 'Nov 24' }),
  }
  /* [key, name, target, finish, each month, badge tone, badge label, category, homes] */
  const G9 = [
    ['umrah', 'Umrah 2027', 48000, 'Mar 2027', '2,000 a month', 'positive', 'On track', 'Hajj & Umrah', [['cib', 12000], ['nbe', 6000]]],
    ['trip', 'Trip to Dahab', 50000, 'Mar 2027', '20% of savings', 'warning', 'Behind', 'Travel', [['cib', 12000]]],
    ['car', 'New car', 400000, 'Dec 2029', '6,000 a month', 'positive', 'On track', 'Car', [['deel', 400], ['gold', 18], ['cib', 12000]]],
    ['laptop', 'New laptop', 60000, 'Jun 2027', 'I add it myself', 'muted', 'No plan', 'Gadget', [['nbe', 21000]]],
  ]
  const goal = (k) => { const g = G9.find((x) => x[0] === k); const homes = g[8].map(([h, n]) => HOME[h](n)); const saved = homes.reduce((s, h) => s + h.egp, 0); return { k, name: g[1], target: g[2], fin: g[3], each: g[4], tone: g[5], lab: g[6], cat: g[7], homes, saved, pct: Math.round((saved / g[2]) * 100), stale: homes.find((h) => h.stale) } }
  const homesLine = (d) => d.homes.map((h) => `<bdi class="inline-block whitespace-nowrap font-mono-numbers">${h.seg}</bdi>`).join('<span aria-hidden="true"> · </span>')
  const staleLine = (d) => `<span class="flex items-center gap-1.5 text-xs font-medium text-[var(--color-brand-amber)]">${ICON('triangle-alert', 'size-3.5 shrink-0')}<span class="min-w-0">Gold price missing · last ${f0(GOLD)} a gram, ${d.stale.stale}</span></span>`
  const marks = (p, s = 'size-2.5') => [25, 50, 75].map((m) => `<span aria-hidden="true" class="absolute top-1/2 ${s} -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--color-brand-card)] ${p >= m ? 'bg-[var(--color-brand-primary)]' : 'bg-[var(--color-brand-border-strong)]'}" style="left:${m}%"></span>`).join('')

  /* ---------- the page: v5 hero, today's All · Active · Paused bar + trophy chip, cards that list their homes ---------- */
  const bar = (f) => `<div class="mx-4 mt-4 flex items-center gap-2"><div class="inline-flex min-w-0 flex-1 gap-0.5 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-[3px]">${['All', 'Active', 'Paused'].map((l) => `<button type="button" data-g9-f="${l}" class="${l === f ? SEG_ON : SEG_OFF}">${l}</button>`).join('')}</div><button type="button" data-g9-trophy aria-label="Achieved goals, 3" class="${OPT_BASE} ${OPT_OFF} shrink-0 !h-[42px]">${ICON('trophy', 'size-[18px]')}<span class="font-mono-numbers">3</span></button></div>`
  const card = (d, i) => `<button type="button" data-g9-open="${d.k}" class="block w-full rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4 text-start shadow-[var(--shadow-sm)]"><span class="flex items-center gap-3">${pocketMark(POCKET[d.k], 40)}<span class="min-w-0 flex-1"><span class="flex items-center gap-2"><span class="truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${d.name}</span>${badge(d.tone, d.lab)}</span><span class="mt-0.5 block truncate text-xs ${MUTED}">${d.each} · by ${d.fin}</span></span><b class="font-mono-numbers text-sm text-[var(--color-brand-text-primary)]">${d.pct}%</b></span><span class="relative mt-3 block h-2 rounded-full bg-[var(--color-brand-sunken)]"><span class="block h-full rounded-full bg-[var(--color-brand-primary)]" style="width:${d.pct}%"></span>${marks(d.pct)}</span><span class="mt-2 flex justify-between font-mono-numbers text-xs ${SECOND}"><span><b class="font-semibold text-[var(--color-brand-text-primary)]">${f0(d.saved)}</b> saved</span><span>${f0(d.target - d.saved)} to go</span></span><span class="mt-2.5 block border-t border-[var(--color-brand-border)] pt-2.5 text-xs leading-relaxed ${SECOND}">${homesLine(d)}${d.homes.length > 1 && i === 2 ? new9() : ''}</span>${d.stale ? `<span class="mt-1.5 block">${staleLine(d)}${new9()}</span>` : ''}</button>`
  const SHOWS = { All: () => true, Active: (d) => d.lab !== 'No plan', Paused: (d) => d.lab === 'No plan' }
  const listView = (st) => {
    const all = G9.map((g) => goal(g[0]))
    const saved = all.reduce((s, d) => s + d.saved, 0), want = all.reduce((s, d) => s + d.target, 0)
    const f = st.g9f || 'All', shown = all.filter(SHOWS[f])
    const hero = heroBand({ label: 'Saved for goals', big: f0(saved), n: saved, right: [`${Math.round((saved / want) * 100)}% there`, `of ${f0(want)} in all`], bar: { pct: (saved / want) * 100, scale: [`of ${f0(want)} for ${all.length} goals`, ''] }, cells: [['Each month', '≈ 12,000'], ['Next finish', 'Mar 2027'], ['Achieved', '3']], lnote: noteLine(`${B('≈ 12,000')} a month`, `Next finish ${B('Mar 2027')}`) }, true)
    return hero + bar(f) + `<div class="mx-5 mb-2 mt-6 flex items-center"><span class="text-[0.8125rem] font-bold text-[var(--color-brand-text-primary)]">${f === 'All' ? 'Goals' : `${f} goals`}</span><span class="ms-2 font-mono-numbers text-[0.8125rem] font-semibold ${MUTED}">${shown.length}</span><button type="button" data-g9-new class="ms-auto inline-flex h-11 items-center gap-1 px-1 text-[0.875rem] font-semibold text-[var(--color-brand-primary-ink)]">${ICON('plus', 'size-4')}New goal</button></div><div class="mx-4 flex flex-col gap-2">${shown.map((d) => card(d, all.indexOf(d))).join('')}</div><div class="h-6"></div>`
  }
  /* achieved: its own page with a back row (lists are pages); the trophy room from lt-v6 without the filter bar */
  const achievedPage = () => {
    const back = `<div class="mx-4 mt-2 flex items-center"><button type="button" data-g9-back class="-ms-2 inline-flex h-11 items-center gap-1 px-2 text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${ICON('chevron-left', 'size-5')}Goals</button>${new9()}</div>`
    const room = achievedView().slice(goalsBar('achieved').length).replace('data-open4="s_goal"', 'data-g9-open="umrah"').replace('mt-4 overflow-hidden rounded-3xl', 'mt-1 overflow-hidden rounded-3xl').replace('<div class="h-6"></div>', '')
    return back + room + `<p class="mx-5 mt-3 text-xs leading-relaxed ${MUTED}">An achieved goal stays achieved. Its money can still be released or spent; the goal stays here.</p><div class="h-6"></div>`
  }
  P8.goals = (st) => (st.g9view === 'achieved' ? achievedPage() : listView(st))
  NOTES8.goals = 'Goal cards list where the money sits ("$400 in Deel · 18 g gold · 12,000 in CIB"), and a missing price shows its last price and date. The trophy chip opens achieved goals as a page with a back row; achieved is for good. The goal sheet has Edit (pencil) in place of the bin; Delete sits inside Edit.'

  /* ---------- ⋮ menu: the app's CardActionMenu (popover under the trigger, scrim-dismissed) ---------- */
  const menu9 = (S, trigger, items) => {
    const root = S.vp.querySelector('[data-layer-root]')
    const box = root.getBoundingClientRect(), r = trigger.getBoundingClientRect()
    const W = 216, left = Math.max(8, Math.min(r.right - box.left - W, box.width - W - 8)), top = r.bottom - box.top + 6
    const el = document.createElement('div')
    el.className = 'fixed inset-0'
    el.style.zIndex = '400'
    el.setAttribute('role', 'presentation')
    el.innerHTML = `<div role="menu" class="absolute overflow-hidden rounded-[14px] border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]" style="top:${top}px;left:${left}px;width:${W}px;box-shadow:var(--shadow-lg)">${items.map(([ic, l, , red], i) => `<button type="button" role="menuitem" data-m9="${i}" class="flex min-h-11 w-full items-center gap-2.5 px-3.5 py-2 text-start text-sm font-medium" style="color:${red ? 'var(--color-brand-red)' : 'var(--color-brand-text-primary)'};${i ? 'border-top:1px solid var(--color-brand-border)' : ''}">${ICON(ic, 'size-4')}<span class="truncate">${l}</span></button>`).join('')}</div>`
    root.append(el)
    el.addEventListener('click', (e) => { e.stopPropagation(); const b = e.target.closest('[data-m9]'); el.remove(); if (b) items[+b.dataset.m9][2]() })
  }
  const H_MORE = `<button type="button" data-v="more" aria-label="More actions" class="${CLOSE_BTN}">${ICON('ellipsis-vertical', 'size-4')}</button>`
  const delGoal = (S, d, sheets) => {
    const outside = d.homes.filter((h) => h.stale), inAcct = d.homes.filter((h) => !h.stale)
    const text = `${inAcct.map((h) => h.seg).join(' and ')} go${inAcct.length > 1 ? '' : 'es'} back to Free to spend.${outside.length ? ` The ${outside.map((h) => h.seg).join(', ')} is outside your accounts: keep it in Savings or remove it.` : ''}`
    const done = (msg) => () => { sheets.forEach((s) => s?.close()); toast(S, msg) }
    ltAlert(S, `Delete ${d.name}?`, text, [...(outside.length ? [['solidDanger', 'Delete, keep the gold', done('Goal deleted · gold kept in Savings')], ['danger', 'Delete and remove gold', done('Goal and gold removed')]] : [['solidDanger', 'Delete', done('Goal deleted')]]), ['ghost', 'Cancel']])
  }

  /* ---------- goal sheet: the round-8 detail (milestones, behind card, finish line, each month) with ⋮ Edit / Delete; only "Where it's kept" is new ---------- */
  const homeRow = (h, i) => `${i ? '<div class="ms-[68px] h-px bg-[var(--color-brand-border)]"></div>' : ''}<button type="button" data-toast="${h.stale ? 'Opens gold: Add money, Withdraw' : `Opens this money: Add money, Release`}" class="flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-start hover:bg-[var(--color-brand-elevated)]">${h.lead}<span class="min-w-0 flex-1"><span class="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${h.name}</span><span class="mt-0.5 block truncate text-xs ${MUTED}">${h.sub}</span></span><span class="shrink-0 font-mono-numbers text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]">${h.amt}</span>${CHEV}</button>`
  const PLAN9 = {
    umrah: { fin: { m: 2, y: 2027 }, each: 'fixed', fixed: '2,000', pct: 20, ms: ['Jan 26', 'May 26', 'Nov 26', 'Mar 27'], next: '50% in about 3 months' },
    trip: { fin: { m: 2, y: 2027 }, each: 'share', fixed: '2,000', pct: 20, ms: ['Mar 26', 'Jul 26', 'Nov 26', 'Mar 27'], next: '50% in about 4 months' },
    car: { fin: { m: 11, y: 2029 }, each: 'fixed', fixed: '6,000', pct: 20, ms: ['Jun 26', 'Mar 28', 'Feb 29', 'Dec 29'], next: '50% in about 16 months' },
    laptop: { fin: { m: 5, y: 2027 }, each: 'self', fixed: '2,000', pct: 20, ms: ['Sep 26', 'Jan 27', 'Apr 27', 'Jun 27'], next: '50% when you add 9,000' },
  }
  F8.g9_goal = (S, k = 'car') => {
    const d = goal(k), pl = PLAN9[k]
    const MS = [25, 50, 75, 100].map((p, i) => [p, pl.ms[i], d.pct >= p])
    const sh = form4(S, {
      title: d.name, sub: `Save for · ${d.cat} ${badge(d.tone, d.lab)}`, head: H_MORE + new9().replace('ms-1.5', 'self-center -ms-2'),
      state: { fin: pl.fin, each: pl.each, pct: pl.pct, fixed: pl.fixed },
      body: (st) => `<div class="px-5"><div class="flex items-baseline justify-between"><p><span class="font-mono-numbers text-[40px] font-semibold tracking-[-0.04em] text-[var(--color-brand-text-primary)]">${f0(d.saved)}</span> <span class="text-sm ${MUTED}">of ${f0(d.target)}</span></p><b class="font-mono-numbers text-[var(--color-brand-text-primary)]">${d.pct}%</b></div>
      <div class="relative mt-3 h-2.5 rounded-full bg-[var(--color-brand-sunken)]"><div class="h-full rounded-full bg-[var(--color-brand-primary)]" style="width:${d.pct}%"></div>${MS.slice(0, 3).map(([p, , done]) => `<span aria-hidden="true" class="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--color-brand-card)] ${done ? 'bg-[var(--color-brand-primary)]' : 'bg-[var(--color-brand-border-strong)]'}" style="left:${p}%"></span>`).join('')}</div>
      <div class="mt-3 grid grid-cols-4 gap-2 text-center">${MS.map(([p, dt, done]) => `<div class="rounded-xl py-2 ${done ? 'bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)]' : 'bg-[var(--color-brand-elevated)]'}"><b class="flex items-center justify-center gap-1 font-mono-numbers text-sm ${done ? '' : 'text-[var(--color-brand-text-primary)]'}">${done ? ICON('check', 'size-3.5') : ''}${p}%</b><span class="text-[0.6875rem] ${done ? 'font-semibold' : MUTED}">${done ? 'Reached' : dt}</span></div>`).join('')}</div>
      <p class="mt-3 text-sm ${SECOND}">Next checkpoint: ${pl.next}.</p>
      ${d.lab === 'Behind' ? bCard(`<b class="block text-sm text-[var(--color-brand-text-primary)]">Behind for 2 months</b><p class="text-xs ${SECOND}">1,500 short of plan since Aug. Two ways back:</p><div class="mt-2 flex items-center justify-between text-sm text-[var(--color-brand-text-primary)]">Move the date to Jun 2027 ${btn('outline', 'sm', 'Move date', 'data-toast="Date moved to Jun 2027"')}</div><div class="mt-2 flex items-center justify-between text-sm text-[var(--color-brand-text-primary)]">Keep Mar 2027 ${btn('outline', 'sm', 'Raise', 'data-toast="Each month raised to 2,400"')}</div>`) : ''}</div>
      ${d.stale ? `<div class="mx-4 mt-4 flex gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-4 py-3"><span class="mt-0.5 text-[var(--color-brand-amber)]">${ICON('triangle-alert', 'size-4')}</span><span class="min-w-0 flex-1 text-[0.8125rem] text-[var(--color-brand-text-primary)]"><b class="block font-semibold">Gold price missing</b><span class="${SECOND}">The 18 g are counted at ${f0(GOLD)} a gram, the last price from ${d.stale.stale}. Progress updates when prices load.</span></span></div>` : ''}
      ${grp4([pick4('Finish line', monV(st.fin), 'fin', 'calendar'), pick4('Each month', fundV(st), 'each', 'repeat')])}
      ${sectionHead(`Where it’s kept${new9()}`).replace('pt-1', 'pt-5')}<div class="mx-4 overflow-hidden ${CARDBOX}">${d.homes.map(homeRow).join('')}</div>
      <p class="mx-5 mt-2 text-xs leading-relaxed ${MUTED}">Money in an account stays there, set aside from Free to spend. Add money picks where it goes.</p>`,
      foot: () => foot4('Add money'), done: 'Opens Add money',
      on: {
        fin: (v, draw, st) => ltMonthPicker(S, 'Finish line', st.fin, (m) => { st.fin = m; draw() }),
        each: (v, draw, st) => pickFund(S, st, draw),
        more: (v) => menu9(S, v, [['pencil', 'Edit', () => F8.g9_edit(S, k, sh)], ['trash-2', 'Delete', () => delGoal(S, d, [sh]), true]]),
      },
    })
    return sh
  }
  /* Edit: the goal's fields; Delete lives in the ⋮ menu */
  F8.g9_edit = (S, k = 'car', parent) => {
    const d = goal(k)
    form4(S, {
      title: 'Edit goal', sub: d.name, z: 140, state: { name: d.name, amt: f0(d.target), cur: 'EGP', fin: { m: 11, y: 2029 }, each: 'fixed', pct: 20, fixed: '6,000' },
      body: (st) => `${hero4({ amt: st.amt, ctl: ctl4('cur', st.cur), top: `<div class="mt-1">${pocketMark(POCKET[k], 52)}</div>`, label: 'Target', line: `${f0(d.saved)} saved so far` })}${grp4([in4('name', 'Name', 'e.g. New car', st.name), pick4('Finish line', monV(st.fin), 'fin', 'calendar'), pick4('Each month', fundV(st), 'each', 'repeat')])}`,
      foot: () => foot4('Save'),
      done: 'Goal saved',
      on: {
        fin: (v, draw, st) => ltMonthPicker(S, 'Finish line', st.fin, (m) => { st.fin = m; draw() }),
        each: (v, draw, st) => pickFund(S, st, draw),
      },
    })
  }
  F8.g9_trip = (S) => F8.g9_goal(S, 'trip')

  /* ---------- budget line: the amount is the shared inline currency ---------- */
  F8.g9_line = (S) => form4(S, {
    title: 'Internet', sub: 'Bills · monthly line', lead: TILE('plug', ['var(--cat-utilities-bg)', 'var(--cat-utilities-fg)']), head: H_DEL(),
    state: { amt: '450', cur: 'EGP', ess: true, lock: false, due: 5, cats: ['Internet', 'Telecom'] },
    body: (st) => `${hero4({ amt: st.amt, ctl: ctl4('cur', st.cur), line: `A month · ${Math.max(0, Math.round((num4(st.amt) / 15000) * 100))}% of your income` })}<div class="-mt-3 mb-1 flex justify-center">${new9()}</div>${gNote('Sized from your last 3 bills: 430, 450 and 455. <b class="font-semibold">High confidence.</b>')}${grp4([sw4('ess', 'Essential', 'Counts toward your safety net', st.ess), sw4('lock', 'Lock from Buddgy', 'Buddgy will not change it', st.lock), pick4('Due day', ORD(st.due), 'due', 'calendar'), row4('Spending from', `<span class="truncate">${st.cats.join(', ')}</span>`, 'cats')], '', 'Expenses in these categories fill this line.')}`,
    foot: () => foot4('Save'),
    del: ['Delete this line?', 'Its spending stays in Flow, just not counted under Internet.'], done: 'Line saved',
    onInput: (f, st, sh) => { if (f.dataset.in === 'amt') sh.el.querySelector('[data-line]').textContent = `A month · ${Math.round((num4(st.amt) / 15000) * 100)}% of your income` },
    on: { due: (v, draw, st) => ltDayPicker(S, 'Due day', st.due, (n) => { st.due = n; draw() }), cats: (v, draw, st) => ltCatMulti(S, st.cats, (c) => { st.cats = c.length ? c : st.cats; draw() }) },
  })

  /* ---------- add menu (QuickAddFAB tiles): today's tiles without Account, Subscription and Add by voice, plus Card ---------- */
  const tint = (v) => [`color-mix(in oklab, ${v} 16%, transparent)`, v]
  F8.g9_add = (S) => {
    const tiles = [
      ['banknote-arrow-up', 'Expense', 'Cash or card', ['var(--color-brand-primary-soft)', 'var(--color-brand-primary-ink)'], 'exp'],
      ['banknote-arrow-down', 'Money in', 'Gift, refund, sale', ['var(--color-brand-green-soft)', 'var(--color-brand-green)'], 'in'],
      ['scan-line', 'Receipt', 'Snap, we fill it', tint('var(--color-cat-4)'), 'Receipt'],
      ['credit-card', 'Pay debt', 'Log a payment', tint('var(--color-cat-5)'), 'Pay debt'],
      ['coins', 'Savings', 'Put money aside', tint('var(--color-brand-gold)'), 'Savings'],
      ['wallet-cards', 'Card', 'No account needed', ['var(--color-brand-primary-soft)', 'var(--color-brand-primary-ink)'], 'card'],
    ]
    const body = `<div class="grid min-w-0 grid-cols-2 gap-2 px-4">${tiles.map(([ic, l, h, [bg, fg], k]) => `<button type="button" data-g9-qa="${k}" class="flex min-h-[52px] w-full min-w-0 items-center gap-2.5 overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-3.5 text-start hover:bg-[var(--color-brand-sunken)]"><span class="flex size-9 shrink-0 items-center justify-center rounded-[10px]" style="background:${bg};color:${fg}">${ICON(ic, 'size-[19px]')}</span><span class="flex min-w-0 flex-1 flex-col gap-px"><span class="truncate text-sm font-bold leading-[1.25] text-[var(--color-brand-text-primary)]">${l}</span><span class="line-clamp-2 text-[0.71875rem] leading-[1.3] text-[var(--color-brand-text-secondary)]">${h}</span></span></button>`).join('')}</div>`
    const sh = ltSheet(S, `Add${new9()}`, '', body, '', 150)
    sh.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-g9-qa]'); if (!b) return
      const k = b.dataset.g9Qa
      sh.close()
      if (k === 'exp') return openEdit(S, null)
      if (k === 'card') return typeof a8AddCard === 'function' ? a8AddCard(S, {}) : AFTER.addcard(S)
      toast(S, `Opens ${k === 'in' ? 'Money in' : k}`)
    })
    return sh
  }

  /* ---------- Add goal C: "% of monthly savings"; Already saved uses the shared Account · Pocket · Outside tabs ---------- */
  const FUND9 = [['share', '% of monthly savings', 'A share of what’s left each month', ['piggy-bank', ...IC.teal]], ['fixed', 'A fixed amount', 'The same amount, as often as you like', ['repeat', ...IC.green]], ['self', 'I’ll add money myself', 'No plan, Buddgy reminds you', ['user', 'var(--color-brand-elevated)', 'var(--color-brand-text-secondary)']]]
  const fund9V = (st) => (st.each === 'share' ? `${st.pct}% of monthly savings` : st.each === 'fixed' ? `${st.fixed} ${{ m: 'a month', q: 'every 3 months', y: 'a year' }[st.freq]}` : 'I add it myself')
  const saved9 = (st) => {
    const tabs = `<div class="px-4 pb-3 pt-1"><div role="tablist" class="inline-flex w-full gap-0.5 rounded-xl bg-[var(--color-brand-elevated)] p-[3px]">${SRC_TABS.map(([k, l, ic]) => `<button type="button" role="tab" aria-selected="${k === st.where}" data-v="set:where:${k}" class="${k === st.where ? SEG_ON : SEG_OFF} gap-1.5">${ICON(ic, 'size-4')}${l}</button>`).join('')}</div></div>`
    const pickRow = st.where === 'acct' ? row4('Kept in', pmV(st.wpm), 'wpm') : st.where === 'pocket' ? row4('Kept in', pocketV(st.wpk), 'wpk') : ''
    const note = st.where === 'outside' ? 'Counted as new money, on top of your accounts.' : st.where === 'pocket' ? `Moved from ${POCKET[st.wpk][1]}. Your net worth doesn’t change.` : `Set aside in ${PM[st.wpm].name}. Your net worth doesn’t change.`
    return grp4([in4('saved', 'Amount', '0', st.saved, 'decimal'), `<div><p class="px-4 pt-3 text-[0.75rem] font-semibold ${SECOND}">Where is it?</p>${tabs}</div>`, pickRow], `Already saved <span class="font-medium normal-case tracking-normal">· optional</span>${new9()}`, note)
  }
  const addGoal9 = (S) => form4(S, {
    title: 'New goal', z: 130, state: { ...goalState(), saved: '', freq: 'm' },
    body: (st) => `${askBar(false)}<div class="h-3"></div>${catChips(st)}${heroGoal(st)}${costLink}${grp4([pick4('Finish line', monV(st.fin), 'fin', 'calendar'), row4(`Each month${new9()}`, `<span class="truncate">${fund9V(st)}</span>`, 'fund9'), st.each === 'fixed' ? pick4('How often', GFREQ.find((f) => f[0] === st.freq)[1], 'freq', 'repeat') : ''])}
      ${saved9(st)}`,
    foot: () => foot4('Create goal'), done: 'Goal created',
    on: {
      ...goalOn(S),
      fin: (v, draw, st) => ltMonthPicker(S, 'Finish line', st.fin, (m) => { st.fin = m; draw() }),
      fund9: (v, draw, st) => ltOptPicker(S, 'Each month', 'How this goal gets its money', FUND9, st.each, (k) => {
        st.each = k
        if (k === 'share') return ltNumPicker(S, '% of monthly savings', st.pct, [10, 15, 20, 25, 30, 40, 50, 75], () => '%', (n) => { st.pct = n; draw() })
        if (k === 'fixed') return ltNumPicker(S, 'Amount', 2, [1, 2, 3, 4, 5, 6, 8, 10], () => 'thousand EGP', (n) => { st.fixed = f0(n * 1000); draw() })
        draw()
      }),
      freq: (v, draw, st) => ltOptPicker(S, 'How often', '', GFREQ.map(([k, l]) => [k, l]), st.freq, (k) => { st.freq = k; draw() }),
    },
  })
  {
    const o = AFTER.addgoalC
    AFTER.addgoalC = (S) => (S.st.v7 ? o(S) : addGoal9(S))
    F8.g9_addgoal = addGoal9
    T8.g9_addgoal = (S) => o(S)
  }

  T8.g9_goal = (S) => AFTER.s_goal(S)
  T8.g9_edit = (S) => AFTER.s_goal(S)
  T8.g9_trip = (S) => AFTER.s_goal(S)
  T8.g9_line = (S) => AFTER.s_line(S)
  SHEETS8.push(['g9_goal', 'Goal · several places'], ['g9_trip', 'Goal · one place'], ['g9_edit', 'Edit goal'], ['g9_line', 'Budget line'], ['g9_add', 'Add menu'], ['g9_addgoal', 'Add goal'])
  NEW9.push('goals', 'g9_goal', 'g9_trip', 'g9_edit', 'g9_line', 'g9_add', 'g9_addgoal')

  /* ---------- the + FAB on every final page (Accounts too): window capture runs before any document listener ---------- */
  window.addEventListener('click', (e) => {
    const S = screenOf(e.target)
    if (!S || S.st.v7 || !e.target.closest('[aria-label="Quick add"]')) return
    e.stopPropagation(); e.preventDefault()
    F8.g9_add(S)
  }, true)

  /* ---------- clicks on the final phone ---------- */
  document.addEventListener('click', (e) => {
    const S = screenOf(e.target)
    if (!S || S.st.v7) return
    const t = e.target, hit = (sel) => t.closest(sel)
    const stop = () => { e.stopPropagation(); e.preventDefault() }
    if (S.st.page !== 'goals' || hit('[data-layer-root]')) return
    let b
    if ((b = hit('[data-g9-f]'))) { stop(); S.st.g9f = b.dataset.g9F; return render(S) }
    if (hit('[data-g9-trophy]')) { stop(); S.st.g9view = 'achieved'; S.scroll.scrollTop = 0; return render(S) }
    if (hit('[data-g9-back]')) { stop(); S.st.g9view = null; S.scroll.scrollTop = 0; return render(S) }
    if (hit('[data-g9-new]')) { stop(); return AFTER.addgoalC(S) }
    if ((b = hit('[data-g9-open]'))) { stop(); return F8.g9_goal(S, b.dataset.g9Open) }
  }, true)
}
