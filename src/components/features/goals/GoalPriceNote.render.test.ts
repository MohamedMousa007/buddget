import { describe, expect, it } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { GoalPriceNote } from './GoalPriceNote'

const stale = { perGram: 3500, at: '2025-11-29T10:00:00.000Z' }

describe('GoalPriceNote', () => {
  it('shows the last gold price and its date on an active goal', () => {
    const html = renderToStaticMarkup(h(GoalPriceNote, { stalePrice: stale, priceMissing: null, look: 'line' }))
    expect(html).toContain('Gold price missing')
    expect(html).toContain('3,500')
  })
  it('is hidden on an achieved goal, in both looks', () => {
    for (const look of ['line', 'notice'] as const) {
      expect(renderToStaticMarkup(h(GoalPriceNote, { stalePrice: stale, priceMissing: 'gold', achieved: true, look }))).toBe('')
    }
  })
  it('is hidden when every part is priced live', () => {
    expect(renderToStaticMarkup(h(GoalPriceNote, { stalePrice: null, priceMissing: null, look: 'notice' }))).toBe('')
  })
})
