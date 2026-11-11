import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(n) && !/\.test\./.test(n) ? [p] : []
  })
}

describe('TZL-4: typed digit boxes read Arabic-Indic digits', () => {
  it("every `replace(/\\D/g, '')` on typed input in components and hooks converts to Latin digits first (admin portal is English-only)", () => {
    const root = join(__dirname, '..', '..')
    const offenders = [...files(join(root, 'components')), ...files(join(root, 'hooks'))]
      .filter((f) => !f.includes('/admin/'))
      .flatMap((f) => readFileSync(f, 'utf8').split('\n').filter((l) => l.includes('replace(/\\D/g') && !/toLatin/.test(l)).map((l) => `${f.split('/src/')[1]}: ${l.trim()}`))
    expect(offenders).toEqual([])
  })
})
