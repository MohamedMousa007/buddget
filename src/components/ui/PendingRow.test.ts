import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Inbox } from 'lucide-react'
import { PendingRow } from '@/components/ui/PendingRow'

const render = (over: Partial<Parameters<typeof PendingRow>[0]> = {}) =>
  renderToStaticMarkup(createElement(PendingRow, { tone: 'amber', icon: Inbox, title: '2 things need you', subtitle: '5 bank messages · 2 expenses on no account', onPress: () => {}, ...over }))

describe('PendingRow', () => {
  it('is a button that shows the title and the subtitle, and is not announced as a choice', () => {
    const html = render()
    expect(html).toContain('<button')
    expect(html).toContain('2 things need you')
    expect(html).toContain('5 bank messages · 2 expenses on no account')
    expect(html).not.toContain('role="checkbox"')
    expect(html).not.toContain('role="radio"')
  })
  it('uses the full spoken label when the visible text abbreviates it', () => {
    expect(render({ label: '3 things need you: a, b, c' })).toContain('aria-label="3 things need you: a, b, c"')
  })
  it('amber means a balance is off, teal means a review', () => {
    expect(render({ tone: 'amber' })).toContain('--color-brand-amber-soft')
    expect(render({ tone: 'teal' })).toContain('--color-brand-primary-soft')
  })
  it('keeps the 56px minimum height and mirrors its chevron for right-to-left text', () => {
    const html = render()
    expect(html).toContain('min-h-[56px]')
    expect(html).toContain('rtl:rotate-180')
  })
})
