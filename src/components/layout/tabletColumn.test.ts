import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** QA-117: 768-1023px keeps the phone-width column, centred; the wide cap starts at lg with the sidebar layout. */
describe('tablet column cap', () => {
  it.each(['PageContainer.tsx', 'PageGrid.tsx'])('%s caps below lg at --page-max and widens only from lg', (f) => {
    const src = readFileSync(join(__dirname, f), 'utf8')
    expect(src).toContain("max-w-[var(--page-max)] lg:max-w-[var(--page-max-wide)]")
    expect(src).not.toMatch(/(?<!lg:)max-w-\[var\(--page-max-wide\)\]/)
  })
})
