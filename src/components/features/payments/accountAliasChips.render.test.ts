import { describe, expect, it } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AccountAliasChips } from './accountFormParts'

describe('AccountAliasChips', () => {
  it('lists every alias as a removable chip', () => {
    const html = renderToStaticMarkup(h(AccountAliasChips, { aliases: ['5950', '001'], onRemove: () => {} }))
    expect(html).toContain('Also recognised as')
    expect(html).toContain('••5950')
    expect(html).toContain('••001')
    expect(html).toContain('aria-label="Remove ••5950"')
  })
  it('renders nothing when the account has no aliases', () => {
    expect(renderToStaticMarkup(h(AccountAliasChips, { aliases: [], onRemove: () => {} }))).toBe('')
  })
})
