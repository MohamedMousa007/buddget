
/* ================= v4: owner round 4. Shared pieces first, then the sheets that use them ================= */
BADGE.danger = 'bg-[var(--color-brand-red-soft)] text-[var(--color-brand-red-text)]'
const ORD = (d) => (d === 'last' ? 'Last day' : `${d}${d % 100 > 10 && d % 100 < 14 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[d % 10] || 'th'}`)
const num4 = (v) => parseFloat(String(v).replace(/,/g, '')) || 0
const CHEV = ICON('chevron-right', `size-4 shrink-0 ${MUTED}`)
/* header buttons: one size for X, bin, ⋮ and settings */
const H_DEL = (a = 'data-v="del"') => `<button type="button" ${a} aria-label="Delete" class="${CLOSE_BTN} !text-[var(--color-brand-red)]">${ICON('trash-2', 'size-4')}</button>`
const H_GEAR = (a = 'data-v="settings"') => `<button type="button" ${a} aria-label="Settings" class="${CLOSE_BTN}">${ICON('settings', 'size-4')}</button>`
/* InlineUnit: the tappable muted code beside a big number. Currency, grams, karat all use it */
const ctl4 = (act, text, aria = 'Currency') => `<button type="button" data-v="${act}" aria-label="${aria}, ${text}" class="inline-flex items-center gap-0.5 font-mono-numbers text-[1.625rem] font-semibold leading-none tracking-[-0.03em] text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-secondary)]">${text}${ICON('chevron-down', 'size-[18px] translate-y-px')}</button>`
const unit4 = (text) => `<span class="font-mono-numbers text-[1.625rem] font-semibold leading-none tracking-[-0.03em] text-[var(--color-brand-text-muted)]">${text}</span>`
/* AmountHero: big editable amount + InlineUnit + one line under it */
const hero4 = ({ key = 'amt', amt = '', ctl = '', sign = '', line = '', top = '', label = '' }) => `<div class="flex flex-col items-center px-5 pb-4 pt-2 text-center">${top}${label ? `<p class="mt-3 text-[0.8125rem] font-medium ${SECOND}">${label}</p>` : ''}<div class="${top || label ? 'mt-2' : 'mt-1'} flex items-baseline justify-center gap-1.5"><label class="flex items-baseline font-mono-numbers text-[2.5rem] font-semibold leading-none tracking-[-0.04em] tabular-nums text-[var(--color-brand-text-primary)]">${sign}<input data-in="${key}" data-grow inputmode="decimal" aria-label="Amount" placeholder="0" value="${esc(amt)}" class="bg-transparent text-center outline-none placeholder:text-[var(--color-brand-text-muted)]" style="width:${Math.max(String(amt).length, 1) + 0.4}ch"></label>${ctl}</div><p data-line class="mt-2 min-h-5 text-[0.8125rem] ${SECOND}">${line}</p></div>`
/* PickerPill: date, day, number, "every". Calendar icon for anything on a calendar */
const pill4 = (v, icon) => `<span class="inline-flex h-8 items-center gap-1.5 rounded-full bg-[var(--color-brand-elevated)] px-3 text-[0.875rem] font-medium text-[var(--color-brand-text-primary)]">${icon ? ICON(icon, `size-4 ${SECOND}`) : ''}${v}</span>`
const row4 = (k, v, act, chev = true) => act
  ? `<button type="button" data-v="${act}" class="flex min-h-[52px] w-full items-center gap-3 px-4 text-start hover:bg-[var(--color-brand-elevated)]"><span class="w-[112px] shrink-0 text-[0.84375rem] ${SECOND}">${k}</span><span class="flex min-w-0 flex-1 items-center justify-end gap-2 text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]">${v}${chev ? CHEV : ''}</span></button>`
  : `<div class="flex min-h-[52px] items-center gap-3 px-4"><span class="w-[112px] shrink-0 text-[0.84375rem] ${SECOND}">${k}</span><span class="flex min-w-0 flex-1 items-center justify-end gap-2 text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]">${v}</span></div>`
const date4 = (k, v, act = 'date') => row4(k, pill4(v, 'calendar'), act, false)
const pick4 = (k, v, act, icon) => row4(k, pill4(v, icon), act, false)
const sw4 = (key, k, help, on) => `<button type="button" data-v="sw:${key}" role="switch" aria-checked="${!!on}" class="flex min-h-[52px] w-full items-center gap-3 px-4 py-2.5 text-start"><span class="min-w-0 flex-1"><span class="block text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]">${k}</span>${help ? `<span class="block text-xs ${SECOND}">${help}</span>` : ''}</span><span aria-hidden="true" class="relative h-[26px] w-[44px] shrink-0 rounded-full ${on ? 'bg-[var(--color-brand-primary)]' : 'bg-[var(--color-brand-border-strong)]'}"><span class="absolute top-[3px] size-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.25)]" style="inset-inline-start:${on ? 21 : 3}px"></span></span></button>`
const seg4 = (key, opts, on) => `<div class="mx-4"><div class="inline-flex w-full gap-0.5 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-[3px]">${opts.map(([v, l]) => `<button type="button" data-v="set:${key}:${v}" class="${v === on ? SEG_ON : SEG_OFF}">${l}</button>`).join('')}</div></div>`
const in4 = (key, k, ph, val = '', mode = 'text') => `<label class="flex min-h-[52px] items-center gap-3 px-4"><span class="w-[112px] shrink-0 text-[0.84375rem] ${SECOND}">${k}</span><input data-in="${key}" inputmode="${mode}" value="${esc(val)}" placeholder="${esc(ph)}" class="min-w-0 flex-1 bg-transparent text-end text-[0.9375rem] text-[var(--color-brand-text-primary)] outline-none placeholder:text-[var(--color-brand-text-muted)] ${mode === 'decimal' ? 'font-mono-numbers' : ''}"></label>`
const pmV = (k) => (k === 'outside' ? `${ICON('arrow-left-right', `size-4 ${MUTED}`)}Outside buddget` : `${brand(k, 24)}<span class="truncate">${PM[k].name}</span>${PM[k].last4 ? `<span class="font-mono-numbers ${MUTED}">••${PM[k].last4}</span>` : ''}`)
const grp4 = (rows, head = '', foot = '') => `${head ? sectionHead(head).replace('pt-1', 'pt-5') : '<div class="h-3"></div>'}<div class="mx-4 divide-y divide-[var(--color-brand-border)] overflow-hidden ${CARDBOX}">${rows.filter(Boolean).join('')}</div>${foot ? `<p data-foot-note class="mx-5 mt-2 text-xs leading-relaxed ${MUTED}">${foot}</p>` : ''}`
/* Last4Tiles: exactly four digits, one tile each */
const tiles4 = (val = '') => `<label class="relative flex min-h-[52px] items-center gap-3 px-4"><span class="min-w-0 flex-1 text-[0.84375rem] ${SECOND}">Last 4 digits <span class="${MUTED}">· optional</span></span><span class="flex gap-1.5" dir="ltr">${[0, 1, 2, 3].map((i) => `<span data-tile="${i}" class="flex h-9 w-8 items-center justify-center rounded-lg border-[1.5px] bg-[var(--color-brand-elevated)] font-mono-numbers text-base font-semibold text-[var(--color-brand-text-primary)] ${i === val.length ? 'border-[var(--color-brand-primary)]' : 'border-[var(--color-brand-border)]'}">${val[i] || ''}</span>`).join('')}</span><input data-in="last4" data-tiles inputmode="numeric" maxlength="4" autocomplete="off" aria-label="Last 4 digits" value="${esc(val)}" class="absolute inset-0 w-full cursor-text bg-transparent text-transparent caret-transparent outline-none"></label>`
const NFLX = (s) => `<span aria-hidden="true" class="flex shrink-0 items-center justify-center bg-[#E50914] font-black text-white shadow-[0_8px_20px_-10px_rgba(229,9,20,.7)]" style="width:${s}px;height:${s}px;border-radius:${s * 0.28}px;font-size:${s * 0.46}px">N</span>`
const TILE52 = (ic, tone) => `<span aria-hidden="true" class="flex size-[52px] items-center justify-center rounded-[16px]" style="background:${tone[0]};color:${tone[1]}">${ICON(ic, 'size-6')}</span>`

/* one sheet shell for every v4 form: state, redraw, switches, segments, inputs */
function form4(S, o) {
  const st = o.state || {}
  const sh = ltSheet(S, o.title, o.sub || '', '', o.foot ? '<div data-f4></div>' : '', o.z || 120, undefined, o.head || '')
  if (o.lead) sh.el.querySelector('h2').parentElement.insertAdjacentHTML('beforebegin', o.lead)
  const draw = () => { const y = sh.body.scrollTop; sh.body.innerHTML = o.body(st); sh.body.scrollTop = y; const f = sh.el.querySelector('[data-f4]'); if (f) f.innerHTML = o.foot(st); o.after?.(st, sh) }
  sh.draw = draw; sh.st = st
  draw()
  sh.el.addEventListener('click', (e) => {
    const v = e.target.closest('[data-v]')
    if (v) {
      const [k, a, b] = v.dataset.v.split(':')
      if (k === 'sw') { st[a] = !st[a]; o.onChange?.(st); return draw() }
      if (k === 'set') { st[a] = b; o.onChange?.(st); return draw() }
      if (k === 'del' && o.del) return ltAlert(S, o.del[0], o.del[1], [['solidDanger', 'Delete', () => { sh.close(); toast(S, 'Deleted') }], ['ghost', 'Cancel']])
      if (k === 'cur' && !o.on?.cur) return ltCurrency(S, st.cur, (c) => { st.cur = c; draw() })
      if (k === 'date' && !o.on?.date) return ltDate(S, { day: 28, time: '12:00' }, (d) => { st.date = DAYSHORT[d] === 'Today' ? 'Today' : `Oct ${d}`; draw() })
      return o.on?.[k]?.(v, draw, st, sh)
    }
    const ts = e.target.closest('[data-toast]'); if (ts) return toast(S, ts.dataset.toast)
    const dn = e.target.closest('[data-done]'); if (dn) { sh.close(); toast(S, dn.dataset.done === 'link' ? (o.linkDone || 'Done') : (o.done || 'Saved')) }
  })
  sh.el.addEventListener('input', (e) => {
    const f = e.target.closest('[data-in]'); if (!f) return
    if (f.matches('[data-tiles]')) {
      f.value = f.value.replace(/\D/g, '').slice(0, 4)
      f.parentElement.querySelectorAll('[data-tile]').forEach((t, i) => { t.textContent = f.value[i] || ''; t.classList.toggle('border-[var(--color-brand-primary)]', i === f.value.length); t.classList.toggle('border-[var(--color-brand-border)]', i !== f.value.length) })
    }
    if (f.matches('[data-grow]')) f.style.width = `${Math.max(f.value.length, 1) + 0.4}ch`
    st[f.dataset.in] = f.value
    o.onInput?.(f, st, sh)
  })
  return sh
}
const foot4 = (cta, link, danger) => `<div class="flex flex-col gap-1">${danger ? `<button type="button" data-done class="${BTN_CORE} h-12 w-full rounded-xl border-transparent bg-[var(--color-brand-red)] text-[0.9375rem] text-[var(--color-brand-on-red)]">${cta}</button>` : `<button type="button" data-done class="${BTN.primary} ${SZ.block}">${cta}</button>`}${link ? `<button type="button" data-done="link" class="h-11 text-[0.875rem] font-semibold ${danger ? SECOND : 'text-[var(--color-brand-primary-ink)]'}">${link}</button>` : ''}</div>`

