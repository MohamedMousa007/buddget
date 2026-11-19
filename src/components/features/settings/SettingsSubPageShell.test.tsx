import { describe, expect, it } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SettingsSubPageShell } from './SettingsSubPageShell'

describe('SettingsSubPageShell', () => {
  it('keeps the back control 44px wide (px-2 alone made it 38px)', () => {
    const html = renderToStaticMarkup(h(SettingsSubPageShell, { title: 'T', children: null }))
    const btn = html.match(/<button[^>]*>/)?.[0] ?? ''
    expect(btn).toContain('min-w-11')
  })
})
