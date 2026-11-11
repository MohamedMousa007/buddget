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
      for (const s of ['bg', 'card', 'elevated', 'sunken'])
        expect(ratio(hex(token(theme, `--color-status-${k}-fg`)), surface(theme, s)), `${k} on ${s}`).toBeGreaterThanOrEqual(4.5)
    }
  })
})

/** A11-12: muted and semantic text also lands on the sunken wells and the soft tints. */
describe.each(['light', 'dark'] as const)('%s theme: text on wells and soft tints', (theme) => {
  const SOFT = ['sunken', 'red-soft', 'green-soft', 'amber-soft', 'primary-soft'] as const
  const hasToken = (name: string) => new RegExp(`${name}: #[0-9A-Fa-f]{6}`).test(themes[theme])
  it('text-muted is >= 4.5:1 on every well and soft tint', () => {
    for (const s of [...SURFACES, ...SOFT.filter((x) => hasToken(`--color-brand-${x}`))])
      expect(ratio(hex(token(theme, '--color-brand-text-muted')), surface(theme, s)), `muted on ${s}`).toBeGreaterThanOrEqual(4.5)
  })
  it('red, green and amber text are >= 4.5:1 on bg, card, elevated and sunken (light theme: the deep inks)', () => {
    if (theme === 'dark') return
    for (const k of ['red', 'green', 'amber'])
      for (const s of [...SURFACES, 'sunken'])
        expect(ratio(hex(token(theme, `--color-brand-${k}`)), surface(theme, s)), `${k} on ${s}`).toBeGreaterThanOrEqual(4.5)
  })
  it('gold text is >= 4.5:1 on bg, card and elevated', () => {
    for (const s of SURFACES) expect(ratio(hex(token(theme, '--color-brand-gold')), surface(theme, s)), `gold on ${s}`).toBeGreaterThanOrEqual(4.5)
  })
})

/** Label colour over the solid semantic fills (buttons, toasts, swipe panels, banner icons): A11-1. */
describe.each(['light', 'dark'] as const)('%s theme: on-colour tokens over solid fills', (theme) => {
  it.each(['red', 'green', 'amber'] as const)('on-%s is >= 4.5:1 on its fill and hover', (k) => {
    const on = hex(token(theme, `--color-brand-on-${k}`))
    expect(ratio(on, hex(token(theme, `--color-brand-${k}`))), `${k} fill`).toBeGreaterThanOrEqual(4.5)
    if (k !== 'amber') expect(ratio(on, hex(token(theme, `--color-brand-${k}-hover`))), `${k} hover`).toBeGreaterThanOrEqual(4.5)
  })

  it('on-primary is >= 4.5:1 on the primary fill and hover', () => {
    const on = hex(token(theme, '--color-brand-on-primary'))
    for (const f of ['primary', 'primary-hover']) expect(ratio(on, hex(token(theme, `--color-brand-${f}`))), f).toBeGreaterThanOrEqual(4.5)
  })
})

describe('theme-independent inks over user colours', () => {
  it('ink-light and ink-dark are defined once, in :root only', () => {
    expect(themes.light).toMatch(/--color-brand-ink-light: #FFFFFF/)
    expect(themes.light).toMatch(/--color-brand-ink-dark: #04201C/)
    expect(themes.dark).not.toMatch(/--color-brand-ink-(light|dark):/)
  })
})
