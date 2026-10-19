/**
 * Locally drawn avatar set. Every character is layered SVG built from traits
 * (background, body, head, face, hair, accessory), so it renders offline, costs no
 * network request, and adding a character is one row in {@link ROWS}.
 *
 * The preset id lives in `profile.avatarPresetId`. A background override rides in the
 * same string as `id:backgroundKey` so no schema change is needed.
 */

export type AvatarGroup = 'crew' | 'people' | 'headwear'

export interface AvatarPreset {
  id: string
  label: string
  group: AvatarGroup
}

export interface AvatarBackground {
  key: string
  main: string
  soft: string
}

export const AVATAR_BACKGROUNDS: readonly AvatarBackground[] = [
  { key: 'teal', main: '#12B0A0', soft: '#7FE0D3' },
  { key: 'coral', main: '#FF7A59', soft: '#FFB199' },
  { key: 'sun', main: '#FFC83D', soft: '#FFE08A' },
  { key: 'violet', main: '#8B6CFF', soft: '#B9A6FF' },
  { key: 'sky', main: '#4DA3FF', soft: '#9CCBFF' },
  { key: 'pink', main: '#FF6FB1', soft: '#FFA8D0' },
  { key: 'lime', main: '#B6E04A', soft: '#D9F08F' },
  { key: 'navy', main: '#243B6B', soft: '#3F5C9E' },
  { key: 'orange', main: '#FF9A3C', soft: '#FFC48A' },
  { key: 'mint', main: '#5FE0A8', soft: '#A6F0CF' },
  { key: 'slate', main: '#3B4252', soft: '#5B657A' },
  { key: 'rose', main: '#F25F7A', soft: '#FF9FB0' },
]

const BG = Object.fromEntries(AVATAR_BACKGROUNDS.map((b) => [b.key, b])) as Record<string, AvatarBackground>

const SKIN: Record<string, string> = {
  s1: '#FBD5B5', s2: '#F2C29B', s3: '#E0A878', s4: '#C68642', s5: '#A9693A', s6: '#8D5524', s7: '#6B3E1F', s8: '#4A2A15',
  h1: '#12B0A0', h2: '#F4F7F6', h3: '#FF7A59', h4: '#8B6CFF', h5: '#FFC83D', h6: '#4DA3FF',
}
const HAIR: Record<string, string> = {
  ink: '#1B1B1F', brown: '#3B2314', chest: '#6B3F1D', ginger: '#B5651D', blond: '#D8A657', red: '#D34A4A',
  violet: '#8B6CFF', teal: '#12B0A0', white: '#F4F4F4', black: '#14161A', pink: '#FF6FB1', gold: '#F5C842', coral: '#FF7A59',
}
const CLOTH: Record<string, string> = {
  teal: '#0D8578', white: '#F4F7F6', black: '#1F2430', coral: '#E8654A', sun: '#F2B724',
  violet: '#6D4FD1', denim: '#2F5D9E', olive: '#6B7A3A', rose: '#D6455F', navy: '#243B6B',
}

type HairId =
  | 'short' | 'curly' | 'long' | 'bun' | 'afro' | 'buzz' | 'mohawk'
  | 'hijab' | 'ghutra' | 'cap' | 'beanie' | 'bot0' | 'bot1' | 'bot2'

const ACCESSORIES = ['none', 'shades', 'round', 'phones', 'chain', 'earring'] as const

// id, label, group, background, skin/helmet, hair/accent, cloth, hair, head, face, accessory, body, bgShape
type Row = [string, string, AvatarGroup, string, string, string, string, HairId, 0 | 1, 0 | 1 | 2 | 3, number, 0 | 1 | 2 | 3, 0 | 1 | 2 | 3]

