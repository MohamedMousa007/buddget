import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sources(path)
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

describe('no component subscribes to the whole finance store (PRF11)', () => {
  it('every useFinanceStore() call passes a selector', () => {
    const root = resolve(__dirname, '../..')
    const bare = sources(root).filter((f) => /useFinanceStore\(\s*\)/.test(readFileSync(f, 'utf8')))
    expect(bare.map((f) => f.slice(root.length))).toEqual([])
  })
})
