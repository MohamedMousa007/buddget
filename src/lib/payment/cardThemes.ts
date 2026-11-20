import type { PaymentMethod } from '@/lib/store/types'
import { parseHex } from '@/lib/ui/contrast'
import { PAYMENT_BRANDS, PAYMENT_TYPE_META, decomposePaymentMethodName, resolvePaymentBrandKey } from './paymentMethodDefaults'

/** The two approved card finishes: matte brushed metal, and a bank-issued print with guilloche lines and a gold chip. */
export type CardStyle = 'metal' | 'bank'

export const CARD_THEME_KEYS = [
  'blackMetal', 'titanium', 'roseGold', 'champagne', 'navy', 'midnight', 'glacier', 'teal',
  'emerald', 'forest', 'burgundy', 'plum', 'copper', 'graphite', 'pearl', 'sunset',
] as const
export type CardThemeKey = (typeof CARD_THEME_KEYS)[number]

export interface CardTheme {
  /** Light (top-left) and dark (bottom-right) gradient stops. */
  a: string
  b: string
  /** Which ink reads at 4.5:1 or more on both stops. */
  ink: 'light' | 'dark'
}

/** The 16 themes of the approved palette board (C4), stops and ink exactly as designed. */
export const CARD_THEMES: Record<CardThemeKey, CardTheme> = {
  blackMetal: { a: '#2a2a2e', b: '#141416', ink: 'light' },
  titanium: { a: '#d4d7db', b: '#9aa0a7', ink: 'dark' },
  roseGold: { a: '#ecc3b2', b: '#c08a77', ink: 'dark' },
  champagne: { a: '#ecdcb0', b: '#bfa264', ink: 'dark' },
  navy: { a: '#1c3263', b: '#0b1733', ink: 'light' },
  midnight: { a: '#232a52', b: '#0a0c1e', ink: 'light' },
  glacier: { a: '#a9d4ee', b: '#5e9fcb', ink: 'dark' },
  teal: { a: '#0b7b6f', b: '#0a534a', ink: 'light' },
  emerald: { a: '#13775a', b: '#073b2c', ink: 'light' },
  forest: { a: '#355a3c', b: '#16261a', ink: 'light' },
  burgundy: { a: '#7a1a2e', b: '#3a0812', ink: 'light' },
  plum: { a: '#5a2a60', b: '#230d28', ink: 'light' },
  copper: { a: '#a35f2d', b: '#6e3a1a', ink: 'light' },
  graphite: { a: '#4a5057', b: '#1f2327', ink: 'light' },
  pearl: { a: '#f7f4ee', b: '#dcd5c8', ink: 'dark' },
  sunset: { a: '#f7b066', b: '#e27585', ink: 'dark' },
}

/** Chip fills: steel on metal (lighter on dark metals), gold on bank-issued cards. */
export const CHIP_FILL = {
  metalOnDarkMini: 'linear-gradient(135deg, #c4c7cc, #6e7277)',
  metalOnDark: 'linear-gradient(135deg, #a3a7ad, #5e6166)',
  metalOnLight: 'linear-gradient(135deg, #8a8f96, #4a4e54)',
  gold: 'linear-gradient(135deg, #f3dc9a, #c9a85a 50%, #9c7b34)',
} as const

export function isCardThemeKey(k: unknown): k is CardThemeKey {
  return typeof k === 'string' && (CARD_THEME_KEYS as readonly string[]).includes(k)
}

/** The theme closest (RGB distance to its gradient's midpoint) to a free colour saved before themes existed. */
export function nearestCardTheme(hex: string | null | undefined): CardThemeKey {
  const c = hex ? parseHex(hex) : null
  if (!c) return 'navy'
  let best: CardThemeKey = 'navy'
  let bestD = Infinity
  for (const k of CARD_THEME_KEYS) {
    const a = parseHex(CARD_THEMES[k].a)!
    const b = parseHex(CARD_THEMES[k].b)!
    const d = [0, 1, 2].reduce((s, i) => s + (c[i] - (a[i] + b[i]) / 2) ** 2, 0)
    if (d < bestD) { bestD = d; best = k }
  }
  return best
}

/** Style and theme a method is drawn with. Total: every method gets one, so no card renders blank. */
export function cardLook(m: Pick<PaymentMethod, 'cardStyle' | 'cardTheme' | 'color' | 'type'>): { style: CardStyle; theme: CardThemeKey } {
  const style: CardStyle = m.cardStyle === 'metal' ? 'metal' : 'bank'
  const theme = isCardThemeKey(m.cardTheme) ? m.cardTheme : nearestCardTheme(m.color ?? PAYMENT_TYPE_META[m.type].color)
  return { style, theme }
}

const STOP_WORDS = new Set(['of', 'the', 'and', 'by', '&'])
const ABBR_MAX = 4

/**
 * The short bank name on a mini card: "CIB", "NBE", "QNB", "BM" (Banque Misr), "ENBD" (Emirates NBD).
 * A catalogue match is abbreviated from its catalogue name, so "National Bank of Egypt" typed by hand still reads "NBE".
 * A first word already in capitals of at most 4 letters is the abbreviation; else each word gives its initial and a
 * word in capitals gives itself; a single word is kept whole up to 4 letters, else its first 3. Arabic names keep their
 * first word. At most 4 characters otherwise.
 */
export function bankAbbreviation(name: string): string {
  const key = resolvePaymentBrandKey(name)
  const source = (key ? PAYMENT_BRANDS[key]?.name : null) ?? name
  const words = source.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  if (/[؀-ۿ]/.test(words[0])) return words[0]
  const clean = (w: string) => w.replace(/[^\p{L}\p{N}]/gu, '')
  const first = clean(words[0])
  if (first && first.length <= ABBR_MAX && first === first.toUpperCase() && /\p{Lu}/u.test(first)) return first
  const parts = words.filter((w) => !STOP_WORDS.has(w.toLowerCase())).map(clean).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return (parts[0].length <= ABBR_MAX ? parts[0] : parts[0].slice(0, 3)).toUpperCase()
  const caps = parts.map((w) => (w.length > 1 && w === w.toUpperCase() ? w : w[0].toUpperCase())).join('')
  return caps.length <= ABBR_MAX ? caps : parts.map((w) => w[0].toUpperCase()).join('').slice(0, ABBR_MAX)
}

/** The bank a card belongs to: its parent account's provider when it hangs under one, else its own. */
export function cardBankName(m: PaymentMethod, parent?: PaymentMethod | null): string {
  const owner = parent ?? m
  return decomposePaymentMethodName(owner.name, owner.last4).provider
}
