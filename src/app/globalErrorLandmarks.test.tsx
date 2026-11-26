import { describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/lib/crash/init', () => ({ captureAppError: () => undefined }))
vi.mock('@/lib/fonts/appFonts', () => ({ appFontClasses: '' }))
vi.mock('./globals.css', () => ({}))

const { default: GlobalError } = await import('./global-error')
const { en } = await import('@/lib/i18n/dictionaries/en')

/** QA: dark-ar /subscriptions had no main landmark and no h1 — the root error screen, which replaces the whole shell. */
describe('the root error screen keeps the page landmarks', () => {
  const html = renderToStaticMarkup(h(GlobalError, { error: new Error('boom'), reset: () => undefined }))

  it('has one main and one h1 carrying the title', () => {
    expect(html.match(/<main[\s>]/g)).toHaveLength(1)
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1)
    expect(html).toContain(`>${en.systemPages.rootError.title}</h1>`)
  })

  it('keeps its look (same title classes, retry at the 44px touch size)', () => {
    expect(html).toMatch(/<h1 class="text-lg font-bold text-\[var\(--color-brand-text-primary\)\]">/)
    expect(html).toMatch(/<button[^>]*\bh-11\b/)
  })
})
