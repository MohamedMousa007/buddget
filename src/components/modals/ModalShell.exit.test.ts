import { describe, it, expect, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PresenceContext } from 'framer-motion'

const lite = vi.hoisted(() => new Map<object, unknown>())
vi.mock('react', async (orig) => {
  const o = await orig<typeof import('react')>()
  const { hooks } = await import('@/hooks/__tests__/liteReact')
  // Effects and refs are driven by the lite runner in the guard test; markup rendering keeps the real ones otherwise.
  return {
    ...o,
    useEffect: (run: () => (() => void) | void, deps?: unknown[]) => (lite.size ? hooks.useEffect(run, deps) : o.useEffect(run, deps)),
    useRef: <T,>(v: T) => (lite.size ? hooks.useRef(v) : o.useRef(v)),
    useContext: (ctx: object) => (lite.has(ctx) ? lite.get(ctx) : o.useContext(ctx as never)),
  }
})

import { DismissGuardContext, ExitInertBackdrop, ExitInertPanel, useDismissGuard } from './ModalShell'
import { renderLite } from '@/hooks/__tests__/liteReact'

const presence = (isPresent: boolean) => ({ id: 'x', initial: false as const, isPresent, custom: undefined, onExitComplete: () => {}, register: () => () => {} })
const panel = (isPresent: boolean) =>
  renderToStaticMarkup(h(PresenceContext.Provider, { value: presence(isPresent) }, h(ExitInertPanel, { role: 'dialog', style: { color: 'red' } }, 'Save')))
const backdrop = (isPresent: boolean) =>
  renderToStaticMarkup(h(PresenceContext.Provider, { value: presence(isPresent) }, h(ExitInertBackdrop, { type: 'button' })))

describe('an exiting sheet cannot be tapped (FRM-4)', () => {
  it('while AnimatePresence plays the exit the panel is inert and ignores pointers', () => {
    const html = panel(false)
    expect(html).toContain('inert=""')
    expect(html).toContain('pointer-events:none')
    expect(html).toContain('color:red')
  })
  it('a present panel is untouched: no inert attribute, its own style only', () => {
    const html = panel(true)
    expect(html).not.toContain('inert')
    expect(html).not.toContain('pointer-events')
    expect(html).toContain('color:red')
  })
  it('the exiting backdrop is inert too, so a late tap cannot re-dismiss', () => {
    expect(backdrop(false)).toContain('inert=""')
    expect(backdrop(true)).not.toContain('inert')
  })
})

describe('useDismissGuard (FRM-8)', () => {
  it('registers the sheet content\'s guard where Escape, backdrop, swipe and back look for it', () => {
    const slot = { current: null as (() => boolean) | null }
    lite.set(DismissGuardContext, slot)
    let dirty = true
    const run = renderLite(() => useDismissGuard(() => dirty))
    expect(slot.current?.()).toBe(true)
    dirty = false
    run.act(() => {})
    expect(slot.current?.()).toBe(false)
    lite.delete(DismissGuardContext)
  })
})