const ROWS: readonly Row[] = [
  ['byte', 'Byte', 'crew', 'navy', 'h1', 'gold', 'teal', 'bot0', 0, 0, 0, 0, 1],
  ['pixel', 'Pixel', 'crew', 'sun', 'h2', 'coral', 'black', 'bot1', 0, 0, 0, 0, 2],
  ['zap', 'Zap', 'crew', 'violet', 'h5', 'black', 'navy', 'bot2', 0, 0, 0, 0, 3],
  ['echo', 'Echo', 'crew', 'mint', 'h6', 'white', 'teal', 'bot0', 0, 0, 0, 0, 1],
  ['orbit', 'Orbit', 'crew', 'coral', 'h4', 'gold', 'black', 'bot1', 0, 0, 0, 0, 2],
  ['nova', 'Nova', 'crew', 'slate', 'h3', 'teal', 'white', 'bot2', 0, 0, 0, 0, 3],
  ['layla', 'Layla', 'people', 'sky', 's2', 'ink', 'coral', 'long', 0, 0, 5, 0, 1],
  ['omar', 'Omar', 'people', 'teal', 's4', 'ink', 'navy', 'short', 1, 1, 1, 2, 0],
  ['sara', 'Sara', 'people', 'pink', 's1', 'ginger', 'violet', 'bun', 0, 3, 0, 1, 3],
  ['karim', 'Karim', 'people', 'sun', 's5', 'ink', 'black', 'buzz', 1, 2, 4, 0, 2],
  ['nour', 'Nour', 'people', 'violet', 's3', 'brown', 'white', 'curly', 0, 0, 2, 1, 1],
  ['ziad', 'Ziad', 'people', 'lime', 's6', 'ink', 'denim', 'afro', 1, 3, 3, 0, 3],
  ['mona', 'Mona', 'people', 'rose', 's2', 'chest', 'sun', 'long', 1, 1, 5, 3, 2],
  ['hady', 'Hady', 'people', 'orange', 's7', 'teal', 'black', 'mohawk', 0, 2, 1, 1, 1],
  ['yara', 'Yara', 'people', 'mint', 's1', 'violet', 'teal', 'bun', 1, 3, 0, 0, 1],
  ['tarek', 'Tarek', 'people', 'navy', 's3', 'brown', 'olive', 'short', 0, 0, 0, 2, 3],
  ['dina', 'Dina', 'people', 'coral', 's5', 'ink', 'white', 'curly', 1, 2, 5, 0, 2],
  ['sami', 'Sami', 'people', 'sky', 's8', 'ink', 'coral', 'buzz', 0, 3, 4, 3, 1],
  ['rania', 'Rania', 'people', 'teal', 's4', 'ginger', 'violet', 'long', 1, 0, 2, 2, 3],
  ['adam', 'Adam', 'people', 'slate', 's2', 'blond', 'teal', 'short', 0, 1, 3, 1, 2],
  ['jana', 'Jana', 'people', 'pink', 's6', 'red', 'denim', 'curly', 1, 3, 1, 0, 1],
  ['khaled', 'Khaled', 'people', 'sun', 's3', 'ink', 'rose', 'short', 1, 2, 0, 0, 3],
  ['hana', 'Hana', 'headwear', 'violet', 's2', 'teal', 'white', 'hijab', 0, 0, 0, 0, 1],
  ['amal', 'Amal', 'headwear', 'sun', 's4', 'black', 'coral', 'hijab', 1, 3, 0, 1, 2],
  ['salma', 'Salma', 'headwear', 'mint', 's1', 'violet', 'black', 'hijab', 0, 1, 2, 0, 3],
  ['noor', 'Noor', 'headwear', 'coral', 's5', 'pink', 'white', 'hijab', 1, 0, 0, 3, 1],
  ['faisal', 'Faisal', 'headwear', 'sky', 's3', 'white', 'white', 'ghutra', 0, 1, 0, 0, 2],
  ['rashid', 'Rashid', 'headwear', 'navy', 's4', 'red', 'white', 'ghutra', 1, 2, 1, 0, 1],
  ['jad', 'Jad', 'headwear', 'lime', 's5', 'teal', 'black', 'cap', 0, 0, 0, 1, 3],
  ['maro', 'Maro', 'headwear', 'orange', 's2', 'black', 'white', 'cap', 1, 3, 4, 0, 2],
  ['lina', 'Lina', 'headwear', 'pink', 's3', 'violet', 'denim', 'beanie', 0, 3, 0, 1, 1],
  ['yousef', 'Yousef', 'headwear', 'teal', 's6', 'gold', 'black', 'beanie', 1, 2, 3, 0, 3],
]

export const AVATAR_PRESETS: readonly AvatarPreset[] = ROWS.map((r) => ({ id: r[0], label: r[1], group: r[2] }))
export const AVATAR_GROUPS: readonly AvatarGroup[] = ['crew', 'people', 'headwear']
export const DEFAULT_AVATAR_ID = 'byte'

const ROW_BY_ID = new Map(ROWS.map((r) => [r[0], r]))

