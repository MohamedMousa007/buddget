/* ================= round 8 · Accounts (final) ================= */
{
/* ---------- card faces (D8): Modern = generative textures, Classic = generic bank-card motifs ---------- */
const COL8 = { black: ['#2a2b30', '#0e0f12', 'Black'], teal: ['#0f6e64', '#073c37', 'Teal'], navy: ['#203872', '#0b1634', 'Navy'], sand: ['#6e5b40', '#463a29', 'Sand'], rose: ['#9a4560', '#5a2034', 'Rose'] }
const DES8 = { wave: ['Wave', 'modern'], contour: ['Contour', 'modern'], grain: ['Grain', 'modern'], guilloche: ['Guilloche', 'classic'], twotone: ['Two-tone', 'classic'], ribbon: ['Ribbon', 'classic'], emboss: ['Minimal emboss', 'classic'] }
const MODERN8 = ['wave', 'contour', 'grain']
const CLASSIC8 = ['guilloche', 'twotone', 'ribbon', 'emboss']
const r1 = (n) => n.toFixed(1)
const sq = (x, y, s) => `M${r1(x)} ${r1(y)}h${r1(s)}v${r1(s)}h-${r1(s)}z`
const GEN8 = {
  /* voxel wave: a grid of tiny raised squares that swell along a smooth diagonal wave; kept faint in the text rows */
  wave: () => {
    const lit = Array.from({ length: 6 }, () => '')
    let shade = '', base = ''
    for (let gx = 0; gx < 340; gx += 7) for (let gy = 0; gy < 214; gy += 7) {
      const cx = gx + 3.5, cy = gy + 3.5
      const yc = 250 - 0.78 * cx + 22 * Math.sin(cx / 38)
      let I = Math.exp(-((cy - yc) ** 2) / 1800) + 0.45 * Math.exp(-((cy - yc - 62) ** 2) / 512)
      if ((cy > 146 && cy < 192 && cx < 250) || (cy < 54 && cx < 130) || (cy < 34 && cx > 290)) I *= 0.35
      if (I < 0.07) { base += sq(cx - 0.7, cy - 0.7, 1.4); continue }
      const s = 1.4 + 3.6 * Math.min(1, I)
      lit[Math.min(5, Math.floor(I * 6))] += sq(cx - s / 2, cy - s / 2, s)
      if (I > 0.35) shade += sq(cx - s / 2 + 0.9, cy - s / 2 + 0.9, s)
    }
    return `<path d="${base}" fill="rgba(255,255,255,.06)"/><path d="${shade}" fill="rgba(0,0,0,.4)"/>${lit.map((d, i) => (d ? `<path d="${d}" fill="rgba(255,255,255,${(0.08 + i * 0.065).toFixed(3)})"/>` : '')).join('')}`
  },
  /* topographic lines around two summits */
  contour: () => {
    let d = ''
    for (const [cx, cy, n, ph] of [[288, 30, 13, 0], [36, 210, 8, 2]]) for (let i = 0; i < n; i++) {
      const r = 12 + i * 14
      for (let k = 0; k <= 72; k++) { const t = (k / 72) * 2 * Math.PI; const rr = r * (1 + 0.13 * Math.sin(3 * t + ph + i * 0.35) + 0.06 * Math.sin(5 * t - i * 0.5)); d += `${k ? 'L' : 'M'}${r1(cx + rr * Math.cos(t))} ${r1(cy + rr * 0.82 * Math.sin(t))}` }
      d += 'Z'
    }
    return `<path d="${d}" fill="none" stroke="rgba(255,255,255,.17)" stroke-width="1"/>`
  },
  grain: () => '',
  /* engraved rosette + fine line band, like security printing */
  guilloche: () => {
    let d = ''
    for (let j = 0; j < 6; j++) {
      const R = 58 + j * 7, A = 20 - j * 2.2
      for (let i = 0; i <= 540; i++) { const t = (i / 540) * 2 * Math.PI; d += `${i ? 'L' : 'M'}${r1(292 + R * Math.cos(t) + A * Math.cos(18 * t + j * 0.5))} ${r1(48 + R * Math.sin(t) + A * Math.sin(18 * t + j * 0.5))}` }
      d += 'Z'
    }
    for (let j = 0; j < 8; j++) { const y0 = 197 + j * 3; d += `M-5 ${y0}`; for (let x = 0; x <= 345; x += 15) d += `L${x} ${r1(y0 + 3 * Math.sin(x / 18 + j * 0.6))}` }
    return `<path d="${d}" fill="none" stroke="rgba(255,255,255,.15)" stroke-width=".7"/><rect x="7" y="7" width="326" height="200" rx="9" fill="none" stroke="rgba(255,255,255,.14)" stroke-width=".8"/>`
  },
  twotone: () => '<path d="M178 0H340V214H248Z" fill="rgba(255,255,255,.10)"/><path d="M0 0H178L248 214H0Z" fill="rgba(0,0,0,.18)"/><path d="M178 0L248 214" stroke="rgba(255,255,255,.4)" stroke-width="1.2"/><path d="M186 0L256 214" stroke="rgba(255,255,255,.12)" stroke-width=".8"/>',
  ribbon: () => [0, 1, 2, 3].map((j) => `<path d="M-10 ${118 + j * 13}C90 ${58 + j * 13} 200 ${188 + j * 9} 350 ${38 + j * 15}L350 ${54 + j * 15}C200 ${204 + j * 9} 90 ${74 + j * 13} -10 ${134 + j * 13}Z" fill="rgba(255,255,255,${(0.05 + j * 0.035).toFixed(3)})"/>`).join('') + '<path d="M-10 118C90 58 200 188 350 38" fill="none" stroke="rgba(255,255,255,.3)" stroke-width=".8"/>',
  emboss: () => [[150, 10], [118, 3], [92, 1.5]].map(([r, w]) => `<circle cx="302" cy="204" r="${r}" fill="none" stroke="rgba(0,0,0,.3)" stroke-width="${w}" transform="translate(1.3 1.3)"/><circle cx="302" cy="204" r="${r}" fill="none" stroke="rgba(255,255,255,.17)" stroke-width="${w}" transform="translate(-.8 -.8)"/>`).join(''),
}
const PAT8 = {}
const pat8 = (d) => (PAT8[d] ??= GEN8[d]())
const GRAIN8 = "url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .16 0'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E&quot;)"
const bg8 = (f) => {
  const [a, b] = COL8[f.c] || COL8.black
  const base = `linear-gradient(135deg, ${a} 0%, ${b} 100%)`
  return f.d === 'grain' ? `${GRAIN8}, radial-gradient(110% 90% at 85% 35%, rgba(255,255,255,.10), transparent 60%), radial-gradient(90% 80% at 0% 100%, rgba(0,0,0,.4), transparent 62%), ${base}` : base
}
const FACE8_OF = { cib: ['guilloche', 'teal'], cibcc: ['wave', 'black'], usd: ['twotone', 'navy'], cibpre: ['grain', 'rose'], qnb: ['ribbon', 'rose'], qnbdeb: ['emboss', 'navy'], qnbplat: ['contour', 'black'], nbe: ['ribbon', 'teal'], nbecc: ['grain', 'sand'], deel: ['contour', 'navy'], payo: ['twotone', 'sand'], valu: ['emboss', 'teal'], cca: ['ribbon', 'sand'], hsbc: ['twotone', 'black'], bm: ['guilloche', 'navy'] }
Object.assign(PM, { hsbc: { bank: 'HSBC', name: 'HSBC Credit', kind: 'Credit', last4: '4471', mono: 'HS', color: '#DB0011', cur: 'EGP' } })
const card8of = (k) => { const p = PM[k] || PM.cibcc; const [d, c] = FACE8_OF[k] || ['guilloche', 'teal']; return { ...p, face: { d, c } } }
const ENG8 = '0 1px 0 rgba(0,0,0,.65), 0 0 6px rgba(0,0,0,.3)'
const CONTACTLESS = '<svg width="18" height="22" viewBox="0 0 18 22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M3 7.5c1.2 2.2 1.2 4.8 0 7"/><path d="M7 5c2 3.6 2 8.4 0 12"/><path d="M11 2.5c2.8 5.2 2.8 11.8 0 17"/></svg>'
const svg8 = (d, w, h) => `<svg class="absolute left-0 top-0" width="${w}" height="${h}" viewBox="0 0 340 214" preserveAspectRatio="none" aria-hidden="true">${pat8(d)}</svg>`
const digits8 = (l4) => (String(l4 || '') + '••••').slice(0, 4)
/* NEW component: CardFace v8 (the app's CardFace layout, 340×214 drawn and scaled; background = face design) */
const card8 = (k, w = 280) => {
  const p = typeof k === 'string' ? card8of(k) : k
  const modern = DES8[p.face.d][1] === 'modern'
  const sc = w / 340
  const chip = modern ? 'linear-gradient(135deg, #a3a7ad, #5e6166)' : 'linear-gradient(135deg, #f3dc9a, #c9a85a 50%, #9c7b34)'
  return `<div dir="ltr" data-card-face="big" class="relative mx-auto shrink-0 text-start" style="width:${w}px;height:${Math.round(214 * sc)}px"><div class="absolute left-0 top-0 box-border flex flex-col overflow-hidden" style="width:340px;height:214px;padding:18px 20px;border-radius:13px;color:#fff;background:${bg8(p.face)};box-shadow:0 24px 40px -18px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.14), inset 0 -1px 0 rgba(0,0,0,.25);transform:scale(${sc});transform-origin:top left">${svg8(p.face.d, 340, 214)}<i aria-hidden="true" class="absolute inset-0" style="background:linear-gradient(115deg, transparent 30%, rgba(255,255,255,${modern ? '.10' : '.07'}) 46%, transparent 62%)"></i><div class="relative flex min-h-[34px] items-start justify-between gap-2.5"><div class="min-w-0"><span class="block truncate font-bold" style="font-size:${modern ? 12 : 15}px;letter-spacing:${modern ? '.16em' : '.01em'};text-transform:${modern ? 'uppercase' : 'none'};text-shadow:${ENG8}">${p.bank}</span><span class="mt-0.5 block text-[0.59375rem] font-bold uppercase tracking-[0.16em]" style="text-shadow:${ENG8}">${p.kind}</span></div><span class="font-mono-numbers text-[0.6875rem] font-semibold" style="text-shadow:${ENG8}">${p.cur || 'EGP'}</span></div><div class="relative mt-4 flex items-center gap-3"><i aria-hidden="true" class="h-[34px] w-11 shrink-0 rounded-md" style="background:${chip};box-shadow:inset 0 0 0 1px rgba(0,0,0,.28)"></i>${CONTACTLESS}</div><div class="relative mt-auto"><span class="block whitespace-nowrap font-mono-numbers font-medium" style="font-size:17px;letter-spacing:.14em;text-shadow:${ENG8}">•••• •••• •••• <span data-a8-digits>${digits8(p.last4)}</span></span><div class="mt-2 min-h-[30px]"></div></div></div></div>`
}
/* NEW component: CardFaceChip v8, 88×56 */
const mini8 = (k, sel = false) => {
  const p = typeof k === 'string' ? card8of(k) : k
  const modern = DES8[p.face.d][1] === 'modern'
  const chip = modern ? 'linear-gradient(135deg, #c4c7cc, #6e7277)' : 'linear-gradient(135deg, #f3dc9a, #c9a85a 50%, #9c7b34)'
  const eng = '0 1px 0 rgba(0,0,0,.55)'
  return `<span dir="ltr" data-card-face="mini" class="relative box-border flex h-14 w-[88px] shrink-0 flex-col overflow-hidden rounded-[7px] px-[7px] py-1.5 text-start" style="color:#fff;background:${bg8(p.face)};box-shadow:${sel ? '0 0 0 2px var(--color-brand-card), 0 0 0 4px var(--color-brand-primary), ' : ''}0 1px 2px rgba(13,26,24,.18), inset 0 1px 0 rgba(255,255,255,.14)">${svg8(p.face.d, 88, 56)}<span class="relative flex items-baseline justify-between gap-1"><span class="shrink-0 text-[0.625rem] font-bold leading-3 tracking-[0.01em]" style="text-shadow:${eng}">${p.bank}</span><span class="min-w-0 truncate text-[0.53125rem] font-extrabold uppercase leading-[11px] tracking-[0.08em]" style="text-shadow:${eng}">${p.kind}</span></span><span class="relative mt-auto flex items-center justify-between gap-1"><i aria-hidden="true" class="h-2.5 w-[13px] shrink-0 rounded-[2.5px]" style="background:${chip};box-shadow:inset 0 0 0 .75px rgba(0,0,0,.3)"></i><span class="font-mono-numbers text-[0.6875rem] font-semibold leading-3 tracking-[0.04em]" style="text-shadow:${eng}">••${p.last4 || '••'}</span></span></span>`
}
window.FACE8 = { mini: mini8, big: card8 }

/* ---------- sample data: Normal / Huge balances / Over-committed ---------- */
const BANKS8 = [
  { key: 'cib', name: 'CIB', accts: 3, cards: ['cib', 'cibcc', 'cibpre', 'usd'], v: [213425, 4900], approx: true, aside: true },
  { key: 'qnb', name: 'QNB', accts: 2, cards: ['qnb', 'qnbdeb', 'qnbplat'], v: [21300, 1250] },
  { key: 'nbe', name: 'NBE', accts: 1, cards: ['nbe', 'nbecc'], v: [18425, 2600] },
  { key: 'bm', name: 'Banque Misr', accts: 1, cards: [], v: [9500, 600], alert: true },
  { key: 'deel', name: 'Deel', accts: 1, cards: ['deel'], v: [22150, 1480], approx: true },
  { key: 'payo', name: 'Payoneer', accts: 1, cards: ['payo'], v: [8450, 270], approx: true },
  { key: 'hsbc', name: 'HSBC', accts: 0, cards: ['hsbc'], owed: 1600 },
]
const WALLET8 = { key: 'voda', name: 'Vodafone Cash', accts: 1, cards: [], v: [1200, 300] }
const CASH8 = [3500, 1000]
const OTHER8 = [{ key: 'valu', name: 'valU', accts: 0, cards: ['valu'], note: 'Pay later' }, { key: 'cca', name: 'City Centre Almaza', accts: 0, cards: ['cca'], note: 'Store card' }]
const ACCTS8 = [
  { id: 'a1', name: 'CIB Current', idf: '••1234', cur: 'EGP', v: [120425, 3100], free: 105425, cards: ['cib', 'cibcc', 'cibpre'] },
  { id: 'a2', name: 'CIB USD', idf: '••6620', cur: 'USD', v: [1650, 25], eq: [81593, 1240], cards: ['usd'] },
  { id: 'a3', name: 'CIB Savings', idf: '••3390', cur: 'EGP', v: [11407, 560], cards: [] },
]
const ASIDE8 = [['trip', 'Pocket', 6000], ['umrah', 'Goal', 5500], ['ef', 'Safety net', 3500]]
const CC8 = { cibcc: [8420, 30000, 420, 'Nov 15'], qnb: [4200, 20000, 210, 'Nov 10'], qnbplat: [0, 25000, 0, 'Nov 20'], nbecc: [0, 40000, 0, 'Nov 22'], hsbc: [1600, 15000, 80, 'Nov 18'] }
const LINK8 = { cib: 'CIB Current ••1234', cibpre: 'CIB Current ••1234', usd: 'CIB USD ••6620', qnbdeb: 'QNB Current ••3018', nbe: 'NBE Current ••4410', bm: 'Banque Misr ••3305', deel: 'Deel USD balance', payo: 'Payoneer USD balance' }
const ds8 = (st) => { const m = st.a8data === 'huge' ? 1000 : 1; return { m, inAcc: (st.a8over ? 12400 : 297950) * m, aside: 15000 * m, owed: 14220 * m, nw: (st.a8over ? 54410 : 339960) * m } }
const val8 = (st, v) => (st.a8over ? v[1] : v[0]) * ds8(st).m
const EGP8 = (cls = '') => `<span class="text-[0.71875rem] font-normal ${MUTED} ${cls}">EGP</span>`

/* ---------- pieces ---------- */
const head8 = (t, count, act = '') => `<div class="mb-2 flex min-h-11 items-center gap-2 px-1"><h2 class="text-[17px] font-bold text-[var(--color-brand-text-primary)]">${t}</h2><span class="font-mono-numbers text-[0.8125rem] font-semibold ${MUTED}">${count}</span>${act}</div>`
const link8 = (attr, label) => `<button type="button" ${attr} class="ms-auto inline-flex h-11 items-center gap-1 px-1 text-[0.875rem] font-semibold text-[var(--color-brand-primary-ink)]">${ICON('plus', 'size-4')}${label}</button>`
const faceBtn8 = (k) => `<button type="button" data-a8-card="${k}" aria-label="${PM[k].name}, ${PM[k].kind} ••${PM[k].last4}" class="rounded-[7px]">${mini8(k)}</button>`
const slot8 = (prov, abs = '') => `<button type="button" data-a8-addcard="${prov}" aria-label="Add a card" class="${abs} flex h-14 w-[88px] shrink-0 items-center justify-center rounded-[7px] border-[1.5px] border-dashed border-[var(--color-brand-border-strong)] ${MUTED} hover:bg-[var(--color-brand-elevated)]">${ICON('plus', 'size-5')}</button>`
const ROOM8 = 326
/* card faces of a provider or account: a row while they fit (with the dashed add slot), else a stack that spreads; every face opens its card */
const strip8 = (st, id, keys, prov) => {
  const n = keys.length
  if (!n) return ''
  if ((n + 1) * 88 + n * 8 <= ROOM8) return `<div dir="ltr" class="flex items-center gap-2 py-0.5">${keys.map(faceBtn8).join('')}${slot8(prov)}</div>`
  const open = st.a8spread === id
  const step = open ? 96 : Math.min(52, Math.floor((ROOM8 - 96 - 88) / (n - 1)))
  const faces = keys.map((k, i) => `<span class="absolute left-0 top-0 rounded-[7px] transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)] ${open ? '' : 'shadow-[var(--shadow-stack-edge)]'}" style="transform:translateX(${i * step}px);z-index:${n - i}">${faceBtn8(k)}</span>`).join('')
  const slot = `<span class="absolute left-0 top-0 transition-transform duration-300" style="transform:translateX(${(n - 1) * step + 96}px)">${slot8(prov)}</span>`
  return `<div><div dir="ltr" class="hide-scrollbar overflow-x-auto overflow-y-hidden pb-1 pt-0.5"><div role="group" aria-label="${n} cards" class="relative h-14" style="width:${88 + (n - 1) * step + 96}px">${faces}${slot}</div></div><button type="button" data-a8-spread="${id}" aria-expanded="${open}" class="mt-0.5 flex min-h-11 w-full items-center justify-between gap-2 px-0.5 text-start"><span class="whitespace-nowrap text-xs font-semibold ${MUTED}">${n} cards</span><span class="inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-[var(--color-brand-primary-ink)]">${open ? `Stack${ICON('chevron-left', 'size-4')}` : `Show all${ICON('chevron-down', 'size-4')}`}</span></button></div>`
}
const provHead8 = (st, p) => {
  const n = p.cards.length
  const mark = AMARK(p.key, 44, p.alert)
  const nw = (x) => `<span class="whitespace-nowrap">${x}</span>`
  const sub = p.accts ? `${nw(`${p.accts} account${p.accts > 1 ? 's' : ''} ·`)} ${nw(`${n} card${n === 1 ? '' : 's'}`)}` : `${nw(`${n} card${n === 1 ? '' : 's'} ·`)} ${nw(p.note || 'no account')}`
  const aside = p.aside ? `<span class="mt-0.5 block whitespace-nowrap font-mono-numbers text-[0.71875rem] font-semibold text-[var(--color-brand-primary-ink)]">${f0(ds8(st).aside)} set aside</span>` : ''
  const right = p.v ? `<span class="shrink-0 text-end"><span class="block whitespace-nowrap font-mono-numbers text-base font-semibold tracking-[-0.02em] text-[var(--color-brand-text-primary)]">${p.approx ? '≈ ' : ''}${f0(val8(st, p.v))} ${EGP8()}</span>${aside}</span>`
    : p.owed ? `<span class="shrink-0 text-end"><span class="block whitespace-nowrap font-mono-numbers text-[0.9375rem] font-semibold text-[var(--color-brand-amber)]">${f0(p.owed)} ${EGP8()}</span><span class="mt-0.5 block text-[0.71875rem] ${MUTED}">owed on the card</span></span>` : ''
  return `<span class="flex items-center gap-3">${mark}<span class="min-w-0 flex-1"><span class="block truncate text-base font-bold text-[var(--color-brand-text-primary)]">${p.name}</span><span class="mt-0.5 block text-[0.8125rem] leading-snug ${MUTED}">${sub}</span></span>${right}${ICON('chevron-right', `size-4 shrink-0 ${MUTED}`)}</span>`
}
/* ProviderCard: a div, so the head and every face are their own buttons */
const provCard8 = (st, p) => `<div class="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)]"><button type="button" data-a8-prov="${p.key}" class="block w-full rounded-2xl px-4 ${p.cards.length ? 'pb-3' : 'pb-3.5'} pt-3.5 text-start">${provHead8(st, p)}</button>${p.cards.length ? `<div class="px-4 pb-3.5">${strip8(st, p.key, p.cards, p.name)}</div>` : ''}</div>`
const exact8 = (st, where, n) => (st.a8exact === where ? `<p role="status" class="mt-1.5 inline-flex min-h-7 items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--flow-band-fg)_16%,transparent)] px-3 font-mono-numbers text-[0.8125rem] font-semibold">${f0(n)} EGP exactly</p>` : '')
const big8 = (where, n, label) => `<button type="button" data-a8-exact="${where}" aria-label="${label}, ${f0(n)} EGP" class="-my-[5px] min-w-0 shrink py-[5px] text-start font-mono-numbers text-[32px] font-semibold leading-[34.5px] tracking-[-0.03em] ${Math.abs(n) >= 1e7 ? 'underline decoration-[color-mix(in_oklab,var(--flow-band-fg)_45%,transparent)] decoration-dotted decoration-2 underline-offset-[6px]' : ''}">${fit8(n)}</button>`

/* ---------- Accounts home ---------- */
const hero8 = (st) => {
  const D = ds8(st)
  const free = Math.max(0, D.inAcc - D.aside)
  const over = D.aside - D.inAcc
  const tot = BANKS8.filter((p) => p.v)
  const share = (k) => Math.round((val8(st, tot.find((p) => p.key === k).v) / D.inAcc) * 100)
  const [c, q, d] = [share('cib'), share('qnb'), share('deel')]
  const legend = (op, l) => `<span class="inline-flex items-center gap-1.5"><span class="size-2 rounded-[2px] bg-[var(--flow-band-fg)]" style="opacity:${op}"></span>${l}</span>`
  return `<div class="mx-4 mt-3"><section class="overflow-hidden rounded-3xl text-[var(--flow-band-fg)]" style="background: linear-gradient(120deg, var(--flow-band-a) 0%, var(--flow-band-b) 100%);"><div class="px-[18px] pb-4 pt-2.5">
    <div class="flex h-[22px] items-center"><span class="min-w-0 flex-1 truncate text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[var(--flow-band-fg-2)]">Free to spend</span></div>
    <p class="mt-1.5 flex min-w-0 items-baseline gap-1.5">${big8('home', free, 'Free to spend')}<span class="text-[0.8125rem] text-[var(--flow-band-fg-2)]">EGP</span></p>
    ${exact8(st, 'home', free)}
    <p class="mt-1 text-[0.8125rem] text-[var(--flow-band-fg-2)]">of <b class="font-mono-numbers font-semibold text-[var(--flow-band-fg)]">${f0(D.inAcc)}</b> in your accounts</p>
    ${over > 0 ? `<p class="mt-2"><span class="inline-flex min-h-7 items-center gap-1.5 rounded-full bg-[var(--flow-band-fg)] px-2.5 text-[0.78125rem] font-bold" style="color:var(--flow-chip-over)">${ICON('triangle-alert', 'size-[14px]')}Over-committed by <span class="font-mono-numbers">${f0(over)}</span></span></p>` : ''}
    <div class="pt-3"><div class="flex h-1.5 gap-[3px]">${[[c, 1], [d, 0.75], [q, 0.55], [100 - c - d - q, 0.35]].map(([w, op]) => `<span class="h-full rounded-full bg-[var(--flow-band-fg)]" style="width:${w}%;opacity:${op}"></span>`).join('')}</div><div class="mt-[5px] flex items-center justify-between gap-2 overflow-hidden font-mono-numbers text-[0.65625rem] font-semibold leading-[15.75px] text-[var(--flow-band-fg-2)]"><span class="flex gap-3">${legend(1, `CIB ${c}%`)}${legend(0.75, `DEEL ${d}%`)}${legend(0.55, `QNB ${q}%`)}</span><span>11 accounts</span></div></div>
    <div class="mt-2 flex flex-wrap items-center gap-x-3 text-xs text-[var(--flow-band-fg-2)]"><button type="button" data-a8-aside class="-ms-1 inline-flex min-h-11 items-center gap-1 rounded-lg px-1 text-[var(--flow-band-fg)]"><b class="font-mono-numbers font-semibold">${f0(D.aside)}</b><span class="text-[var(--flow-band-fg-2)]">set aside</span>${ICON('chevron-right', 'size-3.5')}</button><span class="inline-flex min-h-11 items-center gap-1"><b class="font-mono-numbers font-semibold text-[var(--flow-band-fg)]">${f0(D.owed)}</b> owed on cards</span></div>
    <div class="flex items-center justify-between gap-3 border-t pt-2.5 text-[0.8125rem]" style="border-color: var(--flow-band-mix);"><span class="text-[var(--flow-band-fg-2)]">Net worth</span><span class="font-mono-numbers font-semibold">${f0(D.nw)} <span class="text-[0.71875rem] font-normal text-[var(--flow-band-fg-2)]">EGP</span></span></div>
  </div></section></div>`
}
const sample8 = (st) => `<div role="group" aria-label="Sample data" class="mx-4 mt-3 rounded-2xl border border-dashed border-[var(--color-brand-border-strong)] p-1.5">${[[[['normal', 'Normal'], ['huge', 'Huge balances']], 'data', st.a8data || 'normal'], [[['0', 'Set aside fits'], ['1', 'Over-committed']], 'over', st.a8over ? '1' : '0']].map(([opts, a, on], i) => `<div class="${i ? 'mt-1 ' : ''}inline-flex w-full gap-0.5 rounded-xl bg-[var(--color-brand-elevated)] p-[3px]">${opts.map(([k, l]) => `<button type="button" data-a8-${a}="${k}" aria-pressed="${on === k}" class="${on === k ? SEG_ON : SEG_OFF}"><span class="truncate">${l}</span></button>`).join('')}</div>`).join('')}</div>`
const home8 = (st) => {
  const cash = `<div class="${LISTCARD}"><button type="button" data-a8-acct="cash" class="flex min-h-[72px] w-full items-center gap-3.5 px-4 py-3 text-start">${CASHMARK()}<span class="min-w-0 flex-1"><span class="block truncate text-base font-semibold tracking-[-0.01em] text-[var(--color-brand-text-primary)]">Cash</span><span class="mt-0.5 block truncate text-[0.8125rem] ${MUTED}">Estimate · counted by you</span></span><span class="shrink-0 font-mono-numbers text-base font-medium tracking-[-0.02em] text-[var(--color-brand-text-primary)]">${f0(val8(st, CASH8))}</span></button></div>`
  const found = pendingHTML({ held: [1, 2] }, '').replace('2 bank messages', '2 accounts found in your SMS').replace('Not counted until you confirm', 'Confirm them to track their balance').replace('data-pending', 'data-toast="Opens the found accounts"')
  return `${sample8(st)}${hero8(st)}<div class="space-y-5 px-4 pb-6 pt-5">
    ${found}
    <section>${head8('Banks', BANKS8.length, link8('data-a8-addacct', 'Add account'))}<div class="flex flex-col gap-2.5">${BANKS8.map((p) => provCard8(st, p)).join('')}</div></section>
    <section>${head8('Wallets and cash', 2)}<div class="flex flex-col gap-2.5">${provCard8(st, WALLET8)}${cash}</div></section>
    <section>${head8('Other cards', OTHER8.length, link8('data-a8-addcard=""', 'Add card'))}<div class="flex flex-col gap-2.5">${OTHER8.map((p) => provCard8(st, p)).join('')}</div></section>
  </div>`
}

/* ---------- bank (provider) page ---------- */
const acctRow8 = (st, a) => {
  const over = st.a8over
  const small = a.free ? (over ? `<span class="block text-[0.71875rem] font-semibold text-[var(--color-brand-red-text)]">${f0(ds8(st).aside - val8(st, a.v))} short of set aside</span>` : `<span class="block text-[0.71875rem] font-semibold text-[var(--color-brand-primary-ink)]">${f0(a.free * ds8(st).m)} free</span>`) : a.eq ? `<span class="block text-[0.71875rem] ${MUTED}">≈ ${f0(val8(st, a.eq))} EGP</span>` : ''
  const strip = a.cards.length
    ? `<div class="px-4 pb-3.5">${strip8(st, a.id, a.cards, 'CIB')}</div>`
    : `<div class="flex items-center gap-3 px-4 pb-3.5">${slot8('CIB')}<span class="text-[0.78125rem] font-semibold text-[var(--color-brand-primary-ink)]">Add a card</span></div>`
  return `<div><button type="button" data-a8-acct="${a.id}" class="flex min-h-[72px] w-full items-center gap-3.5 px-4 py-3 text-start">${brand('cib', 44)}<span class="min-w-0 flex-1"><span class="flex items-center gap-1.5"><span class="truncate text-base font-semibold tracking-[-0.01em] text-[var(--color-brand-text-primary)]">${a.name}</span>${a.cur !== 'EGP' ? badge('muted', a.cur) : ''}</span><span class="mt-0.5 block truncate text-[0.8125rem] ${MUTED}">${a.idf} · ${a.cur}</span></span><span class="shrink-0 text-end"><span class="block font-mono-numbers text-base font-medium tracking-[-0.02em] text-[var(--color-brand-text-primary)]">${f0(val8(st, a.v))}</span>${small}</span></button>${strip}</div>`
}
const prov8 = (st) => {
  const p = BANKS8[0]
  const total = val8(st, p.v)
  const tint = `--provider-brand:#1D5FA8;background:linear-gradient(160deg, color-mix(in oklab, var(--provider-brand) var(--provider-hero-amt), var(--provider-hero-base)), color-mix(in oklab, var(--provider-brand) calc(var(--provider-hero-amt) - 14%), var(--provider-hero-base)))`
  const c = CC8.cibcc
  return `<div class="mx-4 mt-2"><div class="flex items-center"><button type="button" data-a8-back class="-ms-2 inline-flex h-11 items-center gap-1 px-2 text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${ICON('chevron-left', 'size-5')}Accounts</button><button type="button" data-a8-provmenu aria-label="More actions" class="${CLOSE_BTN} ms-auto">${ICON('ellipsis', 'size-4')}</button></div>
    <section class="mt-1 overflow-hidden rounded-3xl px-[18px] pb-4 pt-4 text-[var(--flow-band-fg)]" style="${tint}"><div class="flex items-center gap-3">${brand('cib', 40)}<span class="min-w-0 flex-1"><span class="block truncate text-[1.0625rem] font-bold">CIB</span><span class="block text-[0.78125rem] opacity-80">Commercial International Bank</span></span></div><p class="mt-4 text-xs font-semibold opacity-80">Total here</p><p class="flex min-w-0 items-baseline gap-1.5"><span class="text-lg">≈</span>${big8('prov', total, 'Total at CIB')}<span class="text-[0.8125rem] font-semibold">EGP</span></p>${exact8(st, 'prov', total)}<p class="mt-2 text-xs opacity-80">3 accounts · 4 cards · <b class="font-mono-numbers">${f0(ds8(st).aside)}</b> set aside</p></section></div>
    <div class="mx-4 mt-3 grid grid-cols-2 gap-2"><button type="button" data-a8-addacct class="${BTN_SOFT} ${SZ.touch}">${ICON('plus', 'size-[18px]')}Add account</button><button type="button" data-a8-addcard="CIB" class="${BTN_SOFT} ${SZ.touch}">${ICON('plus', 'size-[18px]')}Add card</button></div>
    <div class="space-y-5 px-4 pb-6 pt-5">
      <section>${head8('Accounts', 3)}<div class="${LISTCARD}">${ACCTS8.map((a) => acctRow8(st, a)).join('')}</div></section>
      <section>${head8('Credit cards', 1)}<div class="${LISTCARD}"><button type="button" data-a8-card="cibcc" class="flex min-h-[76px] w-full items-center gap-3 py-2.5 pe-3.5 ps-3 text-start hover:bg-[var(--color-brand-elevated)]">${mini8('cibcc')}<span class="min-w-0 flex-1"><span class="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">CIB Platinum</span><span class="mt-0.5 block truncate text-[0.8125rem] ${MUTED}">Owed <b class="font-mono-numbers font-semibold text-[var(--color-brand-amber)]">${f0(c[0])} EGP</b> · due ${c[3]}</span></span>${ICON('chevron-right', `size-4 shrink-0 ${MUTED}`)}</button></div><p class="mt-2 flex gap-2 px-1 text-xs leading-[1.45] ${SECOND}">${ICON('info', `size-4 shrink-0 ${MUTED}`)}<span>What you spend on a credit card is added to what you owe, in Debts. It isn't taken from any account balance until you pay the card.</span></p></section>
    </div>`
}
P8.accounts = (st) => (st.a8prov ? prov8(st) : home8(st))
NOTES8.accounts = 'Hero leads with Free to spend, then “of N in your accounts”, net worth on its own line; past 10M it shortens (282.9M) and a tap shows the exact figure. Every card face opens its card, every stack ends with a dashed Add card, card-only providers get their own row, and card faces are the new Modern and Classic designs. Flip the Sample switch for huge and over-committed balances.'

/* ---------- small menu sheet (3-dot) ---------- */
const menu8 = (S, title, items) => {
  const sh = ltSheet(S, title, '', `<div class="mx-4 divide-y divide-[var(--color-brand-border)] overflow-hidden ${CARDBOX}">${items.map(([ic, l, msg, red], i) => `<button type="button" data-m8="${i}" class="flex min-h-[52px] w-full items-center gap-3 px-4 text-start text-[0.9375rem] font-medium ${red ? 'text-[var(--color-brand-red-text)]' : 'text-[var(--color-brand-text-primary)]'} hover:bg-[var(--color-brand-elevated)]">${ic}${l}</button>`).join('')}</div>`, '', 260)
  sh.el.addEventListener('click', (e) => { const b = e.target.closest('[data-m8]'); if (!b) return; sh.close(); const m = items[+b.dataset.m8][2]; typeof m === 'function' ? m() : toast(S, m) })
}

/* ---------- card sheet (shared with Debts): F8.card8(S, cardKey) ---------- */
const pay8 = (S, k, full) => {
  const p = PM[k]
  const [owed, , min, due] = CC8[k] || [0, 0, 0, '']
  const line = (v) => (full ? `Clears the ${f0(owed)} you owe on this card` : v ? `${f0(Math.max(0, owed - v))} left to pay after this` : `${f0(owed)} owed · ${f0(min)} minimum by ${due}`)
  return form4(S, {
    title: full ? `Pay off ${p.name}` : `Pay ${p.name}`, z: 220, state: { amt: full ? f0(owed) : '' },
    body: (st) => `${hero4({ amt: st.amt, ctl: unit4('EGP'), line: line(num4(st.amt)) })}${grp4([row4('From', `${brand('cib', 24)}CIB Current <span class="font-mono-numbers ${MUTED}">••1234</span>`, 'from'), date4('Date', 'Today')], '', 'The money leaves CIB Current and what you owe in Debts goes down. It is not counted as spending; the purchases already were.')}`,
    foot: () => foot4(full ? `Pay off ${f0(owed)}` : 'Pay'), done: full ? 'Card paid off' : 'Payment saved',
    onInput: (f, st, sh) => { if (f.dataset.in === 'amt') sh.el.querySelector('[data-line]').textContent = line(num4(st.amt)) },
    on: { from: () => toast(S, 'Opens your accounts') },
  })
}
F8.card8 = (S, cardKey = 'cibcc') => {
  const k = PM[cardKey] ? cardKey : 'cibcc'
  const p = PM[k]
  const credit = p.kind === 'Credit'
  const [owed, limit, , due] = CC8[k] || [0, 20000, 0, 'the 1st']
  let def = k === 'cib'
  const link = LINK8[k]
  const pct = limit ? Math.round((owed / limit) * 100) : 0
  const body = () => `<div class="px-4 pt-1">${card8(k, 280)}</div>
    ${credit ? `<div class="mx-4 mt-5 ${CARDBOX} p-4"><div class="flex items-baseline justify-between"><span class="text-[0.8125rem] font-medium ${SECOND}">Owed</span><span class="font-mono-numbers text-[1.5rem] font-semibold tracking-[-0.03em] ${owed ? 'text-[var(--color-brand-red-text)]' : 'text-[var(--color-brand-text-primary)]'}">${f0(owed)} <span class="text-xs font-medium ${MUTED}">EGP</span></span></div><div class="mt-2.5 h-1.5 rounded-full bg-[var(--color-brand-sunken)]"><div class="h-full rounded-full bg-[var(--color-brand-red)]" style="width:${pct}%"></div></div><p class="mt-2 text-xs ${SECOND}"><b class="font-mono-numbers font-semibold text-[var(--color-brand-text-primary)]">${f0(limit - owed)}</b> available of ${f0(limit)} · due ${due}</p>
      ${owed ? `<div class="mt-3.5 grid grid-cols-2 gap-2"><button type="button" data-c8="pay" class="${BTN.primary} ${SZ.touch}">Pay</button><button type="button" data-c8="payoff" class="${BTN_SOFT} ${SZ.touch}">Pay off</button></div>` : `<p class="mt-3 text-[0.8125rem] font-semibold text-[var(--color-brand-green)]">Nothing owed right now</p>`}</div>
      <p class="mx-5 mt-2.5 flex gap-2 text-xs leading-[1.45] ${SECOND}">${ICON('info', `size-4 shrink-0 ${MUTED}`)}<span>Spending on this card is added to what you owe, in Debts. It isn't taken from any account until you pay the card.</span></p>` : ''}
    <div class="mx-4 mt-3 divide-y divide-[var(--color-brand-border)] overflow-hidden ${CARDBOX}">
      ${credit ? '' : `<button type="button" data-c8="acct" class="flex min-h-[52px] w-full items-center gap-3 px-4 text-start"><span class="w-[112px] shrink-0 text-[0.84375rem] ${SECOND}">Linked account</span><span class="flex min-w-0 flex-1 items-center justify-end gap-2 text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]">${link ? `<span class="truncate">${link}</span>` : `<span class="${SECOND}">None</span><span class="text-[var(--color-brand-primary-ink)]">Link</span>`}${CHEV}</span></button>`}
      ${sw4('def', 'Default for new expenses', '', def).replace('data-v="sw:def"', 'data-c8="def"')}
    </div>
    ${sectionHead(`Spent with ${p.name}`).replace('pt-1', 'pt-5')}<div class="mx-4 overflow-hidden ${CARDBOX}">${miniTx(RECENT_TX.slice(0, 2))}</div>`
  const sh = ltSheet(S, p.name, `${p.kind} · ••${p.last4} · ${p.cur}`, body(), '', 130, undefined, `<button type="button" data-c8="menu" aria-label="More actions" class="${CLOSE_BTN}">${ICON('ellipsis-vertical', 'size-4')}</button>`)
  sh.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-c8]'); if (!b) return
    const a = b.dataset.c8
    if (a === 'def') { def = !def; sh.body.innerHTML = body(); return toast(S, def ? 'Default for new expenses' : 'No longer the default') }
    if (a === 'pay') return pay8(S, k, false)
    if (a === 'payoff') return pay8(S, k, true)
    if (a === 'acct') return link?.startsWith('CIB Current') ? (sh.close(), ltAcctSheet(S, 'a1')) : link ? toast(S, `Opens ${link}`) : toast(S, 'Opens your accounts to link one')
    if (a === 'menu') return menu8(S, p.name, [[ICON('pencil', `size-[18px] ${SECOND}`), 'Edit card', 'Opens the card form'], [ICON('palette', `size-[18px] ${SECOND}`), 'Change card face', () => F8.acc_faces(S)], [ICON('trash-2', 'size-[18px]'), 'Delete card', 'Card deleted · its spending stays in Flow', true]])
  })
  return sh
}

/* ---------- Add card: the preview sits in the sheet's own column (never floats), simulated iOS keypad ---------- */
const KEYS8 = [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['', ''], ['0', ''], ['del', '']]
const kb8 = () => `<div data-a8-kb class="shrink-0 border-t border-[var(--color-brand-border)] bg-[var(--color-brand-sunken)]"><div class="flex h-11 items-center justify-between ps-4 pe-2"><span class="text-xs ${MUTED}">Keyboard open · simulated</span><button type="button" data-a8-kbdone class="h-11 px-3 text-[0.9375rem] font-semibold text-[var(--color-brand-primary-ink)]">Done</button></div><div class="grid grid-cols-3 gap-1.5 px-1.5 pb-[34px]" dir="ltr">${KEYS8.map(([d, l]) => (!d ? '<span></span>' : d === 'del' ? `<button type="button" data-a8-key="del" aria-label="Delete" class="flex h-[46px] items-center justify-center rounded-[6px] text-[var(--color-brand-text-primary)]">${ICON('delete', 'size-6')}</button>` : `<button type="button" data-a8-key="${d}" class="flex h-[46px] flex-col items-center justify-center rounded-[6px] bg-[var(--color-brand-card)] text-[1.5rem] leading-none text-[var(--color-brand-text-primary)] shadow-[0_1px_0_var(--color-brand-border-strong)]">${d}${l ? `<span class="mt-0.5 text-[0.5625rem] font-semibold tracking-[0.14em]">${l}</span>` : ''}</button>`)).join('')}</div></div>`
const a8AddCard = (S, o = {}) => {
  const H = S.vp.clientHeight || 844
  const prev = (st) => ({ bank: st.prov || 'Your bank', kind: st.type, last4: st.last4, cur: 'EGP', face: { d: st.d, c: st.c } })
  const look = (st) => `${sectionHead('Card face').replace('pt-1', 'pt-5')}<div class="mx-4 ${CARDBOX} p-3">
    <div class="inline-flex w-full gap-0.5 rounded-xl bg-[var(--color-brand-elevated)] p-[3px]">${[['modern', 'Modern'], ['classic', 'Classic']].map(([v, l]) => `<button type="button" data-v="a8style:${v}" class="${DES8[st.d][1] === v ? SEG_ON : SEG_OFF}">${l}</button>`).join('')}</div>
    <div class="hide-scrollbar -mx-3 mt-3 flex gap-2.5 overflow-x-auto px-3 pb-1 pt-1">${(DES8[st.d][1] === 'modern' ? MODERN8 : CLASSIC8).map((d) => `<button type="button" data-v="set:d:${d}" aria-pressed="${st.d === d}" class="flex shrink-0 flex-col items-center gap-1.5">${mini8({ ...prev(st), face: { d, c: st.c } }, st.d === d)}<span class="text-xs font-semibold ${st.d === d ? 'text-[var(--color-brand-primary-ink)]' : SECOND}">${DES8[d][0]}</span></button>`).join('')}</div>
    <div role="radiogroup" aria-label="Card colour" class="mt-2 flex justify-between px-2">${Object.entries(COL8).map(([c, [a, b, n]]) => `<button type="button" role="radio" aria-checked="${st.c === c}" aria-label="${n}" data-v="set:c:${c}" class="grid size-11 place-items-center"><span aria-hidden="true" class="block size-[34px] rounded-full" style="background:linear-gradient(135deg, ${a}, ${b});box-shadow:${st.c === c ? '0 0 0 2px var(--color-brand-card), 0 0 0 4px var(--color-brand-primary)' : 'none'}"></span></button>`).join('')}</div>
    <button type="button" data-v="a8faces" class="flex h-11 w-full items-center justify-center gap-1.5 text-[0.875rem] font-semibold text-[var(--color-brand-primary-ink)]">${ICON('layout-grid', 'size-4')}Compare all faces</button></div>`
  const linkV = (st) => (st.link === 'none' ? `<span class="${SECOND}">None</span>` : `${brand('cib', 24)}<span class="truncate">${st.link}</span>`)
  const sh = form4(S, {
    title: 'Add a card', z: 140,
    state: { type: o.type || 'Debit', prov: o.prov ?? '', last4: o.last4 || '', name: '', link: 'none', d: 'wave', c: 'black', limit: '', owed: '', due: 15, def: false, kb: !!o.kb },
    body: (st) => `${seg4('type', [['Debit', 'Debit'], ['Credit', 'Credit'], ['Prepaid', 'Prepaid']], st.type)}
      ${grp4([row4('Bank or wallet', st.prov ? `${provMark(provByName(st.prov), 24)}${st.prov}` : `<span class="${MUTED}">Choose</span>`, 'prov'), tiles4(st.last4), in4('name', 'Name', defName(st.prov, st.last4, ` ${st.type}`) || 'Optional', st.name), st.type === 'Credit' ? '' : row4('Linked account', linkV(st), 'link')], '', st.type === 'Credit' ? '' : 'None is fine for a store card, a prepaid card or a card from a bank where you have no account.')}
      ${st.type === 'Credit' ? grp4([in4('limit', 'Limit', '30,000', st.limit, 'decimal'), in4('owed', 'Owed now', '0', st.owed, 'decimal'), pick4('Due day', ORD(st.due), 'due', 'calendar')], 'Credit', 'Spending on this card is added to what you owe, in Debts.') : ''}
      ${look(st)}
      ${grp4([sw4('def', 'Default for new expenses', '', st.def)])}`,
    foot: (st) => foot4(st.type === 'Credit' ? 'Add credit card' : 'Add card'), done: 'Card added',
    after: (st, s) => {
      const el = s.el
      el.style.setProperty('height', `${H - 56}px`, 'important'); el.style.setProperty('max-height', `${H - 56}px`, 'important')
      let pv = el.querySelector('[data-a8-prev]')
      if (!pv) { pv = document.createElement('div'); pv.setAttribute('data-a8-prev', ''); pv.setAttribute('aria-hidden', 'true'); pv.className = 'flex shrink-0 justify-center px-4 pb-3'; s.body.before(pv) }
      const key = `${st.type}|${st.prov}|${st.d}|${st.c}`
      if (pv.dataset.k !== key) { pv.dataset.k = key; pv.innerHTML = card8(prev(st), 280) }
      const f = el.querySelector('[data-foot]'); if (f) f.style.display = st.kb ? 'none' : ''
      const kb = el.querySelector('[data-a8-kb]')
      if (st.kb && !kb) { el.insertAdjacentHTML('beforeend', kb8()); s.body.scrollTop = 0 }
      if (!st.kb && kb) kb.remove()
    },
    onInput: (f, st, s) => { if (f.dataset.in === 'last4') { const dg = s.el.querySelector('[data-a8-digits]'); if (dg) dg.textContent = digits8(st.last4) } if (f.dataset.in === 'last4' || f.dataset.in === 'name') s.el.querySelector('[data-in="name"]').placeholder = defName(st.prov, st.last4, ` ${st.type}`) || 'Optional' },
    on: {
      prov: (v, draw, st) => ltProviderPicker(S, ['bank', 'wallet'], st.prov, (p) => { st.prov = p; draw() }),
      link: (v, draw, st) => {
        const opts = ['none', 'CIB Current ••1234', 'CIB USD ••6620', 'CIB Savings ••3390']
        const ls = ltSheet(S, 'Linked account', 'The account this card spends from', `<div class="mx-4 divide-y divide-[var(--color-brand-border)] overflow-hidden ${CARDBOX}">${opts.map((x) => `<button type="button" data-lk="${x}" role="radio" aria-checked="${st.link === x}" class="flex min-h-[56px] w-full items-center gap-3 px-4 text-start">${x === 'none' ? `<span class="flex size-9 items-center justify-center rounded-[11px] bg-[var(--color-brand-elevated)] ${MUTED}">${ICON('credit-card', 'size-[18px]')}</span>` : brand('cib', 36)}<span class="min-w-0 flex-1 text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${x === 'none' ? 'None · the card stands alone' : x}</span>${tick(st.link === x, false)}</button>`).join('')}</div>`, '', 220)
        ls.el.addEventListener('click', (e) => { const b = e.target.closest('[data-lk]'); if (b) { st.link = b.dataset.lk; ls.close(); draw() } })
      },
      due: (v, draw, st) => ltDayPicker(S, 'Due day', st.due, (d) => { st.due = d; draw() }),
      a8style: (v, draw, st) => { const s8 = v.dataset.v.split(':')[1]; if (DES8[st.d][1] !== s8) { st.d = s8 === 'modern' ? 'wave' : 'guilloche'; draw() } },
      a8faces: () => F8.acc_faces(S),
    },
  })
  sh.el.addEventListener('focusin', (e) => { if (e.target.matches('[data-tiles]') && !sh.st.kb) { sh.st.kb = true; sh.draw() } })
  sh.el.addEventListener('click', (e) => {
    if (e.target.closest('[data-a8-kbdone]')) { sh.st.kb = false; return sh.draw() }
    const kbtn = e.target.closest('[data-a8-key]'); if (!kbtn) return
    const inp = sh.body.querySelector('[data-tiles]')
    const v = sh.st.last4 || ''
    inp.value = kbtn.dataset.a8Key === 'del' ? v.slice(0, -1) : (v + kbtn.dataset.a8Key).slice(0, 4)
    inp.dispatchEvent(new Event('input', { bubbles: true }))
  })
  return sh
}

/* ---------- set aside list (D3) ---------- */
F8.acc_aside = (S) => {
  const st = S.st
  const D = ds8(st)
  const over = D.aside - D.inAcc
  const rows = ASIDE8.map(([k, kind, n]) => { const p = POCKET[k]; return `<button type="button" data-sa="${p[1]}" class="flex min-h-[64px] w-full items-center gap-3 px-4 py-2.5 text-start hover:bg-[var(--color-brand-elevated)]">${pocketMark(p, 40)}<span class="min-w-0 flex-1"><span class="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${p[1]}</span><span class="mt-0.5 flex items-center gap-1.5 truncate text-xs ${MUTED}">${kind} · in ${brand('cib', 16)}CIB Current</span></span><span class="shrink-0 font-mono-numbers text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${f0(n * D.m)}</span>${CHEV}</button>` }).join('')
  const warn = over > 0 ? `<div class="mx-4 mb-3 flex gap-3 rounded-2xl bg-[var(--color-brand-red-soft)] px-3.5 py-3">${ICON('triangle-alert', 'size-5 shrink-0 text-[var(--color-brand-red-text)]')}<span class="min-w-0 text-[0.8125rem] leading-[1.45] text-[var(--color-brand-text-primary)]"><b class="font-semibold text-[var(--color-brand-red-text)]">Over-committed by <span class="font-mono-numbers">${f0(over)}</span>.</b> You set aside more than your accounts hold now. Add money to CIB Current or take some out of a pocket.</span></div>` : ''
  const sh = ltSheet(S, 'Set aside', `${f0(D.aside)} kept for pockets and goals`, `${warn}<div class="mx-4 divide-y divide-[var(--color-brand-border)] overflow-hidden ${CARDBOX}">${rows}</div><p class="mx-5 mt-3 text-xs leading-relaxed ${MUTED}">Set-aside money stays in its account, so the balance doesn't change. It's left out of Free to spend so you don't spend it by accident.</p>`, '', 120)
  sh.el.addEventListener('click', (e) => { const b = e.target.closest('[data-sa]'); if (b) toast(S, `Opens ${b.dataset.sa}`) })
  return sh
}

/* ---------- card face gallery (D8) ---------- */
F8.acc_faces = (S) => {
  let c = 'black'
  const sample = (d) => ({ bank: 'CIB', kind: d === 'wave' || d === 'contour' ? 'Credit' : 'Debit', last4: '7781', cur: 'EGP', face: { d, c } })
  const grid = (list) => `<div class="mx-4 grid grid-cols-2 gap-x-3 gap-y-4">${list.map((d) => `<div class="flex flex-col items-center gap-1.5">${card8(sample(d), 172)}<span class="text-xs font-semibold ${SECOND}">${DES8[d][0]}</span></div>`).join('')}</div>`
  const body = () => `<div role="radiogroup" aria-label="Colour" class="mx-4 flex justify-between ${CARDBOX} px-2 py-1">${Object.entries(COL8).map(([k, [a, b, n]]) => `<button type="button" role="radio" aria-checked="${c === k}" data-fc="${k}" class="flex min-h-11 flex-col items-center justify-center gap-1 px-1 py-1.5"><span aria-hidden="true" class="block size-7 rounded-full" style="background:linear-gradient(135deg, ${a}, ${b});box-shadow:${c === k ? '0 0 0 2px var(--color-brand-card), 0 0 0 4px var(--color-brand-primary)' : 'none'}"></span><span class="text-[0.6875rem] font-semibold ${c === k ? 'text-[var(--color-brand-primary-ink)]' : MUTED}">${n}</span></button>`).join('')}</div>
    ${sectionHead('Modern · generative textures').replace('pt-1', 'pt-5')}${grid(MODERN8)}
    ${sectionHead('Classic · bank-card motifs').replace('pt-1', 'pt-6')}${grid(CLASSIC8)}
    <p class="mx-5 mt-5 text-xs leading-relaxed ${MUTED}">Every face comes in five colours, keeps white text readable and borrows no bank's design. Card faces stay free.</p>`
  const sh = ltSheet(S, 'Card faces', 'Pick a colour to compare every design in it', body(), '', 240)
  sh.el.addEventListener('click', (e) => { const b = e.target.closest('[data-fc]'); if (b) { c = b.dataset.fc; const y = sh.body.scrollTop; sh.body.innerHTML = body(); sh.body.scrollTop = y } })
  return sh
}

/* ---------- add menu (QuickAddFAB) with Account and Card tiles ---------- */
F8.acc_addmenu = (S) => {
  const tint = (v) => [`color-mix(in oklab, ${v} 16%, transparent)`, v]
  const tiles = [
    [ICON('banknote-arrow-up', 'size-[19px]'), 'Expense', 'Cash or card', ['var(--color-brand-primary-soft)', 'var(--color-brand-primary-ink)']],
    [ICON('banknote-arrow-down', 'size-[19px]'), 'Money in', 'Gift, refund, sale', ['var(--color-brand-green-soft)', 'var(--color-brand-green)']],
    [ICON('scan-line', 'size-[19px]'), 'Receipt', 'Snap, we fill it', tint('var(--color-cat-4)')],
    [ICON('credit-card', 'size-[19px]'), 'Pay debt', 'Log a payment', tint('var(--color-cat-5)')],
    [ICON('coins', 'size-[19px]'), 'Savings', 'Put money aside', tint('var(--color-brand-gold)')],
    [ICON('refresh-cw', 'size-[19px]'), 'Subscription', 'Recurring bill', tint('var(--color-cat-2)')],
    [ICON('landmark', 'size-[19px]'), 'Account', 'Bank or wallet', ['var(--color-brand-primary-soft)', 'var(--color-brand-primary-ink)'], 'acct'],
    [ICON('wallet-cards', 'size-[19px]'), 'Card', 'No account needed', ['var(--color-brand-primary-soft)', 'var(--color-brand-primary-ink)'], 'card'],
    [ICON('mic', 'size-[19px]'), 'Add by voice', 'Tap to talk, or hold + any time', ['var(--color-brand-primary-soft)', 'var(--color-brand-primary-ink)']],
  ]
  const body = `<div class="grid min-w-0 grid-cols-2 gap-2 px-4">${tiles.map(([ic, l, h, [bg, fg], k], i) => `<div class="${i === tiles.length - 1 ? 'col-span-2 min-w-0' : 'min-w-0'}"><button type="button" data-qa="${k || l}" class="relative flex h-full min-h-[52px] w-full min-w-0 items-center gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-3.5 text-start hover:bg-[var(--color-brand-sunken)]"><span class="flex w-full min-w-0 items-center gap-2.5 overflow-hidden"><span class="flex size-9 shrink-0 items-center justify-center rounded-[10px]" style="background:${bg};color:${fg}">${ic}</span><span class="flex min-w-0 flex-1 flex-col gap-px"><span class="truncate text-sm font-bold leading-[1.25] text-[var(--color-brand-text-primary)]">${l}</span><span class="line-clamp-2 text-[0.71875rem] leading-[1.3] text-[var(--color-brand-text-secondary)]">${h}</span></span></span></button></div>`).join('')}</div>`
  const sh = ltSheet(S, 'Add', '', body, '', 150)
  sh.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-qa]'); if (!b) return
    const k = b.dataset.qa
    sh.close()
    if (k === 'card') return a8AddCard(S, {})
    if (k === 'acct') return AFTER.addaccount(S)
    toast(S, `Opens ${k}`)
  })
  return sh
}

