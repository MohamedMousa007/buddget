import { describe, it, expect } from 'vitest'
import { emptyStateClasses } from './EmptyState'

describe('emptyStateClasses', () => {
  it('default keeps the original layout', () => {
    const c = emptyStateClasses('default')
    expect(c.root).toContain('py-8 sm:py-12')
    expect(c.title).toBe('text-base font-medium text-[var(--color-brand-text-primary)] mb-1')
    expect(c.action).toBe('')
  })
  it('hero maps to the large bold title with no outer padding', () => {
    const c = emptyStateClasses('hero')
    expect(c.root).not.toContain('py-')
    expect(c.title).toContain('text-lg font-bold')
    expect(c.action).toBe('mt-5')
  })
})
