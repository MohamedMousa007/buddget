import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./globals.css', import.meta.url), 'utf8')
const darkAt = css.indexOf('\n.dark {')
const themes = { light: css.slice(0, darkAt), dark: css.slice(darkAt) }
const SURFACES = ['bg', 'card', 'elevated'] as const

type RGB = [number, number, number]
const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB
const lin = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const lum = (c: RGB) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2])
const ratio = (a: RGB, b: RGB) => {
  const [x, y] = [lum(a), lum(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
const token = (theme: keyof typeof themes, name: string) =>
  themes[theme].match(new RegExp(`${name}: (#[0-9A-Fa-f]{6})`))![1]
const surface = (theme: keyof typeof themes, s: string) => hex(token(theme, `--color-brand-${s}`))

describe.each(['light', 'dark'] as const)('%s theme contrast', (theme) => {
  it('focus ring is >= 3:1 on every surface', () => {
    for (const s of SURFACES) expect(ratio(hex(token(theme, '--color-brand-focus')), surface(theme, s))).toBeGreaterThanOrEqual(3)
  })

  it('category chip text is >= 4.5:1 on its tint', () => {
    const re = /--cat-(\w+)-fg: (#[0-9A-Fa-f]{6});\s*--cat-\w+-bg: rgba\((\d+), (\d+), (\d+), ([\d.]+)\)/g
    const rows = [...themes[theme].matchAll(re)]
    expect(rows.length).toBeGreaterThan(10)
    for (const [, name, fg, r, g, b, a] of rows) {
      for (const s of SURFACES) {
        const base = surface(theme, s)
        const tint = [+r, +g, +b].map((v, i) => v * +a + base[i] * (1 - +a)) as RGB
        expect(ratio(hex(fg), tint), `${name} on ${s}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('status text tokens are >= 4.5:1 on card and bg', () => {
    for (const k of ['ok', 'warn', 'danger']) {
      for (const s of ['bg', 'card'])
        expect(ratio(hex(token(theme, `--color-status-${k}-fg`)), surface(theme, s)), `${k} on ${s}`).toBeGreaterThanOrEqual(4.5)
    }
  })
})