interface Palette {
  skin: string
  skin2: string
  hair: string
  hair2: string
  cloth: string
  cloth2: string
  bg2: string
}

const INK = '#16181D'
const GOLD = '#F5C842'
const EYE = '#5FE0D1'

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const mix = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 - amount))))
  const r = mix((n >> 16) & 255)
  const g = mix((n >> 8) & 255)
  const b = mix(n & 255)
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`
}

const bgShape = (i: number, p: Palette) =>
  [
    '',
    `<circle cx="50" cy="46" r="36" fill="${p.bg2}"/>`,
    `<path d="M0 64L100 28V100H0Z" fill="${p.bg2}"/>`,
    `<g fill="${p.bg2}"><circle cx="16" cy="20" r="11"/><circle cx="87" cy="30" r="6"/><circle cx="78" cy="10" r="3"/></g>`,
  ][i]

const neck = (p: Palette) => `<rect x="42" y="56" width="16" height="22" fill="${p.skin2}"/>`
const torso = (p: Palette) => `<path d="M8 100C8 80 28 71 50 71S92 80 92 100Z" fill="${p.cloth}"/>`

const body = (i: number, p: Palette) =>
  [
    `${neck(p)}${torso(p)}<path d="M39 71Q50 84 61 71Z" fill="${p.skin2}"/>`,
    `${neck(p)}${torso(p)}<path d="M32 72Q50 92 68 72L64 66Q50 80 36 66Z" fill="${p.cloth2}"/><path d="M45 82v9M55 82v9" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round" opacity=".5"/>`,
    `${neck(p)}${torso(p)}<path d="M41 71L50 94L59 71Z" fill="#fff"/><path d="M41 71L50 94L34 100L28 79ZM59 71L50 94L66 100L72 79Z" fill="${p.cloth2}"/>`,
    `${neck(p)}${torso(p)}<path d="M39 71L50 83L61 71" fill="none" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M18 100V85M82 100V85" fill="none" stroke="${GOLD}" stroke-width="4"/>`,
  ][i]

const head = (i: number, p: Palette) =>
  i === 0
    ? `<circle cx="31" cy="47" r="4.2" fill="${p.skin}"/><circle cx="69" cy="47" r="4.2" fill="${p.skin}"/><ellipse cx="50" cy="44" rx="19" ry="22" fill="${p.skin}"/><path d="M50 46q-2.4 5 .8 6.4" fill="none" stroke="${shade(p.skin, 0.24)}" stroke-width="1.6" stroke-linecap="round"/>`
    : `<circle cx="29" cy="48" r="4.2" fill="${p.skin}"/><circle cx="71" cy="48" r="4.2" fill="${p.skin}"/><ellipse cx="50" cy="45" rx="21" ry="21" fill="${p.skin}"/><path d="M50 47q-2.4 5 .8 6.4" fill="none" stroke="${shade(p.skin, 0.24)}" stroke-width="1.6" stroke-linecap="round"/>`

const BLUSH = (cx: number) => `<circle cx="${cx}" cy="52" r="3" fill="#ff6b6b" opacity=".22"/>`

const face = (i: number) =>
  [
    `<circle cx="42" cy="43" r="2.5" fill="${INK}"/><circle cx="58" cy="43" r="2.5" fill="${INK}"/>${BLUSH(37)}${BLUSH(63)}<path d="M43 56Q50 61 57 56" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`,
    `<path d="M37 43h9M54 43h9" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/><path d="M45 56h10" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`,
    `<circle cx="42" cy="44" r="2.5" fill="${INK}"/><circle cx="58" cy="44" r="2.5" fill="${INK}"/><path d="M37 37l8 1.8M63 37l-8 1.8" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/><path d="M44 56Q51 58 57 52" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`,
    `<path d="M37 45q4-5 8 0M55 45q4-5 8 0" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/><path d="M44 54h12q-1 7-6 7t-6-7z" fill="${INK}"/>${BLUSH(36)}${BLUSH(64)}`,
  ][i]

const BOT_BODY = (p: Palette) => `<path d="M18 100C18 82 32 74 50 74S82 82 82 100Z" fill="${p.cloth}"/>`
const VISOR = `<rect x="33" y="38" width="34" height="19" rx="9.5" fill="#14161A"/>`