/* ---------- pickers (each one is a sheet over the sheet) ---------- */
function ltDayPicker(S, title, day, done) {
  let d = day === 'last' ? 31 : day
  const cellCls = (n) => `mx-auto flex size-10 items-center justify-center rounded-full font-mono-numbers text-[0.9375rem] ${n === d ? 'bg-[var(--color-brand-primary)] font-semibold text-[var(--color-brand-on-primary)]' : 'text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-elevated)]'}`
  const body = () => `<div class="flex flex-col items-center pb-4"><p class="font-mono-numbers text-[2.5rem] font-semibold leading-none tracking-[-0.04em] text-[var(--color-brand-text-primary)]">${ORD(d)}</p><p class="mt-2 text-[0.8125rem] ${SECOND}">of each month</p></div><div class="mx-4 ${CARDBOX} p-2"><div class="grid grid-cols-7 gap-y-1">${Array.from({ length: 31 }, (_, i) => `<button type="button" data-d="${i + 1}" class="${cellCls(i + 1)}">${i + 1}</button>`).join('')}</div></div>`
  const sh = ltSheet(S, title, '', body(), btn('primary', 'block', 'Done', 'data-dd'), 220)
  sh.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-d]'); if (b) { d = +b.dataset.d; sh.body.innerHTML = body(); return }
    if (e.target.closest('[data-dd]')) { sh.close(); done(d) }
  })
}
function ltNumPicker(S, title, val, presets, unit, done) {
  let n = val
  const body = () => `<div class="flex flex-col items-center pb-4"><label class="flex items-baseline gap-1.5 font-mono-numbers text-[2.5rem] font-semibold leading-none tracking-[-0.04em] text-[var(--color-brand-text-primary)]"><input data-nn inputmode="numeric" value="${n}" aria-label="${title}" class="bg-transparent text-center outline-none" style="width:${String(n).length + 0.4}ch">${unit4(unit(n))}</label><p class="mt-2 text-[0.8125rem] ${SECOND}">Type any number, or pick one</p></div><div class="mx-4 grid grid-cols-4 gap-2">${presets.map((p) => `<button type="button" data-n="${p}" class="flex h-12 items-center justify-center rounded-xl border font-mono-numbers text-[0.9375rem] font-semibold ${p === n ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)]' : 'border-[var(--color-brand-border)] bg-[var(--color-brand-card)] text-[var(--color-brand-text-primary)]'}">${p}</button>`).join('')}</div>`
  const sh = ltSheet(S, title, '', body(), btn('primary', 'block', 'Done', 'data-dd'), 220)
  sh.el.addEventListener('input', (e) => { if (!e.target.matches('[data-nn]')) return; e.target.value = e.target.value.replace(/\D/g, '').slice(0, 3); e.target.style.width = `${Math.max(e.target.value.length, 1) + 0.4}ch`; n = +e.target.value || n })
  sh.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-n]'); if (b) { n = +b.dataset.n; sh.body.innerHTML = body(); return }
    if (e.target.closest('[data-dd]')) { sh.close(); done(n) }
  })
}
function ltOptPicker(S, title, sub, opts, on, done) {
  const row = ([v, t, s, ic], i) => `${i ? '<div class="ms-4 h-px bg-[var(--color-brand-border)]"></div>' : ''}<button type="button" data-o="${esc(v)}" role="radio" aria-checked="${v === on}" class="flex min-h-[56px] w-full items-center gap-3 px-4 py-2.5 text-start">${ic ? `<span aria-hidden="true" class="flex size-9 shrink-0 items-center justify-center rounded-[11px]" style="background:${ic[1]};color:${ic[2]}">${ICON(ic[0], 'size-[18px]')}</span>` : ''}<span class="min-w-0 flex-1"><span class="block text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${t}</span>${s ? `<span class="block text-xs ${SECOND}">${s}</span>` : ''}</span>${tick(v === on, false)}</button>`
  const sh = ltSheet(S, title, sub, `<div class="mx-4 overflow-hidden ${CARDBOX}">${opts.map(row).join('')}</div>`, '', 220)
  sh.el.addEventListener('click', (e) => { const b = e.target.closest('[data-o]'); if (b) { sh.close(); done(b.dataset.o) } })
}
const EVERY = [['Week', 'Every week'], ['Month', 'Every month'], ['Quarter', 'Every 3 months'], ['Year', 'Every year']]
const pickEvery = (S, on, done) => ltOptPicker(S, 'Every', 'How often a payment is due', EVERY, on, done)
/* pockets: grouped, searchable, ready for many */
const POCKETS = [
  ['Goals', [['umrah', 'Umrah 2027', 'moon-star', IC.amber, '18,000', 'of 48,000', 38], ['trip', 'Trip to Dahab', 'plane', IC.teal, '12,000', 'of 50,000', 24], ['car', 'New car', 'car', ['var(--cat-transport-bg)', 'var(--cat-transport-fg)'], '64,000', 'of 400,000', 16], ['laptop', 'New laptop', 'smartphone', IC.green, '21,000', 'of 60,000', 35]]],
  ['Savings', [['cert', 'CIB savings certificate', 'cib', null, '96,940'], ['nbe3', 'NBE 3-year certificate', 'nbe', null, '150,000'], ['usd', 'Dollar savings', 'coins', IC.green, '2,400 USD'], ['gold', 'Gold · 21k', 'gem', ['color-mix(in oklab, var(--color-brand-gold) 18%, var(--color-brand-card))', 'var(--color-brand-gold)'], '36,800']]],
  ['Safety net', [['ef', 'Emergency fund', 'shield-check', IC.teal, '16,800', 'of 36,000', 47]]],
]
const POCKET = Object.fromEntries(POCKETS.flatMap(([, l]) => l.map((p) => [p[0], p])))
const pocketMark = (p, s = 36) => (p[3] ? `<span aria-hidden="true" class="flex shrink-0 items-center justify-center" style="width:${s}px;height:${s}px;border-radius:${s * 0.31}px;background:${p[3][0]};color:${p[3][1]}">${ICON(p[2], s > 44 ? 'size-6' : s > 30 ? 'size-[18px]' : 'size-3.5')}</span>` : brand(p[2], s))
const pocketV = (k) => `${pocketMark(POCKET[k], 24)}<span class="truncate">${POCKET[k][1]}</span>`
function ltPocketPicker(S, on, done, only) {
  let q = ''
  const row = (p) => `<button type="button" data-pk="${p[0]}" role="radio" aria-checked="${p[0] === on}" class="flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-start">${pocketMark(p)}<span class="min-w-0 flex-1"><span class="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${p[1]}</span><span class="mt-0.5 flex items-center gap-2 text-xs ${MUTED}"><span class="font-mono-numbers">${p[4]}${p[5] ? ` ${p[5]}` : ''}</span>${p[6] != null ? `<span class="block h-1 w-12 rounded-full bg-[var(--color-brand-sunken)]"><span class="block h-full rounded-full bg-[var(--color-brand-primary)]" style="width:${p[6]}%"></span></span>` : ''}</span></span>${tick(p[0] === on, false)}</button>`
  const body = () => {
    const secs = POCKETS.filter(([h]) => !only || only.includes(h)).map(([h, l]) => [h, l.filter((p) => !q || p[1].toLowerCase().includes(q.toLowerCase()))]).filter(([, l]) => l.length)
    return `<label class="mx-4 mb-3 flex h-11 items-center gap-2.5 rounded-xl bg-[var(--color-brand-elevated)] px-3.5 ${MUTED}">${ICON('search', 'size-[18px] shrink-0')}<input data-pq type="search" value="${esc(q)}" placeholder="Search pockets" aria-label="Search pockets" class="min-w-0 flex-1 bg-transparent text-[0.9375rem] text-[var(--color-brand-text-primary)] outline-none placeholder:text-[var(--color-brand-text-muted)]"></label>${secs.map(([h, l]) => `${sectionHead(`${h} · ${l.length}`).replace('pt-1', 'pt-3')}<div class="mx-4 divide-y divide-[var(--color-brand-border)] overflow-hidden ${CARDBOX}">${l.map(row).join('')}</div>`).join('') || `<p class="py-10 text-center text-sm ${MUTED}">No pocket called “${esc(q)}”</p>`}<div class="mx-4 mt-3"><button type="button" data-pk="new" class="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[0.875rem] font-semibold text-[var(--color-brand-primary-ink)] hover:bg-[var(--color-brand-primary-soft)]">${ICON('plus', 'size-4')}New ${only ? 'goal' : 'pocket'}</button></div>`
  }
  const sh = ltSheet(S, only ? 'Which goal?' : 'Which pocket?', only ? 'Your goals and how far each one is' : '9 pockets, grouped by what they’re for', body(), '', 220)
  sh.el.addEventListener('input', (e) => { if (!e.target.matches('[data-pq]')) return; q = e.target.value; sh.body.innerHTML = body(); const i = sh.body.querySelector('[data-pq]'); i.focus(); i.setSelectionRange(q.length, q.length) })
  sh.el.addEventListener('click', (e) => { const b = e.target.closest('[data-pk]'); if (!b) return; if (b.dataset.pk === 'new') return toast(S, 'Opens New pocket'); sh.close(); done(b.dataset.pk) })
}
/* account picker with "Outside buddget" on top */
function ltAcctPick(S, on, done) {
  let q = ''
  const top = () => (q ? '' : `<div class="mx-4 mb-3 overflow-hidden ${CARDBOX}"><button type="button" data-pm="outside" class="flex min-h-[56px] w-full items-center gap-3 px-4 text-start"><span aria-hidden="true" class="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--color-brand-elevated)] ${SECOND}">${ICON('arrow-left-right', 'size-5')}</span><span class="min-w-0 flex-1"><span class="block text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">Outside buddget</span><span class="block text-xs ${SECOND}">Already had it, or paid from money you don’t track</span></span>${tick(on === 'outside', false)}</button></div>`)
  const body = () => { const b = pmBody(new Set([on]), false, q); const i = b.indexOf('</label>') + 8; return b.slice(0, i) + top() + b.slice(i) }
  const sh = ltSheet(S, 'Paid from', 'Your accounts and cards', body(), '', 220)
  sh.el.addEventListener('input', (e) => { if (!e.target.matches('[data-pmq]')) return; q = e.target.value; sh.body.innerHTML = body(); const i = sh.body.querySelector('[data-pmq]'); i.focus(); i.setSelectionRange(q.length, q.length) })
  sh.el.addEventListener('click', (e) => { const b = e.target.closest('[data-pm]'); if (b) { sh.close(); done(b.dataset.pm) } })
}
/* providers, filtered by the type picked in Add account / Add card */
const PROVS = {
  bank: [['cib', 'CIB', 'Commercial International Bank'], ['nbe', 'NBE', 'National Bank of Egypt'], ['qnb', 'QNB', 'QNB Egypt'], ['bm', 'Banque Misr', ''], ['HS', 'HSBC', 'HSBC Egypt', '#DB0011'], ['AA', 'AAIB', 'Arab African International Bank', '#0A3D7C'], ['BdC', 'Banque du Caire', '', '#00704A'], ['AB', 'Alex Bank', '', '#B0122B'], ['EN', 'Emirates NBD', '', '#072B61'], ['AD', 'ADIB', 'Abu Dhabi Islamic Bank', '#00A0AF']],
  wallet: [['voda', 'Vodafone Cash', 'Mobile wallet'], ['OC', 'Orange Cash', 'Mobile wallet', '#FF7900'], ['e&', 'e& cash', 'Mobile wallet', '#E00800'], ['WE', 'WE Pay', 'Mobile wallet', '#5C2D91'], ['payo', 'Payoneer', 'Online balance'], ['deel', 'Deel', 'Online balance'], ['T', 'Telda', 'Card app', '#111111'], ['mF', 'myFawry', 'Wallet app', '#E0A100']],
}
const provMark = (p, s = 36) => (!p ? '' : PM[p[0]] ? brand(p[0], s) : `<span aria-hidden="true" class="inline-flex shrink-0 items-center justify-center font-bold text-white" style="width:${s}px;height:${s}px;border-radius:${s * 0.32}px;background:${p[3]};font-size:${s * 0.3}px">${p[0]}</span>`)
const provByName = (n) => [...PROVS.bank, ...PROVS.wallet].find((p) => p[1] === n)
function ltProviderPicker(S, kinds, on, done) {
  let q = ''
  const body = () => `<label class="mx-4 mb-3 flex h-11 items-center gap-2.5 rounded-xl bg-[var(--color-brand-elevated)] px-3.5 ${MUTED}">${ICON('search', 'size-[18px] shrink-0')}<input data-prq type="search" value="${esc(q)}" placeholder="Search ${kinds.length > 1 ? 'banks and wallets' : kinds[0] === 'bank' ? 'banks' : 'wallets'}" aria-label="Search" class="min-w-0 flex-1 bg-transparent text-[0.9375rem] text-[var(--color-brand-text-primary)] outline-none placeholder:text-[var(--color-brand-text-muted)]"></label>${kinds.map((k) => { const l = PROVS[k].filter((p) => !q || p[1].toLowerCase().includes(q.toLowerCase())); return l.length ? `${kinds.length > 1 ? sectionHead(k === 'bank' ? 'Banks' : 'Wallets').replace('pt-1', 'pt-3') : ''}<div class="mx-4 divide-y divide-[var(--color-brand-border)] overflow-hidden ${CARDBOX}">${l.map((p) => `<button type="button" data-pr="${esc(p[1])}" role="radio" aria-checked="${p[1] === on}" class="flex min-h-[56px] w-full items-center gap-3 px-4 py-2 text-start">${provMark(p)}<span class="min-w-0 flex-1"><span class="block text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${p[1]}</span>${p[2] ? `<span class="block truncate text-xs ${MUTED}">${p[2]}</span>` : ''}</span>${tick(p[1] === on, false)}</button>`).join('')}</div>` : '' }).join('')}<div class="mx-4 mt-3"><button type="button" data-pr="other" class="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[0.875rem] font-semibold text-[var(--color-brand-primary-ink)] hover:bg-[var(--color-brand-primary-soft)]">${ICON('plus', 'size-4')}Not listed? Add it by name</button></div>`
  const sh = ltSheet(S, kinds.length > 1 ? 'Bank or wallet' : kinds[0] === 'bank' ? 'Choose your bank' : 'Choose your wallet', kinds.length > 1 ? '' : `Only ${kinds[0] === 'bank' ? 'banks' : 'wallets'} show here`, body(), '', 220)
  sh.el.addEventListener('input', (e) => { if (!e.target.matches('[data-prq]')) return; q = e.target.value; sh.body.innerHTML = body(); const i = sh.body.querySelector('[data-prq]'); i.focus(); i.setSelectionRange(q.length, q.length) })
  sh.el.addEventListener('click', (e) => { const b = e.target.closest('[data-pr]'); if (!b) return; if (b.dataset.pr === 'other') return toast(S, 'Type the name; Buddgy matches its messages by name'); sh.close(); done(b.dataset.pr) })
}
/* spending categories a budget line tracks */
const LEDGER = [['Internet', 'plug'], ['Telecom', 'smartphone'], ['Electricity', 'zap'], ['Water', 'plug'], ['Gas', 'zap'], ['Streaming', 'sparkles']]
function ltCatMulti(S, set, done) {
  const sel = new Set(set)
  const body = () => `<div class="mx-4 divide-y divide-[var(--color-brand-border)] overflow-hidden ${CARDBOX}">${LEDGER.map(([n, ic]) => `<button type="button" data-cm="${n}" role="checkbox" aria-checked="${sel.has(n)}" class="flex min-h-[56px] w-full items-center gap-3 px-4 text-start"><span aria-hidden="true" class="flex size-9 shrink-0 items-center justify-center rounded-[11px]" style="background:var(--cat-utilities-bg);color:var(--cat-utilities-fg)">${ICON(ic, 'size-[18px]')}</span><span class="min-w-0 flex-1 text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${n}</span>${tick(sel.has(n), true)}</button>`).join('')}</div>`
  const sh = ltSheet(S, 'Which spending goes here?', 'Expenses in these categories fill this line', body(), btn('primary', 'block', 'Done', 'data-dd'), 220)
  sh.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cm]'); if (b) { sel.has(b.dataset.cm) ? sel.delete(b.dataset.cm) : sel.add(b.dataset.cm); sh.body.innerHTML = body(); return }
    if (e.target.closest('[data-dd]')) { sh.close(); done([...sel]) }
  })
}

