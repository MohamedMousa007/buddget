import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * QA-113: colours come from tokens. This fails on a hex colour literal in app UI code outside the places that legitimately
 * own a palette. Add to ALLOWED only with a reason.
 */
const ROOT = join(__dirname, '../../..')
const SCAN = ['src/components', 'src/app/(app)']
const ALLOWED: [string, string][] = [
  ['src/components/site/', 'marketing site has its own palette'],
  ['src/components/brand/', 'the buddget logo; token with a fallback'],
  ['src/components/features/auth-modal/AuthOAuthButtons.tsx', "Google's logo colours"],
  ['src/components/features/membership/', 'membership card artwork, the same in both themes'],
  ['src/components/features/rewards/useMemberMarks.ts', 'founder numbers such as "#023", not colours'],
  ['src/components/ai/BuddgyIcon.tsx', 'hex values quoted in a comment'],
  ['src/app/(app)/layout.tsx', 'metadata theme-color, read before any CSS exists'],
  ['src/app/(app)/loading.tsx', 'boot canvas painted before the stylesheet loads'],
]
const HEX = /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3}(?:[0-9a-fA-F]{2})?)?\b/

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(name) && !/\.test\./.test(name)) out.push(p)
  }
  return out
}

describe('no hardcoded hex colours in app UI (QA-113)', () => {
  it('every hex literal lives in an allowed palette owner', () => {
    const offenders: string[] = []
    for (const dir of SCAN) {
      for (const f of walk(join(ROOT, dir))) {
        const rel = relative(ROOT, f)
        if (ALLOWED.some(([p]) => rel.startsWith(p))) continue
        readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
          const code = line.trim()
          if (/^(\*|\/\/|\/\*)/.test(code)) return
          if (HEX.test(code)) offenders.push(`${rel}:${i + 1}`)
        })
      }
    }
    expect(offenders).toEqual([])
  })
})
