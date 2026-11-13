import { describe, expect, it } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AddLineForm } from './AddLineSheet'

const props = { block: 'bills' as const, suggestions: [], onClose: () => {}, onAdd: () => {} }

describe('AddLineSheet', () => {
  it('has no "save and add another" button unless asked', () => {
    expect(renderToStaticMarkup(h(AddLineForm, props))).not.toContain('Save and add another')
  })
  it('shows it when the builder asks for it', () => {
    expect(renderToStaticMarkup(h(AddLineForm, { ...props, addAnotherLabel: 'Save and add another' }))).toContain('Save and add another')
  })
})
