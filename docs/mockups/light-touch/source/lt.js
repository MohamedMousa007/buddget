/* ================= LIGHT TOUCH v2: currency, new transaction sheet, unified payment picker, other pages ================= */
let PAGE = 'flow'
let CUR2 = null
let CURSTYLE = 'inline'
const CURNAME = { EGP: 'Egyptian pound', USD: 'US dollar', EUR: 'Euro', GBP: 'British pound', SAR: 'Saudi riyal', AED: 'UAE dirham', KWD: 'Kuwaiti dinar', QAR: 'Qatari riyal' }
/* three ways to show the tappable currency next to a big amount */
function curCtl(attr, cur, locked) {
  const a = locked ? '' : attr
  const tag = locked ? 'span' : 'button type="button"'
  const end = locked ? 'span' : 'button'
  if (CURSTYLE === 'inline') return `<${tag} ${a} aria-label="Currency, ${cur}" class="inline-flex items-center gap-0.5 font-mono-numbers text-[1.625rem] font-semibold leading-none tracking-[-0.03em] text-[var(--color-brand-text-muted)] ${locked ? '' : 'hover:text-[var(--color-brand-text-secondary)]'}">${cur}${locked ? '' : ICON('chevron-down', 'size-[18px] translate-y-px')}</${end}>`
  if (CURSTYLE === 'under') return `<${tag} ${a} aria-label="Currency, ${cur}" class="mt-2 inline-flex h-9 items-center gap-2 rounded-full ${locked ? '' : 'hover:bg-[var(--color-brand-elevated)]'} px-2.5 text-[0.84375rem] font-medium text-[var(--color-brand-text-secondary)]"><span aria-hidden="true" class="flex size-6 items-center justify-center rounded-full bg-[var(--color-brand-primary-soft)] text-[0.625rem] font-bold text-[var(--color-brand-primary-ink)]">${SIGN[cur]}</span>${CURNAME[cur]} · ${cur}${locked ? '' : ICON('chevron-down', 'size-4')}</${end}>`
  return locked ? `<span class="inline-flex h-8 items-center rounded-full bg-[var(--color-brand-elevated)] px-2.5 text-[0.8125rem] font-semibold text-[var(--color-brand-text-secondary)]">${cur}</span>` : `<button type="button" ${attr} aria-label="Currency, ${cur}" class="inline-flex h-8 items-center gap-1 rounded-full bg-[var(--color-brand-elevated)] px-2.5 text-[0.8125rem] font-semibold text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-sunken)]">${cur}${ICON('chevron-down', 'size-3.5')}</button>`
}
const LOGO = /*{{LOGOS}}*/{}
const RATE = { EGP: 1, USD: 49.45, EUR: 53.6, GBP: 62.9, SAR: 13.18, AED: 13.46, KWD: 161.2, QAR: 13.58 }
const CURS = [['EGP', 'Egyptian pound', 'E£'], ['USD', 'US dollar', '$'], ['EUR', 'Euro', '€'], ['GBP', 'British pound', '£'], ['SAR', 'Saudi riyal', 'SR'], ['AED', 'UAE dirham', 'AED'], ['KWD', 'Kuwaiti dinar', 'KD'], ['QAR', 'Qatari riyal', 'QR']]
const SIGN = Object.fromEntries(CURS.map((c) => [c[0], c[2]]))
const fxn = (v) => (v < 100 ? v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : Math.round(v).toLocaleString('en-US'))
const secOf = (egp, sign = '') => `≈ ${sign}${SIGN[CUR2]}${fxn(Math.abs(egp) / RATE[CUR2])}`
const MUTED = 'text-[var(--color-brand-text-muted)]'
const SECOND = 'text-[var(--color-brand-text-secondary)]'
const CARDBOX = 'rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)]'
const GRAB = '<div class="flex shrink-0 items-center justify-center min-h-11 cursor-grab touch-none select-none" role="presentation" aria-hidden="true"><div class="h-1 w-9 rounded-full bg-[var(--color-brand-border-strong)]"></div></div>'

/* every October day gets a name, so a moved expense still groups correctly */
for (let d = 1; d <= 31; d++) {
  const dt = new Date(2026, 9, d)
  if (!WEEKDAY[d]) WEEKDAY[d] = dt.toLocaleDateString('en-US', { weekday: 'long' })
  if (!DAYSHORT[d]) DAYSHORT[d] = `${dt.toLocaleDateString('en-US', { weekday: 'short' })}, ${d} Oct`
}

function ltSubLine(t, style) {
  if (t.owed) return ''
  const cls = `font-mono-numbers mt-[3px] block text-[0.71875rem] font-medium ${MUTED}`
  if (t.fx && style !== 'current') return `<span class="${cls}">${SIGN[t.fx.cur]}${f2(t.fx.amt)} ${t.fx.cur}</span>`
  if (CUR2) return `<span class="${cls}">${secOf(t.amt, t.dir === 'in' ? '+' : MINUS)}</span>`
  return ''
}
function ltFlowNote() { return '' }
function ltRangeOk(st, t) {
  const r = st.range
  const amtOk = (st.amin == null || t.amt >= st.amin) && (st.amax == null || t.amt <= st.amax)
  if (!amtOk) return false
  if (r === 'month') return !t.mo
  if (r === 'last') return t.mo === 9
  if (r === 'today') return !t.mo && t.d === 28
  if (r === 'week') return !t.mo && t.d >= 22
  if (r === 'custom') { const x = new Date(2026, (t.mo || 10) - 1, t.d).getTime(); return (!st.from || x >= new Date(st.from).getTime() - 864e5 / 2) && (!st.to || x <= new Date(st.to).getTime() + 864e5 / 2) }
  return true
}

/* ---------- payment methods: one catalogue, one picker ---------- */
const THEMES = { teal: ['#0b7b6f', '#0a534a', 1], blackMetal: ['#2a2a2e', '#141416', 1], midnight: ['#232a52', '#0a0c1e', 1], emerald: ['#13775a', '#073b2c', 1], titanium: ['#d4d7db', '#9aa0a7', 0], burgundy: ['#7a1a2e', '#3a0812', 1], navy: ['#1c3263', '#0b1733', 1] }
const CHIPS = { metalOnDarkMini: 'linear-gradient(135deg, #c4c7cc, #6e7277)', metalOnLight: 'linear-gradient(135deg, #8a8f96, #4a4e54)', gold: 'linear-gradient(135deg, #f3dc9a, #c9a85a 50%, #9c7b34)' }
const PM = {
  cib: { bank: 'CIB', name: 'CIB Debit', kind: 'Debit', last4: '1234', theme: 'teal', style: 'bank', logo: 'cib', cur: 'EGP' },
  cibcc: { bank: 'CIB', name: 'CIB Platinum', kind: 'Credit', last4: '7781', theme: 'blackMetal', style: 'metal', logo: 'cib', cur: 'EGP' },
  usd: { bank: 'CIB', name: 'CIB USD', kind: 'Debit', last4: '6620', theme: 'midnight', style: 'bank', logo: 'cib', cur: 'USD' },
  nbe: { bank: 'NBE', name: 'NBE Debit', kind: 'Debit', last4: '4410', theme: 'emerald', style: 'bank', logo: 'nbe', cur: 'EGP' },
  nbecc: { bank: 'NBE', name: 'NBE Titanium', kind: 'Credit', last4: '0923', theme: 'titanium', style: 'metal', logo: 'nbe', cur: 'EGP' },
  qnb: { bank: 'QNB', name: 'QNB Visa', kind: 'Credit', last4: '5512', theme: 'burgundy', style: 'bank', logo: 'qnb', cur: 'EGP' },
  bm: { bank: 'BM', name: 'Banque Misr Meeza', kind: 'Prepaid', last4: '3305', theme: 'navy', style: 'bank', logo: 'bm', cur: 'EGP' },
  voda: { bank: 'Vodafone', name: 'Vodafone Cash', kind: 'Mobile wallet', mono: 'VC', color: '#D7141A', cur: 'EGP' },
  cash: { bank: 'Cash', name: 'Cash', kind: 'Cash in hand', cash: true, cur: 'EGP' },
  payroll: { bank: 'CIB', name: 'CIB Payroll', kind: 'Account', logo: 'cib', cur: 'EGP' },
}
const GROUPS = [['cib', 'CIB', ['cib', 'cibcc', 'usd']], ['nbe', 'National Bank of Egypt', ['nbe', 'nbecc']], ['qnb', 'QNB', ['qnb']], ['bm', 'Banque Misr', ['bm']], ['voda', 'Wallets', ['voda']], ['cash', 'Cash', ['cash']]]
const RECENT = ['cib', 'cibcc', 'nbe']
const pmName = (k) => (PM[k].last4 ? `${PM[k].name} ••${PM[k].last4}` : PM[k].name)
function brand(k, size) {
  const p = PM[k]
  const r = size * 0.32
  if (p.logo) return `<span aria-hidden="true" class="relative inline-flex shrink-0 items-center justify-center bg-white ring-1 ring-inset ring-[var(--color-brand-border)]" style="width:${size}px;height:${size}px;border-radius:${r}px"><img src="${LOGO[p.logo]}" alt="" draggable="false" class="size-full object-contain" style="padding:${size * 0.14}px;border-radius:${r}px"></span>`
  if (p.cash) return `<span aria-hidden="true" class="inline-flex shrink-0 items-center justify-center bg-[var(--color-brand-green-soft)] text-[var(--color-brand-green)]" style="width:${size}px;height:${size}px;border-radius:${r}px">${ICON('banknote', size > 30 ? 'size-5' : 'size-3.5')}</span>`
  return `<span aria-hidden="true" class="inline-flex shrink-0 items-center justify-center font-bold text-white" style="width:${size}px;height:${size}px;border-radius:${r}px;background:${p.color};font-size:${size * 0.3}px;letter-spacing:.02em">${p.mono}</span>`
}
/* CardFaceChip, 88×56 */
function mini(k, sel = false) {
  const p = PM[k]
  const [a, b, light] = THEMES[p.theme]
  const metal = p.style === 'metal'
  const ink = light ? '#FFFFFF' : '#04201C'
  const bg = `${metal ? `repeating-linear-gradient(90deg, rgba(255,255,255,${light ? 0.045 : 0.18}) 0 1px, transparent 1px 3px), ` : ''}linear-gradient(135deg, ${a} 0%, ${b} 100%)`
  const engrave = metal ? (light ? '0 1px 0 rgba(0,0,0,.55)' : '0 1px 0 rgba(255,255,255,.45)') : (light ? '0 1px 0 rgba(0,0,0,.35)' : 'none')
  const line = light ? 'rgba(255,255,255,.12)' : 'rgba(4,32,28,.12)'
  const chip = metal ? (light ? CHIPS.metalOnDarkMini : CHIPS.metalOnLight) : CHIPS.gold
  return `<span dir="ltr" data-card-face="mini" class="relative box-border flex h-14 w-[88px] shrink-0 flex-col overflow-hidden rounded-[7px] px-[7px] py-1.5 text-start" style="color:${ink};background:${bg};box-shadow:${sel ? '0 0 0 2px var(--color-brand-card), 0 0 0 4px var(--color-brand-primary), ' : ''}0 1px 2px rgba(13,26,24,.18), inset 0 1px 0 rgba(255,255,255,${light ? '.14' : '.5'});border:${light ? 'none' : '1px solid rgba(4,32,28,.10)'}">${metal ? '' : `<svg class="absolute left-0 top-0" width="88" height="56" viewBox="0 0 88 56" aria-hidden="true"><path d="M-4 40 C16 30, 30 52, 52 38 S78 26, 92 32" fill="none" stroke="${line}" stroke-width=".8"/><path d="M-4 45 C16 35, 30 57, 52 43 S78 31, 92 37" fill="none" stroke="${line}" stroke-width=".8"/></svg>`}<i aria-hidden="true" class="absolute inset-0" style="background:linear-gradient(115deg, transparent 30%, rgba(255,255,255,${metal ? '.16' : '.07'}) 48%, transparent 64%)"></i><span class="relative flex items-baseline justify-between gap-1"><span class="shrink-0 text-[0.625rem] font-bold leading-3 tracking-[0.01em]" style="text-shadow:${engrave}">${p.bank}</span><span class="min-w-0 truncate text-[0.53125rem] font-extrabold uppercase leading-[11px] tracking-[0.08em]" style="text-shadow:${engrave}">${p.kind}</span></span><span class="relative mt-auto flex items-center justify-between gap-1"><i aria-hidden="true" class="h-2.5 w-[13px] shrink-0 rounded-[2.5px]" style="background:${chip};box-shadow:inset 0 0 0 .75px rgba(0,0,0,.3)"></i><span class="font-mono-numbers text-[0.6875rem] font-semibold leading-3 tracking-[0.04em]" style="text-shadow:${engrave}">••${p.last4}</span></span></span>`
}
const miniSmall = (k) => `<span class="relative block shrink-0" style="width:58px;height:37px"><span class="absolute left-0 top-0" style="transform:scale(.66);transform-origin:0 0">${mini(k)}</span></span>`
const tick = (on, multi) => multi
  ? `<span aria-hidden="true" class="flex size-[22px] shrink-0 items-center justify-center rounded-[7px] border-2 ${on ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)] text-[var(--color-brand-on-primary)]' : 'border-[var(--color-brand-border-strong)]'}">${on ? ICON('check', 'size-3.5') : ''}</span>`
  : `<span aria-hidden="true" class="flex size-[22px] shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-[var(--color-brand-primary)]' : 'border-[var(--color-brand-border-strong)]'}">${on ? '<span class="size-2.5 rounded-full bg-[var(--color-brand-primary)]"></span>' : ''}</span>`
