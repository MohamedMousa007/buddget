import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const refs = (text: string) => [...text.matchAll(/["'(](\/icons\/[\w.-]+)["')]/g)].map((m) => m[1])

describe('OFS-10 / OFS-11 icon and shortcut references', () => {
  const manifest = readFileSync(join(root, 'public/manifest.json'), 'utf8')
  const layout = readFileSync(join(root, 'src/app/(app)/layout.tsx'), 'utf8')

  it.each([['manifest', manifest], ['layout', layout]])('every /icons file referenced by the %s exists', (_n, text) => {
    const found = refs(text)
    expect(found.length).toBeGreaterThan(0)
    for (const f of found) expect(existsSync(join(root, 'public', f)), f).toBe(true)
  })

  it('no manifest shortcut points at a query param nothing reads', () => {
    for (const s of JSON.parse(manifest).shortcuts as { url: string }[]) expect(s.url).not.toContain('action=addExpense')
  })
})
