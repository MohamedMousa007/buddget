import { describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { OpenerStep } from './OpenerStep'
import { UnderstoodStep } from './UnderstoodStep'

describe('describe-yourself step', () => {
  const html = renderToStaticMarkup(h(OpenerStep, { base: 'EGP', onDone: vi.fn(), onSkip: vi.fn() }))

  it('invites a sentence or two, and can be skipped', () => {
    expect(html).toContain('Tell me about your situation')
    expect(html).toContain('Skip, ask me instead')
    expect(html).toContain('maxLength="400"')
  })
  it('the continue button is disabled until something is written', () => {
    expect(html).toMatch(/disabled[^>]*>[^<]*Continue|Continue[^<]*<\/button>/)
  })
  it('shows what was understood, one row each', () => {
    const rows = [{ id: 'income', label: 'Income', value: 'EGP 18,000' }, { id: 'rent', label: 'Rent', value: 'EGP 6,000' }]
    const out = renderToStaticMarkup(h(UnderstoodStep, { rows, onContinue: vi.fn() }))
    expect(out).toContain('I picked up 2 things')
    expect(out).toContain('EGP 6,000')
  })
})