const sectionHead = (t, extra = '') => `<div class="flex items-baseline justify-between px-5 pb-2 pt-1"><span class="text-[0.6875rem] font-bold uppercase tracking-[0.08em] ${MUTED}">${t}</span>${extra}</div>`
function pmRow(k, on, multi, i) {
  const p = PM[k]
  return `<button type="button" role="${multi ? 'checkbox' : 'radio'}" aria-checked="${on}" data-pm="${k}" class="flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-start transition-colors hover:bg-[var(--color-brand-elevated)] ${i ? 'border-t border-[var(--color-brand-border)]' : ''}">${p.last4 ? miniSmall(k) : `<span class="flex w-[58px] shrink-0 justify-center">${brand(k, 36)}</span>`}<span class="min-w-0 flex-1"><span class="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${p.name}${p.last4 ? ` <span class="font-mono-numbers font-medium ${MUTED}">••${p.last4}</span>` : ''}</span><span class="mt-0.5 block truncate text-xs ${SECOND}">${p.kind} · ${p.cur}</span></span>${tick(on, multi)}</button>`
}
function pmBody(sel, multi, q = '') {
  const match = (k) => !q || `${PM[k].name} ${PM[k].bank} ${PM[k].last4 || ''} ${PM[k].kind}`.toLowerCase().includes(q.toLowerCase())
  const search = `<label class="mx-4 mb-4 flex h-11 items-center gap-2.5 rounded-xl bg-[var(--color-brand-elevated)] px-3.5 ${MUTED}">${ICON('search', 'size-[18px] shrink-0')}<input data-pmq type="search" value="${esc(q)}" placeholder="Search cards, banks, last 4 digits" aria-label="Search payment methods" class="min-w-0 flex-1 bg-transparent text-[0.9375rem] text-[var(--color-brand-text-primary)] outline-none placeholder:text-[var(--color-brand-text-muted)]"></label>`
  const recent = !multi && !q ? `${sectionHead('Recently used')}<div class="hide-scrollbar mb-3 flex gap-3 overflow-x-auto px-5 pb-2 pt-1">${RECENT.map((k) => `<button type="button" data-pm="${k}" aria-label="${pmName(k)}" class="flex shrink-0 flex-col items-center gap-1.5">${PM[k].last4 ? mini(k, sel.has(k)) : `<span class="flex h-14 w-[88px] items-center justify-center rounded-[7px] ${sel.has(k) ? 'ring-2 ring-[var(--color-brand-primary)] ring-offset-2 ring-offset-[var(--color-brand-card)]' : ''} bg-[var(--color-brand-elevated)]">${brand(k, 32)}</span>`}<span class="max-w-[88px] truncate text-[0.6875rem] font-semibold ${SECOND}">${PM[k].name}</span></button>`).join('')}</div>` : ''
  const groups = GROUPS.map(([lead, title, keys]) => {
    const ks = keys.filter(match)
    if (!ks.length) return ''
    return `<div class="mx-4 mb-3 overflow-hidden ${CARDBOX}"><div class="flex items-center gap-2.5 px-4 pb-1.5 pt-3">${brand(lead, 22)}<span class="text-[0.8125rem] font-bold text-[var(--color-brand-text-primary)]">${title}</span><span class="font-mono-numbers text-xs ${MUTED}">${ks.length}</span></div>${ks.map((k, i) => pmRow(k, sel.has(k), multi, i)).join('')}</div>`
  }).join('')
  return `${search}${recent}${!q ? sectionHead('All cards and accounts') : ''}${groups || `<p class="px-5 py-8 text-center text-sm ${MUTED}">No card or account matches “${esc(q)}”.</p>`}`
}

/* ---------- sheet + dialog primitives ---------- */
function ltSheet(S, title, sub, body, foot = '', z = 120, onClose, headAct = '') {
  const el = document.createElement('div')
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', title)
  el.className = PANEL
  const sh = openSheet(S, el, { z, onClose })
  el.innerHTML = `${GRAB}<div class="flex shrink-0 items-start gap-3 px-5 pb-3"><div class="min-w-0 flex-1"><h2 class="text-lg font-bold leading-snug text-[var(--color-brand-text-primary)]">${title}</h2>${sub ? `<p class="mt-0.5 text-[0.8125rem] ${SECOND}">${sub}</p>` : ''}</div>${headAct}<button type="button" data-x aria-label="Close sheet" class="${CLOSE_BTN}">${ICON('x', 'size-4')}</button></div><div data-body class="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pb-4">${body}</div>${foot ? `<div data-foot class="shrink-0 border-t border-[var(--color-brand-border)] px-4 pb-[22px] pt-3">${foot}</div>` : ''}`
  el.addEventListener('click', (e) => { if (e.target.closest('[data-x]')) sh.attempt() })
  sh.el = el
  sh.body = el.querySelector('[data-body]')
  return sh
}
function ltCenter(S, html, z = 300) {
  const root = S.vp.querySelector('[data-layer-root]')
  const scrim = document.createElement('div')
  scrim.className = 'pz-fade fixed inset-0 bg-black/50'
  scrim.style.cssText = `z-index:${z};opacity:0`
  const box = document.createElement('div')
  box.className = 'pz-fade fixed inset-0 flex items-center justify-center p-6'
  box.style.cssText = `z-index:${z + 1};opacity:0`
  box.innerHTML = html
  root.append(scrim, box)
  requestAnimationFrame(() => { scrim.style.opacity = '1'; box.style.opacity = '1' })
  const close = () => { scrim.style.opacity = '0'; box.style.opacity = '0'; setTimeout(() => { scrim.remove(); box.remove() }, 220) }
  box.addEventListener('click', (e) => { if (e.target === box) close() })
  return { box, close }
}
/* proposed shared component: ConfirmDialog (covers UnsavedChangesDialog and delete confirmations) */
function ltAlert(S, title, text, buttons) {
  const v = { primary: `${BTN.primary}`, danger: `${BTN_CORE} border-[var(--color-brand-red)] bg-transparent text-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-soft)]`, solidDanger: `${BTN_CORE} border-transparent bg-[var(--color-brand-red)] text-[var(--color-brand-on-red)]`, ghost: `${BTN_CORE} border-transparent ${SECOND} hover:bg-[var(--color-brand-elevated)]` }
  const d = ltCenter(S, `<div role="alertdialog" aria-modal="true" aria-label="${title}" class="w-full max-w-[18.5rem] rounded-3xl bg-[var(--color-brand-card)] p-5 text-center shadow-[0_24px_60px_-20px_rgba(0,0,0,.45)]"><h2 class="!block text-center text-[1.0625rem] font-bold text-[var(--color-brand-text-primary)]">${title}</h2><p class="mt-1.5 text-center text-[0.84375rem] leading-[1.45] ${SECOND}">${text}</p><div class="mt-4 flex flex-col gap-2">${buttons.map((b, i) => `<button type="button" data-ab="${i}" class="${v[b[0]]} h-11 w-full rounded-xl text-[0.9375rem] font-semibold">${b[1]}</button>`).join('')}</div></div>`)
  d.box.addEventListener('click', (e) => { const b = e.target.closest('[data-ab]'); if (!b) return; d.close(); buttons[+b.dataset.ab][2]?.() })
}
const ltUnsaved = (S, onSave, onDiscard) => ltAlert(S, 'Save your changes?', "You've edited this expense. Save your changes, or discard them and keep the original.", [['primary', 'Save changes', onSave], ['danger', 'Discard changes', onDiscard], ['ghost', 'Keep editing']])