/* ---------- big card face: the app's CardFace (340×214, radius 13), drawn at 340 and scaled ---------- */
const NOISE = (lt) => `url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 ${lt ? 1 : 0} 0 0 0 0 ${lt ? 1 : 0} 0 0 0 0 ${lt ? 1 : 0} 0 0 0 ${lt ? 0.14 : 0.12} 0'/%3E%3C/filter%3E%3Crect width='96' height='96' filter='url(%23n)'/%3E%3C/svg%3E&quot;)`
function bigCard(k, w = 300) {
  const p = typeof k === 'string' ? PM[k] : k
  const [a, b, lt] = THEMES[p.theme]
  const metal = p.style === 'metal'
  const sc = w / 340
  const ink = lt ? '#FFFFFF' : '#04201C'
  const bg = `${metal ? `${NOISE(lt)}, repeating-linear-gradient(90deg, rgba(0,0,0,${lt ? 0.16 : 0.05}) 0 1px, transparent 1px 5px), repeating-linear-gradient(90deg, rgba(255,255,255,${lt ? 0.04 : 0.2}) 0 1px, transparent 1px 3px), ` : ''}linear-gradient(135deg, ${a} 0%, ${b} 100%)`
  const line = lt ? 'rgba(255,255,255,.07)' : 'rgba(4,32,28,.07)'
  const eng = metal ? (lt ? '0 1px 0 rgba(0,0,0,.8), 0 -1px 0 rgba(255,255,255,.08)' : '0 1px 0 rgba(255,255,255,.55)') : (lt ? '0 1px 0 rgba(0,0,0,.45), 0 -1px 0 rgba(255,255,255,.16)' : '0 1px 0 rgba(255,255,255,.5)')
  const chip = metal ? (lt ? 'linear-gradient(135deg, #a3a7ad, #5e6166)' : CHIPS.metalOnLight) : CHIPS.gold
  const num = `•••• •••• •••• ${p.last4 || '••••'}`
  return `<div dir="ltr" data-card-face="big" data-theme="${p.theme}" class="relative mx-auto shrink-0 text-start" style="width:${w}px;height:${Math.round(214 * sc)}px"><div class="absolute left-0 top-0 box-border flex flex-col overflow-hidden" style="width:340px;height:214px;padding:18px 20px;border-radius:13px;color:${ink};background:${bg};box-shadow:0 24px 40px -18px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,${lt ? '.14' : '.55'}), inset 0 -1px 0 rgba(0,0,0,.25);transform:scale(${sc});transform-origin:top left">${metal ? '' : `<svg class="absolute left-0 top-0" width="340" height="214" viewBox="0 0 340 214" aria-hidden="true">${[150, 161, 172, 183].map((y) => `<path d="M-10 ${y} C60 ${y - 40}, 120 ${y + 40}, 200 ${y - 10} S300 ${y - 60}, 360 ${y - 30}" fill="none" stroke="${line}" stroke-width="1"/>`).join('')}<circle cx="300" cy="30" r="92" fill="${line}"/></svg>`}<i aria-hidden="true" class="absolute inset-0" style="background:${metal ? 'linear-gradient(115deg, transparent 30%, rgba(255,255,255,.12) 46%, transparent 62%)' : 'radial-gradient(120% 90% at 85% 8%, rgba(255,255,255,.12), transparent 60%)'}"></i><div class="relative flex min-h-[34px] items-start justify-between gap-2.5"><div class="min-w-0"><span class="block truncate font-bold" style="font-size:${metal ? 12 : 15}px;letter-spacing:${metal ? '.16em' : '.01em'};text-transform:${metal ? 'uppercase' : 'none'};text-shadow:${eng}">${p.bank}</span><span class="mt-0.5 block text-[0.59375rem] font-bold uppercase tracking-[0.16em]" style="text-shadow:${eng}">${p.kind}</span></div><span class="font-mono-numbers text-[0.6875rem] font-semibold" style="text-shadow:${eng}">${p.cur || 'EGP'}</span></div><div class="relative mt-4 flex items-center gap-3"><i aria-hidden="true" class="h-[34px] w-11 shrink-0 rounded-md" style="background:${chip};box-shadow:inset 0 0 0 1px rgba(0,0,0,.28)"></i>${'<svg width="18" height="22" viewBox="0 0 18 22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M3 7.5c1.2 2.2 1.2 4.8 0 7"/><path d="M7 5c2 3.6 2 8.4 0 12"/><path d="M11 2.5c2.8 5.2 2.8 11.8 0 17"/></svg>'}</div><div class="relative mt-auto"><span class="block whitespace-nowrap font-mono-numbers font-medium" style="font-size:17px;letter-spacing:.14em;text-shadow:${eng}">${num}</span><div class="mt-2 flex min-h-[30px] items-end justify-between gap-2.5"><span class="truncate font-mono-numbers text-[0.8125rem] font-semibold uppercase tracking-[0.14em]" style="color:${lt ? 'rgba(255,255,255,.88)' : 'rgba(4,32,28,.82)'};text-shadow:${lt ? '0 1px 0 rgba(0,0,0,.75), 0 -1px 0 rgba(255,255,255,.22), 0 0 1px rgba(0,0,0,.4)' : '0 1px 0 rgba(255,255,255,.7), 0 -1px 0 rgba(0,0,0,.25)'}">${p.holder ?? ''}</span></div></div></div></div>`
}
/* the Add card preview floats above the sheet, like the app's PaymentMethodSetupSheet */
function floatCard(S, sh, html) {
  if (!sh.float) {
    sh.float = document.createElement('div')
    sh.float.setAttribute('aria-hidden', 'true')
    sh.float.className = 'pointer-events-none fixed inset-x-0 top-[78px] flex justify-center transition-opacity duration-200'
    sh.float.style.zIndex = (+sh.el.style.zIndex || 140) + 1
    sh.el.style.setProperty('max-height', `${(S.vp.clientHeight || 844) - 300}px`, 'important')
    sh.el.after(sh.float)
    setTimeout(() => { const t = setInterval(() => { if (!sh.el.isConnected || (sh.el.style.transform && sh.el.style.transform !== 'none')) { sh.float.remove(); clearInterval(t) } }, 60) }, 400)
  }
  sh.float.innerHTML = html
}

