/* ================= round 9 · Debts (D5, owner point 13; round 9 debts list) ================= */
{
  /* icons passed by name below; listed literally so build8.sh adds them to the sprite:
     ICON('circle-check') ICON('send') ICON('bell') ICON('zap') ICON('pencil') ICON('trash-2') ICON('wrench') ICON('laptop') ICON('receipt') ICON('shield-check')
     ICON('ellipsis-vertical') ICON('calendar-clock') ICON('smartphone') ICON('refrigerator') ICON('sofa') ICON('car') ICON('package') ICON('credit-card') ICON('user') ICON('search') */
  /* ---- sample data (same as Accounts): owed total 76,620 = 33,000 + 3,000 + 8,400 + QNB 22,200 (4,200 + 18,000 in plans) + CIB Platinum 8,420 + HSBC 1,600 ---- */
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
    qnb: { kind: 'card', title: 'QNB Visa', who: 'QNB', sub: '••5512', lead: (s) => brand('qnb', s), owed: 4200, limit: 40000, min: 210, due: 'Nov 10', dueLong: 'Tue, Nov 10', days: 13 },
    cibcc: { kind: 'card', title: 'CIB Platinum', who: 'CIB', sub: '••7781', lead: (s) => brand('cib', s), owed: 8420, limit: 30000, min: 420, due: 'Nov 15', dueLong: 'Sun, Nov 15', days: 18 },
    hsbc: { kind: 'card', title: 'HSBC Credit', who: 'HSBC', sub: '••4471', lead: (s) => brand('hsbc', s), owed: 1600, limit: 15000, min: 80, due: 'Nov 18', dueLong: 'Wed, Nov 18', days: 21 },
  }
  const TABS = [['borrow', 'Borrow', ['car', 'mona']], ['install', 'Installments', ['valu']], ['cards', 'Cards', ['qnb', 'cibcc', 'hsbc']]]
  const OWED_TO_YOU = ['karim', 'omar']
  /* same four as today's cleared vault: 54,800 paid off, last one Mar 2025 */
  const CLEARED = [['Ahmed', 'Borrow', 'Mar 2025', 15000, 10, (s) => AVATAR('A', PERSON_TONE, s)], ['Car repair', 'Borrow', 'Jan 2025', 18000, 6, () => TINT('wrench', TONE.amber)], ['valU · TV', 'Installment', 'Oct 2024', 12000, 12, (s) => brand('valu', s)], ['NBE Titanium', 'Credit card', 'Aug 2024', 9800, 3, (s) => brand('nbe', s)]]
  const CLEARED_TOTAL = CLEARED.reduce((s, c) => s + c[3], 0)

  const left = (d) => (d.kind === 'card' ? d.owed + (CARD_PLANS[d.who.toLowerCase()]?.left || 0) : d.total - d.paid)
  const pct = (d) => (d.kind === 'card' ? Math.round((d.owed / d.limit) * 100) : Math.round((d.paid / d.total) * 100))
  const EGP = `<span class="text-[0.6875rem] font-normal ${MUTED}">EGP</span>`
  const amt = (n, cls = 'text-[0.9375rem] font-semibold') => `<span class="whitespace-nowrap font-mono-numbers ${cls} tabular-nums text-[var(--color-brand-text-primary)]">${f0(n)} ${EGP}</span>`
  const bar = (p, tone = 'var(--color-brand-primary)') => `<span aria-hidden="true" class="block h-1.5 overflow-hidden rounded-full bg-[var(--color-brand-elevated)]"><span class="block h-full rounded-full" style="width:${p}%;background:${tone}"></span></span>`
  const barTone = (d) => (d.kind === 'card' ? (pct(d) >= 80 ? 'var(--color-brand-red)' : pct(d) >= 50 ? 'var(--color-brand-amber)' : 'var(--color-brand-primary)') : d.dir === 'owed' ? 'var(--color-brand-green)' : 'var(--color-brand-primary)')
  const dueText = (d) => (d.due ? `${d.dir === 'owed' ? 'Expected' : 'Due'} ${d.due}` : 'No due date')
  const line2 = (d) => (d.kind === 'card' ? (CARD_PLANS[d.who.toLowerCase()] ? `${f0(d.owed)} on the card + ${f0(CARD_PLANS[d.who.toLowerCase()].left)} in ${CARD_PLANS[d.who.toLowerCase()].n} plans` : `Due ${d.due} · minimum ${f0(d.min)}`) : d.monthly ? `${f0(d.monthly)} a month · ${dueText(d)}` : dueText(d))
  const line3 = (d) => (d.kind === 'card' ? (CARD_PLANS[d.who.toLowerCase()] ? '' : `${pct(d)}% of ${f0(d.limit)} limit`) : d.n ? `${d.n - d.done} of ${d.n} left` : `${f0(d.paid)} of ${f0(d.total)} ${d.dir === 'owed' ? 'back' : 'paid'}`)

  /* card plans live inside their card (round 9): one summary, never a second debt */
  const CARD_PLANS = { qnb: { n: 2, monthly: 2400, left: 18000 } }
  const planLine = (k) => { const p = CARD_PLANS[k]; return p ? `Installments: ${p.n} plans · ${f0(p.monthly)} a month · ${f0(p.left)} left` : '' }
  /* provider badge beside the item name (BADGE.muted, the app's Badge) */
  const provBadge = (t) => `<span class="inline-flex h-5 shrink-0 items-center rounded-md px-1.5 text-[0.6875rem] font-semibold ${BADGE.muted}">${t}</span>`

  /* DebtsActiveList row, a little taller, with one meta line and the bar */
  const rowA = (k, i) => {
    const d = D[k]
    const name = d.kind === 'install' ? `<span class="min-w-0 truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${d.title}</span>${provBadge(d.who)}${i === 0 ? new9() : ''}` : `<span class="min-w-0 truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${d.kind === 'card' ? `${d.title} ${d.sub}` : d.title}</span>`
    const plan = d.kind === 'card' && CARD_PLANS[k] ? `<span class="mt-1.5 flex items-start gap-1.5 text-xs font-medium leading-snug ${SECOND}">${ICON('calendar-clock', 'mt-px size-3.5 shrink-0')}<span class="min-w-0">${planLine(k)}${new9()}</span></span>` : ''
    return `${i ? '<div class="ms-[68px] h-px bg-[var(--color-brand-border)]"></div>' : ''}<button type="button" data-d8-open="${k}" class="flex min-h-[84px] w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-[var(--color-brand-elevated)]">${d.lead(40)}<span class="min-w-0 flex-1"><span class="flex items-baseline gap-2"><span class="flex min-w-0 flex-1 items-center gap-1.5">${name}</span>${d.dir === 'owed' ? `<span class="whitespace-nowrap font-mono-numbers text-[0.9375rem] font-semibold tabular-nums text-[var(--color-brand-green)]">+${f0(left(d))} ${EGP}</span>` : amt(left(d))}</span><span class="mt-0.5 flex items-baseline gap-2 text-xs ${MUTED}"><span class="min-w-0 flex-1 truncate">${line2(d)}</span><span class="shrink-0 font-mono-numbers">${line3(d)}</span></span><span class="mt-2 block">${bar(pct(d), barTone(d))}</span>${plan}</span></button>`
  }
  const group = (keys) => `<div class="mx-4 overflow-hidden ${CARDBOX}">${keys.map(rowA).join('')}</div>`
  const head = (t, n, right = '') => `<div class="mx-5 mb-2 mt-6 flex min-h-11 items-center"><span class="text-[0.8125rem] font-bold text-[var(--color-brand-text-primary)]">${t}</span><span class="ms-2 font-mono-numbers text-[0.8125rem] font-semibold ${MUTED}">${n}</span><span class="ms-auto">${right}</span></div>`
  const addBtn = `<button type="button" data-d8-add class="inline-flex h-11 items-center gap-1 px-1 text-[0.875rem] font-semibold text-[var(--color-brand-primary-ink)]">${ICON('plus', 'size-4')}Add</button>`
  /* card plans pointer in Installments: opens the card sheet, where the plans live */
  const cardPlansRow = (k) => `<button type="button" data-d8-open="${k}" class="mx-4 mt-3 flex min-h-[64px] w-[calc(100%-2rem)] items-center gap-3 rounded-2xl border border-dashed border-[var(--color-brand-border-strong)] px-4 py-3 text-start">${D[k].lead(40)}<span class="min-w-0 flex-1"><span class="flex items-center text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${CARD_PLANS[k].n} plans on ${D[k].title}${new9()}</span><span class="block truncate text-xs ${MUTED}"><span class="font-mono-numbers">${f0(CARD_PLANS[k].monthly)}</span> a month · <span class="font-mono-numbers">${f0(CARD_PLANS[k].left)}</span> left</span></span>${CHEV}</button>`

  /* tab bar + cleared chip: goalsBar / trophyChip from Goals, own data attributes */
  const clearedChip = `<button type="button" data-d8-cleared aria-label="Cleared debts, ${CLEARED.length}" class="${OPT_BASE} ${OPT_OFF} shrink-0 !h-[42px]">${ICON('trophy', 'size-[18px]')}<span class="font-mono-numbers">${CLEARED.length}</span></button>`
  const debtsBar = (st) => `<div class="mx-4 mt-4 flex items-center gap-2"><div role="tablist" aria-label="Debt type" class="inline-flex min-w-0 flex-1 gap-0.5 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-[3px]">${TABS.map(([k, l]) => `<button type="button" role="tab" aria-selected="${st.d8tab === k}" data-d8-tab="${k}" class="${st.d8tab === k ? SEG_ON : SEG_OFF} !px-2 ${k === 'install' ? 'flex-[1.45]' : ''}"><span class="truncate">${l}</span></button>`).join('')}</div>${clearedChip}</div>`

  const hero = () => heroBand({ label: 'Still owed', big: '76,620', n: 76620, right: ['29% cleared', '31,400 of 108,020 paid'], bar: { pct: 29 }, lnote: noteLine(`Next ${B('3,000')} on Nov 5`, `${B('2 of 3')} paid this month`) }, true)

  function listView(st) {
    const tab = TABS.find((t) => t[0] === st.d8tab)
    const owe = tab[2]
    const oweTotal = owe.reduce((s, k) => s + left(D[k]), 0)
    const label = { borrow: 'You owe', install: 'Plans', cards: 'Credit cards' }[tab[0]]
    let h = hero() + debtsBar(st)
    h += head(label, owe.length, `<span class="flex items-center gap-1"><span class="font-mono-numbers text-[0.8125rem] font-semibold ${SECOND}">${f0(oweTotal)}</span>${addBtn}</span>`) + group(owe)
    if (tab[0] === 'borrow') {
      const t = OWED_TO_YOU.reduce((s, k) => s + left(D[k]), 0)
      h += head('Owed to you', OWED_TO_YOU.length, `<span class="font-mono-numbers text-[0.8125rem] font-semibold text-[var(--color-brand-green)]">+${f0(t)} EGP</span>`) + group(OWED_TO_YOU) + `<p class="mx-5 mt-2 text-xs leading-relaxed ${MUTED}">Not part of Still owed. It shows what others owe you.</p>`
    }
    if (tab[0] === 'install') h += cardPlansRow('qnb') + `<p class="mx-5 mt-2 text-xs leading-relaxed ${MUTED}">A plan paid on a credit card is part of what you owe on that card, so it shows under its card, not as a second debt.</p>`
    if (tab[0] === 'cards') h += `<p class="mx-5 mt-2 text-xs leading-relaxed ${MUTED}">Tap a card to pay it. Its installment plans are inside the card.</p>`
    return h + '<div class="h-6"></div>'
  }

  /* cleared: a page with a back row (the Goals trophy room, for debts) */
  const backRow = `<div class="mx-4 mt-2 flex items-center"><button type="button" data-d8-back class="-ms-2 inline-flex h-11 items-center gap-1 px-2 text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${ICON('chevron-left', 'size-5')}Debts</button>${new9()}</div>`
  function clearedView() {
    const heroC = `<section class="relative mx-4 mt-1 overflow-hidden rounded-3xl px-5 pb-5 pt-4 text-[var(--flow-band-fg)]" style="background:linear-gradient(120deg, var(--flow-band-a) 0%, var(--flow-band-b) 100%)"><span aria-hidden="true" class="pointer-events-none absolute -end-10 -top-12 size-44 rounded-full" style="background:radial-gradient(circle, rgba(255,255,255,.16), transparent 65%)"></span><div class="relative flex items-center gap-4"><span aria-hidden="true" class="flex size-14 shrink-0 items-center justify-center rounded-full bg-[var(--flow-band-fg)] text-[var(--flow-band-b)] shadow-[0_8px_24px_-8px_rgba(0,0,0,.45)]">${ICON('trophy', 'size-7')}</span><div><p class="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[var(--flow-band-fg-2)]">Debts cleared</p><p class="font-mono-numbers text-[2rem] font-semibold leading-tight tracking-[-0.03em]">${CLEARED.length}</p></div><div class="ms-auto text-end"><p class="font-mono-numbers text-[1.0625rem] font-semibold">${f0(CLEARED_TOTAL)}</p><p class="text-[0.71875rem] text-[var(--flow-band-fg-2)]">EGP paid off</p></div></div><div class="relative mt-4 grid grid-cols-3 gap-2">${[['31', 'months paying'], ['3 mo', 'fastest payoff'], ['Mar 2025', 'last cleared']].map(([v, l]) => `<div class="rounded-2xl px-3 py-2.5 text-center" style="background:var(--flow-band-mix)"><p class="font-mono-numbers text-[0.9375rem] font-semibold">${v}</p><p class="text-[0.6875rem] text-[var(--flow-band-fg-2)]">${l}</p></div>`).join('')}</div></section>`
    const row = ([t, k, d, a, n, lead]) => `<button type="button" data-toast="Opens ${esc(t)} with its payments, read only" class="flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-start hover:bg-[var(--color-brand-elevated)]"><span class="relative">${lead(40)}<span aria-hidden="true" class="absolute -bottom-1 -end-1 flex size-5 items-center justify-center rounded-full border-2 border-[var(--color-brand-card)] bg-[var(--color-brand-green)] text-white">${ICON('check', 'size-3')}</span></span><span class="min-w-0 flex-1"><span class="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${t}</span><span class="block truncate text-xs ${MUTED}">${k} · ${d} · ${n} mo</span></span>${amt(a, 'text-[0.9375rem] font-medium')}</button>`
    const nudge = `<button type="button" data-d8-open="valu" class="mx-4 mt-3 flex w-[calc(100%-2rem)] items-center gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4 text-start">${brand('valu', 44)}<span class="min-w-0 flex-1"><span class="block text-xs font-semibold text-[var(--color-brand-primary-ink)]">Next to clear</span><span class="block text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">iPhone 16 · valU · 6 payments left</span><span class="mt-1.5 block">${bar(50)}</span></span>${CHEV}</button>`
    return backRow + `<h1 class="mx-5 mb-3 mt-1 text-[1.375rem] font-bold tracking-[-0.02em] text-[var(--color-brand-text-primary)]">Cleared debts</h1>` + heroC + `<div class="mx-5 mb-2 mt-6 text-[0.6875rem] font-bold uppercase tracking-[0.08em] ${MUTED}">Cleared, newest first</div><div class="mx-4 divide-y divide-[var(--color-brand-border)] overflow-hidden ${CARDBOX}">${CLEARED.map(row).join('')}</div>` + nudge + '<div class="h-6"></div>'
  }

  /* ---- detail sheets (round 9: a single item is a sheet): tinted hero, one CTA, sections ---- */
  const pillH = (t) => `<span class="inline-flex min-h-7 items-center rounded-full bg-[color-mix(in_oklab,var(--flow-band-fg)_14%,transparent)] px-3 text-[0.78125rem] font-semibold">${t}</span>`
  const heroD = (d, inner) => `<section class="mx-4 overflow-hidden rounded-3xl px-[18px] pb-4 pt-4 text-[var(--flow-band-fg)]" style="background:linear-gradient(120deg, var(--flow-band-a) 0%, var(--flow-band-b) 100%)"><div class="flex items-center gap-3"><span class="rounded-[13px] bg-[var(--flow-band-fg)] p-0.5">${d.lead(36)}</span><span class="min-w-0 flex-1 truncate text-[0.8125rem] font-semibold opacity-85">${d.sub}</span>${new9()}</div>${inner}</section>`
  const heroBar = (p) => `<div class="relative mt-3 h-1.5 rounded-full" style="background: var(--flow-band-mix);"><div class="h-full rounded-full bg-[var(--flow-band-fg)]" style="width:${p}%"></div></div>`
  const cta = (label, mode = '') => `<div class="mx-4 mt-3"><button type="button" data-d8s="pay:${mode}" class="${BTN.primary} ${SZ.block}">${ICON('plus', 'size-[18px]')}${label}</button></div>`
  const quiet = (links) => `<div class="mx-4 mt-1 flex justify-center gap-2">${links.map(([a, l, ic]) => `<button type="button" data-d8s="${a}" class="inline-flex h-11 items-center gap-1.5 px-3 text-[0.875rem] font-semibold text-[var(--color-brand-primary-ink)]">${ICON(ic, 'size-4')}${l}</button>`).join('')}</div>`
  /* facts: a row with an action is tappable (amounts open Edit) */
  const facts = (rows, title) => `${sectionHead(title).replace('pt-1', 'pt-5')}<div class="mx-4 divide-y divide-[var(--color-brand-border)] overflow-hidden ${CARDBOX}">${rows.filter(Boolean).map(([k, v, act]) => act
    ? `<button type="button" data-d8s="${act}" class="flex min-h-[52px] w-full items-center gap-3 px-4 text-start hover:bg-[var(--color-brand-elevated)]"><span class="w-[112px] shrink-0 text-[0.84375rem] ${SECOND}">${k}</span><span class="flex min-w-0 flex-1 items-center justify-end gap-2 text-end text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]">${v}${ICON('pencil', `size-3.5 shrink-0 ${MUTED}`)}</span></button>`
    : `<div class="flex min-h-[52px] items-center gap-3 px-4"><span class="w-[112px] shrink-0 text-[0.84375rem] ${SECOND}">${k}</span><span class="flex min-w-0 flex-1 items-center justify-end gap-2 text-end text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]">${v}</span></div>`).join('')}</div>`
  const mono = (n) => `<span class="font-mono-numbers">${f0(n)}</span>`
  /* money movement rows: the Flow TransactionRow look; tap the row to edit that payment */
  const moveRow = (d, [date, pm, n], i, inbound) => `${i ? '<div class="ms-[68px] h-px bg-[var(--color-brand-border)]"></div>' : ''}<button type="button" data-d8s="editpay:${i}" class="flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-start hover:bg-[var(--color-brand-elevated)]">${d.lead(40)}<span class="min-w-0 flex-1"><span class="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${inbound ? `${d.who} paid you back` : d.kind === 'install' ? `${d.who} · ${date.split(' ')[0]}` : `${d.title} · ${date.split(' ')[0]}`}</span><span class="mt-1.5 block truncate font-mono-numbers text-xs font-medium ${MUTED}">${date} · ${pmName(pm)}</span></span><span class="shrink-0 font-mono-numbers text-[0.9375rem] font-medium tabular-nums" style="color:${inbound ? 'var(--color-brand-green)' : 'var(--color-brand-text-primary)'}">${inbound ? '+' : MINUS}${f0(n)}</span></button>`
  const log = (d, rows, title, emptyTitle, emptyBody) => `${sectionHead(title, rows.length ? `<span class="font-mono-numbers text-[0.6875rem] ${MUTED}">${rows.length} · tap to edit</span>` : '').replace('pt-1', 'pt-5')}${rows.length ? `<div class="mx-4 overflow-hidden ${CARDBOX}">${rows.map((r, i) => moveRow(d, r, i, d.dir === 'owed')).join('')}</div>` : ltEmpty({ icon: 'receipt', tone: 'neutral', title: emptyTitle, body: emptyBody, size: 'section' }).replace('mt-3', 'mt-0')}`
  const payRows = (d) => (d.kind === 'install' ? d.months.slice(0, d.done).map((m) => [m, d.card, d.monthly]).reverse().slice(0, 3) : d.log)

  function borrowBody(d) {
    const owed = d.dir === 'owed'
    const inner = `<p class="mt-4 text-xs font-semibold opacity-80">${owed ? 'Still to get back' : 'Left to pay'}</p><p class="flex items-baseline gap-1.5"><span class="font-mono-numbers text-[32px] font-semibold leading-[1.05] tracking-[-0.04em]">${f0(left(d))}</span><span class="text-[0.8125rem] font-semibold">EGP</span></p>${heroBar(pct(d))}<div class="mt-3 flex flex-wrap gap-2">${pillH(owed ? `${ICON('arrow-down-left', 'size-3.5 me-1')}You lent` : `${ICON('arrow-up-right', 'size-3.5 me-1')}You borrowed`)}${pillH(d.due ? `${owed ? 'Expected' : 'Due'}&nbsp;${d.due}` : 'No due date')}${d.monthly ? pillH(`<span class="font-mono-numbers">${f0(d.monthly)}</span>&nbsp;a month`) : ''}</div>`
    const rows = [
      ['Person', d.who === 'CIB' ? `${brand('cib', 24)}CIB` : d.who],
      ['Direction', owed ? 'They owe you' : 'You owe them'],
      [owed ? 'You lent' : 'Borrowed', mono(d.total), 'edit'],
      [owed ? 'Paid back' : 'Paid so far', mono(d.paid)],
      ['Left', `<b class="font-mono-numbers font-semibold">${f0(left(d))}</b>`],
      d.n ? ['Payments', `<span class="font-mono-numbers">${d.done} of ${d.n}</span>`] : null,
      d.monthly ? ['Each month', mono(d.monthly), 'edit'] : null,
      ['Due date', d.due ? d.dueLong + (d.ends ? '' : ', 2026') : `<span class="${MUTED}">None set</span>`],
      ['Started', d.started],
      [owed ? 'Paid from' : 'Received in', pmV(d.into)],
    ]
    const links = owed ? [['remind', `Remind ${d.who}`, 'send']] : [['remind', 'Remind me', 'bell']]
    return heroD(d, inner) + cta(owed ? 'Add repayment' : 'Add payment') + quiet(links)
      + log(d, d.log, owed ? 'Repayments' : 'Payments', owed ? 'No repayments yet' : 'No payments yet', owed ? `When ${d.who} pays you back, add it here and it lowers what’s left.` : 'Add a payment when you pay some back.')
      + facts(rows, 'Details') + '<div class="h-6"></div>'
  }

  function installBody(d, all) {
    const segs = `<div class="mt-3 flex h-1.5 gap-[3px]" aria-hidden="true">${d.months.map((_, i) => `<span class="h-full flex-1 rounded-full" style="background:${i < d.done ? 'var(--flow-band-fg)' : 'var(--flow-band-mix)'}${i === d.done ? ';box-shadow:inset 0 0 0 1.5px var(--flow-band-fg)' : ''}"></span>`).join('')}</div>`
    const inner = `<p class="mt-4 text-xs font-semibold opacity-80">Left to pay</p><p class="flex items-baseline gap-1.5"><span class="font-mono-numbers text-[32px] font-semibold leading-[1.05] tracking-[-0.04em]">${f0(left(d))}</span><span class="text-[0.8125rem] font-semibold">EGP</span><span class="ms-auto font-mono-numbers text-[0.8125rem] font-semibold">${d.done} of ${d.n} paid</span></p>${segs}<p class="mt-2 text-xs opacity-80">Last payment ${d.ends} · total cost <b class="font-mono-numbers">${f0(d.total)}</b></p>`
    const next = `<div class="mx-4 mt-3 ${CARDBOX} p-4"><div class="flex items-start gap-3"><span class="min-w-0 flex-1"><span class="block text-[0.6875rem] font-bold uppercase tracking-[0.08em] ${MUTED}">Next payment</span><span class="mt-1 flex items-baseline gap-1.5"><span class="font-mono-numbers text-[1.5rem] font-semibold tracking-[-0.03em] text-[var(--color-brand-text-primary)]">${f0(d.monthly)}</span><span class="text-[0.8125rem] ${MUTED}">EGP</span></span><span class="mt-0.5 block text-[0.8125rem] ${SECOND}">${d.dueLong} · in ${d.days} days</span></span><span class="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-[var(--color-brand-elevated)] px-2.5 text-[0.75rem] font-semibold ${SECOND}">${ICON('calendar', 'size-3.5')}Payment ${d.done + 1}</span></div><div class="mt-3 flex items-center gap-2 border-t border-[var(--color-brand-border)] pt-3 text-[0.8125rem] ${SECOND}">${brand(d.card, 24)}<span class="min-w-0 flex-1 truncate">Charged to ${pmName(d.card)}</span></div></div>`
    const row = (m, i) => {
      const state = i < d.done ? 'paid' : i === d.done ? 'next' : 'up'
      const dot = state === 'paid' ? `<span aria-hidden="true" class="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-green-soft)] text-[var(--color-brand-green)]">${ICON('check', 'size-3.5')}</span>`
        : state === 'next' ? '<span aria-hidden="true" class="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-[var(--color-brand-primary)]"><span class="size-2 rounded-full bg-[var(--color-brand-primary)]"></span></span>'
          : '<span aria-hidden="true" class="size-6 shrink-0 rounded-full border-2 border-dashed border-[var(--color-brand-border-strong)]"></span>'
      const tag = { paid: `<span class="text-xs font-semibold text-[var(--color-brand-green)]">Paid</span>`, next: `<span class="text-xs font-semibold text-[var(--color-brand-primary-ink)]">Next</span>`, up: `<span class="text-xs ${MUTED}">Upcoming</span>` }[state]
      return `<div class="flex min-h-[52px] items-center gap-3 px-4 ${state === 'next' ? 'bg-[var(--color-brand-primary-soft)]' : ''}">${dot}<span class="min-w-0 flex-1"><span class="block text-[0.875rem] font-semibold ${state === 'up' ? SECOND : 'text-[var(--color-brand-text-primary)]'}">Payment ${i + 1}</span><span class="block text-xs ${MUTED}">${m.includes(',') ? m : `${m}, 2026`}</span></span><span class="text-end"><span class="block font-mono-numbers text-[0.9375rem] font-medium ${state === 'up' ? SECOND : 'text-[var(--color-brand-text-primary)]'}">${f0(d.monthly)}</span>${tag}</span></div>`
    }
    const shown = d.months.map((m, i) => [m, i]).filter(([, i]) => all || i >= d.done - 1)
    const tog = (l, ic) => `<button type="button" data-d8s="sched" class="flex min-h-11 w-full items-center justify-center gap-1 text-[0.8125rem] font-semibold text-[var(--color-brand-primary-ink)]">${ICON(ic, 'size-4')}${l}</button>`
    const sched = `${sectionHead('Schedule', `<span class="font-mono-numbers text-[0.6875rem] ${MUTED}">${d.done} of ${d.n} paid</span>`).replace('pt-1', 'pt-5')}<div class="mx-4 divide-y divide-[var(--color-brand-border)] overflow-hidden ${CARDBOX}">${all ? '' : tog(`Show ${d.done - 1} earlier payments`, 'chevron-up')}${shown.map(([m, i]) => row(m, i)).join('')}${all ? tog('Show less', 'chevron-up') : ''}</div>`
    const plan = facts([
      ['Provider', `${brand('valu', 24)}valU`],
      ['Purchase', d.title],
      ['Price', mono(d.price), 'edit'],
      ['Admin fee', mono(d.fee), 'edit'],
      ['Interest', `${mono(d.interest)} <span class="${MUTED}">· 10%</span>`, 'edit'],
      ['Each month', mono(d.monthly), 'edit'],
      ['Total cost', `<b class="font-mono-numbers font-semibold">${f0(d.total)}</b>`],
      ['Paid with', pmV(d.card)],
      ['Started', d.started],
    ], 'Plan')
    return heroD(d, inner) + cta(`Pay ${f0(d.monthly)}`) + next + sched
      + log(d, payRows(d), 'Payments', 'No payments yet', 'Your first payment shows here once it’s paid.') + plan + '<div class="h-6"></div>'
  }

  function emptyView() {
    return ltEmpty({ icon: 'shield-check', tone: 'positive', title: 'No debts to track', body: 'Staying at zero is the goal. Add one if you borrow, pay in installments or carry a card balance.', primary: 'Add a debt', secondary: `See ${CLEARED.length} cleared debts` })
      .replace('data-toast="Add a debt"', 'data-d8-add').replace(`data-toast="See ${CLEARED.length} cleared debts"`, 'data-d8-cleared') + '<div class="h-6"></div>'
  }

  P8.debts = (st) => {
    st.d8tab = st.d8tab || 'borrow'
    if (st.d8view === 'cleared') return clearedView()
    if (st.d8empty) return emptyView()
    return listView(st)
  }

  /* ---- sheets ---- */
  const cur = (S) => D[S.st.d8cur] || D.valu
  const MENU_BTN = `<button type="button" data-d8s="menu" aria-label="More actions" class="${CLOSE_BTN}">${ICON('ellipsis-vertical', 'size-4')}</button>`
  function detailSheet(S, k) {
    const d = D[k]
    S.st.d8cur = k
    let all = false
    const body = () => (d.kind === 'install' ? installBody(d, all) : borrowBody(d))
    const title = d.kind === 'install' ? `${d.title}` : d.title
    const sh = ltSheet(S, title, d.kind === 'install' ? `Installment · ${d.who}` : d.dir === 'owed' ? 'Owed to you' : 'Borrow', body(), '', 110, undefined, MENU_BTN)
    sh.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-d8s]'); if (!b) return
      const [a, v] = b.dataset.d8s.split(':')
      if (a === 'menu') return F8.d8menu(S, sh, b)
      if (a === 'pay') return F8.d8pay(S, v || undefined)
      if (a === 'editpay') return F8.d8pay(S, 'edit', +v)
      if (a === 'edit') return d.kind === 'install' ? F8.d8addinst(S, true) : AFTER.s_borrow(S)
      if (a === 'sched') { all = !all; const y = sh.body.scrollTop; sh.body.innerHTML = body(); sh.body.scrollTop = y; return }
      if (a === 'remind') return toast(S, d.dir === 'owed' ? `Opens a message to ${d.who} with the amount and date` : `Reminder set for ${d.dueLong}`)
    })
    return sh
  }
  /* vertical 3-dot menu: Edit, Mark settled / Pay off early, Delete */
  /* CardActionMenu (src/components/ui/CardActionMenu.tsx): popover anchored to the tapped ⋮, scrim-dismissed */
  F8.d8menu = (S, parent, trigger) => {
    const d = cur(S)
    const extra = d.kind === 'install' ? ['early', 'Pay off early', `Clear all ${f0(left(d))} today`, 'zap'] : ['settle', 'Mark settled', d.dir === 'owed' ? 'They paid you back in full' : 'You paid it all back', 'circle-check']
    const items = [['edit', 'Edit', '', 'pencil'], extra, ['delete', 'Delete', '', 'trash-2']]
    const WIDTH = 216
    const root = S.vp.querySelector('[data-layer-root]')
    const vr = S.vp.getBoundingClientRect()
    const a = (trigger || parent?.el.querySelector('[data-d8s="menu"]'))?.getBoundingClientRect() || { right: vr.right - 16, bottom: vr.top + 120 }
    const x = Math.max(8,Math.min(a.right - vr.left - WIDTH, vr.width - WIDTH - 8))
    const top = Math.min(a.bottom - vr.top + 6, vr.height - 8 - items.length * 44 - 40)
    const row = ([v, t, s, ic], i) => `<button type="button" role="menuitem" data-m="${v}" class="flex min-h-11 w-full items-center gap-2.5 px-3.5 py-2 text-start text-sm font-medium" style="color:${v === 'delete' ? 'var(--color-brand-red)' : 'var(--color-brand-text-primary)'};${i ? 'border-top:1px solid var(--color-brand-border)' : ''}">${ICON(ic, 'size-4 shrink-0')}<span class="flex min-w-0 flex-col"><span class="truncate">${t}</span>${s ? `<span class="truncate text-[0.71875rem] font-normal text-[var(--color-brand-text-muted)]">${s}</span>` : ''}</span></button>`
    const scrim = document.createElement('div')
    scrim.className = 'fixed inset-0'
    scrim.style.zIndex = '400'
    scrim.setAttribute('role', 'presentation')
    scrim.innerHTML = `<div role="menu" class="absolute overflow-hidden rounded-[14px] border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]" style="top:${top}px;left:${x}px;width:${WIDTH}px;box-shadow:var(--shadow-lg)"><div class="flex items-center truncate border-b border-[var(--color-brand-border)] px-3.5 py-2 text-[0.71875rem] font-semibold text-[var(--color-brand-text-muted)]">${d.title}${new9()}</div>${items.map(row).join('')}</div>`
    root.append(scrim)
    const sh = { close: () => scrim.remove() }
    scrim.addEventListener('click', (e) => {
      const b = e.target.closest('[data-m]')
      sh.close()
      if (!b) return
      const m = b.dataset.m
      if (m === 'edit') return d.kind === 'install' ? F8.d8addinst(S, true) : AFTER.s_borrow(S)
      if (m === 'early') return F8.d8pay(S, 'early')
      if (m === 'settle') return settle(S, d, parent)
      ltAlert(S, `Delete ${d.title}?`, `Its ${d.kind === 'install' ? 'schedule and ' : ''}payments stay in Flow as normal transactions. This can’t be undone.`, [['solidDanger', 'Delete', () => { parent?.close(); toast(S, 'Debt deleted') }], ['ghost', 'Cancel']])
    })
  }
  const settle = (S, d, parent) => ltAlert(S, `Mark ${d.title} settled?`, `${f0(left(d))} EGP left will be marked as ${d.dir === 'owed' ? 'paid back to you' : 'paid'}. It moves to your cleared debts.`, [['primary', 'Mark settled', () => { parent?.close(); S.st.d8view = 'cleared'; S.scroll.scrollTop = 0; render(S); toast(S, `${d.title} moved to cleared debts`) }], ['ghost', 'Cancel']])

  /* PayDebtForm: AmountHero with the shared InlineUnit currency, amount chips, from, date */
  F8.d8pay = (S, mode, idx) => {
    const d = cur(S)
    const owed = d.dir === 'owed'
    const each = d.monthly || Math.min(1000, left(d))
    const edit = mode === 'edit'
    const was = edit ? payRows(d)[idx] : null
    const st = { amt: f0(edit ? was[2] : mode === 'early' ? left(d) : each), cur: 'EGP', pm: edit ? was[1] : d.card || d.into, date: edit ? was[0] : 'Today' }
    const base = left(d) + (edit ? was[2] : 0)
    const line = (s) => { const n = num4(s.amt); return n >= base ? `Clears it · ${f0(base)} → 0 left` : `${f0(base)} → ${f0(base - n)} left` }
    const chips = (s) => {
      const opts = [d.monthly && d.kind !== 'install' ? ['each', `${d.kind === 'install' ? 'This payment' : 'Monthly'} · ${f0(each)}`, each] : null, ['full', `Full amount · ${f0(base)}`, base]].filter(Boolean)
      return `<div class="hide-scrollbar flex justify-center gap-2 overflow-x-auto px-4 pb-1">${opts.map(([k, l, n]) => `<button type="button" data-v="chip:${k}" aria-pressed="${num4(s.amt) === n}" class="${OPT_BASE} ${num4(s.amt) === n ? OPT_ON : OPT_OFF} shrink-0"><span class="font-mono-numbers">${l}</span></button>`).join('')}${new9()}</div>`
    }
    const title = edit ? (owed ? 'Edit repayment' : 'Edit payment') : owed ? `${d.who} paid you back` : d.kind === 'install' ? `Pay ${d.who}` : `Pay ${d.title}`
    form4(S, {
      title, sub: d.kind === 'install' ? `${d.title} · payment ${d.done + 1} of ${d.n}` : '', state: st, z: 220,
      lead: `<span class="me-0.5">${d.lead(40)}</span>`,
      body: (s) => `${hero4({ amt: s.amt, ctl: ctl4('cur', s.cur), line: line(s) })}${chips(s)}${grp4([row4(owed ? 'Received in' : 'Paid from', pmV(s.pm), 'pm'), date4('Date', s.date)], '', mode === 'early' ? 'Paying early can lower the interest. valU confirms the final amount.' : owed ? 'Adds the money to that account.' : 'Logged as a debt payment, not as spending.')}`,
      foot: () => (edit ? foot4('Save', 'Delete payment') : foot4(owed ? 'Add repayment' : 'Add payment')), done: edit ? 'Payment updated' : owed ? 'Repayment added' : 'Payment added', linkDone: 'Payment deleted',
      onInput: (f, s, sh) => { if (f.dataset.in !== 'amt') return; sh.el.querySelector('[data-line]').textContent = line(s); sh.el.querySelectorAll('[data-v^="chip:"]').forEach((c) => { const n = c.dataset.v.endsWith('each') ? each : base; const on = num4(s.amt) === n; c.setAttribute('aria-pressed', on); c.className = `${OPT_BASE} ${on ? OPT_ON : OPT_OFF} shrink-0` }) },
      on: {
        chip: (v, draw, s) => { s.amt = f0(v.dataset.v.endsWith('each') ? each : base); draw() },
        pm: (v, draw, s) => ltMethodPicker(S, s.pm, (m) => { s.pm = m; draw() }),
      },
    })
  }

  /* ---- Add installment: the Add goal C top (type chips, icon tile, name, amount), provider picker below ---- */
  const ITEMS = [['phone', 'Phone', 'smartphone', ['var(--cat-shopping-bg)', 'var(--cat-shopping-fg)']], ['laptop', 'Laptop', 'laptop', ['var(--cat-education-bg)', 'var(--cat-education-fg)']], ['appliance', 'Home appliance', 'refrigerator', ['var(--cat-utilities-bg)', 'var(--cat-utilities-fg)']], ['furniture', 'Furniture', 'sofa', ['var(--cat-rent-bg)', 'var(--cat-rent-fg)']], ['car', 'Car', 'car', ['var(--cat-transport-bg)', 'var(--cat-transport-fg)']], ['custom', 'Other', 'package', ['var(--cat-neutral-bg)', 'var(--cat-neutral-fg)']]]
  const item = (st) => ITEMS.find((c) => c[0] === st.cat)
  const itemIcon = (st) => (st.cat === 'custom' && st.icon ? st.icon : item(st)[2])
  const itemChips = (st) => `<div class="hide-scrollbar flex gap-2 overflow-x-auto px-4 pb-1">${ITEMS.map(([k, l, ic]) => `<button type="button" data-v="set:cat:${k}" class="${OPT_BASE} ${k === st.cat ? OPT_ON : OPT_OFF} shrink-0">${ICON(k === 'custom' && st.icon ? st.icon : ic, 'size-4')}${l}</button>`).join('')}</div>`
  /* gTile from lt-v6.js, fed by the item type */
  const itemTile = (st, s = 64) => `<button type="button" data-v="icon" aria-label="Item icon${st.cat === 'custom' ? ', tap to change' : ''}" class="relative flex shrink-0 items-center justify-center" style="width:${s}px;height:${s}px;border-radius:${s * 0.3}px;background:${item(st)[3][0]};color:${item(st)[3][1]}">${ICON(itemIcon(st), 'size-7')}${st.cat === 'custom' ? `<span aria-hidden="true" class="absolute -bottom-1 -end-1 flex size-6 items-center justify-center rounded-full border-2 border-[var(--color-brand-card)] bg-[var(--color-brand-primary)] text-[var(--color-brand-on-primary)]">${ICON('pencil', 'size-3')}</span>` : ''}</button>`
  /* providers: installment apps and banks (PROVS.bank from Add account) */
  const APPS = [['valu', 'valU', 'Installment app'], ...BNPL.filter((b) => b[0] !== 'valU').map((b) => [b[0], b[1], 'Installment app', b[3][1]])]
  const BANKS = PROVS.bank.map((p) => [p[0], p[1], p[2] || 'Bank', p[3]])
  const PROV_ALL = [...APPS, ...BANKS]
  const provOf = (k) => PROV_ALL.find((p) => p[0] === k)
  const isBank = (k) => BANKS.some((p) => p[0] === k)
  const provMk = (p, s = 36) => (PM[p[0]] ? brand(p[0], s) : `<span aria-hidden="true" class="inline-flex shrink-0 items-center justify-center font-bold text-white" style="width:${s}px;height:${s}px;border-radius:${s * 0.32}px;background:${p[3]};font-size:${s * 0.3}px">${p[0].slice(0, 3)}</span>`)
  function provPicker(S, on, done) {
    let q = ''
    const row = (p) => `<button type="button" data-pv="${esc(p[0])}" role="radio" aria-checked="${p[0] === on}" class="flex min-h-[56px] w-full items-center gap-3 px-4 py-2.5 text-start">${provMk(p, 36)}<span class="min-w-0 flex-1"><span class="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${p[1]}</span><span class="block truncate text-xs ${SECOND}">${p[2]}</span></span>${tick(p[0] === on, false)}</button>`
    const body = () => {
      const secs = [['Installment apps', APPS], ['Banks', BANKS]].map(([h, l]) => [h, l.filter((p) => !q || p[1].toLowerCase().includes(q.toLowerCase()))]).filter(([, l]) => l.length)
      return `<label class="mx-4 mb-3 flex h-11 items-center gap-2.5 rounded-xl bg-[var(--color-brand-elevated)] px-3.5 ${MUTED}">${ICON('search', 'size-[18px] shrink-0')}<input data-pvq type="search" value="${esc(q)}" placeholder="Search providers" aria-label="Search providers" class="min-w-0 flex-1 bg-transparent text-[0.9375rem] text-[var(--color-brand-text-primary)] outline-none placeholder:text-[var(--color-brand-text-muted)]"></label>${secs.map(([h, l]) => `${sectionHead(`${h} · ${l.length}`).replace('pt-1', 'pt-3')}<div class="mx-4 divide-y divide-[var(--color-brand-border)] overflow-hidden ${CARDBOX}">${l.map(row).join('')}</div>`).join('') || `<p class="py-10 text-center text-sm ${MUTED}">No provider called “${esc(q)}”</p>`}<div class="h-4"></div>`
    }
    const sh = ltSheet(S, 'Provider', 'Who you pay the installments to', body(), '', 230)
    sh.el.addEventListener('input', (e) => { if (!e.target.matches('[data-pvq]')) return; q = e.target.value; sh.body.innerHTML = body(); const i = sh.body.querySelector('[data-pvq]'); i.focus(); i.setSelectionRange(q.length, q.length) })
    sh.el.addEventListener('click', (e) => { const b = e.target.closest('[data-pv]'); if (b) { sh.close(); done(b.dataset.pv) } })
  }
  const instNote = (st) => (isBank(st.prov) && PM[st.pm]?.kind === 'Credit'
    ? `Paid on ${PM[st.pm].name}: the plan sits inside that card, in what you owe on it. It isn’t added as a second debt.`
    : `${st.n} × ${st.mode === 'total' ? perPay(st.amt, st.n) : st.amt} · Paid with is where each payment comes from.`)
  F8.d8addinst = (S, edit) => form4(S, {
    title: edit ? 'Edit installment' : 'Add installment', z: edit ? 230 : 130,
    state: { cat: 'phone', icon: '', name: 'iPhone 16', amt: '16,800', cur: 'EGP', mode: 'total', prov: 'valu', date: 'Tue, 12 May', pm: 'cib', n: 12, every: 'Month' },
    body: (st) => `<div class="h-1"></div>${itemChips(st)}${hero4({ amt: st.amt, ctl: ctl4('cur', st.cur), top: `<div class="mt-1 flex flex-col items-center">${itemTile(st)}<input data-in="name" aria-label="Item name" value="${esc(st.name)}" placeholder="What did you buy?" class="mt-3 w-full bg-transparent text-center text-[1.0625rem] font-semibold text-[var(--color-brand-text-primary)] outline-none placeholder:text-[var(--color-brand-text-muted)]"></div>`, line: st.mode === 'total' ? `≈ ${perPay(st.amt, st.n)} a payment` : `${f0(num4(st.amt) * st.n)} in total` })}${seg4('mode', [['total', 'Total price'], ['per', 'Per payment']], st.mode)}
      ${grp4([row4('Provider', `${provMk(provOf(st.prov), 24)}<span class="truncate">${provOf(st.prov)[1]}</span>`, 'prov'), date4('Starts', st.date), row4('Paid with', pmV(st.pm), 'pm')], '', '')}
      ${grp4([pick4('Payments', `${st.n}`, 'n'), pick4('Every', st.every, 'every', 'repeat')], 'Payment plan', instNote(st))}${edit ? `<div class="mx-4 mt-4"><button type="button" data-v="del" class="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-[0.875rem] font-semibold text-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-soft)]">${ICON('trash-2', 'size-4')}Delete installment</button></div>` : ''}<div class="h-2"></div>`,
    foot: () => foot4(edit ? 'Save' : 'Add installment'), done: edit ? 'Installment saved' : 'Installment added',
    del: edit ? ['Delete iPhone 16?', 'Its schedule and payments stay in Flow as normal transactions. This can’t be undone.'] : null,
    onInput: (f, st, s) => { if (f.dataset.in === 'amt') s.el.querySelector('[data-line]').textContent = st.mode === 'total' ? `≈ ${perPay(st.amt, st.n)} a payment` : `${f0(num4(st.amt) * st.n)} in total` },
    on: {
      icon: (v, draw, st) => (st.cat === 'custom' ? ltIconPicker(S, st.icon || 'package', (ic) => { st.icon = ic; draw() }) : toast(S, 'Pick Other to choose your own icon')),
      prov: (v, draw, st) => provPicker(S, st.prov, (p) => { st.prov = p; if (isBank(p) && PM[p] && Object.keys(PM).some((k) => PM[k].bank === PM[p].bank && PM[k].kind === 'Credit')) st.pm = Object.keys(PM).find((k) => PM[k].bank === PM[p].bank && PM[k].kind === 'Credit'); draw() }),
      pm: (v, draw, st) => ltMethodPicker(S, st.pm, (m) => { st.pm = m; draw() }),
      n: (v, draw, st) => ltNumPicker(S, 'Number of payments', st.n, [3, 6, 9, 12, 18, 24, 36, 60], (n) => (n === 1 ? 'payment' : 'payments'), (n) => { st.n = n; draw() }),
      every: (v, draw, st) => pickEvery(S, st.every, (e) => { st.every = e; draw() }),
    },
  })
  F8.d8add = (S) => ltOptPicker(S, 'Add a debt', 'Each one opens its own sheet', [['borrow', 'Borrowed money', 'From a person or a bank loan', ['user', ...IC.amber]], ['install', 'Installment plan', 'valU, Contact, banks and others', ['smartphone', ...IC.teal]], ['credit', 'Credit card', 'Opens Add a card with Credit picked', ['credit-card', ...IC.green]]], '', (k) => (k === 'borrow' ? AFTER.s_borrow(S) : k === 'install' ? F8.d8addinst(S) : AFTER.addcredit(S)))

  const toDebts = (S) => { if (S.st.page !== 'debts') setPage('debts') }
  const openDetail = (S, k) => {
    toDebts(S)
    const d = D[k]
    if (d.kind === 'card') return typeof F8.card8 === 'function' ? F8.card8(S, k) : toast(S, 'Opens the shared card sheet with Pay card')
    return detailSheet(S, k)
  }
  const showCleared = (S, on) => { toDebts(S); S.st.d8empty = false; S.st.d8view = on ? 'cleared' : null; S.scroll.scrollTop = 0; render(S) }
  F8.d8borrow = (S) => openDetail(S, 'mona')
  F8.d8lent = (S) => openDetail(S, 'omar')
  F8.d8install = (S) => openDetail(S, 'valu')
  F8.d8cleared = (S) => showCleared(S, true)
  F8.d8empty = (S) => { toDebts(S); S.st.d8view = null; S.st.d8empty = !S.st.d8empty; S.scroll.scrollTop = 0; render(S) }
  F8.d8addpay = (S) => { S.st.d8cur = 'valu'; F8.d8pay(S) }
  F8.d8menuopen = (S) => { const sh = openDetail(S, 'mona'); setTimeout(() => F8.d8menu(S, sh), 350) }
  T8.d8cleared = (S) => AFTER.s_vault(S)
  T8.d8empty = (S) => { toDebts(S); S.st.state = S.st.state === 'emptydebts' ? null : 'emptydebts'; render(S) }
  T8.d8addinst = (S) => AFTER.s_install(S)
  T8.d8add = (S) => AFTER.adddebt(S)
  SHEETS8.push(['d8borrow', 'Borrow detail'], ['d8lent', 'Owed to you, no payments'], ['d8install', 'Installment detail'], ['d8cleared', 'Cleared debts'], ['d8menuopen', 'Debt ⋮ menu'], ['d8addpay', 'Add payment'], ['d8addinst', 'Add installment'], ['d8add', 'Add a debt'], ['d8empty', 'No debts (toggle)'])
  NEW9.push('debts', 'd8borrow', 'd8lent', 'd8install', 'd8cleared', 'd8menuopen', 'd8addpay', 'd8addinst', 'd8add')

  document.addEventListener('click', (e) => {
    const S = screenOf(e.target)
    if (!S || S.st.v7 || S.st.page !== 'debts' || e.target.closest('[data-layer-root]')) return
    const t = e.target
    const hit = (a) => t.closest(`[${a}]`)
    let b
    if ((b = hit('data-d8-tab'))) { e.stopPropagation(); S.st.d8tab = b.dataset.d8Tab; S.st.d8view = null; return render(S) }
    if (hit('data-d8-cleared')) { e.stopPropagation(); return showCleared(S, true) }
    if (hit('data-d8-back')) { e.stopPropagation(); return showCleared(S, false) }
    if (hit('data-d8-add')) { e.stopPropagation(); return F8.d8add(S) }
    if ((b = hit('data-d8-open'))) { e.stopPropagation(); return openDetail(S, b.dataset.d8Open) }
  }, true)

  NOTES8.debts = 'Borrow and installment details are now sheets with a vertical ⋮ (Edit, Mark settled or Pay off early, Delete); cleared debts are a page with a back row. Add payment uses the inline currency with Monthly / Full amount chips, and every payment and amount opens to edit. Installment rows carry the provider as a badge; Add installment uses the Add goal top with a provider picker (apps and banks). A bank plan on a credit card lives under its card (card sheet: “Installments: 2 plans · 2,400 a month · 18,000 left”), not as a second debt. Option B rows were dropped.'
}
