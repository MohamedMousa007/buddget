import type { PaymentMethod } from '@/lib/store/types'
import { CARD_THEMES, cardLook } from './cardThemes'
import { parseHex } from '@/lib/ui/contrast'

/**
 * Card faces of the final UI (v9): a design drawn on a 340×214 face plus one of five colours, no lighting.
 * Modern designs are textures; Classic designs are generic motifs of well-known bank cards (no bank marks).
 * Stored in `cardTheme` as "v9:<design>:<colour>" (the column is free text, 32 chars); `cardStyle` keeps
 * 'metal' (Modern) or 'bank' (Classic) so its check constraint and older readers still hold.
 */
export const MODERN_DESIGNS = ['wave', 'metal', 'chrome', 'glass', 'carbon', 'contour', 'grain'] as const
export const CLASSIC_DESIGNS = ['lion', 'guilloche', 'facet', 'globe', 'twotone', 'ribbon', 'emboss'] as const
export type CardDesign = (typeof MODERN_DESIGNS)[number] | (typeof CLASSIC_DESIGNS)[number]
export type CardFamily = 'modern' | 'classic'

export const CARD_COLOURS = { black: ['#2a2b30', '#0e0f12'], teal: ['#0f6e64', '#073c37'], navy: ['#203872', '#0b1634'], sand: ['#6e5b40', '#463a29'], rose: ['#9a4560', '#5a2034'] } as const
export type CardColour = keyof typeof CARD_COLOURS
export const CARD_COLOUR_KEYS = Object.keys(CARD_COLOURS) as CardColour[]

export interface FaceDesign {
  design: CardDesign
  colour: CardColour
}

const DESIGNS = new Set<string>([...MODERN_DESIGNS, ...CLASSIC_DESIGNS])
export const familyOf = (d: CardDesign): CardFamily => ((MODERN_DESIGNS as readonly string[]).includes(d) ? 'modern' : 'classic')

export function encodeFace(f: FaceDesign): { cardStyle: 'metal' | 'bank'; cardTheme: string } {
  return { cardStyle: familyOf(f.design) === 'modern' ? 'metal' : 'bank', cardTheme: `v9:${f.design}:${f.colour}` }
}

export function parseFace(theme: string | null | undefined): FaceDesign | null {
  const m = /^v9:([a-z]+):([a-z]+)$/.exec(theme ?? '')
  if (!m || !DESIGNS.has(m[1]) || !(m[2] in CARD_COLOURS)) return null
  return { design: m[1] as CardDesign, colour: m[2] as CardColour }
}

/** The colour nearest (RGB distance of gradient midpoints) to an older theme. */
function nearestColour(a: string, b: string): CardColour {
  const ca = parseHex(a)
  const cb = parseHex(b)
  if (!ca || !cb) return 'black'
  const mid = [0, 1, 2].map((i) => (ca[i] + cb[i]) / 2)
  let best: CardColour = 'black'
  let bestD = Infinity
  for (const k of CARD_COLOUR_KEYS) {
    const [x, y] = CARD_COLOURS[k].map((h) => parseHex(h)!)
    const d = [0, 1, 2].reduce((s, i) => s + (mid[i] - (x[i] + y[i]) / 2) ** 2, 0)
    if (d < bestD) { bestD = d; best = k }
  }
  return best
}

/** Total: every method gets a face. A card saved before v9 keeps its finish (metal → Metal, bank → Guilloche) in its nearest colour. */
export function faceOf(m: Pick<PaymentMethod, 'cardStyle' | 'cardTheme' | 'color' | 'type'>): FaceDesign {
  const saved = parseFace(m.cardTheme)
  if (saved) return saved
  const { style, theme } = cardLook(m)
  const t = CARD_THEMES[theme]
  return { design: style === 'metal' ? 'metal' : 'guilloche', colour: nearestColour(t.a, t.b) }
}