/* ---------- transaction sheet ---------- */
const RECEIPT = { store: 'Carrefour Maadi City Centre', when: 'Scanned Tue, 27 Oct · 18:07', items: [['Fresh milk 1 L', 2, 42.5], ['Eggs, 30 pieces', 1, 165], ['Chicken breast 1 kg', 1, 289], ['Basmati rice 5 kg', 1, 410], ['Olive oil, extra virgin 1 L', 1, 265], ['Bananas 1.2 kg', 1, 45]], charges: [['Club card discount', -19]] }
function catLeftLT(st, c, exceptId) {
  return CAT[c].budget - CAT[c].other - st.tx.filter((t) => !t.mo && t.id !== exceptId && t.dir === 'out' && counted(t) && t.cat === c).reduce((s, t) => s + t.amt, 0)
}
const itemRow = ([n, q, p]) => `<div class="flex items-baseline gap-2 py-1.5 text-[0.84375rem]"><span class="min-w-0 flex-1 truncate text-[var(--color-brand-text-primary)]">${n}</span>${q > 1 ? `<span class="font-mono-numbers text-xs ${MUTED}">${q} × ${f2(p)}</span>` : ''}<span class="font-mono-numbers font-medium text-[var(--color-brand-text-primary)]">${f2(q * p)}</span></div>`
function sourceOf(tx, add) {
  if (tx.receipt) return `${ICON('receipt', `size-4 ${MUTED}`)}Scanned receipt`
  if (add || tx.m === 'cash') return 'Added by you'
  return `${ICON('message-square', `size-4 ${MUTED}`)}Bank SMS · ${PM[tx.m].bank}`
}
function ltEdit(S, t, o = {}) {
  const add = !t
  const tx = t || { id: 'n' + Date.now(), d: 28, time: new Date().toTimeString().slice(0, 5), dir: 'out', title: '', cat: 'Food', m: 'cib', amt: 0, ...(o.prefill || {}) }
  const d = { amt: add && !o.prefill ? '' : (tx.fx ? f2(tx.fx.amt) : Math.abs(tx.amt % 1) < 0.005 ? f0(tx.amt) : f2(tx.amt)), cur: tx.fx ? tx.fx.cur : 'EGP', title: tx.title, cat: tx.cat, m: tx.m, excl: !!tx.excluded, note: tx.note || '', day: tx.d, mo: tx.mo, time: tx.time }
  let dirty = false
  const el = document.createElement('div')
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', add ? 'Add expense' : 'Expense')
  el.className = PANEL
  const sh = openSheet(S, el, { onClose: () => { if (!dirty) return true; ltUnsaved(S, () => { if (commit()) sh.close() }, () => sh.close()); return false } })
  const num = () => parseFloat(String(d.amt).replace(/,/g, '')) || 0
  const egp = () => num() * RATE[d.cur]
  const budgetLine = () => {
    if (d.excl) return 'Not counted in your spending'
    const left = catLeftLT(S.st, d.cat, tx.id) - egp()
    return left >= 0 ? `Counted in your ${d.cat} budget · ${f0(left)} left` : `Counted in your ${d.cat} budget · <span class="font-semibold text-[var(--color-brand-red)]">${f0(-left)} over</span>`
  }
  const convLine = () => (d.cur !== 'EGP' ? `${f2(egp())} EGP · 1 ${d.cur} = ${RATE[d.cur]} EGP` : CUR2 ? secOf(egp()) : '')
  const dayLabel = () => (d.mo === 9 ? `Sep ${d.day}` : DAYSHORT[d.day])
  const fr = (act, k, v) => `<${act ? `button type="button" data-act="${act}"` : 'div'} class="flex min-h-[52px] w-full items-center gap-3 px-4 text-start ${act ? 'transition-colors hover:bg-[var(--color-brand-elevated)]' : ''}"><span class="w-[104px] shrink-0 text-[0.84375rem] ${SECOND}">${k}</span><span class="flex min-w-0 flex-1 items-center justify-end gap-2 text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]">${v}${act ? ICON('chevron-right', `size-4 shrink-0 ${MUTED}`) : ''}</span></${act ? 'button' : 'div'}>`
  const receiptCard = () => {
    const r = RECEIPT
    const more = r.items.length - 3
    return `<section class="mx-4 mt-3 overflow-hidden ${CARDBOX}"><button type="button" data-act="receipt" class="flex w-full items-center gap-3 px-4 pb-1.5 pt-3.5 text-start"><span aria-hidden="true" class="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)]">${ICON('receipt', 'size-[18px]')}</span><span class="min-w-0 flex-1"><span class="block text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">Receipt · ${r.items.length} items</span><span class="block truncate text-xs ${SECOND}">${r.store}</span></span>${ICON('chevron-right', `size-4 shrink-0 ${MUTED}`)}</button><div class="px-4 pb-1">${r.items.slice(0, 3).map(itemRow).join('')}</div><div class="mx-4 flex items-center justify-between border-t border-dashed border-[var(--color-brand-border-strong)] py-2.5 text-[0.8125rem]"><span class="${MUTED}">+${more} more · discount ${MINUS}19</span><b class="font-mono-numbers font-semibold text-[var(--color-brand-text-primary)]">${f2(1240)} EGP</b></div><div class="grid grid-cols-2 border-t border-[var(--color-brand-border)]"><button type="button" data-act="image" class="flex h-11 items-center justify-center gap-2 text-[0.84375rem] font-semibold text-[var(--color-brand-primary-ink)] hover:bg-[var(--color-brand-elevated)]">${ICON('image', 'size-4')}View image</button><button type="button" data-act="receipt" class="flex h-11 items-center justify-center gap-2 border-s border-[var(--color-brand-border)] text-[0.84375rem] font-semibold text-[var(--color-brand-primary-ink)] hover:bg-[var(--color-brand-elevated)]">${ICON('receipt', 'size-4')}All ${r.items.length} items</button></div></section>`
  }
  const noteCard = () => `<label class="mx-4 mt-3 flex min-h-12 items-start gap-3 ${CARDBOX} px-4 py-3">${ICON('sticky-note', `mt-[3px] size-[18px] shrink-0 ${MUTED}`)}<textarea data-f="note" rows="1" aria-label="Note" placeholder="Add a note" class="block min-h-6 w-full resize-none overflow-hidden bg-transparent text-[0.9375rem] leading-6 text-[var(--color-brand-text-primary)] outline-none placeholder:text-[var(--color-brand-text-muted)]">${esc(d.note)}</textarea></label>`
  const sw = (on) => `<span aria-hidden="true" class="relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors ${on ? 'bg-[var(--color-brand-primary)]' : 'bg-[var(--color-brand-border-strong)]'}"><span class="absolute top-[3px] size-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.25)] transition-all" style="inset-inline-start:${on ? 21 : 3}px"></span></span>`
  const draw = () => {
    const c = CAT[d.cat]
    el.innerHTML = `${GRAB}
    <div class="flex shrink-0 items-center gap-2 px-4 pb-1">
      <button type="button" data-act="date" class="${OPT_BASE} ${OPT_OFF}">${ICON('calendar', 'size-4')}${dayLabel()} · ${d.time}</button>
      <span class="flex-1"></span>
      ${add ? '' : `<button type="button" data-act="del" aria-label="Delete expense" class="${CLOSE_BTN} !text-[var(--color-brand-red)]">${ICON('trash-2', 'size-4')}</button>`}
      <button type="button" data-act="close" aria-label="Close sheet" class="${CLOSE_BTN}">${ICON('x', 'size-4')}</button>
    </div>
    <div data-body class="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pb-4">
      <div class="flex flex-col items-center px-5 pb-5 pt-3 text-center">
        <span aria-hidden="true" class="flex size-[52px] items-center justify-center rounded-[16px]" style="background: var(--cat-${c.v}-bg); color: var(--cat-${c.v}-fg);">${ICON(c.icon, 'size-6')}</span>
        <div class="mt-3 flex ${CURSTYLE === 'inline' ? 'items-baseline gap-1.5' : 'items-center gap-2'} justify-center">
          <label class="flex items-baseline font-mono-numbers text-[2.5rem] font-semibold leading-none tracking-[-0.04em] tabular-nums text-[var(--color-brand-text-primary)]"><span>${d.cur === 'EGP' ? MINUS : `${MINUS}${SIGN[d.cur]}`}</span><input data-f="amt" inputmode="decimal" aria-label="Amount" placeholder="0" value="${esc(d.amt)}" class="bg-transparent text-center outline-none placeholder:text-[var(--color-brand-text-muted)]" style="width:2ch"></label>
          ${CURSTYLE === 'under' ? '' : curCtl('data-act="cur"', d.cur, false)}
        </div>${CURSTYLE === 'under' ? curCtl('data-act="cur"', d.cur, false) : ''}
        <p data-conv class="mt-1.5 min-h-4 font-mono-numbers text-xs ${MUTED}">${convLine()}</p>
        <input data-f="title" aria-label="Description" placeholder="What was it for?" value="${esc(d.title)}" class="mt-2 w-full bg-transparent text-center text-[1.0625rem] font-semibold text-[var(--color-brand-text-primary)] outline-none placeholder:text-[var(--color-brand-text-muted)]">
        <p data-bl class="mt-1 text-[0.8125rem] ${SECOND}">${budgetLine()}</p>
      </div>
      <div class="mx-4 divide-y divide-[var(--color-brand-border)] overflow-hidden ${CARDBOX}">
        ${fr('cat', 'Category', `<span aria-hidden="true" class="flex size-6 items-center justify-center rounded-[7px]" style="background: var(--cat-${c.v}-bg); color: var(--cat-${c.v}-fg);">${ICON(c.icon, 'size-3.5')}</span>${d.cat}`)}
        ${fr('method', 'Paid with', `${brand(d.m, 24)}<span class="truncate">${PM[d.m].name}</span>${PM[d.m].last4 ? `<span class="font-mono-numbers ${MUTED}">••${PM[d.m].last4}</span>` : ''}`)}
        ${fr('', 'Recorded from', `<span class="inline-flex items-center gap-1.5 truncate">${sourceOf(tx, add)}</span>`)}
      </div>
      ${tx.receipt ? receiptCard() : ''}
      ${noteCard()}
      <button type="button" data-act="excl" role="switch" aria-checked="${d.excl}" class="mx-4 mt-3 flex w-[calc(100%-2rem)] items-center gap-3 ${CARDBOX} px-4 py-3 text-start"><span class="min-w-0 flex-1"><span class="block text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]">Don't count in my spending</span><span class="mt-0.5 block text-xs ${SECOND}">Still logged, and the account balance still moves.</span></span>${sw(d.excl)}</button>
    </div>
    <div class="shrink-0 border-t border-[var(--color-brand-border)] px-4 pb-[22px] pt-3">${btn('primary', 'block', o.cta || (add ? 'Add expense' : 'Save changes'), 'data-act="save"')}</div>`
    fit()
    grow()
  }
  const fit = () => { const i = el.querySelector('[data-f="amt"]'); i.style.width = '0px'; i.style.width = `${Math.max(i.scrollWidth + 2, 28)}px` }
  const grow = () => { const n = el.querySelector('[data-f="note"]'); n.style.height = 'auto'; n.style.height = `${n.scrollHeight}px` }
  const commit = () => {
    const v = num()
    if (!v || !d.title.trim()) { toast(S, !v ? 'Enter an amount to continue' : 'Add a description to continue'); return false }
    Object.assign(tx, { amt: egp(), fx: d.cur === 'EGP' ? undefined : { cur: d.cur, amt: v }, title: d.title.trim(), cat: d.cat, m: d.m, excluded: d.excl, note: d.note, d: d.day, mo: d.mo, time: d.time, badge: undefined })
    if (add) S.st.tx.push(tx)
    dirty = false
    render(S); toast(S, add ? 'Expense added' : 'Changes saved')
    return true
  }
  const change = () => { dirty = true }
  draw()
  el.addEventListener('input', (e) => {
    const f = e.target.dataset.f
    if (!f) return
    d[f] = e.target.value; change()
    if (f === 'amt') { fit(); el.querySelector('[data-conv]').textContent = convLine(); el.querySelector('[data-bl]').innerHTML = budgetLine() }
    if (f === 'note') grow()
  })
  el.addEventListener('click', (e) => {
    const a = e.target.closest('[data-act]')
    if (!a) return
    const act = a.dataset.act
    if (act === 'close') return sh.attempt()
    if (act === 'cur') return ltCurrency(S, d.cur, (c) => { if (c === d.cur) return; d.amt = d.amt ? f2(egp() / RATE[c]) : ''; d.cur = c; change(); draw() })
    if (act === 'cat') return ltCatPicker(S, d.cat, tx.id, (c) => { d.cat = c; change(); draw() })
    if (act === 'method') return ltMethodPicker(S, d.m, (m) => { d.m = m; change(); draw() })
    if (act === 'date') return ltDate(S, d, (day, time, mo) => { Object.assign(d, { day, time, mo }); change(); draw() })
    if (act === 'receipt') return ltReceipt(S, tx)
    if (act === 'image') return ltImage(S)
    if (act === 'excl') { d.excl = !d.excl; change(); return draw() }
    if (act === 'save') { if (commit()) sh.close(); return }
    if (act === 'del') return ltAlert(S, 'Delete this expense?', `${esc(d.title || 'This expense')} leaves your spending and the account balance. You can undo right after.`, [['solidDanger', 'Delete', () => { sh.close(); setTimeout(() => removeTx(S, tx.id), 220) }], ['ghost', 'Cancel']])
  })
}

/* ---------- tertiary sheets ---------- */
function ltCurrency(S, cur, pick) {
  let q = ''
  const body = () => {
    const list = CURS.filter((c) => !q || `${c[0]} ${c[1]}`.toLowerCase().includes(q.toLowerCase()))
    return `<label class="mx-4 mb-4 flex h-11 items-center gap-2.5 rounded-xl bg-[var(--color-brand-elevated)] px-3.5 ${MUTED}">${ICON('search', 'size-[18px] shrink-0')}<input data-cq type="search" value="${esc(q)}" placeholder="Search currencies" aria-label="Search currencies" class="min-w-0 flex-1 bg-transparent text-[0.9375rem] text-[var(--color-brand-text-primary)] outline-none placeholder:text-[var(--color-brand-text-muted)]"></label>${q ? '' : `${sectionHead('Common')}<div class="mb-4 grid grid-cols-3 gap-2 px-4">${CURS.slice(0, 6).map((c) => `<button type="button" data-cur="${c[0]}" aria-pressed="${c[0] === cur}" class="flex h-16 flex-col items-center justify-center gap-0.5 rounded-2xl border ${c[0] === cur ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)]' : 'border-[var(--color-brand-border)] bg-[var(--color-brand-card)] text-[var(--color-brand-text-primary)]'}"><b class="text-[1.0625rem] font-semibold">${c[2]}</b><span class="text-[0.6875rem] font-semibold ${c[0] === cur ? '' : MUTED}">${c[0]}</span></button>`).join('')}</div>`}${sectionHead('All currencies')}<div class="mx-4 divide-y divide-[var(--color-brand-border)] overflow-hidden ${CARDBOX}">${list.map((c) => `<button type="button" data-cur="${c[0]}" class="flex min-h-[56px] w-full items-center gap-3 px-4 text-start hover:bg-[var(--color-brand-elevated)]"><span aria-hidden="true" class="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-elevated)] text-[0.8125rem] font-bold text-[var(--color-brand-text-primary)]">${c[2]}</span><span class="min-w-0 flex-1"><span class="block text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${c[1]}</span><span class="block text-xs ${MUTED}">${c[0]}${c[0] === 'EGP' ? ' · main currency' : ` · 1 ${c[0]} = ${RATE[c[0]]} EGP`}</span></span>${c[0] === cur ? ICON('check', 'size-5 text-[var(--color-brand-primary)]') : ''}</button>`).join('') || `<p class="p-6 text-center text-sm ${MUTED}">No currency matches.</p>`}</div>`
  }
  const sh = ltSheet(S, 'Currency', 'What this expense was charged in', body())
  sh.el.addEventListener('input', (e) => { if (!e.target.matches('[data-cq]')) return; q = e.target.value; sh.body.innerHTML = body(); const i = sh.body.querySelector('[data-cq]'); i.focus(); i.setSelectionRange(q.length, q.length) })
  sh.el.addEventListener('click', (e) => { const b = e.target.closest('[data-cur]'); if (b) { pick(b.dataset.cur); sh.close() } })
}
function ltCatPicker(S, cur, txId, pick) {
  const tile = (c) => {
    const left = catLeftLT(S.st, c, txId)
    const p = 1 - left / CAT[c].budget
    const tone = p > 1 ? 'var(--color-brand-red)' : p >= 0.8 ? 'var(--color-brand-amber)' : 'var(--color-brand-primary)'
    const on = c === cur
    return `<button type="button" role="radio" aria-checked="${on}" data-cpick="${c}" class="flex flex-col items-start gap-2 rounded-2xl border p-3 text-start ${on ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-soft)]' : 'border-[var(--color-brand-border)] bg-[var(--color-brand-card)]'}"><span aria-hidden="true" class="flex size-9 items-center justify-center rounded-[11px]" style="background: var(--cat-${CAT[c].v}-bg); color: var(--cat-${CAT[c].v}-fg);">${ICON(CAT[c].icon, 'size-[18px]')}</span><b class="text-[0.875rem] font-semibold text-[var(--color-brand-text-primary)]">${c}</b><span class="block h-1 w-full rounded-full bg-[var(--color-brand-elevated)]"><span class="block h-full rounded-full" style="width:${Math.min(100, Math.max(0, p * 100))}%;background:${tone}"></span></span><span class="font-mono-numbers text-xs ${left < 0 ? 'text-[var(--color-brand-red)]' : SECOND}">${c === 'Rent' && left <= 0 ? 'Paid' : left >= 0 ? `${f0(left)} left` : `${f0(-left)} over`}</span></button>`
  }
  const sh = ltSheet(S, 'Category', 'Budget left this month under each one', `<div class="grid grid-cols-2 gap-2 px-4">${Object.keys(CAT).map(tile).join('')}</div>`)
  sh.el.addEventListener('click', (e) => { const p = e.target.closest('[data-cpick]'); if (p) { pick(p.dataset.cpick); sh.close() } })
}
function ltMethodPicker(S, cur, pick) {
  let q = ''
  const sh = ltSheet(S, 'Paid with', 'Your cards and accounts, grouped by bank', pmBody(new Set([cur]), false))
  sh.el.addEventListener('input', (e) => { if (!e.target.matches('[data-pmq]')) return; q = e.target.value; sh.body.innerHTML = pmBody(new Set([cur]), false, q); const i = sh.body.querySelector('[data-pmq]'); i.focus(); i.setSelectionRange(q.length, q.length) })
  sh.el.addEventListener('click', (e) => { const b = e.target.closest('[data-pm]'); if (b) { pick(b.dataset.pm); sh.close() } })
}
function ltReceipt(S, tx) {
  const r = RECEIPT
  const body = `<div class="mx-4 ${CARDBOX} p-4"><div class="flex items-center gap-3"><span aria-hidden="true" class="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)]">${ICON('receipt', 'size-5')}</span><span class="min-w-0 flex-1"><span class="block font-semibold text-[var(--color-brand-text-primary)]">${r.store}</span><span class="block text-xs ${SECOND}">${r.when}</span></span></div><div class="mt-3 grid grid-cols-2 gap-2 text-xs"><span class="rounded-xl bg-[var(--color-brand-elevated)] px-3 py-2"><span class="block ${MUTED}">Paid with</span><b class="mt-0.5 block truncate font-semibold text-[var(--color-brand-text-primary)]">${pmName(tx.m)}</b></span><span class="rounded-xl bg-[var(--color-brand-elevated)] px-3 py-2"><span class="block ${MUTED}">Total</span><b class="mt-0.5 block font-mono-numbers font-semibold text-[var(--color-brand-text-primary)]">${f2(1240)} EGP</b></span></div><button type="button" data-rimg class="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-brand-primary-soft)] text-[0.875rem] font-semibold text-[var(--color-brand-primary-ink)]">${ICON('image', 'size-4')}View receipt image</button></div>
  <div class="h-4"></div>${sectionHead(`${r.items.length} items`)}<div class="mx-4 ${CARDBOX} px-4 py-1.5">${r.items.map(itemRow).join('')}<div class="mt-1 border-t border-dashed border-[var(--color-brand-border-strong)] pt-1.5">${itemRow(['Subtotal', 1, 1259])}${r.charges.map(([l, a]) => `<div class="flex items-baseline justify-between py-1.5 text-[0.84375rem]"><span class="text-[var(--color-brand-green)]">${l}</span><span class="font-mono-numbers font-medium text-[var(--color-brand-green)]">${MINUS}${f2(-a)}</span></div>`).join('')}<div class="flex items-baseline justify-between py-2 text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]"><span>Total</span><span class="font-mono-numbers">${f2(1240)} EGP</span></div></div></div>
  <p class="mx-5 mt-3 text-xs leading-relaxed ${MUTED}">One expense for the whole receipt, counted in Groceries. The image is cropped and enhanced so it can be shown at the store for an exchange or refund.</p>`
  const sh = ltSheet(S, 'Receipt', 'Read from your scan', body)
  sh.el.addEventListener('click', (e) => { if (e.target.closest('[data-rimg]')) ltImage(S) })
}
function ltDate(S, d, done) {
  let day = d.mo === 9 ? 28 : d.day
  let time = d.time
  const first = new Date(2026, 9, 1).getDay()
  const card = () => `<div role="dialog" aria-modal="true" aria-label="Date and time" class="w-full max-w-72 overflow-hidden rounded-3xl bg-[var(--color-brand-card)] shadow-[0_24px_60px_-20px_rgba(0,0,0,.45)]"><div class="bg-[var(--color-brand-primary)] px-5 pb-4 pt-4 text-[var(--color-brand-on-primary)]"><p class="text-xs font-semibold opacity-80">2026</p><p class="mt-0.5 text-2xl font-bold">${DAYSHORT[day] === 'Today' ? 'Wed, 28 Oct' : DAYSHORT[day]}</p></div><div class="px-3 pt-3"><div class="flex items-center justify-between"><button type="button" data-mn aria-label="Previous month" class="${CLOSE_BTN}">${ICON('chevron-left', 'size-4')}</button><b class="text-sm text-[var(--color-brand-text-primary)]">October 2026</b><button type="button" data-mn aria-label="Next month" class="${CLOSE_BTN}">${ICON('chevron-right', 'size-4')}</button></div><div class="mt-2 grid grid-cols-7 text-center text-[0.6875rem] font-semibold ${MUTED}">${'SMTWTFS'.split('').map((x) => `<span>${x}</span>`).join('')}</div><div class="mt-1 grid grid-cols-7 gap-y-0.5 text-center">${'<span></span>'.repeat(first)}${Array.from({ length: 31 }, (_, i) => i + 1).map((n) => `<button type="button" ${n > 28 ? 'disabled' : `data-dpick="${n}"`} class="mx-auto flex size-9 items-center justify-center rounded-full font-mono-numbers text-sm ${n === day ? 'bg-[var(--color-brand-primary)] font-semibold text-[var(--color-brand-on-primary)]' : n > 28 ? 'text-[var(--color-brand-text-muted)] opacity-40' : `text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-elevated)] ${n === 28 ? 'ring-1 ring-inset ring-[var(--color-brand-primary)]' : ''}`}">${n}</button>`).join('')}</div></div><div class="mx-4 mt-2 flex items-center justify-between border-t border-[var(--color-brand-border)] py-3"><span class="text-sm font-medium text-[var(--color-brand-text-primary)]">Time</span><input data-time type="time" value="${time}" aria-label="Time" class="h-9 rounded-lg bg-[var(--color-brand-elevated)] px-2.5 font-mono-numbers text-sm text-[var(--color-brand-text-primary)] outline-none"></div><div class="flex justify-end gap-2 px-4 pb-4">${btn('ghost', 'touch', 'Cancel', 'data-dc')}${btn('primary', 'touch', 'Done', 'data-dd')}</div></div>`
  const dlg = ltCenter(S, card())
  dlg.box.addEventListener('input', (e) => { if (e.target.matches('[data-time]')) time = e.target.value })
  dlg.box.addEventListener('click', (e) => {
    const p = e.target.closest('[data-dpick]')
    if (p) { day = +p.dataset.dpick; dlg.box.innerHTML = card(); return }
    if (e.target.closest('[data-mn]')) return toast(S, 'Sample data covers October')
    if (e.target.closest('[data-dc]')) return dlg.close()
    if (e.target.closest('[data-dd]')) { dlg.close(); done(day, time, undefined) }
  })
}