function hairBack(id: HairId, p: Palette): string {
  switch (id) {
    case 'long': return `<path d="M27 46C24 14 76 14 73 46L77 82C66 88 34 88 23 82Z" fill="${p.hair}"/>`
    case 'afro': return `<circle cx="50" cy="33" r="30" fill="${p.hair}"/>`
    case 'ghutra': return `<path d="M23 42C21 10 79 10 77 42L86 86H14Z" fill="${p.hair}"/>`
    case 'bot0': return `${BOT_BODY(p)}<path d="M50 12V26" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><circle cx="50" cy="11" r="4.5" fill="${p.hair}"/><rect x="19" y="42" width="9" height="15" rx="4.5" fill="${p.hair}"/><rect x="72" y="42" width="9" height="15" rx="4.5" fill="${p.hair}"/><rect x="26" y="24" width="48" height="46" rx="19" fill="${p.skin}"/>${VISOR}<circle cx="43" cy="47.5" r="3.2" fill="${EYE}"/><circle cx="57" cy="47.5" r="3.2" fill="${EYE}"/>`
    case 'bot1': return `${BOT_BODY(p)}<path d="M27 36L30 12L47 25ZM73 36L70 12L53 25Z" fill="${p.skin}"/><path d="M31 30L33 19L40 25ZM69 30L67 19L60 25Z" fill="${p.hair}"/><rect x="26" y="24" width="48" height="46" rx="19" fill="${p.skin}"/>${VISOR}<path d="M39 49q4-6 8 0M53 49q4-6 8 0" fill="none" stroke="${EYE}" stroke-width="3" stroke-linecap="round"/>`
    case 'bot2': return `${BOT_BODY(p)}<circle cx="23" cy="52" r="5" fill="${p.hair}"/><circle cx="77" cy="52" r="5" fill="${p.hair}"/><path d="M24 70C24 38 34 20 50 20S76 38 76 70Z" fill="${p.skin}"/><rect x="30" y="40" width="40" height="16" rx="8" fill="#14161A"/><circle cx="42" cy="48" r="3.2" fill="${EYE}"/><circle cx="58" cy="48" r="3.2" fill="${EYE}"/><path d="M44 63h12" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`
    default: return ''
  }
}

function hairFront(id: HairId, p: Palette): string {
  switch (id) {
    case 'short': return `<path d="M30 42C27 18 73 16 70 42C66 32 57 27 50 27C43 27 34 32 30 42Z" fill="${p.hair}"/>`
    case 'curly': return `<g fill="${p.hair}"><circle cx="34" cy="29" r="8"/><circle cx="46" cy="22" r="9"/><circle cx="60" cy="23" r="9"/><circle cx="69" cy="33" r="7"/><circle cx="31" cy="38" r="6"/><circle cx="50" cy="30" r="7"/></g>`
    case 'long': return `<path d="M29 44C30 22 70 22 71 44C62 35 53 29 45 29C39 29 33 36 29 44Z" fill="${p.hair}"/>`
    case 'bun': return `<circle cx="50" cy="13" r="9" fill="${p.hair}"/><path d="M30 42C27 20 73 18 70 42C66 32 57 28 50 28C43 28 34 32 30 42Z" fill="${p.hair}"/>`
    case 'afro': return `<path d="M31 40C35 27 65 27 69 40C60 34 40 34 31 40Z" fill="${p.hair}"/>`
    case 'buzz': return `<path d="M31 41C30 24 70 24 69 41C62 34 38 34 31 41Z" fill="${p.hair}" opacity=".9"/>`
    case 'mohawk': return `<path d="M43 30L45 7H55L57 30Z" fill="${p.hair}"/><path d="M31 41C30 28 70 28 69 41C62 36 38 36 31 41Z" fill="${p.hair2}"/>`
    case 'hijab': return `<path fill-rule="evenodd" d="M19 58C14 4 86 4 81 58L88 90C70 100 30 100 12 90ZM32 44A18 21 0 1 0 68 44A18 21 0 1 0 32 44Z" fill="${p.hair}"/>`
    case 'ghutra': return `<path d="M30 41C29 20 71 20 70 41C62 31 38 31 30 41Z" fill="${p.hair}"/><ellipse cx="50" cy="22" rx="23" ry="5.5" fill="${INK}"/>`
    case 'cap': return `<path d="M30 39C30 16 70 16 70 39Z" fill="${p.hair}"/><path d="M28 38H78L83 43H26Z" fill="${p.hair2}"/>`
    case 'beanie': return `<path d="M29 38C29 12 71 12 71 38Z" fill="${p.hair}"/><rect x="28" y="32" width="44" height="8" rx="4" fill="${p.hair2}"/><circle cx="50" cy="12" r="4.5" fill="${p.hair2}"/>`
    default: return ''
  }
}

