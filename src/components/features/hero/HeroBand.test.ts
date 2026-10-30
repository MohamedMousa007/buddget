import { describe, expect, it } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { HeroBand } from './HeroBand'

const cells: [{ label: string; value: string }, { label: string; value: string }, { label: string; value: string }] = [
  { label: 'A', value: '1' },
  { label: 'B', value: '2' },
  { label: 'C', value: '3' },
]
const base = { label: 'LBL', numbers: h('b', null, 'NUM') }

describe('HeroBand slots', () => {
  it('draws the bar block and facts strip when given (unchanged for existing callers)', () => {
    const html = renderToStaticMarkup(h(HeroBand, { ...base, bar: h('i', null, 'BAR'), cells }))
    expect(html).toContain('h-[38.75px]')
    expect(html).toContain('h-[66px]')
    expect(html).toContain('border-b')
  })
  it('omits the bar block and the facts strip when absent', () => {
    const html = renderToStaticMarkup(h(HeroBand, base))
    expect(html).not.toContain('h-[38.75px]')
    expect(html).not.toContain('h-[66px]')
  })
  it('renders the note under the numbers only when given', () => {
    expect(renderToStaticMarkup(h(HeroBand, { ...base, note: 'HINT' }))).toContain('HINT')
    expect(renderToStaticMarkup(h(HeroBand, base))).not.toContain('leading-relaxed')
  })
  it('contained swaps the full-bleed border for a rounded card', () => {
    const html = renderToStaticMarkup(h(HeroBand, { ...base, contained: true }))
    expect(html).toContain('rounded-3xl')
    expect(html).not.toContain('border-b')
  })
  it('draws extra under the note only when given', () => {
    expect(renderToStaticMarkup(h(HeroBand, { ...base, extra: h('u', null, 'XTRA') }))).toContain('XTRA')
    expect(renderToStaticMarkup(h(HeroBand, base))).not.toContain('XTRA')
  })
})
