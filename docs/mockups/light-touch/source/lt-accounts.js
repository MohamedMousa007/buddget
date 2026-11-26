
/* ================= ACCOUNTS: the new design kept as is; Light touch on the hero and the sheets ================= */
Object.assign(THEMES, { sunset: ['#f7b066', '#e27585', 0], glacier: ['#a9d4ee', '#5e9fcb', 0], plum: ['#5a2a60', '#230d28', 1], copper: ['#a35f2d', '#6e3a1a', 1], graphite: ['#4a5057', '#1f2327', 1], pearl: ['#f7f4ee', '#dcd5c8', 0] })
Object.assign(PM, {
  cibpre: { bank: 'CIB', name: 'CIB Visa Prepaid', kind: 'Prepaid', last4: '2290', theme: 'sunset', style: 'bank', logo: 'cib', cur: 'EGP' },
  qnbdeb: { bank: 'QNB', name: 'QNB Debit', kind: 'Debit', last4: '3018', theme: 'glacier', style: 'bank', logo: 'qnb', cur: 'EGP' },
  qnbplat: { bank: 'QNB', name: 'QNB Platinum', kind: 'Credit', last4: '9012', theme: 'plum', style: 'metal', logo: 'qnb', cur: 'EGP' },
  deel: { bank: 'DEEL', name: 'Deel Card', kind: 'Debit', last4: '7745', theme: 'graphite', style: 'metal', mono: 'DE', color: '#15357A', cur: 'USD' },
  payo: { bank: 'PAYO', name: 'Payoneer Card', kind: 'Debit', last4: '5530', theme: 'copper', style: 'bank', mono: 'P', color: '#E2531B', cur: 'USD' },
  valu: { bank: 'VALU', name: 'valU', kind: 'BNPL', last4: '••', theme: 'emerald', style: 'bank', mono: 'vU', color: '#00A651', cur: 'EGP' },
  cca: { bank: 'CCA', name: 'City Centre Almaza', kind: 'Other', last4: '••', theme: 'pearl', style: 'bank', mono: 'CC', color: '#7A2E5C', cur: 'EGP' },
})
const PROV = [
  { key: 'cib', name: 'CIB', full: 'Commercial International Bank', accts: 3, cards: ['cib', 'cibcc', 'usd', 'cibpre'], total: '213,425', approx: true, aside: '15,000', color: '#1D5FA8' },
  { key: 'qnb', name: 'QNB', accts: 2, cards: ['qnb', 'qnbdeb', 'qnbplat'], total: '47,500', approx: true, color: '#7A0F3A' },
  { key: 'nbe', name: 'NBE', accts: 1, cards: ['nbe', 'nbecc'], total: '47,000', color: '#0B6B3A' },
  { key: 'bm', name: 'Banque Misr', accts: 1, cards: [], total: '22,500', alert: true, color: '#8B1D2C' },
  { key: 'deel', name: 'Deel', accts: 1, cards: ['deel'], total: '111,550', approx: true, color: '#15357A' },
  { key: 'payo', name: 'Payoneer', accts: 1, cards: ['payo'], total: '41,710', approx: true, color: '#E2531B' },
]
const CIB_ACCTS = [
  { id: 'a1', name: 'CIB Current', idf: '••1234', cur: 'EGP', bal: 120425, free: 105425, aside: 15000, cards: ['cib', 'cibcc'] },
  { id: 'a2', name: 'CIB USD', idf: '••6620', cur: 'USD', bal: 1650, eq: 81593, cards: ['usd'] },
  { id: 'a3', name: 'CIB Savings', idf: '••3390', cur: 'EGP', bal: 11407, cards: [] },
]
const AMARK = (k, size, alert) => `<span class="relative inline-flex shrink-0">${brand(k, size)}${alert ? '<span class="absolute -end-1 -top-1 flex size-[18px] items-center justify-center rounded-full border-2 border-[var(--color-brand-card)] bg-[var(--color-brand-amber)] text-[0.625rem] font-extrabold text-[var(--color-brand-card)]">!</span>' : ''}</span>`
const CASHMARK = (size = 44) => `<span aria-hidden="true" class="inline-flex shrink-0 items-center justify-center bg-[var(--color-brand-green-soft)] text-[var(--color-brand-green)]" style="width:${size}px;height:${size}px;border-radius:${size * 0.32}px">${ICON('banknote', size > 30 ? 'size-5' : 'size-3.5')}</span>`
let SMART = false
const amt2 = (n) => { if (SMART) return fa(n); const [i, d] = f2(n).split('.'); return `${i}<span class="opacity-60">.${d}</span>` }
const fa = (n) => (Math.abs(n - Math.round(n)) < 0.005 ? f0(n) : f2(n))
const LISTCARD = 'divide-y divide-[var(--color-brand-border)] overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)]'
function provHead(p) {
  const n = p.cards.length
  const mark = p.key === 'voda' ? brand('voda', 44) : AMARK(p.key, 44, p.alert)
  return `<span class="flex items-center gap-3">${mark}<span class="min-w-0 flex-1"><span class="block truncate text-base font-bold text-[var(--color-brand-text-primary)]">${p.name}</span><span class="mt-0.5 block text-[0.8125rem] ${MUTED}">${p.accts} account${p.accts > 1 ? 's' : ''} · ${n} card${n === 1 ? '' : 's'}</span></span><span class="shrink-0 text-end"><span class="block whitespace-nowrap font-mono-numbers text-base font-semibold tracking-[-0.02em] text-[var(--color-brand-text-primary)]">${p.approx ? '≈ ' : ''}${p.total} <span class="text-[0.71875rem] font-normal ${MUTED}">EGP</span></span>${p.aside ? `<span class="mt-0.5 block whitespace-nowrap font-mono-numbers text-[0.71875rem] font-semibold text-[var(--color-brand-primary-ink)]">${p.aside} set aside</span>` : ''}</span>${ICON('chevron-right', `size-4 shrink-0 ${MUTED}`)}</span>`
}
function provCard(p, st) {
  const n = p.cards.length
  const fits = n * 88 + (n - 1) * 8 + 8 + 50 <= 324
  if (!n || fits) return `<button type="button" data-prov="${p.key}" class="block w-full rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] text-start transition-[border-color,transform] duration-150 ease-out active:scale-[0.99]"><span class="block px-4 pb-3 pt-3.5">${provHead(p)}</span>${n ? `<span class="block px-4 pb-3.5"><span dir="ltr" class="flex items-center gap-2 overflow-hidden py-0.5">${p.cards.map((k) => mini(k)).join('')}<span class="ms-auto flex-none whitespace-nowrap text-xs font-semibold ${MUTED}">${n} card${n > 1 ? 's' : ''}</span></span></span>` : ''}</button>`
  const spread = st.spread === p.key
  const step = spread ? 96 : 52
  return `<div class="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)]"><button type="button" data-prov="${p.key}" class="block w-full rounded-2xl px-4 pb-3 pt-3.5 text-start">${provHead(p)}</button><div class="px-4 pb-3.5"><div class="hide-scrollbar overflow-x-auto overflow-y-hidden pb-1 pt-0.5"><div class="relative h-14" style="width:${88 + (n - 1) * step}px">${p.cards.map((k, i) => `<button type="button" data-cardk="${k}" class="absolute left-0 top-0 rounded-[7px] shadow-[var(--shadow-stack-edge)] transition-transform duration-300" style="transform:translateX(${i * step}px);z-index:${n - i}">${mini(k)}</button>`).join('')}</div></div><div class="mt-0.5 flex min-h-11 w-full items-center justify-between gap-2 px-0.5"><span class="text-xs font-semibold ${MUTED}">${n} cards</span><button type="button" data-spread="${p.key}" class="inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-[var(--color-brand-primary-ink)]">${spread ? 'Stack' : 'Show all'}${ICON(spread ? 'chevron-left' : 'chevron-down', 'size-4')}</button></div></div></div>`
}
function secHead(t, count, add, L) {
  const btnA = !add ? '' : L
    ? `<button type="button" data-toast="Opens ${add.toLowerCase()}" class="ms-auto inline-flex h-11 items-center gap-1 px-1 text-[0.875rem] font-semibold text-[var(--color-brand-primary-ink)]">${ICON('plus', 'size-4')}${add}</button>`
    : `<button type="button" data-toast="Opens ${add.toLowerCase()}" class="${BTN_CORE} ms-auto h-11 gap-2 rounded-xl border-transparent bg-[var(--color-brand-elevated)] px-4 text-[0.9375rem] text-[var(--color-brand-text-primary)]">${ICON('plus', 'size-[18px]')}${add}</button>`
  return `<div class="mb-2 flex min-h-11 items-center gap-2 px-1"><h2 class="text-[17px] font-bold text-[var(--color-brand-text-primary)]">${t}</h2>${L ? `<span class="font-mono-numbers text-[0.8125rem] font-semibold ${MUTED}">${count}</span>` : `<span class="inline-flex min-w-[21px] items-center justify-center rounded-4xl bg-[var(--color-brand-elevated)] px-1.5 py-[2.5px] font-mono-numbers text-[0.6875rem] font-semibold ${MUTED}">${count}</span>`}${btnA}</div>`
}
function cardRow(k, sub) {
  return `<button type="button" data-cardk="${k}" class="flex min-h-[76px] w-full items-center gap-3 py-2.5 pe-3.5 ps-3 text-start hover:bg-[var(--color-brand-elevated)]">${mini(k)}<span class="min-w-0 flex-1"><span class="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${PM[k].name}</span><span class="mt-0.5 block truncate text-[0.8125rem] ${MUTED}">${sub}</span></span>${ICON('chevron-right', `size-4 shrink-0 ${MUTED}`)}</button>`
}
function accountsHome(st, L) {
  const legend = (c, l) => `<span class="inline-flex items-center gap-1.5"><span class="size-2 rounded-[2px]" style="background:${c}"></span>${l}</span>`
  const scale = [`<span class="flex gap-3">${legend('var(--flow-band-fg)', 'CIB 44%')}${legend('var(--color-brand-gold)', 'DEEL 23%')}${legend('color-mix(in oklab, var(--flow-band-fg) 62%, transparent)', 'QNB 10%')}</span>`, '12 accounts']
  const hero = heroBand({ label: 'Available now', aside: ['eye', 'Hide'], big: '473,385', n: 473385, right: ['474,165', 'Net worth'], bar: { split: [[44, 1], [23, 1], [10, 0.62], [23, 0.4]], scale, lscale: scale }, cells: [['In accounts', '488,385'], ['Set aside', '15,000'], ['Credit owed', '14,220']], lnote: noteLine(`${B('15,000')} set aside`, `${B('14,220')} owed on cards`) }, L)
  const found = pendingHTML({ held: [1, 2] }, '').replace('2 bank messages', '2 accounts found in your SMS').replace('Not counted until you confirm', 'Confirm them to track their balance').replace('data-pending', 'data-toast="Opens the found accounts"')
  const cash = `<div class="${LISTCARD}"><button type="button" data-acct="cash" class="flex min-h-[72px] w-full items-center gap-3.5 px-4 py-3 text-start">${CASHMARK()}<span class="min-w-0 flex-1"><span class="block truncate text-base font-semibold tracking-[-0.01em] text-[var(--color-brand-text-primary)]">Cash</span><span class="mt-0.5 block truncate text-[0.8125rem] ${MUTED}">Estimate · counted by you</span></span><span class="shrink-0 text-end"><span class="block font-mono-numbers text-base font-medium tracking-[-0.02em] text-[var(--color-brand-text-primary)]">${amt2(3500)}</span>${CUR2 ? `<span class="block text-[0.71875rem] ${MUTED}">${secOf(3500)}</span>` : ''}</span></button></div>`
  const voda = `<button type="button" data-prov="voda" class="block w-full rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-4 pb-3.5 pt-3.5 text-start">${provHead({ key: 'voda', name: 'Vodafone Cash', accts: 1, cards: [], total: '1,200' })}</button>`
  return `${hero}<div class="space-y-5 px-4 py-4 ${L ? 'pt-5' : ''}">
    ${found}
    <section>${secHead('Banks', 6, 'Add account', L)}<div class="flex flex-col gap-2.5">${PROV.map((p) => provCard(p, st)).join('')}</div></section>
    <section>${secHead('Wallets and cash', 2, '', L)}<div class="flex flex-col gap-2.5">${voda}${cash}</div></section>
    <section>${secHead('Other cards', 2, 'Add card', L)}<div class="${LISTCARD}">${cardRow('valu', 'Pay later · 4/12 · See plan in Debts')}${cardRow('cca', 'Store card · EGP')}</div></section>
  </div>`
}
function acctRow(a) {
  const strip = a.cards.length
    ? `<div class="flex min-h-11 w-full items-center gap-2 px-4 pb-3 ps-[76px]">${a.cards.slice(0, 2).map((k) => `<button type="button" data-cardk="${k}">${mini(k)}</button>`).join('')}<span class="ms-auto text-xs font-semibold ${MUTED}">${a.cards.length} card${a.cards.length > 1 ? 's' : ''}</span></div>`
    : `<div class="flex min-h-11 w-full items-center gap-2 px-4 pb-3 ps-[76px]"><span class="flex h-14 w-[88px] items-center justify-center rounded-[7px] border-[1.5px] border-dashed border-[var(--color-brand-border-strong)] ${MUTED}">${ICON('plus', 'size-5')}</span><span class="text-[0.78125rem] font-semibold text-[var(--color-brand-primary-ink)]">Add a card</span></div>`
  return `<div><button type="button" data-acct="${a.id}" class="flex min-h-[72px] w-full items-center gap-3.5 px-4 py-3 text-start">${brand('cib', 44)}<span class="min-w-0 flex-1"><span class="flex items-center gap-1.5"><span class="truncate text-base font-semibold tracking-[-0.01em] text-[var(--color-brand-text-primary)]">${a.name}</span>${a.cur !== 'EGP' ? badge('muted', a.cur) : ''}</span><span class="mt-0.5 block truncate text-[0.8125rem] ${MUTED}">${a.idf} · ${a.cur}</span></span><span class="shrink-0 text-end"><span class="block font-mono-numbers text-base font-medium tracking-[-0.02em] text-[var(--color-brand-text-primary)]">${amt2(a.bal)}</span>${a.free ? `<span class="block text-[0.71875rem] font-semibold text-[var(--color-brand-primary-ink)]">${f0(a.free)} free</span>` : a.eq ? `<span class="block text-[0.71875rem] ${MUTED}">≈ ${f0(a.eq)} EGP</span>` : ''}</span></button>${strip}</div>`
}
function providerView(st, L) {
  const p = PROV[0]
  const tint = `--provider-brand:${p.color};background:linear-gradient(160deg, color-mix(in oklab, var(--provider-brand) var(--provider-hero-amt), var(--provider-hero-base)), color-mix(in oklab, var(--provider-brand) calc(var(--provider-hero-amt) - 14%), var(--provider-hero-base)))`
  const pill = (t) => `<span class="inline-flex min-h-7 items-center rounded-full bg-[color-mix(in_oklab,var(--flow-band-fg)_14%,transparent)] px-3 text-[0.78125rem] font-semibold">${t}</span>`
  const hero = L
    ? `<div class="mx-4 mt-2"><button type="button" data-provback class="-ms-2 mb-1 inline-flex h-11 items-center gap-1 px-2 text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${ICON('chevron-left', 'size-5')}Accounts</button><section class="overflow-hidden rounded-3xl px-[18px] pb-4 pt-4 text-[var(--flow-band-fg)]" style="${tint}"><div class="flex items-center gap-3">${brand('cib', 40)}<span class="min-w-0 flex-1"><span class="block truncate text-[1.0625rem] font-bold">CIB</span><span class="block text-[0.78125rem] opacity-80">${p.full}</span></span></div><p class="mt-4 text-xs font-semibold opacity-80">Total here</p><p class="flex items-baseline gap-1.5"><span class="text-lg">≈</span><span class="font-mono-numbers text-[32px] font-semibold leading-[1.05] tracking-[-0.04em]">213,425</span><span class="text-[0.8125rem] font-semibold">EGP${CUR2 ? ` · ${secOf(213425)}` : ''}</span></p><p class="mt-2 text-xs opacity-80">3 accounts · 4 cards · <b class="font-mono-numbers">15,000</b> set aside</p></section></div>`
    : `<section class="text-[var(--flow-band-fg)]" style="${tint}"><div class="px-4 pb-[22px] pt-1"><div class="-ms-2 flex min-h-14 items-center"><button type="button" data-provback aria-label="Back" class="flex size-11 items-center justify-center rounded-full">${ICON('chevron-left', 'size-5')}</button></div><div class="flex items-center gap-3">${brand('cib', 48)}<span class="min-w-0 flex-1"><h2 class="truncate text-[1.1875rem] font-bold tracking-[-0.01em]">CIB</h2><span class="block text-[0.78125rem] opacity-80">${p.full}</span></span><span class="flex size-9 items-center justify-center rounded-full bg-[var(--flow-band-mix)]">${ICON('eye', 'size-4')}</span></div><p class="mb-0.5 mt-5 text-[0.6875rem] font-bold uppercase tracking-[0.08em] opacity-80">Total here</p><p class="flex items-baseline gap-1.5"><span class="text-lg">≈</span><span class="font-mono-numbers text-[34px] font-semibold leading-[1.05] tracking-[-0.04em]">213,425</span><span class="text-[0.8125rem] font-semibold">EGP</span></p><div class="mt-3.5 flex flex-wrap gap-2">${pill('3 accounts · 4 cards')}${pill('<span class="font-mono-numbers">15,000</span>&nbsp;set aside')}</div></div></section>`
  return `${hero}<div class="space-y-5 px-4 py-4">
    <section>${secHead('Accounts', 3, 'Add account', L)}<div class="${LISTCARD}">${CIB_ACCTS.map(acctRow).join('')}</div></section>
    <section>${secHead('Credit cards', 1, '', L)}<div class="${LISTCARD}">${cardRow('cibcc', `Owed <b class="font-mono-numbers font-semibold text-[var(--color-brand-amber)]">8,420 EGP</b> · Limit 30,000 EGP · Due day 15`)}</div><p class="mt-2 px-1 text-xs leading-[1.45] ${MUTED}">What you owe on a card is not taken from any account or from this total.</p></section>
    <section>${secHead('Cards', 1, '', L)}<div class="${LISTCARD}">${cardRow('cibpre', 'Prepaid · EGP')}</div></section>
    <div class="flex min-h-12 items-center gap-2.5 rounded-[14px] border border-dashed border-[var(--color-brand-border-strong)] px-4 text-[0.8125rem] font-semibold ${SECOND}">${ICON('layers', 'size-4')}2 closed accounts · history kept</div>
  </div>`
}
PAGES.accounts = (st, L) => { SMART = L; const h = st.prov ? providerView(st, L) : accountsHome(st, L); SMART = false; return h }
PAGE_TITLE.accounts = 'Accounts'
NAV_PAGE.Accounts = 'accounts'
LT_NOTES.accounts = 'Your new Accounts page as is: providers with their cards, the stacks, Cash and Other cards. Light touch only rounds the hero (its cells become one line), turns the section Add buttons into quiet text buttons, and makes the provider hero a rounded tinted card. Tap a provider, an account or a card for the sheets.'
function ltAcctClick(S, e) {
  if (S.st.page !== 'accounts') return
  const t = e.target
  if (t.closest('[data-layer-root]')) return
  const L = S.st.design === 'M'
  const sp = t.closest('[data-spread]'); if (sp) { e.stopPropagation(); S.st.spread = S.st.spread === sp.dataset.spread ? null : sp.dataset.spread; return render(S) }
  const ck = t.closest('[data-cardk]'); if (ck) { e.stopPropagation(); return (L ? ltCardSheet : bCardSheet)(S, ck.dataset.cardk) }
  const ac = t.closest('[data-acct]'); if (ac) { e.stopPropagation(); return (L ? ltAcctSheet : bAcctSheet)(S, ac.dataset.acct) }
  const pv = t.closest('[data-prov]'); if (pv) { e.stopPropagation(); if (pv.dataset.prov !== 'cib') return toast(S, 'The sample opens CIB'); S.st.prov = 'cib'; S.scroll.scrollTop = 0; return render(S) }
  if (t.closest('[data-provback]')) { e.stopPropagation(); S.st.prov = null; return render(S) }
}