/* ================= Flow sheets ================= */
AFTER.deposit = (S) => {
  const c = { title: 'Into CIB savings certificate', iconHTML: pocketMark(POCKET.cert, 52), sign: '+', amt: '5,000', cur: 'EGP', day: 28, time: '12:00', line: (v) => `96,940 → ${f0(96940 + v)} after this`, cta: 'Add money', done: 'Money added' }
  c.rows = [{ k: 'Into', v: pocketV('cert'), fn: (S2, r, redraw) => ltPocketPicker(S, r.pk || 'cert', (k) => { r.pk = k; r.v = pocketV(k); c.title = `Into ${POCKET[k][1]}`; c.iconHTML = pocketMark(POCKET[k], 52); redraw() }) }, { k: 'From', pm: 'cib' }]
  ltTx(S, c)
}
AFTER.goal = (S) => {
  const c = { title: 'Umrah 2027', iconHTML: pocketMark(POCKET.umrah, 52), sign: '+', amt: '2,000', cur: 'EGP', day: 28, time: '12:00', line: (v) => `${f0(Math.max(0, 48000 - 18000 - v))} left to reach 48,000`, note: false, cta: 'Add to goal', done: 'Added to Umrah 2027' }
  c.rows = [{ k: 'Goal', v: pocketV('umrah'), fn: (S2, r, redraw) => ltPocketPicker(S, r.pk || 'umrah', (k) => { r.pk = k; r.v = pocketV(k); c.title = POCKET[k][1]; c.iconHTML = pocketMark(POCKET[k], 52); redraw() }, ['Goals']) }, { k: 'From', pm: 'nbe' }]
  ltTx(S, c)
}
const SUB_ST = [['positive', 'Active', 'charged Oct 2, next Nov 2'], ['brand', 'Trial', 'free until Nov 2, then 9.99 USD'], ['warning', 'Payment due', 'no charge seen for Nov 2 yet; Buddgy asks if you paid'], ['danger', 'Needs renewal', 'no charge for 2 cycles; Buddgy asks if you cancelled'], ['muted', 'Cancelled', 'ended Oct 2; past charges stay in Flow']]
AFTER.sub = (S) => {
  let si = 0
  ltTx(S, { title: 'Netflix', titleTop: true, iconHTML: NFLX(52), sign: MINUS, amt: '9.99', cur: 'USD', dateLabel: 'Next charge · Nov 2', del: true, delTitle: 'Delete Netflix?', delText: 'It leaves Subscriptions and its reminders stop. Past charges stay in Flow.', line: () => `Monthly · ${SUB_ST[si][2]}`, badge: () => `<button type="button" data-a="badge" aria-label="Status: ${SUB_ST[si][1]}. Tap to see the next status" class="mt-2.5">${badge(SUB_ST[si][0], SUB_ST[si][1])}</button>`, onBadge: () => { si = (si + 1) % SUB_ST.length }, rows: [{ k: 'Paid with', pm: 'cibcc' }, { k: 'Category', v: 'Entertainment' }, { k: 'Repeats', v: 'Every month' }, { k: 'Remind me', help: 'A day before each charge', sw: true }], extra: `${sectionHead('Last charges').replace('px-5 pb-2 pt-1', 'px-5 pb-2 pt-5')}<div class="mx-4 ${CARDBOX} px-4 py-1">${[['Oct 2', '494.01', '$9.99'], ['Sep 2', '489.50', '$9.99'], ['Aug 2', '486.20', '$9.99']].map(([d, e, u]) => `<div class="flex items-baseline justify-between py-2 text-[0.84375rem]"><span class="${SECOND}">${d}</span><span class="font-mono-numbers text-[var(--color-brand-text-primary)]">${MINUS}${e} EGP <span class="${MUTED}">· ${u}</span></span></div>`).join('')}</div><p class="mx-5 mt-3 text-xs ${MUTED}">Tap the status to see the others. Buddgy sets it from your bank messages; there is no pause button.</p>`, note: false, cta: 'Save changes', done: 'Changes saved' })
}

