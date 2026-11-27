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

  /* ---------- goal sheet: pencil in place of the bin, homes listed, one CTA ---------- */
  const H_EDIT = `<button type="button" data-g9-edit aria-label="Edit goal" class="${CLOSE_BTN}">${ICON('pencil', 'size-4')}</button>`
  const homeRow = (h, i) => `${i ? '<div class="ms-[68px] h-px bg-[var(--color-brand-border)]"></div>' : ''}<button type="button" data-toast="${h.stale ? 'Opens gold: Add money, Withdraw' : `Opens this money: Add money, Release`}" class="flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-start hover:bg-[var(--color-brand-elevated)]">${h.lead}<span class="min-w-0 flex-1"><span class="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${h.name}</span><span class="mt-0.5 block truncate text-xs ${MUTED}">${h.sub}</span></span><span class="shrink-0 font-mono-numbers text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]">${h.amt}</span>${CHEV}</button>`
  F8.g9_goal = (S, k = 'car') => {
    const d = goal(k)
    const body = `<div class="px-5"><div class="flex items-baseline justify-between"><p><span class="font-mono-numbers text-[40px] font-semibold tracking-[-0.04em] text-[var(--color-brand-text-primary)]">${f0(d.saved)}</span> <span class="text-sm ${MUTED}">of ${f0(d.target)}</span></p><b class="font-mono-numbers text-[var(--color-brand-text-primary)]">${d.pct}%</b></div>
      <div class="relative mt-3 h-2.5 rounded-full bg-[var(--color-brand-sunken)]"><div class="h-full rounded-full bg-[var(--color-brand-primary)]" style="width:${d.pct}%"></div>${marks(d.pct, 'size-3.5')}</div>
      <p class="mt-3 text-sm ${SECOND}">${f0(d.target - d.saved)} to go by ${d.fin} · ${d.each}</p></div>
      ${d.stale ? `<div class="mx-4 mt-4 flex gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-4 py-3"><span class="mt-0.5 text-[var(--color-brand-amber)]">${ICON('triangle-alert', 'size-4')}</span><span class="min-w-0 flex-1 text-[0.8125rem] text-[var(--color-brand-text-primary)]"><b class="block font-semibold">Gold price missing${new9()}</b><span class="${SECOND}">The 18 g are counted at ${f0(GOLD)} a gram, the last price from ${d.stale.stale}. Progress updates when prices load.</span></span></div>` : ''}
      ${sectionHead('Where it’s kept').replace('pt-1', 'pt-5')}<div class="mx-4 overflow-hidden ${CARDBOX}">${d.homes.map(homeRow).join('')}</div>
      <p class="mx-5 mt-2 text-xs leading-relaxed ${MUTED}">Money in an account stays there, set aside from Free to spend. Add money picks where it goes.</p>`
    const sh = ltSheet(S, d.name, `Save for · ${d.cat} ${badge(d.tone, d.lab)}`, body, btn('primary', 'block', 'Add money', 'data-g9-add'), 120, undefined, H_EDIT + new9().replace('ms-1.5', 'self-center -ms-2'))
    sh.el.addEventListener('click', (e) => {
      if (e.target.closest('[data-g9-edit]')) return F8.g9_edit(S, k, sh)
      if (e.target.closest('[data-g9-add]')) { sh.close(); return AFTER.goal(S) }
      const t = e.target.closest('[data-toast]'); if (t) toast(S, t.dataset.toast)
    })
    return sh
  }
  /* Edit holds Delete (a quiet red link under Save) */
  F8.g9_edit = (S, k = 'car', parent) => {
    const d = goal(k)
    const outside = d.homes.filter((h) => h.stale)
    const inAcct = d.homes.filter((h) => !h.stale)
    const delText = `${inAcct.map((h) => h.seg).join(' and ')} go${inAcct.length > 1 ? '' : 'es'} back to Free to spend.${outside.length ? ` The ${outside.map((h) => h.seg).join(', ')} is outside your accounts: keep it in Savings or remove it.` : ''}`
    form4(S, {
      title: 'Edit goal', sub: d.name, z: 140, state: { name: d.name, amt: f0(d.target), cur: 'EGP', fin: { m: 11, y: 2029 }, each: 'fixed', pct: 20, fixed: '6,000' },
      body: (st) => `${hero4({ amt: st.amt, ctl: ctl4('cur', st.cur), top: `<div class="mt-1">${pocketMark(POCKET[k], 52)}</div>`, label: 'Target', line: `${f0(d.saved)} saved so far` })}${grp4([in4('name', 'Name', 'e.g. New car', st.name), pick4('Finish line', monV(st.fin), 'fin', 'calendar'), pick4('Each month', fundV(st), 'each', 'repeat')])}`,
      foot: () => `<div class="flex flex-col gap-1"><button type="button" data-done class="${BTN.primary} ${SZ.block}">Save</button><button type="button" data-v="delg" class="h-11 text-[0.875rem] font-semibold text-[var(--color-brand-red-text)]">Delete goal</button></div>`,
      done: 'Goal saved',
      on: {
        fin: (v, draw, st) => ltMonthPicker(S, 'Finish line', st.fin, (m) => { st.fin = m; draw() }),
        each: (v, draw, st) => pickFund(S, st, draw),
        delg: (v, draw, st, sh) => ltAlert(S, `Delete ${d.name}?`, delText, [
          ...(outside.length ? [['solidDanger', 'Delete, keep the gold', () => { sh.close(); parent?.close(); toast(S, 'Goal deleted · gold kept in Savings') }], ['danger', 'Delete and remove gold', () => { sh.close(); parent?.close(); toast(S, 'Goal and gold removed') }]] : [['solidDanger', 'Delete', () => { sh.close(); parent?.close(); toast(S, 'Goal deleted') }]]),
          ['ghost', 'Cancel'],
        ]),
      },
    })
  }
  F8.g9_trip = (S) => F8.g9_goal(S, 'trip')

  /* ---------- budget line: the amount is the shared inline currency; Delete sits in the form, no bin ---------- */
  F8.g9_line = (S) => form4(S, {
    title: 'Internet', sub: 'Bills · monthly line', lead: TILE('plug', ['var(--cat-utilities-bg)', 'var(--cat-utilities-fg)']),
    state: { amt: '450', cur: 'EGP', ess: true, lock: false, due: 5, cats: ['Internet', 'Telecom'] },
    body: (st) => `${hero4({ amt: st.amt, ctl: ctl4('cur', st.cur), line: `A month · ${Math.max(0, Math.round((num4(st.amt) / 15000) * 100))}% of your income` })}<div class="-mt-3 mb-1 flex justify-center">${new9()}</div>${gNote('Sized from your last 3 bills: 430, 450 and 455. <b class="font-semibold">High confidence.</b>')}${grp4([sw4('ess', 'Essential', 'Counts toward your safety net', st.ess), sw4('lock', 'Lock from Buddgy', 'Buddgy will not change it', st.lock), pick4('Due day', ORD(st.due), 'due', 'calendar'), row4('Spending from', `<span class="truncate">${st.cats.join(', ')}</span>`, 'cats')], '', 'Expenses in these categories fill this line.')}`,
    foot: () => `<div class="flex flex-col gap-1"><button type="button" data-done class="${BTN.primary} ${SZ.block}">Save</button><button type="button" data-v="del" class="h-11 text-[0.875rem] font-semibold text-[var(--color-brand-red-text)]">Delete line</button></div>`,
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

  /* ---------- Add goal C, agreed model: the goal holds its own money; no pocket wording ---------- */
  const ACCT9 = [['cib', 'CIB', [['cib:cur', 'CIB Current', 59405, 'EGP'], ['cib:sav', 'CIB Savings', 11407, 'EGP']]], ['nbe', 'NBE', [['nbe:cur', 'NBE Current', 20000, 'EGP']]], ['deel', 'Deel', [['deel:usd', 'Deel · USD', 1200, 'USD']]], ['voda', 'Vodafone Cash', [['voda:w', 'Vodafone Cash', 1200, 'EGP']]]]
  const OUT9 = { gold: ['Gold', 'gem', 'Outside accounts · priced each day'], other: ['Something else', 'package', 'Outside accounts · you set its value'] }
  const acct9 = (id) => ACCT9.flatMap(([p, , l]) => l.map((a) => ({ prov: p, id: a[0], name: a[1], free: a[2], cur: a[3] }))).find((a) => a.id === id)
  const freeV = (a) => (a.cur === 'USD' ? `$${f0(a.free)}` : f0(a.free))
  const whereV = (w) => (OUT9[w] ? `${ICON(OUT9[w][1], `size-4 ${MUTED}`)}<span class="truncate">${OUT9[w][0]}</span>` : `${brand(acct9(w).prov, 24)}<span class="truncate">${acct9(w).name}</span>`)
  /* bank first, then its account (the Savings picker's pattern), plus Outside: gold or other */
  const wherePick = (S, on, done) => {
    const r = (attr, lead, t, sub, sel) => `<button type="button" ${attr} class="flex min-h-[64px] w-full items-center gap-3 px-4 py-2.5 text-start hover:bg-[var(--color-brand-elevated)]">${lead}<span class="min-w-0 flex-1"><span class="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${t}</span><span class="mt-0.5 block truncate font-mono-numbers text-xs ${MUTED}">${sub}</span></span>${sel}</button>`
    const grp = (t, rows) => `${sectionHead(t).replace('pt-1', 'pt-4')}<div class="mx-4 divide-y divide-[var(--color-brand-border)] overflow-hidden ${CARDBOX}">${rows.join('')}</div>`
    const banks = ACCT9.map(([p, n, l]) => (l.length === 1 ? r(`data-w9="${l[0][0]}"`, brand(p, 40), l[0][1], `${freeV(acct9(l[0][0]))} free`, tick(on === l[0][0], false)) : r(`data-w9p="${p}"`, brand(p, 40), n, `${l.length} accounts`, CHEV)))
    const outs = Object.entries(OUT9).map(([k, [t, ic, sub]]) => r(`data-w9="${k}"`, `<span aria-hidden="true" class="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--color-brand-elevated)] ${SECOND}">${ICON(ic, 'size-5')}</span>`, t, sub, tick(on === k, false)))
    const sh = ltSheet(S, 'Where it’s kept', 'Pick the bank, then the account', grp('Accounts', banks) + grp('Outside', outs), '', 220)
    sh.el.addEventListener('click', (e) => {
      const a = e.target.closest('[data-w9]'); if (a) { sh.close(); return done(a.dataset.w9) }
      const p = e.target.closest('[data-w9p]'); if (!p) return
      const [, n, l] = ACCT9.find((x) => x[0] === p.dataset.w9p)
      const s2 = ltSheet(S, n, `${l.length} accounts · pick one`, `<div class="mx-4 divide-y divide-[var(--color-brand-border)] overflow-hidden ${CARDBOX}">${l.map((x) => r(`data-w9a="${x[0]}"`, brand(p.dataset.w9p, 40), x[1], `${freeV(acct9(x[0]))} free`, tick(on === x[0], false))).join('')}</div>`, '', 240)
      s2.el.addEventListener('click', (e2) => { const b = e2.target.closest('[data-w9a]'); if (b) { s2.close(); sh.close(); done(b.dataset.w9a) } })
    })
  }
  const FUND9 = [['share', '% of monthly savings', 'A share of what’s left each month', ['piggy-bank', ...IC.teal]], ['fixed', 'A fixed amount', 'The same amount, as often as you like', ['repeat', ...IC.green]], ['self', 'I’ll add money myself', 'No plan, Buddgy reminds you', ['user', 'var(--color-brand-elevated)', 'var(--color-brand-text-secondary)']]]
  const fund9V = (st) => (st.each === 'share' ? `${st.pct}% of monthly savings` : st.each === 'fixed' ? `${st.fixed} ${{ m: 'a month', q: 'every 3 months', y: 'a year' }[st.freq]}` : 'I add it myself')
  const capOf = (st) => (OUT9[st.where] ? Infinity : acct9(st.where).free)
  const asideNote = (st) => { if (OUT9[st.where]) return `Counted in Savings as ${st.where === 'gold' ? 'gold' : 'an outside holding'}; your accounts don’t change.`; const a = acct9(st.where); return num4(st.saved) > a.free ? `<span class="font-semibold text-[var(--color-brand-amber)]">Only ${freeV(a)} is free in ${a.name}.</span> Set aside up to that.` : `Stays in ${a.name}, set aside from Free to spend · up to ${freeV(a)} free.` }
  const addGoal9 = (S) => form4(S, {
    title: 'New goal', z: 130, state: { ...goalState(), where: 'cib:cur', saved: '', freq: 'm' },
    body: (st) => `${askBar(false)}<div class="h-3"></div>${catChips(st)}${heroGoal(st)}${costLink}${grp4([pick4('Finish line', monV(st.fin), 'fin', 'calendar'), row4(`Each month${new9()}`, `<span class="truncate">${fund9V(st)}</span>`, 'fund9'), st.each === 'fixed' ? pick4('How often', GFREQ.find((f) => f[0] === st.freq)[1], 'freq', 'repeat') : ''])}
      ${grp4([row4(`Where it’s kept${new9()}`, whereV(st.where), 'where9'), in4('saved', OUT9[st.where] ? 'Already have' : 'Already set aside', '0 · optional', st.saved, 'decimal')], 'Money you already have', `<span data-aside>${asideNote(st)}</span>`)}`,
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
      where9: (v, draw, st) => wherePick(S, st.where, (w) => { st.where = w; if (num4(st.saved) > capOf(st)) st.saved = f0(capOf(st)); draw() }),
    },
    onInput: (f, st, sh) => { if (f.dataset.in === 'saved') { const n = sh.el.querySelector('[data-aside]'); if (n) n.innerHTML = asideNote(st) } },
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
  SHEETS8.push(['g9_goal', 'Goal · several places'], ['g9_trip', 'Goal · one place'], ['g9_edit', 'Edit goal · Delete inside'], ['g9_line', 'Budget line'], ['g9_add', 'Add menu'], ['g9_addgoal', 'Add goal'])
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
