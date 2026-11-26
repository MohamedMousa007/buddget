import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (rel: string) => readFileSync(join(__dirname, '../..', rel), 'utf8')

/** QA axe (serious): the setup "%" badge on the header avatar (light-ar /flow) and the Insights example rows (light-en /reports). */
describe('contrast fixes stay on the AA tokens', () => {
  it('the setup badge text on the teal fill is on-primary (4.52:1 light), not the page background (4.20:1)', () => {
    const src = read('components/layout/AuthNavButtons.tsx')
    const badge = src.split('\n').find((l) => l.includes('bg-[var(--color-brand-primary)]') && l.includes('font-mono-numbers'))!
    expect(badge).toContain('text-[var(--color-brand-on-primary)]')
    expect(badge).not.toContain('text-[var(--color-brand-bg)]')
  })

  it('the Insights example rows are not faded: muted text at 80% opacity fell to 3.16:1', () => {
    const src = read('components/features/insights/InsightsLearning.tsx')
    const row = src.split('\n').find((l) => l.includes('border-dashed') && l.includes('<li'))!
    expect(row).not.toMatch(/\bopacity-\d+/)
  })
})