/* ================= Accounts ================= */
function ltAcctSheet(S, id) {
  const a = acctData(id)
  let v = fa(a.bal)
  const el = document.createElement('div')
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', a.name)
  el.className = PANEL
  const sh = openSheet(S, el)
  const draw = () => {
    const diff = Math.round((num4(v) - a.bal) * 100) / 100
    el.innerHTML = `${GRAB}<div class="flex shrink-0 items-center gap-3 px-4 pb-1">${a.cash ? CASHMARK(36) : brand('cib', 36)}<span class="min-w-0 flex-1"><span class="block truncate text-base font-bold text-[var(--color-brand-text-primary)]">${a.name}</span><span class="block truncate text-xs ${SECOND}">${a.sub}</span></span><button type="button" data-a="menu" aria-label="More actions" class="${CLOSE_BTN}">${ICON('ellipsis-vertical', 'size-4')}</button><button type="button" data-a="close" aria-label="Close sheet" class="${CLOSE_BTN}">${ICON('x', 'size-4')}</button></div>
    <div class="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pb-5">
      <div class="flex flex-col items-center px-5 pb-4 pt-4 text-center"><p class="text-[0.8125rem] font-medium ${SECOND}">${a.cash ? 'Cash, an estimate' : 'Balance'}</p><div class="mt-1.5 flex items-baseline justify-center gap-1.5"><label class="flex items-baseline font-mono-numbers text-[2.5rem] font-semibold leading-none tracking-[-0.04em] tabular-nums text-[var(--color-brand-text-primary)]"><input data-bal inputmode="decimal" aria-label="Balance" value="${esc(v)}" class="bg-transparent text-center outline-none" style="width:2ch"></label>${unit4(a.cur)}</div><p class="mt-2 text-[0.8125rem] ${diff ? 'font-semibold text-[var(--color-brand-amber)]' : SECOND}">${diff ? `${diff > 0 ? '+' : MINUS}${fa(Math.abs(diff))} vs buddget · saved as a correction, never as spending` : a.cash ? 'Tap the amount when you count your cash' : 'Tap the amount to correct it'}</p>${a.aside ? `<div class="mt-4 w-full"><div class="h-1.5 rounded-full bg-[var(--color-brand-sunken)]"><div class="h-full rounded-full bg-[var(--color-brand-primary)]" style="width:88%"></div></div><div class="mt-2 flex justify-between text-xs ${SECOND}"><span><b class="font-mono-numbers font-semibold text-[var(--color-brand-text-primary)]">${f0(a.free)}</b> free</span><span><b class="font-mono-numbers font-semibold text-[var(--color-brand-text-primary)]">${f0(a.aside)}</b> set aside</span></div></div>` : ''}</div>
      <div class="mx-4 grid ${a.cash ? 'grid-cols-1' : 'grid-cols-3'} gap-2">${[['banknote', 'Cash out', 'cashout'], ['landmark', 'Set aside', 'aside'], ['wallet', 'Add card', 'addcard']].filter((x, j) => !a.cash || j === 1).map(([ic, l, k]) => `<button type="button" data-a="${k}" class="${BTN_CORE} h-11 gap-1.5 rounded-full border-[var(--color-brand-border)] bg-[var(--color-brand-card)] text-[0.84375rem] font-semibold text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-elevated)]">${ICON(ic, 'size-4')}${l}</button>`).join('')}</div>
      ${a.cash ? '' : `<div class="mx-4 mt-3 flex items-center gap-3 rounded-2xl bg-[var(--color-brand-elevated)] px-3.5 py-3"><span class="size-2 shrink-0 rounded-full bg-[var(--color-brand-green)]"></span><span class="min-w-0 flex-1"><span class="block text-sm font-semibold text-[var(--color-brand-text-primary)]">Matches your bank's last SMS</span><span class="block text-xs ${MUTED}">from 18:42 · SMS said <span class="font-mono-numbers">${fa(a.bal)}</span></span></span></div>`}
      <div class="mx-4 mt-3 grid grid-cols-2 divide-x divide-[var(--color-brand-border)] rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)]"><div class="px-3.5 py-3"><p class="text-xs font-semibold ${SECOND}">In this month</p><p class="font-mono-numbers text-base font-semibold text-[var(--color-brand-green)]">+31,500</p></div><div class="px-3.5 py-3"><p class="text-xs font-semibold ${SECOND}">Out this month</p><p class="font-mono-numbers text-base font-semibold text-[var(--color-brand-text-primary)]">${MINUS}8,230</p></div></div>
      ${a.cash ? '' : `${sectionHead(`Cards · ${a.cards.length}`).replace('pt-1', 'pt-5')}<div class="hide-scrollbar flex gap-2 overflow-x-auto px-5 py-1">${a.cards.map((k) => `<button type="button" data-ck="${k}">${mini(k)}</button>`).join('')}<button type="button" data-a="addcard" aria-label="Add a card" class="flex h-14 w-[88px] shrink-0 items-center justify-center rounded-[7px] border-[1.5px] border-dashed border-[var(--color-brand-border-strong)] ${MUTED}">${ICON('plus', 'size-5')}</button></div>`}
      ${sectionHead('Recent').replace('pt-1', 'pt-5')}<div class="mx-4 overflow-hidden ${CARDBOX}">${miniTx(RECENT_TX)}</div>
    </div>${diff ? `<div class="shrink-0 border-t border-[var(--color-brand-border)] px-4 pb-[22px] pt-3"><div class="flex gap-2">${btn('outline', 'cta', 'Cancel', 'data-a="cancel"')}<button type="button" data-a="setbal" class="${BTN.primary} ${SZ.block}">Set balance to ${fa(num4(v))}</button></div></div>` : ''}`
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
    if (k === 'aside') return AFTER.setaside(S)
    if (k === 'addcard') return ltAddCard(S, 'Debit')
    if (k === 'cancel') { v = fa(a.bal); return draw() }
    if (k === 'setbal') { sh.close(); toast(S, `Balance set to ${fa(num4(v))}`) }
  })
}
function ltCardSheet(S, k) {
  const p = PM[k]
  const credit = p.kind === 'Credit'
  let def = k === 'cib'
  const body = () => `<div class="px-4 pt-1">${bigCard(p, 320)}</div>
    ${credit ? `<div class="mx-4 mt-5 ${CARDBOX} p-4"><div class="flex items-baseline justify-between"><span class="text-[0.8125rem] font-medium ${SECOND}">Owed</span><span class="font-mono-numbers text-[1.5rem] font-semibold tracking-[-0.03em] text-[var(--color-brand-red-text)]">8,420 <span class="text-xs font-medium ${MUTED}">EGP</span></span></div><div class="mt-2.5 h-1.5 rounded-full bg-[var(--color-brand-sunken)]"><div class="h-full w-[28%] rounded-full bg-[var(--color-brand-red)]"></div></div><p class="mt-2 text-xs ${SECOND}"><b class="font-mono-numbers font-semibold text-[var(--color-brand-text-primary)]">21,580</b> available of 30,000 · due on the 15th</p></div>` : ''}
    <div class="mx-4 mt-3 divide-y divide-[var(--color-brand-border)] overflow-hidden ${CARDBOX}">
      ${credit ? '' : `<button type="button" data-c="acct" class="flex min-h-[52px] w-full items-center gap-3 px-4 text-start"><span class="w-[104px] shrink-0 text-[0.84375rem] ${SECOND}">Uses</span><span class="flex flex-1 items-center justify-end gap-2 text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]">${brand('cib', 24)}CIB Current <span class="font-mono-numbers ${MUTED}">••1234</span>${CHEV}</span></button>`}
      <button type="button" data-c="def" role="switch" aria-checked="${def}" class="flex min-h-[52px] w-full items-center gap-3 px-4 text-start"><span class="min-w-0 flex-1 text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]">Default for new expenses</span><span aria-hidden="true" class="relative h-[26px] w-[44px] shrink-0 rounded-full ${def ? 'bg-[var(--color-brand-primary)]' : 'bg-[var(--color-brand-border-strong)]'}"><span class="absolute top-[3px] size-5 rounded-full bg-white" style="inset-inline-start:${def ? 21 : 3}px"></span></span></button>
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
const emptyCards = (act) => `${sectionHead('Cards').replace('pt-1', 'pt-5')}<div class="mx-4 ${CARDBOX}"><button type="button" data-v="${act}" class="flex min-h-11 w-full items-center gap-3 px-3 py-3 text-start"><span class="flex h-14 w-[88px] shrink-0 items-center justify-center rounded-[7px] border-[1.5px] border-dashed border-[var(--color-brand-border-strong)] ${MUTED}">${ICON('plus', 'size-5')}</span><span class="min-w-0 flex-1"><span class="block text-[0.9375rem] font-semibold text-[var(--color-brand-primary-ink)]">Add a card</span><span class="block text-xs ${MUTED}">Debit, credit or prepaid on this account. You can add it later.</span></span></button></div>`
const defName = (prov, last4, extra = '') => (prov ? `${prov}${extra}${last4 ? ` ••${last4}` : ''}` : '')
const acctNote = (st) => (st.name ? `Shows as “${esc(st.name)}”. Messages still match by ${st.prov || 'the provider'} and the last 4.` : `Leave the name empty and it shows as ${defName(st.prov || 'CIB', st.last4 || '1234')}. No digits? Buddgy asks you once, when the first message arrives.`)
function ltAddAccount(S) {
  return form4(S, {
    title: 'Add an account', state: { kind: 'bank', prov: '', last4: '', name: '', cur: 'EGP', amt: '' },
    body: (st) => `${seg4('kind', [['bank', 'Bank'], ['wallet', 'Wallet']], st.kind)}${hero4({ amt: st.amt, ctl: ctl4('cur', st.cur), label: 'Balance today', line: st.kind === 'bank' ? 'From your banking app or your last SMS' : 'What the wallet app shows now' })}
      ${grp4([row4(st.kind === 'bank' ? 'Bank' : 'Wallet', st.prov ? `${provMark(provByName(st.prov), 24)}${st.prov}` : `<span class="${MUTED}">Choose</span>`, 'prov'), tiles4(st.last4, st.kind === 'bank' ? 'Matches your bank messages to this account' : 'The last 4 of the wallet number'), in4('name', 'Name', defName(st.prov, st.last4) || 'Optional', st.name)])}
      ${emptyCards('card')}`,
    foot: () => foot4('Add account'), done: 'Account added',
    onChange: (st) => { const p = provByName(st.prov); if (p && !PROVS[st.kind].includes(p)) st.prov = '' },
    onInput: (f, st, s) => { if (f.dataset.in === 'last4' || f.dataset.in === 'name') { s.el.querySelector('[data-in="name"]').placeholder = defName(st.prov, st.last4) || 'Optional' } },
    on: { prov: (v, draw, st) => ltProviderPicker(S, [st.kind], st.prov, (p) => { st.prov = p; draw() }), card: () => ltAddCard(S, 'Debit') },
  })
}
const SWATCH = ['teal', 'blackMetal', 'midnight', 'emerald', 'titanium', 'burgundy', 'plum', 'copper', 'sunset', 'glacier']
function ltAddCard(S, type = 'Debit') {
  const prev = (st) => ({ bank: st.prov || 'CIB', kind: st.type, last4: st.last4, theme: st.theme, style: st.style, cur: 'EGP' })
  return form4(S, {
    title: type === 'Credit' ? 'Add a credit card' : 'Add a card', z: 140, state: { type, prov: 'CIB', last4: '', name: '', theme: type === 'Credit' ? 'blackMetal' : 'teal', style: type === 'Credit' ? 'metal' : 'bank', def: false, limit: '', owed: '', due: 15 },
    after: (st, s) => floatCard(S, s, bigCard(prev(st), 280)),
    body: (st) => `${seg4('type', [['Debit', 'Debit'], ['Credit', 'Credit'], ['Prepaid', 'Prepaid']], st.type)}
      ${grp4([row4('Bank or wallet', st.prov ? `${provMark(provByName(st.prov), 24)}${st.prov}` : `<span class="${MUTED}">Choose</span>`, 'prov'), tiles4(st.last4, 'Matches card messages to this card'), in4('name', 'Name', defName(st.prov, st.last4, ` ${st.type}`) || 'Optional', st.name), st.type === 'Credit' ? '' : row4('Uses', `${brand('cib', 24)}CIB Current <span class="font-mono-numbers ${MUTED}">••1234</span>`, 'uses')])}
      ${st.type === 'Credit' ? grp4([in4('limit', 'Limit', '30,000', st.limit, 'decimal'), in4('owed', 'Owed now', '8,420', st.owed, 'decimal'), pick4('Due day', ORD(st.due), 'due', 'calendar')], 'Credit', 'What you owe counts as debt until it’s paid.') : ''}
      ${sectionHead('Look').replace('pt-1', 'pt-5')}<div class="mx-4 ${CARDBOX} p-3"><div class="inline-flex w-full gap-0.5 rounded-xl bg-[var(--color-brand-elevated)] p-[3px]">${[['metal', 'Metal'], ['bank', 'Classic']].map(([v, l]) => `<button type="button" data-v="set:style:${v}" class="${st.style === v ? SEG_ON : SEG_OFF}">${l}</button>`).join('')}</div><div class="mt-3 flex flex-wrap justify-between gap-y-1">${SWATCH.map((t) => `<button type="button" data-v="set:theme:${t}" aria-label="${t}" aria-pressed="${st.theme === t}" class="flex size-11 items-center justify-center rounded-full"><span class="size-8 rounded-full ${st.theme === t ? 'ring-2 ring-[var(--color-brand-primary)] ring-offset-2 ring-offset-[var(--color-brand-card)]' : ''}" style="background:linear-gradient(135deg, ${THEMES[t][0]}, ${THEMES[t][1]})"></span></button>`).join('')}</div></div>
      ${grp4([sw4('def', 'Default for new expenses', '', st.def)])}`,
    foot: (st) => foot4(st.type === 'Credit' ? 'Add credit card' : 'Add card'), done: 'Card added',
    onInput: (f, st, s) => { if (f.dataset.in === 'last4') s.float.innerHTML = bigCard(prev(st), 280); if (f.dataset.in === 'last4' || f.dataset.in === 'name') s.el.querySelector('[data-in="name"]').placeholder = defName(st.prov, st.last4, ` ${st.type}`) || 'Optional' },
    on: { prov: (v, draw, st) => ltProviderPicker(S, ['bank', 'wallet'], st.prov, (p) => { st.prov = p; draw() }), uses: () => toast(S, 'Opens the account list'), due: (v, draw, st) => ltDayPicker(S, 'Due day', st.due, (d) => { st.due = d; draw() }) },
  })
}
AFTER.cashout = (S) => ltTx(S, { title: 'Cash out', icon: ['banknote', ...IC.green], sign: '', amt: '2,000', cur: 'EGP', lockCur: true, day: 28, time: '12:00', line: (v) => `CIB Current becomes ${f0(Math.max(0, 120425 - v))}`, rows: [{ k: 'From', pm: 'cib' }, { k: 'To', v: `${CASHMARK(24)}Cash on hand`, static: true }], note: false, cta: 'Withdraw 2,000', done: 'Moved to Cash' })
AFTER.setaside = (S) => {
  const c = { title: 'Set aside in Trip to Dahab', iconHTML: pocketMark(POCKET.trip, 52), sign: '', amt: '2,000', cur: 'EGP', lockCur: true, day: 28, time: '12:00', line: (v) => `Stays in CIB Current · ${f0(Math.max(0, 105425 - v))} left free to spend`, note: false, cta: 'Set aside', done: 'Set aside' }
  c.rows = [{ k: 'From', v: `${brand('cib', 24)}CIB Current <span class="font-mono-numbers ${MUTED}">••1234</span>`, static: true }, { k: 'Into', v: pocketV('trip'), fn: (S2, r, redraw) => ltPocketPicker(S, r.pk || 'trip', (k) => { r.pk = k; r.v = pocketV(k); c.title = `Set aside in ${POCKET[k][1]}`; c.iconHTML = pocketMark(POCKET[k], 52); redraw() }) }]
  ltTx(S, c)
}
BEFORE.setaside = (S) => bOpen(S, 'Set aside', '', `<div class="inline-flex w-full gap-0.5 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-[3px]"><span class="${SEG_OFF}">Cash out</span><span class="${SEG_ON}">Set aside</span></div>${bLabel('From')}${bField('CIB Current ••1234 · 105,425 free', 'wallet')}${bLabel('Into')}${bField('Trip · 12,000 EGP', 'piggy-bank')}${bLabel('Amount')}<div class="rounded-3xl p-4 text-center" style="background:linear-gradient(135deg,color-mix(in oklab,var(--color-brand-primary) 16%,var(--color-brand-card)),var(--color-brand-card))"><p class="font-mono-numbers text-[30px] font-semibold">2,000</p></div><p class="mt-2 text-sm ${SECOND}">Free to spend becomes 103,425</p>`, `<button type="button" data-done class="${BTN.primary} ${SZ.block}">Set aside 2,000</button>`)
BEFORE.addcard = (S) => bOpen(S, 'Add a card', '', `${bigFace('cibcc', 260)}${bLabel('Type')}${bSeg(['Debit', 'Credit', 'Prepaid'], 1)}${bLabel('Provider')}${bField('CIB', 'landmark')}${bLabel('Identifier')}${bSeg(['None', 'Last 4', 'Label'], 1)}<div class="mt-2">${bInput('', '1234')}</div>${bLabel('Linked account')}${bField('None', 'wallet')}${bLabel('Currency')}${bField('EGP · Egyptian pound', 'coins')}${bLabel('Credit limit')}${bAmount('30,000', 'EGP')}${bLabel('Owed today')}${bAmount('8,420', 'EGP')}${bLabel('Due day')}${bInput('', '15')}${bLabel('Card style')}${bSeg(['Metal', 'Bank'])}${bLabel('Card colour')}<div class="flex flex-wrap gap-2">${SWATCH.slice(0, 8).map((t) => `<span class="size-9 rounded-full" style="background:linear-gradient(135deg, ${THEMES[t][0]}, ${THEMES[t][1]})"></span>`).join('')}</div>${bSwitch('Set as default', 'Used for new expenses', false)}`, `<button type="button" data-done class="${BTN.primary} ${SZ.block}">Add card</button>`)
AFTER.addaccount = (S) => ltAddAccount(S)
AFTER.addcard = (S) => ltAddCard(S, 'Debit')
AFTER.account = (S) => ltAcctSheet(S, 'a1')
AFTER.card = (S) => ltCardSheet(S, 'cibcc')

/* ================= setup sheets ================= */
AFTER.s_line = (S) => form4(S, {
  title: 'Internet', sub: 'Bills · monthly line', lead: TILE('plug', ['var(--cat-utilities-bg)', 'var(--cat-utilities-fg)']), head: H_DEL(), del: ['Delete this line?', 'Its spending stays in Flow, just not counted under Internet.'],
  state: { ess: true, lock: false, due: 5, cats: ['Internet', 'Telecom'] },
  body: (st) => `${heroAmt('450', 'EGP a month', '3% of your income')}${gNote('Sized from your last 3 bills: 430, 450 and 455. <b class="font-semibold">High confidence.</b>')}${grp4([sw4('ess', 'Essential', 'Counts toward your safety net', st.ess), sw4('lock', 'Lock from Buddgy', 'Buddgy will not change it', st.lock), pick4('Due day', ORD(st.due), 'due', 'calendar'), row4('Spending from', `<span class="truncate">${st.cats.join(', ')}</span>`, 'cats')], '', 'Expenses in these categories fill this line.')}`,
  foot: () => foot4('Save'), done: 'Line saved',
  on: { due: (v, draw, st) => ltDayPicker(S, 'Due day', st.due, (d) => { st.due = d; draw() }), cats: (v, draw, st) => ltCatMulti(S, st.cats, (c) => { st.cats = c.length ? c : st.cats; draw() }) },
})
const KARATS = [['24k', '24k', '999 pure · 4,630 a gram'], ['21k', '21k', '875 · 4,050 a gram'], ['18k', '18k', '750 · 3,470 a gram']]
const GRAM = { '24k': 4630, '21k': 4050, '18k': 3470 }
const perPay = (amt, n) => fa(num4(amt) / Math.max(1, n))
const borrowLine = (st) => (st.gold ? `≈ ${f0(num4(st.amt) * GRAM[st.k])} EGP today · ${f0(GRAM[st.k])} a gram of ${st.k}` : st.dir === 'owe' ? `You owe ${esc(st.person || 'them')}` : `${esc(st.person || 'They')} owes you`)
const borrowNote = (st) => `≈ ${perPay(st.amt, st.months)}${st.gold ? ' g' : ''} every ${st.every.toLowerCase()} · ${st.months} payments`
AFTER.s_borrow = (S) => form4(S, {
  title: 'New borrow', state: { dir: 'owe', amt: '12,000', cur: 'EGP', gold: false, k: '21k', person: 'Ahmed', for: '', date: 'Today', arrived: true, plan: true, months: 12, every: 'Month' },
  body: (st) => `${hero4({ amt: st.amt, ctl: st.gold ? `${unit4('g')}${ctl4('karat', st.k, 'Karat')}` : ctl4('cur', st.cur), line: borrowLine(st) })}${seg4('dir', [['owe', 'I owe'], ['owed', 'Owed to me']], st.dir)}
    ${grp4([in4('person', 'Person', 'e.g. Ahmed', st.person), in4('for', 'For', 'e.g. Rent help', st.for), date4('Date', st.date), row4(st.dir === 'owe' ? 'Received in' : 'Paid from', pmV('cib'), 'pm'), st.gold ? '' : sw4('arrived', st.dir === 'owe' ? 'Arrived in CIB now' : 'Left CIB now', `${st.dir === 'owe' ? 'Adds' : 'Takes'} ${st.amt} ${st.dir === 'owe' ? 'to' : 'from'} the balance`, st.arrived), sw4('gold', 'Gold-backed', 'Owed in grams, valued at today’s price', st.gold)])}
    ${grp4([sw4('plan', 'Pay it off by a date', '', st.plan), st.plan ? pick4('Over', `${st.months} months`, 'months') : '', st.plan ? pick4('Every', st.every, 'every', 'repeat') : ''], 'Pay-off plan', st.plan ? borrowNote(st) : '')}`,
  foot: () => foot4('Add borrow'), done: 'Borrow added',
  onChange: (st) => { if (st.gold && num4(st.amt) > 1000) st.amt = '40'; if (!st.gold && num4(st.amt) < 1000) st.amt = '12,000' },
  onInput: (f, st, s) => { if (f.dataset.in === 'amt' || f.dataset.in === 'person') { s.el.querySelector('[data-line]').textContent = borrowLine(st); const n = s.el.querySelector('[data-foot-note]'); if (n) n.textContent = borrowNote(st) } },
  on: { karat: (v, draw, st) => ltOptPicker(S, 'Karat', 'Priced at today’s gram rate', KARATS, st.k, (k) => { st.k = k; draw() }), pm: () => ltMethodPicker(S, 'cib', () => toast(S, 'Account picked')), months: (v, draw, st) => ltNumPicker(S, 'Pay it off over', st.months, [3, 6, 9, 12, 18, 24, 36, 48], (n) => (n === 1 ? 'month' : 'months'), (n) => { st.months = n; draw() }), every: (v, draw, st) => pickEvery(S, st.every, (e) => { st.every = e; draw() }) },
})
const BNPL = [['valU', 'valU', '', ['smartphone', '#00A651', '#fff']], ['Contact', 'Contact', '', ['smartphone', '#E30613', '#fff']], ['Souhoola', 'Souhoola', '', ['smartphone', '#F7931E', '#fff']], ['Aman', 'Aman', '', ['smartphone', '#00467F', '#fff']], ['Sympl', 'Sympl', '', ['smartphone', '#5B2D8E', '#fff']]]
AFTER.s_install = (S) => form4(S, {
  title: 'New installment', state: { mode: 'total', amt: '30,000', cur: 'EGP', item: 'iPhone 16', prov: 'valU', date: 'Sun, 1 Nov', pm: 'cibcc', n: 12, every: 'Month' },
  body: (st) => `${hero4({ amt: st.amt, ctl: ctl4('cur', st.cur), line: st.mode === 'total' ? `≈ ${perPay(st.amt, st.n)} a payment · no interest` : `${f0(num4(st.amt) * st.n)} in total · no interest` })}${seg4('mode', [['total', 'Total price'], ['per', 'Per payment']], st.mode)}
    ${grp4([in4('item', 'Item', 'e.g. iPhone 16', st.item), row4('Provider', `<span class="flex size-6 items-center justify-center rounded-md text-[0.625rem] font-bold text-white" style="background:${BNPL.find((b) => b[0] === st.prov)[3][1]}">${st.prov.slice(0, 2)}</span>${st.prov}`, 'prov'), date4('Starts', st.date), row4('Paid with', pmV(st.pm), 'pm')], '', 'Paid with is the default card for these payments.')}
    ${grp4([pick4('Payments', `${st.n}`, 'n'), pick4('Every', st.every, 'every', 'repeat')], 'Payment plan', `${st.n} × ${st.mode === 'total' ? perPay(st.amt, st.n) : st.amt} · last one in Oct 2027`)}`,
  foot: () => foot4('Add plan'), done: 'Plan added',
  on: { prov: (v, draw, st) => ltOptPicker(S, 'Provider', 'Who you pay the installments to', BNPL, st.prov, (p) => { st.prov = p; draw() }), pm: (v, draw, st) => ltMethodPicker(S, st.pm, (m) => { st.pm = m; draw() }), n: (v, draw, st) => ltNumPicker(S, 'Number of payments', st.n, [3, 6, 9, 12, 18, 24, 36, 60], (n) => (n === 1 ? 'payment' : 'payments'), (n) => { st.n = n; draw() }), every: (v, draw, st) => pickEvery(S, st.every, (e) => { st.every = e; draw() }) },
})
AFTER.s_goal = (S) => {
  const MS = [[25, 'Mar 26', true], [50, 'Jul 26', false], [75, 'Nov 26', false], [100, 'Mar 27', false]]
  const body = `<div class="px-5"><div class="flex items-baseline justify-between"><p><span class="font-mono-numbers text-[40px] font-semibold tracking-[-0.04em] text-[var(--color-brand-text-primary)]">15,000</span> <span class="text-sm ${MUTED}">of 50,000</span></p><b class="font-mono-numbers text-[var(--color-brand-text-primary)]">30%</b></div>
    <div class="relative mt-3 h-2.5 rounded-full bg-[var(--color-brand-sunken)]"><div class="h-full w-[30%] rounded-full bg-[var(--color-brand-primary)]"></div>${MS.slice(0, 3).map(([p, , done]) => `<span aria-hidden="true" class="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--color-brand-card)] ${done ? 'bg-[var(--color-brand-primary)]' : 'bg-[var(--color-brand-border-strong)]'}" style="left:${p}%"></span>`).join('')}</div>
    <div class="mt-3 grid grid-cols-4 gap-2 text-center">${MS.map(([p, d, done]) => `<div class="rounded-xl py-2 ${done ? 'bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)]' : 'bg-[var(--color-brand-elevated)]'}"><b class="flex items-center justify-center gap-1 font-mono-numbers text-sm ${done ? '' : 'text-[var(--color-brand-text-primary)]'}">${done ? ICON('check', 'size-3.5') : ''}${p}%</b><span class="text-[0.6875rem] ${done ? 'font-semibold' : MUTED}">${done ? 'Reached' : d}</span></div>`).join('')}</div>
    <p class="mt-3 text-sm ${SECOND}">Next checkpoint: 50% in about 4 months.</p>
    ${bCard(`<b class="block text-sm text-[var(--color-brand-text-primary)]">Behind for 2 months</b><p class="text-xs ${SECOND}">1,500 short of plan since Aug. Two ways back:</p><div class="mt-2 flex items-center justify-between text-sm text-[var(--color-brand-text-primary)]">Move the date to Jun 2027 ${btn('outline', 'sm', 'Move date', 'data-toast="Date moved to Jun 2027"')}</div><div class="mt-2 flex items-center justify-between text-sm text-[var(--color-brand-text-primary)]">Keep Mar 2027 ${btn('outline', 'sm', 'Raise', 'data-toast="Each month raised to 2,400"')}</div>`)}
    <div class="mt-4 divide-y divide-[var(--color-brand-border)] rounded-2xl border border-[var(--color-brand-border)]">${[['Finish line', 'Mar 2027'], ['Each month', '2,000 · 20% of savings'], ['Pocket', 'Trip · 15,000 EGP']].map(([k, v]) => `<button type="button" data-toast="Opens ${k.toLowerCase()}" class="flex min-h-14 w-full items-center justify-between px-4 text-sm text-[var(--color-brand-text-primary)]"><span>${k}</span><span class="flex items-center gap-1 font-mono-numbers">${v}${CHEV}</span></button>`).join('')}</div></div>`
  form4(S, { title: 'Trip to Dahab', sub: `Save for · Travel ${badge('positive', 'On track')}`, head: H_DEL(), del: ['Delete Trip to Dahab?', 'Its 15,000 stays in your savings, no longer set for this goal. This can’t be undone.'], body: () => body, foot: () => foot4('Add money'), done: 'Opens Add money' })
}
AFTER.s_zakat = (S) => form4(S, {
  title: 'Zakat', sub: 'This year ends 12 Mar', head: H_GEAR(),
  body: () => `${heroAmt('1,250', 'EGP due', '2.5% of 50,000 · above the nisab of 42,000', ['coins', 'color-mix(in oklab, var(--color-brand-gold) 18%, var(--color-brand-card))', 'var(--color-brand-gold)'])}${grp4([['Cash and savings', '38,000', 'Wealth · Savings'], ['Gold · 18 g', '12,000', 'Wealth · Gold'], ['Stocks · 30%', '4,000', 'Wealth · Stocks'], ['Debts due', `${MINUS}4,000`, 'Debts']].map(([k, v, w]) => `<button type="button" data-toast="Opens ${w}, where you edit it" class="flex min-h-[52px] w-full items-center gap-3 px-4 text-start hover:bg-[var(--color-brand-elevated)]"><span class="min-w-0 flex-1 text-[0.84375rem] ${SECOND}">${k}</span><span class="font-mono-numbers text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]">${v}</span>${CHEV}</button>`).concat(row4('Zakatable', '<b class="font-mono-numbers">50,000</b>')), 'What counts', 'These come from Wealth and Debts. Tap one to change it there.')}`,
  foot: () => foot4('Mark as paid'), done: 'Zakat marked as paid',
  on: { settings: () => ltZakatSettings(S) },
})
function ltZakatSettings(S) {
  form4(S, {
    title: 'Zakat settings', z: 200, state: { nisab: 'gold', stocks: 'long', date: '12 Mar' },
    body: (st) => `${grp4([pick4('Nisab basis', st.nisab === 'gold' ? 'Gold · 85 g' : 'Silver · 595 g', 'nisab'), pick4('Stocks held', st.stocks === 'long' ? 'Long-term · 30%' : 'Trading · 100%', 'stocks'), date4('Year starts', st.date, 'ystart')], '', 'Your zakat year starts on the day your wealth first reached the nisab, so it is different for everyone. Many people pick a date that is easy to remember, like 1 Ramadan.')}`,
    foot: () => foot4('Done'), done: 'Settings saved',
    on: { nisab: (v, draw, st) => ltOptPicker(S, 'Nisab basis', 'The minimum before zakat is due', [['gold', 'Gold · 85 g', '≈ 42,000 EGP today'], ['silver', 'Silver · 595 g', '≈ 31,000 EGP today · lower, so more people pay']], st.nisab, (x) => { st.nisab = x; draw() }), stocks: (v, draw, st) => ltOptPicker(S, 'How you hold stocks', '', [['long', 'Long-term', '30% of the value counts'], ['trade', 'For trading', '100% counts']], st.stocks, (x) => { st.stocks = x; draw() }), ystart: (v, draw, st) => ltDate(S, { day: 12, time: '00:00' }, (d) => { st.date = `${d} Oct`; draw() }) },
  })
}
AFTER.s_vault = (S) => {
  const D = [['Ahmed', 'Borrow', '15,000', 'Mar 2025', '10 months', [['Jan 5', 'CIB Debit', '2,500'], ['Feb 5', 'CIB Debit', '2,500']]], ['Car repair', 'Borrow', '18,000', 'Jan 2025', '6 months', [['Dec 1', 'Cash', '6,000']]], ['valU · TV', 'Installment', '12,000', 'Oct 2024', '12 payments', [['Oct 1', 'CIB Debit', '1,000']]], ['NBE Titanium', 'Credit card', '9,800', 'Aug 2024', '3 months', [['Aug 15', 'NBE Debit', '4,800']]]]
  form4(S, {
    title: 'Cleared debts', state: { open: '' },
    body: (st) => `<div class="mx-4 overflow-hidden rounded-3xl px-5 pb-5 pt-4" style="background:linear-gradient(150deg, color-mix(in oklab, var(--color-brand-green) 22%, var(--color-brand-card)), color-mix(in oklab, var(--color-brand-green) 8%, var(--color-brand-card)))"><span class="flex size-11 items-center justify-center rounded-full border-2 border-dashed border-[var(--color-brand-green)] text-[var(--color-brand-green)]" style="transform:rotate(-12deg)">${ICON('award', 'size-5')}</span><p class="mt-3 text-[0.8125rem] font-medium ${SECOND}">Paid off so far</p><p class="font-mono-numbers text-[2rem] font-semibold leading-tight tracking-[-0.04em] text-[var(--color-brand-text-primary)]">54,800 <span class="text-sm font-medium ${MUTED}">EGP</span></p><p class="mt-1 text-[0.8125rem] ${SECOND}">4 debts cleared · the last one in Mar 2025</p></div>
      <div class="mx-4 mt-3 grid grid-cols-2 gap-2.5">${D.map(([n, t, v, d, took, h]) => { const o = st.open === n; return `<div class="${o ? 'col-span-2' : ''} rounded-2xl border border-[color-mix(in_oklab,var(--color-brand-green)_28%,transparent)] bg-[var(--color-brand-card)] p-3.5"><div class="flex items-start justify-between"><span class="flex size-9 items-center justify-center rounded-full border-2 border-dashed border-[var(--color-brand-green)] text-[var(--color-brand-green)]" style="transform:rotate(-12deg)">${ICON('check', 'size-4')}</span><span class="text-[0.6875rem] font-semibold text-[var(--color-brand-green)]">${t}</span></div><b class="mt-3 block truncate text-[0.9375rem] text-[var(--color-brand-text-primary)]">${n}</b><p class="font-mono-numbers text-[1.0625rem] font-semibold text-[var(--color-brand-text-primary)]">${v} <span class="text-[0.6875rem] font-medium ${MUTED}">EGP</span></p><p class="text-xs ${MUTED}">Cleared ${d} · in ${took}</p>${o ? `<div class="mt-3 border-t border-[var(--color-brand-border)] pt-2">${h.map(([dd, m, a]) => `<div class="flex justify-between py-1 text-xs ${SECOND}"><span>${dd} · ${m}</span><span class="font-mono-numbers">${MINUS}${a}</span></div>`).join('')}</div>` : ''}<button type="button" data-v="set:open:${o ? '' : n}" class="mt-2 inline-flex h-9 items-center gap-1 text-[0.8125rem] font-semibold text-[var(--color-brand-primary-ink)]">${o ? 'Hide' : 'How you paid'}${ICON(o ? 'chevron-left' : 'chevron-down', 'size-4')}</button></div>` }).join('')}</div>`,
  })
}
const SUBPLANS = { Basic: '3.99', Standard: '7.99', Premium: '9.99' }
AFTER.s_subadd = (S) => form4(S, {
  title: 'Add a subscription', sub: 'Streaming', state: { plan: 'Premium', amt: '9.99', cur: 'USD', date: 'Mon, 2 Nov', every: 'Month', pm: 'cibcc', remind: true },
  body: (st) => `${hero4({ amt: st.amt, ctl: ctl4('cur', st.cur), top: `<div class="mt-1 flex flex-col items-center">${NFLX(72)}<p class="mt-2.5 text-[1.0625rem] font-semibold text-[var(--color-brand-text-primary)]">Netflix</p></div>`, line: `≈ ${f0(num4(st.amt) * RATE[st.cur])} EGP a month · Committed becomes 4,300` })}<div class="mx-4 flex justify-center gap-2">${Object.keys(SUBPLANS).map((p) => `<button type="button" data-v="plan:${p}" class="${OPT_BASE} ${st.plan === p ? OPT_ON : OPT_OFF}">${p}</button>`).join('')}</div><div data-learn ${st.amt === SUBPLANS[st.plan] ? 'hidden' : ''}>${gNote(`Usually ${SUBPLANS[st.plan]} USD. Buddgy keeps your price and checks it on the first charge. If it can’t tell, our team reviews it.`)}</div>
    ${grp4([date4('First charge', st.date), pick4('Every', st.every, 'every', 'repeat'), row4('Paid with', pmV(st.pm), 'pm'), sw4('remind', 'Remind me', 'A day before each charge', st.remind)], '', 'Tracked from your bank messages. If no message comes, Buddgy asks you on the due date whether you paid.')}${grp4([row4('Trial, sharing, category, notes', '', 'more')])}`,
  foot: () => foot4('Add Netflix'), done: 'Netflix added',
  onInput: (f, st, s) => { if (f.dataset.in === 'amt') s.el.querySelector('[data-learn]').hidden = st.amt === SUBPLANS[st.plan] },
  on: { plan: (v, draw, st) => { st.plan = v.dataset.v.split(':')[1]; st.amt = SUBPLANS[st.plan]; draw() }, every: (v, draw, st) => pickEvery(S, st.every, (e) => { st.every = e; draw() }), pm: (v, draw, st) => ltMethodPicker(S, st.pm, (m) => { st.pm = m; draw() }), more: () => toast(S, 'Opens trial, sharing, category and notes') },
})
AFTER.s_subcancel = (S) => form4(S, {
  title: 'Cancel Netflix?', state: { date: 'Wed, 2 Dec' },
  body: (st) => `<div class="flex flex-col items-center px-5 pb-4 pt-1 text-center">${NFLX(72)}<p class="mt-2.5 text-[1.0625rem] font-semibold text-[var(--color-brand-text-primary)]">Netflix</p><p class="mt-2 flex items-baseline gap-1.5 font-mono-numbers text-[1.75rem] font-semibold tracking-[-0.03em] text-[var(--color-brand-text-primary)]">$9.99${unit4('USD').replace('text-[1.625rem]', 'text-[1.125rem]')}</p><p class="mt-1 text-[0.8125rem] ${SECOND}">Premium · every month · ≈ 494 EGP</p></div><div class="mx-4 grid grid-cols-2 gap-2"><div class="rounded-2xl bg-[var(--color-brand-green-soft)] px-4 py-3"><p class="text-xs font-semibold text-[var(--color-brand-green)]">You save a month</p><p class="font-mono-numbers text-lg font-semibold text-[var(--color-brand-text-primary)]">494 <span class="text-xs ${MUTED}">EGP</span></p></div><div class="rounded-2xl bg-[var(--color-brand-green-soft)] px-4 py-3"><p class="text-xs font-semibold text-[var(--color-brand-green)]">You save a year</p><p class="font-mono-numbers text-lg font-semibold text-[var(--color-brand-text-primary)]">5,928 <span class="text-xs ${MUTED}">EGP</span></p></div></div>
    ${grp4([date4('Ends on', st.date), `<button type="button" data-toast="Opens netflix.com" class="flex min-h-[52px] w-full items-center gap-3 px-4 text-start"><span class="min-w-0 flex-1 text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]">Cancel it on netflix.com</span><span class="text-[0.84375rem] font-semibold text-[var(--color-brand-primary-ink)]">Open</span></button>`], '', 'You keep access until the end of the paid cycle. Reminders stop and past charges stay in Flow.')}`,
  foot: () => foot4('Cancel subscription', 'Keep it', true), linkDone: 'Kept', done: 'Netflix moves to Ended',
})
AFTER.s_held = (S) => {
  const L = [{ id: 'w', t: 'Wataniya fuel', s: 'Today · Transport · CIB ••1234', a: '450', c: 'Transport', on: true }, { id: 'p', t: 'Spinneys', s: 'Today · Groceries · CIB ••1234', a: '312.50', c: 'Groceries', on: true }]
  let look = true
  const bin = (id) => `<button type="button" data-v="rm:${id}" aria-label="Remove" class="${CLOSE_BTN} !text-[var(--color-brand-red)]">${ICON('trash-2', 'size-4')}</button>`
  const sh = form4(S, {
    title: 'Bank messages', sub: 'Tick the ones that look right',
    body: () => `<p class="mx-5 mb-2 flex items-center gap-2 text-xs ${MUTED}">${ICON('move-horizontal', 'size-4')}Swipe a message left to remove it</p>${L.length ? `${sectionHead(`Ready · ${L.length}`)}<div class="mx-4 divide-y divide-[var(--color-brand-border)] overflow-hidden ${CARDBOX}">${L.map((m) => `<div class="relative overflow-hidden"><div aria-hidden="true" class="absolute inset-0 flex items-center justify-end bg-[var(--color-brand-red)] pe-5 text-white">${ICON('trash-2', 'size-5')}</div><div data-swipe="${m.id}" class="relative flex min-h-[64px] items-center gap-2 bg-[var(--color-brand-card)] py-2.5 pe-2 ps-4 transition-transform" style="touch-action:pan-y"><span aria-hidden="true" class="flex size-10 shrink-0 items-center justify-center rounded-[11px]" style="background:var(--cat-${CAT[m.c].v}-bg);color:var(--cat-${CAT[m.c].v}-fg)">${ICON(CAT[m.c].icon, 'size-5')}</span><span class="ms-1 min-w-0 flex-1"><span class="block text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${m.t}</span><span class="block truncate text-xs ${MUTED}">${m.s}</span></span><span class="font-mono-numbers text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]">${MINUS}${m.a}</span><button type="button" data-v="tk:${m.id}" role="checkbox" aria-checked="${m.on}" aria-label="Add ${m.t}" class="flex size-11 shrink-0 items-center justify-center">${tick(m.on, true)}</button>${bin(m.id)}</div></div>`).join('')}</div>` : ''}${look ? `${sectionHead('Take a look · 1').replace('pt-1', 'pt-5')}<div class="mx-4 overflow-hidden ${CARDBOX}"><div class="flex min-h-[60px] items-center gap-3 py-2.5 pe-2 ps-4">${brand('voda', 40)}<span class="min-w-0 flex-1"><span class="block text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">Transfer to 0100•••82</span><span class="block text-xs text-[var(--color-brand-amber)]">Was this really a transfer?</span></span><span class="font-mono-numbers text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]">${MINUS}1,000</span>${bin('look')}</div><div class="grid grid-cols-2 border-t border-[var(--color-brand-border)]"><button type="button" data-toast="Kept as a transfer" class="h-11 text-[0.84375rem] font-semibold text-[var(--color-brand-primary-ink)]">Yes, a transfer</button><button type="button" data-toast="Opens it as an expense" class="h-11 border-s border-[var(--color-brand-border)] text-[0.84375rem] font-semibold text-[var(--color-brand-primary-ink)]">No, spending</button></div></div>` : ''}${!L.length && !look ? ltEmpty({ icon: 'bell', tone: 'positive', title: 'You’re all caught up', size: 'inline' }) : ''}`,
    foot: () => { const n = L.filter((m) => m.on).length; return n ? foot4(`Add ${n > 1 ? 'these ' : ''}${n}`) : `<button type="button" data-done class="${BTN.primary} ${SZ.block}">Done</button>` }, done: 'Added to Flow',
    on: { tk: (v, draw) => { const m = L.find((x) => x.id === v.dataset.v.split(':')[1]); m.on = !m.on; draw() }, rm: (v, draw) => { const id = v.dataset.v.split(':')[1]; if (id === 'look') look = false; else L.splice(L.findIndex((x) => x.id === id), 1); toast(S, 'Removed. It won’t be added'); draw() } },
  })
  let x0 = null
  let row = null
  sh.el.addEventListener('pointerdown', (e) => { row = e.target.closest('[data-swipe]'); if (row && !e.target.closest('button')) { x0 = e.clientX; row.style.transition = 'none' } else row = null })
  sh.el.addEventListener('pointermove', (e) => { if (row && x0 != null) row.style.transform = `translateX(${Math.min(0, e.clientX - x0)}px)` })
  const up = (e) => { if (!row) return; const dx = e.clientX - x0; row.style.transition = ''; if (dx < -90) { const id = row.dataset.swipe; L.splice(L.findIndex((m) => m.id === id), 1); toast(S, 'Removed. It won’t be added'); sh.draw() } else row.style.transform = ''; row = null; x0 = null }
  sh.el.addEventListener('pointerup', up); sh.el.addEventListener('pointercancel', up)
}
AFTER.s_payday = (S) => form4(S, {
  title: 'New payday', state: { amt: '31,500', cur: 'EGP', freq: 'm', name: 'Nexta payroll', type: 'Salary', day: 25 },
  body: (st) => `${hero4({ amt: st.amt, ctl: ctl4('cur', st.cur), top: TILE52('briefcase', IC.green), line: st.cur === 'EGP' ? 'About 31,500 a month' : `≈ ${f0(num4(st.amt) * RATE[st.cur])} EGP a month at today’s rate` })}${seg4('freq', [['m', 'Monthly'], ['b', 'Bi-weekly'], ['w', 'Weekly']], st.freq)}${grp4([in4('name', 'Name', 'e.g. Nexta payroll', st.name), pick4('Type', st.type, 'type'), pick4('Payday', `${ORD(st.day)} of each month`, 'day', 'calendar'), row4('Received in', `${brand('payroll', 24)}CIB Payroll`, 'pm')])}`,
  foot: () => foot4('Add payday'), done: 'Payday added',
  on: { type: (v, draw, st) => ltOptPicker(S, 'Income type', '', [['Salary', 'Salary'], ['Freelance', 'Freelance'], ['Rent', 'Rent'], ['Family', 'Family'], ['Dividends', 'Dividends']], st.type, (t) => { st.type = t; draw() }), day: (v, draw, st) => ltDayPicker(S, 'Payday', st.day, (d) => { st.day = d; draw() }), pm: () => ltMethodPicker(S, 'payroll', () => toast(S, 'Account picked')) },
})
const FOR = [['spend', 'Spending', 'Leaves savings, not logged as an expense', ['receipt', ...IC.teal]], ['debt', 'Pay a debt', 'Lowers what you owe', ['landmark', ...IC.amber]], ['invest', 'Investment', 'Buys an asset', ['trending-up', ...IC.green]], ['income', 'Income', 'Back into this month', ['briefcase', ...IC.green]], ['move', 'Move to a pocket', 'Stays inside your savings', ['arrow-left-right', 'var(--color-brand-elevated)', 'var(--color-brand-text-secondary)']]]
const wdLine = (st) => `${POCKET[st.from][1]} goes from ${POCKET[st.from][4]} to ${f0(Math.max(0, num4(POCKET[st.from][4]) - num4(st.amt)))}`
AFTER.s_withdraw = (S) => form4(S, {
  title: 'Withdraw', sub: 'Money leaving a pocket', state: { amt: '2,000', cur: 'EGP', from: 'trip', for: 'debt', to: 'umrah' },
  body: (st) => `${hero4({ amt: st.amt, ctl: ctl4('cur', st.cur), top: pocketMark(POCKET[st.from], 52), line: wdLine(st) })}${grp4([row4('From', pocketV(st.from), 'from'), row4('For', FOR.find((f) => f[0] === st.for)[1], 'for'), st.for === 'debt' ? row4('Debt', 'Car loan · 36,000 left', 'debt') : '', st.for === 'move' ? row4('Into', pocketV(st.to), 'to') : ''])}<label class="mx-4 mt-3 flex min-h-12 items-start gap-3 ${CARDBOX} px-4 py-3">${ICON('sticky-note', `mt-[3px] size-[18px] shrink-0 ${MUTED}`)}<textarea rows="1" placeholder="Add a note" class="block min-h-6 w-full resize-none bg-transparent text-[0.9375rem] leading-6 text-[var(--color-brand-text-primary)] outline-none placeholder:text-[var(--color-brand-text-muted)]"></textarea></label>`,
  foot: (st) => foot4(`Withdraw ${st.amt || 0}`), done: 'Withdrawn',
  onInput: (f, st, s) => { if (f.dataset.in === 'amt') { s.el.querySelector('[data-line]').textContent = wdLine(st); s.el.querySelector('[data-f4] [data-done]').textContent = `Withdraw ${st.amt || 0}` } },
  on: { from: (v, draw, st) => ltPocketPicker(S, st.from, (k) => { st.from = k; draw() }), to: (v, draw, st) => ltPocketPicker(S, st.to, (k) => { st.to = k; draw() }), for: (v, draw, st) => ltOptPicker(S, 'What is it for?', '', FOR, st.for, (f) => { st.for = f; draw() }), debt: () => ltOptPicker(S, 'Which debt?', '', [['car', 'Car loan · CIB', '36,000 left'], ['ahmed', 'Ahmed', '12,000 left'], ['valu', 'valU · iPhone 16', '20,000 left']], 'car', () => toast(S, 'Debt picked')) },
})
const GUNIT = { g: ['g', 'Grams', ''], pound: ['pounds', 'Gold pounds', '8 g of 21k each'], oz: ['oz', 'Ounces', '31.1 g each'] }
const KSEG = (on) => `<div class="mx-4"><div class="inline-flex w-full gap-0.5 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-[3px]">${['24k', '21k', '18k'].map((k) => `<button type="button" data-v="set:k:${k}" class="${k === on ? SEG_ON : SEG_OFF}">${k}</button>`).join('')}</div></div>`
AFTER.s_gold = (S) => form4(S, {
  title: 'Add gold', state: { amt: '8', unit: 'g', k: '21k', from: 'cib', paid: '32,200', date: 'Mon, 12 Oct' },
  body: (st) => { const grams = num4(st.amt) * (st.unit === 'g' ? 1 : st.unit === 'pound' ? 8 : 31.1); return `${hero4({ amt: st.amt, ctl: ctl4('unit', GUNIT[st.unit][0], 'Unit'), top: TILE52('gem', ['color-mix(in oklab, var(--color-brand-gold) 18%, var(--color-brand-card))', 'var(--color-brand-gold)']), line: `${st.unit === 'g' ? '' : `${f0(grams)} g · `}Worth ${f0(grams * GRAM[st.k])} today · live price` })}${KSEG(st.k)}${grp4([row4('Paid from', pmV(st.from), 'from'), st.from === 'outside' ? '' : in4('paid', 'Paid', '32,200', st.paid, 'decimal'), date4('Bought on', st.date)], '', st.from === 'outside' ? 'Only added to what you hold. Nothing leaves your accounts.' : 'Logged as moving money into gold, not as spending.')}` },
  foot: (st) => foot4(`Add ${st.amt || 0} ${GUNIT[st.unit][0]} of ${st.k}`), done: 'Gold added',
  on: { unit: (v, draw, st) => ltOptPicker(S, 'Counted in', 'How the shop or your receipt counts it', Object.entries(GUNIT).map(([k, [, t, s]]) => [k, t, s]), st.unit, (u) => { st.unit = u; draw() }), from: (v, draw, st) => ltAcctPick(S, st.from, (m) => { st.from = m; draw() }) },
})

/* ================= Debts page: sections with a quiet Add each ================= */
{
  const base = PAGES.debts
  const head = (t, n, key, label) => `<div class="mx-5 mb-2 mt-6 flex items-center"><span class="text-[0.8125rem] font-bold text-[var(--color-brand-text-primary)]">${t}</span><span class="ms-2 font-mono-numbers text-[0.8125rem] font-semibold ${MUTED}">${n}</span><button type="button" data-open4="${key}" class="ms-auto inline-flex h-11 items-center gap-1 px-1 text-[0.875rem] font-semibold text-[var(--color-brand-primary-ink)]">${ICON('plus', 'size-4')}${label}</button></div>`
  const chips = tabs(['Borrowed', 'Installments', 'Cards'], true)
  PAGES.debts = (st, L) => {
    const h = base(st, L)
    if (!L) return h
    const activeHead = h.match(/<div class="mx-5 mb-2 mt-6 [^"]*">Active<\/div>/)[0]
    return h.replace(tabs(['All', 'Borrowed', 'Installments', 'Cards'], true), chips).replace(activeHead, head('Active', 3, 'adddebt', 'Add')) + `<button type="button" data-open4="s_vault" class="mx-4 mt-3 flex min-h-12 w-[calc(100%-2rem)] items-center gap-2.5 rounded-[14px] border border-dashed border-[var(--color-brand-border-strong)] px-4 text-start text-[0.8125rem] font-semibold ${SECOND}">${ICON('award', 'size-4')}<span class="flex-1">4 cleared debts · 54,800 paid off</span>${CHEV}</button><div class="h-6"></div>`
  }
  AFTER.adddebt = (S) => ltOptPicker(S, 'Add a debt', 'Each one opens its own sheet', [['s_borrow', 'Borrowed money', 'From a person or a bank loan', ['user', ...IC.amber]], ['s_install', 'Installment plan', 'valU, Contact, Souhoola and others', ['smartphone', ...IC.teal]], ['addcredit', 'Credit card', 'Opens Add a card with Credit picked', ['credit-card', ...IC.green]]], '', (k) => AFTER[k](S))
  LT_NOTES.debts = 'Kept as it was: today’s Borrowed / Installments / Cards tabs (no All), Active gets a quiet Add (borrow, installment or credit card, which opens Add a card with Credit picked), and cleared debts get a link at the end.'
  AFTER.addcredit = (S) => ltAddCard(S, 'Credit')
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-open4]'); if (!b) return
    const S = Object.values(screens).find((x) => x.vp.contains(b)); if (!S) return
    e.stopPropagation(); AFTER[b.dataset.open4](S)
  }, true)
}