/* ---------- filters: the app's sections, calmer; paid-with folds into one row ---------- */
{
  const css = document.createElement('style')
  css.textContent = `.lt-range{position:absolute;inset:0;width:100%;margin:0;background:none;pointer-events:none;-webkit-appearance:none;appearance:none}
.lt-range::-webkit-slider-thumb{-webkit-appearance:none;pointer-events:auto;width:26px;height:26px;border-radius:50%;background:var(--color-brand-card);border:2px solid var(--color-brand-primary);box-shadow:0 1px 4px rgba(0,0,0,.2);cursor:grab}
.lt-range::-moz-range-thumb{pointer-events:auto;width:24px;height:24px;border-radius:50%;background:var(--color-brand-card);border:2px solid var(--color-brand-primary)}`
  document.head.appendChild(css)
}
const AMAX = 10000
function ltFilters(S) {
  const { st } = S
  const f = { range: st.range, from: st.from || '2026-10-01', to: st.to || '2026-10-28', amin: st.amin ?? 0, amax: st.amax ?? AMAX, cats: new Set(st.cats), methods: new Set(st.methods) }
  const applied = () => ({ range: f.range, from: f.from, to: f.to, amin: f.amin > 0 ? f.amin : null, amax: f.amax < AMAX ? f.amax : null, cats: f.cats, methods: f.methods })
  const n = () => visible({ ...st, ...applied() }).length
  const head = (t, extra = '') => `<div class="flex items-baseline justify-between px-5 pb-2.5 pt-1"><span class="text-[0.9375rem] font-bold text-[var(--color-brand-text-primary)]">${t}</span>${extra}</div>`
  const RANGES = [['all', 'All time'], ['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['last', 'Last month'], ['custom', 'Custom']]
  const dateField = (k, l) => `<label class="flex min-w-0 flex-1 flex-col gap-1"><span class="text-xs font-medium ${SECOND}">${l}</span><input type="date" data-fd="${k}" value="${f[k]}" class="h-11 w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 font-mono-numbers text-sm text-[var(--color-brand-text-primary)] outline-none"></label>`
  const amtField = (k, l) => `<label class="flex min-w-0 flex-1 flex-col gap-1"><span class="text-xs font-medium ${SECOND}">${l}</span><span class="flex h-11 items-center gap-1 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3"><input data-fa="${k}" inputmode="numeric" value="${f0(f[k])}" class="min-w-0 flex-1 bg-transparent font-mono-numbers text-sm text-[var(--color-brand-text-primary)] outline-none"><span class="text-xs ${MUTED}">EGP</span></span></label>`
  const catCard = (c) => {
    const on = f.cats.has(c)
    const p = catPct(st, c)
    return `<button type="button" role="checkbox" aria-checked="${on}" data-fcat="${c}" class="${on ? CARD_SEL : CARD_UNSEL} !min-h-[56px] !gap-2.5 !p-3"><span aria-hidden="true" class="flex size-8 shrink-0 items-center justify-center rounded-[10px]" style="background: var(--cat-${CAT[c].v}-bg); color: var(--cat-${CAT[c].v}-fg);">${ICON(CAT[c].icon, 'size-4')}</span><span class="min-w-0 flex-1"><span class="block truncate text-[0.875rem] font-semibold text-[var(--color-brand-text-primary)]">${c}</span><span class="block font-mono-numbers text-[0.71875rem] ${p > 1 ? 'text-[var(--color-brand-red)]' : p >= 0.8 ? 'text-[var(--color-brand-amber)]' : SECOND}">${Math.round(p * 100)}% of budget</span></span>${tick(on, true)}</button>`
  }
  const paidRow = () => {
    const ks = [...f.methods]
    const lead = ks.length ? `<span class="flex -space-x-2">${ks.slice(0, 3).map((k) => `<span class="rounded-[9px] ring-2 ring-[var(--color-brand-card)]">${brand(k, 28)}</span>`).join('')}</span>` : `<span aria-hidden="true" class="flex size-7 items-center justify-center rounded-[9px] bg-[var(--color-brand-elevated)] ${SECOND}">${ICON('wallet', 'size-4')}</span>`
    const label = ks.length ? `${ks.length} selected` : 'All cards and accounts'
    const sub = ks.length ? ks.map((k) => pmName(k)).join(', ') : 'Tap to choose cards, banks or wallets'
    return `<button type="button" data-fpaid class="mx-4 flex w-[calc(100%-2rem)] items-center gap-3 ${CARDBOX} px-4 py-3 text-start hover:bg-[var(--color-brand-elevated)]">${lead}<span class="min-w-0 flex-1"><span class="block text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${label}</span><span class="block truncate text-xs ${SECOND}">${sub}</span></span>${ICON('chevron-right', `size-4 shrink-0 ${MUTED}`)}</button>`
  }
  const lo = () => (f.amin / AMAX) * 100
  const hi = () => (f.amax / AMAX) * 100
  const rangeTxt = () => `${f0(f.amin)} – ${f.amax >= AMAX ? `${f0(AMAX)}+` : f0(f.amax)} EGP`
  const body = () => `${head('Date range')}<div class="flex flex-wrap gap-2 px-4">${RANGES.map(([v, l]) => `<button type="button" data-frange="${v}" aria-pressed="${f.range === v}" class="${OPT_BASE} ${f.range === v ? OPT_ON : OPT_OFF}">${v === 'custom' ? ICON('calendar', 'size-4') : ''}${l}</button>`).join('')}</div>${f.range === 'custom' ? `<div class="mt-3 flex gap-2 px-4">${dateField('from', 'From')}${dateField('to', 'To')}</div>` : ''}
  <div class="mt-6">${head('Amount range', `<span data-arange class="font-mono-numbers text-[0.8125rem] font-semibold text-[var(--color-brand-primary-ink)]">${rangeTxt()}</span>`)}<div class="px-5"><div class="relative h-[26px]"><span class="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[var(--color-brand-elevated)]"></span><span data-afill class="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[var(--color-brand-primary)]" style="left:${lo()}%;right:${100 - hi()}%"></span><input type="range" class="lt-range" data-slide="amin" min="0" max="${AMAX}" step="50" value="${f.amin}" aria-label="Minimum amount"><input type="range" class="lt-range" data-slide="amax" min="0" max="${AMAX}" step="50" value="${f.amax}" aria-label="Maximum amount"></div></div><div class="mt-3 flex gap-2 px-4">${amtField('amin', 'Minimum')}${amtField('amax', 'Maximum')}</div></div>
  ${st.seg === 'in' ? '' : `<div class="mt-6">${head('Category', `<span class="text-xs ${MUTED}">Select multiple</span>`)}<div class="grid grid-cols-2 gap-2 px-4">${Object.keys(CAT).map(catCard).join('')}</div></div>`}
  <div class="mt-6">${head('Paid with')}${paidRow()}</div>`
  const foot = () => `<button type="button" data-fshow class="${BTN.primary} ${SZ.block}">Show ${n()} result${n() === 1 ? '' : 's'}</button>`
  const sh = ltSheet(S, 'Filters', '', body(), foot(), 120, undefined, `<button type="button" data-freset class="h-8 px-1 text-sm font-semibold text-[var(--color-brand-primary-ink)]">Reset all</button>`)
  const redraw = () => { const y = sh.body.scrollTop; sh.body.innerHTML = body(); sh.el.querySelector('[data-foot]').innerHTML = foot(); sh.body.scrollTop = y }
  const sync = () => { sh.el.querySelector('[data-afill]').style.cssText = `left:${lo()}%;right:${100 - hi()}%`; sh.el.querySelector('[data-arange]').textContent = rangeTxt(); sh.el.querySelectorAll('[data-fa]').forEach((i) => { if (i !== document.activeElement) i.value = f0(f[i.dataset.fa]) }); sh.el.querySelectorAll('[data-slide]').forEach((i) => { if (i !== document.activeElement) i.value = f[i.dataset.slide] }); sh.el.querySelector('[data-foot]').innerHTML = foot() }
  sh.el.addEventListener('input', (e) => {
    const t = e.target
    if (t.dataset.slide) { const v = +t.value; if (t.dataset.slide === 'amin') f.amin = Math.min(v, f.amax - 50); else f.amax = Math.max(v, f.amin + 50); t.value = f[t.dataset.slide]; return sync() }
    if (t.dataset.fa) { f[t.dataset.fa] = Math.max(0, Math.min(AMAX, parseFloat(t.value.replace(/,/g, '')) || 0)); return sync() }
    if (t.dataset.fd) { f[t.dataset.fd] = t.value; sh.el.querySelector('[data-foot]').innerHTML = foot() }
  })
  sh.el.addEventListener('click', (e) => {
    const t = e.target
    const r = t.closest('[data-frange]'); if (r) { f.range = r.dataset.frange; return redraw() }
    const c = t.closest('[data-fcat]'); if (c) { const k = c.dataset.fcat; f.cats.has(k) ? f.cats.delete(k) : f.cats.add(k); return redraw() }
    if (t.closest('[data-fpaid]')) return ltPaidPicker(S, f.methods, () => redraw())
    if (t.closest('[data-freset]')) { Object.assign(f, { range: 'all', amin: 0, amax: AMAX, cats: new Set(), methods: new Set() }); return redraw() }
    if (t.closest('[data-fshow]')) { Object.assign(st, applied()); sh.close(); render(S) }
  })
}
/* the same grouped list, multi-select, stacked over Filters */
function ltPaidPicker(S, set, done) {
  const sel = new Set(set)
  let q = ''
  const foot = () => `<div class="flex gap-2">${btn('outline', 'cta', 'Any', 'data-pany')}<button type="button" data-pdone class="${BTN.primary} ${SZ.block}">${sel.size ? `Use ${sel.size} selected` : 'Done'}</button></div>`
  const sh = ltSheet(S, 'Paid with', 'Pick one or more', pmBody(sel, true), foot(), 140)
  const redraw = (focus) => { const y = sh.body.scrollTop; sh.body.innerHTML = pmBody(sel, true, q); sh.el.querySelector('[data-foot]').innerHTML = foot(); sh.body.scrollTop = y; if (focus) { const i = sh.body.querySelector('[data-pmq]'); i.focus(); i.setSelectionRange(q.length, q.length) } }
  sh.el.addEventListener('input', (e) => { if (e.target.matches('[data-pmq]')) { q = e.target.value; redraw(true) } })
  sh.el.addEventListener('click', (e) => {
    const m = e.target.closest('[data-pm]'); if (m) { const k = m.dataset.pm; sel.has(k) ? sel.delete(k) : sel.add(k); return redraw() }
    if (e.target.closest('[data-pany]')) { sel.clear(); return redraw() }
    if (e.target.closest('[data-pdone]')) { set.clear(); sel.forEach((k) => set.add(k)); sh.close(); done() }
  })
}

/* ---------- chrome: header title, bottom bar ---------- */
const PAGE_TITLE = { flow: 'Flow', wealth: 'Wealth', debts: 'Debts', budget: 'Budget', subs: 'Subscriptions', insights: 'Insights', paydays: 'Paydays' }
const NAV_PAGE = { Flow: 'flow', Wealth: 'wealth', Debts: 'debts' }
function ltChrome(S) {
  if (!S.acctWired) { S.el.addEventListener('click', (e) => ltAcctClick(S, e), true); S.acctWired = true }
  const p = S.st.page || 'flow'
  const h = S.el.querySelector('header h1')
  if (h) h.textContent = PAGE_TITLE[p]
  const links = [...S.el.querySelectorAll('nav a')]
  const parts = (a) => [a, ...a.querySelectorAll('span, svg')]
  if (!S.nav) {
    const on = links.find((a) => a.getAttribute('aria-current') === 'page')
    const off = links.find((a) => a !== on)
    S.nav = { on: parts(on).map((n) => n.getAttribute('class')), off: parts(off).map((n) => n.getAttribute('class')) }
  }
  links.forEach((a) => {
    const active = NAV_PAGE[a.textContent.trim()] === p
    const cls = active ? S.nav.on : S.nav.off
    const ns = parts(a)
    if (ns.length === cls.length) ns.forEach((n, i) => { if (cls[i] != null) n.setAttribute('class', n.tagName === 'svg' ? `${cls[i].replace(/lucide-[a-z0-9-]+/g, '')} ${(n.getAttribute('class').match(/lucide-[a-z0-9-]+/g) || []).join(' ')}` : cls[i]) })
    if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current')
  })
}
function ltNav(S, a) {
  const p = NAV_PAGE[a.textContent.trim()]
  if (p) return setPage(p)
  toast(S, a.textContent.trim() === 'Accounts' ? 'Accounts is being redesigned separately, so it waits' : 'Not part of this prototype')
}

/* ---------- other pages ---------- */
function heroBand(o, L) {
  const unit = L ? `${o.unit || 'EGP'}${CUR2 && o.n != null ? ` · ${secOf(o.n)}` : ''}` : (o.unit || 'EGP')
  const aside = o.aside && !L ? `<span class="inline-flex h-[22px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-[var(--flow-band-fg)] px-2 text-[0.71875rem] font-bold" style="color: var(--flow-chip-ok);">${ICON(o.aside[0], 'size-[13px]')}${o.aside[1]}</span>` : ''
  const right = o.right ? `<p class="shrink-0 text-end text-[0.71875rem] leading-[1.3] text-[var(--flow-band-fg-2)]"><b class="block font-mono-numbers text-[0.9375rem] text-[var(--flow-band-fg)]">${o.right[0]}</b>${o.right[1]}</p>` : ''
  const b = o.bar
  const track = !b ? '' : b.split
    ? `<div class="flex h-1.5 gap-[3px]">${b.split.map(([p, op]) => `<span class="h-full rounded-full bg-[var(--flow-band-fg)]" style="width:${p}%;opacity:${op}"></span>`).join('')}</div>`
    : `<div class="relative h-1.5 rounded-full" style="background: var(--flow-band-mix);"><div class="h-full rounded-full bg-[var(--flow-band-fg)]" style="width: ${b.pct}%;"></div>${b.tick != null ? `<span class="absolute -bottom-1 -top-1 w-[3px] rounded-[2px] bg-[var(--flow-band-fg)] shadow-[0_0_0_1.5px_var(--flow-band-b)]" style="inset-inline-start: ${b.tick}%;"></span>` : ''}</div>`
  const scale = b && (L ? b.lscale : b.scale)
  const bar = b ? `<div class="pt-3">${track}${scale ? `<div class="mt-[5px] flex items-center justify-between gap-2 overflow-hidden font-mono-numbers text-[0.65625rem] font-semibold leading-[15.75px] text-[var(--flow-band-fg-2)]">${scale.map((x) => `<span>${x}</span>`).join('')}</div>` : ''}</div>` : ''
  const note = L ? o.lnote : o.note
  const cells = !L && o.cells ? `<div class="border-t bg-[var(--flow-band-deep)]" style="border-color: var(--flow-band-mix);"><div class="grid h-[66px] grid-cols-3">${o.cells.map(([l, v], i) => `<div class="min-w-0 pb-[11px] pe-2.5 ps-[18px] pt-2.5 ${i ? 'border-s' : ''}" style="border-color: var(--flow-band-mix);"><p class="flex h-4 items-center whitespace-nowrap text-[0.65625rem] font-bold uppercase tracking-[0.06em] text-[var(--flow-band-fg-2)]"><span class="min-w-0 truncate">${l}</span></p><p class="mt-1 h-6 truncate whitespace-nowrap font-mono-numbers text-base font-bold">${v}</p></div>`).join('')}</div></div>` : ''
  const round = L || o.contained
  const sec = `<section class="text-[var(--flow-band-fg)] ${round ? 'overflow-hidden rounded-3xl' : 'border-b border-[var(--flow-band-line)]'}" style="background: linear-gradient(120deg, var(--flow-band-a) 0%, var(--flow-band-b) 100%);"><div class="px-[18px] ${L ? 'pb-4' : 'pb-3'} pt-2.5"><div class="flex h-[22px] items-center justify-between gap-2"><span class="min-w-0 flex-1 truncate whitespace-nowrap text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[var(--flow-band-fg-2)]">${o.label}</span>${aside}</div><div class="mt-1.5 flex items-end justify-between gap-3"><p class="flex min-w-0 items-baseline gap-1.5"><span class="min-w-0 shrink font-mono-numbers text-[32px] font-semibold leading-[34.5px] tracking-[-0.03em]">${o.big}</span><span class="min-w-0 truncate whitespace-nowrap text-[0.8125rem] text-[var(--flow-band-fg-2)]">${unit}</span></p>${right}</div>${bar}${note ? `<div class="mt-2 text-xs leading-relaxed text-[var(--flow-band-fg-2)]">${note}</div>` : ''}${o.extra || ''}</div>${cells}</section>`
  return round ? `<div class="mx-4 ${L ? 'mt-4' : 'mt-3'}">${sec}</div>` : sec
}
const noteLine = (...parts) => `<span class="flex flex-wrap gap-x-3 gap-y-1">${parts.map((p) => `<span>${p}</span>`).join('')}</span>`
const B = (x) => `<b class="font-mono-numbers font-semibold text-[var(--flow-band-fg)]">${x}</b>`
function lrow(r, L, i) {
  const lead = r.pm ? brand(r.pm, 40) : `<span aria-hidden="true" class="flex size-10 shrink-0 items-center justify-center rounded-[11px]" style="background:${r.tone ? r.tone[0] : 'var(--color-brand-elevated)'};color:${r.tone ? r.tone[1] : 'var(--color-brand-text-secondary)'}">${ICON(r.icon, 'size-5')}</span>`
  const pos = r.n > 0 && r.sign !== false
  const sg = r.sign === false ? '' : pos ? '+' : MINUS
  const amt = r.n == null ? '' : `<span class="shrink-0 text-end"><span class="block font-mono-numbers text-[0.9375rem] font-medium tabular-nums" style="color:${pos ? 'var(--color-brand-green)' : 'var(--color-brand-text-primary)'}">${sg}${f0(r.n)}${r.of ? `<span class="${MUTED}"> / ${r.of}</span>` : ''} <span class="text-[0.6875rem] ${MUTED}">EGP</span></span>${r.fx && L ? `<span class="font-mono-numbers mt-[3px] block text-[0.71875rem] font-medium ${MUTED}">${r.fx}</span>` : CUR2 ? `<span class="font-mono-numbers mt-[3px] block text-[0.71875rem] font-medium ${MUTED}">${secOf(r.n, sg)}</span>` : ''}</span>`
  const bar = r.bar != null ? `<span class="mt-2 block h-1 rounded-full bg-[var(--color-brand-elevated)]"><span class="block h-full rounded-full" style="width:${Math.min(100, r.bar)}%;background:${r.bar > 100 ? 'var(--color-brand-red)' : r.bar >= 80 ? 'var(--color-brand-amber)' : 'var(--color-brand-primary)'}"></span></span>` : ''
  const sep = i ? '<div class="ms-[68px] h-px bg-[var(--color-brand-border)]"></div>' : ''
  return `${sep}<button type="button" data-toast="${esc(r.tap || 'Opens the details')}" class="flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-start transition-colors hover:bg-[var(--color-brand-elevated)]">${lead}<span class="min-w-0 flex-1"><span class="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${r.title}</span><span class="mt-1 block truncate text-xs font-medium ${MUTED}">${r.sub}</span>${bar}</span>${amt}</button>`
}
function list(head, rows, L) {
  return L
    ? `<div class="mx-5 mb-2 mt-6 text-[0.6875rem] font-bold uppercase tracking-[0.08em] ${MUTED}">${head}</div><div class="mx-4 overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] shadow-[var(--shadow-sm)]">${rows.map((r, i) => lrow(r, L, i)).join('')}</div>`
    : `<div class="px-4 pb-1.5 pt-4 text-[0.8125rem] font-bold text-[var(--color-brand-text-primary)]">${head}</div><div class="border-y border-[var(--color-brand-border)] bg-[var(--color-brand-card)]">${rows.map((r, i) => lrow(r, L, i)).join('')}</div>`
}
const tabs = (labels, L) => `<div class="mx-4 ${L ? 'mt-4' : 'mt-3'}"><div class="inline-flex w-full gap-0.5 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-[3px]">${labels.map((l, i) => `<button type="button" data-toast="Switches the list" class="${i ? SEG_OFF : SEG_ON}"><span class="truncate">${l}</span></button>`).join('')}</div></div>`
const actions = (a, b, L) => `<div class="mx-4 ${L ? 'mt-4' : 'mt-3'} grid grid-cols-2 gap-2"><button type="button" data-toast="Opens ${a}" class="${BTN.primary} ${SZ.touch}">${ICON('plus', 'size-[18px]')}${a}</button><button type="button" data-toast="Opens ${b}" class="${BTN_SOFT} ${SZ.touch}">${ICON('arrow-up-right', 'size-[18px]')}${b}</button></div>`
const TONE = { teal: ['var(--color-brand-primary-soft)', 'var(--color-brand-primary-ink)'], green: ['var(--color-brand-green-soft)', 'var(--color-brand-green)'], amber: ['var(--color-brand-amber-soft)', 'var(--color-brand-amber)'] }
const catTone = (c) => [`var(--cat-${CAT[c].v}-bg)`, `var(--cat-${CAT[c].v}-fg)`]

const PAGES = {
  wealth: (st, L) => heroBand({ label: 'What you hold', aside: ['shield-check', 'Emergency fund'], big: '186,420', n: 186420, right: ['103,907', 'Net worth ▲ 2.4%'], bar: { split: [[52, 1], [31, 0.6], [17, 0.35]], scale: ['Savings 52%', 'Gold 31%', 'Stocks 17%'] }, note: 'Plans to save 18% of income', cells: [['Savings', '96,940'], ['Gold', '57,790 ▲8.1%'], ['Stocks', '31,690 ▲3.2%']], lnote: noteLine(`Savings ${B('52%')}`, `Gold ${B('31%')}`, `Stocks ${B('17%')}`) }, L)
    + actions('Add money', 'Withdraw', L)
    + (L ? '' : `<div class="mx-4 mt-3 flex items-center justify-between rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-3.5 py-2.5 text-xs"><span class="font-semibold text-[var(--color-brand-text-primary)]">Gold 21k</span><span class="font-mono-numbers ${SECOND}">3,210 / g</span><span class="font-mono-numbers font-semibold text-[var(--color-brand-green)]">▲ 0.6% today</span></div>`)
    + list('Holdings', [{ icon: 'landmark', tone: TONE.teal, title: 'CIB savings certificate', sub: '3 years · 17.5% a year', n: 96940, sign: false }, { icon: 'gem', tone: TONE.amber, title: 'Gold 21k · 18 g', sub: L ? '3,210 a gram · ▲ 8.1% since you bought' : '▲ 8.1% since you bought', n: 57790, sign: false }, { icon: 'trending-up', tone: TONE.green, title: 'EGX stocks · 4 holdings', sub: '▲ 3.2% this month', n: 31690, sign: false }], L)
    + list('Activity', [{ icon: 'arrow-down-left', tone: TONE.green, title: 'Deposit to CIB certificate', sub: 'Oct 25 · from CIB Debit ••1234', n: 5000 }, { icon: 'gem', tone: TONE.amber, title: 'Bought gold, 2 g', sub: 'Oct 12 · Cash', n: -6420 }], L),
  debts: (st, L) => heroBand({ label: 'Still owed', big: '48,600', n: 48600, right: ['38% cleared', '29,400 of 78,000 paid'], bar: { pct: 38, scale: ['of 78,000 borrowed in total', CUR2 ? secOf(48600) : ''], lscale: null }, cells: [['Next payment', '3,250 · Nov 5'], ['This month', '2 of 3 paid'], ['Last payment', 'Oct 12']], lnote: noteLine(`Next ${B('3,250')} on Nov 5`, `${B('2 of 3')} paid this month`) }, L)
    + tabs(['All', 'Borrowed', 'Installments', 'Cards'], L)
    + list('Active', [{ pm: 'cib', title: 'Car loan · CIB', sub: '3,250 a month · 11 of 36 left', n: 36000, sign: false, bar: 69 }, { icon: 'smartphone', tone: TONE.teal, title: 'iPhone 16 · valU', sub: '1,400 a month · 6 of 12 left', n: 8400, sign: false, bar: 50 }, { pm: 'qnb', title: 'QNB Visa ••5512', sub: 'Statement due Nov 10', n: 4200, sign: false }], L)
    + list('Payments', [{ pm: 'cib', title: 'Car loan · October', sub: 'Oct 5 · CIB Debit ••1234', n: -3250 }, { icon: 'smartphone', tone: TONE.teal, title: 'valU · October', sub: 'Oct 12 · CIB Debit ••1234', n: -1400 }], L),
  budget: (st, L) => {
    const T = totals(st)
    const hero = L
      ? `<div class="mx-4 mt-4">${bandHTML(st, { contained: true, cells: false, pb: 'pb-4', lt: true, note: noteLine(`Shopping is ${B('over')}`, `${B('1,200')} still to pay`) })}</div>`
      : `<div class="mx-4 mt-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4"><div class="flex items-center justify-between"><span class="text-[0.6875rem] font-bold uppercase tracking-[0.08em] ${MUTED}">October · Month</span>${badge('positive', 'On track')}</div><p class="mt-2 flex items-baseline gap-1.5"><span class="font-mono-numbers text-[32px] font-semibold tracking-[-0.03em] text-[var(--color-brand-text-primary)]">${f2(T.left)}</span><span class="text-sm ${MUTED}">EGP left</span></p><p class="text-[0.8125rem] ${SECOND}"><b class="font-mono-numbers">${f0(T.perDay)}</b> a day · ${DAYS_LEFT} days left</p><div class="relative mt-3 h-1.5 rounded-full bg-[var(--color-brand-elevated)]"><div class="h-full rounded-full bg-[var(--color-brand-primary)]" style="width:${T.pct}%"></div><span class="absolute -bottom-1 -top-1 w-[3px] rounded-[2px] bg-[var(--color-brand-text-primary)]" style="inset-inline-start:${TICK}%"></span></div><div class="mt-4 grid grid-cols-3 gap-2 border-t border-[var(--color-brand-border)] pt-3">${[['Top category', 'Rent'], ['Over budget', 'Shopping'], ['Still to pay', '1,200']].map(([l, v]) => `<div><p class="text-[0.65625rem] font-bold uppercase tracking-[0.06em] ${MUTED}">${l}</p><p class="mt-1 truncate font-mono-numbers text-sm font-bold text-[var(--color-brand-text-primary)]">${v}</p></div>`).join('')}</div></div>`
    const seg = `<div class="mx-4 ${L ? 'mt-4' : 'mt-3'}"><div class="inline-flex w-full gap-0.5 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-[3px]"><button type="button" class="${SEG_ON}">Month</button><button type="button" data-toast="Opens the plan view" class="${SEG_OFF}">Plan</button></div></div>`
    const rows = CHIP_ORDER.map((c) => { const p = catPct(st, c); return { icon: CAT[c].icon, tone: catTone(c), title: c, sub: `${p > 1 ? `${f0((p - 1) * CAT[c].budget)} over` : `${f0((1 - p) * CAT[c].budget)} left`}${L ? ` of ${f0(CAT[c].budget)}` : ''}`, n: p * CAT[c].budget, of: L ? '' : f0(CAT[c].budget), sign: false, bar: p * 100, tap: `Opens ${c}` } })
    return seg + hero + list('Categories', rows, L)
  },
  subs: (st, L) => heroBand(L ? { label: 'Subscriptions · per month', big: '2,062', n: 2062, unit: 'EGP a month', bar: { pct: 63, lscale: ['Paid 1,300', '762 still due this month'] }, lnote: noteLine(`Next ${B('Netflix')} on Nov 2`, `${B('24,744')} a year`) } : { label: 'Due in the next 30 days', big: '762', n: 762, bar: { pct: 63, scale: ['Paid 1,300', 'Left 762'] }, cells: [['Per month', '2,062'], ['Per year', '24,744'], ['Next charge', 'Netflix · Nov 2']], }, L)
    + tabs(['Upcoming', 'All', 'Ended'], L)
    + list('Next 30 days', [{ icon: 'sparkles', tone: catTone('Entertainment'), title: 'Netflix', sub: 'Nov 2 · CIB Platinum ••7781', n: -494, fx: '$9.99 USD' }, { icon: 'sparkles', tone: catTone('Entertainment'), title: 'Spotify', sub: 'Nov 6 · CIB Debit ••1234', n: -99 }, { icon: 'plug', tone: catTone('Utilities'), title: 'iCloud+', sub: 'Nov 9 · CIB Debit ••1234', n: -49 }, { icon: 'sparkles', tone: catTone('Entertainment'), title: 'Shahid VIP', sub: 'Nov 14 · CIB Debit ••1234', n: -120 }], L)
    + list('Paid this month', [{ icon: 'sparkles', tone: catTone('Entertainment'), title: "Gold's Gym", sub: 'Oct 22 · Banque Misr Meeza ••3305', n: -850 }, { icon: 'plug', tone: catTone('Utilities'), title: 'Vodafone', sub: 'Oct 1 · Vodafone Cash', n: -450 }], L),
  insights: (st, L) => heroBand({ label: 'You can spend', big: '687', n: 687, unit: 'EGP a day', contained: true, note: "You're spending a little faster than your plan. At this pace the money lasts to Nov 8.", cells: [['Spent so far', '16,253'], ['Per day so far', '813'], ['Money lasts', 'Nov 8']], lnote: noteLine(`${B('16,253')} spent so far`, `Lasts to ${B('Nov 8')}`) }, L)
    + list('What changed', [{ icon: 'trending-up', tone: TONE.amber, title: 'Food is up 18% on September', sub: 'Mostly Talabat, 6 orders', tap: 'Opens the insight' }, { icon: 'repeat', tone: TONE.teal, title: 'Subscriptions cost 2,062 a month', sub: 'Netflix is charged in USD', tap: 'Opens the insight' }, { icon: 'piggy-bank', tone: TONE.green, title: 'You saved 18% of income', sub: 'Above your 15% plan', tap: 'Opens the insight' }], L)
    + (L ? list('Net worth', [{ icon: 'landmark', tone: TONE.teal, title: 'Net worth', sub: '▲ 2.4% this month', n: 103907, sign: false }], L) : heroBand({ label: 'Net worth', big: '103,907', unit: `EGP${CUR2 ? ` (${SIGN[CUR2]}${fxn(103907 / RATE[CUR2])})` : ''}`, contained: true, note: 'What you hold minus what you owe.' }, false)),
  paydays: (st, L) => heroBand({ label: 'Salary · Monthly → CIB Payroll', big: '31,500', n: 31500, unit: 'EGP each month', note: 'Last 6 paydays · on the 25th', lnote: noteLine(`Next payday ${B('Nov 25')}`, `On time ${B('6 of 6')}`), extra: `<div class="mt-3 flex items-center justify-between">${['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'].map((m) => `<span class="flex flex-col items-center gap-1"><span class="flex size-6 items-center justify-center rounded-full bg-[var(--flow-band-fg)]" style="color: var(--flow-band-b);">${ICON('check', 'size-3.5')}</span><span class="text-[0.65625rem] font-semibold text-[var(--flow-band-fg-2)]">${m}</span></span>`).join('')}</div>` }, L)
    + actions('Log a payday', 'Edit payday', L)
    + list('History', [{ pm: 'payroll', title: 'Salary · October', sub: 'Oct 25 · on time', n: 31500 }, { pm: 'payroll', title: 'Salary · September', sub: 'Sep 25 · on time', n: 31500 }, { pm: 'payroll', title: 'Salary · August', sub: 'Aug 25 · on time', n: 31500 }], L),
}
function ltPage(st) { return PAGES[st.page](st, st.design === 'M') }
const LT_NOTES = {
  flow: 'Rounded band without the stats strip, no month row or category chips, a small filter button, all months in one list. Amounts show EGP; with a second currency on, a quiet ≈ line sits under each amount. Netflix shows the USD it was charged in.',
  wealth: 'Same HeroBand, contained and rounded. The three stat cells go: the split bar and one legend line carry the same facts, and the values are in the Holdings list right below. The gold price moves into the gold row.',
  debts: 'One rounded band: owed, cleared, the bar. The three cells collapse into one line with the next payment. The second currency moves next to the big number instead of the bar scale.',
  budget: "Budget's month card becomes the same rounded band as Flow, so both pages read alike. The three stats become one line. Categories sit in one rounded card with thin bars.",
  subs: 'Rounded band, no cells: next charge and the yearly total share one line. Netflix shows its USD price under the EGP amount.',
  insights: 'The hero was already rounded; it loses the three cells. The second net-worth band becomes a plain row, so the page has one hero.',
  paydays: 'The payday hero becomes the rounded band; the six-payday timeline stays because it is the content.',
}

/* ---------- receipt image: cropped, enhanced, opened on demand ---------- */
function receiptPaper() {
  const r = RECEIPT
  const ln = (a, b, bold) => `<div style="display:flex;justify-content:space-between;gap:8px;${bold ? 'font-weight:700;font-size:13px' : ''}"><span style="min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${a}</span><span>${b}</span></div>`
  const dash = '<div style="border-top:1px dashed #9a978f;margin:8px 0"></div>'
  return `<div style="width:272px;background:#fbfaf6;color:#1c1c1a;font:11px/1.55 'Courier New',ui-monospace,monospace;padding:20px 18px 26px;box-shadow:0 30px 60px -20px rgba(0,0,0,.6);clip-path:polygon(0 0,100% 0,100% calc(100% - 6px),95% 100%,90% calc(100% - 6px),85% 100%,80% calc(100% - 6px),75% 100%,70% calc(100% - 6px),65% 100%,60% calc(100% - 6px),55% 100%,50% calc(100% - 6px),45% 100%,40% calc(100% - 6px),35% 100%,30% calc(100% - 6px),25% 100%,20% calc(100% - 6px),15% 100%,10% calc(100% - 6px),5% 100%,0 calc(100% - 6px))">
  <div style="text-align:center;font-weight:700;font-size:17px;letter-spacing:.12em">CARREFOUR</div><div style="text-align:center">Maadi City Centre · Cairo</div><div style="text-align:center">Tax ID 100-234-567</div>${dash}
  ${ln('27/10/2026 18:05', '#4471-02')}${ln('Cashier 14', 'POS 07')}${dash}
  ${r.items.map(([n, q, p]) => `${ln(n.toUpperCase(), f2(q * p))}${q > 1 ? `<div style="padding-inline-start:10px;color:#5d5b55">${q} x ${f2(p)}</div>` : ''}`).join('')}${dash}
  ${ln('SUBTOTAL', f2(1259))}${ln('CLUB CARD DISCOUNT', `-${f2(19)}`)}${ln('TOTAL EGP', f2(1240), true)}${dash}
  ${ln('NBE DEBIT', '****4410')}${ln('AUTH', '082714')}${ln('ITEMS', '7')}
  <div style="height:38px;margin:12px 6px 6px;background:repeating-linear-gradient(90deg,#1c1c1a 0 2px,transparent 2px 3px,#1c1c1a 3px 4px,transparent 4px 7px,#1c1c1a 7px 10px,transparent 10px 11px)"></div>
  <div style="text-align:center">6 223001 447102 7</div><div style="text-align:center;margin-top:6px">Exchange or refund within 14 days with this receipt</div></div>`
}
function ltImage(S) {
  const root = S.vp.querySelector('[data-layer-root]')
  const el = document.createElement('div')
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Receipt image')
  el.className = 'pz-fade fixed inset-0 flex flex-col'
  el.style.cssText = 'z-index:400;opacity:0;background:rgba(6,10,9,.94);max-height:none !important'
  const glass = 'flex size-11 items-center justify-center rounded-full bg-white/12 text-white backdrop-blur-md hover:bg-white/20'
  el.innerHTML = `<div class="flex shrink-0 items-center gap-2 px-4 pb-2 pt-3"><button type="button" data-ix aria-label="Close image" class="${glass}">${ICON('x', 'size-5')}</button><span class="min-w-0 flex-1 text-center"><span class="block text-[0.9375rem] font-semibold text-white">Carrefour receipt</span><span class="block text-xs text-white/60">Cropped and enhanced · 27 Oct</span></span><button type="button" data-toast="Opens the share sheet" aria-label="Share" class="${glass}">${ICON('share-2', 'size-5')}</button></div>
  <div class="flex min-h-0 flex-1 items-start justify-center overflow-y-auto px-6 py-4">${receiptPaper()}</div>
  <div class="shrink-0 px-4 pb-[26px] pt-2"><p class="mb-3 text-center text-xs text-white/60">Show this at the store for an exchange or a refund.</p><div class="grid grid-cols-2 gap-2"><button type="button" data-toast="Saved to Photos" class="${BTN_CORE} h-12 rounded-xl border-white/15 bg-white/10 text-[0.9375rem] text-white">${ICON('download', 'size-[18px]')}Save to Photos</button><button type="button" data-toast="Opens the share sheet" class="${BTN.primary} h-12 rounded-xl text-[0.9375rem]">${ICON('share-2', 'size-[18px]')}Share</button></div></div>`
  root.append(el)
  requestAnimationFrame(() => { el.style.opacity = '1' })
  el.addEventListener('click', (e) => {
    const ts = e.target.closest('[data-toast]'); if (ts) return toast(S, ts.dataset.toast)
    if (e.target.closest('[data-ix]')) { el.style.opacity = '0'; setTimeout(() => el.remove(), 220) }
  })
}

/* ================= sheet gallery: today's money sheets (before) and the shared transaction layout (after) ================= */
/* after: one layout for every single-movement sheet */
function ltTx(S, c) {
  let amt = c.amt
  let dirty = false
  const dd = { day: c.day || 28, time: c.time || '09:00' }
  const rows = c.rows.map((r) => ({ ...r }))
  const el = document.createElement('div')
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', c.title)
  el.className = PANEL
  const sh = openSheet(S, el, { onClose: () => { if (!dirty) return true; ltUnsaved(S, () => { toast(S, 'Changes saved'); sh.close() }, () => sh.close()); return false } })
  const n = () => parseFloat(String(amt).replace(/,/g, '')) || 0
  const sub2 = () => (c.cur !== 'EGP' ? `${f2(n() * RATE[c.cur])} EGP · 1 ${c.cur} = ${RATE[c.cur]} EGP` : CUR2 ? secOf(n()) : '')
  const rowHTML = (r, i) => {
    const v = r.pm ? `${brand(r.pm, 24)}<span class="truncate">${PM[r.pm].name}</span>${PM[r.pm].last4 ? `<span class="font-mono-numbers ${MUTED}">••${PM[r.pm].last4}</span>` : ''}` : r.sw != null ? '' : r.v
    if (r.sw != null) return `<button type="button" data-row="${i}" role="switch" aria-checked="${r.sw}" class="flex min-h-[52px] w-full items-center gap-3 px-4 text-start"><span class="min-w-0 flex-1"><span class="block text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]">${r.k}</span>${r.help ? `<span class="block text-xs ${SECOND}">${r.help}</span>` : ''}</span><span aria-hidden="true" class="relative h-[26px] w-[44px] shrink-0 rounded-full ${r.sw ? 'bg-[var(--color-brand-primary)]' : 'bg-[var(--color-brand-border-strong)]'}"><span class="absolute top-[3px] size-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.25)]" style="inset-inline-start:${r.sw ? 21 : 3}px"></span></span></button>`
    const tag = r.static ? 'div' : 'button type="button"'
    return `<${tag} data-row="${i}" class="flex min-h-[52px] w-full items-center gap-3 px-4 text-start ${r.static ? '' : 'hover:bg-[var(--color-brand-elevated)]'}"><span class="w-[104px] shrink-0 text-[0.84375rem] ${SECOND}">${r.k}</span><span class="flex min-w-0 flex-1 items-center justify-end gap-2 text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]">${v}${r.static ? '' : ICON('chevron-right', `size-4 shrink-0 ${MUTED}`)}</span></${r.static ? 'div' : 'button'}>`
  }
  const draw = () => {
    el.innerHTML = `${GRAB}<div class="flex shrink-0 items-center gap-2 px-4 pb-1"><button type="button" data-a="date" class="${OPT_BASE} ${OPT_OFF}">${ICON('calendar', 'size-4')}${c.dateLabel ? c.dateLabel : `${DAYSHORT[dd.day]} · ${dd.time}`}</button><span class="flex-1"></span>${c.del ? `<button type="button" data-a="del" aria-label="Delete" class="${CLOSE_BTN} !text-[var(--color-brand-red)]">${ICON('trash-2', 'size-4')}</button>` : ''}${c.menu ? `<button type="button" data-a="menu" aria-label="More actions" class="${CLOSE_BTN}">${ICON('ellipsis-vertical', 'size-4')}</button>` : ''}<button type="button" data-a="close" aria-label="Close sheet" class="${CLOSE_BTN}">${ICON('x', 'size-4')}</button></div>
    <div class="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pb-4"><div class="flex flex-col items-center px-5 pb-5 pt-3 text-center">${c.iconHTML || `<span aria-hidden="true" class="flex size-[52px] items-center justify-center rounded-[16px]" style="background:${c.icon[1]};color:${c.icon[2]}">${ICON(c.icon[0], 'size-6')}</span>`}${c.titleTop ? `<p class="mt-2.5 text-[1.0625rem] font-semibold text-[var(--color-brand-text-primary)]">${c.title}</p>` : ''}<div class="mt-3 flex ${CURSTYLE === 'inline' ? 'items-baseline gap-1.5' : 'items-center gap-2'} justify-center"><label class="flex items-baseline font-mono-numbers text-[2.5rem] font-semibold leading-none tracking-[-0.04em] tabular-nums text-[var(--color-brand-text-primary)]"><span>${c.sign}${c.cur === 'EGP' ? '' : SIGN[c.cur]}</span><input data-amt inputmode="decimal" aria-label="Amount" value="${esc(amt)}" class="bg-transparent text-center outline-none" style="width:2ch"></label>${CURSTYLE === 'under' ? '' : curCtl('data-a="cur"', c.curText || c.cur, c.lockCur)}</div>${CURSTYLE === 'under' ? curCtl('data-a="cur"', c.curText || c.cur, c.lockCur) : ''}<p data-sub2 class="mt-1.5 min-h-4 font-mono-numbers text-xs ${MUTED}">${sub2()}</p>${c.titleTop ? '' : `<p class="mt-2 text-[1.0625rem] font-semibold text-[var(--color-brand-text-primary)]">${c.title}</p>`}${c.titleTop && c.badge ? c.badge() : ''}<p data-tline class="mt-1 text-[0.8125rem] ${SECOND}">${typeof c.line === 'function' ? c.line(n()) : c.line}</p>${!c.titleTop && c.badge ? c.badge() : ''}${c.quick ? `<div class="mt-3 flex gap-2">${c.quick.map(([l, v]) => `<button type="button" data-quick="${v}" class="${OPT_BASE} ${OPT_OFF} !h-8 !text-xs">${l}</button>`).join('')}</div>` : ''}</div>
    ${c.pre ? c.pre() : ''}${rows.length ? `<div class="mx-4 divide-y divide-[var(--color-brand-border)] overflow-hidden ${CARDBOX}">${rows.map(rowHTML).join('')}</div>` : ''}${c.extra || ''}${c.note === false ? '' : `<label class="mx-4 mt-3 flex min-h-12 items-start gap-3 ${CARDBOX} px-4 py-3">${ICON('sticky-note', `mt-[3px] size-[18px] shrink-0 ${MUTED}`)}<textarea data-note rows="1" aria-label="Note" placeholder="Add a note" class="block min-h-6 w-full resize-none overflow-hidden bg-transparent text-[0.9375rem] leading-6 outline-none placeholder:text-[var(--color-brand-text-muted)]"></textarea></label>`}</div>
    <div class="shrink-0 border-t border-[var(--color-brand-border)] px-4 pb-[22px] pt-3">${btn('primary', 'block', c.cta, 'data-a="save"')}</div>`
    const i = el.querySelector('[data-amt]'); i.style.width = '0px'; i.style.width = `${Math.max(i.scrollWidth + 2, 28)}px`
  }
  draw()
  el.addEventListener('input', (e) => {
    if (e.target.matches('[data-amt]')) { amt = e.target.value; dirty = true; e.target.style.width = '0px'; e.target.style.width = `${Math.max(e.target.scrollWidth + 2, 28)}px`; el.querySelector('[data-sub2]').textContent = sub2(); if (typeof c.line === 'function') el.querySelector('[data-tline]').innerHTML = c.line(n()) }
    if (e.target.matches('[data-note]')) { dirty = true; e.target.style.height = 'auto'; e.target.style.height = `${e.target.scrollHeight}px` }
  })
  el.addEventListener('click', (e) => {
    const q = e.target.closest('[data-quick]'); if (q) { amt = q.dataset.quick; dirty = true; return draw() }
    const pv = e.target.closest('[data-pre]'); if (pv && c.onPre) { c.onPre(pv.dataset.pre, rows); dirty = true; return draw() }
    const rr = e.target.closest('[data-row]')
    if (rr) {
      const r = rows[+rr.dataset.row]
      if (r.static) return
      if (r.sw != null) { r.sw = !r.sw; dirty = true; return draw() }
      if (r.pm) return ltMethodPicker(S, r.pm, (m) => { r.pm = m; dirty = true; draw() })
      if (r.fn) return r.fn(S, r, () => { dirty = true; draw() })
      return toast(S, r.tap || 'Opens the picker')
    }
    const a = e.target.closest('[data-a]'); if (!a) return
    const act = a.dataset.a
    if (act === 'close') return sh.attempt()
    if (act === 'date') return c.dateLabel ? toast(S, 'Opens the date picker') : ltDate(S, { day: dd.day, time: dd.time }, (day, time) => { Object.assign(dd, { day, time }); dirty = true; draw() })
    if (act === 'cur' && c.onCur) return c.onCur(S, () => { dirty = true; draw() })
    if (act === 'cur') return ltCurrency(S, c.cur, (k) => { c.cur = k; dirty = true; draw() })
    if (act === 'badge' && c.onBadge) { c.onBadge(); return draw() }
    if (act === 'menu') return toast(S, c.menu)
    if (act === 'del') return ltAlert(S, c.delTitle || 'Delete this?', c.delText || 'This cannot be undone.', [['solidDanger', 'Delete', () => { sh.close(); toast(S, 'Deleted') }], ['ghost', 'Cancel']])
    if (act === 'save') { sh.close(); toast(S, c.done || 'Saved') }
  })
}
const IC = { green: ['var(--color-brand-green-soft)', 'var(--color-brand-green)'], teal: ['var(--color-brand-primary-soft)', 'var(--color-brand-primary-ink)'], amber: ['var(--color-brand-amber-soft)', 'var(--color-brand-amber)'] }
const AFTER = {
  expense: (S) => ltEdit(S, S.st.tx.find((t) => t.id === 't3') || S.st.tx.find((t) => t.dir === 'out')),
  income: (S, t = S.st.tx.find((x) => x.id === 't7')) => ltTx(S, { title: t.title, icon: ['briefcase', ...IC.green], sign: '+', amt: f0(t.amt), cur: 'EGP', day: t.d, time: t.time, del: true, delTitle: 'Delete this income?', delText: 'It leaves Flow and your Salary payday shows as not received.', line: t.recurring ? 'Your October payday · on time' : 'One-time money in', rows: [{ k: 'Type', v: t.type }, { k: 'Received in', pm: t.m }, { k: 'Payday', v: t.recurring ? `${t.type} · Oct ${t.d}` : 'Not linked', tap: 'Opens the payday' }, { k: 'Recorded from', v: `<span class="inline-flex items-center gap-1.5">${ICON('message-square', `size-4 ${MUTED}`)}Bank SMS · CIB</span>`, static: true }], cta: 'Save changes', done: 'Changes saved' }),
  received: (S) => ltTx(S, { title: 'Salary · November', icon: ['briefcase', ...IC.green], sign: '+', amt: '31,500', cur: 'EGP', lockCur: true, day: 25, time: '09:00', line: 'Expected 31,500 · full amount', quick: [['Full 31,500', '31,500'], ['Half 15,750', '15,750']], rows: [{ k: 'Received in', pm: 'payroll' }, { k: 'Payday', v: 'Salary · monthly', static: true }], note: false, cta: 'Mark received', done: 'Payday marked received' }),
  debtpay: (S) => ltTx(S, { title: 'Car loan · CIB', icon: ['landmark', ...IC.teal], sign: MINUS, amt: '3,250', cur: 'EGP', day: 5, time: '10:00', line: (v) => `36,000 left · ${f0(Math.max(0, 36000 - v))} after this`, rows: [{ k: 'Debt', v: 'Car loan · CIB', tap: 'Opens the debt picker' }, { k: 'Paid from', pm: 'cib' }, { k: 'Repeat monthly', help: 'Logs it on the 5th each month', sw: true }], cta: 'Record payment', done: 'Payment recorded' }),
  deposit: (S) => ltTx(S, { title: 'Into CIB savings certificate', icon: ['piggy-bank', ...IC.teal], sign: '+', amt: '5,000', cur: 'EGP', day: 28, time: '12:00', line: (v) => `96,940 → ${f0(96940 + v)} after this`, rows: [{ k: 'Into', v: 'CIB savings certificate', tap: 'Opens the pocket picker' }, { k: 'From', pm: 'cib' }], cta: 'Add money', done: 'Money added' }),
  goal: (S) => ltTx(S, { title: 'Umrah 2027', icon: ['sparkles', ...IC.amber], sign: '+', amt: '2,000', cur: 'EGP', day: 28, time: '12:00', line: (v) => `${f0(Math.max(0, 48000 - 18000 - v))} left to reach 48,000`, quick: [['1,000', '1,000'], ['2,000', '2,000'], ['Plan: 2,500', '2,500']], rows: [{ k: 'From', pm: 'nbe' }], note: false, cta: 'Add to goal', done: 'Added to Umrah 2027' }),
  scan: (S) => ltEdit(S, null, { prefill: { title: 'Carrefour', cat: 'Groceries', m: 'nbe', amt: 1240, d: 27, time: '18:05', receipt: true }, cta: 'Save expense' }),
  repaid: (S) => ltTx(S, { title: 'Ahmed paid you back', icon: ['undo-2', ...IC.green], sign: '+', amt: '400', cur: 'EGP', lockCur: true, day: 28, time: '10:30', line: 'For Zooba on Oct 27 · 400 of 400', rows: [{ k: 'Into', pm: 'cib' }, { k: 'Match', v: 'Transfer +400 · Oct 28', tap: 'Opens the matching money-in list' }], note: false, cta: 'Mark repaid', done: 'Marked repaid' }),
  sub: (S) => ltTx(S, { title: 'Netflix', icon: ['sparkles', ...IC.teal], sign: MINUS, amt: '9.99', cur: 'USD', dateLabel: 'Next charge · Nov 2', menu: 'Pause, cancel and delete live here', line: 'Monthly · since Mar 2024 · 24,744 a year for all subscriptions', rows: [{ k: 'Paid with', pm: 'cibcc' }, { k: 'Category', v: 'Entertainment' }, { k: 'Repeats', v: 'Every month' }, { k: 'Remind me', help: 'A day before each charge', sw: true }], extra: `${sectionHead('Last charges').replace('px-5 pb-2 pt-1', 'px-5 pb-2 pt-5')}<div class="mx-4 ${CARDBOX} px-4 py-1">${[['Oct 2', '494.01', '$9.99'], ['Sep 2', '489.50', '$9.99'], ['Aug 2', '486.20', '$9.99']].map(([d, e, u]) => `<div class="flex items-baseline justify-between py-2 text-[0.84375rem]"><span class="${SECOND}">${d}</span><span class="font-mono-numbers text-[var(--color-brand-text-primary)]">${MINUS}${e} EGP <span class="${MUTED}">· ${u}</span></span></div>`).join('')}</div>`, note: false, cta: 'Save changes', done: 'Changes saved' }),
}

/* before: today's sheets, rebuilt from what their components render */
const bLabel = (t) => `<p class="mb-1.5 mt-4 text-[0.6875rem] font-bold uppercase tracking-[0.08em] ${MUTED}">${t}</p>`
const bAmount = (v, cur, w = '108px') => `<div class="flex gap-2"><div class="flex h-14 min-w-0 flex-1 items-center rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-4 font-mono-numbers text-2xl font-semibold text-[var(--color-brand-text-primary)]">${v}</div>${cur ? `<div class="flex h-14 shrink-0 items-center justify-between gap-1 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 text-sm font-semibold text-[var(--color-brand-text-primary)]" style="width:${w}">${cur}${ICON('chevron-down', `size-4 ${MUTED}`)}</div>` : ''}</div>`
const bField = (v, icon = 'calendar') => `<div class="flex min-h-12 items-center gap-3 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3.5 text-[0.9375rem] text-[var(--color-brand-text-primary)]">${ICON(icon, `size-[18px] ${SECOND}`)}<span class="min-w-0 flex-1 truncate">${v}</span>${ICON('chevron-down', `size-4 ${MUTED}`)}</div>`
const bChips = (list, on = 0) => `<div class="hide-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">${list.map((l, i) => `<span class="${OPT_BASE} ${i === on ? OPT_ON : OPT_OFF} !h-11">${l}</span>`).join('')}</div>`
const bSwitch = (t, s, on) => `<div class="mt-4 flex items-center gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-4 py-3"><span class="min-w-0 flex-1"><span class="block text-[0.9375rem] font-medium">${t}</span><span class="block text-xs ${SECOND}">${s}</span></span><span class="relative h-[26px] w-[44px] rounded-full ${on ? 'bg-[var(--color-brand-primary)]' : 'bg-[var(--color-brand-border-strong)]'}"><span class="absolute top-[3px] size-5 rounded-full bg-white" style="inset-inline-start:${on ? 21 : 3}px"></span></span></div>`
const bInput = (v, ph) => `<div class="flex h-12 items-center rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-3.5 text-[0.9375rem] ${v ? 'text-[var(--color-brand-text-primary)]' : MUTED}">${v || ph}</div>`
const GREEN_CTA = (l) => `<button type="button" data-done class="${BTN_CORE} h-14 w-full rounded-[14px] border-transparent bg-[var(--color-brand-green)] text-[0.9375rem] font-semibold text-[var(--color-brand-on-green)]">${l}</button>`
function bOpen(S, title, sub, body, foot) {
  const el = shell(title, sub, body, foot)
  const sh = openSheet(S, el)
  el.addEventListener('click', (e) => { if (e.target.closest('[data-done]')) { sh.close(); toast(S, 'Saved') } })
}
const BEFORE = {
  expense: (S) => openEdit(S, S.st.tx.find((t) => t.id === 't3') || S.st.tx.find((t) => t.dir === 'out')),
  income: (S) => openIncome(S, S.st.tx.find((t) => t.id === 't7')),
  received: (S) => bOpen(S, 'Salary received', 'Expected 31,500 EGP', `${bLabel('Date received')}<span class="${OPT_BASE} ${OPT_OFF}">${ICON('calendar', 'size-4')}Wed, 25 Nov</span>${bLabel('Amount received')}<div class="flex items-center gap-2 rounded-2xl bg-[var(--color-brand-elevated)] px-4 py-4"><span class="text-sm font-semibold ${SECOND}">EGP</span><span class="min-w-0 flex-1 font-mono-numbers text-2xl font-semibold text-[var(--color-brand-green)]">31,500</span><span class="rounded-full bg-[var(--color-brand-green-soft)] px-2.5 py-1 text-xs font-bold text-[var(--color-brand-green)]">Full</span></div>`, GREEN_CTA('Mark received')),
  debtpay: (S) => bOpen(S, 'Record a payment', 'Car loan · CIB', `<div class="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-3.5"><div class="flex justify-between text-sm"><b>Car loan · CIB</b><span class="font-mono-numbers">36,000.00 left</span></div><div class="mt-2 h-1.5 rounded-full bg-[var(--color-brand-elevated)]"><div class="h-full w-[69%] rounded-full bg-[var(--color-brand-primary)]"></div></div></div>${bLabel('Amount')}${bAmount('3,250.00', 'EGP')}${bLabel('Date')}${bField('Thu, 5 Nov')}${bLabel('Paid from')}${bChips(['CIB Debit •• 1234', 'Cash', 'Vodafone Cash'])}${bSwitch('Repeat monthly', 'Log it on the 5th each month', true)}${bLabel('Notes')}${bInput('', 'Add a note')}`, `<button type="button" data-done class="${BTN.primary} h-12 w-full rounded-xl font-bold">Record payment</button>`),
  deposit: (S) => bOpen(S, 'Add money', 'Move money into savings', `${bLabel('Pocket')}${bField('CIB savings certificate', 'piggy-bank')}${bLabel('Amount')}${bAmount('5,000.00', 'EGP')}${bLabel('Source')}<div class="inline-flex w-full gap-0.5 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-[3px]"><span class="${SEG_ON}">From an account</span><span class="${SEG_OFF}">Outside money</span></div>${bLabel('From')}${bField('CIB Debit •• 1234 · 18,420 free', 'wallet')}${bLabel('Note')}${bInput('', 'Optional')}`, `<button type="button" data-done class="${BTN.primary} ${SZ.block}">Add money</button>`),
  goal: (S) => bOpen(S, 'Add to Umrah 2027', '', `<div class="rounded-3xl p-5 text-center" style="background:linear-gradient(135deg,color-mix(in oklab,var(--color-brand-primary) 18%,var(--color-brand-card)),var(--color-brand-card))"><p class="text-xs ${SECOND}">Amount</p><p class="mt-1 font-mono-numbers text-[34px] font-semibold">2,000</p><p class="text-xs ${MUTED}">EGP</p></div><p class="mt-3 text-center text-sm ${SECOND}">28,000 left after this</p>${bLabel('From')}${bField('NBE Debit •• 4410', 'wallet')}`, `<button type="button" data-done class="${BTN.primary} ${SZ.block}">Add to goal</button>`),
  scan: (S) => bOpen(S, 'Review receipt', 'Carrefour · 6 items', `${bLabel('Amount')}${bAmount('1,240.00', 'EGP')}${bLabel('Merchant')}${bInput('Carrefour')}${bLabel('Category')}<div class="flex h-12 items-center justify-between rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-3.5 text-[0.9375rem]">Groceries<span class="${MUTED}">⌄</span></div>${bLabel('Date')}${bField('Tue, 27 Oct')}${bLabel('Items')}<div class="rounded-2xl border border-[var(--color-brand-border)] px-4 py-1">${RECEIPT.items.map(itemRow).join('')}</div>`, `<div class="flex gap-2">${btn('outline', 'cta', 'Rescan')}<button type="button" data-done class="${BTN.primary} ${SZ.block}">${ICON('check', 'size-[18px]')}Save expense</button></div>`),
  repaid: (S) => bOpen(S, 'Mark repaid', 'Ahmed · Zooba', `${bLabel('Paid back into')}${bField('CIB Debit •• 1234', 'wallet')}${bLabel('Matching money in')}<div class="flex flex-col gap-2">${btn('outline', 'block', 'Transfer +400 · Oct 28')}${btn('outline', 'block', 'Cash +200 · Oct 27')}</div>${bLabel('Amount')}${bAmount('400.00', '')}`, `<button type="button" data-done class="${BTN.primary} ${SZ.block}">Mark repaid</button>`),
  sub: (S) => bOpen(S, 'Netflix', '', `<div class="flex items-center gap-3"><span class="flex size-14 items-center justify-center rounded-2xl bg-[#E50914] text-xl font-black text-white">N</span><span>${badge('positive', 'Active')}<p class="mt-1 font-mono-numbers text-[28px] font-semibold">$9.99</p><p class="text-xs ${SECOND}">Monthly · CIB Platinum •• 7781</p></span></div>${bLabel('Next charges')}${['Nov 2', 'Dec 2', 'Jan 2'].map((d) => `<div class="flex justify-between py-1.5 font-mono-numbers text-sm"><span>${d}</span><span>$9.99</span></div>`).join('')}${bLabel('Matched charges')}${['Oct 2 · 494.01 EGP', 'Sep 2 · 489.50 EGP'].map((d) => `<p class="py-1.5 font-mono-numbers text-sm">${d}</p>`).join('')}${bLabel('Price history')}<p class="font-mono-numbers text-sm">$7.99 → $9.99 · Jan 2025</p>`, `<div class="grid grid-cols-2 gap-2">${btn('outline', 'touch', 'Edit')}${btn('outline', 'touch', 'Pause')}<button type="button" class="${BTN_CORE} h-11 rounded-xl border-[var(--color-brand-red)] text-[var(--color-brand-red)]">Cancel</button><button type="button" class="${BTN_CORE} h-11 rounded-xl border-[var(--color-brand-red)] text-[var(--color-brand-red)]">Delete</button></div>`),
}
function ltIncome(S, t) { return AFTER.income(S, t) }
