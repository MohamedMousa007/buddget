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

describe('QA-76 / QA-77 install manifest', () => {
  const m = JSON.parse(readFileSync(join(root, 'public/manifest.json'), 'utf8')) as Record<string, unknown>

  it('keeps the status bar visible: display_override starts with standalone, no fullscreen', () => {
    expect((m.display_override as string[])[0]).toBe('standalone')
    expect(m.display_override).not.toContain('fullscreen')
  })
  it('has a stable install id equal to the current start_url, so existing installs keep their identity', () => {
    expect(m.id).toBe('/flow')
    expect(m.start_url).toBe('/flow')
  })
  it('describes its own strings and category, and does not lock orientation', () => {
    expect(m).toMatchObject({ lang: 'en', dir: 'ltr', categories: ['finance'] })
    expect(m).not.toHaveProperty('orientation')
  })
})
