import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { EmptyState, emptyStateClasses } from './EmptyState'

describe('emptyStateClasses', () => {
  it('every variant shares one title and description style', () => {
    for (const v of ['default', 'hero', 'card'] as const) {
      const c = emptyStateClasses(v)
      expect(c.title).toContain('text-lg font-bold')
      expect(c.description).toContain('text-[var(--color-brand-text-secondary)]')
    }
  })
  it('default pads itself, hero does not, card sits on the brand card surface', () => {
    expect(emptyStateClasses('default').root).toMatch(/py-8.*sm:py-12/)
    expect(emptyStateClasses('hero').root).not.toContain('py-')
    expect(emptyStateClasses('card').root).toContain('bg-[var(--color-brand-card)]')
    expect(emptyStateClasses('card').root).toContain('rounded-3xl')
  })
})

describe('EmptyState slots', () => {
  it('draws icon in the tile, with the tone', () => {
    const html = renderToStaticMarkup(h(EmptyState, { icon: 'i', iconTone: 'positive', title: 'T' }))
    expect(html).toContain('size-14')
    expect(html).toContain('brand-green-soft')
  })
  it('illustration replaces the icon tile', () => {
    const html = renderToStaticMarkup(h(EmptyState, { icon: 'i', illustration: h('b', { id: 'ill' }), title: 'T' }))
    expect(html).toContain('id="ill"')
    expect(html).not.toContain('size-14')
  })
  it('renders children between description and action', () => {
    const html = renderToStaticMarkup(h(EmptyState, { title: 'T', description: 'D', action: h('i', null, 'ACT'), children: h('u', null, 'BODY') }))
    expect(html.indexOf('D')).toBeLessThan(html.indexOf('BODY'))
    expect(html.indexOf('BODY')).toBeLessThan(html.indexOf('ACT'))
  })
  it('omits empty slots', () => {
    const html = renderToStaticMarkup(h(EmptyState, { title: 'T' }))
    expect(html).not.toContain('mt-5')
  })
})
