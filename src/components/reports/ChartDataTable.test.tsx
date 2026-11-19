import { describe, expect, it } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ChartDataTable } from './ChartDataTable'

describe('ChartDataTable', () => {
  it('clips the hidden table with a wrapper, never on the table itself (a table ignores sr-only width and widens the page)', () => {
    const html = renderToStaticMarkup(h(ChartDataTable, { caption: 'c', headers: ['a', 'b'], rows: [['x', 1]] }))
    expect(html.startsWith('<div class="sr-only"><table>')).toBe(true)
    expect(html).not.toContain('<table class=')
  })
})
