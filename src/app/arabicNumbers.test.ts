import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(__dirname, '..')
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8')

/** QA-27: number/word ordering in Arabic. The English-order layout is kept; only the isolation of mixed strings is fixed. */
describe('Arabic number and unit ordering (QA-27)', () => {
  it('the Arabic mono rule yields to an explicit dir, so dir="auto" works on mixed number+word strings', () => {
    expect(read('app/globals.css')).toMatch(/html\[data-locale='ar'\] \.font-mono-numbers:not\(\[dir\]\)\s*\{/)
  })
  it('dictionary sentences that mix a number with Arabic words are rendered with dir="auto"', () => {
    expect(read('components/features/flow/FlowSummaryBand.tsx')).toMatch(/<b dir="auto" className="block font-mono-numbers/)
    expect(read('components/features/flow/FlowSummaryBand.tsx').match(/<span dir="auto" className="[^"]*">\{scale\[/g)).toHaveLength(3)
    const debts = read('components/features/debts/redesign/DebtPortfolioHero.tsx')
    expect(debts).toMatch(/<b dir="auto" className="block font-mono-numbers/)
    expect(debts).toMatch(/<span dir="auto"[^>]*>\{progressing \? t\.heroBorrowedTotal/)
    expect(read('components/features/savings-v3/SavingsHero.tsx')).toMatch(/<span dir="auto"[^>]*>\{t\.savesPct/)
  })
  it('the Debts band (Light touch) is a rounded card whose facts ride one auto-direction line under the bar', () => {
    const debts = read('components/features/debts/redesign/DebtPortfolioHero.tsx')
    expect(debts).toMatch(/note=\{note\}\s+contained/)
    expect(debts).toContain('lt.month(compact(month.paid), compact(month.total))')
    expect(debts).toMatch(/const note = [^\n]*<span dir="auto">/)
  })
})
