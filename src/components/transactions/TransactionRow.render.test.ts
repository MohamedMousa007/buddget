import { describe, expect, it } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { TransactionRow } from './TransactionRow'

const base = { icon: null, amount: '10', onClick: () => {} }

describe('TransactionRow subtitle', () => {
  it('a text subtitle can shrink and truncate instead of pushing the row wider than the screen', () => {
    const html = renderToStaticMarkup(h(TransactionRow, { ...base, title: 't', subtitle: 'A'.repeat(120) }))
    expect(html).toMatch(/class="mt-1\.5 flex min-w-0 [^"]*overflow-hidden/)
    expect(html).toContain('<span dir="auto" class="truncate">')
  })
  it('titles and text subtitles take their direction from their content, so a long Arabic name is cut at its end', () => {
    const html = renderToStaticMarkup(h(TransactionRow, { ...base, title: 'متجر', subtitle: 'نقدًا' }))
    expect(html).toMatch(/<span dir="auto" class="truncate text-\[15px\]/)
  })
  it('a node subtitle is left as given', () => {
    const html = renderToStaticMarkup(h(TransactionRow, { ...base, title: 't', subtitle: h('b', null, 'x') }))
    expect(html).toContain('<b>x</b>')
    expect(html).not.toContain('<span dir="auto" class="truncate"><b>')
  })
})
