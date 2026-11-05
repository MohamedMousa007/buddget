import { describe, expect, it } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { FlowLedger, FLOW_LEDGER_PAGE_DAYS, type FlowLedgerGroup } from './FlowLedger'

const days = (n: number): FlowLedgerGroup[] => Array.from({ length: n }, (_, i) => ({ key: `d${i}`, label: `Day ${i}`, rows: [] }))
const sections = (html: string) => (html.match(/<section/g) ?? []).length

describe('FlowLedger paging', () => {
  it('renders every day group when they fit in one page', () => {
    const html = renderToStaticMarkup(h(FlowLedger, { groups: days(5) }))
    expect(sections(html)).toBe(5)
    expect(html).not.toContain('Show more')
  })

  it('caps the rendered day groups and offers Show more', () => {
    const html = renderToStaticMarkup(h(FlowLedger, { groups: days(FLOW_LEDGER_PAGE_DAYS + 5) }))
    expect(sections(html)).toBe(FLOW_LEDGER_PAGE_DAYS)
    expect(html).toContain('Show more')
  })
})
