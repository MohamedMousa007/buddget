import { describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DraftStep } from './DraftStep'

describe('draft step', () => {
  it('offers to review the draft or answer questions first, and names the history it uses', () => {
    const one = renderToStaticMarkup(h(DraftStep, { months: 1, onReview: vi.fn(), onQuestions: vi.fn() }))
    const three = renderToStaticMarkup(h(DraftStep, { months: 3, onReview: vi.fn(), onQuestions: vi.fn() }))
    expect(one).toContain('last month')
    expect(three).toContain('last 3 months')
    expect(three).toContain('Review my draft')
    expect(three).toContain('Ask me a few questions first')
  })
})
