/* ================= round 8: Savings (P8.wealth, owner points 11 and 12, council D4) ================= */
/* icons passed through data, listed so the sprite build picks them up:
   ICON('piggy-bank' ICON('car' ICON('coins' ICON('banknote' ICON('gem' ICON('landmark' ICON('trending-up' ICON('bitcoin'
   ICON('house' ICON('shield-check' ICON('wallet' ICON('arrow-down-left' ICON('arrow-up-right' ICON('pencil' ICON('trash-2'
   ICON('ellipsis' ICON('chevron-left' ICON('calendar-check' ICON('clock' ICON('arrow-left-right' ICON('smartphone' ICON('shapes'
   ICON('scroll-text' ICON('building-2' ICON('check' ICON('circle-dollar-sign' */
{
  /* ---------- the user's own accounts, by provider (same sample as Accounts) ---------- */
  const ACC = {
    cib: [['cib:cur', 'CIB Current', '••1234', 'EGP', 120425, '105,425 free'], ['cib:usd', 'CIB USD', '••6620', 'USD', 1650, '≈ 81,593 EGP'], ['cib:sav', 'CIB Savings', '••3390', 'EGP', 11407, '']],
    qnb: [['qnb:cur', 'QNB Current', '••3018', 'EGP', 30200, ''], ['qnb:sav', 'QNB Savings', '••7720', 'EGP', 17300, '']],
    nbe: [['nbe:cur', 'NBE Current', '••4410', 'EGP', 47000, '']],
    bm: [['bm:cur', 'Banque Misr Current', '••3305', 'EGP', 22500, '']],
    deel: [['deel:usd', 'Deel balance', '', 'USD', 2256, '≈ 111,550 EGP']],
    payo: [['payo:usd', 'Payoneer balance', '', 'USD', 843, '≈ 41,710 EGP']],
    voda: [['voda:w', 'Vodafone Cash', '', 'EGP', 1200, '']],
    cash: [['cash:c', 'Cash', '', 'EGP', 3500, 'Estimate']],
  }
  const PROVS8 = [...PROV.map((p) => [p.key, p.name, 'bank']), ['voda', 'Vodafone Cash', 'wallet'], ['cash', 'Cash', 'wallet']]
  const acct = (id) => { for (const [k, l] of Object.entries(ACC)) { const a = l.find((x) => x[0] === id); if (a) return { prov: k, id: a[0], name: a[1], idf: a[2], cur: a[3], bal: a[4], note: a[5] } } }
  const acctV = (id) => { const a = acct(id); return `${brand(a.prov, 24)}<span class="truncate">${a.name}</span>${a.idf ? `<span class="font-mono-numbers ${MUTED}">${a.idf}</span>` : ''}` }
  const OUT_V = `<span class="text-[0.875rem] ${SECOND}">Outside buddget</span>`

  /* ---------- pockets: either set aside inside a tracked account, or not in a bank (lib/savings/pocketHome) ---------- */
  const TR = ['var(--cat-transport-bg)', 'var(--cat-transport-fg)']
  const GOLD = ['color-mix(in oklab, var(--color-brand-gold) 18%, var(--color-brand-card))', 'var(--color-brand-gold)']
  const PK = [
    { id: 'monthly', name: 'Everyday savings', icon: 'piggy-bank', tone: IC.teal, hue: 'var(--color-brand-primary)', home: 'cib:cur', bal: 9000, purpose: 'A buffer for anything', created: 'Mar 2025', moves: [['in', 'October saving', 'Oct 25 · set aside in CIB Current', 3500], ['in', 'September saving', 'Sep 25 · set aside in CIB Current', 5000], ['out', 'Moved to Car service', 'Aug 14 · stays in your savings', -2000]] },
    { id: 'car', name: 'Car service', icon: 'car', tone: TR, hue: 'var(--cat-transport-fg)', home: 'cib:cur', bal: 6000, target: 8000, purpose: 'Yearly service and new tyres', created: 'Jun 2026', moves: [['in', 'Added', 'Oct 2 · set aside in CIB Current', 2000], ['in', 'From Everyday savings', 'Aug 14 · stays in your savings', 2000], ['in', 'Started with', 'Jun 9 · set aside in CIB Current', 2000]] },
    { id: 'usd', name: 'Dollar savings', icon: 'coins', tone: IC.green, hue: 'var(--color-brand-green)', home: null, bal: 600, cur: 'USD', purpose: 'Cash dollars kept at home', created: 'Jan 2026', moves: [['in', 'Added', 'Sep 30 · money you already had', 200], ['in', 'Started with', 'Jan 4 · money you already had', 400]] },
    { id: 'cash', name: 'Cash at home', icon: 'banknote', tone: IC.amber, hue: 'var(--color-brand-amber)', home: null, bal: 7800, purpose: 'For a bad month', created: 'Oct 2026', moves: [] },
  ]
  const pk = (id) => PK.find((p) => p.id === id)
  const egp = (p) => (p.cur === 'USD' ? p.bal * RATE.USD : p.bal)
  const pMark = (p, s = 40) => `<span aria-hidden="true" class="flex shrink-0 items-center justify-center" style="width:${s}px;height:${s}px;border-radius:${s * 0.28}px;background:${p.tone[0]};color:${p.tone[1]}">${ICON(p.icon, s > 44 ? 'size-6' : 'size-5')}</span>`
  const pV = (p) => `${pMark(p, 24).replace('size-5', 'size-3.5')}<span class="truncate">${p.name}</span>`
  const where = (p, logo = 16) => (p.home ? `${brand(acct(p.home).prov, logo)}<span class="truncate">In ${acct(p.home).name}</span>` : `${ICON('house', 'size-3.5 shrink-0')}<span class="truncate">Not in a bank</span>`)
  const amtOf = (p) => (p.cur === 'USD' ? `${f0(p.bal)} USD` : fa(p.bal))

  /* ---------- goals live in Goals; Savings links to them ---------- */
  const GK = ['umrah', 'trip', 'car', 'laptop']
  const goalSaved = (k) => num4(POCKET[k][4])

  /* ---------- investments ---------- */
  const H = [
    { id: 'cert', kind: 'Certificate', name: 'CIB savings certificate', mark: (s) => brand('cib', s), hue: PROV[0].color, val: 96940, sub: '17.5% · matures Mar 2028', big: '96,940', unit: 'EGP', line: 'Interest paid monthly into CIB Current', cta: ['Add money', 'Cash out'], moves: [['in', 'Interest · October', 'Oct 1 · paid into CIB Current', 1413], ['in', 'Bought', 'Mar 12, 2025 · from CIB Current', 96940]], details: [['Held at', 'CIB'], ['Rate', '17.5% a year'], ['Matures', '12 Mar 2028'], ['Counts for zakat', 'Yes']] },
    { id: 'gold', kind: 'Gold', name: 'Gold 21k · 18 g', mark: (s) => `<span aria-hidden="true" class="flex shrink-0 items-center justify-center" style="width:${s}px;height:${s}px;border-radius:${s * 0.28}px;background:${GOLD[0]};color:${GOLD[1]}">${ICON('gem', 'size-5')}</span>`, hue: 'var(--color-brand-gold)', grams: 18, k: '21k', paid: 67440, sub: `${f0(GRAM['21k'])} a gram · 12:40 today`, cta: ['Add gold', 'Sell'], prices: true, moves: [['in', 'Bought 8 g', 'Oct 12 · paid 32,400 from CIB Current', '+8 g'], ['in', 'Bought 10 g', 'Mar 3 · paid 35,040 in cash', '+10 g']], details: [['Karat', '21k'], ['Counted in', 'Grams'], ['Paid in total', '67,440 EGP'], ['Kept', 'At home']] },
    { id: 'usdt', kind: 'Crypto', name: 'USDT · 500', mark: (s) => `<span aria-hidden="true" class="flex shrink-0 items-center justify-center" style="width:${s}px;height:${s}px;border-radius:${s * 0.28}px;background:var(--cat-shopping-bg);color:var(--cat-shopping-fg)">${ICON('circle-dollar-sign', 'size-5')}</span>`, hue: 'var(--cat-shopping-fg)', val: 500 * RATE.USD, paid: 24100, sub: `${fxn(RATE.USD)} a coin · 12:40 today`, cta: ['Buy', 'Sell'], moves: [['in', 'Bought 500 USDT', 'Jul 20 · on Binance', '+500']], details: [['Coin', 'USDT (Tether)'], ['Held on', 'Binance'], ['Counts for zakat', 'Yes']] },
    { id: 'egx', kind: 'Stocks', name: 'EGX stocks · 4 holdings', mark: (s) => `<span aria-hidden="true" class="flex shrink-0 items-center justify-center" style="width:${s}px;height:${s}px;border-radius:${s * 0.28}px;background:${IC.green[0]};color:${IC.green[1]}">${ICON('trending-up', 'size-5')}</span>`, hue: 'var(--color-brand-green)', val: 31690, paid: 30700, sub: 'Closing prices · Thu 15:00', cta: ['Buy', 'Sell'], moves: [['in', 'Bought COMI · 40 shares', 'Sep 8 · from CIB Current', 4120]], details: [['Broker', 'Thndr'], ['Holdings', 'COMI, TMGH, EFIH, FWRY'], ['Held as', 'Long-term'], ['Counts for zakat', '30% of the value']] },
  ]
  H[1].val = H[1].grams * GRAM[H[1].k]
  const hd = (id) => H.find((h) => h.id === id)
  const chg = (h) => (h.paid ? { n: h.val - h.paid, pct: ((h.val - h.paid) / h.paid) * 100 } : null)

  /* ---------- totals, all derived ---------- */
  const T = () => {
    const pockets = PK.reduce((s, p) => s + egp(p), 0)
    const goals = GK.reduce((s, k) => s + goalSaved(k), 0)
    const inv = H.reduce((s, h) => s + h.val, 0)
    return { pockets, goals, inv, all: pockets + goals + inv }
  }
  const SIMPLE_MONTH = 12000
  const EF_PK = ['monthly', 'cash']
  const ef = () => { const cov = EF_PK.reduce((s, id) => s + egp(pk(id)), 0); return { cov, months: cov / SIMPLE_MONTH, tgt: SIMPLE_MONTH * 3 } }
  const zak = (nisab = 'silver') => {
    const t = T()
    const lines = [['Pockets', t.pockets], ['Goals', t.goals], ['Certificate', hd('cert').val], ['Gold · 18 g', hd('gold').val], ['Crypto', hd('usdt').val], ['Stocks · 30% counts', hd('egx').val * 0.3], ['Debts due this year', -13000]]
    const base = lines.reduce((s, l) => s + l[1], 0)
    const nis = nisab === 'gold' ? 85 * GRAM['24k'] : 595 * 52
    return { lines, base, nis, due: base >= nis ? base * 0.025 : 0 }
  }
  const PLAN = { each: 5000, done: 3500 }

  /* ---------- small parts (mirror lrow / secHead / WealthPlanRows classes) ---------- */
  const tile = (ic, t, s = 40) => `<span aria-hidden="true" class="flex shrink-0 items-center justify-center rounded-[11px]" style="width:${s}px;height:${s}px;background:${t[0]};color:${t[1]}">${ICON(ic, 'size-5')}</span>`
  const SEP = '<div aria-hidden="true" class="ms-[68px] h-px bg-[var(--color-brand-border)]"></div>'
  const CARD8 = `overflow-hidden ${CARDBOX} shadow-[var(--shadow-sm)]`
  const bar = (pct, tone = 'var(--color-brand-primary)') => `<span class="mt-2 block h-1 rounded-full bg-[var(--color-brand-elevated)]"><span class="block h-full rounded-full" style="width:${Math.min(100, pct)}%;background:${tone}"></span></span>`
  const head = (t, n, act) => `<div class="mb-2 flex min-h-11 items-center gap-2 px-1"><h2 class="text-[17px] font-bold text-[var(--color-brand-text-primary)]">${t}</h2>${n != null ? `<span class="font-mono-numbers text-[0.8125rem] font-semibold ${MUTED}">${n}</span>` : ''}${act ? `<button type="button" data-sv8="${act[0]}" class="ms-auto inline-flex h-11 items-center gap-1 px-1 text-[0.875rem] font-semibold text-[var(--color-brand-primary-ink)]">${act[2] ? ICON('plus', 'size-4') : ''}${act[1]}${act[2] ? '' : ICON('chevron-right', 'size-4')}</button>` : ''}</div>`
  const row = (o, i) => `${i ? SEP : ''}<button type="button" data-sv8="${o.act}" class="flex min-h-[64px] w-full items-center gap-3 px-4 py-2.5 text-start transition-colors hover:bg-[var(--color-brand-elevated)]">${o.lead}<span class="min-w-0 flex-1"><span class="flex min-w-0 items-center gap-1.5"><span class="truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${o.title}</span>${o.badge || ''}</span><span class="mt-1 flex min-w-0 items-center gap-1.5 text-xs font-medium ${MUTED}">${o.sub}</span>${o.bar != null ? bar(o.bar) : ''}${o.after || ''}</span>${o.amt != null ? `<span class="shrink-0 text-end"><span class="block whitespace-nowrap font-mono-numbers text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]">${o.amt} <span class="text-[0.6875rem] font-normal ${MUTED}">${o.unit || 'EGP'}</span></span>${o.amt2 ? `<span class="mt-[3px] block whitespace-nowrap font-mono-numbers text-[0.71875rem] font-medium ${o.amt2c || MUTED}">${o.amt2}</span>` : ''}</span>` : ''}${o.chev ? ICON('chevron-right', `size-4 shrink-0 ${MUTED}`) : ''}</button>`
  const card = (rows) => `<div class="${CARD8}">${rows.map(row).join('')}</div>`
  const up = (c) => `${c.n >= 0 ? '▲' : '▼'} ${c.pct.toFixed(1)}%`

  const pocketRow = (st, p, tag) => ({ act: `p:${p.id}`, lead: pMark(p), title: p.name, sub: `${tag ? `<span class="shrink-0">${tag} ·</span>` : ''}${where(p)}`, after: p.id === st.sv8def ? `<span class="mt-1.5 block">${badge('brand', 'Monthly saving')}</span>` : '', amt: p.cur === 'USD' ? f0(p.bal) : fa(p.bal), unit: p.cur || 'EGP', amt2: p.cur === 'USD' ? `≈ ${f0(egp(p))} EGP` : p.target ? `of ${f0(p.target)}` : '' })
  const goalRow = (k, tag) => { const g = POCKET[k]; return { act: `g:${k}`, lead: pocketMark(g, 40), title: g[1], sub: `<span class="truncate">${tag ? `${tag} · ` : ''}${g[6]}% of ${g[5].replace('of ', '')}</span>`, bar: g[6], amt: g[4], chev: false } }
  const holdRow = (h, tag) => { const c = chg(h); return { act: `h:${h.id}`, lead: h.mark(40), title: h.name, sub: `<span class="truncate">${tag ? `${h.kind} · ` : ''}${h.sub}</span>`, amt: f0(h.val), amt2: c ? up(c) : '', amt2c: c && c.n >= 0 ? 'text-[var(--color-brand-green)]' : '' } }

  /* ---------- home ---------- */
  const legend = (c, l) => `<span class="inline-flex items-center gap-1.5"><span class="size-2 rounded-[2px]" style="background:${c}"></span>${l}</span>`
  const hero = () => {
    const t = T()
    const pc = (n) => Math.round((n / t.all) * 100)
    const parts = [[pc(t.pockets), 'var(--flow-band-fg)', 'Pockets', 1], [pc(t.goals), 'color-mix(in oklab, var(--flow-band-fg) 62%, transparent)', 'Goals', 0.62], [100 - pc(t.pockets) - pc(t.goals), 'color-mix(in oklab, var(--flow-band-fg) 40%, transparent)', 'Investments', 0.4]]
    const scale = [`<span class="flex gap-3">${parts.map(([p, c, l]) => legend(c, `${l} ${p}%`)).join('')}</span>`]
    return heroBand({ label: 'Saved and invested', big: fit8(t.all), n: t.all, bar: { split: parts.map(([p, , , o]) => [p, o]), lscale: scale }, lnote: noteLine(`${B(`+${f0(PLAN.done)}`)} saved this month`, `Investments ${B(up({ n: 1, pct: ((H.reduce((s, h) => s + (h.paid ? h.val - h.paid : 0), 0)) / H.reduce((s, h) => s + (h.paid || 0), 0)) * 100 }))} since bought`) }, true)
  }
  const planRow = (st) => {
    const p = pk(st.sv8def)
    return `<div class="mx-4 mt-3 ${CARD8}"><button type="button" data-sv8="plan" class="flex min-h-[72px] w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-[var(--color-brand-elevated)]">${tile('calendar-check', IC.teal)}<span class="min-w-0 flex-1"><span class="flex items-baseline justify-between gap-2"><span class="truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">Monthly saving</span><span class="shrink-0 font-mono-numbers text-[0.8125rem] font-semibold text-[var(--color-brand-text-primary)]">${f0(PLAN.done)}<span class="${MUTED}"> / ${f0(PLAN.each)}</span></span></span>${bar((PLAN.done / PLAN.each) * 100)}<span class="mt-1.5 block truncate text-xs font-medium ${MUTED}">Into ${p.name} · ${f0(PLAN.each - PLAN.done)} to go</span></span>${ICON('chevron-right', `size-4 shrink-0 ${MUTED}`)}</button></div>`
  }
  const efCard = () => {
    const e = ef()
    const seg = [0, 1, 2].map((i) => `<span class="block h-1.5 overflow-hidden rounded-full bg-[var(--color-brand-elevated)]"><span class="block h-full rounded-full bg-[var(--color-brand-primary)]" style="width:${Math.max(0, Math.min(1, e.months - i)) * 100}%"></span></span>`).join('')
    return `<button type="button" data-sv8="ef" class="block w-full ${CARD8} p-4 text-start"><span class="flex items-center gap-3">${tile('shield-check', IC.teal)}<span class="min-w-0 flex-1"><span class="block text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">Emergency fund</span><span class="mt-0.5 block truncate text-xs font-medium ${MUTED}">From 2 pockets</span></span><span class="shrink-0 text-end font-mono-numbers text-[1.0625rem] font-semibold text-[var(--color-brand-text-primary)]">${e.months.toFixed(1)} <span class="text-xs font-medium ${MUTED}">of 3 months</span></span></span><span class="mt-3.5 grid grid-cols-3 gap-1.5">${seg}</span><span class="mt-2 flex justify-between font-mono-numbers text-xs ${MUTED}"><span>${f0(e.cov)} covered</span><span>${f0(e.tgt - e.cov)} to go</span></span></button>`
  }
  const zakatCard = () => {
    const z = zak()
    return `<button type="button" data-sv8="zakat" class="block w-full ${CARD8} p-4 text-start"><span class="flex items-center gap-3">${tile('coins', GOLD)}<span class="min-w-0 flex-1"><span class="block text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">Zakat this year</span><span class="mt-0.5 block truncate text-xs font-medium ${MUTED}">Due by 12 Mar 2027</span></span><span class="shrink-0 whitespace-nowrap text-end font-mono-numbers text-[1.0625rem] font-semibold text-[var(--color-brand-text-primary)]">${fa(z.due)} <span class="text-[0.6875rem] font-normal ${MUTED}">EGP</span></span></span><span class="mt-3.5 block h-1.5 rounded-full bg-[var(--color-brand-elevated)]"><span class="block h-full w-[63%] rounded-full bg-[var(--color-brand-gold)]"></span></span><span class="mt-2 flex justify-between font-mono-numbers text-xs ${MUTED}"><span>12 Mar 2026</span><span>7 of 12 months</span><span>12 Mar 2027</span></span></button>`
  }
  const optBar = (st) => `<div class="mx-4 mt-3 flex items-center gap-2 rounded-2xl border border-dashed border-[var(--color-brand-border-strong)] p-1.5"><span class="ps-2 text-xs font-semibold ${MUTED}">Option</span><div class="inline-flex min-w-0 flex-1 gap-0.5 rounded-xl bg-[var(--color-brand-elevated)] p-[3px]">${[['A', 'A · Sections'], ['B', 'B · Filter']].map(([k, l]) => `<button type="button" data-sv8="opt:${k}" aria-pressed="${st.sv8opt === k}" class="${st.sv8opt === k ? SEG_ON : SEG_OFF}">${l}</button>`).join('')}</div></div>`

  const homeA = (st) => `<div class="space-y-5 px-4 pb-8 pt-5">
    <section>${head('Pockets', PK.length, ['add', 'Add pocket', true])}${card(PK.map((p) => pocketRow(st, p)))}</section>
    <section>${head('Goals', GK.length, ['goals', 'Goals'])}${card(GK.slice(0, 3).map((k) => goalRow(k)))}<button type="button" data-sv8="goals" class="mt-1 flex h-11 w-full items-center justify-center text-[0.84375rem] font-semibold text-[var(--color-brand-primary-ink)]">See all ${GK.length} in Goals</button></section>
    <section>${head('Investments', H.length, ['addinv', 'Add', true])}${card(H.map((h) => holdRow(h)))}</section>
    ${efCard()}
    ${zakatCard()}
  </div>`
  const homeB = (st) => {
    const f = st.sv8f
    const rows = [...(f !== 'inv' ? PK.map((p) => pocketRow(st, p)) : []), ...(f !== 'inv' ? GK.map((k) => goalRow(k, 'Goal')) : []), ...(f !== 'pk' ? H.map((h) => holdRow(h)) : [])]
    const segs = [['all', 'All'], ['pk', 'Pockets'], ['inv', 'Investments']]
    return `<div class="mx-4 mt-5 flex items-center gap-2"><div role="tablist" class="inline-flex min-w-0 flex-1 gap-0.5 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-[3px]">${segs.map(([k, l]) => `<button type="button" role="tab" aria-selected="${f === k}" data-sv8="f:${k}" class="${f === k ? SEG_ON : SEG_OFF}">${l}</button>`).join('')}</div></div>
    <div class="space-y-5 px-4 pb-8 pt-3"><section>${head(f === 'inv' ? 'Investments' : f === 'pk' ? 'Pockets and goals' : 'Everything', rows.length, f === 'inv' ? ['addinv', 'Add', true] : ['add', 'Add pocket', true])}${card(rows)}${f !== 'inv' ? `<p class="mt-2 px-1 text-xs leading-[1.45] ${MUTED}">Goals open in Goals, where you change them.</p>` : ''}</section>${efCard()}${zakatCard()}</div>`
  }

  /* ---------- detail pages (pocket, holding) ---------- */
  const tint = (c) => `--provider-brand:${c};background:linear-gradient(160deg, color-mix(in oklab, var(--provider-brand) var(--provider-hero-amt), var(--provider-hero-base)), color-mix(in oklab, var(--provider-brand) calc(var(--provider-hero-amt) - 14%), var(--provider-hero-base)))`
  const pill = (t) => `<span class="inline-flex min-h-7 items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--flow-band-fg)_14%,transparent)] px-3 text-[0.78125rem] font-semibold">${t}</span>`
  const back = `<button type="button" data-sv8="back" class="-ms-2 mb-1 inline-flex h-11 items-center gap-1 px-2 text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${ICON('chevron-left', 'size-5')}Savings</button>`
  const heroMark = (ic) => `<span aria-hidden="true" class="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--flow-band-mix)]">${ICON(ic, 'size-5')}</span>`
  const menuBtn = `<button type="button" data-sv8="menu" aria-label="More actions" class="-me-1.5 flex size-11 shrink-0 items-center justify-center rounded-full">${ICON('ellipsis', 'size-5')}</button>`
  const ctas = (a, b) => `<div class="mx-4 mt-3 grid grid-cols-2 gap-2"><button type="button" data-sv8="addmoney" class="${BTN.primary} ${SZ.touch}">${ICON('plus', 'size-[18px]')}${a}</button><button type="button" data-sv8="withdraw" class="${BTN_SOFT} ${SZ.touch}">${ICON('arrow-up-right', 'size-[18px]')}${b}</button></div>`
  const moveRows = (moves, cur) => moves.map(([d, t, s, n], i) => `${i ? SEP : ''}<div class="flex min-h-[60px] items-center gap-3 px-4 py-2.5">${tile(d === 'in' ? 'arrow-down-left' : 'arrow-up-right', d === 'in' ? IC.green : ['var(--color-brand-elevated)', 'var(--color-brand-text-secondary)'])}<span class="min-w-0 flex-1"><span class="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${t}</span><span class="mt-1 block truncate text-xs font-medium ${MUTED}">${s}</span></span><span class="shrink-0 whitespace-nowrap font-mono-numbers text-[0.9375rem] font-medium" style="color:${typeof n === 'string' || n > 0 ? 'var(--color-brand-green)' : 'var(--color-brand-text-primary)'}">${typeof n === 'string' ? n : `${n > 0 ? '+' : MINUS}${f0(n)} <span class="text-[0.6875rem] font-normal ${MUTED}">${cur}</span>`}</span></div>`).join('')
  const empty = `<div class="flex flex-col items-center px-6 py-7 text-center"><span class="flex size-11 items-center justify-center rounded-[14px] bg-[var(--color-brand-elevated)] ${SECOND}">${ICON('arrow-left-right', 'size-5')}</span><p class="mt-3 text-[0.9375rem] font-bold text-[var(--color-brand-text-primary)]">No moves yet</p><p class="mt-1 max-w-[30ch] text-[0.84375rem] leading-snug ${SECOND}">Money you add to this pocket or take out of it shows here.</p></div>`
  const facts = (rows) => `<div class="divide-y divide-[var(--color-brand-border)] ${CARD8}">${rows.map(([k, v]) => `<div class="flex min-h-[52px] items-center gap-3 px-4"><span class="w-[112px] shrink-0 text-[0.84375rem] ${SECOND}">${k}</span><span class="flex min-w-0 flex-1 items-center justify-end gap-2 text-end text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]">${v}</span></div>`).join('')}</div>`

  const pocketPage = (st, p) => {
    const isDef = p.id === st.sv8def
    const goal = p.target ? `<div class="mt-3.5"><div class="h-1.5 rounded-full" style="background:var(--flow-band-mix)"><div class="h-full rounded-full bg-[var(--flow-band-fg)]" style="width:${(p.bal / p.target) * 100}%"></div></div><p class="mt-1.5 flex justify-between font-mono-numbers text-xs opacity-80"><span>${Math.round((p.bal / p.target) * 100)}% of ${f0(p.target)}</span><span>${f0(p.target - p.bal)} to go</span></p></div>` : ''
    const h = `<div class="mx-4 mt-2">${back}<section class="overflow-hidden rounded-3xl px-[18px] pb-4 pt-4 text-[var(--flow-band-fg)]" style="${tint(p.hue)}"><div class="flex items-center gap-3">${heroMark(p.icon)}<span class="min-w-0 flex-1"><span class="block truncate text-[1.0625rem] font-bold">${p.name}</span><span class="block truncate text-[0.78125rem] opacity-80">${p.purpose}</span></span>${menuBtn}</div><p class="mt-4 text-xs font-semibold opacity-80">In this pocket</p><p class="flex items-baseline gap-1.5"><span class="font-mono-numbers text-[32px] font-semibold leading-[1.05] tracking-[-0.04em]">${f0(p.bal)}</span><span class="text-[0.8125rem] font-semibold">${p.cur || 'EGP'}${p.cur ? ` · ≈ ${f0(egp(p))} EGP` : ''}</span></p>${goal}<div class="mt-3 flex flex-wrap gap-2">${pill(p.home ? `${brand(acct(p.home).prov, 16)}In ${acct(p.home).name}` : `${ICON('house', 'size-3.5')}Not in a bank`)}${isDef ? pill(`${ICON('calendar-check', 'size-3.5')}Monthly saving`) : ''}</div></section></div>`
    const details = [['Held in', p.home ? acctV(p.home) : 'Not in a bank'], ['Currency', p.cur || 'EGP'], ['Target', p.target ? `<span class="font-mono-numbers">${f0(p.target)}</span>` : `<span class="${MUTED}">None</span>`], ['Monthly saving', isDef ? 'Goes here' : `<button type="button" data-sv8="setdef" class="-me-1 inline-flex h-11 items-center px-1 text-[0.875rem] font-semibold text-[var(--color-brand-primary-ink)]">Use this pocket</button>`], ['Created', p.created]]
    const note = p.home ? `The money stays in ${acct(p.home).name}; this pocket keeps it apart from what you can spend.` : 'Counted by you. It is not part of any account balance.'
    return `${h}${ctas('Add money', 'Withdraw')}<div class="space-y-5 px-4 pb-8 pt-5"><section>${head('Recent moves', p.moves.length || null)}<div class="${CARD8}">${p.moves.length ? moveRows(p.moves, p.cur || 'EGP') : empty}</div></section><section>${head('Details')}${facts(details)}<p class="mt-2 px-1 text-xs leading-[1.45] ${MUTED}">${note}</p></section></div>`
  }
  const holdPage = (h) => {
    const c = chg(h)
    const gold = h.id === 'gold'
    const big = gold ? `${h.grams}` : f0(h.val)
    const unit = gold ? 'g of 21k' : 'EGP'
    const value = gold ? `<p class="mt-1 font-mono-numbers text-[0.9375rem] font-semibold">${f0(h.val)} EGP <span class="text-[0.78125rem] font-medium opacity-80">today</span></p>` : ''
    const priceLine = `<p class="mt-2 flex items-center gap-1.5 text-xs opacity-80">${ICON('clock', 'size-3.5')}${gold ? `${f0(GRAM['21k'])} a gram · updated 12:40 today` : h.id === 'cert' ? 'Matures 12 Mar 2028 · 17.5% a year' : h.sub}</p>`
    const hh = `<div class="mx-4 mt-2">${back}<section class="overflow-hidden rounded-3xl px-[18px] pb-4 pt-4 text-[var(--flow-band-fg)]" style="${tint(h.hue)}"><div class="flex items-center gap-3">${gold ? heroMark('gem') : h.id === 'cert' ? brand('cib', 40) : heroMark(h.id === 'usdt' ? 'circle-dollar-sign' : 'trending-up')}<span class="min-w-0 flex-1"><span class="block truncate text-[1.0625rem] font-bold">${gold ? 'Gold 21k' : h.name}</span><span class="block truncate text-[0.78125rem] opacity-80">${h.kind}${h.id === 'cert' ? ' · 3 years' : ''}</span></span>${menuBtn}</div><p class="mt-4 text-xs font-semibold opacity-80">${gold ? 'You hold' : 'Worth today'}</p><p class="flex items-baseline gap-1.5"><span class="font-mono-numbers text-[32px] font-semibold leading-[1.05] tracking-[-0.04em]">${big}</span><span class="text-[0.8125rem] font-semibold">${unit}</span></p>${value}${priceLine}${c ? `<div class="mt-3 flex flex-wrap gap-2">${pill(`<span class="font-mono-numbers">${up(c)} · ${c.n >= 0 ? '+' : MINUS}${f0(c.n)}</span>&nbsp;since you bought`)}</div>` : ''}</section></div>`
    const prices = gold ? `<section>${head('Price a gram')}<div class="${CARD8}"><div class="grid grid-cols-3 divide-x divide-[var(--color-brand-border)]">${['24k', '21k', '18k'].map((k) => `<div class="px-3 py-2.5"><span class="text-[0.6875rem] font-bold text-[var(--color-brand-gold)]">${k}</span><p class="mt-0.5 font-mono-numbers text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${f0(GRAM[k])}</p></div>`).join('')}</div></div><p class="mt-2 px-1 text-xs leading-[1.45] ${MUTED}">Your 18 g is valued at the 21k price.</p></section>` : ''
    return `${hh}${ctas(h.cta[0], h.cta[1])}<div class="space-y-5 px-4 pb-8 pt-5">${prices}<section>${head(gold ? 'Purchases' : 'Recent moves', h.moves.length)}<div class="${CARD8}">${moveRows(h.moves, 'EGP')}</div></section><section>${head('Details')}${facts(h.details)}</section></div>`
  }

  /* ---------- the page ---------- */
  P8.wealth = (st) => {
    st.sv8opt ||= 'A'; st.sv8def ||= 'monthly'; st.sv8f ||= 'all'
    const S = Object.values(screens).find((x) => x.st === st)
    const h1 = S && S.el.querySelector('header h1'); if (h1) h1.textContent = 'Savings'
    const v = st.sv8v
    if (v && v.startsWith('p:')) return pocketPage(st, pk(v.slice(2)))
    if (v && v.startsWith('h:')) return holdPage(hd(v.slice(2)))
    return `${optBar(st)}${hero()}${planRow(st)}${st.sv8opt === 'B' ? homeB(st) : homeA(st)}`
  }
  NAV_PAGE.Savings = 'wealth'
  setTimeout(() => { Object.values(screens).forEach((S) => { if (S.v7) return; S.el.querySelectorAll('nav a span').forEach((n) => { if (n.textContent.trim() === 'Wealth') n.textContent = 'Savings' }) }) }, 0)
  document.getElementById('pz-page')?.addEventListener('click', () => Object.values(screens).forEach((S) => { S.st.sv8v = null }), true)

  /* ---------- item 12: provider-style account picker (bank, then its account) ---------- */
  const sv8Pick = (S, on, done, o = {}) => {
    const onProv = on && on !== 'outside' ? acct(on)?.prov : null
    const prow = ([k, name]) => {
      const l = ACC[k]
      const one = l.length === 1
      const a = l[0]
      const taken = one && o.taken?.[a[0]]
      const sub = one ? `${a[2] ? `${a[2]} · ` : ''}${a[5] || `${f0(a[4])} ${a[3]}`}` : `${l.length} accounts`
      return `<button type="button" data-sv8pv="${k}" ${taken ? 'aria-disabled="true"' : ''} class="flex min-h-[64px] w-full items-center gap-3 px-4 py-2.5 text-start ${taken ? 'opacity-50' : 'hover:bg-[var(--color-brand-elevated)]'}">${brand(k, 40)}<span class="min-w-0 flex-1"><span class="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${one ? a[1] : name}</span><span class="mt-0.5 block truncate font-mono-numbers text-xs ${MUTED}">${taken ? `Already a pocket: ${taken}` : sub}</span></span>${one ? tick(on === a[0], false) : `${onProv === k ? `<span class="text-xs font-semibold text-[var(--color-brand-primary-ink)]">${acct(on).name.replace(`${name} `, '')}</span>` : ''}${ICON('chevron-right', `size-4 shrink-0 ${MUTED}`)}`}</button>`
    }
    const grp = (kind, t) => `${sectionHead(t).replace('pt-1', 'pt-4')}<div class="mx-4 divide-y divide-[var(--color-brand-border)] ${CARDBOX} overflow-hidden">${PROVS8.filter((p) => p[2] === kind).map(prow).join('')}</div>`
    const outside = o.outside ? `<div class="mx-4 overflow-hidden ${CARDBOX}"><button type="button" data-sv8pv="outside" class="flex min-h-[60px] w-full items-center gap-3 px-4 text-start">${tile('arrow-left-right', ['var(--color-brand-elevated)', 'var(--color-brand-text-secondary)'])}<span class="min-w-0 flex-1"><span class="block text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">Outside buddget</span><span class="block text-xs ${SECOND}">Money you already had, or don’t track</span></span>${tick(on === 'outside', false)}</button></div>` : ''
    const sh = ltSheet(S, o.title || 'Paid from', o.sub || 'Pick the bank, then the account', `${outside}${grp('bank', 'Banks')}${grp('wallet', 'Wallets and cash')}`, '', 220)
    sh.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-sv8pv]'); if (!b || b.getAttribute('aria-disabled')) return
      const k = b.dataset.sv8pv
      if (k === 'outside') { sh.close(); return done('outside') }
      const l = ACC[k]
      if (l.length === 1) { sh.close(); return done(l[0][0]) }
      const name = PROVS8.find((p) => p[0] === k)[1]
      const arow = (a) => { const taken = o.taken?.[a[0]]; return `<button type="button" data-sv8ac="${a[0]}" ${taken ? 'aria-disabled="true"' : ''} class="flex min-h-[64px] w-full items-center gap-3 px-4 py-2.5 text-start ${taken ? 'opacity-50' : ''}">${brand(k, 40)}<span class="min-w-0 flex-1"><span class="flex items-center gap-1.5"><span class="truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${a[1]}</span>${a[3] !== 'EGP' ? badge('muted', a[3]) : ''}</span><span class="mt-0.5 block truncate font-mono-numbers text-xs ${MUTED}">${taken ? `Already a pocket: ${taken}` : `${a[2]} · ${f0(a[4])} ${a[3]}${a[5] ? ` · ${a[5]}` : ''}`}</span></span>${tick(on === a[0], false)}</button>` }
      const s2 = ltSheet(S, name, `${l.length} accounts · pick one`, `<div class="mx-4 divide-y divide-[var(--color-brand-border)] overflow-hidden ${CARDBOX}">${l.map(arow).join('')}</div>`, '', 240)
      s2.el.addEventListener('click', (e2) => { const a = e2.target.closest('[data-sv8ac]'); if (!a || a.getAttribute('aria-disabled')) return; s2.close(); sh.close(); done(a.dataset.sv8ac) })
    })
    return sh
  }
  const sv8PocketPick = (S, on, except, done) => {
    const body = `<div class="mx-4 overflow-hidden ${CARDBOX}">${PK.filter((p) => p.id !== except).map((p, i) => `${i ? SEP : ''}<button type="button" data-sv8pk="${p.id}" role="radio" aria-checked="${p.id === on}" class="flex min-h-[64px] w-full items-center gap-3 px-4 py-2.5 text-start">${pMark(p)}<span class="min-w-0 flex-1"><span class="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${p.name}</span><span class="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs ${MUTED}">${where(p)}<span class="shrink-0 font-mono-numbers">· ${amtOf(p)}</span></span></span>${tick(p.id === on, false)}</button>`).join('')}</div>`
    const sh = ltSheet(S, 'Which pocket?', '', body, '', 220)
    sh.el.addEventListener('click', (e) => { const b = e.target.closest('[data-sv8pk]'); if (b) { sh.close(); done(b.dataset.sv8pk) } })
  }

  /* ---------- sheets ---------- */
  const addMoney = (S, p) => {
    const sel = { a: p.home || 'cib:cur', pk: p.id === 'monthly' ? 'cash' : 'monthly' }
    const fromAcct = () => ({ k: 'From', v: acctV(sel.a), fn: (S2, r, redraw) => sv8Pick(S, sel.a, (id) => { sel.a = id; r.v = acctV(id); redraw() }, { title: 'From which account?' }) })
    const fromPk = () => ({ k: 'From pocket', v: pV(pk(sel.pk)), fn: (S2, r, redraw) => sv8PocketPick(S, sel.pk, p.id, (id) => { sel.pk = id; r.v = pV(pk(id)); redraw() }) })
    const c = { title: `Into ${p.name}`, iconHTML: pMark(p, 52), sign: '+', amt: p.cur === 'USD' ? '100' : '2,000', cur: p.cur || 'EGP', lockCur: true, day: 28, time: '12:00', note: false, cta: 'Add money', done: `Added to ${p.name}`, mode: 'acct' }
    c.rows = [{ k: 'Into', v: pV(p), static: true }, fromAcct()]
    c.line = (v) => `${amtOf(p).replace(' USD', '')} → ${f0(p.bal + v)} · ${c.mode === 'outside' ? 'money you already had' : c.mode === 'pocket' ? 'stays inside your savings' : sel.a === p.home ? 'set aside where it’s kept, nothing moves' : `from ${acct(sel.a).name}`}`
    c.pre = () => srcTabs(c.mode)
    c.onPre = (k, rows) => { c.mode = k; rows[1] = k === 'acct' ? fromAcct() : k === 'pocket' ? fromPk() : { k: 'From', v: OUT_V, static: true } }
    ltTx(S, c)
  }
  const withdraw = (S, p) => {
    form4(S, {
      title: 'Withdraw', sub: `Money leaving ${p.name}`, state: { amt: p.cur === 'USD' ? '100' : '1,000', for: 'spend', to: p.cur === 'USD' ? 'cib:usd' : p.home || 'cib:cur', mv: 'monthly' },
      body: (st) => `${hero4({ amt: st.amt, ctl: unit4(p.cur || 'EGP'), top: pMark(p, 52), line: `${p.name} goes from ${f0(p.bal)} to ${f0(Math.max(0, p.bal - num4(st.amt)))}` })}${grp4([row4('From', pV(p)), row4('For', FOR.find((f) => f[0] === st.for)[1], 'for'), st.for === 'debt' ? row4('Debt', 'Car loan · 36,000 left', 'debt') : st.for === 'move' ? row4('Into', pV(pk(st.mv)), 'mv') : p.home ? row4('Into', acctV(p.home)) : row4('Into', acctV(st.to), 'to')], '', p.home && st.for !== 'move' ? `Stays in ${acct(p.home).name} and becomes free to spend there.` : '')}`,
      foot: (st) => foot4(`Withdraw ${st.amt || 0}`), done: 'Withdrawn',
      onInput: (f, st, s) => { if (f.dataset.in !== 'amt') return; s.el.querySelector('[data-f4] [data-done]').textContent = `Withdraw ${st.amt || 0}`; s.el.querySelector('[data-line]').textContent = `${p.name} goes from ${f0(p.bal)} to ${f0(Math.max(0, p.bal - num4(st.amt)))}` },
      on: { for: (v, draw, st) => ltOptPicker(S, 'What is it for?', '', FOR, st.for, (x) => { st.for = x; draw() }), to: (v, draw, st) => sv8Pick(S, st.to, (id) => { st.to = id; draw() }, { title: 'Into which account?' }), mv: (v, draw, st) => sv8PocketPick(S, st.mv, p.id, (id) => { st.mv = id; draw() }), debt: () => toast(S, 'Opens your debts') },
    })
  }
  const addGold = (S) => {
    form4(S, {
      title: 'Add gold', state: { amt: '8', unit: 'g', k: '21k', from: 'cib:cur', paid: '32,400', date: 'Mon, 12 Oct' },
      body: (st) => { const grams = num4(st.amt) * (st.unit === 'g' ? 1 : st.unit === 'pound' ? 8 : 31.1); return `${hero4({ amt: st.amt, ctl: ctl4('unit', GUNIT[st.unit][0], 'Unit'), top: TILE52('gem', GOLD), line: `${st.unit === 'g' ? '' : `${f0(grams)} g · `}Worth ${f0(grams * GRAM[st.k])} today · live price` })}${KSEG(st.k)}${grp4([row4('Paid from', st.from === 'outside' ? OUT_V : acctV(st.from), 'from'), st.from === 'outside' ? '' : in4('paid', 'Paid', '32,400', st.paid, 'decimal'), date4('Bought on', st.date)], '', st.from === 'outside' ? 'Only added to what you hold. Nothing leaves your accounts.' : 'Logged as moving money into gold, not as spending.')}` },
      foot: (st) => foot4(`Add ${st.amt || 0} ${GUNIT[st.unit][0]} of ${st.k}`), done: 'Gold added',
      on: { unit: (v, draw, st) => ltOptPicker(S, 'Counted in', 'How the shop or your receipt counts it', Object.entries(GUNIT).map(([k, [, t, s]]) => [k, t, s]), st.unit, (u) => { st.unit = u; draw() }), from: (v, draw, st) => sv8Pick(S, st.from, (id) => { st.from = id; draw() }, { outside: true }) },
    })
  }
  const KINDS = [['bank', 'Bank account', 'One you don’t track in Accounts', 'landmark', IC.teal], ['wallet', 'Mobile wallet', 'Vodafone Cash, Orange Cash', 'smartphone', IC.green], ['cash', 'Cash', 'At home or in a safe', 'banknote', IC.amber], ['other', 'Something else', 'Name it, pick an icon', 'shapes', ['var(--color-brand-elevated)', 'var(--color-brand-text-secondary)']]]
  const ASSETS = [['gold', 'Gold', 'Grams, pounds or ounces', 'gem', GOLD], ['cert', 'Certificate', 'Fixed term, pays interest', 'scroll-text', IC.teal], ['crypto', 'Crypto', 'Bitcoin, USDT and more', 'bitcoin', ['var(--cat-shopping-bg)', 'var(--cat-shopping-fg)']], ['stock', 'Stocks', 'EGX or abroad', 'trending-up', IC.green], ['property', 'Property', 'A flat, land, a shop', 'building-2', TR]]
  const kindTile = (k, l, s, ic, t, on, act) => `<button type="button" data-v="${act}:${k}" aria-pressed="${!!on}" class="flex min-h-[112px] flex-col items-start gap-1 rounded-2xl border p-3.5 text-start transition-colors ${on ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-soft)]' : 'border-[var(--color-brand-border)] bg-[var(--color-brand-card)] hover:bg-[var(--color-brand-elevated)]'}">${tile(ic, t, 44)}<span class="mt-1 text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${l}</span><span class="text-xs ${MUTED}">${s}</span></button>`
  const addPocket = (S, tab = 'pocket') => {
    const taken = { 'cib:cur': 'Everyday savings' }
    form4(S, {
      title: 'Add pocket', sub: 'A place to keep savings apart', state: { tab, acct: null, kind: null },
      body: (st) => `${seg4('tab', [['pocket', 'Pocket'], ['inv', 'Investment']], st.tab)}${st.tab === 'pocket'
        ? `${grp4([`<button type="button" data-v="acct" class="flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-start hover:bg-[var(--color-brand-elevated)]">${st.acct ? `${brand(acct(st.acct).prov, 40)}<span class="min-w-0 flex-1"><span class="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${acct(st.acct).name} <span class="font-mono-numbers font-medium ${MUTED}">${acct(st.acct).idf}</span></span><span class="mt-0.5 block truncate font-mono-numbers text-xs ${MUTED}">${acct(st.acct).note || `${f0(acct(st.acct).bal)} ${acct(st.acct).cur}`} · the pocket sits inside it</span></span><span class="text-[0.84375rem] font-semibold text-[var(--color-brand-primary-ink)]">Change</span>` : `${tile('wallet', ['var(--color-brand-elevated)', 'var(--color-brand-text-secondary)'])}<span class="min-w-0 flex-1"><span class="block text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">Pick an account</span><span class="mt-0.5 block text-xs ${MUTED}">Choose the bank, then its account</span></span>${ICON('chevron-right', `size-4 shrink-0 ${MUTED}`)}`}</button>`], 'From an account you already have', 'The money stays in the account. The pocket sets part of it aside, apart from what you can spend.')}${sectionHead('Or start from scratch').replace('pt-1', 'pt-5')}<div class="mx-4 grid grid-cols-2 gap-2.5">${KINDS.map(([k, l, s, ic, t]) => kindTile(k, l, s, ic, t, st.kind === k, 'kind')).join('')}</div>`
        : `<div class="mx-4 mt-4 grid grid-cols-2 gap-2.5">${ASSETS.map(([k, l, s, ic, t]) => kindTile(k, l, s, ic, t, false, 'asset')).join('')}</div><div class="mx-4 mt-3 flex min-h-[60px] items-center gap-3 rounded-2xl bg-[var(--color-brand-elevated)] px-4 py-3">${ICON('clock', `size-[18px] shrink-0 ${MUTED}`)}<p class="text-xs ${SECOND}">Gold and crypto values follow the live price. Each row shows when the price was last updated.</p></div>`}`,
      after: (st, sh) => { const f = sh.el.querySelector('[data-foot]'); if (f) f.hidden = st.tab !== 'pocket' },
      foot: (st) => (st.tab === 'pocket' ? `<button type="button" data-done ${st.acct || st.kind ? '' : 'disabled'} class="${BTN.primary} ${SZ.block}">Continue</button>` : ''), done: 'Opens the new pocket form',
      on: { acct: (v, draw, st) => sv8Pick(S, st.acct, (id) => { st.acct = id; st.kind = null; draw() }, { title: 'From an account you already have', taken }), kind: (v, draw, st) => { st.kind = v.dataset.v.split(':')[1]; st.acct = null; draw() }, asset: (v, draw, st, sh) => { const k = v.dataset.v.split(':')[1]; if (k === 'gold') { sh.close(); return addGold(S) } toast(S, `Opens Add ${k === 'cert' ? 'certificate' : k}`) } },
    })
  }
  const pocketMenu = (S, p) => {
    const isDef = p.id === S.st.sv8def
    const mrow = (ic, t, s, act, red, dis) => `<button type="button" data-sv8m="${act}" ${dis ? 'aria-disabled="true"' : ''} class="flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-start ${dis ? '' : 'hover:bg-[var(--color-brand-elevated)]'}">${tile(ic, red ? ['var(--color-brand-red-soft)', 'var(--color-brand-red)'] : ['var(--color-brand-elevated)', 'var(--color-brand-text-secondary)'])}<span class="min-w-0 flex-1"><span class="block text-[0.9375rem] font-semibold ${red ? 'text-[var(--color-brand-red)]' : 'text-[var(--color-brand-text-primary)]'}">${t}</span><span class="mt-0.5 block truncate text-xs ${MUTED}">${s}</span></span>${dis ? `<span class="text-[var(--color-brand-primary-ink)]">${ICON('check', 'size-5')}</span>` : ''}</button>`
    const body = `<div class="mx-4 overflow-hidden ${CARDBOX}">${mrow('pencil', 'Edit pocket', 'Name, icon, target, where it’s kept', 'edit')}${SEP}${mrow('calendar-check', isDef ? 'Used for monthly saving' : 'Use for monthly saving', isDef ? 'Each month’s saving lands here' : `Now goes to ${pk(S.st.sv8def).name}`, 'def', false, isDef)}${SEP}${mrow('trash-2', 'Delete pocket', p.home ? `Its ${f0(p.bal)} goes back to ${acct(p.home).name} as free money` : `Its ${amtOf(p)} leaves your savings`, 'del', true)}</div>`
    const sh = ltSheet(S, p.name, '', body, '', 200)
    sh.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-sv8m]'); if (!b || b.getAttribute('aria-disabled')) return
      const a = b.dataset.sv8m
      if (a === 'edit') return toast(S, 'Opens Edit pocket')
      if (a === 'def') { sh.close(); return setDef(S, p) }
      if (a === 'del') return ltAlert(S, `Delete ${p.name}?`, p.home ? `Its ${f0(p.bal)} stays in ${acct(p.home).name} as free money. Its moves stay in Flow.` : `Its ${amtOf(p)} leaves your savings. Its moves stay in Flow.`, [['solidDanger', 'Delete', () => { sh.close(); S.st.sv8v = null; render(S); toast(S, `${p.name} deleted`) }], ['ghost', 'Cancel']])
    })
  }
  const holdMenu = (S, h) => {
    const body = `<div class="mx-4 overflow-hidden ${CARDBOX}"><button type="button" data-sv8m="edit" class="flex min-h-[60px] w-full items-center gap-3 px-4 text-start">${tile('pencil', ['var(--color-brand-elevated)', 'var(--color-brand-text-secondary)'])}<span class="text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">Edit ${h.kind.toLowerCase()}</span></button>${SEP}<button type="button" data-sv8m="del" class="flex min-h-[60px] w-full items-center gap-3 px-4 text-start">${tile('trash-2', ['var(--color-brand-red-soft)', 'var(--color-brand-red)'])}<span class="text-[0.9375rem] font-semibold text-[var(--color-brand-red)]">Delete</span></button></div>`
    const sh = ltSheet(S, h.name, '', body, '', 200)
    sh.el.addEventListener('click', (e) => { const b = e.target.closest('[data-sv8m]'); if (!b) return; if (b.dataset.sv8m === 'edit') return toast(S, `Opens Edit ${h.kind.toLowerCase()}`); ltAlert(S, `Delete ${h.name}?`, 'It leaves what you hold. Purchases stay in Flow.', [['solidDanger', 'Delete', () => { sh.close(); S.st.sv8v = null; render(S); toast(S, 'Deleted') }], ['ghost', 'Cancel']]) })
  }
  const setDef = (S, p) => { S.st.sv8def = p.id; render(S); toast(S, `Monthly saving now goes to ${p.name}`) }
  const monthly = (S) => {
    form4(S, {
      title: 'Monthly saving', sub: 'Your plan, and the pocket it goes to', state: {},
      body: () => `${heroAmt(f0(PLAN.each), 'EGP a month', `${f0(PLAN.done)} saved in October · ${f0(PLAN.each - PLAN.done)} to go`, ['calendar-check', ...IC.teal])}${barLine((PLAN.done / PLAN.each) * 100)}${grp4([row4('Each month', `<span class="font-mono-numbers">${f0(PLAN.each)}</span>`, 'each'), row4('Saves on', 'Payday, the 25th', 'day')], 'Plan')}${sectionHead('Goes to').replace('pt-1', 'pt-5')}<div class="mx-4 overflow-hidden ${CARDBOX}">${PK.map((p, i) => `${i ? SEP : ''}<button type="button" data-v="def:${p.id}" role="radio" aria-checked="${p.id === S.st.sv8def}" class="flex min-h-[64px] w-full items-center gap-3 px-4 py-2.5 text-start">${pMark(p)}<span class="min-w-0 flex-1"><span class="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${p.name}</span><span class="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs ${MUTED}">${where(p)}</span></span>${tick(p.id === S.st.sv8def, false)}</button>`).join('')}</div><p class="mx-5 mt-2 text-xs leading-relaxed ${MUTED}">The pocket you pick shows a Monthly saving badge. You can also set it from a pocket’s menu.</p>`,
      foot: () => foot4('Done'), done: 'Plan saved',
      on: { def: (v, draw) => { S.st.sv8def = v.dataset.v.split(':')[1]; render(S); draw() }, each: () => toast(S, 'Opens the amount'), day: () => toast(S, 'Opens the day picker') },
    })
  }
  const efSheet = (S) => {
    const e = ef()
    const step = (n) => `<div class="flex min-h-[56px] items-center gap-3 px-4"><span class="min-w-0 flex-1 text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]">Months to cover</span><span class="flex items-center gap-1"><button type="button" data-v="dec" aria-label="One month less" class="${CLOSE_BTN}">${ICON('minus', 'size-4')}</button><span class="w-10 text-center font-mono-numbers text-[1.25rem] font-bold text-[var(--color-brand-text-primary)]">${n}</span><button type="button" data-v="inc" aria-label="One month more" class="${CLOSE_BTN}">${ICON('plus', 'size-4')}</button></span></div>`
    form4(S, {
      title: 'Emergency fund', sub: 'Months you could live on a simple version of your life', state: { m: 3 },
      body: (st) => { const tgt = SIMPLE_MONTH * st.m; return `${heroAmt(e.months.toFixed(1), `of ${st.m} months`, `${f0(e.cov)} covered · ${f0(Math.max(0, tgt - e.cov))} to go`, ['shield-check', ...IC.teal])}<div class="mx-5 grid gap-1.5" style="grid-template-columns:repeat(${st.m}, minmax(0, 1fr))">${Array.from({ length: st.m }, (_, i) => `<span class="block h-1.5 overflow-hidden rounded-full bg-[var(--color-brand-sunken)]"><span class="block h-full rounded-full bg-[var(--color-brand-primary)]" style="width:${Math.max(0, Math.min(1, e.months - i)) * 100}%"></span></span>`).join('')}</div>${grp4([step(st.m), row4('A simple month', `<span class="font-mono-numbers">${f0(SIMPLE_MONTH)}</span>`, 'month'), row4('Target', `<b class="font-mono-numbers">${f0(tgt)}</b>`)], 'Your fund')}${sectionHead('Counted from').replace('pt-1', 'pt-5')}<div class="mx-4 overflow-hidden ${CARDBOX}">${EF_PK.map((id, i) => { const p = pk(id); return `${i ? SEP : ''}<div class="flex min-h-[60px] items-center gap-3 px-4 py-2.5">${pMark(p)}<span class="min-w-0 flex-1"><span class="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${p.name}</span><span class="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs ${MUTED}">${where(p)}</span></span><span class="font-mono-numbers text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]">${f0(egp(p))}</span></div>` }).join('')}<button type="button" data-v="pockets" class="flex h-11 w-full items-center justify-center border-t border-[var(--color-brand-border)] text-[0.84375rem] font-semibold text-[var(--color-brand-primary-ink)]">Change pockets</button></div><p class="mx-5 mt-2 text-xs leading-relaxed ${MUTED}">Kept out of every goal. The fund counts the pockets you pick; nothing moves.</p>` },
      foot: () => foot4('Add money'), done: 'Opens Add money',
      on: { dec: (v, draw, st) => { st.m = Math.max(1, st.m - 1); draw() }, inc: (v, draw, st) => { st.m = Math.min(12, st.m + 1); draw() }, month: () => ltSimpleMonth(S, () => {}), pockets: () => toast(S, 'Opens the pocket list') },
    })
  }
  const zakatSheet = (S) => {
    form4(S, {
      title: 'Zakat', sub: 'This year ends 12 Mar 2027', state: { nisab: 'silver' },
      body: (st) => { const z = zak(st.nisab); return `${heroAmt(z.due ? fa(z.due) : '0', 'EGP due', z.due ? `2.5% of ${f0(z.base)} · above the nisab of ${f0(z.nis)}` : `${f0(z.base)} is below the nisab of ${f0(z.nis)}, so nothing is due`, ['coins', ...GOLD])}${barLine(63, 'var(--color-brand-gold)')}<p class="mx-5 mt-1.5 flex justify-between font-mono-numbers text-xs ${MUTED}"><span>12 Mar 2026</span><span>7 of 12 months</span><span>12 Mar 2027</span></p>${grp4(z.lines.map(([k, n]) => `<button type="button" data-toast="Opens ${k.split(' ')[0]}, where you change it" class="flex min-h-[52px] w-full items-center gap-3 px-4 text-start hover:bg-[var(--color-brand-elevated)]"><span class="min-w-0 flex-1 text-[0.84375rem] ${SECOND}">${k}</span><span class="font-mono-numbers text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]">${n < 0 ? MINUS : ''}${f0(n)}</span>${CHEV}</button>`).concat(row4('Zakatable', `<b class="font-mono-numbers">${f0(z.base)}</b>`)), 'What counts', 'Figures come from Savings and Debts. Tap one to change it there.')}${grp4([pick4('Nisab basis', st.nisab === 'gold' ? 'Gold · 85 g' : 'Silver · 595 g', 'nisab'), pick4('Year starts', '12 Mar', 'ystart', 'calendar')], 'Settings')}` },
      foot: () => foot4('Mark as paid'), done: 'Zakat marked as paid',
      on: { nisab: (v, draw, st) => ltOptPicker(S, 'Nisab basis', 'The minimum before zakat is due', [['silver', 'Silver · 595 g', `≈ ${f0(595 * 52)} EGP today`], ['gold', 'Gold · 85 g', `≈ ${f0(85 * GRAM['24k'])} EGP today`]], st.nisab, (x) => { st.nisab = x; draw() }), ystart: () => toast(S, 'Opens the date picker') },
    })
  }

  /* ---------- clicks on the final phone ---------- */
  const go = (S, v) => { if (S.st.page !== 'wealth') setPage('wealth'); S.st.sv8v = v; S.scroll.scrollTop = 0; render(S) }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sv8]'); if (!b) return
    const S = screenOf(b); if (!S || S.st.v7 || S.st.page !== 'wealth' || b.closest('[data-layer-root]')) return
    e.stopPropagation(); e.preventDefault()
    const [k, a] = b.dataset.sv8.split(':')
    const v = S.st.sv8v
    const cur = v && v.startsWith('p:') ? pk(v.slice(2)) : null
    const hold = v && v.startsWith('h:') ? hd(v.slice(2)) : null
    if (k === 'opt') { S.st.sv8opt = a; return render(S) }
    if (k === 'f') { S.st.sv8f = a; return render(S) }
    if (k === 'p' || k === 'h') return go(S, `${k}:${a}`)
    if (k === 'back') { S.st.sv8v = null; S.scroll.scrollTop = 0; return render(S) }
    if (k === 'g') return toast(S, `Opens ${POCKET[a][1]} in Goals`)
    if (k === 'goals') return toast(S, 'Opens Goals')
    if (k === 'add') return addPocket(S)
    if (k === 'addinv') return addPocket(S, 'inv')
    if (k === 'plan') return monthly(S)
    if (k === 'ef') return efSheet(S)
    if (k === 'zakat') return zakatSheet(S)
    if (k === 'menu') return cur ? pocketMenu(S, cur) : holdMenu(S, hold)
    if (k === 'setdef' && cur) return setDef(S, cur)
    if (k === 'addmoney') return cur ? addMoney(S, cur) : hold.id === 'gold' ? addGold(S) : toast(S, `Opens ${hold.cta[0]}`)
    if (k === 'withdraw') return cur ? withdraw(S, cur) : toast(S, `Opens ${hold.cta[1]}`)
  }, true)

  /* ---------- sheet bar ---------- */
  Object.assign(F8, {
    sv8addpocket: (S) => { go(S, null); addPocket(S) },
    sv8pocket: (S) => go(S, 'p:monthly'),
    sv8empty: (S) => go(S, 'p:cash'),
    sv8gold: (S) => go(S, 'h:gold'),
    sv8menu: (S) => { go(S, 'p:car'); pocketMenu(S, pk('car')) },
    sv8monthly: (S) => { go(S, null); monthly(S) },
    sv8addmoney: (S) => { go(S, 'p:car'); addMoney(S, pk('car')); setTimeout(() => sv8Pick(S, 'cib:cur', () => {}, { title: 'From which account?' }), 50) },
    sv8ef: (S) => { go(S, null); efSheet(S) },
    sv8zakat: (S) => { go(S, null); zakatSheet(S) },
  })
  Object.assign(T8, { sv8addmoney: (S) => AFTER.deposit(S), sv8ef: (S) => AFTER.s_ef(S), sv8zakat: (S) => AFTER.s_zakat(S), sv8gold: (S) => AFTER.s_gold(S) })
  SHEETS8.push(['sv8addpocket', 'Add pocket'], ['sv8pocket', 'Pocket page'], ['sv8empty', 'Pocket, no moves'], ['sv8gold', 'Gold page'], ['sv8menu', 'Pocket menu · monthly saving'], ['sv8monthly', 'Monthly saving'], ['sv8addmoney', 'Add money · From list'], ['sv8ef', 'Emergency fund'], ['sv8zakat', 'Zakat'])
  NOTES8.wealth = 'Savings: one “Saved and invested” hero (no net worth), the monthly saving plan row, then Pockets (each says where it is kept), Goals (links into Goals), Investments (with price times), the emergency fund card and the yearly zakat card. Tap any row for its page; flip Option A / B at the top. Account pickers are now bank first, then its account.'
}