/* ---- account sheet ---- */
const RECENT_TX = [['Talabat', 'Food', 'Today · 20:42', -245], ['Uber', 'Transport', 'Today · 08:15', -96], ['Salary', null, 'Oct 25', 31500]]
const miniTx = (rows) => rows.map(([t, c, s, n], i) => `${i ? '<div class="ms-[68px] h-px bg-[var(--color-brand-border)]"></div>' : ''}<div class="flex min-h-[60px] items-center gap-3 px-4 py-2.5"><span aria-hidden="true" class="flex size-10 shrink-0 items-center justify-center rounded-[11px]" style="background:${c ? `var(--cat-${CAT[c].v}-bg)` : 'var(--color-brand-green-soft)'};color:${c ? `var(--cat-${CAT[c].v}-fg)` : 'var(--color-brand-green)'}">${ICON(c ? CAT[c].icon : 'briefcase', 'size-5')}</span><span class="min-w-0 flex-1"><span class="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${t}</span><span class="mt-1 block text-xs ${MUTED}">${s}</span></span><span class="font-mono-numbers text-[0.9375rem] font-medium" style="color:${n > 0 ? 'var(--color-brand-green)' : 'var(--color-brand-text-primary)'}">${n > 0 ? '+' : MINUS}${f0(n)} <span class="text-[0.6875rem] ${MUTED}">EGP</span></span></div>`).join('')
function acctData(id) {
  if (id === 'cash') return { name: 'Cash', sub: 'Estimate · EGP', cur: 'EGP', bal: 3500, cards: [], cash: true }
  const a = CIB_ACCTS.find((x) => x.id === id)
  return { ...a, sub: `Current · ${a.idf} · ${a.cur}` }
}
function bAcctSheet(S, id) {
  const a = acctData(id)
  const [i, d] = f2(a.bal).split('.')
  const body = `<div class="-mx-5 space-y-5 pb-5"><div class="px-5"><p class="flex items-center gap-2 text-[0.8125rem] font-semibold ${SECOND}">Balance${a.cash ? badge('muted', 'Estimate') : ''}</p><div class="-mx-1 mt-0.5 flex min-h-12 items-baseline gap-1.5 rounded-xl px-1"><span class="font-mono-numbers text-[36px] font-semibold leading-[1.05] tracking-[-0.04em] text-[var(--color-brand-text-primary)]">${i}<span class="opacity-45">.${d}</span></span><span class="font-mono-numbers text-base font-semibold ${MUTED}">${a.cur}</span></div><p class="mt-1 text-[0.8125rem] ${SECOND}">${a.cash ? 'An estimate from what you log. Update it when you count your cash.' : 'Tap the amount to change it'}</p>${a.aside ? `<div class="mt-3.5 h-1.5 rounded-full bg-[var(--color-brand-sunken)]"><div class="h-full rounded-full bg-[var(--color-brand-primary)]" style="width:88%"></div></div><div class="mt-2 flex justify-between text-[0.8125rem] ${SECOND}"><span><b class="font-mono-numbers text-[var(--color-brand-text-primary)]">${f0(a.free)}</b> free to spend</span><span><b class="font-mono-numbers text-[var(--color-brand-text-primary)]">${f0(a.aside)}</b> set aside</span></div>` : ''}</div>
  ${a.cash ? '' : `<div class="mx-5 flex items-center gap-3 rounded-2xl bg-[var(--color-brand-elevated)] px-3.5 py-3"><span class="size-2 rounded-full bg-[var(--color-brand-green)]"></span><span class="min-w-0 flex-1"><span class="block text-sm font-semibold">Matches your bank's last SMS</span><span class="block text-xs ${MUTED}">from 18:42</span></span></div>`}
  ${a.cash ? '' : `<div><h3 class="mb-2 flex items-center gap-1.5 px-5 text-[0.8125rem] font-bold ${SECOND}">Cards ${badge('muted', String(a.cards.length))}</h3><div class="flex gap-2 overflow-x-auto px-5 py-1">${a.cards.map((k) => mini(k)).join('')}<span class="flex h-14 w-[88px] shrink-0 items-center justify-center rounded-[7px] border-[1.5px] border-dashed border-[var(--color-brand-border-strong)] ${MUTED}">${ICON('plus', 'size-5')}</span></div></div>`}
  <div class="grid grid-cols-3 gap-2 px-5">${[['banknote', 'Cash out'], ['landmark', 'Set aside'], ['wallet', 'Add card']].filter((x, j) => !a.cash || j === 1).map(([ic, l]) => `<button type="button" class="${BTN_CORE} h-16 flex-col gap-1 rounded-xl border-transparent bg-[var(--color-brand-elevated)] text-xs text-[var(--color-brand-text-primary)]">${ICON(ic, 'size-5')}${l}</button>`).join('')}</div>
  <div class="mx-5 grid grid-cols-2 divide-x divide-[var(--color-brand-border)] rounded-2xl border border-[var(--color-brand-border)]"><div class="px-3.5 py-3"><p class="text-xs font-semibold ${SECOND}">In this month</p><p class="font-mono-numbers text-base font-semibold text-[var(--color-brand-green)]">+31,500</p></div><div class="px-3.5 py-3"><p class="text-xs font-semibold ${SECOND}">Out this month</p><p class="font-mono-numbers text-base font-semibold">${MINUS}8,230</p></div></div>
  <div><h3 class="mb-1 px-5 text-[0.8125rem] font-bold ${SECOND}">Recent</h3><div class="border-y border-[var(--color-brand-border)]">${miniTx(RECENT_TX)}</div></div></div>`
  const el = shell(a.name, a.sub, body)
  const h = el.querySelector('h2').parentElement.parentElement
  h.insertAdjacentHTML('afterbegin', a.cash ? CASHMARK(40) : brand('cib', 40))
  el.querySelector('[aria-label="Close"]').insertAdjacentHTML('beforebegin', '<button type="button" aria-label="More" class="flex size-8 items-center justify-center rounded-full bg-[var(--color-brand-primary-soft)] font-bold text-[var(--color-brand-primary-ink)]">⋮</button>')
  openSheet(S, el)
}
function ltAcctSheet(S, id) {
  const a = acctData(id)
  let v = f2(a.bal)
  const el = document.createElement('div')
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', a.name)
  el.className = PANEL
  const sh = openSheet(S, el)
  const num = () => parseFloat(String(v).replace(/,/g, '')) || 0
  const draw = () => {
    const diff = Math.round((num() - a.bal) * 100) / 100
    el.innerHTML = `${GRAB}<div class="flex shrink-0 items-center gap-3 px-4 pb-1">${a.cash ? CASHMARK(36) : brand('cib', 36)}<span class="min-w-0 flex-1"><span class="block truncate text-base font-bold text-[var(--color-brand-text-primary)]">${a.name}</span><span class="block truncate text-xs ${SECOND}">${a.sub}</span></span><button type="button" data-a="menu" aria-label="More actions" class="${CLOSE_BTN}">${ICON('ellipsis-vertical', 'size-4')}</button><button type="button" data-a="close" aria-label="Close sheet" class="${CLOSE_BTN}">${ICON('x', 'size-4')}</button></div>
    <div class="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pb-5">
      <div class="flex flex-col items-center px-5 pb-4 pt-4 text-center"><p class="text-[0.8125rem] font-medium ${SECOND}">${a.cash ? 'Cash, an estimate' : 'Balance'}</p><div class="mt-1.5 flex ${CURSTYLE === 'inline' ? 'items-baseline gap-1.5' : 'items-center gap-2'} justify-center"><label class="flex items-baseline font-mono-numbers text-[2.5rem] font-semibold leading-none tracking-[-0.04em] tabular-nums text-[var(--color-brand-text-primary)]"><input data-bal inputmode="decimal" aria-label="Balance" value="${esc(v)}" class="bg-transparent text-center outline-none" style="width:2ch"></label>${CURSTYLE === 'under' ? '' : curCtl('', a.cur, true)}</div>${CURSTYLE === 'under' ? curCtl('', a.cur, true) : ''}<p class="mt-2 text-[0.8125rem] ${diff ? 'font-semibold text-[var(--color-brand-amber)]' : SECOND}">${diff ? `${diff > 0 ? '+' : MINUS}${f2(diff)} vs buddget · saved as a correction, never as spending` : a.cash ? 'Tap the amount when you count your cash' : 'Tap the amount to correct it'}</p>${a.aside ? `<div class="mt-4 w-full"><div class="h-1.5 rounded-full bg-[var(--color-brand-sunken)]"><div class="h-full rounded-full bg-[var(--color-brand-primary)]" style="width:88%"></div></div><div class="mt-2 flex justify-between text-xs ${SECOND}"><span><b class="font-mono-numbers font-semibold text-[var(--color-brand-text-primary)]">${f0(a.free)}</b> free</span><span><b class="font-mono-numbers font-semibold text-[var(--color-brand-text-primary)]">${f0(a.aside)}</b> set aside</span></div></div>` : ''}</div>
      <div class="mx-4 grid ${a.cash ? 'grid-cols-1' : 'grid-cols-3'} gap-2">${[['banknote', 'Cash out', 'cashout'], ['landmark', 'Set aside', 'aside'], ['wallet', 'Add card', 'addcard']].filter((x, j) => !a.cash || j === 1).map(([ic, l, k]) => `<button type="button" data-a="${k}" class="${BTN_CORE} h-11 gap-1.5 rounded-full border-[var(--color-brand-border)] bg-[var(--color-brand-card)] text-[0.84375rem] font-semibold text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-elevated)]">${ICON(ic, 'size-4')}${l}</button>`).join('')}</div>
      <div class="mx-4 mt-3 divide-y divide-[var(--color-brand-border)] overflow-hidden ${CARDBOX}">
        ${a.cash ? '' : `<div class="flex min-h-[52px] items-center gap-3 px-4"><span class="size-2 rounded-full bg-[var(--color-brand-green)]"></span><span class="flex-1 text-[0.9375rem] text-[var(--color-brand-text-primary)]">Matches your bank's SMS</span><span class="text-xs ${MUTED}">18:42</span></div>`}
        <div class="flex min-h-[52px] items-center gap-3 px-4"><span class="w-[104px] shrink-0 text-[0.84375rem] ${SECOND}">This month</span><span class="flex-1 text-end font-mono-numbers text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]"><span class="text-[var(--color-brand-green)]">+31,500</span> <span class="${MUTED}">·</span> ${MINUS}8,230</span></div>
      </div>
      ${a.cash ? '' : `${sectionHead(`Cards · ${a.cards.length}`).replace('pt-1', 'pt-5')}<div class="hide-scrollbar flex gap-2 overflow-x-auto px-5 py-1">${a.cards.map((k) => `<button type="button" data-ck="${k}">${mini(k)}</button>`).join('')}<button type="button" data-a="addcard" aria-label="Add a card" class="flex h-14 w-[88px] shrink-0 items-center justify-center rounded-[7px] border-[1.5px] border-dashed border-[var(--color-brand-border-strong)] ${MUTED}">${ICON('plus', 'size-5')}</button></div>`}
      ${sectionHead('Recent').replace('pt-1', 'pt-5')}<div class="mx-4 overflow-hidden ${CARDBOX}">${miniTx(RECENT_TX)}</div>
    </div>${diff ? `<div class="shrink-0 border-t border-[var(--color-brand-border)] px-4 pb-[22px] pt-3"><div class="flex gap-2">${btn('outline', 'cta', 'Cancel', 'data-a="cancel"')}<button type="button" data-a="setbal" class="${BTN.primary} ${SZ.block}">Set balance to ${f0(num())}</button></div></div>` : ''}`
    const i = el.querySelector('[data-bal]'); i.style.width = '0px'; i.style.width = `${Math.max(i.scrollWidth + 2, 28)}px`
  }
  draw()
  el.addEventListener('input', (e) => { if (!e.target.matches('[data-bal]')) return; v = e.target.value; const pos = e.target.selectionStart; draw(); const i = el.querySelector('[data-bal]'); i.focus(); i.setSelectionRange(pos, pos) })
  el.addEventListener('click', (e) => {
    const ck = e.target.closest('[data-ck]'); if (ck) return ltCardSheet(S, ck.dataset.ck)
    const b = e.target.closest('[data-a]'); if (!b) return
    const k = b.dataset.a
    if (k === 'close') return sh.attempt()
    if (k === 'menu') return toast(S, 'Edit, set as default and close account live here')
    if (k === 'cashout') return AFTER.cashout(S)
    if (k === 'aside') return toast(S, 'Opens Set aside')
    if (k === 'addcard') return toast(S, 'Opens the card form')
    if (k === 'cancel') { v = f2(a.bal); return draw() }
    if (k === 'setbal') { sh.close(); toast(S, `Balance set to ${f0(num())}`) }
  })
}

/* ---- card sheet ---- */
const bigFace = (k, w = 300) => `<div class="mx-auto" style="width:${w}px;height:${(w * 56) / 88}px"><div style="transform:scale(${w / 88});transform-origin:0 0;width:88px">${mini(k)}</div></div>`
function bCardSheet(S, k) {
  const p = PM[k]
  const credit = p.kind === 'Credit'
  const cell = (l, v, amber) => `<div class="rounded-2xl border ${amber ? 'border-[color-mix(in_oklab,var(--color-brand-amber)_45%,transparent)]' : 'border-[var(--color-brand-border)]'} bg-[var(--color-brand-elevated)] px-3.5 py-3"><p class="text-xs font-semibold ${SECOND}">${l}</p><p class="mt-0.5 truncate font-mono-numbers text-[1.0625rem] font-semibold tabular-nums ${amber ? 'text-[var(--color-brand-amber)]' : ''}">${v}</p></div>`
  const body = `<div class="space-y-4">${bigFace(k)}${credit ? `<div class="grid grid-cols-2 gap-2">${cell('Owed', '8,420', true)}${cell('Available', '21,580')}${cell('Limit', '30,000')}${cell('Due day', '15')}</div><div class="h-1.5 rounded-full bg-[var(--color-brand-sunken)]"><div class="h-full w-[28%] rounded-full bg-[var(--color-brand-amber)]"></div></div><div class="flex justify-between text-xs ${SECOND}"><span>28% of limit used</span><span>EGP</span></div><p class="text-xs ${MUTED}">Not taken from your accounts</p>` : `<div class="rounded-2xl bg-[var(--color-brand-elevated)] px-3.5 py-3 text-sm">Uses the CIB ••1234 balance <span class="font-semibold text-[var(--color-brand-primary-ink)]">Open account ›</span></div>`}${btn('outline', 'block', '★ Set as default')}<div><h3 class="mb-1 text-[0.8125rem] font-bold ${SECOND}">Spent with ${p.name}</h3><div class="-mx-5 border-y border-[var(--color-brand-border)]">${miniTx(RECENT_TX.slice(0, 2))}</div></div></div>`
  const el = shell(p.name, `${p.kind} · ••${p.last4} · ${p.cur}`, body)
  el.querySelector('[aria-label="Close"]').insertAdjacentHTML('beforebegin', '<button type="button" aria-label="More" class="flex size-8 items-center justify-center rounded-full bg-[var(--color-brand-primary-soft)] font-bold text-[var(--color-brand-primary-ink)]">⋮</button>')
  openSheet(S, el, { z: 130 })
}
function ltCardSheet(S, k) {
  const p = PM[k]
  const credit = p.kind === 'Credit'
  let def = k === 'cib'
  const body = () => `<div class="px-4 pt-1">${bigFace(k, 280)}</div>
    ${credit ? `<div class="mx-4 mt-5 ${CARDBOX} p-4"><div class="flex items-baseline justify-between"><span class="text-[0.8125rem] font-medium ${SECOND}">Owed</span><span class="font-mono-numbers text-[1.5rem] font-semibold tracking-[-0.03em] text-[var(--color-brand-amber)]">8,420 <span class="text-xs font-medium ${MUTED}">EGP</span></span></div><div class="mt-2.5 h-1.5 rounded-full bg-[var(--color-brand-sunken)]"><div class="h-full w-[28%] rounded-full bg-[var(--color-brand-amber)]"></div></div><p class="mt-2 text-xs ${SECOND}"><b class="font-mono-numbers font-semibold text-[var(--color-brand-text-primary)]">21,580</b> available of 30,000 · due on the 15th</p></div>` : ''}
    <div class="mx-4 mt-3 divide-y divide-[var(--color-brand-border)] overflow-hidden ${CARDBOX}">
      ${credit ? '' : `<button type="button" data-c="acct" class="flex min-h-[52px] w-full items-center gap-3 px-4 text-start"><span class="w-[104px] shrink-0 text-[0.84375rem] ${SECOND}">Uses</span><span class="flex flex-1 items-center justify-end gap-2 text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]">${brand('cib', 24)}CIB Current <span class="font-mono-numbers ${MUTED}">••1234</span>${ICON('chevron-right', `size-4 ${MUTED}`)}</span></button>`}
      <button type="button" data-c="def" role="switch" aria-checked="${def}" class="flex min-h-[52px] w-full items-center gap-3 px-4 text-start"><span class="min-w-0 flex-1 text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]">Default for new expenses</span><span aria-hidden="true" class="relative h-[26px] w-[44px] shrink-0 rounded-full ${def ? 'bg-[var(--color-brand-primary)]' : 'bg-[var(--color-brand-border-strong)]'}"><span class="absolute top-[3px] size-5 rounded-full bg-white" style="inset-inline-start:${def ? 21 : 3}px"></span></span></button>
      ${credit ? `<div class="flex min-h-[52px] items-center gap-2 px-4 text-xs ${MUTED}">${ICON('shield-check', 'size-4')}What you owe here is not taken from your accounts.</div>` : ''}
    </div>
    ${sectionHead(`Spent with ${p.name}`).replace('pt-1', 'pt-5')}<div class="mx-4 overflow-hidden ${CARDBOX}">${miniTx(RECENT_TX.slice(0, 2))}</div>`
  const sh = ltSheet(S, p.name, `${p.kind} · ••${p.last4} · ${p.cur}`, body(), '', 130, undefined, `<button type="button" data-c="menu" aria-label="More actions" class="${CLOSE_BTN}">${ICON('ellipsis-vertical', 'size-4')}</button>`)
  sh.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-c]'); if (!b) return
    if (b.dataset.c === 'def') { def = !def; sh.body.innerHTML = body(); return toast(S, def ? 'Default for new expenses' : 'No longer the default') }
    if (b.dataset.c === 'menu') return toast(S, 'Edit card and delete card live here')
    if (b.dataset.c === 'acct') { sh.close(); ltAcctSheet(S, 'a1') }
  })
}

/* ---- add account, cash out, cash on hand ---- */
function bAddAccount(S) {
  const seg = (a, on) => `<div class="inline-flex w-full gap-0.5 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-[3px]">${a.map((l, i) => `<span class="${i === on ? SEG_ON : SEG_OFF}">${l}</span>`).join('')}</div>`
  bOpen(S, 'Add an account', '', `${seg(['Bank', 'Wallet', 'Cash'], 0)}${bLabel('Provider')}${bField('Bank or wallet', 'landmark')}${bLabel('Identifier')}${seg(['None', 'Last 4', 'Label'], 1)}<div class="mt-2">${bInput('', '1234')}</div>${bLabel('Currency · optional')}${bField('EGP · Egyptian pound', 'coins')}${bLabel('Balance today')}${bAmount('0.00', '')}`, `<div class="flex flex-col gap-2"><button type="button" data-done class="${BTN.primary} ${SZ.block}">Add account</button>${btn('outline', 'block', 'Add account and a card')}<button type="button" class="h-11 text-[0.8125rem] font-semibold text-[var(--color-brand-primary-ink)]">Only a card, like a store card? Add a card</button></div>`)
}
function ltAddAccount(S) {
  let kind = 'Bank'
  const segBtn = (l) => `<button type="button" data-k="${l}" class="${kind === l ? SEG_ON : SEG_OFF}">${l}</button>`
  const row = (k, inner) => `<label class="flex min-h-[52px] items-center gap-3 px-4"><span class="w-[104px] shrink-0 text-[0.84375rem] ${SECOND}">${k}</span>${inner}</label>`
  const body = () => `<div class="mx-4"><div class="inline-flex w-full gap-0.5 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-[3px]">${['Bank', 'Wallet', 'Cash'].map(segBtn).join('')}</div></div>
    <div class="flex flex-col items-center px-5 pb-5 pt-5 text-center"><p class="text-[0.8125rem] font-medium ${SECOND}">Balance today</p><div class="mt-1.5 flex ${CURSTYLE === 'inline' ? 'items-baseline gap-1.5' : 'items-center gap-2'} justify-center"><input inputmode="decimal" aria-label="Balance today" placeholder="0" class="w-28 bg-transparent text-center font-mono-numbers text-[2.5rem] font-semibold leading-none tracking-[-0.04em] text-[var(--color-brand-text-primary)] outline-none placeholder:text-[var(--color-brand-text-muted)]">${CURSTYLE === 'under' ? '' : curCtl('data-toast="Opens the currency picker"', 'EGP', false)}</div>${CURSTYLE === 'under' ? curCtl('data-toast="Opens the currency picker"', 'EGP', false) : ''}<p class="mt-2 text-[0.8125rem] ${SECOND}">${kind === 'Cash' ? 'Roughly is fine' : 'From your banking app or your last SMS'}</p></div>
    ${kind === 'Cash' ? '' : `<div class="mx-4 divide-y divide-[var(--color-brand-border)] overflow-hidden ${CARDBOX}"><button type="button" data-toast="Opens the provider list" class="flex min-h-[52px] w-full items-center gap-3 px-4 text-start"><span class="w-[104px] shrink-0 text-[0.84375rem] ${SECOND}">${kind}</span><span class="flex flex-1 items-center justify-end gap-2 text-[0.9375rem] ${MUTED}">Choose${ICON('chevron-right', 'size-4')}</span></button>${row('Last 4 digits', '<input inputmode="numeric" placeholder="Optional" class="min-w-0 flex-1 bg-transparent text-end font-mono-numbers text-[0.9375rem] text-[var(--color-brand-text-primary)] outline-none placeholder:text-[var(--color-brand-text-muted)]">')}${row('Name', '<input placeholder="Like “Salary account”" class="min-w-0 flex-1 bg-transparent text-end text-[0.9375rem] text-[var(--color-brand-text-primary)] outline-none placeholder:text-[var(--color-brand-text-muted)]">')}</div>`}`
  const foot = `<div class="flex flex-col gap-1">${btn('primary', 'block', 'Add account', 'data-k="go"')}<button type="button" data-k="card" class="h-11 text-[0.875rem] font-semibold text-[var(--color-brand-primary-ink)]">Add it with a card</button></div>`
  const sh = ltSheet(S, 'Add an account', '', body(), foot)
  sh.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-k]'); if (!b) return
    if (b.dataset.k === 'go') { sh.close(); return toast(S, 'Account added') }
    if (b.dataset.k === 'card') return toast(S, 'Next step: the card form')
    kind = b.dataset.k; sh.body.innerHTML = body()
  })
}
Object.assign(BEFORE, {
  account: (S) => bAcctSheet(S, 'a1'),
  card: (S) => bCardSheet(S, 'cibcc'),
  addaccount: (S) => bAddAccount(S),
  cashout: (S) => bOpen(S, 'Cash out', '', `<div class="inline-flex w-full gap-0.5 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-[3px]"><span class="${SEG_ON}">Cash out</span><span class="${SEG_OFF}">Set aside</span></div>${bLabel('From')}${bField('CIB Current ••1234 · 105,425 free', 'wallet')}<p class="mt-4 text-sm font-semibold">To Cash on hand</p>${bLabel('Amount')}<div class="rounded-3xl p-4 text-center" style="background:linear-gradient(135deg,color-mix(in oklab,var(--color-brand-primary) 16%,var(--color-brand-card)),var(--color-brand-card))"><p class="font-mono-numbers text-[30px] font-semibold">2,000</p></div><p class="mt-2 text-sm ${SECOND}">CIB becomes 118,425</p>`, `<button type="button" data-done class="${BTN.primary} ${SZ.block}">Withdraw 2,000</button>`),
  cashhand: (S) => bOpen(S, 'How much cash do you have right now?', 'Roughly is fine. From here, Cash keeps an estimate from what you log.', bAmount('3,500', ''), `<div class="flex flex-col gap-2"><button type="button" data-done class="${BTN.primary} ${SZ.block}">Save</button>${btn('outline', 'block', 'Not now')}</div>`),
})
Object.assign(AFTER, {
  account: (S) => ltAcctSheet(S, 'a1'),
  card: (S) => ltCardSheet(S, 'cibcc'),
  addaccount: (S) => ltAddAccount(S),
  cashout: (S) => ltTx(S, { title: 'Cash out', icon: ['banknote', ...IC.green], sign: '', amt: '2,000', cur: 'EGP', lockCur: true, day: 28, time: '12:00', line: (v) => `CIB Current becomes ${f0(Math.max(0, 120425 - v))}`, rows: [{ k: 'From', pm: 'cib' }, { k: 'To', v: `${CASHMARK(24)}Cash on hand`, tap: 'Cash out goes to Cash; Set aside picks a pocket' }], note: false, cta: 'Withdraw 2,000', done: 'Moved to Cash' }),
  cashhand: (S) => ltTx(S, { title: 'Cash on hand', icon: ['banknote', ...IC.green], sign: '', amt: '3,500', cur: 'EGP', lockCur: true, dateLabel: 'Counted today', line: 'Roughly is fine. Cash keeps an estimate from what you log.', rows: [], note: false, cta: 'Save', done: 'Cash saved' }),
})
