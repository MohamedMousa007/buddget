/* ================= round 8 · Debts (D5, owner point 13) ================= */
{
  /* icons passed by name below; listed literally so build8.sh adds them to the sprite:
     ICON('circle-check') ICON('send') ICON('bell') ICON('zap') ICON('pencil') ICON('trash-2') ICON('wrench') ICON('laptop') ICON('receipt') ICON('shield-check') */
  /* ---- sample data: owed total 48,600 = 33,000 + 3,000 + 8,400 + 4,200 (same as today's hero) ---- */
  const TINT = (ic, tone) => `<span aria-hidden="true" class="flex size-10 shrink-0 items-center justify-center rounded-[11px]" style="background:${tone[0]};color:${tone[1]}">${ICON(ic, 'size-5')}</span>`
  const AVATAR = (ch, tone, s = 40) => `<span aria-hidden="true" class="flex shrink-0 items-center justify-center rounded-full text-[0.9375rem] font-bold" style="width:${s}px;height:${s}px;background:${tone[0]};color:${tone[1]}">${ch}</span>`
  const PERSON_TONE = ['var(--color-brand-amber-soft)', 'var(--color-brand-amber)']
  const LENT_TONE = ['var(--color-brand-green-soft)', 'var(--color-brand-green)']
  const D = {
    car: { kind: 'borrow', dir: 'owe', title: 'Car loan', who: 'CIB', sub: 'Bank loan', lead: (s) => brand('cib', s), total: 54000, paid: 21000, monthly: 3000, n: 18, done: 7, due: 'Nov 5', dueLong: 'Thu, Nov 5', days: 8, started: 'Apr 5, 2026', ends: 'Apr 5, 2027', into: 'cib',
      log: [['Oct 5', 'cib', 3000], ['Sep 5', 'cib', 3000], ['Aug 5', 'cib', 3000]] },
    mona: { kind: 'borrow', dir: 'owe', title: 'Mona', who: 'Mona', sub: 'Your sister · help with rent', lead: (s) => AVATAR('M', PERSON_TONE, s), total: 5000, paid: 2000, due: 'Dec 31', dueLong: 'Thu, Dec 31', days: 64, started: 'Aug 20, 2026', into: 'cib',
      log: [['Oct 15', 'voda', 1000], ['Sep 15', 'cib', 1000]] },
    karim: { kind: 'borrow', dir: 'owed', title: 'Karim', who: 'Karim', sub: 'Friend · concert tickets', lead: (s) => AVATAR('K', LENT_TONE, s), total: 3000, paid: 1000, due: 'Nov 30', dueLong: 'Mon, Nov 30', days: 33, started: 'Sep 2, 2026', into: 'cib',
      log: [['Oct 20', 'cib', 1000]] },
    omar: { kind: 'borrow', dir: 'owed', title: 'Omar', who: 'Omar', sub: 'Colleague · lunch money', lead: (s) => AVATAR('O', LENT_TONE, s), total: 1500, paid: 0, due: '', started: 'Oct 22, 2026', into: 'cash', log: [] },
    valu: { kind: 'install', title: 'iPhone 16', who: 'valU', sub: 'valU · 12 months', lead: (s) => brand('valu', s), total: 16800, paid: 8400, monthly: 1400, n: 12, done: 6, due: 'Nov 12', dueLong: 'Thu, Nov 12', days: 15, price: 15000, fee: 300, interest: 1500, card: 'cib', started: 'May 12, 2026', ends: 'Apr 12, 2027',
      months: ['May 12', 'Jun 12', 'Jul 12', 'Aug 12', 'Sep 12', 'Oct 12', 'Nov 12', 'Dec 12', 'Jan 12, 2027', 'Feb 12, 2027', 'Mar 12, 2027', 'Apr 12, 2027'] },
    qnb: { kind: 'card', title: 'QNB Visa', who: 'QNB', sub: '••5512', lead: (s) => brand('qnb', s), owed: 4200, limit: 20000, min: 210, due: 'Nov 10', dueLong: 'Tue, Nov 10', days: 13 },
  }
  const TABS = [['borrow', 'Borrow', ['car', 'mona']], ['install', 'Installments', ['valu']], ['cards', 'Cards', ['qnb']]]
  const OWED_TO_YOU = ['karim', 'omar']
  /* same four as today's cleared vault: 54,800 paid off, last one Mar 2025 */
  const CLEARED = [['Ahmed', 'Borrow', 'Mar 2025', 15000, 10, (s) => AVATAR('A', PERSON_TONE, s)], ['Car repair', 'Borrow', 'Jan 2025', 18000, 6, () => TINT('wrench', TONE.amber)], ['valU · TV', 'Installment', 'Oct 2024', 12000, 12, (s) => brand('valu', s)], ['NBE Titanium', 'Credit card', 'Aug 2024', 9800, 3, (s) => brand('nbe', s)]]
  const CLEARED_TOTAL = CLEARED.reduce((s, c) => s + c[3], 0)

  const left = (d) => (d.kind === 'card' ? d.owed : d.total - d.paid)
  const pct = (d) => (d.kind === 'card' ? Math.round((d.owed / d.limit) * 100) : Math.round((d.paid / d.total) * 100))
  const EGP = `<span class="text-[0.6875rem] font-normal ${MUTED}">EGP</span>`
  const amt = (n, cls = 'text-[0.9375rem] font-semibold') => `<span class="whitespace-nowrap font-mono-numbers ${cls} tabular-nums text-[var(--color-brand-text-primary)]">${f0(n)} ${EGP}</span>`
  const bar = (p, tone = 'var(--color-brand-primary)') => `<span aria-hidden="true" class="block h-1.5 overflow-hidden rounded-full bg-[var(--color-brand-elevated)]"><span class="block h-full rounded-full" style="width:${p}%;background:${tone}"></span></span>`
  const barTone = (d) => (d.kind === 'card' ? (pct(d) >= 80 ? 'var(--color-brand-red)' : pct(d) >= 50 ? 'var(--color-brand-amber)' : 'var(--color-brand-primary)') : d.dir === 'owed' ? 'var(--color-brand-green)' : 'var(--color-brand-primary)')
  const dueText = (d) => (d.due ? `${d.dir === 'owed' ? 'Expected' : 'Due'} ${d.due}` : 'No due date')
  const line2 = (d) => (d.kind === 'card' ? `Due ${d.due} · minimum ${f0(d.min)}` : d.monthly ? `${f0(d.monthly)} a month · ${dueText(d)}` : dueText(d))
  const line3 = (d) => (d.kind === 'card' ? `${pct(d)}% of ${f0(d.limit)} limit` : d.n ? `${d.n - d.done} of ${d.n} left` : `${f0(d.paid)} of ${f0(d.total)} ${d.dir === 'owed' ? 'back' : 'paid'}`)

  /* Option A: DebtsActiveList row, a little taller, with one meta line and the bar */
  const rowA = (k, i) => {
    const d = D[k]
    return `${i ? '<div class="ms-[68px] h-px bg-[var(--color-brand-border)]"></div>' : ''}<button type="button" data-d8-open="${k}" class="flex min-h-[84px] w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-[var(--color-brand-elevated)]">${d.lead(40)}<span class="min-w-0 flex-1"><span class="flex items-baseline gap-2"><span class="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${d.kind === 'install' ? `${d.title} · ${d.who}` : d.kind === 'card' ? `${d.title} ${d.sub}` : d.title}</span>${d.dir === 'owed' ? `<span class="whitespace-nowrap font-mono-numbers text-[0.9375rem] font-semibold tabular-nums text-[var(--color-brand-green)]">+${f0(left(d))} ${EGP}</span>` : amt(left(d))}</span><span class="mt-0.5 flex items-baseline gap-2 text-xs ${MUTED}"><span class="min-w-0 flex-1 truncate">${line2(d)}</span><span class="shrink-0 font-mono-numbers">${line3(d)}</span></span><span class="mt-2 block">${bar(pct(d), barTone(d))}</span></span></button>`
  }
  /* Option B: one card per debt, next-due chip and two stats */
  const chip = (d) => {
    if (!d.due) return `<span class="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-[var(--color-brand-elevated)] px-2.5 text-[0.75rem] font-semibold ${SECOND}">${ICON('calendar', 'size-3.5')}Any time</span>`
    const soon = d.days <= 10 && d.dir !== 'owed'
    return `<span class="inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-[0.75rem] font-semibold" style="background:${soon ? 'var(--color-brand-amber-soft)' : 'var(--color-brand-elevated)'};color:${soon ? 'var(--color-brand-amber)' : 'var(--color-brand-text-secondary)'}">${ICON('calendar', 'size-3.5')}${d.due}${d.days <= 30 ? ` · ${d.days} days` : ''}</span>`
  }
  const stats = (d) => d.kind === 'card' ? [['Minimum due', f0(d.min)], ['Limit', f0(d.limit)]]
    : d.monthly ? [['Each month', f0(d.monthly)], ['Paid', `${d.done} of ${d.n}`]]
      : [[d.dir === 'owed' ? 'Back so far' : 'Paid back', f0(d.paid)], [d.dir === 'owed' ? 'You lent' : 'Borrowed', f0(d.total)]]
  const rowB = (k) => {
    const d = D[k]
    return `<button type="button" data-d8-open="${k}" class="block w-full rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4 text-start transition-[border-color,transform] duration-150 ease-out active:scale-[0.99]"><span class="flex items-center gap-3">${d.lead(44)}<span class="min-w-0 flex-1"><span class="block truncate text-base font-semibold text-[var(--color-brand-text-primary)]">${d.kind === 'card' ? `${d.title} ${d.sub}` : d.title}</span><span class="mt-0.5 block truncate text-[0.8125rem] ${MUTED}">${d.kind === 'card' ? 'Credit card' : d.sub}</span></span>${chip(d)}</span><span class="mt-3 flex items-baseline gap-1.5"><span class="font-mono-numbers text-[1.375rem] font-semibold tracking-[-0.03em] tabular-nums" style="color:${d.dir === 'owed' ? 'var(--color-brand-green)' : 'var(--color-brand-text-primary)'}">${d.dir === 'owed' ? '+' : ''}${f0(left(d))}</span><span class="text-[0.8125rem] ${MUTED}">EGP ${d.kind === 'card' ? 'owed' : d.dir === 'owed' ? 'to collect' : 'left'}</span><span class="ms-auto font-mono-numbers text-xs font-semibold ${MUTED}">${pct(d)}%</span></span><span class="mt-2 block">${bar(pct(d), barTone(d))}</span><span class="mt-3 grid grid-cols-2 gap-2">${stats(d).map(([l, v]) => `<span class="rounded-xl bg-[var(--color-brand-elevated)] px-3 py-2"><span class="block text-[0.6875rem] font-semibold ${MUTED}">${l}</span><span class="block font-mono-numbers text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${v}</span></span>`).join('')}</span></button>`
  }
  const group = (st, keys) => (st.d8opt === 'B' ? `<div class="mx-4 flex flex-col gap-2.5">${keys.map(rowB).join('')}</div>` : `<div class="mx-4 overflow-hidden ${CARDBOX}">${keys.map(rowA).join('')}</div>`)
  const head = (t, n, right = '') => `<div class="mx-5 mb-2 mt-6 flex min-h-11 items-center"><span class="text-[0.8125rem] font-bold text-[var(--color-brand-text-primary)]">${t}</span><span class="ms-2 font-mono-numbers text-[0.8125rem] font-semibold ${MUTED}">${n}</span><span class="ms-auto">${right}</span></div>`
  const addBtn = `<button type="button" data-open4="adddebt" class="inline-flex h-11 items-center gap-1 px-1 text-[0.875rem] font-semibold text-[var(--color-brand-primary-ink)]">${ICON('plus', 'size-4')}Add</button>`

  /* tab bar + cleared chip: goalsBar / trophyChip from Goals, own data attributes */
  const clearedChip = (on) => `<button type="button" data-d8-cleared aria-pressed="${on}" aria-label="Cleared debts, ${CLEARED.length}" class="${OPT_BASE} ${on ? OPT_ON : OPT_OFF} shrink-0 !h-[42px]">${ICON('trophy', 'size-[18px]')}<span class="font-mono-numbers">${CLEARED.length}</span></button>`
  const debtsBar = (st, cleared) => `<div class="mx-4 mt-4 flex items-center gap-2"><div role="tablist" aria-label="Debt type" class="inline-flex min-w-0 flex-1 gap-0.5 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-[3px]">${TABS.map(([k, l]) => `<button type="button" role="tab" aria-selected="${!cleared && st.d8tab === k}" data-d8-tab="${k}" class="${!cleared && st.d8tab === k ? SEG_ON : SEG_OFF} !px-2 ${k === 'install' ? 'flex-[1.45]' : ''}"><span class="truncate">${l}</span></button>`).join('')}</div>${clearedChip(cleared)}</div>`
  const optSwitch = (st) => `<div class="mx-4 mt-3 flex items-center gap-3 rounded-xl border border-dashed border-[var(--color-brand-border-strong)] px-3 py-1.5"><span class="shrink-0 text-[0.75rem] font-semibold ${MUTED}">Debt row</span><div class="inline-flex min-w-0 flex-1 gap-0.5 rounded-xl bg-[var(--color-brand-elevated)] p-[3px]">${[['A', 'A · Compact'], ['B', 'B · Card']].map(([v, l]) => `<button type="button" data-d8-opt="${v}" aria-pressed="${st.d8opt === v}" class="${st.d8opt === v ? SEG_ON : SEG_OFF}"><span class="truncate">${l}</span></button>`).join('')}</div></div>`

  const hero = () => heroBand({ label: 'Still owed', big: '48,600', n: 48600, right: ['39% cleared', '31,400 of 80,000 paid'], bar: { pct: 39 }, lnote: noteLine(`Next ${B('3,000')} on Nov 5`, `${B('2 of 3')} paid this month`) }, true)

  function listView(st) {
    const tab = TABS.find((t) => t[0] === st.d8tab)
    const owe = tab[2]
    const oweTotal = owe.reduce((s, k) => s + left(D[k]), 0)
    const label = { borrow: 'You owe', install: 'Plans', cards: 'Credit cards' }[tab[0]]
    let h = optSwitch(st) + hero() + debtsBar(st, false)
    h += head(label, owe.length, `<span class="flex items-center gap-1"><span class="font-mono-numbers text-[0.8125rem] font-semibold ${SECOND}">${f0(oweTotal)}</span>${addBtn}</span>`) + group(st, owe)
    if (tab[0] === 'borrow') {
      const t = OWED_TO_YOU.reduce((s, k) => s + left(D[k]), 0)
      h += head('Owed to you', OWED_TO_YOU.length, `<span class="font-mono-numbers text-[0.8125rem] font-semibold text-[var(--color-brand-green)]">+${f0(t)} EGP</span>`) + group(st, OWED_TO_YOU) + `<p class="mx-5 mt-2 text-xs leading-relaxed ${MUTED}">Not part of Still owed. It shows what others owe you.</p>`
    }
    if (tab[0] === 'cards') h += `<p class="mx-5 mt-2 text-xs leading-relaxed ${MUTED}">Tap a card to pay it or pay it off.</p>`
    return h + '<div class="h-6"></div>'
  }

  /* cleared: the Goals trophy room, for debts */
  function clearedView(st) {
    const heroC = `<section class="relative mx-4 mt-4 overflow-hidden rounded-3xl px-5 pb-5 pt-4 text-[var(--flow-band-fg)]" style="background:linear-gradient(120deg, var(--flow-band-a) 0%, var(--flow-band-b) 100%)"><span aria-hidden="true" class="pointer-events-none absolute -end-10 -top-12 size-44 rounded-full" style="background:radial-gradient(circle, rgba(255,255,255,.16), transparent 65%)"></span><div class="relative flex items-center gap-4"><span aria-hidden="true" class="flex size-14 shrink-0 items-center justify-center rounded-full bg-[var(--flow-band-fg)] text-[var(--flow-band-b)] shadow-[0_8px_24px_-8px_rgba(0,0,0,.45)]">${ICON('trophy', 'size-7')}</span><div><p class="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[var(--flow-band-fg-2)]">Debts cleared</p><p class="font-mono-numbers text-[2rem] font-semibold leading-tight tracking-[-0.03em]">${CLEARED.length}</p></div><div class="ms-auto text-end"><p class="font-mono-numbers text-[1.0625rem] font-semibold">${f0(CLEARED_TOTAL)}</p><p class="text-[0.71875rem] text-[var(--flow-band-fg-2)]">EGP paid off</p></div></div><div class="relative mt-4 grid grid-cols-3 gap-2">${[['31', 'months paying'], ['3 mo', 'fastest payoff'], ['Mar 2025', 'last cleared']].map(([v, l]) => `<div class="rounded-2xl px-3 py-2.5 text-center" style="background:var(--flow-band-mix)"><p class="font-mono-numbers text-[0.9375rem] font-semibold">${v}</p><p class="text-[0.6875rem] text-[var(--flow-band-fg-2)]">${l}</p></div>`).join('')}</div></section>`
    const row = ([t, k, d, a, n, lead]) => `<button type="button" data-toast="Opens ${esc(t)} with its payments, read only" class="flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-start hover:bg-[var(--color-brand-elevated)]"><span class="relative">${lead(40)}<span aria-hidden="true" class="absolute -bottom-1 -end-1 flex size-5 items-center justify-center rounded-full border-2 border-[var(--color-brand-card)] bg-[var(--color-brand-green)] text-white">${ICON('check', 'size-3')}</span></span><span class="min-w-0 flex-1"><span class="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${t}</span><span class="block truncate text-xs ${MUTED}">${k} · ${d} · ${n} mo</span></span>${amt(a, 'text-[0.9375rem] font-medium')}</button>`
    const nudge = `<button type="button" data-d8-open="valu" class="mx-4 mt-3 flex w-[calc(100%-2rem)] items-center gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4 text-start">${brand('valu', 44)}<span class="min-w-0 flex-1"><span class="block text-xs font-semibold text-[var(--color-brand-primary-ink)]">Next to clear</span><span class="block text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">iPhone 16 · valU · 6 payments left</span><span class="mt-1.5 block">${bar(50)}</span></span>${CHEV}</button>`
    return debtsBar(st, true) + heroC + `<div class="mx-5 mb-2 mt-6 text-[0.6875rem] font-bold uppercase tracking-[0.08em] ${MUTED}">Cleared, newest first</div><div class="mx-4 divide-y divide-[var(--color-brand-border)] overflow-hidden ${CARDBOX}">${CLEARED.map(row).join('')}</div>` + nudge + '<div class="h-6"></div>'
  }

  /* ---- detail page: providerView back row, rounded tinted hero, one CTA, sections ---- */
  const backRow = `<div class="mx-4 mt-2 flex items-center"><button type="button" data-d8-back class="-ms-2 inline-flex h-11 items-center gap-1 px-2 text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${ICON('chevron-left', 'size-5')}Debts</button><button type="button" data-d8-menu aria-label="More actions" class="ms-auto -me-1.5 flex size-11 items-center justify-center rounded-full text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-elevated)]">${ICON('ellipsis', 'size-5')}</button></div>`
  const pillH = (t) => `<span class="inline-flex min-h-7 items-center rounded-full bg-[color-mix(in_oklab,var(--flow-band-fg)_14%,transparent)] px-3 text-[0.78125rem] font-semibold">${t}</span>`
  const heroD = (d, inner) => `<section class="mx-4 mt-1 overflow-hidden rounded-3xl px-[18px] pb-4 pt-4 text-[var(--flow-band-fg)]" style="background:linear-gradient(120deg, var(--flow-band-a) 0%, var(--flow-band-b) 100%)"><div class="flex items-center gap-3"><span class="rounded-[13px] bg-[var(--flow-band-fg)] p-0.5">${d.lead(40)}</span><span class="min-w-0 flex-1"><span class="block truncate text-[1.0625rem] font-bold">${d.kind === 'install' ? d.title : d.title}</span><span class="block truncate text-[0.78125rem] opacity-80">${d.sub}</span></span></div>${inner}</section>`
  const heroBar = (p) => `<div class="relative mt-3 h-1.5 rounded-full" style="background: var(--flow-band-mix);"><div class="h-full rounded-full bg-[var(--flow-band-fg)]" style="width:${p}%"></div></div>`
  const cta = (label) => `<div class="mx-4 mt-3"><button type="button" data-d8-pay class="${BTN.primary} ${SZ.block}">${ICON('plus', 'size-[18px]')}${label}</button></div>`
  const quiet = (links) => `<div class="mx-4 mt-1 flex justify-center gap-2">${links.map(([a, l, ic]) => `<button type="button" ${a} class="inline-flex h-11 items-center gap-1.5 px-3 text-[0.875rem] font-semibold text-[var(--color-brand-primary-ink)]">${ICON(ic, 'size-4')}${l}</button>`).join('')}</div>`
  const facts = (rows, title) => `${sectionHead(title).replace('pt-1', 'pt-5')}<div class="mx-4 divide-y divide-[var(--color-brand-border)] overflow-hidden ${CARDBOX}">${rows.filter(Boolean).map(([k, v]) => `<div class="flex min-h-[52px] items-center gap-3 px-4"><span class="w-[112px] shrink-0 text-[0.84375rem] ${SECOND}">${k}</span><span class="flex min-w-0 flex-1 items-center justify-end gap-2 text-end text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]">${v}</span></div>`).join('')}</div>`
  const mono = (n) => `<span class="font-mono-numbers">${f0(n)}</span>`
  /* money movement rows: the Flow TransactionRow look (as in today's Payments list) */
  const moveRow = (d, [date, pm, n], i, inbound) => `${i ? '<div class="ms-[68px] h-px bg-[var(--color-brand-border)]"></div>' : ''}<button type="button" data-toast="Opens this payment in Flow" class="flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-start hover:bg-[var(--color-brand-elevated)]">${d.lead(40)}<span class="min-w-0 flex-1"><span class="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${inbound ? `${d.who} paid you back` : d.kind === 'install' ? `${d.who} · ${date.split(' ')[0]}` : `${d.title} · ${date.split(' ')[0]}`}</span><span class="mt-1.5 block truncate font-mono-numbers text-xs font-medium ${MUTED}">${date} · ${pmName(pm)}</span></span><span class="shrink-0 font-mono-numbers text-[0.9375rem] font-medium tabular-nums" style="color:${inbound ? 'var(--color-brand-green)' : 'var(--color-brand-text-primary)'}">${inbound ? '+' : MINUS}${f0(n)}</span></button>`
  const log = (d, rows, title, emptyTitle, emptyBody) => `${sectionHead(title, rows.length ? `<span class="font-mono-numbers text-[0.6875rem] ${MUTED}">${rows.length}</span>` : '').replace('pt-1', 'pt-5')}${rows.length ? `<div class="mx-4 overflow-hidden ${CARDBOX}">${rows.map((r, i) => moveRow(d, r, i, d.dir === 'owed')).join('')}</div>` : ltEmpty({ icon: 'receipt', tone: 'neutral', title: emptyTitle, body: emptyBody, size: 'section' }).replace('mt-3', 'mt-0')}`

  function borrowDetail(k) {
    const d = D[k]
    const owed = d.dir === 'owed'
    const inner = `<p class="mt-4 text-xs font-semibold opacity-80">${owed ? 'Still to get back' : 'Left to pay'}</p><p class="flex items-baseline gap-1.5"><span class="font-mono-numbers text-[32px] font-semibold leading-[1.05] tracking-[-0.04em]">${f0(left(d))}</span><span class="text-[0.8125rem] font-semibold">EGP</span></p>${heroBar(pct(d))}<div class="mt-3 flex flex-wrap gap-2">${pillH(owed ? `${ICON('arrow-down-left', 'size-3.5 me-1')}You lent` : `${ICON('arrow-up-right', 'size-3.5 me-1')}You borrowed`)}${pillH(d.due ? `${owed ? 'Expected' : 'Due'}&nbsp;${d.due}` : 'No due date')}${d.monthly ? pillH(`<span class="font-mono-numbers">${f0(d.monthly)}</span>&nbsp;a month`) : ''}</div>`
    const rows = [
      ['Person', d.kind === 'borrow' && d.who === 'CIB' ? `${brand('cib', 24)}CIB` : d.who],
      ['Direction', owed ? 'They owe you' : 'You owe them'],
      [owed ? 'You lent' : 'Borrowed', mono(d.total)],
      [owed ? 'Paid back' : 'Paid so far', mono(d.paid)],
      ['Left', `<b class="font-mono-numbers font-semibold">${f0(left(d))}</b>`],
      d.n ? ['Payments', `<span class="font-mono-numbers">${d.done} of ${d.n}</span>`] : null,
      ['Due date', d.due ? d.dueLong + (d.ends ? '' : ', 2026') : `<span class="${MUTED}">None set</span>`],
      ['Started', d.started],
      [owed ? 'Paid from' : 'Received in', pmV(d.into)],
    ]
    const links = owed ? [['data-d8-settle', 'Mark settled', 'circle-check'], ['data-d8-remind', `Remind ${d.who}`, 'send']] : [['data-d8-settle', 'Mark settled', 'circle-check'], ['data-d8-remind', 'Remind me', 'bell']]
    return backRow + heroD(d, inner) + cta(owed ? 'Add repayment' : 'Add payment') + quiet(links)
      + log(d, d.log, owed ? 'Repayments' : 'Payments', owed ? 'No repayments yet' : 'No payments yet', owed ? `When ${d.who} pays you back, add it here and it lowers what’s left.` : 'Add a payment when you pay some back.')
      + facts(rows, 'Details') + '<div class="h-6"></div>'
  }

  function installDetail(st, k) {
    const d = D[k]
    const segs = `<div class="mt-3 flex h-1.5 gap-[3px]" aria-hidden="true">${d.months.map((_, i) => `<span class="h-full flex-1 rounded-full" style="background:${i < d.done ? 'var(--flow-band-fg)' : 'var(--flow-band-mix)'}${i === d.done ? ';box-shadow:inset 0 0 0 1.5px var(--flow-band-fg)' : ''}"></span>`).join('')}</div>`
    const inner = `<p class="mt-4 text-xs font-semibold opacity-80">Left to pay</p><p class="flex items-baseline gap-1.5"><span class="font-mono-numbers text-[32px] font-semibold leading-[1.05] tracking-[-0.04em]">${f0(left(d))}</span><span class="text-[0.8125rem] font-semibold">EGP</span><span class="ms-auto font-mono-numbers text-[0.8125rem] font-semibold">${d.done} of ${d.n} paid</span></p>${segs}<p class="mt-2 text-xs opacity-80">Last payment ${d.ends} · total cost <b class="font-mono-numbers">${f0(d.total)}</b></p>`
    const next = `<div class="mx-4 mt-3 ${CARDBOX} p-4"><div class="flex items-start gap-3"><span class="min-w-0 flex-1"><span class="block text-[0.6875rem] font-bold uppercase tracking-[0.08em] ${MUTED}">Next payment</span><span class="mt-1 flex items-baseline gap-1.5"><span class="font-mono-numbers text-[1.5rem] font-semibold tracking-[-0.03em] text-[var(--color-brand-text-primary)]">${f0(d.monthly)}</span><span class="text-[0.8125rem] ${MUTED}">EGP</span></span><span class="mt-0.5 block text-[0.8125rem] ${SECOND}">${d.dueLong} · in ${d.days} days</span></span><span class="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-[var(--color-brand-elevated)] px-2.5 text-[0.75rem] font-semibold ${SECOND}">${ICON('calendar', 'size-3.5')}Payment ${d.done + 1}</span></div><div class="mt-3 flex items-center gap-2 border-t border-[var(--color-brand-border)] pt-3 text-[0.8125rem] ${SECOND}">${brand(d.card, 24)}<span class="min-w-0 flex-1 truncate">Charged to ${pmName(d.card)}</span></div></div>`
    const all = st.d8sched
    const row = (m, i) => {
      const state = i < d.done ? 'paid' : i === d.done ? 'next' : 'up'
      const dot = state === 'paid' ? `<span aria-hidden="true" class="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-green-soft)] text-[var(--color-brand-green)]">${ICON('check', 'size-3.5')}</span>`
        : state === 'next' ? '<span aria-hidden="true" class="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-[var(--color-brand-primary)]"><span class="size-2 rounded-full bg-[var(--color-brand-primary)]"></span></span>'
          : '<span aria-hidden="true" class="size-6 shrink-0 rounded-full border-2 border-dashed border-[var(--color-brand-border-strong)]"></span>'
      const tag = { paid: `<span class="text-xs font-semibold text-[var(--color-brand-green)]">Paid</span>`, next: `<span class="text-xs font-semibold text-[var(--color-brand-primary-ink)]">Next</span>`, up: `<span class="text-xs ${MUTED}">Upcoming</span>` }[state]
      return `<div class="flex min-h-[52px] items-center gap-3 px-4 ${state === 'next' ? 'bg-[var(--color-brand-primary-soft)]' : ''}">${dot}<span class="min-w-0 flex-1"><span class="block text-[0.875rem] font-semibold ${state === 'up' ? SECOND : 'text-[var(--color-brand-text-primary)]'}">Payment ${i + 1}</span><span class="block text-xs ${MUTED}">${m.includes(',') ? m : `${m}, 2026`}</span></span><span class="text-end"><span class="block font-mono-numbers text-[0.9375rem] font-medium ${state === 'up' ? SECOND : 'text-[var(--color-brand-text-primary)]'}">${f0(d.monthly)}</span>${tag}</span></div>`
    }
    const shown = d.months.map((m, i) => [m, i]).filter(([, i]) => all || i >= d.done - 1)
    const sched = `${sectionHead('Schedule', `<span class="font-mono-numbers text-[0.6875rem] ${MUTED}">${d.done} of ${d.n} paid</span>`).replace('pt-1', 'pt-5')}<div class="mx-4 divide-y divide-[var(--color-brand-border)] overflow-hidden ${CARDBOX}">${all ? '' : `<button type="button" data-d8-sched class="flex min-h-11 w-full items-center justify-center gap-1 text-[0.8125rem] font-semibold text-[var(--color-brand-primary-ink)]">${ICON('chevron-up', 'size-4')}Show ${d.done - 1} earlier payments</button>`}${shown.map(([m, i]) => row(m, i)).join('')}${all ? `<button type="button" data-d8-sched class="flex min-h-11 w-full items-center justify-center gap-1 text-[0.8125rem] font-semibold text-[var(--color-brand-primary-ink)]">${ICON('chevron-up', 'size-4')}Show less</button>` : ''}</div>`
    const plan = facts([
      ['Provider', `${brand('valu', 24)}valU`],
      ['Purchase', d.title],
      ['Price', mono(d.price)],
      ['Admin fee', mono(d.fee)],
      ['Interest', `${mono(d.interest)} <span class="${MUTED}">· 10%</span>`],
      ['Total cost', `<b class="font-mono-numbers font-semibold">${f0(d.total)}</b>`],
      ['Linked card', pmV(d.card)],
      ['Started', d.started],
    ], 'Plan')
    const paid = d.months.slice(0, d.done).map((m) => [m, d.card, d.monthly]).reverse()
    return backRow + heroD(d, inner) + cta(`Pay ${f0(d.monthly)}`) + quiet([['data-d8-pay="early"', 'Pay early or pay off', 'zap']]) + next + sched
      + log(d, paid.slice(0, 3), 'Payments', 'No payments yet', 'Your first payment shows here once it’s paid.') + plan + '<div class="h-6"></div>'
  }

  function emptyView() {
    return ltEmpty({ icon: 'shield-check', tone: 'positive', title: 'No debts to track', body: 'Staying at zero is the goal. Add one if you borrow, pay in installments or carry a card balance.', primary: 'Add a debt', secondary: `See ${CLEARED.length} cleared debts` })
      .replace('data-toast="Add a debt"', 'data-open4="adddebt"').replace(`data-toast="See ${CLEARED.length} cleared debts"`, 'data-d8-cleared') + '<div class="h-6"></div>'
  }

  P8.debts = (st) => {
    st.d8opt = st.d8opt || 'A'
    st.d8tab = st.d8tab || 'borrow'
    if (st.d8detail) return D[st.d8detail].kind === 'install' ? installDetail(st, st.d8detail) : borrowDetail(st.d8detail)
    if (st.d8view === 'cleared') return clearedView(st)
    if (st.d8empty) return emptyView()
    return listView(st)
  }

  /* ---- sheets ---- */
  const cur = (S) => D[S.st.d8detail] || D.valu
  const curKey = (S) => (D[S.st.d8detail] ? S.st.d8detail : 'valu')
  F8.d8menu = (S) => {
    const k = curKey(S); const d = D[k]
    const extra = d.kind === 'install' ? ['early', 'Pay off early', `Clear all ${f0(left(d))} today`, 'zap'] : ['settle', 'Mark settled', d.dir === 'owed' ? 'They paid you back in full' : 'You paid it all back', 'circle-check']
    const items = [['edit', 'Edit', d.kind === 'install' ? 'Plan, fees, card, dates' : 'Amount, person, due date', 'pencil'], extra, ['delete', 'Delete', 'Removes it and its payment links', 'trash-2']]
    const row = ([v, t, s, ic], i) => `${i ? '<div class="ms-[60px] h-px bg-[var(--color-brand-border)]"></div>' : ''}<button type="button" data-m="${v}" class="flex min-h-[56px] w-full items-center gap-3 px-4 py-2.5 text-start hover:bg-[var(--color-brand-elevated)]"><span aria-hidden="true" class="flex size-9 shrink-0 items-center justify-center rounded-[11px] ${v === 'delete' ? 'bg-[var(--color-brand-red-soft)] text-[var(--color-brand-red)]' : `bg-[var(--color-brand-elevated)] ${SECOND}`}">${ICON(ic, 'size-[18px]')}</span><span class="min-w-0 flex-1"><span class="block text-[0.9375rem] font-semibold ${v === 'delete' ? 'text-[var(--color-brand-red)]' : 'text-[var(--color-brand-text-primary)]'}">${t}</span><span class="block text-xs ${MUTED}">${s}</span></span></button>`
    const sh = ltSheet(S, d.kind === 'install' ? `${d.title} · ${d.who}` : d.title, '', `<div class="mx-4 overflow-hidden ${CARDBOX}">${items.map(row).join('')}</div><div class="h-4"></div>`, '', 220)
    sh.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-m]'); if (!b) return
      sh.close()
      const m = b.dataset.m
      if (m === 'edit') return d.kind === 'install' ? AFTER.s_install(S) : AFTER.s_borrow(S)
      if (m === 'early') return F8.d8pay(S, 'early')
      if (m === 'settle') return settle(S, d)
      ltAlert(S, `Delete ${d.kind === 'install' ? d.title : d.title}?`, `Its ${d.kind === 'install' ? 'schedule and ' : ''}payments stay in Flow as normal transactions. This can’t be undone.`, [['solidDanger', 'Delete', () => { if (S.st.d8detail) { S.st.d8detail = null; render(S) } toast(S, 'Debt deleted') }], ['ghost', 'Cancel']])
    })
  }
  const settle = (S, d) => ltAlert(S, `Mark ${d.title} settled?`, `${f0(left(d))} EGP left will be marked as ${d.dir === 'owed' ? 'paid back to you' : 'paid'}. It moves to your cleared debts.`, [['primary', 'Mark settled', () => { S.st.d8detail = null; S.st.d8view = 'cleared'; S.scroll.scrollTop = 0; render(S); toast(S, `${d.title} moved to cleared debts`) }], ['ghost', 'Cancel']])
  /* PayDebtForm: amount hero, debt, from, date */
  F8.d8pay = (S, mode) => {
    const k = curKey(S); const d = D[k]
    const owed = d.dir === 'owed'
    const each = d.monthly || Math.min(1000, left(d))
    const st = { amt: f0(mode === 'early' ? left(d) : each), mode: mode === 'early' ? 'off' : 'one', pm: d.card || d.into, date: 'Today' }
    form4(S, {
      title: owed ? `${d.who} paid you back` : d.kind === 'install' ? `Pay ${d.who}` : `Pay ${d.title}`, sub: d.kind === 'install' ? `${d.title} · payment ${d.done + 1} of ${d.n}` : '', state: st,
      lead: `<span class="me-0.5">${d.lead(40)}</span>`,
      body: (s) => `${hero4({ amt: s.amt, ctl: unit4('EGP'), line: `${f0(left(d))} → ${f0(Math.max(0, left(d) - num4(s.amt)))} left${num4(s.amt) >= left(d) ? ' · cleared' : ''}` })}${d.kind === 'install' ? seg4('mode', [['one', `This payment · ${f0(each)}`], ['off', `Pay off · ${f0(left(d))}`]], s.mode) : ''}${grp4([row4(owed ? 'Received in' : 'Paid from', pmV(s.pm), 'pm'), date4('Date', s.date)], '', d.kind === 'install' && s.mode === 'off' ? 'Paying early can lower the interest. valU confirms the final amount.' : owed ? 'Adds the money to that account.' : 'Logged as a debt payment, not as spending.')}`,
      foot: () => foot4(owed ? 'Add repayment' : 'Add payment'), done: owed ? 'Repayment added' : 'Payment added',
      onChange: (s) => { if (d.kind === 'install') s.amt = f0(s.mode === 'off' ? left(d) : each) },
      on: { pm: (v, draw, s) => ltAcctPick(S, s.pm, (m) => { s.pm = m; draw() }) },
    })
  }
  const toDebts = (S) => { if (S.st.page !== 'debts') setPage('debts') }
  const openDetail = (S, k) => {
    toDebts(S)
    const d = D[k]
    if (d.kind === 'card') return typeof F8.card8 === 'function' ? F8.card8(S, k) : toast(S, 'Opens the shared card sheet with Pay and Pay off')
    S.st.d8detail = k; S.st.d8sched = false; S.scroll.scrollTop = 0; render(S)
  }
  F8.d8borrow = (S) => openDetail(S, 'mona')
  F8.d8lent = (S) => openDetail(S, 'omar')
  F8.d8install = (S) => openDetail(S, 'valu')
  F8.d8cleared = (S) => { toDebts(S); S.st.d8detail = null; S.st.d8empty = false; S.st.d8view = 'cleared'; S.scroll.scrollTop = 0; render(S) }
  F8.d8empty = (S) => { toDebts(S); S.st.d8detail = null; S.st.d8view = null; S.st.d8empty = !S.st.d8empty; S.scroll.scrollTop = 0; render(S) }
  F8.d8addpay = (S) => F8.d8pay(S)
  T8.d8cleared = (S) => AFTER.s_vault(S)
  T8.d8empty = (S) => { toDebts(S); S.st.state = S.st.state === 'emptydebts' ? null : 'emptydebts'; render(S) }
  SHEETS8.push(['d8borrow', 'Borrow detail'], ['d8lent', 'Owed to you, no payments'], ['d8install', 'Installment detail'], ['d8cleared', 'Cleared debts'], ['d8menu', 'Debt ⋯ menu'], ['d8addpay', 'Add payment'], ['d8empty', 'No debts (toggle)'])

  document.addEventListener('click', (e) => {
    const S = screenOf(e.target)
    if (!S || S.st.v7 || S.st.page !== 'debts' || e.target.closest('[data-layer-root]')) return
    const t = e.target
    const hit = (a) => t.closest(`[${a}]`)
    let b
    if ((b = hit('data-d8-opt'))) { e.stopPropagation(); S.st.d8opt = b.dataset.d8Opt; return render(S) }
    if ((b = hit('data-d8-tab'))) { e.stopPropagation(); S.st.d8tab = b.dataset.d8Tab; S.st.d8view = null; return render(S) }
    if (hit('data-d8-cleared')) { e.stopPropagation(); S.st.d8empty = false; S.st.d8view = S.st.d8view === 'cleared' ? null : 'cleared'; S.scroll.scrollTop = 0; return render(S) }
    if ((b = hit('data-d8-open'))) { e.stopPropagation(); S.st.d8view = null; return openDetail(S, b.dataset.d8Open) }
    if (hit('data-d8-back')) { e.stopPropagation(); S.st.d8detail = null; S.scroll.scrollTop = 0; return render(S) }
    if (hit('data-d8-menu')) { e.stopPropagation(); return F8.d8menu(S) }
    if ((b = hit('data-d8-pay'))) { e.stopPropagation(); return F8.d8pay(S, b.dataset.d8Pay) }
    if (hit('data-d8-sched')) { e.stopPropagation(); S.st.d8sched = !S.st.d8sched; return render(S) }
    if (hit('data-d8-settle')) { e.stopPropagation(); return settle(S, cur(S)) }
    if (hit('data-d8-remind')) { e.stopPropagation(); const d = cur(S); return toast(S, d.dir === 'owed' ? `Opens a message to ${d.who} with the amount and date` : `Reminder set for ${d.dueLong}`) }
  }, true)

  NOTES8.debts = 'Tabs Borrow · Installments · Cards list debts only; money owed to you is its own section with its own total. Cleared debts sit behind the trophy chip, as in Goals. Tap a debt for its detail page (⋯ for Edit and Delete, Add payment as the button, payments inside). Flip Option A / B at the top to compare the two row styles.'
}