/* ---------- drawing (340×214 viewBox) ---------- */
const r1 = (n: number) => n.toFixed(1)
const sq = (x: number, y: number, s: number) => `M${r1(x)} ${r1(y)}h${r1(s)}v${r1(s)}h-${r1(s)}z`
const rng = (seed: number) => { let s = seed; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) }
/** Text zones: patterns stay quiet here so white text keeps 4.5:1. */
const quiet = (x: number, y: number) => (x < 175 && y < 62) || (x > 272 && y < 40) || (y > 150 && x < 300)
type Pt = [number | string, number | string]
const poly = (pts: Pt[]) => `M${pts.map(([x, y]) => `${x} ${y}`).join('L')}Z`
const star = (cx: number, cy: number, n: number, r0: number, r2: number) =>
  poly(Array.from({ length: n * 2 }, (_, i) => { const t = (i / (n * 2)) * 2 * Math.PI - Math.PI / 2; const r = i % 2 ? r0 : r2; return [r1(cx + r * Math.cos(t)), r1(cy + r * Math.sin(t))] as Pt }))

/** Heraldic lion rampant, facing left, in a 100×110 box. */
const LION = [
  star(42, 24, 11, 12, 17),
  poly([[33, 15], [22, 18], [18, 24], [22, 30], [32, 33]]),
  poly([[21, 27], [12, 29], [15, 26], [11, 23], [20, 25]]),
  poly([[36, 34], [50, 32], [62, 54], [71, 72], [65, 83], [54, 79], [44, 58]]),
  poly([[40, 36], [30, 30], [20, 23], [13, 20], [10, 24], [13, 25], [11, 28], [18, 29], [28, 37], [39, 45]]),
  poly([[44, 48], [31, 51], [21, 50], [15, 53], [17, 55], [15, 58], [22, 57], [32, 58], [46, 56]]),
  poly([[61, 76], [57, 90], [51, 101], [44, 103], [43, 107], [57, 107], [64, 93], [71, 80]]),
  poly([[57, 71], [45, 79], [35, 83], [29, 86], [30, 90], [37, 90], [49, 86], [63, 78]]),
  poly([[86, 20], [95, 22], [93, 28], [99, 32], [91, 34], [86, 28]]),
].join('')
const LION_TAIL = 'M68 76C86 74 84 58 80 48C76 38 82 30 89 29'
const lion = (x: number, y: number, s: number, fill: string) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><path d="${LION}" fill="${fill}"/><path d="${LION_TAIL}" fill="none" stroke="${fill}" stroke-width="4" stroke-linecap="round"/></g>`
const FRAME = '<rect x="7" y="7" width="326" height="200" rx="9" fill="none" stroke="rgba(255,255,255,.14)" stroke-width=".8"/>'

const GEN: Record<CardDesign, (mini: boolean) => string> = {
  /* voxel wave: raised squares whose size follows a smooth diagonal wave */
  wave: (mini) => {
    const P = mini ? 14 : 8
    const env = (x: number, y: number) => 0.32 + 0.68 * Math.exp(-((y - (214 - 0.63 * x)) ** 2) / (2 * 62 ** 2))
    const H = (x: number, y: number) => env(x, y) * (0.5 + 0.5 * Math.sin((x + 1.25 * y - 300) / 46 + Math.PI / 2 + 0.5 * Math.sin(x / 110)))
    const tops = new Map<number, string>()
    for (let x0 = 1; x0 < 340; x0 += P) for (let y0 = 1; y0 < 214; y0 += P) {
      const cx = x0 + P / 2
      const cy = y0 + P / 2
      const h = H(cx, cy)
      const s = P * (0.5 + 0.3 * h)
      const a = (0.07 + 0.1 * h) * (quiet(cx, cy) ? 0.32 : 1)
      const k = Math.round(a * 50) / 50
      tops.set(k, (tops.get(k) ?? '') + sq(x0 + (P - s) / 2, y0 + (P - s) / 2, s))
    }
    return [...tops].map(([k, d]) => `<path d="${d}" fill="rgba(255,255,255,${k})"/>`).join('')
  },
  /* brushed metal: fine hairlines */
  metal: () => {
    const R = rng(7)
    let lo = ''
    let hi = ''
    for (let y = 0; y < 214; y += 0.8) for (let j = 0; j < 2; j++) {
      const x = R() * 380 - 30
      const w = 30 + R() * 260
      const seg = `M${r1(x)} ${r1(y + R() * 0.6)}h${r1(w)}`
      if (R() > 0.5) hi += seg
      else lo += seg
    }
    return `<path d="${lo}" stroke="rgba(0,0,0,.16)" stroke-width=".5"/><path d="${hi}" stroke="rgba(255,255,255,.07)" stroke-width=".5"/>`
  },
  /* liquid chrome: flowing bands (the layer is blurred) */
  chrome: () => {
    const y = (i: number, x: number) => -30 + i * 27 + 16 * Math.sin(x / 58 + i * 0.7) + 9 * Math.sin(x / 21 - i * 1.3)
    const line = (i: number, back = false) => {
      const xs = Array.from({ length: 36 }, (_, k) => k * 10 - 5)
      return (back ? xs.reverse() : xs).map((x, k) => `${k || back ? 'L' : 'M'}${x} ${r1(y(i, x))}`).join('')
    }
    let out = ''
    for (let i = 0; i < 10; i++) {
      const mid = 1 - Math.abs(i - 5) / 6
      const fill = i % 2 ? `rgba(0,0,0,${(0.25 + 0.25 * mid).toFixed(2)})` : `rgba(255,255,255,${(0.06 + 0.1 * mid).toFixed(2)})`
      out += `<path d="${line(i)}${line(i + 1, true)}Z" fill="${fill}"/>`
    }
    return out
  },
  /* frosted glass: soft shapes behind a frosted sheet (the layer is blurred) */
  glass: () => '<circle cx="250" cy="70" r="70" fill="rgba(255,255,255,.16)"/><circle cx="190" cy="105" r="48" fill="rgba(120,210,255,.28)"/><circle cx="330" cy="200" r="55" fill="rgba(255,170,220,.22)"/><rect x="160" y="-20" width="40" height="260" transform="rotate(25 180 107)" fill="rgba(255,255,255,.06)"/>',
  carbon: () => '',
  contour: () => {
    let d = ''
    for (const [cx, cy, n, ph] of [[288, 30, 13, 0], [36, 210, 8, 2]]) for (let i = 0; i < n; i++) {
      const r = 12 + i * 14
      for (let k = 0; k <= 72; k++) {
        const t = (k / 72) * 2 * Math.PI
        const rr = r * (1 + 0.13 * Math.sin(3 * t + ph + i * 0.35) + 0.06 * Math.sin(5 * t - i * 0.5))
        d += `${k ? 'L' : 'M'}${r1(cx + rr * Math.cos(t))} ${r1(cy + rr * 0.82 * Math.sin(t))}`
      }
      d += 'Z'
    }
    return `<path d="${d}" fill="none" stroke="rgba(255,255,255,.17)" stroke-width="1"/>`
  },
  grain: () => '',
  /* heraldic lion: a lozenge lattice with a small lion in each diamond, the large embossed lion on the right */
  lion: () => {
    let lat = ''
    let small = ''
    for (let k = -12; k < 20; k++) lat += `M${k * 34} 0l214 214M${k * 34 + 214} 0l-214 214`
    for (let r = 0; r < 8; r++) for (let c = 0; c < 12; c++) {
      const x = c * 34 + (r % 2 ? 17 : 0) - 8
      if (x > 200) continue
      small += lion(x, r * 34 - 9, 0.15, 'rgba(255,255,255,.09)')
    }
    return `<path d="${lat}" stroke="rgba(255,255,255,.07)" stroke-width=".6"/>${small}${lion(214, 28, 1.42, 'rgba(0,0,0,.35)')}${lion(211, 25, 1.42, 'rgba(255,255,255,.22)')}${lion(212, 26, 1.42, 'rgba(255,255,255,.07)')}${FRAME}`
  },
  guilloche: () => {
    let d = ''
    for (let j = 0; j < 6; j++) {
      const R = 58 + j * 7
      const A = 20 - j * 2.2
      for (let i = 0; i <= 540; i++) { const t = (i / 540) * 2 * Math.PI; d += `${i ? 'L' : 'M'}${r1(292 + R * Math.cos(t) + A * Math.cos(18 * t + j * 0.5))} ${r1(48 + R * Math.sin(t) + A * Math.sin(18 * t + j * 0.5))}` }
      d += 'Z'
    }
    for (let j = 0; j < 8; j++) { const y0 = 197 + j * 3; d += `M-5 ${y0}`; for (let x = 0; x <= 345; x += 15) d += `L${x} ${r1(y0 + 3 * Math.sin(x / 18 + j * 0.6))}` }
    return `<path d="${d}" fill="none" stroke="rgba(255,255,255,.15)" stroke-width=".7"/>${FRAME}`
  },
  /* cut-gem triangulation, brighter at the top right */
  facet: () => {
    const R = rng(11)
    const cols = 9
    const rows = 6
    const pt: [number, number][] = []
    for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) pt.push([c * 340 / cols + (c % cols && r % rows ? (R() - 0.5) * 26 : 0), r * 214 / rows + (r % rows && c % cols ? (R() - 0.5) * 22 : 0)])
    const fills = new Map<number, string>()
    const p = (cc: number, rr: number) => pt[rr * (cols + 1) + cc]
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      for (const tri of [[p(c, r), p(c + 1, r), p(c + 1, r + 1)], [p(c, r), p(c + 1, r + 1), p(c, r + 1)]]) {
        const mx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3
        const my = (tri[0][1] + tri[1][1] + tri[2][1]) / 3
        let a = 0.02 + 0.2 * Math.exp(-((mx - 270) ** 2 + (my - 40) ** 2) / 9000) + R() * 0.06
        if (quiet(mx, my)) a *= 0.5
        const k = Math.round(a * 50) / 50
        fills.set(k, (fills.get(k) ?? '') + poly(tri.map(([x, y]) => [r1(x), r1(y)] as Pt)))
      }
    }
    return `${[...fills].map(([k, d]) => `<path d="${d}" fill="rgba(255,255,255,${k})"/>`).join('')}<path d="${[...fills.values()].join('')}" fill="none" stroke="rgba(255,255,255,.1)" stroke-width=".6"/>`
  },
  /* dotted globe with meridians */
  globe: () => {
    const cx = 272
    const cy = 112
    const R = 118
    let lines = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="rgba(255,255,255,.18)" stroke-width=".8"/>`
    for (const k of [0.25, 0.55, 0.8]) lines += `<ellipse cx="${cx}" cy="${cy}" rx="${r1(R * k)}" ry="${R}" fill="none" stroke="rgba(255,255,255,.1)" stroke-width=".7"/>`
    for (const f of [-0.6, -0.3, 0, 0.3, 0.6]) { const yy = cy + R * f; const hw = R * Math.sqrt(1 - f * f); lines += `<path d="M${r1(cx - hw)} ${r1(yy)}H${r1(cx + hw)}" stroke="rgba(255,255,255,.1)" stroke-width=".7"/>` }
    let dots = ''
    for (let x = cx - R; x < cx + R; x += 5) for (let y = cy - R; y < cy + R; y += 5) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > (R - 4) ** 2 || quiet(x, y)) continue
      if (Math.sin(x / 19) + Math.cos(y / 14) + Math.sin((x + y) / 31) > 0.7) dots += `M${x} ${y}h1.6v1.6h-1.6z`
    }
    return `${lines}<path d="${dots}" fill="rgba(255,255,255,.34)"/>`
  },
  twotone: () => '<path d="M178 0H340V214H248Z" fill="rgba(255,255,255,.10)"/><path d="M0 0H178L248 214H0Z" fill="rgba(0,0,0,.18)"/><path d="M178 0L248 214" stroke="rgba(255,255,255,.4)" stroke-width="1.2"/><path d="M186 0L256 214" stroke="rgba(255,255,255,.12)" stroke-width=".8"/>',
  ribbon: () => [0, 1, 2, 3].map((j) => `<path d="M-10 ${118 + j * 13}C90 ${58 + j * 13} 200 ${188 + j * 9} 350 ${38 + j * 15}L350 ${54 + j * 15}C200 ${204 + j * 9} 90 ${74 + j * 13} -10 ${134 + j * 13}Z" fill="rgba(255,255,255,${(0.05 + j * 0.035).toFixed(3)})"/>`).join('') + '<path d="M-10 118C90 58 200 188 350 38" fill="none" stroke="rgba(255,255,255,.3)" stroke-width=".8"/>',
  emboss: () => [[150, 10], [118, 3], [92, 1.5]].map(([r, w]) => `<circle cx="302" cy="204" r="${r}" fill="none" stroke="rgba(0,0,0,.3)" stroke-width="${w}" transform="translate(1.3 1.3)"/><circle cx="302" cy="204" r="${r}" fill="none" stroke="rgba(255,255,255,.17)" stroke-width="${w}" transform="translate(-.8 -.8)"/>`).join(''),
}

