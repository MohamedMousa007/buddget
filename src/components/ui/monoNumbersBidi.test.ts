import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.tsx') ? [p] : []
  })
}

/** An element that renders copy (a `t.x(...)` call) inside `font-mono-numbers`, which forces ltr in Arabic, unless it sets `dir`. */
const MIXED = /font-mono-numbers[^>]*>[^<]*\{[^}]*\b(?:t|z)\.[A-Za-z.]+\(/

describe('QA-27: mono-number elements that hold words set dir', () => {
  it('none renders a copy string without dir="auto"', () => {
    const bad = ['src/components', 'src/app']
      .flatMap(walk)
      .filter((f) => !f.includes('/admin/'))
      .flatMap((f) => readFileSync(f, 'utf8').split('\n').map((l, i) => ({ f, i: i + 1, l })))
      .filter(({ l }) => MIXED.test(l) && !/<(?:span|p|b|div)[^>]*\bdir=/.test(l))
      .map(({ f, i }) => `${f}:${i}`)
    expect(bad).toEqual([])
  })
})

describe('QA-27: shared text holders resolve their own direction in Arabic', () => {
  it('Badge and the settings hint set it (a number between two Arabic words scrambles under a forced ltr base)', () => {
    expect(readFileSync('src/components/ui/badge.tsx', 'utf8')).toContain('[unicode-bidi:plaintext]')
    expect(readFileSync('src/components/features/settings/SettingsSwitchRow.tsx', 'utf8')).toMatch(/<span dir="auto"[^>]*>\{hint\}/)
  })
})

