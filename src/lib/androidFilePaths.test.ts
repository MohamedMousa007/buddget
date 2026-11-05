import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// PRF8: the FileProvider must never expose a whole storage root. Camera.getPhoto captures into getExternalFilesDir(Pictures).
describe('android FileProvider paths', () => {
  const xml = readFileSync(join(process.cwd(), 'android/app/src/main/res/xml/file_paths.xml'), 'utf8').replace(/<!--[\s\S]*?-->/g, '')
  const entries = [...xml.matchAll(/<([a-z-]+-path)\s[^>]*path="([^"]*)"/g)].map(([, kind, path]) => ({ kind, path }))

  it('exposes no storage root', () => {
    expect(entries.length).toBeGreaterThan(0)
    for (const { path } of entries) expect(['', '.', '/']).not.toContain(path)
  })

  it('keeps the camera capture folder', () => {
    expect(entries).toContainEqual({ kind: 'external-files-path', path: 'Pictures/' })
  })
})
