import { describe, expect, it } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CreateChooser } from './CreateChooser'
import { LearningNote } from '../LearningNote'

const noop = () => {}
const props = { plans: [], drafts: [], onIntent: noop, onBlank: noop, onTemplate: noop, onCopy: noop, onContinue: noop }

describe('Budget start screen', () => {
  const html = renderToStaticMarkup(h(CreateChooser, props))
  const text = html.replace(/<[^>]*>/g, ' ')

  it('is the main screen with no budget: no close button', () => {
    expect(html).not.toContain('aria-label="Close"')
    expect(renderToStaticMarkup(h(CreateChooser, { ...props, onClose: noop }))).toContain('aria-label=')
  })
  it('offers exactly three starting points plus the build-it-yourself row', () => {
    for (const s of ['Save more', 'Plan a big goal', 'Get out of debt', 'Blank', 'Template', 'Copy a plan']) expect(text).toContain(s)
    for (const s of ['Stop overspending', 'Just organise it']) expect(text).not.toContain(s)
  })
  it('says plainly that this builds a budget', () => {
    expect(text).toContain('Build your budget')
  })
  it('the learning note renders as a note', () => {
    expect(renderToStaticMarkup(h(LearningNote))).toContain('role="note"')
  })
})
