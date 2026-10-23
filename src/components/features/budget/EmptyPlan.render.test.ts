import { describe, expect, it } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { EmptyPlan } from './EmptyPlan'
import { LearningNote } from './LearningNote'

const noop = () => {}

describe('Budget empty state', () => {
  const html = renderToStaticMarkup(h(EmptyPlan, { onBuildWithBuddgy: noop, onManual: noop }))

  it('leads with Buddgy and keeps building by hand one tap below', () => {
    expect(html).toContain('Start with Buddgy')
    expect(html).toContain('Or set it up myself')
  })
  it('no longer offers a starter plan or a blank start', () => {
    expect(html.toLowerCase()).not.toContain('starter')
    expect(html).not.toContain('Start from scratch')
  })
  it('says what the user gets, without invented numbers', () => {
    expect(html).toContain('Built from your own numbers')
    expect(html.replace(/<[^>]*>/g, ' ')).not.toMatch(/\d{3,}/)
  })
  it('the learning note renders as a note', () => {
    expect(renderToStaticMarkup(h(LearningNote))).toContain('role="note"')
  })
})
