/** WCAG 2.x contrast maths for user-chosen colours (card faces, avatars). Token pairs are tested from the CSS in `globalsContrast.test.ts`. */

export type RGB = [number, number, number]

const HEX = /^#?([0-9a-f]{6})$/i

export function parseHex(hex: string): RGB | null {
  const m = HEX.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [n >> 16, (n >> 8) & 255, n & 255]
}

const lin = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const luminance = (c: RGB) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2])

export function contrastRatio(a: RGB, b: RGB): number {
  const [x, y] = [luminance(a), luminance(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

/** Mirrors `--color-brand-ink-light` / `--color-brand-ink-dark` in globals.css (the same in both themes). */
export const INK_LIGHT_HEX = '#FFFFFF'
export const INK_DARK_HEX = '#04201C'
export const INK_LIGHT = 'var(--color-brand-ink-light)'
export const INK_DARK = 'var(--color-brand-ink-dark)'

const scale = (c: RGB, f: number): RGB => c.map((v) => Math.max(0, Math.min(255, Math.round(v * f)))) as RGB

/** Whichever of the two inks has the higher contrast on `hex`. */
export function readableInkKind(hex: string): 'light' | 'dark' {
  const bg = parseHex(hex)
  if (!bg) return 'light'
  return contrastRatio(parseHex(INK_LIGHT_HEX)!, bg) >= contrastRatio(parseHex(INK_DARK_HEX)!, bg) ? 'light' : 'dark'
}

/** The ink token that reads best on `hex`, or `fallback` when `hex` is not a hex colour. */
export function inkFor(hex: string, fallback = INK_LIGHT): string {
  if (!parseHex(hex)) return fallback
  return readableInkKind(hex) === 'light' ? INK_LIGHT : INK_DARK
}

export interface CardFace {
  inkKind: 'light' | 'dark'
  /** CSS colour for every piece of text and glyph on the face. */
  ink: string
  /** Brightness factors for the light, middle and dark gradient stops. */
  stops: [number, number, number]
}

const AA = 4.5
const DEFAULT_STOPS: [number, number, number] = [1.18, 1, 0.6]

/**
 * The ink and gradient stops for a card in `hex`. The ink is whichever reads better; the gradient keeps its
 * usual light-to-dark sheen but each stop is clamped (the minimum needed) so the ink reaches 4.5:1 over the
 * whole face, including the 9px labels. Colours the ink already clears keep the original stops.
 */
export function cardFace(hex: string): CardFace {
  const base = parseHex(hex)
  if (!base) return { inkKind: 'light', ink: INK_LIGHT, stops: DEFAULT_STOPS }
  const inkKind = readableInkKind(hex)
  const ink = parseHex(inkKind === 'light' ? INK_LIGHT_HEX : INK_DARK_HEX)!
  const ok = (f: number) => contrastRatio(ink, scale(base, f)) >= AA
  const clamp = (stop: number): number => {
    if (ok(stop)) return stop
    const dir = inkKind === 'light' ? -0.01 : 0.01
    let f = stop
    for (let i = 0; i < 100 && !ok(f); i++) f += dir
    return Math.max(0, f)
  }
  const stops = DEFAULT_STOPS.map(clamp) as [number, number, number]
  return { inkKind, ink: inkKind === 'light' ? INK_LIGHT : INK_DARK, stops }
}
