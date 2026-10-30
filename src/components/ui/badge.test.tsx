import { describe, expect, it } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Badge, badgeClasses } from './badge'

describe('Badge tone mapping', () => {
  it('keeps the old status variant names working as tone aliases', () => {
    expect(badgeClasses({ variant: 'positive' })).toContain('bg-[var(--color-brand-green-soft)]')
    expect(badgeClasses({ variant: 'warning' })).toContain('bg-[var(--color-brand-amber-soft)]')
    expect(badgeClasses({ variant: 'negative' })).toContain('bg-[var(--color-brand-red-soft)]')
    expect(badgeClasses({ variant: 'brand' })).toContain('bg-[var(--color-brand-primary-soft)]')
    expect(badgeClasses({ variant: 'muted' })).toContain('text-[var(--color-brand-text-muted)]')
  })
  it('tone wins over variant', () => {
    expect(badgeClasses({ variant: 'positive', tone: 'warn' })).toContain('amber')
    expect(badgeClasses({ variant: 'positive', tone: 'warn' })).not.toContain('green')
  })
  it('keeps the 1px border by default and drops it on request', () => {
    expect(badgeClasses({ tone: 'soft' })).toContain('border-transparent')
    expect(badgeClasses({ tone: 'soft', bordered: false })).toContain('border-0')
  })
  it('sm and md sizes carry the pill paddings', () => {
    expect(badgeClasses({ tone: 'soft', size: 'sm' })).toContain('px-2.5 py-1')
    expect(badgeClasses({ tone: 'soft', size: 'md' })).toContain('px-3 py-1.5')
  })
  it('renders a span with the slot', () => {
    expect(renderToStaticMarkup(h(Badge, { tone: 'brand', bordered: false }, 'x'))).toContain('data-slot="badge"')
  })
})