/* ---------- sheet bar entries ---------- */
F8.acc_card = (S) => F8.card8(S, 'cibcc')
F8.acc_addcard = (S) => a8AddCard(S, {})
F8.acc_addcardkb = (S) => a8AddCard(S, { prov: 'CIB', last4: '77', kb: true })
T8.acc_card = (S) => AFTER.card(S)
T8.acc_addcard = (S) => AFTER.addcard(S)
T8.acc_addcardkb = (S) => AFTER.addcard(S)
T8.acc_aside = (S) => AFTER.setaside(S)
SHEETS8.push(['acc_card', 'Card · credit (Pay, Pay off)'], ['acc_addcard', 'Add card'], ['acc_addcardkb', 'Add card · keyboard open'], ['acc_aside', 'Set aside list'], ['acc_faces', 'Card face gallery'], ['acc_addmenu', 'Add menu · Card tile'])

/* the v7 account sheet and add-account form call these by name: on the final phone they open the final sheets */
{
  const oCard = ltCardSheet, oAdd = ltAddCard
  ltCardSheet = (S, k) => (S.st.v7 ? oCard(S, k) : F8.card8(S, k))
  ltAddCard = (S, type) => (S.st.v7 ? oAdd(S, type) : a8AddCard(S, { type }))
}

/* ---------- clicks on the final Accounts page ---------- */
document.addEventListener('click', (e) => {
  const S = screenOf(e.target)
  if (!S || S.st.v7 || S.st.page !== 'accounts' || S.st.state) return
  const t = e.target
  const hit = (sel) => t.closest(sel)
  const stop = () => { e.stopPropagation(); e.preventDefault() }
  if (hit('[aria-label="Quick add"]')) { stop(); return F8.acc_addmenu(S) }
  if (hit('[data-layer-root]')) return
  let b
  if ((b = hit('[data-a8-data]'))) { stop(); S.st.a8data = b.dataset.a8Data; S.st.a8exact = null; return render(S) }
  if ((b = hit('[data-a8-over]'))) { stop(); S.st.a8over = b.dataset.a8Over === '1'; S.st.a8exact = null; return render(S) }
  if ((b = hit('[data-a8-exact]'))) { stop(); S.st.a8exact = S.st.a8exact === b.dataset.a8Exact ? null : b.dataset.a8Exact; return render(S) }
  if (hit('[data-a8-aside]')) { stop(); return F8.acc_aside(S) }
  if ((b = hit('[data-a8-card]'))) { stop(); return F8.card8(S, b.dataset.a8Card) }
  if ((b = hit('[data-a8-addcard]'))) { stop(); return a8AddCard(S, { prov: b.dataset.a8Addcard }) }
  if (hit('[data-a8-addacct]')) { stop(); return AFTER.addaccount(S) }
  if ((b = hit('[data-a8-spread]'))) { stop(); S.st.a8spread = S.st.a8spread === b.dataset.a8Spread ? null : b.dataset.a8Spread; return render(S) }
  if ((b = hit('[data-a8-acct]'))) { stop(); return ltAcctSheet(S, b.dataset.a8Acct) }
  if ((b = hit('[data-a8-prov]'))) { stop(); if (b.dataset.a8Prov !== 'cib') return toast(S, 'The sample opens CIB'); S.st.a8prov = 'cib'; S.st.a8exact = null; S.scroll.scrollTop = 0; return render(S) }
  if (hit('[data-a8-back]')) { stop(); S.st.a8prov = null; S.st.a8exact = null; return render(S) }
  if (hit('[data-a8-provmenu]')) { stop(); return menu8(S, 'CIB', [[ICON('pencil', `size-[18px] ${SECOND}`), 'Edit name', 'Opens the provider name'], [ICON('archive', `size-[18px] ${SECOND}`), 'Closed accounts · 2', 'Shows 2 closed accounts; their history is kept'], [ICON('trash-2', 'size-[18px]'), 'Delete CIB', 'Deletes CIB and its accounts after you confirm', true]]) }
}, true)
}
