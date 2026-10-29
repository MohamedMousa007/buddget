import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(__dirname, '../../components')
/** Surfaces outside the localised app shell: the staff portal and the public marketing site. */
const ALLOWLIST = ['features/admin/', 'site/']

const LITERAL_NAME = [
  /\baria-label="[A-Za-z]/,
  /\baria-label=\{\s*['`][A-Za-z]/,
  /\baria-label=\{[^}]*[?:]\s*['`][A-Za-z]/,
  /\balt="[A-Za-z]/,
  /\bsr-only[^>]*>[A-Za-z][^<{]*</,
]

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) sourceFiles(p, out)
    else if (p.endsWith('.tsx') && !p.endsWith('.test.tsx')) out.push(p)
  }
  return out
}

describe('accessible names are localised', () => {
  it('no literal English aria-label / alt / sr-only text in src/components', () => {
    const offenders: string[] = []
    for (const file of sourceFiles(ROOT)) {
      const rel = relative(ROOT, file)
      if (ALLOWLIST.some((a) => rel.startsWith(a))) continue
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (/^\s*(\*|\/\/)/.test(line)) return
        if (LITERAL_NAME.some((re) => re.test(line))) offenders.push(`${rel}:${i + 1}`)
      })
    }
    expect(offenders).toEqual([])
  })
})
