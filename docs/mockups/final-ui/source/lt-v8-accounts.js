/* ================= round 8 · Accounts (final) ================= */
/* One sample dataset across Accounts, Savings, Goals, Debts (1 USD = 49.45 EGP, 21k gold 4,050 a gram).
   Balances: CIB 213,425 (Current 120,425 + USD $1,650 = 81,593 + Savings 11,407) · QNB 21,300 (Current 8,000 + Savings 13,300)
   · NBE 47,000 · Banque Misr 9,500 · Deel $1,600 = 79,120 · Payoneer $200 = 9,890 · Vodafone Cash 1,200 · Cash 3,500 = 384,935 in accounts.
   Set aside: CIB Current 51,000 (Monthly savings 9,000 + Car service 6,000 + Umrah 12,000 + Trip 12,000 + New car 12,000)
   · NBE 27,000 (Umrah 6,000 + New laptop 21,000) · Deel $400 = 19,780 (New car) = 97,780.
   Card money held back: CIB Current 10,020 (CIB Platinum 8,420 + HSBC 1,600, no HSBC account so the primary covers it)
   · QNB Current 6,600 (QNB Visa 4,200 + this month's 2,400 installments) = 16,620.
   Free: CIB Current 59,405 · CIB 152,405 · QNB 14,700 · NBE 20,000 · Deel 59,340 ($1,200) · rest = balance.
   Free to spend = 384,935 − 97,780 − 16,620 = 270,535.
   Outside holdings: 18 g gold (New car) 72,900 + Dollar savings $600 = 29,670 + Cash at home 7,800 = 110,370.
   Investments: certificate 96,940 + gold 10 g 40,500 + USDT 500 = 24,725 + EGX 31,690 = 193,855.
   Debts (Still owed): car loan 33,000 + Mona 3,000 + valU 8,400 + QNB Visa 22,200 (4,200 + 18,000 in plans) + CIB Platinum 8,420 + HSBC 1,600 = 76,620.
   Net worth = 384,935 + 110,370 + 193,855 − 76,620 = 612,540. Saved and invested (Savings) = 97,780 + 110,370 + 193,855 = 402,005.
   CIB short sample: CIB Current 48,600 (−71,825) against 51,000 set aside = short 2,400; in accounts 313,110, net worth 540,715. */
{
/* ---------- card faces (D8, round 9): Modern = lit generative textures, Classic = generic famous-card motifs ---------- */
const COL8 = { black: ['#2a2b30', '#0e0f12', 'Black'], teal: ['#0f6e64', '#073c37', 'Teal'], navy: ['#203872', '#0b1634', 'Navy'], sand: ['#6e5b40', '#463a29', 'Sand'], rose: ['#9a4560', '#5a2034', 'Rose'] }
const DES8 = { wave: ['Wave', 'modern'], metal: ['Metal', 'modern'], chrome: ['Chrome', 'modern'], glass: ['Glass', 'modern'], carbon: ['Carbon', 'modern'], contour: ['Contour', 'modern'], grain: ['Grain', 'modern'], lion: ['Lion', 'classic'], guilloche: ['Guilloche', 'classic'], facet: ['Facets', 'classic'], globe: ['Globe', 'classic'], twotone: ['Two-tone', 'classic'], ribbon: ['Ribbon', 'classic'], emboss: ['Emboss', 'classic'] }
const MODERN8 = Object.keys(DES8).filter((d) => DES8[d][1] === 'modern')
const CLASSIC8 = Object.keys(DES8).filter((d) => DES8[d][1] === 'classic')
const r1 = (n) => n.toFixed(1)
const sq = (x, y, s) => `M${r1(x)} ${r1(y)}h${r1(s)}v${r1(s)}h-${r1(s)}z`
const rng8 = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
/* text zones of the 340×214 face: patterns stay quiet here so white text keeps ≥4.5:1 */
const quiet8 = (x, y) => (x < 175 && y < 62) || (x > 272 && y < 40) || (y > 150 && x < 300)
const poly8 = (pts) => `M${pts.map(([x, y]) => `${x} ${y}`).join('L')}Z`
const star8 = (cx, cy, n, r0, r2) => poly8(Array.from({ length: n * 2 }, (_, i) => { const t = (i / (n * 2)) * 2 * Math.PI - Math.PI / 2; const r = i % 2 ? r0 : r2; return [r1(cx + r * Math.cos(t)), r1(cy + r * Math.sin(t))] }))
/* heraldic lion rampant, facing left, in a 100×110 box */
const LION8 = [
  star8(42, 24, 11, 12, 17),
  poly8([[33, 15], [22, 18], [18, 24], [22, 30], [32, 33]]),
  poly8([[21, 27], [12, 29], [15, 26], [11, 23], [20, 25]]),
  poly8([[36, 34], [50, 32], [62, 54], [71, 72], [65, 83], [54, 79], [44, 58]]),
  poly8([[40, 36], [30, 30], [20, 23], [13, 20], [10, 24], [13, 25], [11, 28], [18, 29], [28, 37], [39, 45]]),
  poly8([[44, 48], [31, 51], [21, 50], [15, 53], [17, 55], [15, 58], [22, 57], [32, 58], [46, 56]]),
  poly8([[61, 76], [57, 90], [51, 101], [44, 103], [43, 107], [57, 107], [64, 93], [71, 80]]),
  poly8([[57, 71], [45, 79], [35, 83], [29, 86], [30, 90], [37, 90], [49, 86], [63, 78]]),
  poly8([[86, 20], [95, 22], [93, 28], [99, 32], [91, 34], [86, 28]]),
].join('')
const LIONTAIL8 = 'M68 76C86 74 84 58 80 48C76 38 82 30 89 29'
const lion8 = (x, y, s, fill, op = 1) => `<g transform="translate(${x} ${y}) scale(${s})" opacity="${op}"><path d="${LION8}" fill="${fill}"/><path d="${LIONTAIL8}" fill="none" stroke="${fill}" stroke-width="4" stroke-linecap="round"/></g>`
const GEN8 = {
  /* voxel wave: every tile is a raised square; height follows a smooth diagonal wave, light comes from the upper left */
  wave: (L, P = 8) => {
    const env = (x, y) => 0.32 + 0.68 * Math.exp(-((y - (214 - 0.63 * x)) ** 2) / (2 * 62 ** 2))
    const H = (x, y) => env(x, y) * (0.5 + 0.5 * Math.sin((x + 1.25 * y - 300) / 46 + Math.PI / 2 + 0.5 * Math.sin(x / 110)))
    const tops = new Map()
    let shade = '', edge = ''
    for (let x0 = 1; x0 < 340; x0 += P) for (let y0 = 1; y0 < 214; y0 += P) {
      const cx = x0 + P / 2, cy = y0 + P / 2
      const h = H(cx, cy), hx = (H(cx + 1, cy) - H(cx - 1, cy)) * 30, hy = (H(cx, cy + 1) - H(cx, cy - 1)) * 30
      const q = quiet8(cx, cy)
      const s = P * (0.5 + 0.3 * h)
      let a, r = 0
      if (L) {
        const nl = Math.hypot(hx, hy, 1)
        const b = Math.max(0, Math.min(1, ((hx * 0.62 + hy * 0.45 + 0.64) / nl) * 0.9 + h * 0.25))
        a = 0.04 + 0.4 * b ** 1.6
        r = h * P * 0.28
        shade += sq(x0 + (P - s) / 2 + r * 0.5, y0 + (P - s) / 2 + r * 0.5, s)
        if (b > 0.5 && !q) edge += `M${r1(x0 + (P - s) / 2 - r * 0.6)} ${r1(y0 + (P - s) / 2 - r * 0.6 + s)}v-${r1(s)}h${r1(s)}`
      } else a = 0.07 + 0.1 * h
      if (q) a *= 0.32
      const k = Math.round(a * 50) / 50
      tops.set(k, (tops.get(k) || '') + sq(x0 + (P - s) / 2 - r * 0.6, y0 + (P - s) / 2 - r * 0.6, s))
    }
    return `${L ? `<path d="${shade}" fill="rgba(0,0,0,.42)"/>` : ''}${[...tops].map(([k, d]) => `<path d="${d}" fill="rgba(255,255,255,${k})"/>`).join('')}${edge ? `<path d="${edge}" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="${P > 10 ? 1.4 : 0.7}"/>` : ''}`
  },
  /* brushed metal: thousands of fine hairlines */
  metal: () => {
    const R = rng8(7)
    let lo = '', hi = ''
    for (let y = 0; y < 214; y += 0.8) for (let j = 0; j < 2; j++) { const x = R() * 380 - 30, w = 30 + R() * 260, seg = `M${r1(x)} ${r1(y + R() * 0.6)}h${r1(w)}`; R() > 0.5 ? (hi += seg) : (lo += seg) }
    return `<path d="${lo}" stroke="rgba(0,0,0,.16)" stroke-width=".5"/><path d="${hi}" stroke="rgba(255,255,255,.07)" stroke-width=".5"/>`
  },
  /* liquid chrome: flowing reflective bands (softened by a blur on the layer) */
  chrome: (L) => {
    const y = (i, x) => -30 + i * 27 + 16 * Math.sin(x / 58 + i * 0.7) + 9 * Math.sin(x / 21 - i * 1.3)
    const line = (i, back) => { const xs = Array.from({ length: 36 }, (_, k) => k * 10 - 5); return (back ? xs.reverse() : xs).map((x, k) => `${k || back ? 'L' : 'M'}${x} ${r1(y(i, x))}`).join('') }
    let out = ''
    for (let i = 0; i < 10; i++) {
      const mid = 1 - Math.abs(i - 5) / 6
      const fill = i % 2 ? `rgba(0,0,0,${(0.25 + 0.25 * mid).toFixed(2)})` : `rgba(255,255,255,${((L ? 0.14 : 0.06) + (L ? 0.3 : 0.1) * mid).toFixed(2)})`
      out += `<path d="${line(i)}${line(i + 1, true)}Z" fill="${fill}"/>`
      if (L && i % 2 === 0) out += `<path d="${line(i)}" fill="none" stroke="rgba(255,255,255,${(0.25 + 0.45 * mid).toFixed(2)})" stroke-width="2"/>`
    }
    return out
  },
  /* frosted glass: soft light shapes behind a frosted sheet (layer is blurred) */
  glass: (L) => `<circle cx="250" cy="70" r="70" fill="rgba(255,255,255,${L ? '.30' : '.16'})"/><circle cx="190" cy="105" r="48" fill="rgba(120,210,255,.28)"/><circle cx="330" cy="200" r="55" fill="rgba(255,170,220,.22)"/><rect x="160" y="-20" width="40" height="260" transform="rotate(25 180 107)" fill="rgba(255,255,255,${L ? '.16' : '.06'})"/>`,
  carbon: () => '',
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
  /* heraldic lion: a lozenge lattice with a small lion in every diamond, and the large embossed lion on the right */
  lion: () => {
    let lat = '', small = ''
    for (let k = -12; k < 20; k++) { lat += `M${k * 34} 0l214 214M${k * 34 + 214} 0l-214 214` }
    for (let r = 0; r < 8; r++) for (let c = 0; c < 12; c++) { const x = c * 34 + (r % 2 ? 17 : 0) - 8, yy = r * 34 - 9; if (x > 200) continue; small += lion8(x, yy, 0.15, 'rgba(255,255,255,.09)') }
    return `<path d="${lat}" stroke="rgba(255,255,255,.07)" stroke-width=".6"/>${small}${lion8(214, 28, 1.42, 'rgba(0,0,0,.35)')}${lion8(211, 25, 1.42, 'rgba(255,255,255,.22)')}${lion8(212, 26, 1.42, 'rgba(255,255,255,.07)')}<rect x="7" y="7" width="326" height="200" rx="9" fill="none" stroke="rgba(255,255,255,.14)" stroke-width=".8"/>`
  },
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
  /* sapphire facets: a cut-gem triangulation catching light at the top right */
  facet: () => {
    const R = rng8(11), cols = 9, rows = 6, pt = []
    for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) pt.push([c * 340 / cols + (c % cols && r % rows ? (R() - 0.5) * 26 : 0), r * 214 / rows + (r % rows && c % cols ? (R() - 0.5) * 22 : 0)])
    const fills = new Map()
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const p = (cc, rr) => pt[rr * (cols + 1) + cc]
      for (const tri of [[p(c, r), p(c + 1, r), p(c + 1, r + 1)], [p(c, r), p(c + 1, r + 1), p(c, r + 1)]]) {
        const mx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, my = (tri[0][1] + tri[1][1] + tri[2][1]) / 3
        let a = 0.02 + 0.2 * Math.exp(-((mx - 270) ** 2 + (my - 40) ** 2) / 9000) + R() * 0.06
        if (quiet8(mx, my)) a *= 0.5
        const k = Math.round(a * 50) / 50
        fills.set(k, (fills.get(k) || '') + poly8(tri.map(([x, y]) => [r1(x), r1(y)])))
      }
    }
    return `${[...fills].map(([k, d]) => `<path d="${d}" fill="rgba(255,255,255,${k})"/>`).join('')}<path d="${[...fills.values()].join('')}" fill="none" stroke="rgba(255,255,255,.1)" stroke-width=".6"/>`
  },
  /* dotted globe with meridians, like the world-card designs */
  globe: () => {
    const cx = 272, cy = 112, R = 118
    let lines = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="rgba(255,255,255,.18)" stroke-width=".8"/>`
    for (const k of [0.25, 0.55, 0.8]) lines += `<ellipse cx="${cx}" cy="${cy}" rx="${r1(R * k)}" ry="${R}" fill="none" stroke="rgba(255,255,255,.1)" stroke-width=".7"/>`
    for (const f of [-0.6, -0.3, 0, 0.3, 0.6]) { const yy = cy + R * f, hw = R * Math.sqrt(1 - f * f); lines += `<path d="M${r1(cx - hw)} ${r1(yy)}H${r1(cx + hw)}" stroke="rgba(255,255,255,.1)" stroke-width=".7"/>` }
    let dots = ''
    for (let x = cx - R; x < cx + R; x += 5) for (let y = cy - R; y < cy + R; y += 5) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > (R - 4) ** 2 || quiet8(x, y)) continue
      if (Math.sin(x / 19) + Math.cos(y / 14) + Math.sin((x + y) / 31) > 0.7) dots += `M${x} ${y}h1.6v1.6h-1.6z`
    }
    return `${lines}<path d="${dots}" fill="rgba(255,255,255,.34)"/>`
  },
  twotone: () => '<path d="M178 0H340V214H248Z" fill="rgba(255,255,255,.10)"/><path d="M0 0H178L248 214H0Z" fill="rgba(0,0,0,.18)"/><path d="M178 0L248 214" stroke="rgba(255,255,255,.4)" stroke-width="1.2"/><path d="M186 0L256 214" stroke="rgba(255,255,255,.12)" stroke-width=".8"/>',
  ribbon: () => [0, 1, 2, 3].map((j) => `<path d="M-10 ${118 + j * 13}C90 ${58 + j * 13} 200 ${188 + j * 9} 350 ${38 + j * 15}L350 ${54 + j * 15}C200 ${204 + j * 9} 90 ${74 + j * 13} -10 ${134 + j * 13}Z" fill="rgba(255,255,255,${(0.05 + j * 0.035).toFixed(3)})"/>`).join('') + '<path d="M-10 118C90 58 200 188 350 38" fill="none" stroke="rgba(255,255,255,.3)" stroke-width=".8"/>',
  emboss: () => [[150, 10], [118, 3], [92, 1.5]].map(([r, w]) => `<circle cx="302" cy="204" r="${r}" fill="none" stroke="rgba(0,0,0,.3)" stroke-width="${w}" transform="translate(1.3 1.3)"/><circle cx="302" cy="204" r="${r}" fill="none" stroke="rgba(255,255,255,.17)" stroke-width="${w}" transform="translate(-.8 -.8)"/>`).join(''),
}
const PAT8 = {}
const pat8 = (d, L, mini) => (PAT8[`${d}|${L}|${mini}`] ??= GEN8[d](L, mini && d === 'wave' ? 14 : undefined))
const BLUR8 = { chrome: 2.2, glass: 18 }
const GRAIN8 = "url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .16 0'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E&quot;)"
/* carbon weave tile: alternating horizontal and vertical strands, each shaded like a round fibre */
const CARBON8 = `url(&quot;data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'><defs><linearGradient id='h' x2='0' y2='1'><stop offset='0' stop-color='#fff' stop-opacity='.2'/><stop offset='.45' stop-color='#fff' stop-opacity='.04'/><stop offset='1' stop-color='#000' stop-opacity='.5'/></linearGradient><linearGradient id='v' x2='1' y2='0'><stop offset='0' stop-color='#fff' stop-opacity='.12'/><stop offset='.45' stop-color='#fff' stop-opacity='.02'/><stop offset='1' stop-color='#000' stop-opacity='.55'/></linearGradient></defs><rect width='4' height='4' fill='url(#h)'/><rect x='4' y='4' width='4' height='4' fill='url(#h)'/><rect x='4' width='4' height='4' fill='url(#v)'/><rect y='4' width='4' height='4' fill='url(#v)'/></svg>").replace(/'/g, '%27')}&quot;)`
const bg8 = (f, sc = 1) => {
  const [a, b] = COL8[f.c] || COL8.black
  const base = `linear-gradient(135deg, ${a} 0%, ${b} 100%)`
  const L = f.l !== false
  if (f.d === 'grain') return `${GRAIN8}, ${L ? 'radial-gradient(110% 90% at 85% 35%, rgba(255,255,255,.10), transparent 60%), ' : ''}radial-gradient(90% 80% at 0% 100%, rgba(0,0,0,.4), transparent 62%), ${base}`
  if (f.d === 'carbon') { const t = r1(Math.max(3, 7 * sc)); return `${CARBON8} 0 0/${t}px ${t}px, ${base}` }
  if (f.d === 'glass') return `${GRAIN8}, ${base}`
  if (f.d === 'metal') return `linear-gradient(180deg, rgba(255,255,255,.10), rgba(0,0,0,.2)), ${base}`
  return base
}
/* light on Modern faces: a key light from the upper left, a slow specular sweep (big face only), metal gets an anisotropic band */
const light8 = (f, big) => {
  if (DES8[f.d][1] !== 'modern') return '<i aria-hidden="true" class="absolute inset-0" style="background:linear-gradient(115deg, transparent 30%, rgba(255,255,255,.07) 46%, transparent 62%)"></i>'
  const scrim = '<i aria-hidden="true" class="absolute inset-0" style="background:linear-gradient(180deg, rgba(0,0,0,.28) 0%, transparent 30%, transparent 62%, rgba(0,0,0,.34) 100%)"></i>'
  if (f.l === false) return scrim
  const band = f.d === 'metal' ? '<i aria-hidden="true" class="absolute inset-0" style="background:linear-gradient(100deg, transparent 8%, rgba(255,255,255,.16) 26%, transparent 40%, rgba(255,255,255,.09) 66%, transparent 80%)"></i>' : ''
  const key = '<i aria-hidden="true" class="absolute inset-0" style="background:radial-gradient(120% 90% at 0% 0%, rgba(255,255,255,.14), transparent 55%), linear-gradient(135deg, transparent 55%, rgba(0,0,0,.28) 100%)"></i>'
  const sweep = big ? '<i aria-hidden="true" class="a8-sheen absolute inset-y-0 -left-1/2 w-[200%]" style="background:linear-gradient(105deg, transparent 38%, rgba(255,255,255,.13) 47%, rgba(255,255,255,.04) 52%, transparent 60%)"></i>' : '<i aria-hidden="true" class="absolute inset-0" style="background:linear-gradient(115deg, transparent 30%, rgba(255,255,255,.1) 46%, transparent 62%)"></i>'
  return `${band}${scrim}${key}${sweep}`
}
{
  const css = document.createElement('style')
  css.textContent = '@keyframes a8sheen{0%{transform:translateX(-22%)}100%{transform:translateX(22%)}}.a8-sheen{animation:a8sheen 7s ease-in-out infinite alternate}@media (prefers-reduced-motion: reduce){.a8-sheen{animation:none}}'
  document.head.append(css)
}
const FACE8_OF = { cib: ['lion', 'teal'], cibcc: ['wave', 'black'], usd: ['globe', 'navy'], cibpre: ['chrome', 'rose'], qnb: ['ribbon', 'rose'], qnbdeb: ['emboss', 'navy'], qnbplat: ['carbon', 'black'], nbe: ['guilloche', 'teal'], nbecc: ['metal', 'sand'], deel: ['glass', 'navy'], payo: ['twotone', 'sand'], valu: ['facet', 'teal'], cca: ['ribbon', 'sand'], hsbc: ['facet', 'black'], bm: ['guilloche', 'navy'] }
Object.assign(PM, { hsbc: { bank: 'HSBC', name: 'HSBC Credit', kind: 'Credit', last4: '4471', mono: 'HS', color: '#DB0011', cur: 'EGP' } })
const card8of = (k) => { const p = PM[k] || PM.cibcc; const [d, c] = FACE8_OF[k] || ['guilloche', 'teal']; return { ...p, face: { d, c, l: true } } }
const ENG8 = '0 1px 0 rgba(0,0,0,.65), 0 0 6px rgba(0,0,0,.3)'
const CONTACTLESS = '<svg width="18" height="22" viewBox="0 0 18 22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M3 7.5c1.2 2.2 1.2 4.8 0 7"/><path d="M7 5c2 3.6 2 8.4 0 12"/><path d="M11 2.5c2.8 5.2 2.8 11.8 0 17"/></svg>'
const svg8 = (f, w, h) => `<svg class="absolute left-0 top-0" width="${w}" height="${h}" viewBox="0 0 340 214" preserveAspectRatio="none" aria-hidden="true"${BLUR8[f.d] ? ` style="filter:blur(${r1(BLUR8[f.d] * (w / 340))}px)"` : ''}>${pat8(f.d, f.l !== false, w < 200)}</svg>`
const digits8 = (l4) => (String(l4 || '') + '••••').slice(0, 4)
/* NEW component: CardFace v8 (the app's CardFace layout, 340×214 drawn and scaled; background = face design) */
const card8 = (k, w = 280) => {
  const p = typeof k === 'string' ? card8of(k) : k
  const modern = DES8[p.face.d][1] === 'modern'
  const sc = w / 340
  const chip = modern ? 'linear-gradient(135deg, #a3a7ad, #5e6166)' : 'linear-gradient(135deg, #f3dc9a, #c9a85a 50%, #9c7b34)'
  return `<div dir="ltr" data-card-face="big" class="relative mx-auto shrink-0 text-start" style="width:${w}px;height:${Math.round(214 * sc)}px"><div class="absolute left-0 top-0 box-border flex flex-col overflow-hidden" style="width:340px;height:214px;padding:18px 20px;border-radius:13px;color:#fff;background:${bg8(p.face)};box-shadow:0 24px 40px -18px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.18), inset 0 -1px 0 rgba(0,0,0,.25)${p.face.d === 'glass' ? ', inset 0 0 0 1px rgba(255,255,255,.16)' : ''};transform:scale(${sc});transform-origin:top left">${svg8(p.face, 340, 214)}${light8(p.face, true)}<div class="relative flex min-h-[34px] items-start justify-between gap-2.5"><div class="min-w-0"><span class="block truncate font-bold" style="font-size:${modern ? 12 : 15}px;letter-spacing:${modern ? '.16em' : '.01em'};text-transform:${modern ? 'uppercase' : 'none'};text-shadow:${ENG8}">${p.bank}</span><span class="mt-0.5 block text-[0.59375rem] font-bold uppercase tracking-[0.16em]" style="text-shadow:${ENG8}">${p.kind}</span></div><span class="font-mono-numbers text-[0.6875rem] font-semibold" style="text-shadow:${ENG8}">${p.cur || 'EGP'}</span></div><div class="relative mt-4 flex items-center gap-3"><i aria-hidden="true" class="h-[34px] w-11 shrink-0 rounded-md" style="background:${chip};box-shadow:inset 0 0 0 1px rgba(0,0,0,.28)"></i>${CONTACTLESS}</div><div class="relative mt-auto"><span class="block whitespace-nowrap font-mono-numbers font-medium" style="font-size:17px;letter-spacing:.14em;text-shadow:${ENG8}">•••• •••• •••• <span data-a8-digits>${digits8(p.last4)}</span></span><div class="mt-2 min-h-[30px]"></div></div></div></div>`
}
/* NEW component: CardFaceChip v8, 88×56 */
const mini8 = (k, sel = false) => {
  const p = typeof k === 'string' ? card8of(k) : k
  const modern = DES8[p.face.d][1] === 'modern'
  const chip = modern ? 'linear-gradient(135deg, #c4c7cc, #6e7277)' : 'linear-gradient(135deg, #f3dc9a, #c9a85a 50%, #9c7b34)'
  const eng = '0 1px 0 rgba(0,0,0,.55)'
  return `<span dir="ltr" data-card-face="mini" class="relative box-border flex h-14 w-[88px] shrink-0 flex-col overflow-hidden rounded-[7px] px-[7px] py-1.5 text-start" style="color:#fff;background:${bg8(p.face, 88 / 340)};box-shadow:${sel ? '0 0 0 2px var(--color-brand-card), 0 0 0 4px var(--color-brand-primary), ' : ''}0 1px 2px rgba(13,26,24,.18), inset 0 1px 0 rgba(255,255,255,.14)">${svg8(p.face, 88, 56)}${light8(p.face, false)}<span class="relative flex items-baseline justify-between gap-1"><span class="shrink-0 text-[0.625rem] font-bold leading-3 tracking-[0.01em]" style="text-shadow:${eng}">${p.bank}</span><span class="min-w-0 truncate text-[0.53125rem] font-extrabold uppercase leading-[11px] tracking-[0.08em]" style="text-shadow:${eng}">${p.kind}</span></span><span class="relative mt-auto flex items-center justify-between gap-1"><i aria-hidden="true" class="h-2.5 w-[13px] shrink-0 rounded-[2.5px]" style="background:${chip};box-shadow:inset 0 0 0 .75px rgba(0,0,0,.3)"></i><span class="font-mono-numbers text-[0.6875rem] font-semibold leading-3 tracking-[0.04em]" style="text-shadow:${eng}">••${p.last4 || '••'}</span></span></span>`
}
window.FACE8 = { mini: mini8, big: card8 }

/* ---------- sample data: Normal / Huge balances / CIB short ---------- */
const BANKS8 = [
  { key: 'cib', name: 'CIB', accts: 3, cards: ['cib', 'cibcc', 'cibpre', 'usd'], v: [213425, 141600], approx: true, aside: true, set: 51000, hold: 10020 },
  { key: 'qnb', name: 'QNB', accts: 2, cards: ['qnb', 'qnbdeb', 'qnbplat'], v: [21300, 21300], hold: 6600 },
  { key: 'nbe', name: 'NBE', accts: 1, cards: ['nbe', 'nbecc'], v: [47000, 47000], set: 27000 },
  { key: 'bm', name: 'Banque Misr', accts: 1, cards: [], v: [9500, 9500], alert: true },
  { key: 'deel', name: 'Deel', accts: 1, cards: ['deel'], v: [79120, 79120], approx: true, set: 19780 },
  { key: 'payo', name: 'Payoneer', accts: 1, cards: ['payo'], v: [9890, 9890], approx: true },
  { key: 'hsbc', name: 'HSBC', accts: 0, cards: ['hsbc'], owed: 1600 },
]
const WALLET8 = { key: 'voda', name: 'Vodafone Cash', accts: 1, cards: [], v: [1200, 1200] }
const CASH8 = [3500, 3500]
const OTHER8 = [{ key: 'valu', name: 'valU', accts: 0, cards: ['valu'], note: 'Pay later' }, { key: 'cca', name: 'City Centre Almaza', accts: 0, cards: ['cca'], note: 'Store card' }]
const ACCTS8 = [
  { id: 'a1', name: 'CIB Current', idf: '••1234', cur: 'EGP', v: [120425, 48600], aside: true, cards: ['cib', 'cibcc', 'cibpre'] },
  { id: 'a2', name: 'CIB USD', idf: '••6620', cur: 'USD', v: [1650, 1650], eq: [81593, 81593], cards: ['usd'] },
  { id: 'a3', name: 'CIB Savings', idf: '••3390', cur: 'EGP', v: [11407, 11407], cards: [] },
]
/* set aside in accounts (as on Savings and Goals): [key, name, icon, tone, amount in accounts (EGP), where it's kept, part in CIB Current] */
const ASIDE8 = [['Pockets', [['ms', 'Monthly savings', 'piggy-bank', IC.teal, 9000, 'In CIB Current', 9000], ['carsvc', 'Car service', 'car', ['var(--cat-transport-bg)', 'var(--cat-transport-fg)'], 6000, 'In CIB Current', 6000]]],
  ['Goals', [['umrah', 'Umrah 2027', 'moon-star', IC.amber, 18000, '12,000 in CIB · 6,000 in NBE', 12000], ['trip', 'Trip to Dahab', 'plane', IC.teal, 12000, 'In CIB Current', 12000], ['car', 'New car', 'car', ['var(--cat-transport-bg)', 'var(--cat-transport-fg)'], 31780, '12,000 in CIB · $400 in Deel', 12000], ['laptop', 'New laptop', 'smartphone', IC.green, 21000, 'In NBE Current', 0]]]]
const CC8 = { cibcc: [8420, 30000, 420, 'Nov 15'], qnb: [4200, 40000, 210, 'Nov 10'], qnbplat: [0, 25000, 0, 'Nov 20'], nbecc: [0, 40000, 0, 'Nov 22'], hsbc: [1600, 15000, 80, 'Nov 18'] }
/* bank installment plans on a card: [item, paid, of, a month]; principal is owed once, inside the card */
const PLANS8 = { qnb: [['iPhone 15 Pro', 2, 12, 1200], ['Washing machine', 5, 10, 1200]] }
const plan8 = (k) => { const ps = PLANS8[k] || []; return { ps, month: ps.reduce((a, p) => a + p[3], 0), left: ps.reduce((a, p) => a + (p[2] - p[1]) * p[3], 0) } }
const LINK8 = { cib: 'CIB Current ••1234', cibpre: 'CIB Current ••1234', usd: 'CIB USD ••6620', qnbdeb: 'QNB Current ••3018', nbe: 'NBE Current ••4410', bm: 'Banque Misr ••3305', deel: 'Deel USD balance', payo: 'Payoneer USD balance' }
const ds8 = (st) => { const m = st.a8data === 'huge' ? 1000 : 1; return { m, inAcc: (st.a8over ? 313110 : 384935) * m, aside: 97780 * m, hold: 16620 * m, owed: 32220 * m, nw: (st.a8over ? 540715 : 612540) * m, short: st.a8over ? 2400 * m : 0, cibCur: (st.a8over ? 48600 : 120425) * m, cibAside: 51000 * m, cibHold: 10020 * m } }
const val8 = (st, v) => (st.a8over ? v[1] : v[0]) * ds8(st).m
const EGP8 = (cls = '') => `<span class="text-[0.71875rem] font-normal ${MUTED} ${cls}">EGP</span>`
const SHORT8 = (n, cls = '') => `<span class="block whitespace-nowrap font-mono-numbers text-[0.71875rem] font-semibold text-[var(--color-brand-amber)] ${cls}">Short ${f0(n)}</span>`

/* ---------- pieces ---------- */
const head8 = (t, count, act = '') => `<div class="mb-2 flex min-h-11 items-center gap-2 px-1"><h2 class="text-[17px] font-bold text-[var(--color-brand-text-primary)]">${t}</h2><span class="font-mono-numbers text-[0.8125rem] font-semibold ${MUTED}">${count}</span>${act}</div>`
const link8 = (attr, label, mark = '') => `<button type="button" ${attr} class="ms-auto inline-flex h-11 items-center gap-1 px-1 text-[0.875rem] font-semibold text-[var(--color-brand-primary-ink)]">${ICON('plus', 'size-4')}${label}${mark}</button>`
const faceBtn8 = (k, stacked) => `<button type="button" data-a8-card="${k}" aria-label="${stacked ? 'Spread the cards' : `${PM[k].name}, ${PM[k].kind} ••${PM[k].last4}`}" class="rounded-[7px]">${mini8(k)}</button>`
const slot8 = (prov, abs = '') => `<button type="button" data-a8-addcard="${prov}" aria-label="Add a card" class="${abs} flex h-14 w-[88px] shrink-0 items-center justify-center rounded-[7px] border-[1.5px] border-dashed border-[var(--color-brand-border-strong)] ${MUTED} hover:bg-[var(--color-brand-elevated)]">${ICON('plus', 'size-5')}</button>`
const ROOM8 = 326
/* card faces of a provider or account, left-aligned: a row while they fit (with the dashed add slot), else a stack.
   First tap on a stacked face spreads the stack, a tap on a spread face opens its card. */
const strip8 = (st, id, keys, prov) => {
  const n = keys.length
  if (!n) return ''
  if ((n + 1) * 88 + n * 8 <= ROOM8) return `<div dir="ltr" class="flex items-center gap-2 py-0.5">${keys.map((k) => faceBtn8(k)).join('')}${slot8(prov)}</div>`
  const open = st.a8spread === id
  const step = open ? 96 : Math.min(52, Math.floor((ROOM8 - 96 - 88) / (n - 1)))
  const faces = keys.map((k, i) => `<span class="absolute left-0 top-0 rounded-[7px] transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)] ${open ? '' : 'shadow-[var(--shadow-stack-edge)]'}" style="transform:translateX(${i * step}px);z-index:${n - i}">${faceBtn8(k, !open)}</span>`).join('')
  const slot = `<span class="absolute left-0 top-0 transition-transform duration-300" style="transform:translateX(${(n - 1) * step + 96}px)">${slot8(prov)}</span>`
  return `<div dir="ltr" class="hide-scrollbar overflow-x-auto overflow-y-hidden pb-1 pt-0.5"><div role="group" aria-label="${n} cards" data-a8-stack="${id}" data-open="${open}" class="relative h-14" style="width:${88 + (n - 1) * step + 96}px">${faces}${slot}</div></div>`
}
const provHead8 = (st, p) => {
  const n = p.cards.length
  const mark = AMARK(p.key, 44, p.alert)
  const nw = (x) => `<span class="whitespace-nowrap">${x}</span>`
  const sub = p.accts ? `${nw(`${p.accts} account${p.accts > 1 ? 's' : ''} ·`)} ${nw(`${n} card${n === 1 ? '' : 's'}`)}` : `${nw(`${n} card${n === 1 ? '' : 's'} ·`)} ${nw(p.note || 'no account')}`
  const D = ds8(st)
  const aside = p.aside && D.short ? SHORT8(D.short, 'mt-0.5') : p.set || p.hold ? `<span class="mt-0.5 block whitespace-nowrap font-mono-numbers text-[0.71875rem] font-semibold text-[var(--color-brand-primary-ink)]">${f0(val8(st, p.v) - ((p.set || 0) + (p.hold || 0)) * D.m)} free</span>` : ''
  const right = p.v ? `<span class="shrink-0 text-end"><span class="block whitespace-nowrap font-mono-numbers text-base font-semibold tracking-[-0.02em] text-[var(--color-brand-text-primary)]">${p.approx ? '≈ ' : ''}${f0(val8(st, p.v))} ${EGP8()}</span>${aside}</span>`
    : p.owed ? `<span class="shrink-0 text-end"><span class="block whitespace-nowrap font-mono-numbers text-[0.9375rem] font-semibold text-[var(--color-brand-amber)]">${f0(p.owed)} ${EGP8()}</span><span class="mt-0.5 block text-[0.71875rem] ${MUTED}">owed on the card</span></span>` : ''
  return `<span class="flex items-center gap-3">${mark}<span class="min-w-0 flex-1"><span class="block truncate text-base font-bold text-[var(--color-brand-text-primary)]">${p.name}</span><span class="mt-0.5 block text-[0.8125rem] leading-snug ${MUTED}">${sub}</span></span>${right}${ICON('chevron-right', `size-4 shrink-0 ${MUTED}`)}</span>`
}
/* ProviderCard: a div, so the head and every face are their own buttons */
const provCard8 = (st, p) => `<div class="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)]"><button type="button" data-a8-prov="${p.key}" class="block w-full rounded-2xl px-4 ${p.cards.length ? 'pb-3' : 'pb-3.5'} pt-3.5 text-start">${provHead8(st, p)}</button>${p.cards.length ? `<div class="px-4 pb-3.5">${strip8(st, p.key, p.cards, p.name)}</div>` : ''}</div>`
const exact8 = (st, where, n, label = '') => (st.a8exact === where ? `<p role="status" class="mt-1.5 inline-flex min-h-7 items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--flow-band-fg)_16%,transparent)] px-3 font-mono-numbers text-[0.8125rem] font-semibold">${label ? `${label} · ` : ''}${f0(n)} EGP exactly</p>` : '')
const dots8 = (n) => (Math.abs(n) >= 1e7 ? 'underline decoration-[color-mix(in_oklab,var(--flow-band-fg)_45%,transparent)] decoration-dotted decoration-2 underline-offset-[6px]' : '')
const big8 = (where, n, label) => `<button type="button" data-a8-exact="${where}" aria-label="${label}, ${f0(n)} EGP" class="-my-[5px] min-w-0 shrink py-[5px] text-start font-mono-numbers text-[32px] font-semibold leading-[34.5px] tracking-[-0.03em] ${dots8(n)}">${n < 0 ? MINUS : ''}${fit8(Math.abs(n))}</button>`

/* ---------- Accounts home ---------- */
const hero8 = (st) => {
  const D = ds8(st)
  const free = D.inAcc - D.aside - D.hold
  const tot = BANKS8.filter((p) => p.v)
  const share = (k) => Math.round((val8(st, tot.find((p) => p.key === k).v) / D.inAcc) * 100)
  const [c, q, d] = [share('cib'), share('qnb'), share('deel')]
  const legend = (op, l) => `<span class="inline-flex items-center gap-1.5"><span class="size-2 rounded-[2px] bg-[var(--flow-band-fg)]" style="opacity:${op}"></span>${l}</span>`
  const nw = `<button type="button" data-a8-exact="nw" aria-label="Net worth, ${f0(D.nw)} EGP" class="-me-1 min-h-11 shrink-0 rounded-lg px-1 text-end text-[0.71875rem] leading-[1.3] text-[var(--flow-band-fg-2)]"><b class="block font-mono-numbers text-[0.9375rem] text-[var(--flow-band-fg)] ${D.nw >= 1e7 ? 'underline decoration-dotted underline-offset-4' : ''}">${fit8(D.nw)}</b>Net worth${new9()}</button>`
  return `<div class="mx-4 mt-3"><section class="overflow-hidden rounded-3xl text-[var(--flow-band-fg)]" style="background: linear-gradient(120deg, var(--flow-band-a) 0%, var(--flow-band-b) 100%);"><div class="px-[18px] pb-4 pt-2.5">
    <div class="flex h-[22px] items-center"><span class="min-w-0 flex-1 truncate text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[var(--flow-band-fg-2)]">Free to spend</span></div>
    <div class="mt-1.5 flex items-end justify-between gap-3"><p class="flex min-w-0 items-baseline gap-1.5">${big8('home', free, 'Free to spend')}<span class="text-[0.8125rem] text-[var(--flow-band-fg-2)]">EGP</span></p>${nw}</div>
    ${exact8(st, 'home', free)}${exact8(st, 'nw', D.nw, 'Net worth')}
    <p class="mt-1 text-[0.8125rem] text-[var(--flow-band-fg-2)]">of <b class="font-mono-numbers font-semibold text-[var(--flow-band-fg)]">${f0(D.inAcc)}</b> in your accounts</p>
    ${D.short ? `<p class="mt-2"><button type="button" data-a8-short class="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-[var(--flow-band-fg)] px-3 text-[0.78125rem] font-bold" style="color:var(--flow-chip-over)">${ICON('triangle-alert', 'size-[14px]')}CIB is short <span class="font-mono-numbers">${f0(D.short)}</span>${ICON('chevron-right', 'size-3.5')}</button></p>` : ''}
    <div class="pt-3"><div class="flex h-1.5 gap-[3px]">${[[c, 1], [d, 0.75], [q, 0.55], [100 - c - d - q, 0.35]].map(([w, op]) => `<span class="h-full rounded-full bg-[var(--flow-band-fg)]" style="width:${w}%;opacity:${op}"></span>`).join('')}</div><div class="mt-[5px] flex items-center justify-between gap-2 overflow-hidden font-mono-numbers text-[0.65625rem] font-semibold leading-[15.75px] text-[var(--flow-band-fg-2)]"><span class="flex gap-3">${legend(1, `CIB ${c}%`)}${legend(0.75, `DEEL ${d}%`)}${legend(0.55, `QNB ${q}%`)}</span><span>11 accounts</span></div></div>
    <div class="mt-2 flex flex-wrap items-center gap-x-3 text-xs text-[var(--flow-band-fg-2)]"><button type="button" data-a8-aside class="-ms-1 inline-flex min-h-11 items-center gap-1 rounded-lg px-1 text-[var(--flow-band-fg)]"><b class="font-mono-numbers font-semibold">${f0(D.aside)}</b><span class="text-[var(--flow-band-fg-2)]">set aside</span>${ICON('chevron-right', 'size-3.5')}</button><span class="inline-flex min-h-11 items-center gap-1"><b class="font-mono-numbers font-semibold text-[var(--flow-band-fg)]">${f0(D.owed)}</b> owed on cards</span></div>
  </div></section></div>`
}
const sample8 = (st) => `<div role="group" aria-label="Sample data" class="mx-4 mt-3 rounded-2xl border border-dashed border-[var(--color-brand-border-strong)] p-1.5">${[[[['normal', 'Normal'], ['huge', 'Huge balances']], 'data', st.a8data || 'normal'], [[['0', 'Set aside covered'], ['1', 'CIB short']], 'over', st.a8over ? '1' : '0']].map(([opts, a, on], i) => `<div class="${i ? 'mt-1 ' : ''}inline-flex w-full gap-0.5 rounded-xl bg-[var(--color-brand-elevated)] p-[3px]">${opts.map(([k, l]) => `<button type="button" data-a8-${a}="${k}" aria-pressed="${on === k}" class="${on === k ? SEG_ON : SEG_OFF}"><span class="truncate">${l}</span></button>`).join('')}</div>`).join('')}</div>`
const home8 = (st) => {
  const cash = `<div class="${LISTCARD}"><button type="button" data-a8-acct="cash" class="flex min-h-[72px] w-full items-center gap-3.5 px-4 py-3 text-start">${CASHMARK()}<span class="min-w-0 flex-1"><span class="block truncate text-base font-semibold tracking-[-0.01em] text-[var(--color-brand-text-primary)]">Cash</span><span class="mt-0.5 block truncate text-[0.8125rem] ${MUTED}">Estimate · counted by you</span></span><span class="shrink-0 font-mono-numbers text-base font-medium tracking-[-0.02em] text-[var(--color-brand-text-primary)]">${f0(val8(st, CASH8))}</span></button></div>`
  const found = pendingHTML({ held: [1, 2] }, '').replace('2 bank messages', '2 accounts found in your SMS').replace('Not counted until you confirm', 'Confirm them to track their balance').replace('data-pending', 'data-toast="Opens the found accounts"')
  return `${sample8(st)}${hero8(st)}<div class="space-y-5 px-4 pb-6 pt-5">
    ${found}
    <section>${head8('Banks', BANKS8.length, link8('data-a8-addacct', 'Add account'))}<div class="flex flex-col gap-2.5">${BANKS8.map((p) => provCard8(st, p)).join('')}</div></section>
    <section>${head8('Wallets and cash', 2)}<div class="flex flex-col gap-2.5">${provCard8(st, WALLET8)}${cash}</div></section>
    <section>${head8('Other cards', OTHER8.length)}<div class="flex flex-col gap-2.5">${OTHER8.map((p) => provCard8(st, p)).join('')}</div></section>
  </div>`
}

/* ---------- bank (provider) page ---------- */
const acctRow8 = (st, a) => {
  const D = ds8(st)
  const small = a.aside ? (D.short ? `<span data-a8-short class="inline-flex items-center">${SHORT8(D.short)}${new9()}</span>` : `<span class="block text-[0.71875rem] font-semibold text-[var(--color-brand-primary-ink)]">${f0(D.cibCur - D.cibAside - D.cibHold)} free</span>`) : a.eq ? `<span class="block text-[0.71875rem] ${MUTED}">≈ ${f0(val8(st, a.eq))} EGP</span>` : ''
  const strip = a.cards.length
    ? `<div class="px-4 pb-3.5">${strip8(st, a.id, a.cards, 'CIB')}</div>`
    : `<div class="flex items-center gap-3 px-4 pb-3.5">${slot8('CIB')}<span class="text-[0.78125rem] font-semibold text-[var(--color-brand-primary-ink)]">Add a card</span></div>`
  return `<div><button type="button" data-a8-acct="${a.id}" class="flex min-h-[72px] w-full items-center gap-3.5 px-4 py-3 text-start">${brand('cib', 44)}<span class="min-w-0 flex-1"><span class="flex items-center gap-1.5"><span class="truncate text-base font-semibold tracking-[-0.01em] text-[var(--color-brand-text-primary)]">${a.name}</span>${a.cur !== 'EGP' ? badge('muted', a.cur) : ''}</span><span class="mt-0.5 block truncate text-[0.8125rem] ${MUTED}">${a.idf} · ${a.cur}</span></span><span class="shrink-0 text-end"><span class="block font-mono-numbers text-base font-medium tracking-[-0.02em] text-[var(--color-brand-text-primary)]">${a.aside ? f0(D.cibCur) : f0(val8(st, a.v))}</span>${small}</span></button>${strip}</div>`
}
const prov8 = (st) => {
  const p = BANKS8[0]
  const total = val8(st, p.v)
  const tint = `--provider-brand:#1D5FA8;background:linear-gradient(160deg, color-mix(in oklab, var(--provider-brand) var(--provider-hero-amt), var(--provider-hero-base)), color-mix(in oklab, var(--provider-brand) calc(var(--provider-hero-amt) - 14%), var(--provider-hero-base)))`
  const c = CC8.cibcc
  return `<div class="mx-4 mt-2"><div class="flex items-center"><button type="button" data-a8-back class="-ms-2 inline-flex h-11 items-center gap-1 px-2 text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${ICON('chevron-left', 'size-5')}Accounts</button><button type="button" data-a8-provmenu aria-label="More actions" class="${CLOSE_BTN} ms-auto">${ICON('ellipsis', 'size-4')}</button></div>
    <section class="mt-1 overflow-hidden rounded-3xl px-[18px] pb-4 pt-4 text-[var(--flow-band-fg)]" style="${tint}"><div class="flex items-center gap-3">${brand('cib', 40)}<span class="min-w-0 flex-1"><span class="block truncate text-[1.0625rem] font-bold">CIB</span><span class="block text-[0.78125rem] opacity-80">Commercial International Bank</span></span></div><p class="mt-4 text-xs font-semibold opacity-80">Total here</p><p class="flex min-w-0 items-baseline gap-1.5"><span class="text-lg">≈</span>${big8('prov', total, 'Total at CIB')}<span class="text-[0.8125rem] font-semibold">EGP</span></p>${exact8(st, 'prov', total)}<p class="mt-2 text-xs opacity-80">3 accounts · 4 cards · <b class="font-mono-numbers">${f0(ds8(st).cibAside)}</b> set aside</p></section></div>
    <div class="space-y-5 px-4 pb-6 pt-4">
      <section>${head8('Accounts', 3, link8('data-a8-addacct', 'Add account', new9()))}<div class="${LISTCARD}">${ACCTS8.map((a) => acctRow8(st, a)).join('')}</div></section>
      <section>${head8('Credit cards', 1)}<div class="${LISTCARD}"><button type="button" data-a8-card="cibcc" class="flex min-h-[76px] w-full items-center gap-3 py-2.5 pe-3.5 ps-3 text-start hover:bg-[var(--color-brand-elevated)]">${mini8('cibcc')}<span class="min-w-0 flex-1"><span class="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">CIB Platinum</span><span class="mt-0.5 block truncate text-[0.8125rem] ${MUTED}">Owed <b class="font-mono-numbers font-semibold text-[var(--color-brand-amber)]">${f0(c[0])} EGP</b> · due ${c[3]}</span></span>${ICON('chevron-right', `size-4 shrink-0 ${MUTED}`)}</button></div><p class="mt-2 flex gap-2 px-1 text-xs leading-[1.45] ${SECOND}">${ICON('info', `size-4 shrink-0 ${MUTED}`)}<span>${TIP8}</span></p></section>
    </div>`
}
const TIP8 = "Spending on this card is added to what you owe. It isn't taken from any account until you pay the card."
P8.accounts = (st) => (st.a8prov ? prov8(st) : home8(st))
NOTES8.accounts = 'Hero: Free to spend with net worth beside it (both shorten past 10M; tap for the exact figure). Rows show the bank balance and what is free, or “Short X” in amber. A stack spreads on the first tap and opens a card on the second; new Modern faces are lit textures. Flip the Sample switch for huge balances and a CIB shortfall.'

/* ---------- small menu sheet (3-dot) ---------- */
const menu8 = (S, title, items) => {
  const sh = ltSheet(S, title, '', `<div class="mx-4 divide-y divide-[var(--color-brand-border)] overflow-hidden ${CARDBOX}">${items.map(([ic, l, msg, red], i) => `<button type="button" data-m8="${i}" class="flex min-h-[52px] w-full items-center gap-3 px-4 text-start text-[0.9375rem] font-medium ${red ? 'text-[var(--color-brand-red-text)]' : 'text-[var(--color-brand-text-primary)]'} hover:bg-[var(--color-brand-elevated)]">${ic}${l}</button>`).join('')}</div>`, '', 260)
  sh.el.addEventListener('click', (e) => { const b = e.target.closest('[data-m8]'); if (!b) return; sh.close(); const m = items[+b.dataset.m8][2]; typeof m === 'function' ? m() : toast(S, m) })
}
/* radio row in a grouped card, like the shared picker rows */
const pickRow8 = (attr, on, lead, title, sub = '', right = '') => `<button type="button" ${attr} role="radio" aria-checked="${on}" class="flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-start hover:bg-[var(--color-brand-elevated)]">${lead}<span class="min-w-0 flex-1"><span class="block text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${title}</span>${sub ? `<span class="mt-0.5 block text-xs leading-snug ${SECOND}">${sub}</span>` : ''}</span>${right}${tick(on, false)}</button>`
const icoTile8 = (ic, tone = ['var(--color-brand-elevated)', 'var(--color-brand-text-secondary)']) => `<span aria-hidden="true" class="flex size-9 shrink-0 items-center justify-center rounded-[11px]" style="background:${tone[0]};color:${tone[1]}">${ICON(ic, 'size-[18px]')}</span>`
const MOVETO8 = [['qnbdeb', 'qnb', 'QNB Current ••3018', 'Transfer of 2,400 left CIB on Nov 24'], ['nbe', 'nbe', 'NBE Current ••4410', ''], ['voda', 'voda', 'Vodafone Cash', '']]
const moveList8 = (st, hints = true) => `${sectionHead('Where is it now?').replace('pt-1', 'pt-5')}<div class="mx-4 divide-y divide-[var(--color-brand-border)] overflow-hidden ${CARDBOX}">${MOVETO8.map(([k, b, l, hint]) => pickRow8(`data-v="set:to:${k}"`, st.to === k, brand(b, 36), l, hint && hints ? `<span class="font-semibold text-[var(--color-brand-primary-ink)]">${hint}</span>` : '')).join('')}</div>`

/* ---------- card sheet (shared with Debts): F8.card8(S, cardKey) ---------- */
const pay8 = (S, k) => {
  const p = PM[k]
  const [bal, , min, due] = CC8[k] || [0, 0, 0, '']
  const pl = plan8(k)
  const owed = bal + pl.month
  const line = (st) => { const v = num4(st.amt); return v >= owed ? (pl.month ? `Clears what's due now: ${f0(bal)} + ${f0(pl.month)} in installments` : `Clears the ${f0(owed)} you owe on this card`) : v ? `${f0(owed - v)} left to pay after this` : `${f0(owed)} due now · ${f0(min)} minimum by ${due}` }
  return form4(S, {
    title: `Pay ${p.name}`, z: 220, state: { amt: '', from: 'cib' },
    body: (st) => `${hero4({ amt: st.amt, ctl: unit4('EGP'), line: line(st) })}<div class="-mt-2 flex justify-center gap-2 px-4"><button type="button" data-v="full" aria-pressed="${num4(st.amt) === owed}" class="${OPT_BASE} ${num4(st.amt) === owed ? OPT_ON : OPT_OFF} h-11 rounded-full px-4 text-[0.875rem]">Full amount <span class="font-mono-numbers">${f0(owed)}</span></button>${new9()}</div>${grp4([row4('From', pmV(st.from), 'from'), date4('Date', 'Today')], '', 'The money leaves that account and what you owe on the card goes down. It isn’t counted as spending; the purchases already were.')}`,
    foot: () => foot4('Pay card'), done: 'Card payment saved',
    onInput: (f, st, sh) => { if (f.dataset.in === 'amt') { sh.el.querySelector('[data-line]').textContent = line(st); const c = sh.el.querySelector('[data-v="full"]'); const on = num4(st.amt) === owed; c.setAttribute('aria-pressed', on); c.className = `${OPT_BASE} ${on ? OPT_ON : OPT_OFF} h-11 rounded-full px-4 text-[0.875rem]` } },
    on: { full: (v, draw, st) => { st.amt = f0(owed); draw() }, from: (v, draw, st) => ltMethodPicker(S, st.from, (x) => { st.from = x; draw() }) },
  })
}
F8.card8 = (S, cardKey = 'cibcc') => {
  const k = PM[cardKey] ? cardKey : 'cibcc'
  const p = PM[k]
  const credit = p.kind === 'Credit'
  const [bal, limit, , due] = CC8[k] || [0, 20000, 0, 'the 1st']
  const pl = plan8(k)
  const owed = bal + pl.left
  let def = k === 'cib'
  const link = LINK8[k]
  const pct = limit ? Math.round((owed / limit) * 100) : 0
  const plans = pl.ps.length ? `<div class="mt-3 border-t border-[var(--color-brand-border)] pt-3"><p class="flex items-center gap-2.5 text-[0.8125rem] ${SECOND}">${ICON('calendar-clock', `size-[18px] shrink-0 ${SECOND}`)}<span class="min-w-0 flex-1"><b class="font-semibold text-[var(--color-brand-text-primary)]">Installments:</b> ${pl.ps.length} plans · <span class="font-mono-numbers">${f0(pl.month)}</span> a month · <span class="font-mono-numbers">${f0(pl.left)}</span> left${new9()}</span></p>${pl.ps.map(([n, i, of, a]) => `<button type="button" data-c8="plan" data-plan="${n}" class="mt-1 flex min-h-11 w-full items-center gap-3 rounded-xl px-1 text-start hover:bg-[var(--color-brand-elevated)]"><span class="min-w-0 flex-1"><span class="block truncate text-[0.875rem] font-semibold text-[var(--color-brand-text-primary)]">${n}</span><span class="block font-mono-numbers text-xs ${SECOND}">${i} of ${of} · ${f0(a)} a month</span></span><span class="font-mono-numbers text-[0.8125rem] font-semibold text-[var(--color-brand-text-primary)]">${f0((of - i) * a)} left</span>${CHEV}</button>`).join('')}</div>` : ''
  const body = () => `<div class="px-4 pt-1">${card8(k, 280)}</div>
    ${credit ? `<div class="mx-4 mt-5 ${CARDBOX} p-4"><div class="flex items-baseline justify-between"><span class="text-[0.8125rem] font-medium ${SECOND}">Owed</span><span class="font-mono-numbers text-[1.5rem] font-semibold tracking-[-0.03em] ${owed ? 'text-[var(--color-brand-red-text)]' : 'text-[var(--color-brand-text-primary)]'}">${f0(owed)} <span class="text-xs font-medium ${MUTED}">EGP</span></span></div>${pl.left ? `<p class="mt-0.5 text-end font-mono-numbers text-xs ${SECOND}">${f0(bal)} on the card + ${f0(pl.left)} in ${pl.ps.length} plans</p>` : ''}<div class="mt-2.5 h-1.5 rounded-full bg-[var(--color-brand-sunken)]"><div class="h-full rounded-full bg-[var(--color-brand-red)]" style="width:${pct}%"></div></div><p class="mt-2 text-xs ${SECOND}"><b class="font-mono-numbers font-semibold text-[var(--color-brand-text-primary)]">${f0(limit - owed)}</b> available of ${f0(limit)} · due ${due}</p>${plans}
      ${owed ? `<button type="button" data-c8="pay" class="mt-3.5 ${BTN.primary} ${SZ.block}">Pay card</button>${new9()}` : `<p class="mt-3 text-[0.8125rem] font-semibold text-[var(--color-brand-green)]">Nothing owed right now</p>`}</div>
      <p class="mx-5 mt-2.5 flex gap-2 text-xs leading-[1.45] ${SECOND}">${ICON('info', `size-4 shrink-0 ${MUTED}`)}<span>${TIP8}</span></p>` : ''}
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
    if (a === 'pay') return pay8(S, k)
    if (a === 'plan') return toast(S, `Opens ${b.dataset.plan}`)
    if (a === 'acct') return link?.startsWith('CIB Current') ? (sh.close(), ltAcctSheet(S, 'a1')) : link ? toast(S, `Opens ${link}`) : toast(S, 'Opens your accounts to link one')
    if (a === 'menu') { const f = card8of(k).face; return menu8(S, p.name, [[ICON('pencil', `size-[18px] ${SECOND}`), 'Edit card', () => a8AddCard(S, { edit: true, type: p.kind, prov: p.bank, last4: p.last4, d: f.d, c: f.c })], [ICON('trash-2', 'size-[18px]'), 'Delete card', 'Card deleted · its spending stays in Flow', true]]) }
  })
  return sh
}

/* ---------- Add card: the preview sits in the sheet's own column (never floats), simulated iOS keypad ---------- */
const KEYS8 = [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['', ''], ['0', ''], ['del', '']]
const kb8 = () => `<div data-a8-kb class="shrink-0 border-t border-[var(--color-brand-border)] bg-[var(--color-brand-sunken)]"><div class="flex h-11 items-center justify-between ps-4 pe-2"><span class="text-xs ${MUTED}">Keyboard open · simulated</span><button type="button" data-a8-kbdone class="h-11 px-3 text-[0.9375rem] font-semibold text-[var(--color-brand-primary-ink)]">Done</button></div><div class="grid grid-cols-3 gap-1.5 px-1.5 pb-[34px]" dir="ltr">${KEYS8.map(([d, l]) => (!d ? '<span></span>' : d === 'del' ? `<button type="button" data-a8-key="del" aria-label="Delete" class="flex h-[46px] items-center justify-center rounded-[6px] text-[var(--color-brand-text-primary)]">${ICON('delete', 'size-6')}</button>` : `<button type="button" data-a8-key="${d}" class="flex h-[46px] flex-col items-center justify-center rounded-[6px] bg-[var(--color-brand-card)] text-[1.5rem] leading-none text-[var(--color-brand-text-primary)] shadow-[0_1px_0_var(--color-brand-border-strong)]">${d}${l ? `<span class="mt-0.5 text-[0.5625rem] font-semibold tracking-[0.14em]">${l}</span>` : ''}</button>`)).join('')}</div></div>`
const a8AddCard = (S, o = {}) => {
  const H = S.vp.clientHeight || 844
  const prev = (st) => ({ bank: st.prov || 'Your bank', kind: st.type, last4: st.last4, cur: 'EGP', face: { d: st.d, c: st.c, l: st.l8 } })
  const look = (st) => {
    const modern = DES8[st.d][1] === 'modern'
    return `${sectionHead('Card face').replace('pt-1', 'pt-5')}<div class="mx-4 ${CARDBOX} p-3">
    <div class="inline-flex w-full gap-0.5 rounded-xl bg-[var(--color-brand-elevated)] p-[3px]">${[['modern', 'Modern'], ['classic', 'Classic']].map(([v, l]) => `<button type="button" data-v="a8style:${v}" class="${DES8[st.d][1] === v ? SEG_ON : SEG_OFF}">${l}</button>`).join('')}</div>
    <div class="hide-scrollbar -mx-3 mt-3 flex gap-2.5 overflow-x-auto px-3 pb-1 pt-1">${(modern ? MODERN8 : CLASSIC8).map((d) => `<button type="button" data-v="set:d:${d}" aria-pressed="${st.d === d}" class="flex shrink-0 flex-col items-center gap-1.5">${mini8({ ...prev(st), face: { d, c: st.c, l: st.l8 } }, st.d === d)}<span class="text-xs font-semibold ${st.d === d ? 'text-[var(--color-brand-primary-ink)]' : SECOND}">${DES8[d][0]}</span></button>`).join('')}</div>
    <div role="radiogroup" aria-label="Card colour" class="mt-2 flex justify-between px-2">${Object.entries(COL8).map(([c, [a, b, n]]) => `<button type="button" role="radio" aria-checked="${st.c === c}" aria-label="${n}" data-v="set:c:${c}" class="grid size-11 place-items-center"><span aria-hidden="true" class="block size-[34px] rounded-full" style="background:linear-gradient(135deg, ${a}, ${b});box-shadow:${st.c === c ? '0 0 0 2px var(--color-brand-card), 0 0 0 4px var(--color-brand-primary)' : 'none'}"></span></button>`).join('')}</div>
    ${modern ? `<div class="-mx-3 -mb-3 mt-2 border-t border-[var(--color-brand-border)]">${sw4('l8', `Lighting ${st.l8 ? 'on' : 'off'}${new9()}`, 'Light moves across the texture', st.l8)}</div>` : ''}</div>`
  }
  const linkV = (st) => (st.link === 'none' ? `<span class="${SECOND}">None</span>` : `${brand('cib', 24)}<span class="truncate">${st.link}</span>`)
  const sh = form4(S, {
    title: o.edit ? 'Edit card' : 'Add a card', z: 140,
    state: { type: o.type || 'Debit', prov: o.prov ?? '', last4: o.last4 || '', name: '', link: 'none', d: o.d || 'wave', c: o.c || 'black', l8: true, limit: '', owed: '', due: 15, def: false, kb: !!o.kb },
    body: (st) => `${seg4('type', [['Debit', 'Debit'], ['Credit', 'Credit'], ['Prepaid', 'Prepaid']], st.type)}
      ${grp4([row4('Bank or wallet', st.prov ? `${provMark(provByName(st.prov), 24)}${st.prov}` : `<span class="${MUTED}">Choose</span>`, 'prov'), tiles4(st.last4), in4('name', 'Name', defName(st.prov, st.last4, ` ${st.type}`) || 'Optional', st.name), st.type === 'Credit' ? '' : row4('Linked account', linkV(st), 'link')], '', st.type === 'Credit' ? '' : 'None is fine for a store card, a prepaid card or a card from a bank where you have no account.')}
      ${st.type === 'Credit' ? grp4([in4('limit', 'Limit', '30,000', st.limit, 'decimal'), in4('owed', 'Owed now', '0', st.owed, 'decimal'), pick4('Due day', ORD(st.due), 'due', 'calendar')], 'Credit', 'Spending on this card is added to what you owe.') : ''}
      ${look(st)}
      ${grp4([sw4('def', 'Default for new expenses', '', st.def)])}`,
    foot: (st) => foot4(o.edit ? 'Save card' : st.type === 'Credit' ? 'Add credit card' : 'Add card'), done: o.edit ? 'Card saved' : 'Card added',
    after: (st, s) => {
      const el = s.el
      el.style.setProperty('height', `${H - 56}px`, 'important'); el.style.setProperty('max-height', `${H - 56}px`, 'important')
      let pv = el.querySelector('[data-a8-prev]')
      if (!pv) { pv = document.createElement('div'); pv.setAttribute('data-a8-prev', ''); pv.setAttribute('aria-hidden', 'true'); pv.className = 'flex shrink-0 justify-center px-4 pb-3'; s.body.before(pv) }
      const key = `${st.type}|${st.prov}|${st.d}|${st.c}|${st.l8}`
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
      a8style: (v, draw, st) => { const s8 = v.dataset.v.split(':')[1]; if (DES8[st.d][1] !== s8) { st.d = s8 === 'modern' ? 'wave' : 'lion'; draw() } },
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

/* ---------- set aside: grouped like the shared picker list (Pockets / Goals) ---------- */
F8.acc_aside = (S) => {
  const D = ds8(S.st)
  let gap = D.short
  const group = ([title, items]) => `<div class="mx-4 mb-3 overflow-hidden ${CARDBOX}"><div class="flex items-center gap-2.5 px-4 pb-1.5 pt-3"><span class="text-[0.8125rem] font-bold text-[var(--color-brand-text-primary)]">${title}</span><span class="font-mono-numbers text-xs ${MUTED}">${items.length}</span></div>${items.map(([k, name, ic, tone, n, where, cib], i) => {
    const amt = n * D.m
    const miss = Math.min(gap, cib * D.m); gap -= miss
    return `<button type="button" data-sa="${name}" class="flex min-h-[64px] w-full items-center gap-3 px-4 py-2.5 text-start hover:bg-[var(--color-brand-elevated)] ${i ? 'border-t border-[var(--color-brand-border)]' : ''}">${pocketMark([k, name, ic, tone], 40)}<span class="min-w-0 flex-1"><span class="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${name}</span><span class="mt-0.5 flex items-center gap-1.5 truncate text-xs ${SECOND}">${where}</span></span><span class="shrink-0 text-end"><span class="block font-mono-numbers text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${f0(amt)}</span>${miss ? `<span class="block whitespace-nowrap font-mono-numbers text-[0.71875rem] font-semibold text-[var(--color-brand-amber)]">${f0(miss)} not covered</span>` : ''}</span>${CHEV}</button>`
  }).join('')}</div>`
  const warn = D.short ? `<button type="button" data-sa-short class="mx-4 mb-3 flex w-[calc(100%-2rem)] items-center gap-3 rounded-2xl bg-[var(--color-brand-amber-soft)] px-3.5 py-3 text-start">${ICON('triangle-alert', 'size-5 shrink-0 text-[var(--color-brand-amber)]')}<span class="min-w-0 flex-1 text-[0.8125rem] leading-[1.45] text-[var(--color-brand-text-primary)]"><b class="font-semibold">CIB is short <span class="font-mono-numbers">${f0(D.short)}</span>.</b> Tell us where the money went.</span>${CHEV}</button>` : ''
  const sh = ltSheet(S, 'Set aside', `${f0(D.aside)} kept for pockets and goals`, `${warn}${ASIDE8.map(group).join('')}<p class="mx-5 mt-1 text-xs leading-relaxed ${MUTED}">Set-aside money stays in its account, so the balance doesn't change. It's left out of Free to spend so you don't spend it by accident.</p>`, '', 120)
  sh.el.addEventListener('click', (e) => { if (e.target.closest('[data-sa-short]')) return F8.acc_short(S); const b = e.target.closest('[data-sa]'); if (b) toast(S, `Opens ${b.dataset.sa}`) })
  return sh
}

/* ---------- shortfall: CIB holds less than what is set aside in it ---------- */
F8.acc_short = (S) => {
  const m = ds8(S.st).m
  const n = 2400 * m
  const CH = [['acct', 'arrow-left-right', 'It’s in another account', `The ${f0(n)} stays set aside, now where the money is`], ['spent', 'receipt', 'I spent it', 'Comes out of Monthly savings first, then Trip to Dahab'], ['keep', 'clock', 'Keep for now', `The rows keep showing Short ${f0(n)} until it’s covered`]]
  const o = {
    title: `CIB is short ${f0(n)}`, z: 160, state: { ch: 'acct', to: 'qnbdeb' },
    body: (st) => `<div class="mx-4 ${CARDBOX} p-4"><p class="flex gap-2.5 text-[0.9375rem] leading-snug text-[var(--color-brand-text-primary)]">${ICON('triangle-alert', 'mt-0.5 size-5 shrink-0 text-[var(--color-brand-amber)]')}<span><b class="font-mono-numbers font-semibold">${f0(n)}</b> of what you set aside isn't in CIB anymore</span></p><div class="mt-3 grid grid-cols-2 gap-2 text-xs"><span class="rounded-xl bg-[var(--color-brand-elevated)] px-3 py-2"><span class="block ${MUTED}">In CIB Current</span><b class="mt-0.5 block font-mono-numbers font-semibold text-[var(--color-brand-text-primary)]">${f0(48600 * m)}</b></span><span class="rounded-xl bg-[var(--color-brand-elevated)] px-3 py-2"><span class="block ${MUTED}">Set aside there</span><b class="mt-0.5 block font-mono-numbers font-semibold text-[var(--color-brand-text-primary)]">${f0(51000 * m)}</b></span></div></div>
      ${sectionHead('What happened?').replace('pt-1', 'pt-5')}<div class="mx-4 divide-y divide-[var(--color-brand-border)] overflow-hidden ${CARDBOX}">${CH.map(([k, ic, t, sub]) => pickRow8(`data-v="set:ch:${k}"`, st.ch === k, icoTile8(ic), t, sub)).join('')}</div>
      ${st.ch === 'acct' ? moveList8(st) : ''}
      <p class="mx-5 mt-3 text-xs leading-relaxed ${MUTED}">Your balances don't change. Only what's set aside moves or is let go.</p>`,
    foot: (st) => foot4(st.ch === 'acct' ? `Move to ${MOVETO8.find((x) => x[0] === st.to)[2].replace(/ ••\d+/, '')}` : st.ch === 'spent' ? `Mark ${f0(n)} as spent` : 'Keep for now'),
    get done() { return this.state.ch === 'acct' ? 'Set-aside money moved' : this.state.ch === 'spent' ? 'Marked as spent' : 'Kept for now' },
  }
  return form4(S, o)
}

/* ---------- closing an account that holds set-aside money ---------- */
F8.acc_close = (S) => {
  const m = ds8(S.st).m
  const items = ASIDE8.flatMap(([, l]) => l).filter((x) => x[6]).map(([k, name, ic, tone, , , cib]) => [k, name, ic, tone, cib])
  const CH = [['acct', 'arrow-left-right', 'It’s in another account', 'Everything set aside moves with it'], ['spent', 'receipt', 'I spent it', 'Nothing stays set aside; goals lose this money']]
  const o = {
    title: 'Where did this money go?', sub: `CIB Current holds ${f0(51000 * m)} set aside`, z: 160, state: { ch: 'acct', to: 'qnbdeb' },
    body: (st) => `<div class="mx-4 divide-y divide-[var(--color-brand-border)] overflow-hidden ${CARDBOX}">${items.map(([k, name, ic, tone, v]) => `<div class="flex min-h-[52px] items-center gap-3 px-4 py-2">${pocketMark([k, name, ic, tone], 32)}<span class="min-w-0 flex-1 truncate text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]">${name}</span><span class="font-mono-numbers text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${f0(v * m)}</span></div>`).join('')}</div>
      ${sectionHead('Before CIB Current closes').replace('pt-1', 'pt-5')}<div class="mx-4 divide-y divide-[var(--color-brand-border)] overflow-hidden ${CARDBOX}">${CH.map(([k, ic, t, sub]) => pickRow8(`data-v="set:ch:${k}"`, st.ch === k, icoTile8(ic), t, sub)).join('')}</div>
      ${st.ch === 'acct' ? moveList8(st, false) : ''}
      <p class="mx-5 mt-3 text-xs leading-relaxed ${MUTED}">Its history stays in Flow. A closed account counts 0 in your net worth.</p>`,
    foot: () => foot4('Close CIB Current', '', true), done: 'CIB Current closed',
  }
  return form4(S, o)
}

/* ---------- add menu (QuickAddFAB): Expense, Money in, Goal, Card ---------- */
F8.acc_addmenu = (S) => {
  const tint = (v) => [`color-mix(in oklab, ${v} 16%, transparent)`, v]
  const tiles = [
    [ICON('banknote-arrow-up', 'size-[19px]'), 'Expense', 'Cash or card', ['var(--color-brand-primary-soft)', 'var(--color-brand-primary-ink)']],
    [ICON('banknote-arrow-down', 'size-[19px]'), 'Money in', 'Gift, refund, sale', ['var(--color-brand-green-soft)', 'var(--color-brand-green)']],
    [ICON('target', 'size-[19px]'), 'Goal', 'Save toward a target', tint('var(--color-brand-gold)')],
    [ICON('wallet-cards', 'size-[19px]'), 'Card', 'No account needed', tint('var(--color-cat-5)'), 'card'],
  ]
  const body = `<div class="grid min-w-0 grid-cols-2 gap-2 px-4 pb-5">${tiles.map(([ic, l, h, [bg, fg], k]) => `<button type="button" data-qa="${k || l}" class="relative flex min-h-[64px] w-full min-w-0 items-center gap-2.5 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-3.5 text-start hover:bg-[var(--color-brand-sunken)]"><span class="flex size-9 shrink-0 items-center justify-center rounded-[10px]" style="background:${bg};color:${fg}">${ic}</span><span class="flex min-w-0 flex-1 flex-col gap-px"><span class="truncate text-sm font-bold leading-[1.25] text-[var(--color-brand-text-primary)]">${l}</span><span class="line-clamp-2 text-[0.71875rem] leading-[1.3] text-[var(--color-brand-text-secondary)]">${h}</span></span></button>`).join('')}</div>`
  const sh = ltSheet(S, 'Add', '', body, '', 150)
  sh.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-qa]'); if (!b) return
    const k = b.dataset.qa
    sh.close()
    if (k === 'card') return a8AddCard(S, {})
    toast(S, `Opens ${k}`)
  })
  return sh
}

/* ---------- sheet bar entries ---------- */
F8.acc_card = (S) => F8.card8(S, 'cibcc')
F8.acc_pay = (S) => pay8(S, 'qnb')
F8.acc_cardqnb = (S) => F8.card8(S, 'qnb')
T8.acc_cardqnb = (S) => AFTER.card(S)
F8.acc_addcard = (S) => a8AddCard(S, {})
F8.acc_addcardkb = (S) => a8AddCard(S, { prov: 'CIB', last4: '77', kb: true })
T8.acc_card = (S) => AFTER.card(S)
T8.acc_addcard = (S) => AFTER.addcard(S)
T8.acc_addcardkb = (S) => AFTER.addcard(S)
T8.acc_aside = (S) => AFTER.setaside(S)
SHEETS8.push(['acc_card', 'Card · credit (Pay card)'], ['acc_cardqnb', 'Card · with 2 plans'], ['acc_pay', 'Pay card · plans due'], ['acc_addcard', 'Add card'], ['acc_addcardkb', 'Add card · keyboard open'], ['acc_aside', 'Set aside list'], ['acc_short', 'Shortfall · CIB short'], ['acc_close', 'Close account · where did it go'], ['acc_addmenu', 'Add menu · Card tile'])
NEW9.push('accounts', 'acc_card', 'acc_cardqnb', 'acc_pay', 'acc_addcard', 'acc_aside', 'acc_short', 'acc_close', 'acc_addmenu')

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
  if (hit('[data-a8-short]')) { stop(); return F8.acc_short(S) }
  const stack = hit('[data-a8-stack]')
  if (stack && stack.dataset.open !== 'true' && hit('[data-a8-card]')) { stop(); S.st.a8spread = stack.dataset.a8Stack; return render(S) }
  if ((b = hit('[data-a8-card]'))) { stop(); return F8.card8(S, b.dataset.a8Card) }
  if ((b = hit('[data-a8-addcard]'))) { stop(); return a8AddCard(S, { prov: b.dataset.a8Addcard }) }
  if (hit('[data-a8-addacct]')) { stop(); return AFTER.addaccount(S) }
  if ((b = hit('[data-a8-acct]'))) { stop(); return ltAcctSheet(S, b.dataset.a8Acct) }
  if ((b = hit('[data-a8-prov]'))) { stop(); if (b.dataset.a8Prov !== 'cib') return toast(S, 'The sample opens CIB'); S.st.a8prov = 'cib'; S.st.a8exact = null; S.scroll.scrollTop = 0; return render(S) }
  if (hit('[data-a8-back]')) { stop(); S.st.a8prov = null; S.st.a8exact = null; return render(S) }
  if (hit('[data-a8-provmenu]')) { stop(); return menu8(S, 'CIB', [[ICON('pencil', `size-[18px] ${SECOND}`), 'Edit name', 'Opens the provider name'], [ICON('archive', `size-[18px] ${SECOND}`), 'Close CIB Current', () => F8.acc_close(S)], [ICON('history', `size-[18px] ${SECOND}`), 'Closed accounts · 2', 'Shows 2 closed accounts; their history is kept'], [ICON('trash-2', 'size-[18px]'), 'Delete CIB', 'Deletes CIB and its accounts after you confirm', true]]) }
}, true)
}