const accessory = (name: (typeof ACCESSORIES)[number]) => {
  switch (name) {
    case 'shades': return `<g fill="${INK}"><rect x="32" y="39" width="16" height="10" rx="4.5"/><rect x="52" y="39" width="16" height="10" rx="4.5"/><rect x="46" y="41" width="8" height="2.4"/></g><path d="M36 42.5l4-1" stroke="#fff" opacity=".4" stroke-width="1.6" stroke-linecap="round"/>`
    case 'round': return `<g fill="none" stroke="${INK}" stroke-width="2.2"><circle cx="41.5" cy="44" r="7"/><circle cx="58.5" cy="44" r="7"/><path d="M48.5 44h3"/></g>`
    case 'phones': return `<path d="M29 46C27 8 73 8 71 46" fill="none" stroke="#14161A" stroke-width="4" stroke-linecap="round"/><rect x="23" y="41" width="9" height="17" rx="4.5" fill="${GOLD}"/><rect x="68" y="41" width="9" height="17" rx="4.5" fill="${GOLD}"/>`
    case 'chain': return `<path d="M37 73Q50 94 63 73" fill="none" stroke="${GOLD}" stroke-width="2.6"/><circle cx="50" cy="87" r="4.5" fill="${GOLD}"/><circle cx="50" cy="87" r="1.8" fill="#C79A12"/>`
    case 'earring': return `<circle cx="30.5" cy="56" r="2.8" fill="${GOLD}"/><circle cx="69.5" cy="56" r="2.8" fill="${GOLD}"/>`
    default: return ''
  }
}

/** `id` or `id:backgroundKey` split into its parts. */
export function parseAvatarId(raw: string): { id: string; bg?: string } {
  const [id, bg] = raw.trim().split(':')
  return bg && BG[bg] ? { id, bg } : { id }
}

export function encodeAvatarId(id: string, bg?: string): string {
  return bg && BG[bg] ? `${id}:${bg}` : id
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const LEGACY_PREFIX = /^(toon_|adv_|be_|fe_)/

/**
 * Ids stored before the redesign (`toon_*`, `adv_*`, `be_*`, `fe_*`) map to a stable new
 * character so nobody loses their avatar. The old smiley set (`fe_*`) becomes the robots.
 */
export function resolveAvatarId(raw: string | undefined | null): string | null {
  const value = raw?.trim()
  if (!value) return null
  const { id } = parseAvatarId(value)
  if (ROW_BY_ID.has(id)) return id
  if (!LEGACY_PREFIX.test(id)) return null
  const pool = AVATAR_PRESETS.filter((p) => (id.startsWith('fe_') ? p.group === 'crew' : p.group !== 'crew'))
  return pool[hash(id) % pool.length].id
}

export function avatarSvg(raw: string): string | null {
  const id = resolveAvatarId(raw)
  if (!id) return null
  const row = ROW_BY_ID.get(id)!
  const [, , , bgKey, skinKey, hairKey, clothKey, hairId, headI, faceI, accI, bodyI, shapeI] = row
  const override = parseAvatarId(raw).bg
  const bg = BG[override ?? bgKey]
  const skin = SKIN[skinKey]
  const hair = HAIR[hairKey]
  const cloth = CLOTH[clothKey]
  const p: Palette = {
    skin,
    skin2: shade(skin, 0.14),
    hair,
    hair2: shade(hair, 0.26),
    cloth,
    cloth2: shade(cloth, 0.22),
    bg2: bg.soft,
  }
  const isBot = hairId.startsWith('bot')
  const layers = isBot
    ? hairBack(hairId, p)
    : `${hairBack(hairId, p)}${body(bodyI, p)}${head(headI, p)}${face(faceI)}${hairFront(hairId, p)}${accessory(ACCESSORIES[accI])}`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${bg.main}"/>${bgShape(shapeI, p)}${layers}</svg>`
}

const cache = new Map<string, string>()

/** An `<img src>`-ready data URI, or null for an unknown id. Memoised per id. */
export function avatarDataUri(raw: string): string | null {
  const hit = cache.get(raw)
  if (hit) return hit
  const svg = avatarSvg(raw)
  if (!svg) return null
  const uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  cache.set(raw, uri)
  return uri
}
