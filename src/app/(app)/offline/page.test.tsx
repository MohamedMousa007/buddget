import { describe, expect, it } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import OfflinePage from './page'

describe('offline page', () => {
  it('is a <main> landmark with the heading inside (axe landmark-one-main, round 2)', () => {
    const html = renderToStaticMarkup(h(OfflinePage))
    expect(html).toMatch(/^<main[ >]/)
    expect(html).toContain('<h1')
  })
})
