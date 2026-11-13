import { describe, expect, it } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SegmentRail, stepState } from './SegmentRail'

const noop = () => {}

describe('stepState', () => {
  it('marks earlier steps done only by position', () => {
    expect(stepState(0, 2, true)).toBe('done')
    expect(stepState(0, 2, false)).toBe('todo')
    expect(stepState(2, 2, false)).toBe('current')
  })
})

describe('SegmentRail', () => {
  it('names every icon with its position out of seven', () => {
    const html = renderToStaticMarkup(h(SegmentRail, { current: 3, onSelect: noop, caption: false }))
    for (let n = 1; n <= 7; n++) expect(html).toContain(`${n} of 7`)
    expect(html).not.toContain('Block 4 of 7')
  })
  it('keeps the default caption and positional done marks', () => {
    const html = renderToStaticMarkup(h(SegmentRail, { current: 1, onSelect: noop }))
    expect(html).toContain('Block 2 of 7')
    expect(html).toContain('done')
  })
  it('with marks: no positional done, flags named for screen readers', () => {
    const html = renderToStaticMarkup(
      h(SegmentRail, { current: 4, onSelect: noop, caption: false, marks: (b) => (b === 'debts' ? 'flag' : b === 'bills' ? 'checked' : undefined) }),
    )
    expect(html).not.toContain(', done')
    expect(html).toContain('needs a check')
    expect(html).toContain('checked')
  })
})
