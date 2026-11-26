import { describe, expect, it } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AmountField } from './AmountField'

/** QA: the planner's "What do you take home in a normal month?" field took taps only on its 36px text line. */
describe('AmountField (glass look) takes the tap across its whole box', () => {
  const input = (html: string) => html.match(/<input[^>]*>/)![0]

  it('the input stretches to the 52px box (default) and the 44px box (compact)', () => {
    for (const size of ['default', 'compact'] as const) {
      const html = renderToStaticMarkup(h(AmountField, { value: '', onChange: () => undefined, currency: 'EGP', label: 'What do you take home in a normal month?', size }))
      expect(html).toContain(`height:${size === 'compact' ? 44 : 52}px`)
      expect(input(html)).toMatch(/\bself-stretch\b/)
    }
  })

  it('a field with its own className keeps its own sizing (no stretch added)', () => {
    const html = renderToStaticMarkup(h(AmountField, { value: '', onChange: () => undefined, currency: 'EGP', className: 'h-12' }))
    expect(input(html)).not.toMatch(/\bself-stretch\b/)
  })
})
