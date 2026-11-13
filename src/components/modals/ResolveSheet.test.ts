import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ResolveRow, ResolveGroupLabel, type ResolveRowProps } from '@/components/modals/ResolveSheet'

const base: ResolveRowProps = { leading: createElement('i', { id: 'lead' }), title: 'Starbucks', sub: 'Today', trailing: '−45.00', state: 'idle' }
const render = (p: Partial<ResolveRowProps>) => renderToStaticMarkup(createElement(ResolveRow, { ...base, ...p }))

describe('ResolveRow', () => {
  it('an unselected row is a checkbox that is not checked', () => {
    const html = render({})
    expect(html).toContain('role="checkbox"')
    expect(html).toContain('aria-checked="false"')
    expect(html).toContain('Starbucks')
  })
  it('a selected row is announced as checked and shows the check', () => {
    const html = render({ state: 'selected' })
    expect(html).toContain('aria-checked="true"')
  })
  it('a failed row stays checked and carries the red border', () => {
    const html = render({ state: 'failed', chip: { tone: 'negative', text: 'Could not save' } })
    expect(html).toContain('aria-checked="true"')
    expect(html).toContain('border-[var(--color-brand-red)]')
    expect(html).toContain('Could not save')
  })
  it('a locked row cannot be toggled: no checkbox role, and the reason chip shows', () => {
    const html = render({ state: 'locked', chip: { tone: 'negative', text: 'Unverified sender' } })
    expect(html).not.toContain('role="checkbox"')
    expect(html).toContain('Unverified sender')
  })
  it('a plain row has nothing to choose', () => {
    const html = render({ state: 'plain' })
    expect(html).not.toContain('role="checkbox"')
  })
  it('the detail stays hidden until opened, and renders open when asked', () => {
    const labels = { show: 'See message', hide: 'Hide message' }
    const closed = render({ detail: createElement('p', null, 'RAW BODY'), detailLabels: labels })
    expect(closed).toContain('See message')
    expect(closed).not.toContain('RAW BODY')
    const open = render({ detail: createElement('p', null, 'RAW BODY'), detailLabels: labels, detailDefaultOpen: true })
    expect(open).toContain('RAW BODY')
    expect(open).toContain('Hide message')
    expect(open).toContain('aria-expanded="true"')
  })
  it('uses the spoken label when given', () => {
    expect(render({ label: 'Starbucks, 45.00 spent today' })).toContain('aria-label="Starbucks, 45.00 spent today"')
  })
})

describe('ResolveGroupLabel', () => {
  it('renders a heading', () => {
    expect(renderToStaticMarkup(createElement(ResolveGroupLabel, null, 'Ready · 2'))).toContain('<h3')
  })
})
