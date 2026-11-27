/* ================= round 9: Savings (P8.wealth) ================= */
/* icons passed through data, listed so the sprite build picks them up:
   ICON('piggy-bank' ICON('car' ICON('coins' ICON('banknote' ICON('gem' ICON('landmark' ICON('trending-up' ICON('bitcoin'
   ICON('house' ICON('shield-check' ICON('wallet' ICON('arrow-down-left' ICON('arrow-up-right' ICON('pencil' ICON('trash-2'
   ICON('ellipsis' ICON('ellipsis-vertical' ICON('chevron-left' ICON('calendar-check' ICON('clock' ICON('arrow-left-right' ICON('smartphone' ICON('shapes'
   ICON('scroll-text' ICON('building-2' ICON('check' ICON('circle-dollar-sign' ICON('triangle-alert' ICON('undo-2' ICON('split'
   ICON('circle-check' ICON('chevron-down' ICON('moon-star' ICON('plane' ICON('minus' ICON('plus' ICON('arrow-down-to-line' ICON('circle-alert' */
{
  /* ---------- the user's own accounts, by provider (same sample as Accounts) ---------- */
  const ACC = {
    cib: [['cib:cur', 'CIB Current', '••1234', 'EGP', 120425, '59,405 free'], ['cib:usd', 'CIB USD', '••6620', 'USD', 1650, `≈ ${f0(1650 * RATE.USD)} EGP`], ['cib:sav', 'CIB Savings', '••3390', 'EGP', 11407, '']],
    qnb: [['qnb:cur', 'QNB Current', '••3018', 'EGP', 8000, '1,400 free'], ['qnb:sav', 'QNB Savings', '••7720', 'EGP', 13300, '']],
    nbe: [['nbe:cur', 'NBE Current', '••4410', 'EGP', 47000, '20,000 free']],
    bm: [['bm:cur', 'Banque Misr Current', '••3305', 'EGP', 9500, '']],
    deel: [['deel:usd', 'Deel balance', '', 'USD', 1600, `$1,200 free · ≈ ${f0(1600 * RATE.USD)} EGP`]],
    payo: [['payo:usd', 'Payoneer balance', '', 'USD', 200, `≈ ${f0(200 * RATE.USD)} EGP`]],
    voda: [['voda:w', 'Vodafone Cash', '', 'EGP', 1200, '']],
    cash: [['cash:c', 'Cash', '', 'EGP', 3500, 'Estimate']],
  }
  const PROVS8 = [...PROV.map((p) => [p.key, p.name, 'bank']), ['voda', 'Vodafone Cash', 'wallet'], ['cash', 'Cash', 'wallet']]
  const acct = (id) => { for (const [k, l] of Object.entries(ACC)) { const a = l.find((x) => x[0] === id); if (a) return { prov: k, id: a[0], name: a[1], idf: a[2], cur: a[3], bal: a[4], note: a[5] } } }
  const acctV = (id) => { const a = acct(id); return `${brand(a.prov, 24)}<span class="truncate">${a.name}</span>${a.idf ? `<span class="font-mono-numbers ${MUTED}">${a.idf}</span>` : ''}` }
  const SAV_ACC = ['cib:sav', 'qnb:sav']
  /* the shared Paid with list (ltMethodPicker) speaks payment-method keys; savings sit in accounts, never on a credit card */
  const PM2ACC = { cib: 'cib:cur', payroll: 'cib:cur', usd: 'cib:usd', nbe: 'nbe:cur', bm: 'bm:cur', voda: 'voda:w', cash: 'cash:c' }
  const pmOf = (id) => Object.keys(PM2ACC).find((k) => PM2ACC[k] === id) || 'cib'

  /* ---------- pockets (no target): set aside inside a tracked account, or an outside holding ---------- */
  const TR = ['var(--cat-transport-bg)', 'var(--cat-transport-fg)']
  const GOLD = ['color-mix(in oklab, var(--color-brand-gold) 18%, var(--color-brand-card))', 'var(--color-brand-gold)']
  const PK = [
    { id: 'monthly', sys: true, name: 'Monthly savings', icon: 'piggy-bank', tone: IC.teal, hue: 'var(--color-brand-primary)', home: 'cib:cur', bal: 9000, purpose: 'What’s left at each month end', created: 'Jul 2026', moves: [['in', 'September leftover', 'Oct 3 · set aside in CIB Current', 3000], ['in', 'August leftover', 'Sep 3 · set aside in CIB Current', 2500], ['in', 'July leftover', 'Aug 3 · set aside in CIB Current', 3500]] },
    { id: 'car', name: 'Car service', icon: 'car', tone: TR, hue: 'var(--cat-transport-fg)', home: 'cib:cur', bal: 6000, purpose: 'Yearly service and new tyres', created: 'Jun 2026', moves: [['in', 'Added', 'Oct 12 · set aside in CIB Current', 1500], ['in', 'September leftover', 'Oct 3 · set aside in CIB Current', 1500], ['in', 'Started with', 'Jun 9 · set aside in CIB Current', 3000]] },
    { id: 'usd', name: 'Dollar savings', icon: 'coins', tone: IC.green, hue: 'var(--color-brand-green)', home: null, bal: 600, cur: 'USD', purpose: 'Cash dollars kept at home', created: 'Jan 2026', moves: [['in', 'Added', 'Sep 30 · money you already had', 200], ['in', 'Started with', 'Jan 4 · money you already had', 400]] },
    { id: 'cash', name: 'Cash at home', icon: 'banknote', tone: IC.amber, hue: 'var(--color-brand-amber)', home: null, bal: 7800, purpose: 'For a bad month', created: 'Oct 2026', moves: [] },
  ]
  const pk = (id) => PK.find((p) => p.id === id)
  const egp = (p) => (p.cur === 'USD' ? p.bal * RATE.USD : p.bal)
  const pMark = (p, s = 40) => `<span aria-hidden="true" class="flex shrink-0 items-center justify-center" style="width:${s}px;height:${s}px;border-radius:${s * 0.28}px;background:${p.tone[0]};color:${p.tone[1]}">${ICON(p.icon, s > 44 ? 'size-6' : s > 30 ? 'size-5' : 'size-3.5')}</span>`
  const pV = (p) => `${pMark(p, 24)}<span class="truncate">${p.name}</span>`
  const where = (p, logo = 16) => (p.home ? `${brand(acct(p.home).prov, logo)}<span class="truncate">In ${acct(p.home).name}</span>` : `${ICON('house', 'size-3.5 shrink-0')}<span class="truncate">Outside your accounts</span>`)
  const amtOf = (p) => (p.cur === 'USD' ? `${f0(p.bal)} USD` : fa(p.bal))

  /* ---------- goals: savings goals only, each lists its homes (same homes and rates as lt-v8-goals.js) ---------- */
  const G_USD = RATE.USD, G_GOLD = GRAM['21k']
  const HOME9 = { cib: (n) => [n, `${f0(n)} in CIB`], nbe: (n) => [n, `${f0(n)} in NBE`], deel: (n) => [n * G_USD, `$${f0(n)} in Deel`], gold: (g) => [g * G_GOLD, `${g} g gold`] }
  const GL = [['umrah', 48000, [['cib', 12000], ['nbe', 6000]]], ['trip', 50000, [['cib', 12000]]], ['car', 400000, [['deel', 400], ['gold', 18], ['cib', 12000]]], ['laptop', 60000, [['nbe', 21000]]]]
  const gl = (k) => { const [, target, hs] = GL.find((g) => g[0] === k); const homes = hs.map(([h, n]) => HOME9[h](n)); const saved = homes.reduce((s, h) => s + h[0], 0); return { k, name: POCKET[k][1], target, homes, saved, pct: Math.round((saved / target) * 100) } }
  const homesLine = (g) => g.homes.map((h) => `<bdi class="inline-block whitespace-nowrap font-mono-numbers">${h[1]}</bdi>`).join('<span aria-hidden="true"> · </span>')
  const GOAL_GOLD = 'car'

  /* ---------- investments ---------- */
  const H = [
    { id: 'cert', kind: 'Certificate', name: 'CIB savings certificate', mark: (s) => brand('cib', s), hue: PROV[0].color, val: 96940, sub: '17.5% · matures Mar 2028', big: '96,940', unit: 'EGP', line: 'Interest paid monthly into CIB Current', cta: ['Add money', 'Cash out'], moves: [['in', 'Interest · October', 'Oct 1 · paid into CIB Current', 1413], ['in', 'Bought', 'Mar 12, 2025 · from CIB Current', 96940]], details: [['Held at', 'CIB'], ['Rate', '17.5% a year'], ['Matures', '12 Mar 2028'], ['Counts for zakat', 'Yes']] },
    { id: 'gold', kind: 'Gold', name: 'Gold 21k · 10 g', mark: (s) => `<span aria-hidden="true" class="flex shrink-0 items-center justify-center" style="width:${s}px;height:${s}px;border-radius:${s * 0.28}px;background:${GOLD[0]};color:${GOLD[1]}">${ICON('gem', 'size-5')}</span>`, hue: 'var(--color-brand-gold)', grams: 10, k: '21k', paid: 35040, sub: `${f0(GRAM['21k'])} a gram · 12:40 today`, cta: ['Add gold', 'Sell'], prices: true, moves: [['in', 'Bought 10 g', 'Mar 3 · paid 35,040 in cash', '+10 g']], details: [['Karat', '21k'], ['Counted in', 'Grams'], ['Paid in total', '35,040 EGP'], ['Kept', 'At home']] },
    { id: 'usdt', kind: 'Crypto', name: 'USDT · 500', mark: (s) => `<span aria-hidden="true" class="flex shrink-0 items-center justify-center" style="width:${s}px;height:${s}px;border-radius:${s * 0.28}px;background:var(--cat-shopping-bg);color:var(--cat-shopping-fg)">${ICON('circle-dollar-sign', 'size-5')}</span>`, hue: 'var(--cat-shopping-fg)', val: 500 * RATE.USD, paid: 24100, sub: `${fxn(RATE.USD)} a coin · 12:40 today`, cta: ['Buy', 'Sell'], moves: [['in', 'Bought 500 USDT', 'Jul 20 · on Binance', '+500']], details: [['Coin', 'USDT (Tether)'], ['Held on', 'Binance'], ['Counts for zakat', 'Yes']] },
    { id: 'egx', kind: 'Stocks', name: 'EGX stocks · 4 holdings', mark: (s) => `<span aria-hidden="true" class="flex shrink-0 items-center justify-center" style="width:${s}px;height:${s}px;border-radius:${s * 0.28}px;background:${IC.green[0]};color:${IC.green[1]}">${ICON('trending-up', 'size-5')}</span>`, hue: 'var(--color-brand-green)', val: 31690, paid: 30700, sub: 'Closing prices · Thu 15:00', cta: ['Buy', 'Sell'], moves: [['in', 'Bought COMI · 40 shares', 'Sep 8 · from CIB Current', 4120]], details: [['Broker', 'Thndr'], ['Holdings', 'COMI, TMGH, EFIH, FWRY'], ['Held as', 'Long-term'], ['Counts for zakat', '30% of the value']] },
  ]
  H[1].val = H[1].grams * GRAM[H[1].k]
  const hd = (id) => H.find((h) => h.id === id)
  const chg = (h) => (h.paid ? { n: h.val - h.paid, pct: ((h.val - h.paid) / h.paid) * 100 } : null)

  /* ---------- totals, all derived; New car's 18 g gold is its own part (in Goals), the 10 g here is not tied to a goal ---------- */
  const T = () => {
    const pockets = PK.reduce((s, p) => s + egp(p), 0)
    const goals = GL.reduce((s, g) => s + gl(g[0]).saved, 0)
    const inv = H.reduce((s, h) => s + h.val, 0)
    const sav = SAV_ACC.reduce((s, id) => s + acct(id).bal, 0)
    return { pockets, goals, inv, sav, all: pockets + goals + inv }
  }
  const SIMPLE_MONTH = 12000
  const EF_PK = ['monthly', 'cash']
  const ef = () => { const cov = EF_PK.reduce((s, id) => s + egp(pk(id)), 0); return { cov, months: cov / SIMPLE_MONTH, tgt: SIMPLE_MONTH * 3 } }
  const zak = (nisab = 'silver') => {
    const t = T()
    const lines = [['Pockets', t.pockets], ['Goals · with 18 g gold', t.goals], ['Certificate', hd('cert').val], ['Gold · 10 g', hd('gold').val], ['Crypto', hd('usdt').val], ['Stocks · 30% counts', hd('egx').val * 0.3], ['Debts due this year', -13000]]
    const base = lines.reduce((s, l) => s + l[1], 0)
    const nis = nisab === 'gold' ? 85 * GRAM['24k'] : 595 * 52
    return { lines, base, nis, due: base >= nis ? base * 0.025 : 0 }
  }

  /* ---------- month end: October leftover, split by "Where your monthly savings go" ---------- */
  const SPLIT = [['g:umrah', 30], ['g:trip', 20], ['g:car', 20], ['p:car', 10]]
  const ME = {
    fit: { got: 38500, spent: 30800, saved: 1500, caps: [['cib:cur', Infinity]] },
    cap: { got: 38500, spent: 30800, saved: 1500, caps: [['cib:cur', 4000], ['nbe:cur', 1000]] },
    over: { got: 32800, spent: 34800, saved: 0, caps: [] },
  }
  const itemOf = (key) => { const [t, id] = key.split(':'); if (t === 'p') { const p = pk(id); return { key, name: p.name, mark: (s) => pMark(p, s), sub: `Pocket · ${p.home ? `in ${acct(p.home).name}` : 'outside your accounts'}` } } const g = gl(id); return { key, name: g.name, mark: (s) => pocketMark(POCKET[id], s), sub: `Goal · ${f0(g.saved)} of ${f0(g.target)}` } }
  const split = (st) => { st.sv8sp ||= Object.fromEntries(SPLIT); return st.sv8sp }
  const splitSum = (st) => Object.values(split(st)).reduce((s, n) => s + n, 0)
  /* placed = min(leftover, free money); each account capped at its free; fill order = most free first */
  const monthEnd = (st) => {
    const m = ME[st.sv8me || 'fit']
    const left = m.got - m.spent - m.saved
    if (left <= 0) return { m, left, placed: 0, items: [], accts: [], short: 0 }
    const free = m.caps.reduce((s, c) => s + c[1], 0)
    const placed = Math.min(left, free)
    const sp = split(st)
    const shares = Object.entries(sp).filter(([, n]) => n > 0).map(([k, n]) => [k, Math.round((placed * n) / 100)])
    shares.push(['p:monthly', placed - shares.reduce((s, x) => s + x[1], 0)])
    const room = m.caps.map(([id, c]) => [id, c])
    const items = shares.filter((x) => x[1] > 0).map(([k, n]) => { const parts = []; let r = n; for (const c of room) { if (!r) break; const take = Math.min(r, c[1]); if (take > 0) { parts.push([c[0], take]); c[1] -= take; r -= take } } return { ...itemOf(k), n, parts } })
    const accts = m.caps.map(([id]) => [id, items.reduce((s, it) => s + it.parts.filter((p) => p[0] === id).reduce((a, p) => a + p[1], 0), 0)]).filter((a) => a[1] > 0)
    return { m, left, placed, items, accts, short: left - placed }
  }

  /* ---------- small parts (mirror lrow / secHead / WealthPlanRows classes) ---------- */
  const tile = (ic, t, s = 40) => `<span aria-hidden="true" class="flex shrink-0 items-center justify-center rounded-[11px]" style="width:${s}px;height:${s}px;background:${t[0]};color:${t[1]}">${ICON(ic, s > 30 ? 'size-5' : 'size-4')}</span>`
  const SEP = '<div aria-hidden="true" class="ms-[68px] h-px bg-[var(--color-brand-border)]"></div>'
  const CARD8 = `overflow-hidden ${CARDBOX} shadow-[var(--shadow-sm)]`
  const bar = (pct, tone = 'var(--color-brand-primary)') => `<span class="mt-2 block h-1 rounded-full bg-[var(--color-brand-elevated)]"><span class="block h-full rounded-full" style="width:${Math.min(100, pct)}%;background:${tone}"></span></span>`
  const head = (t, n, act, mark = '') => `<div class="mb-2 flex min-h-11 items-center gap-2 px-1"><h2 class="text-[17px] font-bold text-[var(--color-brand-text-primary)]">${t}</h2>${n != null ? `<span class="font-mono-numbers text-[0.8125rem] font-semibold ${MUTED}">${n}</span>` : ''}${mark}${act ? `<button type="button" data-sv8="${act[0]}" class="ms-auto inline-flex h-11 items-center gap-1 px-1 text-[0.875rem] font-semibold text-[var(--color-brand-primary-ink)]">${act[2] ? ICON('plus', 'size-4') : ''}${act[1]}${act[2] ? '' : ICON('chevron-right', 'size-4')}</button>` : ''}</div>`
  const row = (o, i) => `${i ? SEP : ''}<button type="button" data-sv8="${o.act}" class="flex min-h-[64px] w-full items-center gap-3 px-4 py-2.5 text-start transition-colors hover:bg-[var(--color-brand-elevated)]">${o.lead}<span class="min-w-0 flex-1"><span class="flex min-w-0 items-center gap-1.5"><span class="truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${o.title}</span>${o.badge || ''}</span><span class="mt-1 flex min-w-0 items-center gap-1.5 text-xs font-medium ${MUTED}">${o.sub}</span>${o.bar != null ? bar(o.bar) : ''}${o.after || ''}</span>${o.amt != null ? `<span class="shrink-0 self-start pt-0.5 text-end"><span class="block whitespace-nowrap font-mono-numbers text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]">${o.amt} <span class="text-[0.6875rem] font-normal ${MUTED}">${o.unit || 'EGP'}</span></span>${o.amt2 ? `<span class="mt-[3px] block whitespace-nowrap font-mono-numbers text-[0.71875rem] font-medium ${o.amt2c || MUTED}">${o.amt2}</span>` : ''}</span>` : ''}${o.chev ? ICON('chevron-right', `size-4 shrink-0 ${MUTED}`) : ''}</button>`
  const card = (rows) => `<div class="${CARD8}">${rows.map(row).join('')}</div>`
  const up = (c) => `${c.n >= 0 ? '▲' : '▼'} ${c.pct.toFixed(1)}%`
  const textLink = (act, t, cls = '') => `<button type="button" data-sv8="${act}" class="inline-flex h-11 items-center gap-1 px-1 text-[0.84375rem] font-semibold text-[var(--color-brand-primary-ink)] ${cls}">${t}</button>`

  const pocketRow = (p) => ({ act: `p:${p.id}`, lead: pMark(p), title: p.name, sub: where(p), amt: p.cur === 'USD' ? f0(p.bal) : fa(p.bal), unit: p.cur || 'EGP', amt2: p.cur === 'USD' ? `≈ ${f0(egp(p))} EGP` : '' })
  const goalRow = (k) => { const g = gl(k); return { act: `g:${k}`, lead: pocketMark(POCKET[k], 40), title: g.name, sub: `<span class="truncate">${g.pct}% of ${f0(g.target)}</span>`, bar: g.pct, after: `<span class="mt-1.5 block text-xs leading-relaxed ${SECOND}">${homesLine(g)}</span>`, amt: f0(g.saved) } }
  const holdRow = (h) => { const c = chg(h); return { act: `h:${h.id}`, lead: h.mark(40), title: h.name, badge: '', sub: `<span class="truncate">${h.sub}</span>`, amt: f0(h.val), amt2: c ? up(c) : '', amt2c: c && c.n >= 0 ? 'text-[var(--color-brand-green)]' : '' } }

  /* ---------- home ---------- */
  const legend = (c, l) => `<span class="inline-flex items-center gap-1.5"><span class="size-2 rounded-[2px]" style="background:${c}"></span>${l}</span>`
  const hero = () => {
    const t = T()
    const pc = (n) => Math.round((n / t.all) * 100)
    const parts = [[pc(t.pockets), 'var(--flow-band-fg)', 'Pockets', 1], [pc(t.goals), 'color-mix(in oklab, var(--flow-band-fg) 62%, transparent)', 'Goals', 0.62], [100 - pc(t.pockets) - pc(t.goals), 'color-mix(in oklab, var(--flow-band-fg) 40%, transparent)', 'Investments', 0.4]]
    const scale = [`<span class="flex gap-3">${parts.map(([p, c, l]) => legend(c, `${l} ${p}%`)).join('')}</span>`]
    const inv = H.filter((h) => h.paid)
    return heroBand({ label: 'Saved and invested', big: fit8(t.all), n: t.all, bar: { split: parts.map(([p, , , o]) => [p, o]), lscale: scale }, lnote: noteLine(`${B(`+${f0(ME.fit.saved)}`)} added in October`, `Investments ${B(up({ n: 1, pct: (inv.reduce((s, h) => s + h.val - h.paid, 0) / inv.reduce((s, h) => s + h.paid, 0)) * 100 }))} since bought`) }, true)
  }
  const splitRow = (st) => {
    const n = Object.values(split(st)).filter((x) => x > 0).length
    return `<div class="mx-4 mt-3 ${CARD8}"><button type="button" data-sv8="split" class="flex min-h-[64px] w-full items-center gap-3 px-4 py-2.5 text-start transition-colors hover:bg-[var(--color-brand-elevated)]">${tile('split', IC.teal)}<span class="min-w-0 flex-1"><span class="block text-[0.9375rem] font-semibold leading-snug text-[var(--color-brand-text-primary)]">Where your monthly savings go${new9()}</span><span class="mt-1 block truncate font-mono-numbers text-xs font-medium ${MUTED}">${splitSum(st)}% to ${n} items · rest to Monthly savings</span></span>${ICON('chevron-right', `size-4 shrink-0 ${MUTED}`)}</button></div>`
  }
  const variantBar = (st) => `<div role="group" aria-label="Sample month end" class="mx-4 mt-3 flex items-center gap-2 rounded-2xl border border-dashed border-[var(--color-brand-border-strong)] p-1.5"><span class="ps-2 text-xs font-semibold ${MUTED}">Month end</span><div class="inline-flex min-w-0 flex-1 gap-0.5 rounded-xl bg-[var(--color-brand-elevated)] p-[3px]">${[['fit', 'Fits'], ['cap', 'Capped'], ['over', 'Overspent']].map(([k, l]) => `<button type="button" data-sv8="mev:${k}" aria-pressed="${(st.sv8me || 'fit') === k}" class="${(st.sv8me || 'fit') === k ? SEG_ON : SEG_OFF}">${l}</button>`).join('')}</div></div>`
  const acctChip = (id, n) => `<span class="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-[var(--color-brand-elevated)] px-2.5 text-xs font-semibold text-[var(--color-brand-text-primary)]">${brand(acct(id).prov, 18)}${acct(id).name}<span class="font-mono-numbers">${f0(n)}</span></span>`
  const meCard = (st) => {
    const r = monthEnd(st)
    const sumLine = `<p class="mt-2 font-mono-numbers text-xs leading-relaxed ${MUTED}">Received ${f0(r.m.got)} · spent ${f0(r.m.spent)}${r.m.saved ? ` · already saved ${f0(r.m.saved)}` : ''}</p>`
    if (r.left <= 0) return `<section class="mx-4 mt-3 ${CARD8} p-4"><div class="flex items-start gap-3">${tile('circle-alert', ['var(--color-brand-elevated)', 'var(--color-brand-text-secondary)'])}<span class="min-w-0 flex-1"><span class="flex items-center text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">October: nothing to set aside${new9()}</span><span class="mt-0.5 block text-[0.84375rem] ${SECOND}">You spent <b class="font-mono-numbers font-semibold text-[var(--color-brand-text-primary)]">${f0(-r.left)}</b> more than you received</span>${sumLine}<span class="mt-1 block text-xs leading-relaxed ${MUTED}">Nothing was set aside and nothing was released.</span></span></div><div class="mt-1 flex justify-end">${textLink('me:dismiss', 'Got it')}</div></section>`
    const where1 = r.accts.length === 1 ? `in ${acct(r.accts[0][0]).name}` : `in ${r.accts.length} accounts`
    if (st.sv8medone) return `<section class="mx-4 mt-3 ${CARD8} p-4"><div class="flex items-center gap-3">${tile('circle-check', IC.green)}<span class="min-w-0 flex-1"><span class="block text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">October leftover set aside</span><span class="mt-0.5 block font-mono-numbers text-xs ${MUTED}">${f0(r.placed)} ${where1} · applied Nov 1</span></span><button type="button" data-sv8="me:undo" class="-me-1 inline-flex h-11 shrink-0 items-center gap-1 px-1 text-[0.84375rem] font-semibold text-[var(--color-brand-primary-ink)]">${ICON('undo-2', 'size-4')}Undo</button></div></section>`
    const short = r.short ? `<div class="mt-3 flex gap-2.5 rounded-2xl bg-[var(--color-brand-amber-soft)] px-3.5 py-3">${ICON('triangle-alert', 'size-[18px] shrink-0 text-[var(--color-brand-amber)]')}<span class="min-w-0 text-[0.8125rem] leading-[1.45] text-[var(--color-brand-text-primary)]"><b class="font-mono-numbers font-semibold">${f0(r.short)}</b> saved but not set aside: no account had it free.<span class="mt-0.5 block text-xs ${SECOND}">${r.m.caps.map(([id, c]) => `${acct(id).name} had ${f0(c)} free`).join(', ')} after card bills.</span></span></div>` : ''
    const itemRows = r.items.map((it, i) => `${i ? '<div aria-hidden="true" class="ms-10 h-px bg-[var(--color-brand-border)]"></div>' : ''}<div class="flex min-h-11 items-center gap-3 py-1.5">${it.mark(28)}<span class="min-w-0 flex-1"><span class="block truncate text-[0.875rem] font-semibold text-[var(--color-brand-text-primary)]">${it.name}</span><span class="block truncate text-xs ${MUTED}">${it.parts.map(([id, n]) => (it.parts.length > 1 ? `${f0(n)} in ${acct(id).name}` : `In ${acct(id).name}`)).join(' · ')}</span></span><span class="shrink-0 font-mono-numbers text-[0.875rem] font-medium text-[var(--color-brand-text-primary)]">${f0(it.n)}</span></div>`).join('')
    return `<section class="mx-4 mt-3 ${CARD8} p-4">
      <div class="flex items-start gap-3">${tile('calendar-check', IC.teal)}<span class="min-w-0 flex-1"><span class="flex items-center text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">October leftover${new9()}</span><span class="mt-0.5 block text-xs ${MUTED}">Applies by itself on Nov 3</span></span><span class="shrink-0 whitespace-nowrap font-mono-numbers text-[1.25rem] font-semibold text-[var(--color-brand-text-primary)]">${f0(r.left)} <span class="text-[0.6875rem] font-normal ${MUTED}">EGP</span></span></div>
      ${sumLine}${short}
      <p class="mt-3 text-[0.6875rem] font-bold uppercase tracking-[0.06em] ${MUTED}">Where it goes${r.short ? ` · ${f0(r.placed)}` : ''}</p>
      <div class="mt-1">${itemRows}</div>
      <div class="mt-2 flex flex-wrap gap-1.5">${r.accts.map(([id, n]) => acctChip(id, n)).join('')}</div>
      <div class="mt-3.5 grid grid-cols-2 gap-2"><button type="button" data-sv8="me:edit" class="${BTN_SOFT} ${SZ.touch}">${ICON('pencil', 'size-[18px]')}Edit</button><button type="button" data-sv8="me:ok" class="${BTN.primary} ${SZ.touch}">${ICON('check', 'size-[18px]')}Confirm</button></div>
    </section>`
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
  const savAccRow = () => ({ act: 'sacc', lead: tile('landmark', IC.teal), title: `${SAV_ACC.length} savings accounts`, sub: '<span class="truncate">In Accounts</span>', amt: f0(T().sav), chev: true })

  const home = (st) => {
    const pkShown = PK.filter((p) => !(p.sys && !p.bal))
    return `<div class="space-y-5 px-4 pb-8 pt-5">
    <section>${head('Pockets', pkShown.length, ['add', 'Add pocket', true])}${card(pkShown.map(pocketRow))}</section>
    <section>${head('Goals', GL.length, ['goals', 'Goals'], new9())}${card(GL.map((g) => goalRow(g[0])))}<p class="mt-2 px-1 text-xs leading-[1.45] ${MUTED}">Savings goals only. Spending limits and pay-off goals stay in Goals.</p></section>
    <section>${head('Savings accounts', null, null, new9())}${card([savAccRow()])}</section>
    <section>${head('Investments', H.length, ['addinv', 'Add', true])}${card(H.map(holdRow))}<p class="mt-2 px-1 text-xs leading-[1.45] ${MUTED}">New car’s 18 g of gold is counted once, in Goals. This 10 g isn’t part of a goal.</p></section>
    ${efCard()}
    ${zakatCard()}
  </div>`
  }

  /* ---------- "Where your monthly savings go" (a list, so a page) ---------- */
  const back = `<button type="button" data-sv8="back" class="-ms-2 mb-1 inline-flex h-11 items-center gap-1 px-2 text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${ICON('chevron-left', 'size-5')}Savings</button>`
  const splitPage = (st) => {
    const sp = split(st)
    const sum = splitSum(st)
    const left = monthEnd({ ...st, sv8me: 'fit' }).left
    const stepBtn = (dir, k, dis) => `<button type="button" data-sv8="sp:${dir}:${k}" ${dis ? 'disabled' : ''} aria-label="${dir === 'inc' ? '5% more' : '5% less'}" class="${CLOSE_BTN} ${dis ? 'opacity-40' : ''}">${ICON(dir === 'inc' ? 'plus' : 'minus', 'size-4')}</button>`
    const rows = Object.keys(sp).map((k, i) => { const it = itemOf(k); const n = sp[k]; return `${i ? SEP : ''}<div class="flex min-h-[72px] items-center gap-3 px-4 py-2.5">${it.mark(40)}<span class="min-w-0 flex-1"><span class="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${it.name}</span><span class="mt-0.5 block truncate font-mono-numbers text-xs ${MUTED}">≈ ${f0(Math.round((left * n) / 100))} in October</span></span><span class="flex shrink-0 items-center gap-0.5">${stepBtn('dec', k, n <= 0)}<span class="w-11 text-center font-mono-numbers text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${n}%</span>${stepBtn('inc', k, sum >= 100)}</span></div>` }).join('')
    const rest = 100 - sum
    const restRow = `${SEP}<div class="flex min-h-[64px] items-center gap-3 bg-[var(--color-brand-elevated)] px-4 py-2.5">${pMark(pk('monthly'))}<span class="min-w-0 flex-1"><span class="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">Rest → Monthly savings</span><span class="mt-0.5 block truncate font-mono-numbers text-xs ${MUTED}">≈ ${f0(left - Object.values(sp).reduce((s, n) => s + Math.round((left * n) / 100), 0))} in October</span></span><span class="me-[34px] w-11 shrink-0 text-center font-mono-numbers text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${rest}%</span></div>`
    const segs = Object.keys(sp).map((k) => `<span class="h-full rounded-full bg-[var(--color-brand-primary)]" style="width:${sp[k]}%"></span>`).join('')
    return `<div class="mx-4 mt-2">${back}<h2 class="flex items-center text-[1.375rem] font-bold leading-tight text-[var(--color-brand-text-primary)]">Where your monthly savings go${new9()}</h2><p class="mt-1 text-[0.875rem] leading-snug ${SECOND}">At each month end, what’s left after spending is split like this and set aside in the accounts that hold it.</p></div>
    <div class="mx-4 mt-4 ${CARD8} p-4"><div class="flex items-baseline justify-between"><span class="text-[0.84375rem] font-semibold text-[var(--color-brand-text-primary)]">Split</span><span class="font-mono-numbers text-[0.84375rem] font-semibold ${sum > 100 ? 'text-[var(--color-brand-red)]' : 'text-[var(--color-brand-text-primary)]'}">${sum}% <span class="font-medium ${MUTED}">of 100%</span></span></div><div class="mt-2 flex h-2 gap-[3px] overflow-hidden rounded-full bg-[var(--color-brand-elevated)]">${segs}</div><p class="mt-1.5 font-mono-numbers text-xs ${MUTED}">${rest}% rest goes to Monthly savings</p></div>
    <div class="px-4 pb-8 pt-5"><section>${head('Goals and pockets', Object.keys(sp).length)}<div class="${CARD8}">${rows}${restRow}</div><div class="mt-1 flex justify-center">${textLink('spadd', `${ICON('plus', 'size-4')}Add a goal or pocket`)}</div><p class="mt-1 px-1 text-xs leading-[1.45] ${MUTED}">The total can’t go above 100%. Each share is capped at the free money in its account; what fits nowhere is shown on the month-end card, never invented.</p></section></div>`
  }

  /* ---------- holding detail page (unchanged) ---------- */
  const tint = (c) => `--provider-brand:${c};background:linear-gradient(160deg, color-mix(in oklab, var(--provider-brand) var(--provider-hero-amt), var(--provider-hero-base)), color-mix(in oklab, var(--provider-brand) calc(var(--provider-hero-amt) - 14%), var(--provider-hero-base)))`
  const pill = (t) => `<span class="inline-flex min-h-7 items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--flow-band-fg)_14%,transparent)] px-3 text-[0.78125rem] font-semibold">${t}</span>`
  const heroMark = (ic) => `<span aria-hidden="true" class="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--flow-band-mix)]">${ICON(ic, 'size-5')}</span>`
  const menuBtn = `<button type="button" data-sv8="menu" aria-label="More actions" class="-me-1.5 flex size-11 shrink-0 items-center justify-center rounded-full">${ICON('ellipsis', 'size-5')}</button>`
  const ctas = (a, b) => `<div class="mx-4 mt-3 grid grid-cols-2 gap-2"><button type="button" data-sv8="addmoney" class="${BTN.primary} ${SZ.touch}">${ICON('plus', 'size-[18px]')}${a}</button><button type="button" data-sv8="withdraw" class="${BTN_SOFT} ${SZ.touch}">${ICON('arrow-up-right', 'size-[18px]')}${b}</button></div>`
  const moveRows = (moves, cur) => moves.map(([d, t, s, n], i) => `${i ? SEP : ''}<div class="flex min-h-[60px] items-center gap-3 px-4 py-2.5">${tile(d === 'in' ? 'arrow-down-left' : 'arrow-up-right', d === 'in' ? IC.green : ['var(--color-brand-elevated)', 'var(--color-brand-text-secondary)'])}<span class="min-w-0 flex-1"><span class="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${t}</span><span class="mt-1 block truncate text-xs font-medium ${MUTED}">${s}</span></span><span class="shrink-0 whitespace-nowrap font-mono-numbers text-[0.9375rem] font-medium" style="color:${typeof n === 'string' || n > 0 ? 'var(--color-brand-green)' : 'var(--color-brand-text-primary)'}">${typeof n === 'string' ? n : `${n > 0 ? '+' : MINUS}${f0(n)} <span class="text-[0.6875rem] font-normal ${MUTED}">${cur}</span>`}</span></div>`).join('')
  const empty = `<div class="flex flex-col items-center px-6 py-7 text-center"><span class="flex size-11 items-center justify-center rounded-[14px] bg-[var(--color-brand-elevated)] ${SECOND}">${ICON('arrow-left-right', 'size-5')}</span><p class="mt-3 text-[0.9375rem] font-bold text-[var(--color-brand-text-primary)]">No moves yet</p><p class="mt-1 max-w-[30ch] text-[0.84375rem] leading-snug ${SECOND}">Money you add to this pocket or take out of it shows here.</p></div>`
  const facts = (rows) => `<div class="divide-y divide-[var(--color-brand-border)] ${CARD8}">${rows.map(([k, v]) => `<div class="flex min-h-[52px] items-center gap-3 px-4"><span class="w-[112px] shrink-0 text-[0.84375rem] ${SECOND}">${k}</span><span class="flex min-w-0 flex-1 items-center justify-end gap-2 text-end text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]">${v}</span></div>`).join('')}</div>`
  const holdPage = (h) => {
    const c = chg(h)
    const gold = h.id === 'gold'
    const big = gold ? `${h.grams}` : f0(h.val)
    const unit = gold ? 'g of 21k' : 'EGP'
    const value = gold ? `<p class="mt-1 font-mono-numbers text-[0.9375rem] font-semibold">${f0(h.val)} EGP <span class="text-[0.78125rem] font-medium opacity-80">today</span></p>` : ''
    const priceLine = `<p class="mt-2 flex items-center gap-1.5 text-xs opacity-80">${ICON('clock', 'size-3.5')}${gold ? `${f0(GRAM['21k'])} a gram · updated 12:40 today` : h.id === 'cert' ? 'Matures 12 Mar 2028 · 17.5% a year' : h.sub}</p>`
    const hh = `<div class="mx-4 mt-2">${back}<section class="overflow-hidden rounded-3xl px-[18px] pb-4 pt-4 text-[var(--flow-band-fg)]" style="${tint(h.hue)}"><div class="flex items-center gap-3">${gold ? heroMark('gem') : h.id === 'cert' ? brand('cib', 40) : heroMark(h.id === 'usdt' ? 'circle-dollar-sign' : 'trending-up')}<span class="min-w-0 flex-1"><span class="block truncate text-[1.0625rem] font-bold">${gold ? 'Gold 21k' : h.name}</span><span class="block truncate text-[0.78125rem] opacity-80">${h.kind}${h.id === 'cert' ? ' · 3 years' : ''}</span></span>${menuBtn}</div><p class="mt-4 text-xs font-semibold opacity-80">${gold ? 'You hold' : 'Worth today'}</p><p class="flex items-baseline gap-1.5"><span class="font-mono-numbers text-[32px] font-semibold leading-[1.05] tracking-[-0.04em]">${big}</span><span class="text-[0.8125rem] font-semibold">${unit}</span></p>${value}${priceLine}${c ? `<div class="mt-3 flex flex-wrap gap-2">${pill(`<span class="font-mono-numbers">${up(c)} · ${c.n >= 0 ? '+' : MINUS}${f0(c.n)}</span>&nbsp;since you bought`)}</div>` : ''}</section></div>`
    const prices = gold ? `<section>${head('Price a gram')}<div class="${CARD8}"><div class="grid grid-cols-3 divide-x divide-[var(--color-brand-border)]">${['24k', '21k', '18k'].map((k) => `<div class="px-3 py-2.5"><span class="text-[0.6875rem] font-bold text-[var(--color-brand-gold)]">${k}</span><p class="mt-0.5 font-mono-numbers text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${f0(GRAM[k])}</p></div>`).join('')}</div></div><p class="mt-2 px-1 text-xs leading-[1.45] ${MUTED}">Your ${h.grams} g are valued at the 21k price.</p></section>` : ''
    return `${hh}${ctas(h.cta[0], h.cta[1])}<div class="space-y-5 px-4 pb-8 pt-5">${prices}<section>${head(gold ? 'Purchases' : 'Recent moves', h.moves.length)}<div class="${CARD8}">${moveRows(h.moves, 'EGP')}</div></section><section>${head('Details')}${facts(h.details)}</section></div>`
  }

  /* ---------- the page ---------- */
  P8.wealth = (st) => {
    const S = Object.values(screens).find((x) => x.st === st)
    const h1 = S && S.el.querySelector('header h1'); if (h1) h1.textContent = 'Savings'
    const v = st.sv8v
    if (v === 'split') return splitPage(st)
    if (v && v.startsWith('h:')) return holdPage(hd(v.slice(2)))
    return `${variantBar(st)}${hero()}${splitRow(st)}${st.sv8medis ? '' : meCard(st)}${home(st)}`
  }
  NAV_PAGE.Savings = 'wealth'
  setTimeout(() => { Object.values(screens).forEach((S) => { if (S.v7) return; S.el.querySelectorAll('nav a span').forEach((n) => { if (n.textContent.trim() === 'Wealth') n.textContent = 'Savings' }) }) }, 0)
  document.getElementById('pz-page')?.addEventListener('click', () => Object.values(screens).forEach((S) => { S.st.sv8v = null }), true)

  /* ---------- provider-style account picker (bank, then its account); shared with other areas ---------- */
  const sv8Pick = (S, on, done, o = {}) => {
    const onProv = on && on !== 'outside' ? acct(on)?.prov : null
    const prow = ([k, name]) => {
      const l = ACC[k]
      const one = l.length === 1
      const a = l[0]
      const taken = one && o.taken?.[a[0]]
      const sub = one ? `${a[2] ? `${a[2]} · ` : ''}${a[5] || `${f0(a[4])} ${a[3]}`}` : `${l.length} accounts`
      return `<button type="button" data-sv8pv="${k}" ${taken ? 'aria-disabled="true"' : ''} class="flex min-h-[64px] w-full items-center gap-3 px-4 py-2.5 text-start ${taken ? 'opacity-50' : 'hover:bg-[var(--color-brand-elevated)]'}">${brand(k, 40)}<span class="min-w-0 flex-1"><span class="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${one ? a[1] : name}</span><span class="mt-0.5 block truncate font-mono-numbers text-xs ${MUTED}">${taken ? `Already holds ${taken}` : sub}</span></span>${one ? tick(on === a[0], false) : `${onProv === k ? `<span class="text-xs font-semibold text-[var(--color-brand-primary-ink)]">${acct(on).name.replace(`${name} `, '')}</span>` : ''}${ICON('chevron-right', `size-4 shrink-0 ${MUTED}`)}`}</button>`
    }
    const grp = (kind, t) => `${sectionHead(t).replace('pt-1', 'pt-4')}<div class="mx-4 divide-y divide-[var(--color-brand-border)] ${CARDBOX} overflow-hidden">${PROVS8.filter((p) => p[2] === kind).map(prow).join('')}</div>`
    const outside = o.outside ? `<div class="mx-4 overflow-hidden ${CARDBOX}"><button type="button" data-sv8pv="outside" class="flex min-h-[60px] w-full items-center gap-3 px-4 text-start">${tile('arrow-left-right', ['var(--color-brand-elevated)', 'var(--color-brand-text-secondary)'])}<span class="min-w-0 flex-1"><span class="block text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">Outside buddget</span><span class="block text-xs ${SECOND}">Money you already had, or don’t track</span></span>${tick(on === 'outside', false)}</button></div>` : ''
    const sh = ltSheet(S, o.title || 'Paid from', o.sub || 'Pick the bank, then the account', `${outside}${grp('bank', 'Banks')}${grp('wallet', 'Wallets and cash')}`, '', o.z || 220)
    sh.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-sv8pv]'); if (!b || b.getAttribute('aria-disabled')) return
      const k = b.dataset.sv8pv
      if (k === 'outside') { sh.close(); return done('outside') }
      const l = ACC[k]
      if (l.length === 1) { sh.close(); return done(l[0][0]) }
      const name = PROVS8.find((p) => p[0] === k)[1]
      const arow = (a) => { const taken = o.taken?.[a[0]]; return `<button type="button" data-sv8ac="${a[0]}" ${taken ? 'aria-disabled="true"' : ''} class="flex min-h-[64px] w-full items-center gap-3 px-4 py-2.5 text-start ${taken ? 'opacity-50' : ''}">${brand(k, 40)}<span class="min-w-0 flex-1"><span class="flex items-center gap-1.5"><span class="truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${a[1]}</span>${a[3] !== 'EGP' ? badge('muted', a[3]) : ''}</span><span class="mt-0.5 block truncate font-mono-numbers text-xs ${MUTED}">${taken ? `Already holds ${taken}` : `${a[2]} · ${f0(a[4])} ${a[3]}${a[5] ? ` · ${a[5]}` : ''}`}</span></span>${tick(on === a[0], false)}</button>` }
      const s2 = ltSheet(S, name, `${l.length} accounts · pick one`, `<div class="mx-4 divide-y divide-[var(--color-brand-border)] overflow-hidden ${CARDBOX}">${l.map(arow).join('')}</div>`, '', (o.z || 220) + 20)
      s2.el.addEventListener('click', (e2) => { const a = e2.target.closest('[data-sv8ac]'); if (!a || a.getAttribute('aria-disabled')) return; s2.close(); sh.close(); done(a.dataset.sv8ac) })
    })
    return sh
  }
  window.sv8Pick = sv8Pick
  const sv8PocketPick = (S, on, except, done) => {
    const body = `<div class="mx-4 overflow-hidden ${CARDBOX}">${PK.filter((p) => p.id !== except).map((p, i) => `${i ? SEP : ''}<button type="button" data-sv8pk="${p.id}" role="radio" aria-checked="${p.id === on}" class="flex min-h-[64px] w-full items-center gap-3 px-4 py-2.5 text-start">${pMark(p)}<span class="min-w-0 flex-1"><span class="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${p.name}</span><span class="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs ${MUTED}">${where(p)}<span class="shrink-0 font-mono-numbers">· ${amtOf(p)}</span></span></span>${tick(p.id === on, false)}</button>`).join('')}</div>`
    const sh = ltSheet(S, 'Which pocket?', '', body, '', 240)
    sh.el.addEventListener('click', (e) => { const b = e.target.closest('[data-sv8pk]'); if (b) { sh.close(); done(b.dataset.sv8pk) } })
  }

  /* ---------- "Where is this money?" (outside money is never a bare amount) ---------- */
  const WHERE = [['new', 'An account I haven’t added', 'Add it with its real balance, then set money aside inside it', 'landmark', IC.teal], ['cash', 'Cash', `Your Cash account · ${f0(acct('cash:c').bal)} now`, 'banknote', IC.amber], ['gold', 'Gold or other', 'Kept outside your accounts, like gold or a car', 'gem', GOLD]]
  const whereV = (w) => (!w ? `<span class="text-[0.875rem] font-semibold text-[var(--color-brand-primary-ink)]">Where is this money?</span>` : w === 'cash' ? acctV('cash:c') : `<span class="truncate">${WHERE.find((x) => x[0] === w)[1]}</span>`)
  const whereSheet = (S, on, done) => {
    const body = `<div class="mx-4 overflow-hidden ${CARDBOX}">${WHERE.map(([k, t, s, ic, tn], i) => `${i ? SEP : ''}<button type="button" data-sv8w="${k}" role="radio" aria-checked="${on === k}" class="flex min-h-[68px] w-full items-center gap-3 px-4 py-2.5 text-start hover:bg-[var(--color-brand-elevated)]">${tile(ic, tn)}<span class="min-w-0 flex-1"><span class="block text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${t}</span><span class="mt-0.5 block text-xs leading-snug ${MUTED}">${s}</span></span>${tick(on === k, false)}</button>`).join('')}</div><p class="mx-5 mt-3 text-xs leading-relaxed ${MUTED}">Money from outside is counted where it really sits, as an opening balance, not as income.</p>`
    const sh = ltSheet(S, 'Where is this money?', 'So it’s counted once, where it really is', body, '', 240)
    sh.el.addEventListener('click', (e) => { const b = e.target.closest('[data-sv8w]'); if (!b) return; sh.close(); if (b.dataset.sv8w === 'new') toast(S, 'Opens Add account with its real balance'); done(b.dataset.sv8w) })
    return sh
  }

  /* ---------- sheets ---------- */
  const addMoney = (S, p) => {
    const sel = { a: p.home || 'cib:cur', pk: p.id === 'monthly' ? 'car' : 'monthly', w: null }
    const fromAcct = () => ({ k: 'From', v: acctV(sel.a), fn: (S2, r, redraw) => ltMethodPicker(S, pmOf(sel.a), (m) => { const a = PM2ACC[m]; if (!a) return toast(S, `${PM[m].name} is a credit card. Savings sit in an account.`); sel.a = a; r.v = acctV(a); redraw() }) })
    const fromPk = () => ({ k: 'From pocket', v: pV(pk(sel.pk)), fn: (S2, r, redraw) => sv8PocketPick(S, sel.pk, p.id, (id) => { sel.pk = id; r.v = pV(pk(id)); redraw() }) })
    const fromOut = () => ({ k: 'From', v: whereV(sel.w), fn: (S2, r, redraw) => whereSheet(S, sel.w, (w) => { sel.w = w; r.v = whereV(w); redraw() }) })
    const c = { title: `Into ${p.name}`, iconHTML: pMark(p, 52), sign: '+', amt: p.cur === 'USD' ? '100' : '2,000', cur: p.cur || 'EGP', lockCur: true, day: 28, time: '12:00', note: false, cta: 'Add money', done: `Added to ${p.name}`, mode: 'acct' }
    c.rows = [{ k: 'Into', v: pV(p), static: true }, fromAcct()]
    const how = () => (c.mode === 'outside' ? (sel.w === 'cash' ? (p.home ? `cash deposited into ${acct(p.home).name}, then set aside` : 'from your Cash account') : sel.w === 'new' ? 'once that account is added' : sel.w === 'gold' ? (p.home ? 'gold is kept as its own holding' : 'kept as an outside holding') : 'say where this money is') : c.mode === 'pocket' ? 'stays inside your savings' : p.home && sel.a === p.home ? `set aside in ${acct(p.home).name}, nothing moves` : p.home ? `moves from ${acct(sel.a).name} to ${acct(p.home).name}` : `from ${acct(sel.a).name}`)
    c.line = (v) => `${amtOf(p).replace(' USD', '')} → ${f0(p.bal + v)} · ${how()}`
    c.pre = () => srcTabs(c.mode)
    c.onPre = (k, rows) => { c.mode = k; rows[1] = k === 'acct' ? fromAcct() : k === 'pocket' ? fromPk() : fromOut() }
    ltTx(S, c)
  }
  const release = (S, p) => {
    const a = acct(p.home)
    const line = (st) => `${p.name} goes from ${f0(p.bal)} to ${f0(Math.max(0, p.bal - num4(st.amt)))}`
    form4(S, {
      title: 'Release', sub: `From ${p.name}`, z: 220, state: { amt: '1,000' },
      body: (st) => `${hero4({ amt: st.amt, ctl: unit4(a.cur), top: pMark(p, 52), line: line(st) })}${grp4([row4('From', pV(p)), row4('Stays in', acctV(p.home))], '', `Stays in ${a.name}, back to Free to spend. Nothing moves at the bank.`)}`,
      foot: (st) => foot4(`Release ${st.amt || 0}`), done: 'Released · back to Free to spend',
      onInput: (f, st, s) => { if (f.dataset.in !== 'amt') return; s.el.querySelector('[data-f4] [data-done]').textContent = `Release ${st.amt || 0}`; s.el.querySelector('[data-line]').textContent = line(st) },
    })
  }
  const withdraw = (S, p) => {
    form4(S, {
      title: 'Withdraw', sub: `Money leaving ${p.name}`, z: 220, state: { amt: p.cur === 'USD' ? '100' : '1,000', for: 'spend', to: p.cur === 'USD' ? 'cib:usd' : 'cash:c', mv: 'monthly' },
      body: (st) => `${hero4({ amt: st.amt, ctl: unit4(p.cur || 'EGP'), top: pMark(p, 52), line: `${p.name} goes from ${f0(p.bal)} to ${f0(Math.max(0, p.bal - num4(st.amt)))}` })}${grp4([row4('From', pV(p)), row4('For', FOR.find((f) => f[0] === st.for)[1], 'for'), st.for === 'debt' ? row4('Debt', 'Car loan · 33,000 left', 'debt') : st.for === 'move' ? row4('Into', pV(pk(st.mv)), 'mv') : row4('Into', acctV(st.to), 'to')], '', 'It leaves what you hold outside your accounts.')}`,
      foot: (st) => foot4(`Withdraw ${st.amt || 0}`), done: 'Withdrawn',
      onInput: (f, st, s) => { if (f.dataset.in !== 'amt') return; s.el.querySelector('[data-f4] [data-done]').textContent = `Withdraw ${st.amt || 0}`; s.el.querySelector('[data-line]').textContent = `${p.name} goes from ${f0(p.bal)} to ${f0(Math.max(0, p.bal - num4(st.amt)))}` },
      on: { for: (v, draw, st) => ltOptPicker(S, 'What is it for?', '', FOR, st.for, (x) => { st.for = x; draw() }), to: (v, draw, st) => sv8Pick(S, st.to, (id) => { st.to = id; draw() }, { title: 'Into which account?', z: 240 }), mv: (v, draw, st) => sv8PocketPick(S, st.mv, p.id, (id) => { st.mv = id; draw() }), debt: () => toast(S, 'Opens your debts') },
    })
  }
  const addGold = (S) => {
    form4(S, {
      title: 'Add gold', state: { amt: '8', unit: 'g', k: '21k', from: 'cib:cur', paid: '32,400', date: 'Mon, 12 Oct' },
      body: (st) => { const grams = num4(st.amt) * (st.unit === 'g' ? 1 : st.unit === 'pound' ? 8 : 31.1); return `${hero4({ amt: st.amt, ctl: ctl4('unit', GUNIT[st.unit][0], 'Unit'), top: TILE52('gem', GOLD), line: `${st.unit === 'g' ? '' : `${f0(grams)} g · `}Worth ${f0(grams * GRAM[st.k])} today · live price` })}${KSEG(st.k)}${grp4([row4('Paid from', st.from === 'outside' ? `<span class="text-[0.875rem] ${SECOND}">Outside buddget</span>` : acctV(st.from), 'from'), st.from === 'outside' ? '' : in4('paid', 'Paid', '32,400', st.paid, 'decimal'), date4('Bought on', st.date)], '', st.from === 'outside' ? 'Only added to what you hold. Nothing leaves your accounts.' : 'Logged as moving money into gold, not as spending.')}` },
      foot: (st) => foot4(`Add ${st.amt || 0} ${GUNIT[st.unit][0]} of ${st.k}`), done: 'Gold added',
      on: { unit: (v, draw, st) => ltOptPicker(S, 'Counted in', 'How the shop or your receipt counts it', Object.entries(GUNIT).map(([k, [, t, s]]) => [k, t, s]), st.unit, (u) => { st.unit = u; draw() }), from: (v, draw, st) => sv8Pick(S, st.from, (id) => { st.from = id; draw() }, { outside: true }) },
    })
  }
  const KINDS = [['bank', 'Bank account', 'One you don’t track in Accounts', 'landmark', IC.teal], ['wallet', 'Mobile wallet', 'Vodafone Cash, Orange Cash', 'smartphone', IC.green], ['cash', 'Cash', 'At home or in a safe', 'banknote', IC.amber], ['other', 'Something else', 'Name it, pick an icon', 'shapes', ['var(--color-brand-elevated)', 'var(--color-brand-text-secondary)']]]
  const ASSETS = [['gold', 'Gold', 'Grams, pounds or ounces', 'gem', GOLD], ['cert', 'Certificate', 'Fixed term, pays interest', 'scroll-text', IC.teal], ['crypto', 'Crypto', 'Bitcoin, USDT and more', 'bitcoin', ['var(--cat-shopping-bg)', 'var(--cat-shopping-fg)']], ['stock', 'Stocks', 'EGX or abroad', 'trending-up', IC.green], ['property', 'Property', 'A flat, land, a shop', 'building-2', TR]]
  const kindTile = (k, l, s, ic, t, on, act) => `<button type="button" data-v="${act}:${k}" aria-pressed="${!!on}" class="flex min-h-[112px] flex-col items-start gap-1 rounded-2xl border p-3.5 text-start transition-colors ${on ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-soft)]' : 'border-[var(--color-brand-border)] bg-[var(--color-brand-card)] hover:bg-[var(--color-brand-elevated)]'}">${tile(ic, t, 44)}<span class="mt-1 text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${l}</span><span class="text-xs ${MUTED}">${s}</span></button>`
  const addPocket = (S, tab = 'pocket') => {
    form4(S, {
      title: 'Add pocket', sub: 'A place to keep savings apart', state: { tab, acct: null, kind: null },
      body: (st) => `${seg4('tab', [['pocket', 'Pocket'], ['inv', 'Investment']], st.tab)}${st.tab === 'pocket'
        ? `${grp4([`<button type="button" data-v="acct" class="flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-start hover:bg-[var(--color-brand-elevated)]">${st.acct ? `${brand(acct(st.acct).prov, 40)}<span class="min-w-0 flex-1"><span class="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${acct(st.acct).name} <span class="font-mono-numbers font-medium ${MUTED}">${acct(st.acct).idf}</span></span><span class="mt-0.5 block truncate font-mono-numbers text-xs ${MUTED}">${acct(st.acct).note || `${f0(acct(st.acct).bal)} ${acct(st.acct).cur}`} · the pocket sits inside it</span></span><span class="text-[0.84375rem] font-semibold text-[var(--color-brand-primary-ink)]">Change</span>` : `${tile('wallet', ['var(--color-brand-elevated)', 'var(--color-brand-text-secondary)'])}<span class="min-w-0 flex-1"><span class="block text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">Pick an account</span><span class="mt-0.5 block text-xs ${MUTED}">Choose the bank, then its account</span></span>${ICON('chevron-right', `size-4 shrink-0 ${MUTED}`)}`}</button>`], 'In an account you already have', 'The money stays in the account. The pocket sets part of it aside, apart from Free to spend. One account can hold several pockets.')}${sectionHead('Or start from scratch').replace('pt-1', 'pt-5')}<div class="mx-4 grid grid-cols-2 gap-2.5">${KINDS.map(([k, l, s, ic, t]) => kindTile(k, l, s, ic, t, st.kind === k, 'kind')).join('')}</div>`
        : `<div class="mx-4 mt-4 grid grid-cols-2 gap-2.5">${ASSETS.map(([k, l, s, ic, t]) => kindTile(k, l, s, ic, t, false, 'asset')).join('')}</div><div class="mx-4 mt-3 flex min-h-[60px] items-center gap-3 rounded-2xl bg-[var(--color-brand-elevated)] px-4 py-3">${ICON('clock', `size-[18px] shrink-0 ${MUTED}`)}<p class="text-xs ${SECOND}">Gold and crypto values follow the live price. Each row shows when the price was last updated.</p></div>`}`,
      after: (st, sh) => { const f = sh.el.querySelector('[data-foot]'); if (f) f.hidden = st.tab !== 'pocket' },
      foot: (st) => (st.tab === 'pocket' ? `<button type="button" data-done ${st.acct || st.kind ? '' : 'disabled'} class="${BTN.primary} ${SZ.block}">Add pocket</button>` : ''), done: 'Pocket added',
      on: { acct: (v, draw, st) => sv8Pick(S, st.acct, (id) => { st.acct = id; st.kind = null; draw() }, { title: 'In an account you already have' }), kind: (v, draw, st) => { st.kind = v.dataset.v.split(':')[1]; st.acct = null; draw() }, asset: (v, draw, st, sh) => { const k = v.dataset.v.split(':')[1]; if (k === 'gold') { sh.close(); return addGold(S) } toast(S, `Opens Add ${k === 'cert' ? 'certificate' : k}`) } },
    })
  }

  /* ---------- pocket: a single item, so a sheet (vertical 3-dot: Edit, Delete) ---------- */
  const mrow = (ic, t, s, act, red, dis) => `<button type="button" data-sv8m="${act}" ${dis ? 'aria-disabled="true"' : ''} class="flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-start ${dis ? 'opacity-60' : 'hover:bg-[var(--color-brand-elevated)]'}">${tile(ic, red && !dis ? ['var(--color-brand-red-soft)', 'var(--color-brand-red)'] : ['var(--color-brand-elevated)', 'var(--color-brand-text-secondary)'])}<span class="min-w-0 flex-1"><span class="block text-[0.9375rem] font-semibold ${red && !dis ? 'text-[var(--color-brand-red)]' : 'text-[var(--color-brand-text-primary)]'}">${t}</span><span class="mt-0.5 block text-xs leading-snug ${MUTED}">${s}</span></span></button>`
  const pocketMenu = (S, p, parent) => {
    const delSub = p.sys ? 'Monthly savings can’t be deleted. It hides when empty.' : p.home ? `Its ${f0(p.bal)} stays in ${acct(p.home).name}, back to Free to spend` : `We’ll ask what happens to its ${amtOf(p)}`
    const body = `<div class="mx-4 overflow-hidden ${CARDBOX}">${mrow('pencil', 'Edit pocket', p.sys ? 'Name and icon' : 'Name, icon, where it’s kept', 'edit')}${SEP}${mrow('trash-2', 'Delete pocket', delSub, 'del', true, p.sys)}</div>`
    const sh = ltSheet(S, p.name, '', body, '', 240)
    sh.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-sv8m]'); if (!b || b.getAttribute('aria-disabled')) return
      if (b.dataset.sv8m === 'edit') return toast(S, 'Opens Edit pocket')
      const gone = (msg) => () => { sh.close(); parent?.close(); toast(S, msg) }
      if (p.home) return ltAlert(S, `Delete ${p.name}?`, `Its ${f0(p.bal)} stays in ${acct(p.home).name}, back to Free to spend. Its moves stay in Flow.`, [['solidDanger', 'Delete', gone(`${p.name} deleted`)], ['ghost', 'Cancel']])
      ltAlert(S, `Delete ${p.name}?`, `Do you still have the ${amtOf(p)}? Keep it as something you hold, or remove it from what you own.`, [['solidDanger', 'Delete, keep the money', gone(`${p.name} deleted · ${amtOf(p)} kept as a holding`)], ['danger', 'Delete and remove it', gone(`${p.name} and its ${amtOf(p)} removed`)], ['ghost', 'Cancel']])
    })
  }
  const pocketSheet = (S, p) => {
    const inBank = !!p.home
    const heroP = `<div class="mx-4"><section class="overflow-hidden rounded-3xl px-[18px] pb-4 pt-4 text-[var(--flow-band-fg)]" style="${tint(p.hue)}"><div class="flex items-center gap-3">${heroMark(p.icon)}<span class="min-w-0 flex-1 truncate text-[0.84375rem] opacity-80">${p.purpose}</span></div><p class="mt-4 text-xs font-semibold opacity-80">In this pocket</p><p class="flex items-baseline gap-1.5"><span class="font-mono-numbers text-[32px] font-semibold leading-[1.05] tracking-[-0.04em]">${f0(p.bal)}</span><span class="text-[0.8125rem] font-semibold">${p.cur || 'EGP'}${p.cur ? ` · ≈ ${f0(egp(p))} EGP` : ''}</span></p><div class="mt-3 flex flex-wrap gap-2">${pill(inBank ? `${brand(acct(p.home).prov, 16)}Set aside in ${acct(p.home).name}` : `${ICON('house', 'size-3.5')}Outside your accounts`)}</div></section></div>`
    const cta = `<div class="mx-4 mt-3 grid grid-cols-2 gap-2"><button type="button" data-sv8s="add" class="${BTN.primary} ${SZ.touch}">${ICON('plus', 'size-[18px]')}Add money</button><button type="button" data-sv8s="out" class="${BTN_SOFT} ${SZ.touch}">${ICON(inBank ? 'arrow-down-to-line' : 'arrow-up-right', 'size-[18px]')}${inBank ? 'Release' : 'Withdraw'}</button></div>${inBank ? `<p class="mx-5 mt-2 flex items-center text-xs ${MUTED}">Release: stays in ${acct(p.home).name}, back to Free to spend.${new9()}</p>` : ''}`
    const kept = p.sys ? `${sectionHead('Where it’s kept').replace('pt-1', 'pt-5')}<div class="mx-4 overflow-hidden ${CARDBOX}"><div class="flex min-h-[60px] items-center gap-3 px-4 py-2.5">${brand(acct(p.home).prov, 40)}<span class="min-w-0 flex-1"><span class="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${acct(p.home).name}</span><span class="mt-0.5 block text-xs ${MUTED}">Set aside · one part per account</span></span><span class="font-mono-numbers text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]">${f0(p.bal)}</span></div>${SEP}<button type="button" data-sv8s="split" class="flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-start hover:bg-[var(--color-brand-elevated)]">${tile('split', IC.teal)}<span class="min-w-0 flex-1"><span class="block text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">Where your monthly savings go</span><span class="mt-0.5 block truncate font-mono-numbers text-xs ${MUTED}">Rest of each month end lands here</span></span>${CHEV}</button></div>` : ''
    const moves = `${sectionHead('Recent moves', p.moves.length ? `<span class="font-mono-numbers text-xs ${MUTED}">${p.moves.length}</span>` : '').replace('pt-1', 'pt-5')}<div class="mx-4 overflow-hidden ${CARDBOX}">${p.moves.length ? moveRows(p.moves, p.cur || 'EGP') : empty}</div>`
    const details = `${sectionHead('Details').replace('pt-1', 'pt-5')}<div class="mx-4 divide-y divide-[var(--color-brand-border)] overflow-hidden ${CARDBOX}">${[['Kept in', inBank ? acctV(p.home) : 'Outside your accounts'], ['Currency', p.cur || 'EGP'], ['Created', p.created]].map(([k, v]) => `<div class="flex min-h-[52px] items-center gap-3 px-4"><span class="w-[104px] shrink-0 text-[0.84375rem] ${SECOND}">${k}</span><span class="flex min-w-0 flex-1 items-center justify-end gap-2 text-end text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]">${v}</span></div>`).join('')}</div><p class="mx-5 mt-2 text-xs leading-relaxed ${MUTED}">${inBank ? `The money stays in ${acct(p.home).name}; this pocket keeps it out of Free to spend.` : 'Counted by you, like cash at home. It is not part of any account balance.'}${p.sys ? ' Monthly savings can’t be deleted and hides when empty.' : ''}</p>`
    const dots = `<button type="button" data-sv8s="menu" aria-label="More actions" class="${CLOSE_BTN}">${ICON('ellipsis-vertical', 'size-4')}</button>`
    const sh = ltSheet(S, p.name, p.sys ? 'Pocket · can’t be deleted' : 'Pocket · no target', `${heroP}${cta}${kept}${moves}${details}`, '', 90, undefined, dots)
    sh.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-sv8s]'); if (!b) return
      const a = b.dataset.sv8s
      if (a === 'menu') return pocketMenu(S, p, sh)
      if (a === 'add') return addMoney(S, p)
      if (a === 'out') return inBank ? release(S, p) : withdraw(S, p)
      if (a === 'split') { sh.close(); return go(S, 'split') }
    })
    return sh
  }
  const holdMenu = (S, h) => {
    const body = `<div class="mx-4 overflow-hidden ${CARDBOX}"><button type="button" data-sv8m="edit" class="flex min-h-[60px] w-full items-center gap-3 px-4 text-start">${tile('pencil', ['var(--color-brand-elevated)', 'var(--color-brand-text-secondary)'])}<span class="text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">Edit ${h.kind.toLowerCase()}</span></button>${SEP}<button type="button" data-sv8m="del" class="flex min-h-[60px] w-full items-center gap-3 px-4 text-start">${tile('trash-2', ['var(--color-brand-red-soft)', 'var(--color-brand-red)'])}<span class="text-[0.9375rem] font-semibold text-[var(--color-brand-red)]">Delete</span></button></div>`
    const sh = ltSheet(S, h.name, '', body, '', 200)
    sh.el.addEventListener('click', (e) => { const b = e.target.closest('[data-sv8m]'); if (!b) return; if (b.dataset.sv8m === 'edit') return toast(S, `Opens Edit ${h.kind.toLowerCase()}`); ltAlert(S, `Delete ${h.name}?`, 'It leaves what you hold. Purchases stay in Flow.', [['solidDanger', 'Delete', () => { sh.close(); S.st.sv8v = null; render(S); toast(S, 'Deleted') }], ['ghost', 'Cancel']]) })
  }

  /* ---------- month-end Edit: amounts tappable, account per item from the bank-then-account picker ---------- */
  const meEdit = (S) => {
    const r = monthEnd(S.st)
    const pick = {}
    form4(S, {
      title: 'Edit October leftover', sub: `${f0(r.placed)} to set aside${r.short ? ` · ${f0(r.short)} fits nowhere` : ''}`, state: {},
      body: () => `${grp4(r.items.map((it, i) => `<div class="flex min-h-[64px] items-center gap-3 px-4 py-2">${it.mark(40)}<span class="min-w-0 flex-1"><span class="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${it.name}</span><button type="button" data-v="acct:${i}" class="-ms-1 inline-flex min-h-11 items-center gap-1 px-1 text-xs font-semibold text-[var(--color-brand-primary-ink)]">${brand(acct(pick[i] || it.parts[0][0]).prov, 16)}In ${acct(pick[i] || it.parts[0][0]).name}${it.parts.length > 1 && !pick[i] ? ` +${it.parts.length - 1}` : ''}${ICON('chevron-down', 'size-3.5')}</button></span><button type="button" data-toast="Opens the amount, capped at the account’s free money" class="inline-flex min-h-11 items-center rounded-xl bg-[var(--color-brand-elevated)] px-3 font-mono-numbers text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${f0(it.n)}</button></div>`), 'Where it goes', 'Each amount is capped at the free money in its account.')}<div class="mt-1 flex justify-center">${`<button type="button" data-v="split" class="inline-flex h-11 items-center gap-1 px-1 text-[0.84375rem] font-semibold text-[var(--color-brand-primary-ink)]">${ICON('split', 'size-4')}Change the split for every month</button>`}</div>`,
      foot: () => foot4('Save'), done: 'October leftover updated',
      on: { acct: (v, draw) => { const i = +v.dataset.v.split(':')[1]; sv8Pick(S, pick[i] || r.items[i].parts[0][0], (id) => { pick[i] = id; draw() }, { title: `Where ${r.items[i].name} is set aside`, sub: 'Pick the bank, then the account' }) }, split: (v, draw, st, sh) => { sh.close(); go(S, 'split') } },
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
    const b = e.target.closest('[data-sv8]'); if (!b || b.disabled) return
    const S = screenOf(b); if (!S || S.st.v7 || S.st.page !== 'wealth' || b.closest('[data-layer-root]')) return
    e.stopPropagation(); e.preventDefault()
    const parts = b.dataset.sv8.split(':')
    const [k, a] = parts
    const v = S.st.sv8v
    const hold = v && v.startsWith('h:') ? hd(v.slice(2)) : null
    if (k === 'p') return pocketSheet(S, pk(a))
    if (k === 'h') return go(S, `h:${a}`)
    if (k === 'back') { S.st.sv8v = null; S.scroll.scrollTop = 0; return render(S) }
    if (k === 'g') return toast(S, `Opens ${POCKET[a][1]} in Goals`)
    if (k === 'goals') return toast(S, 'Opens Goals')
    if (k === 'sacc') return toast(S, 'Opens Accounts, savings accounts')
    if (k === 'add') return addPocket(S)
    if (k === 'addinv') return addPocket(S, 'inv')
    if (k === 'ef') return efSheet(S)
    if (k === 'zakat') return zakatSheet(S)
    if (k === 'split') return go(S, 'split')
    if (k === 'spadd') return toast(S, 'Opens your goals and pockets to add one')
    if (k === 'sp') { const key = parts.slice(2).join(':'); const sp = split(S.st); sp[key] = Math.max(0, Math.min(sp[key] + (a === 'inc' ? 5 : -5), sp[key] + 100 - splitSum(S.st))); return render(S) }
    if (k === 'mev') { S.st.sv8me = a; S.st.sv8medone = false; S.st.sv8medis = false; return render(S) }
    if (k === 'me') {
      if (a === 'ok') { S.st.sv8medone = true; render(S); return toast(S, 'October leftover set aside') }
      if (a === 'undo') { S.st.sv8medone = false; render(S); return toast(S, 'Undone · nothing set aside for October') }
      if (a === 'edit') return meEdit(S)
      if (a === 'dismiss') { S.st.sv8medis = true; return render(S) }
    }
    if (k === 'menu' && hold) return holdMenu(S, hold)
    if (k === 'addmoney' && hold) return hold.id === 'gold' ? addGold(S) : toast(S, `Opens ${hold.cta[0]}`)
    if (k === 'withdraw' && hold) return toast(S, `Opens ${hold.cta[1]}`)
  }, true)

  /* ---------- sheet bar ---------- */
  const meVar = (S, k, done = false) => { go(S, null); S.st.sv8me = k; S.st.sv8medone = done; S.st.sv8medis = false; render(S) }
  Object.assign(F8, {
    sv8addpocket: (S) => { go(S, null); addPocket(S) },
    sv8pocket: (S) => { go(S, null); pocketSheet(S, pk('monthly')) },
    sv8pocketcar: (S) => { go(S, null); pocketSheet(S, pk('car')) },
    sv8empty: (S) => { go(S, null); pocketSheet(S, pk('cash')) },
    sv8menu: (S) => { go(S, null); pocketMenu(S, pk('car'), pocketSheet(S, pk('car'))) },
    sv8release: (S) => { go(S, null); release(S, pk('car')) },
    sv8gold: (S) => go(S, 'h:gold'),
    sv8addmoney: (S) => { go(S, null); addMoney(S, pk('car')); setTimeout(() => ltMethodPicker(S, 'cib', () => {}), 50) },
    sv8where: (S) => { go(S, null); whereSheet(S, null, () => {}) },
    sv8split: (S) => go(S, 'split'),
    sv8me: (S) => meVar(S, 'fit'),
    sv8mecap: (S) => meVar(S, 'cap'),
    sv8meover: (S) => meVar(S, 'over'),
    sv8medone: (S) => meVar(S, 'fit', true),
    sv8meedit: (S) => { meVar(S, 'cap'); meEdit(S) },
    sv8ef: (S) => { go(S, null); efSheet(S) },
    sv8zakat: (S) => { go(S, null); zakatSheet(S) },
  })
  Object.assign(T8, { sv8addmoney: (S) => AFTER.deposit(S), sv8ef: (S) => AFTER.s_ef(S), sv8zakat: (S) => AFTER.s_zakat(S), sv8gold: (S) => AFTER.s_gold(S) })
  SHEETS8.push(['sv8me', 'Month end · fits'], ['sv8mecap', 'Month end · capped'], ['sv8meover', 'Month end · spent more'], ['sv8medone', 'Month end · applied, Undo'], ['sv8meedit', 'Month end · Edit'], ['sv8split', 'Where your monthly savings go'], ['sv8pocket', 'Pocket · Monthly savings'], ['sv8pocketcar', 'Pocket · in a bank (Release)'], ['sv8empty', 'Pocket · outside (Withdraw)'], ['sv8menu', 'Pocket menu'], ['sv8release', 'Release'], ['sv8addmoney', 'Add money · Paid with list'], ['sv8where', 'Where is this money?'], ['sv8addpocket', 'Add pocket'], ['sv8gold', 'Gold page'], ['sv8ef', 'Emergency fund'], ['sv8zakat', 'Zakat'])
  NEW9.push('wealth', 'sv8me', 'sv8mecap', 'sv8meover', 'sv8medone', 'sv8meedit', 'sv8split', 'sv8pocket', 'sv8pocketcar', 'sv8empty', 'sv8menu', 'sv8release', 'sv8addmoney', 'sv8where', 'sv8addpocket')
  NOTES8.wealth = 'Savings: “Saved and invested” hero, a row to “Where your monthly savings go”, the October month-end card (Fits / Capped / Spent more at the top), then Pockets, Goals (savings goals with their homes), Savings accounts (one row, in Accounts), Investments, Emergency fund and Zakat. A pocket opens as a sheet: Add money plus Release (in a bank) or Withdraw (outside), Edit and Delete under the vertical 3-dot.'
}
