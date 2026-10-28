import { describe, expect, it } from 'vitest'
import { foldTail } from './CategoryPieChart'

describe('foldTail', () => {
  const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `c${i}`, value: 10 - i }))
  it('keeps six or fewer slices as they are', () => {
    expect(foldTail(mk(6))).toHaveLength(6)
  })
  it('folds the tail into one Other slice that preserves the total', () => {
    const out = foldTail(mk(9))
    expect(out).toHaveLength(6)
    expect(out[5].name).toBe('Other')
    expect(out.reduce((s, d) => s + d.value, 0)).toBe(mk(9).reduce((s, d) => s + d.value, 0))
  })
})

describe('foldTail folded flag', () => {
  it('marks only the synthetic slice, even next to a real "Other"', () => {
    const data = [{ name: 'Other', value: 90 }, ...Array.from({ length: 7 }, (_, i) => ({ name: `c${i}`, value: 10 - i }))]
    const out = foldTail(data)
    expect(out.filter((d) => d.folded)).toHaveLength(1)
    expect(out[0].folded).toBeUndefined()
  })
})
