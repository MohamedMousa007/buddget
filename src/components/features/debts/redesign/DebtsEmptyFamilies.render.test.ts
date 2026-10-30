import { describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DebtsEmptyFamilies } from './DebtsEmptyFamilies'

describe('Debts empty families', () => {
  const html = renderToStaticMarkup(h(DebtsEmptyFamilies, { title: 'Nothing owed', description: 'All clear', onAdd: vi.fn() }))

  it('offers the three things you can track, each as a tappable row, plus the primary action', () => {
    expect((html.match(/<button/g) ?? []).length).toBe(4)
    for (const name of ['Borrowed', 'Credit cards', 'Installments']) expect(html).toContain(name)
  })
  it('stays mobile only', () => {
    expect(html).toContain('lg:hidden')
  })
})
