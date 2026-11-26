import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('AccountRow decimals', () => {
  it('never dims the decimals below opacity-60 (45% gave 2.93:1 on the white card; axe, QA round 2); light touch draws them undimmed', () => {
    const src = readFileSync(new URL('./AccountRow.tsx', import.meta.url), 'utf8')
    expect(src).not.toMatch(/opacity-(?:[1-5][0-9]?)\b[^}]*money\.dec|money\.int\}<span className="opacity-(?:[1-5]\d?)"/)
    expect(src).toContain('money.int + money.dec')
  })
})
