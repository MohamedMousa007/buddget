import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AppLink } from './AppLink'

const native = vi.hoisted(() => ({ on: false }))
vi.mock('@/lib/native/isNative', () => ({ isNative: () => native.on }))
vi.mock('@/lib/navigation/navigate', () => ({ navigate: vi.fn() }))

const render = () => renderToStaticMarkup(createElement(AppLink, { href: '/flow' }, 'Flow'))

describe('AppLink', () => {
  it('is not draggable in the native WebView, so long-press shows no URL preview', () => {
    native.on = true
    expect(render()).toContain('draggable="false"')
  })

  it('keeps default anchor behaviour on the web', () => {
    native.on = false
    expect(render()).not.toContain('draggable')
  })
})