/* ================= the "New" badges and the new sheet buttons ================= */
{
  const css = document.createElement('style')
  css.textContent = '.pz-new{display:inline-block;margin-inline-start:6px;padding:1px 6px;border-radius:999px;background:#0b7b6f;color:#fff;font-size:10px;font-weight:700;line-height:15px;vertical-align:1px;letter-spacing:.02em}'
  document.head.appendChild(css)
  document.querySelector('[data-sheet="addaccount"]').insertAdjacentHTML('afterend', '<button type="button" data-sheet="addcard">Add card</button>')
  document.querySelector('[data-sheet="cashout"]').insertAdjacentHTML('afterend', '<button type="button" data-sheet="setaside">Set aside</button>')
  const NEWS = ['accounts', 'debts', 'deposit', 'goal', 'sub', 'account', 'card', 'addaccount', 'addcard', 'cashout', 'setaside', 's_line', 's_borrow', 's_install', 's_goal', 's_zakat', 's_vault', 's_subadd', 's_subcancel', 's_held', 's_payday', 's_withdraw', 's_gold']
  
}

LT_NOTES.accounts = 'Your new Accounts page as is. Amounts drop .00 when there are no cents. Tap an account for the sheet (SMS match and in/out boxes are back), a card for the full-size card, and Add account / Add card for the new forms.'