const CACHE = new Map<string, string>()
/** The design's SVG markup (static, generated here; never user input), cached per design and size class. */
export function facePattern(design: CardDesign, mini: boolean): string {
  const key = `${design}|${mini}`
  let v = CACHE.get(key)
  if (v === undefined) { v = GEN[design](mini); CACHE.set(key, v) }
  return v
}

/** Blur on the pattern layer at full size (chrome, glass), scaled with the face. */
export const FACE_BLUR: Partial<Record<CardDesign, number>> = { chrome: 2.2, glass: 18 }

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .16 0'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E")`
const CARBON = `url("data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'><defs><linearGradient id='h' x2='0' y2='1'><stop offset='0' stop-color='#fff' stop-opacity='.2'/><stop offset='.45' stop-color='#fff' stop-opacity='.04'/><stop offset='1' stop-color='#000' stop-opacity='.5'/></linearGradient><linearGradient id='v' x2='1' y2='0'><stop offset='0' stop-color='#fff' stop-opacity='.12'/><stop offset='.45' stop-color='#fff' stop-opacity='.02'/><stop offset='1' stop-color='#000' stop-opacity='.55'/></linearGradient></defs><rect width='4' height='4' fill='url(#h)'/><rect x='4' y='4' width='4' height='4' fill='url(#h)'/><rect x='4' width='4' height='4' fill='url(#v)'/><rect y='4' width='4' height='4' fill='url(#v)'/></svg>").replace(/'/g, '%27')}")`

/** The face's CSS background; `scale` = rendered width / 340 (the carbon weave keeps a readable tile). */
export function faceBackground(f: FaceDesign, scale = 1): string {
  const [a, b] = CARD_COLOURS[f.colour]
  const base = `linear-gradient(135deg, ${a} 0%, ${b} 100%)`
  if (f.design === 'grain') return `${GRAIN}, radial-gradient(90% 80% at 0% 100%, rgba(0,0,0,.4), transparent 62%), ${base}`
  if (f.design === 'carbon') { const t = r1(Math.max(3, 7 * scale)); return `${CARBON} 0 0/${t}px ${t}px, ${base}` }
  if (f.design === 'glass') return `${GRAIN}, ${base}`
  if (f.design === 'metal') return `linear-gradient(180deg, rgba(255,255,255,.10), rgba(0,0,0,.2)), ${base}`
  return base
}

/** Modern faces keep a text scrim (no light) so white text stays at 4.5:1. */
export const MODERN_SCRIM = 'linear-gradient(180deg, rgba(0,0,0,.28) 0%, transparent 30%, transparent 62%, rgba(0,0,0,.34) 100%)'
